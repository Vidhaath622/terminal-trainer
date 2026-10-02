/**
 * Small HTTP helpers shared by the API routes: identity resolution, CSRF
 * same-origin checks, a bounded JSON body reader, and rate-limit responses.
 */
import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE, type SessionPayload } from "./session";
import type { RateLimitResult } from "./ratelimit";

/** Resolve the signed-in user from the request cookie, or null. */
export function currentUser(req: NextRequest): SessionPayload | null {
  return decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "not signed in" }, { status: 401 });
}

/**403 — authenticated but not allowed (e.g. not the owner). */
export function forbidden(message = "forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serverError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function crossOrigin(): NextResponse {
  return NextResponse.json({ error: "cross-origin request rejected" }, { status: 403 });
}

/**
 * CSRF guard for state-changing routes. Browsers attach `Origin` to every
 * non-GET same-origin request, so a mismatch (or a `null` origin from a
 * sandboxed frame) means the call did not come from this app's own pages.
 * When `Origin` is absent we fall back to `Sec-Fetch-Site`; requests carrying
 * neither header are non-browser clients and are allowed through (they cannot
 * ride a victim's cookies by definition of how CSRF works).
 *
 * Returns a 403 response when the request must be rejected, null when fine.
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  if (!STATE_CHANGING.has(req.method)) return null;

  const origin = req.headers.get("origin");
  if (origin) {
    if (origin === "null") return crossOrigin();
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return crossOrigin();
    }
    const host = req.headers.get("host");
    if (!host || originHost !== host) return crossOrigin();
    return null;
  }

  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return crossOrigin();
  return null;
}

export const MAX_JSON_BODY_BYTES = 262144; // 256 KiB — progress blobs are tiny

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too-large" | "invalid" };

/**
 * Read + parse the request body under a hard byte cap. Checks the declared
 * `content-length` first, then cancels the stream the moment it exceeds the
 * limit, so chunked uploads cannot balloon memory either.
 */
export async function readJsonBody(
  req: NextRequest,
  maxBytes: number = MAX_JSON_BODY_BYTES
): Promise<JsonBodyResult> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, reason: "too-large" };
  }

  const body = req.body;
  if (!body) return { ok: false, reason: "invalid" };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: "too-large" };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(merged)) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function tooLarge(): NextResponse {
  return NextResponse.json({ error: "body too large" }, { status: 413 });
}

/** 429 response for a failed rate-limit check, with Retry-After seconds. */
export function rateLimited(result: RateLimitResult): NextResponse | null {
  if (result.ok) return null;
  return NextResponse.json(
    { error: "too many requests" },
    { status: 429, headers: { "Retry-After": String(Math.max(1, result.retryAfterSeconds)) } }
  );
}
