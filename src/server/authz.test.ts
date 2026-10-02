/**
 * Tripwire: the server-derived role model must default to "student" (zero
 * authoring caps), read roles ONLY from env allowlists, and never accept a
 * client-asserted role field.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  roleFor,
  serverCan,
  requireServerCapability,
  isOwner,
  effectiveRole,
  normalizeRole,
  type SessionIdentity,
} from "./authz";
import { AccessDeniedError, type Capability, type Role } from "@/roles/types";

const ENV_KEYS = [
  "ADMIN_GITHUB_IDS",
  "ADMIN_LOGINS",
  "TEACHER_GITHUB_IDS",
  "TEACHER_LOGINS",
  "OWNER_GITHUB_IDS",
  "OWNER_LOGINS",
];

const session = (githubId = 101, login = "someone"): SessionIdentity => ({ githubId, login });

beforeEach(() => {
  for (const key of ENV_KEYS) vi.stubEnv(key, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("roleFor", () => {
  it("defaults every session to student", () => {
    expect(roleFor(session())).toBe("student");
    expect(roleFor(session(1, "octocat"))).toBe("student");
  });

  it("treats anonymous as student", () => {
    expect(roleFor(null)).toBe("student");
    expect(roleFor(undefined)).toBe("student");
  });

  it("recognizes admin ids (trimmed, junk entries ignored)", () => {
    vi.stubEnv("ADMIN_GITHUB_IDS", " 999 , not-a-number , 101 ");
    expect(roleFor(session(101))).toBe("admin");
    expect(roleFor(session(999))).toBe("admin");
    expect(roleFor(session(102))).toBe("student");
  });

  it("recognizes admin logins case-insensitively", () => {
    vi.stubEnv("ADMIN_LOGINS", "RootUser, other.admin");
    expect(roleFor(session(1, "rootuser"))).toBe("admin");
    expect(roleFor(session(1, "ROOTUSER"))).toBe("admin");
    expect(roleFor(session(1, "other.admin"))).toBe("admin");
    expect(roleFor(session(1, "rootuser2"))).toBe("student");
  });

  it("recognizes teacher ids and logins", () => {
    vi.stubEnv("TEACHER_GITHUB_IDS", "42");
    vi.stubEnv("TEACHER_LOGINS", "ProfAda");
    expect(roleFor(session(42))).toBe("teacher");
    expect(roleFor(session(7, "profada"))).toBe("teacher");
    expect(roleFor(session(7, "student1"))).toBe("student");
  });

  it("admin beats teacher when both lists match", () => {
    vi.stubEnv("ADMIN_GITHUB_IDS", "42");
    vi.stubEnv("TEACHER_GITHUB_IDS", "42");
    expect(roleFor(session(42))).toBe("admin");
  });
});

describe("server capability checks", () => {
  const AUTHORING_CAPS: Capability[] = [
    "problem:create",
    "problem:edit",
    "problem:delete",
    "testcase:upload",
    "testcase:edit",
    "quiz:create",
    "quiz:edit",
    "assignment:create",
  ];

  it("students hold zero authoring capabilities", () => {
    for (const cap of AUTHORING_CAPS) {
      expect(serverCan(session(), cap), `student must lack ${cap}`).toBe(false);
      expect(() => requireServerCapability(session(), cap)).toThrow(AccessDeniedError);
    }
  });

  it("anonymous holds zero authoring capabilities", () => {
    for (const cap of AUTHORING_CAPS) {
      expect(serverCan(null, cap)).toBe(false);
    }
  });

  it("teachers may author but not manage users", () => {
    vi.stubEnv("TEACHER_LOGINS", "profada");
    const teacher = session(42, "profada");
    for (const cap of AUTHORING_CAPS) expect(serverCan(teacher, cap)).toBe(true);
    expect(() => requireServerCapability(teacher, "problem:edit")).not.toThrow();
    expect(serverCan(teacher, "user:manage")).toBe(false);
    expect(() => requireServerCapability(teacher, "user:manage")).toThrow(AccessDeniedError);
  });

  it("admins inherit authoring and user management", () => {
    vi.stubEnv("ADMIN_LOGINS", "root");
    const admin = session(1, "root");
    for (const cap of [...AUTHORING_CAPS, "user:manage" as Capability]) {
      expect(serverCan(admin, cap)).toBe(true);
    }
  });

  it("the thrown message names the resolved role and capability", () => {
    expect(() => requireServerCapability(session(), "problem:edit")).toThrow(
      "role 'student' lacks capability 'problem:edit'"
    );
  });

  it("ignores a client-asserted role field (identity is session-shaped only)", () => {
    const forged = { githubId: 666, login: "eve", role: "admin" } as unknown as SessionIdentity;
    expect(roleFor(forged)).toBe("student");
    expect(serverCan(forged, "problem:edit")).toBe(false);
  });
});

describe("isOwner", () => {
  it("is false by default, for anonymous and for ordinary sessions", () => {
    expect(isOwner(session())).toBe(false);
    expect(isOwner(session(1, "octocat"))).toBe(false);
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });

  it("matches OWNER_GITHUB_IDS and OWNER_LOGINS (logins case-insensitive)", () => {
    vi.stubEnv("OWNER_GITHUB_IDS", " 99 , 100 ");
    vi.stubEnv("OWNER_LOGINS", "TheOwner");
    expect(isOwner(session(99))).toBe(true);
    expect(isOwner(session(100))).toBe(true);
    expect(isOwner(session(1, "theowner"))).toBe(true);
    expect(isOwner(session(1, "theowner2"))).toBe(false);
    expect(isOwner(session(98))).toBe(false);
  });

  it("the owner resolves to admin; env-admins are NOT owners", () => {
    vi.stubEnv("OWNER_GITHUB_IDS", "5");
    vi.stubEnv("ADMIN_GITHUB_IDS", "6");
    expect(roleFor(session(5))).toBe("admin");
    expect(serverCan(session(5), "user:manage")).toBe(true);
    expect(isOwner(session(6))).toBe(false);
  });
});

describe("effectiveRole precedence", () => {
  const assigned = (role: Role) => ({ role, roleAssignedAt: "2026-10-02T00:00:00.000Z" });
  const unassigned = (role: Role) => ({ role, roleAssignedAt: null });

  it("owner wins over a stored panel row", () => {
    vi.stubEnv("OWNER_GITHUB_IDS", "5");
    expect(effectiveRole(session(5), assigned("student"))).toBe("admin");
    expect(effectiveRole(session(5), null)).toBe("admin");
  });

  it("panel assignment wins over env allowlists", () => {
    vi.stubEnv("TEACHER_GITHUB_IDS", "42");
    vi.stubEnv("ADMIN_GITHUB_IDS", "42");
    expect(effectiveRole(session(42), assigned("student"))).toBe("student");
    expect(effectiveRole(session(42), assigned("teacher"))).toBe("teacher");
  });

  it("env allowlists still govern rows the panel never touched", () => {
    vi.stubEnv("TEACHER_GITHUB_IDS", "42");
    expect(effectiveRole(session(42), unassigned("student"))).toBe("teacher");
    expect(effectiveRole(session(7), unassigned("student"))).toBe("student");
    expect(effectiveRole(session(7), null)).toBe("student");
  });

  it("falls back to env then student when there is no DB row", () => {
    vi.stubEnv("TEACHER_LOGINS", "ada");
    expect(effectiveRole(session(1, "ada"), null)).toBe("teacher");
    expect(effectiveRole(session(1, "bob"), null)).toBe("student");
  });

  it("anonymous is always student, even with a row in hand", () => {
    expect(effectiveRole(null, assigned("teacher"))).toBe("student");
    expect(effectiveRole(null, null)).toBe("student");
  });

  it("coerces junk stored roles to student", () => {
    expect(
      effectiveRole(session(1), { role: "superuser" as Role, roleAssignedAt: "2026-10-02" })
    ).toBe("student");
  });
});

describe("normalizeRole", () => {
  it("accepts the three roles and defaults everything else to student", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("teacher")).toBe("teacher");
    expect(normalizeRole("student")).toBe("student");
    expect(normalizeRole("ADMIN")).toBe("student");
    expect(normalizeRole(null)).toBe("student");
    expect(normalizeRole(undefined)).toBe("student");
    expect(normalizeRole(42)).toBe("student");
  });
});
