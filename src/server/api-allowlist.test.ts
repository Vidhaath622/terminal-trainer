/**
 * Tripwire: the /api surface is deny-by-default. Only the table below may be
 * reachable; authoring-shaped paths must never resolve.
 */
import { describe, it, expect } from "vitest";
import { API_ROUTES, ALLOWED_PREFIXES, apiRouteAllowed } from "./api-allowlist";

describe("apiRouteAllowed", () => {
  it("allows exactly the real handlers", () => {
    expect(apiRouteAllowed("GET", "/api/progress")).toBe("allow");
    expect(apiRouteAllowed("GET", "/api/progress/grep-search")).toBe("allow");
    expect(apiRouteAllowed("PUT", "/api/progress/grep-search")).toBe("allow");
    expect(apiRouteAllowed("GET", "/api/me")).toBe("allow");
    expect(apiRouteAllowed("GET", "/api/auth/github")).toBe("allow");
    expect(apiRouteAllowed("GET", "/api/auth/callback/github")).toBe("allow");
    expect(apiRouteAllowed("POST", "/api/auth/logout")).toBe("allow");
    expect(apiRouteAllowed("DELETE", "/api/account")).toBe("allow");
    expect(apiRouteAllowed("GET", "/api/admin/users")).toBe("allow");
    expect(apiRouteAllowed("PATCH", "/api/admin/users/123")).toBe("allow");
  });

  it("404s every authoring-shaped path (remote editor access is impossible)", () => {
    const attempts: [string, string][] = [
      ["POST", "/api/problems"],
      ["PUT", "/api/problems/xyz"],
      ["PATCH", "/api/problems/xyz"],
      ["POST", "/api/quizzes"],
      ["POST", "/api/content/publish"],
      ["PATCH", "/api/content/quiz-1"],
      ["POST", "/api/testcases/upload"],
      ["POST", "/api/assignments"],
      ["POST", "/api/upload"],
      ["POST", "/api/publish"],
      ["PUT", "/api/users/eve/role"],
      ["POST", "/api/roles"],
      ["GET", "/api"],
    ];
    for (const [method, path] of attempts) {
      expect(apiRouteAllowed(method, path), `${method} ${path}`).toBe("not-found");
    }
  });

  it("405s known paths called with the wrong method", () => {
    expect(apiRouteAllowed("POST", "/api/me")).toBe("method-not-allowed");
    expect(apiRouteAllowed("DELETE", "/api/progress/grep-search")).toBe("method-not-allowed");
    expect(apiRouteAllowed("POST", "/api/auth/github")).toBe("method-not-allowed");
  });

  it("ignores query strings, hashes, and trailing slashes", () => {
    expect(apiRouteAllowed("GET", "/api/me?x=1")).toBe("allow");
    expect(apiRouteAllowed("GET", "/api/me/")).toBe("allow");
    expect(apiRouteAllowed("GET", "/api/auth/callback/github?code=abc#frag")).toBe("allow");
    expect(apiRouteAllowed("GET", "/api/problems/?id=x")).toBe("not-found");
  });

  it("treats HEAD as GET (App Router serves HEAD from GET handlers)", () => {
    expect(apiRouteAllowed("HEAD", "/api/me")).toBe("allow");
    expect(apiRouteAllowed("HEAD", "/api/account")).toBe("method-not-allowed");
  });

  it("is case-insensitive on the method", () => {
    expect(apiRouteAllowed("get", "/api/me")).toBe("allow");
    expect(apiRouteAllowed("post", "/api/problems")).toBe("not-found");
  });
});

describe("API_ROUTES table", () => {
  it("only the four known routes change state", () => {
    const stateChanging = API_ROUTES.filter((r) => r.method !== "GET")
      .map((r) => `${r.method} ${r.pattern}`)
      .sort();
    expect(stateChanging).toEqual(
      [
        "DELETE /api/account",
        "PATCH /api/admin/users/:githubId",
        "POST /api/auth/logout",
        "PUT /api/progress/:problemId",
      ].sort()
    );
  });

  it("the only PATCH is the owner role assignment; no state-changing route outside auth/progress/account/admin", () => {
    const patches = API_ROUTES.filter((r) => r.method === "PATCH").map((r) => r.pattern);
    expect(patches).toEqual(["/api/admin/users/:githubId"]);
    expect(
      API_ROUTES.some(
        (r) =>
          r.method !== "GET" &&
          !r.pattern.startsWith("/api/auth/") &&
          r.pattern !== "/api/auth/logout" &&
          !r.pattern.startsWith("/api/progress") &&
          r.pattern !== "/api/account" &&
          !r.pattern.startsWith("/api/admin/users")
      )
    ).toBe(false);
  });

  it("serves only the known, non-authoring path prefixes", () => {
    for (const r of API_ROUTES) {
      const allowed = ALLOWED_PREFIXES.some((p) => r.pattern === p || r.pattern.startsWith(p + "/"));
      expect(allowed, `unexpected route in allowlist: ${r.method} ${r.pattern}`).toBe(true);
    }
  });
});
