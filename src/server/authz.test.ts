/**
 * Tripwire: the server-derived role model must default to "student" (zero
 * authoring caps), read roles ONLY from env allowlists, and never accept a
 * client-asserted role field.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { roleFor, serverCan, requireServerCapability, type SessionIdentity } from "./authz";
import { AccessDeniedError, type Capability } from "@/roles/types";

const ENV_KEYS = ["ADMIN_GITHUB_IDS", "ADMIN_LOGINS", "TEACHER_GITHUB_IDS", "TEACHER_LOGINS"];

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
