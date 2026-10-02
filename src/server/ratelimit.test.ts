import { describe, expect, it } from "vitest";
import { RateLimiter } from "./ratelimit";

describe("RateLimiter", () => {
  it("allows hits up to the limit inside one window", () => {
    const rl = new RateLimiter(3, 60_000);
    const t = 1_000_000;
    expect(rl.check("a", t).ok).toBe(true);
    expect(rl.check("a", t + 1).ok).toBe(true);
    expect(rl.check("a", t + 2).ok).toBe(true);
  });

  it("denies the hit past the limit with a positive Retry-After", () => {
    const rl = new RateLimiter(2, 60_000);
    const t = 1_000_000;
    rl.check("a", t);
    rl.check("a", t + 5_000);
    const denied = rl.check("a", t + 10_000);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSeconds).toBe(50);
  });

  it("opens a fresh window after windowMs elapses", () => {
    const rl = new RateLimiter(1, 60_000);
    const t = 1_000_000;
    expect(rl.check("a", t).ok).toBe(true);
    expect(rl.check("a", t + 59_999).ok).toBe(false);
    expect(rl.check("a", t + 60_000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const rl = new RateLimiter(1, 60_000);
    const t = 1_000_000;
    expect(rl.check("a", t).ok).toBe(true);
    expect(rl.check("b", t).ok).toBe(true);
    expect(rl.check("a", t + 1).ok).toBe(false);
    expect(rl.check("b", t + 1).ok).toBe(false);
  });

  it("prunes expired windows so the map stays bounded", () => {
    const rl = new RateLimiter(5, 60_000);
    const t = 1_000_000;
    rl.check("a", t);
    rl.check("b", t);
    rl.check("c", t);
    const store = (rl as unknown as { hits: Map<string, unknown> }).hits;
    expect(store.size).toBe(3);
    rl.check("d", t + 120_000); // triggers prune of a/b/c, starts fresh with d
    expect(store.size).toBe(1);
    expect(store.has("d")).toBe(true);
  });
});
