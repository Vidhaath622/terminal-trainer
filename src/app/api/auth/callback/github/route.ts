import { NextResponse, type NextRequest } from "next/server";
import { rateLimited } from "@/server/http";
import { authCallbackLimiter, clientKey } from "@/server/ratelimit";
import { exchangeCodeForToken, fetchGithubUser } from "@/server/github";
import { upsertUser } from "@/server/db";
import {
  encodeSession,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
  timingSafeStringEqual,
} from "@/server/session";

/**
 * GET /api/auth/callback/github — finish the OAuth flow.
 * Validates the state cookie (CSRF), exchanges the code for a token, upserts
 * the GitHub identity into Postgres, and issues the signed session cookie.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimited(authCallbackLimiter.check(clientKey(req)));
  if (limited) return limited;

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description");

  if (oauthError) return redirectTo(req, "/", `GitHub said: ${oauthError}`);
  if (!code) return redirectTo(req, "/", "Missing code from GitHub");
  if (!state) return redirectTo(req, "/", "Missing OAuth state");

  const cookieState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!cookieState || !timingSafeStringEqual(cookieState, state)) {
    return redirectTo(req, "/", "OAuth state mismatch — please try signing in again");
  }

  try {
    const origin =
      process.env.APP_ORIGIN ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : url.origin);

    const token = await exchangeCodeForToken(code, `${origin}/api/auth/callback/github`);
    const profile = await fetchGithubUser(token.accessToken);
    await upsertUser(profile);

    const res = NextResponse.redirect(`${origin}/account`);
    res.cookies.set(SESSION_COOKIE, encodeSession({ ...profile, accessToken: token.accessToken }), sessionCookieOptions());
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return redirectTo(req, "/", message);
  }
}

function redirectTo(req: NextRequest, path: string, errorMessage?: string): NextResponse {
  const target = new URL(path, req.nextUrl.origin);
  if (errorMessage) target.searchParams.set("auth_error", errorMessage.slice(0, 200));
  const res = NextResponse.redirect(target);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}
