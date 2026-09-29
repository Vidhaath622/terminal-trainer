import { NextResponse, type NextRequest } from "next/server";
import { currentUser, serverError, unauthorized } from "@/server/http";
import { deleteAccount } from "@/server/db";
import { SESSION_COOKIE } from "@/server/session";

/**
 * DELETE /api/account — disconnect the GitHub account.
 * Deletes the user row (progress cascades) and clears the session cookie.
 */
export async function DELETE(req: NextRequest) {
  const session = currentUser(req);
  if (!session) return unauthorized();
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
