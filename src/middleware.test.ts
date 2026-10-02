/**
 * Tripwire: middleware 404s/405s everything outside API_ROUTES so no remote
 * caller can ever reach an endpoint that isn't on the table.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function req(method: string, url = "https://app.example/api/me"): NextRequest {
  return new NextRequest(url, { method });
}

describe("api middleware", () => {
  it("lets allowlisted requests through to the route handlers", () => {
    const res = middleware(req("GET", "https://app.example/api/progress/grep-search"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    const logout = middleware(
      new NextRequest("https://app.example/api/auth/logout", { method: "POST" })
    );
    expect(logout.headers.get("x-middleware-next")).toBe("1");
  });

  it("404s unknown paths before any handler runs", () => {
    const res = middleware(new NextRequest("https://app.example/api/problems", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("404s every plausible authoring endpoint", () => {
    for (const [method, url] of [
      ["POST", "https://app.example/api/quizzes"],
      ["PUT", "https://app.example/api/content/publish"],
      ["PATCH", "https://app.example/api/content/x"],
      ["POST", "https://app.example/api/testcases/upload"],
      ["PUT", "https://app.example/api/users/eve/role"],
    ] as [string, string][]) {
      const res = middleware(new NextRequest(url, { method }));
      expect(res.status, `${method} ${url}`).toBe(404);
    }
  });

  it("405s a known path with the wrong method", () => {
    const res = middleware(new NextRequest("https://app.example/api/me", { method: "POST" }));
    expect(res.status).toBe(405);
  });
});
