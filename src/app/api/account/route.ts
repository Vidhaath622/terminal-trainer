import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, currentUser, rateLimited, serverError, unauthorized } from "@/server/http";
import { accountLimiter } from "@/server/ratelimit";
import { deleteAccount } from "@/server/db";
import { SESSION_COOKIE } from "@/server/session";

/**
 * DELETE /api/account — disconnect the GitHub account.
 * Deletes the user row (progress cascades) and clears the session cookie.
 */
export async function DELETE(req: NextRequest) {
  const session = currentUser(req);
  if (!session) return unauthorized();

  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const limited = rateLimited(accountLimiter.check(`user:${session.githubId}`));
  if (limited) return limited;

  try {
    await deleteAccount(session.githubId);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  } catch (err) {
    console.error("account DELETE: db error", err);
    return serverError("could not delete account");
  }
}
