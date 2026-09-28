/**
 * Role-based access model: teachers author content, students consume it.
 * Pure TypeScript - no UI imports.
 */

export type Role = "admin" | "teacher" | "student";

export interface User {
  id: string;
  name: string;
  role: Role;
  /** college-provided identifier (roll no, email, etc.) */
  externalId?: string;
}

/** Capabilities, keyed by feature area. */
export type Capability =
  | "problem:create"
  | "problem:edit"
  | "problem:delete"
  | "testcase:upload"
  | "testcase:edit"
  | "quiz:create"
  | "quiz:edit"
  | "assignment:create"
  | "assignment:grade"
  | "content:view"
  | "content:answer"
  | "progress:viewOwn"
  | "progress:viewAll"
  | "user:manage";

const TEACHER_CAPS: Capability[] = [
  "problem:create",
  "problem:edit",
  "problem:delete",
  "testcase:upload",
  "testcase:edit",
  "quiz:create",
  "quiz:edit",
  "assignment:create",
  "assignment:grade",
  "content:view",
  "progress:viewAll",
];

const STUDENT_CAPS: Capability[] = ["content:view", "content:answer", "progress:viewOwn"];

const ADMIN_CAPS: Capability[] = [
  ...TEACHER_CAPS,
  ...STUDENT_CAPS,
  "user:manage",
];

const CAPS_BY_ROLE: Record<Role, Capability[]> = {
  teacher: TEACHER_CAPS,
  student: STUDENT_CAPS,
  admin: ADMIN_CAPS,
};

export function can(user: Pick<User, "role">, capability: Capability): boolean {
  return CAPS_BY_ROLE[user.role].includes(capability);
}

export function capabilitiesOf(role: Role): Capability[] {
  return [...CAPS_BY_ROLE[role]];
}

/** Guard helper: throws when the user lacks the capability. */
export function requireCapability(user: Pick<User, "role">, capability: Capability): void {
  if (!can(user, capability)) {
    throw new AccessDeniedError(`role '${user.role}' lacks capability '${capability}'`);
  }
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}
