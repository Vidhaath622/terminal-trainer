/**
 * Session cookies: HMAC-SHA256-signed, httpOnly. Zero dependencies.
 *
 * The cookie carries the GitHub identity plus the OAuth access token so the
 * server can call GitHub on the user's behalf. The token never reaches the
 * browser (the cookie is httpOnly and only the signature-verified payload is
 * ever decoded server-side).
 */
import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "tt_session";
export const OAUTH_STATE_COOKIE = "tt_oauth_state";

/** 10 days, in seconds — matches a typical academic term. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 10;

export interface SessionPayload {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  /** GitHub OAuth access token (kept server-side only). */
  accessToken: string;
  /** epoch seconds when the session was issued */
  iat: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Serialize + sign a session payload into a cookie value. */
export function encodeSession(payload: Omit<SessionPayload, "iat">): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify + decode a cookie value; null when tampered with or malformed. */
export function decodeSession(value: string | undefined | null): SessionPayload | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!safeEqual(mac, sign(body))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (
      typeof parsed.githubId !== "number" ||
      typeof parsed.login !== "string" ||
      typeof parsed.accessToken !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

/** Short-lived cookie holding the OAuth `state` value (CSRF guard). */
export function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
}

/** Read a cookie value from a raw Cookie header. */
export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
