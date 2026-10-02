import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/session";
import { assertSameOrigin, rateLimited } from "@/server/http";
import { clientKey, logoutLimiter } from "@/server/ratelimit";

/** POST /api/auth/logout — clear the session cookie. */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const limited = rateLimited(logoutLimiter.check(clientKey(req)));
  if (limited) return limited;

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
