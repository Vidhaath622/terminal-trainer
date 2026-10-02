/**
 * Deny-by-default API gate. Everything under /api/* that is not in
 * `API_ROUTES` never reaches a route handler: unknown paths get 404, known
 * paths with the wrong method get 405. This is what makes remote authoring
 * impossible — an authoring endpoint cannot answer a remote request unless the
 * allowlist is deliberately extended (and the route-surface tests fail CI if
 * someone adds a route file without doing so).
 *
 * Session auth, CSRF same-origin checks and rate limits stay in the handlers.
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiRouteAllowed } from "@/server/api-allowlist";

export function middleware(req: NextRequest): NextResponse {
  const verdict = apiRouteAllowed(req.method, req.nextUrl.pathname);
  if (verdict === "allow") return NextResponse.next();
  if (verdict === "method-not-allowed") {
    return NextResponse.json({ error: "method not allowed" }, { status: 405 });
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export const config = {
  matcher: ["/api/:path*"],
};
