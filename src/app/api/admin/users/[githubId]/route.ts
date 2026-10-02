import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  assertSameOrigin,
  badRequest,
  currentUser,
  forbidden,
  rateLimited,
  readJsonBody,
  serverError,
  tooLarge,
  unauthorized,
} from "@/server/http";
import { adminLimiter } from "@/server/ratelimit";
import { isOwner } from "@/server/authz";
import { setUserRole } from "@/server/db";

/** Only the two assignable roles; admin/owner can never be granted via API. */
const assignSchema = z.object({ role: z.enum(["student", "teacher"]) });

const MAX_BODY_BYTES = 1024; // a role assignment is a handful of bytes

/**
 * PATCH /api/admin/users/[githubId] — assign `student` or `teacher` to a
 * signed-in GitHub account. Owner-only (401 no session, 403 not the owner),
 * CSRF same-origin, rate-limited, body schema-validated. The owner's own row
 * is immutable: their effective role is always admin via env.
 */
export async function PATCH(req: NextRequest, ctx: { params: { githubId: string } }) {
  const session = currentUser(req);
  if (!session) return unauthorized();
  if (!isOwner(session)) return forbidden("owner only");

  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const limited = rateLimited(adminLimiter.check(`admin:${session.githubId}`));
  if (limited) return limited;

  const githubId = Number(ctx.params.githubId);
  if (!Number.isInteger(githubId) || githubId <= 0) return badRequest("invalid github id");
  if (githubId === session.githubId) return badRequest("cannot change the owner's own role");

  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (!body.ok) return body.reason === "too-large" ? tooLarge() : badRequest("body must be JSON");

  const parsed = assignSchema.safeParse(body.value);
  if (!parsed.success) return badRequest("role must be 'student' or 'teacher'");

  try {
    const updated = await setUserRole(githubId, parsed.data.role);
    if (!updated) return NextResponse.json({ error: "no such account" }, { status: 404 });
    return NextResponse.json({ ok: true, githubId, role: parsed.data.role });
  } catch (err) {
    console.error("admin role PATCH: db error", err);
    return serverError("could not update role");
  }
}
