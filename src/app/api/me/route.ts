import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/server/http";
import { getUser } from "@/server/db";

/**
 * GET /api/me — the signed-in user's profile, or `{ user: null }`.
 * Prefers the DB row (fresh login/avatar), falls back to the cookie claims
 * if the database is unreachable.
 */
export async function GET(req: NextRequest) {
  const session = currentUser(req);
  if (!session) return NextResponse.json({ user: null });

  const claims = {
    githubId: session.githubId,
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
    createdAt: null as string | null,
  };

  try {
    const user = await getUser(session.githubId);
    return NextResponse.json({ user: user ?? claims });
  } catch (err) {
    console.error("me: db error", err);
    return NextResponse.json({ user: claims });
  }
}
