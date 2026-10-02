import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/server/http";
import { effectiveRole, isOwner } from "@/server/authz";
import { getUser } from "@/server/db";

/**
 * GET /api/me — the signed-in user's profile + the SERVER-computed role, or
 * `{ user: null }`. Prefers the DB row (fresh login/avatar), falls back to the
 * cookie claims if the database is unreachable.
 *
 * The `role` field is the effective role computed server-side (owner → panel
 * assignment → env allowlist → student, src/server/authz.ts) and is the only
 * role any client should trust; the console's role switcher is a local demo
 * and never reaches this endpoint. `isOwner` gates the /admin panel UI (the
 * admin API enforces it independently).
 */
export async function GET(req: NextRequest) {
  const session = currentUser(req);
  if (!session) return NextResponse.json({ user: null });

  const owner = isOwner(session);
  const claims = {
    githubId: session.githubId,
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
    createdAt: null as string | null,
    role: effectiveRole(session, null),
    isOwner: owner,
  };

  try {
    const user = await getUser(session.githubId);
    return NextResponse.json({
      user: user ? { ...user, role: effectiveRole(session, user), isOwner: owner } : claims,
    });
  } catch (err) {
    console.error("me: db error", err);
    return NextResponse.json({ user: claims });
  }
}
