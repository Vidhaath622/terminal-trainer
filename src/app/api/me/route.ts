import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/server/http";
import { roleFor } from "@/server/authz";
import { getUser } from "@/server/db";

/**
 * GET /api/me — the signed-in user's profile + the SERVER-computed role, or
 * `{ user: null }`. Prefers the DB row (fresh login/avatar), falls back to the
 * cookie claims if the database is unreachable.
 *
 * The `role` field is derived server-side from the env allowlists
 * (src/server/authz.ts) and is the only role any client should trust; the
 * console's role switcher is a local demo and never reaches this endpoint.
 */
export async function GET(req: NextRequest) {
  const session = currentUser(req);
  if (!session) return NextResponse.json({ user: null });

  const role = roleFor(session);
  const claims = {
    githubId: session.githubId,
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
    createdAt: null as string | null,
    role,
  };

  try {
    const user = await getUser(session.githubId);
    return NextResponse.json({ user: user ? { ...user, role } : claims });
  } catch (err) {
    console.error("me: db error", err);
    return NextResponse.json({ user: claims });
  }
}
