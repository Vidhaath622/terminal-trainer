import { describe, it, expect } from "vitest";
import { can, capabilitiesOf, requireCapability, AccessDeniedError, type User } from "./types";
import { UserStore } from "./store";

const teacher: User = { id: "t1", name: "Prof. Ada", role: "teacher" };
const student: User = { id: "s1", name: "Bob", role: "student" };
const admin: User = { id: "a1", name: "Root", role: "admin" };

describe("capabilities", () => {
  it("teachers can author, grade, and manage test cases", () => {
    expect(can(teacher, "problem:create")).toBe(true);
    expect(can(teacher, "testcase:upload")).toBe(true);
    expect(can(teacher, "quiz:create")).toBe(true);
    expect(can(teacher, "assignment:create")).toBe(true);
    expect(can(teacher, "assignment:grade")).toBe(true);
  });

  it("students can view and answer content only", () => {
    expect(can(student, "content:view")).toBe(true);
    expect(can(student, "content:answer")).toBe(true);
    expect(can(student, "progress:viewOwn")).toBe(true);
  });

  it("students cannot access teacher capabilities", () => {
    for (const cap of ["problem:create", "testcase:upload", "quiz:create", "assignment:create", "assignment:grade", "user:manage", "progress:viewAll"] as const) {
      expect(can(student, cap)).toBe(false);
    }
  });

  it("teachers cannot manage users", () => {
    expect(can(teacher, "user:manage")).toBe(false);
  });

  it("admin inherits everything", () => {
    expect(can(admin, "user:manage")).toBe(true);
    expect(can(admin, "testcase:upload")).toBe(true);
    expect(can(admin, "content:answer")).toBe(true);
  });

  it("requireCapability throws AccessDeniedError for students acting as teachers", () => {
    expect(() => requireCapability(student, "problem:create")).toThrow(AccessDeniedError);
    expect(() => requireCapability(teacher, "problem:create")).not.toThrow();
  });

  it("capabilitiesOf lists role caps without mutation risk", () => {
    const caps = capabilitiesOf("student");
    expect(caps).toContain("content:answer");
    caps.push("problem:create" as never);
    expect(can(student, "problem:create")).toBe(false);
  });
});

describe("UserStore", () => {
  it("publishes content for teachers and records authorship", () => {
    const store = new UserStore();
    store.addUser(teacher);
    store.addUser(student);
    const c = store.publishContent("t1", {
      id: "p1",
      kind: "problem",
      title: "Navigation basics",
      visibleTo: ["student"],
    });
    expect(c.createdBy).toBe("t1");
  });

  it("refuses student publishing", () => {
    const store = new UserStore();
    store.addUser(student);
    expect(() =>
      store.publishContent("s1", { id: "p9", kind: "problem", title: "X", visibleTo: ["student"] })
    ).toThrow(AccessDeniedError);
    expect(store.listContent()).toHaveLength(0);
  });

  it("visibleContentFor hides teacher drafts from students but shows their own", () => {
    const store = new UserStore();
    store.addUser(teacher);
    store.addUser(student);
    store.publishContent("t1", { id: "v1", kind: "quiz", title: "Visible quiz", visibleTo: ["student"] });
    store.publishContent("t1", { id: "d1", kind: "quiz", title: "Teacher-only draft", visibleTo: ["teacher"] });

    const studentSees = store.visibleContentFor(student);
    expect(studentSees.map((c) => c.id)).toEqual(["v1"]);

    const teacherSees = store.visibleContentFor(teacher);
    expect(teacherSees.map((c) => c.id).sort()).toEqual(["d1", "v1"]);
  });

  it("only the author or admin can edit content", () => {
    const store = new UserStore();
    store.addUser(teacher);
    store.addUser(admin);
    store.publishContent("t1", { id: "p1", kind: "assignment", title: "A1", visibleTo: ["student"] });

    expect(() =>
      store.editContent("a1", "p1", { title: "A1 (admin edit)" })
    ).not.toThrow();
    expect(store.editContent("t1", "p1", { title: "A1 final" }).title).toBe("A1 final");
  });

  it("role changes require admin", () => {
    const store = new UserStore();
    store.addUser(teacher);
    store.addUser(student);
    store.addUser(admin);

    expect(() => store.setUserRole("t1", "s1", "teacher")).toThrow(AccessDeniedError);
    expect(store.setUserRole("a1", "s1", "teacher").role).toBe("teacher");
  });

  it("unknown actors are denied", () => {
    const store = new UserStore();
    expect(() => store.publishContent("ghost", { id: "x", kind: "quiz", title: "Q", visibleTo: [] })).toThrow(AccessDeniedError);
  });
});
