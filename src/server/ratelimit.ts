/**
 * In-memory fixed-window rate limiter.
 *
 * Best effort by design: each serverless instance keeps its own map, so the
 * effective limit is per-instance. That is still enough to blunt credential
 * probing on the OAuth endpoints and runaway or hostile clients on the
 * progress API; an edge/WAF rule remains the right tool for hard limits.
 *
 * Pure logic lives on RateLimiter (testable with a fake clock); the shared
 * instances below are what the routes import.
 */
import type { NextRequest } from "next/server";

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export class RateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** Record a hit for `key`; ok=false once the window's budget is spent. */
  check(key: string, now: number = Date.now()): RateLimitResult {
    this.prune(now);
    const entry = this.hits.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return { ok: true, retryAfterSeconds: 0 };
    }
    if (entry.count >= this.limit) {
      const resetAt = entry.windowStart + this.windowMs;
      return { ok: false, retryAfterSeconds: Math.ceil((resetAt - now) / 1000) };
    }
    entry.count += 1;
    return { ok: true, retryAfterSeconds: 0 };
  }

  /** Drop windows that can no longer deny anything (keeps the map bounded). */
  private prune(now: number): void {
    for (const [key, entry] of this.hits) {
      if (now - entry.windowStart >= this.windowMs) this.hits.delete(key);
    }
  }
}

/** Best-effort client identity: first x-forwarded-for hop (Vercel), then x-real-ip. */
export function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "local";
}

/** Shared limiters (per route, per minute). */
export const authStartLimiter = new RateLimiter(10, 60_000);
export const authCallbackLimiter = new RateLimiter(20, 60_000);
export const progressPutLimiter = new RateLimiter(120, 60_000);
export const accountLimiter = new RateLimiter(10, 60_000);
export const logoutLimiter = new RateLimiter(10, 60_000);
export const adminLimiter = new RateLimiter(60, 60_000);
