/**
 * Deny-by-default /api surface.
 *
 * Remote authoring must stay impossible: the ONLY HTTP endpoints this app will
 * ever answer are listed in API_ROUTES (today: progress sync, profile read,
 * OAuth, logout, account deletion). `src/middleware.ts` 404s everything else,
 * so a future authoring route (POST /api/problems, PUT /api/content/...) cannot
 * respond to a remote caller without a deliberate edit to this table — which
 * `api-allowlist.test.ts` and `route-surface.test.ts` will flag in CI.
 *
 * Authn (session cookie), CSRF (assertSameOrigin) and rate limits stay in the
 * route handlers; this table only decides existence. Never add an entry that
 * accepts authored content (problems, quizzes, test cases, assignments).
 */

export interface ApiRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path pattern; `:name` matches exactly one segment. */
  pattern: string;
}

export const API_ROUTES: readonly ApiRoute[] = [
  { method: "GET", pattern: "/api/progress" },
  { method: "GET", pattern: "/api/progress/:problemId" },
  { method: "PUT", pattern: "/api/progress/:problemId" },
  { method: "GET", pattern: "/api/me" },
  { method: "GET", pattern: "/api/auth/github" },
  { method: "GET", pattern: "/api/auth/callback/github" },
  { method: "POST", pattern: "/api/auth/logout" },
  { method: "DELETE", pattern: "/api/account" },
  // Owner-only role panel (401/403 for everyone but the owner env identity).
  { method: "GET", pattern: "/api/admin/users" },
  { method: "PATCH", pattern: "/api/admin/users/:githubId" },
];

/** The only path prefixes the app serves; nothing authoring-shaped lives here. */
export const ALLOWED_PREFIXES = [
  "/api/progress",
  "/api/me",
  "/api/auth",
  "/api/account",
  "/api/admin",
] as const;

export type ApiVerdict = "allow" | "not-found" | "method-not-allowed";

function normalize(pathname: string): string {
  const path = pathname.split("?")[0].split("#")[0];
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function patternToRegex(pattern: string): RegExp {
  const source = pattern
    .split("/")
    .map((seg) =>
      seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )
    .join("/");
  return new RegExp(`^${source}$`);
}

const COMPILED = API_ROUTES.map((route) => ({ ...route, regex: patternToRegex(route.pattern) }));

/**
 * Should this request reach a route handler?
 * `HEAD` counts as `GET` (the App Router serves HEAD from GET handlers).
 */
export function apiRouteAllowed(method: string, pathname: string): ApiVerdict {
  const path = normalize(pathname);
  const m = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase();
  const matching = COMPILED.filter((route) => route.regex.test(path));
  if (matching.length === 0) return "not-found";
  return matching.some((route) => route.method === m) ? "allow" : "method-not-allowed";
}
