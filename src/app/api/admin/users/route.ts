import { NextResponse, type NextRequest } from "next/server";
import { currentUser, forbidden, rateLimited, serverError, unauthorized } from "@/server/http";
import { adminLimiter } from "@/server/ratelimit";
import { effectiveRole, isOwner } from "@/server/authz";
import { listUsersWithRoles } from "@/server/db";

/**
 * GET /api/admin/users — the owner panel's roster: every GitHub account that
 * has signed in, with its effective role and where that role comes from.
 *
 * Owner-only: 401 without a session, 403 for everyone who is not the
 * owner-named account (env-admins included). Reaches the DB only after both
 * checks, and is rate-limited per owner session.
 */
export async function GET(req: NextRequest) {
  const session = currentUser(req);
  if (!session) return unauthorized();
  if (!isOwner(session)) return forbidden("owner only");

  const limited = rateLimited(adminLimiter.check(`admin:${session.githubId}`));
  if (limited) return limited;

  try {
    const users = await listUsersWithRoles();
    return NextResponse.json({
      users: users.map((u) => {
        const identity = { githubId: u.githubId, login: u.login };
        return {
          githubId: u.githubId,
          login: u.login,
          name: u.name,
          avatarUrl: u.avatarUrl,
          createdAt: u.createdAt,
          role: effectiveRole(identity, u),
          roleSource: u.roleAssignedAt ? ("panel" as const) : ("env" as const),
          isOwner: isOwner(identity),
        };
      }),
    });
  } catch (err) {
    console.error("admin users GET: db error", err);
    return serverError("could not list users");
  }
}
