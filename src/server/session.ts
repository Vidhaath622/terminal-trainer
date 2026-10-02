/**
 * Session cookies: AES-256-GCM-encrypted, httpOnly. Zero dependencies.
 *
 * The cookie carries the GitHub identity plus the OAuth access token so the
 * server can call GitHub on the user's behalf. The payload is encrypted and
 * authenticated with a key derived from SESSION_SECRET, so claims are neither
 * readable nor malleable outside the server; the cookie is httpOnly, so the
 * browser JS never sees the plaintext.
 *
 * Value format: `v2.<iv>.<tag>.<ciphertext>` (all base64url).
 * The legacy v1 `body.mac` HMAC format is rejected: those cookies hold a
 * plaintext access token, so they are retired rather than accepted.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";

export const SESSION_COOKIE = "tt_session";
export const OAUTH_STATE_COOKIE = "tt_oauth_state";

/** 10 days, in seconds — matches a typical academic term. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 10;

const COOKIE_VERSION = "v2";
const IV_BYTES = 12; // GCM nonce size
const TAG_BYTES = 16; // GCM auth tag size

export interface SessionPayload {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  /** GitHub OAuth access token (kept server-side only, inside the sealed payload). */
  accessToken: string;
  /** epoch seconds when the session was issued */
  iat: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

/** 32-byte AES key derived from SESSION_SECRET (sha256 = uniform, high entropy in). */
function key(): Buffer {
  return createHash("sha256").update(secret()).digest();
}

/** Timing-safe string comparison (used for the OAuth `state` cookie too). */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Encrypt + sign a session payload into a cookie value. */
export function encodeSession(payload: Omit<SessionPayload, "iat">): string {
  const plain = Buffer.from(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }),
    "utf8"
  );
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    COOKIE_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Verify + decrypt a cookie value; null when tampered with, malformed,
 * from the retired v1 format, or older than SESSION_MAX_AGE.
 */
export function decodeSession(value: string | undefined | null): SessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  // v1 (`body.mac`) and anything not exactly v2 is rejected outright.
  if (parts.length !== 4 || parts[0] !== COOKIE_VERSION) return null;
  const [, ivB64, tagB64, ciphertextB64] = parts;

  let parsed: SessionPayload;
  try {
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ciphertext = Buffer.from(ciphertextB64, "base64url");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    parsed = JSON.parse(plain) as SessionPayload;
  } catch {
    return null; // bad tag / malformed payload
  }

  if (
    typeof parsed.githubId !== "number" ||
    typeof parsed.login !== "string" ||
    typeof parsed.accessToken !== "string"
  ) {
    return null;
  }
  if (typeof parsed.iat !== "number" || !Number.isFinite(parsed.iat)) return null;
  // Server-side absolute expiry, independent of the browser honouring maxAge.
  if (parsed.iat + SESSION_MAX_AGE <= Math.floor(Date.now() / 1000)) return null;
  return parsed;
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
