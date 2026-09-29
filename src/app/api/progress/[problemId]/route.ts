import { NextResponse, type NextRequest } from "next/server";
import { badRequest, currentUser, serverError, unauthorized } from "@/server/http";
import { getProgress, putProgress } from "@/server/db";
import { putProgressSchema } from "@/lib/progress-schema";
import { LAUNCH_PROBLEMS } from "@/problems/launch";

/** Known problem ids, for fast validation of the path parameter. */
const KNOWN_PROBLEM_IDS = new Set(LAUNCH_PROBLEMS.map((p) => p.id));

/**
 * GET /api/progress/[problemId] — one problem's saved blob (or null).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { problemId: string } }
) {
  const session = currentUser(req);
  if (!session) return unauthorized();
  const { problemId } = ctx.params;
  if (!KNOWN_PROBLEM_IDS.has(problemId)) return badRequest(`unknown problem '${problemId}'`);
  try {
    const row = await getProgress(session.githubId, problemId);
    return NextResponse.json({ progress: row });
  } catch (err) {
    console.error("progress GET one: db error", err);
    return serverError("could not load progress");
  }
}

/**
 * PUT /api/progress/[problemId] — upsert this problem's progress blob.
 * Body: { data: SessionProgress-shaped blob }. The blob's problemId must
 * match the URL and the problem must exist in the catalog.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: { problemId: string } }
) {
  const session = currentUser(req);
  if (!session) return unauthorized();

  const { problemId } = ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("body must be JSON");
  }

  const parsed = putProgressSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("invalid progress data: " + parsed.error.issues[0]?.message);
  }
  if (parsed.data.problemId !== problemId) {
    return badRequest("problemId in body does not match URL");
  }
  if (!KNOWN_PROBLEM_IDS.has(problemId)) {
    return badRequest(`unknown problem '${problemId}'`);
  }

  try {
    const updatedAt = await putProgress(session.githubId, problemId, parsed.data.data);
    return NextResponse.json({ ok: true, updatedAt });
  } catch (err) {
    console.error("progress PUT: db error", err);
    return serverError("could not save progress");
  }
}
