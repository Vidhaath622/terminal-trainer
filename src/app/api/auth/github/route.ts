import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl } from "@/server/github";
import { OAUTH_STATE_COOKIE, oauthStateCookieOptions } from "@/server/session";
import { rateLimited } from "@/server/http";
import { authStartLimiter, clientKey } from "@/server/ratelimit";

/**
 * GET /api/auth/github — start the OAuth flow.
 * Generates a state value, stores it in a short-lived cookie, and redirects
 * to GitHub's authorize page.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimited(authStartLimiter.check(clientKey(req)));
  if (limited) return limited;

  const origin =
    process.env.APP_ORIGIN ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : req.nextUrl.origin);

  const state = randomBytes(16).toString("base64url");
  const redirectUri = `${origin}/api/auth/callback/github`;
  const url = authorizeUrl(redirectUri, state);

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());
  return res;
}
