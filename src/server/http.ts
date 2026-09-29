/**
 * Small HTTP helpers shared by the API routes.
 */
import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE, type SessionPayload } from "./session";

/** Resolve the signed-in user from the request cookie, or null. */
export function currentUser(req: NextRequest): SessionPayload | null {
  return decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "not signed in" }, { status: 401 });
}

export function serverError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
