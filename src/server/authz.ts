/**
 * Server-authoritative roles: WHO may author content is decided here, from
 * deploy-time configuration keyed on the sealed session identity — never from
 * anything the browser sends.
 *
 * Role sources (comma-separated env lists, trimmed, logins case-insensitive):
 *   ADMIN_GITHUB_IDS / ADMIN_LOGINS      -> "admin"
 *   TEACHER_GITHUB_IDS / TEACHER_LOGINS  -> "teacher"
 * everyone else (and every anonymous visitor) -> "student": zero authoring caps.
 *
 * The input type is deliberately session-shaped (githubId + login only), so a
 * client-asserted `role` field can never reach a capability check: remote
 * callers cannot talk their way into `problem:edit` / `quiz:create`.
 */
import { AccessDeniedError, can, type Capability, type Role } from "@/roles/types";
import type { SessionPayload } from "./session";

export type SessionIdentity = Pick<SessionPayload, "githubId" | "login">;

function envList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function envHasLogin(raw: string | undefined, login: string): boolean {
  const target = login.toLowerCase();
  return envList(raw).some((entry) => entry.toLowerCase() === target);
}

/** Resolve the server-side role for a session identity (or anonymous). */
export function roleFor(session: SessionIdentity | null | undefined): Role {
  if (!session) return "student";
  const id = String(session.githubId);
  if (envList(process.env.ADMIN_GITHUB_IDS).includes(id)) return "admin";
  if (envHasLogin(process.env.ADMIN_LOGINS, session.login)) return "admin";
  if (envList(process.env.TEACHER_GITHUB_IDS).includes(id)) return "teacher";
  if (envHasLogin(process.env.TEACHER_LOGINS, session.login)) return "teacher";
  return "student";
}

/** Capability check driven purely by the server-resolved role. */
export function serverCan(session: SessionIdentity | null | undefined, capability: Capability): boolean {
  return can({ role: roleFor(session) }, capability);
}

/** Guard for route handlers: throws AccessDeniedError when the role lacks the capability. */
export function requireServerCapability(
  session: SessionIdentity | null | undefined,
  capability: Capability
): void {
  const role = roleFor(session);
  if (!can({ role }, capability)) {
    throw new AccessDeniedError(`role '${role}' lacks capability '${capability}'`);
  }
}
