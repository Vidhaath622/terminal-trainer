import { describe, it, expect } from "vitest";
import { ContentStore } from "./client-store";
import { AccessDeniedError, type User } from "./types";
import type { Quiz } from "./quiz";

const teacher: User = { id: "t1", name: "Ada", role: "teacher" };
const student: User = { id: "s1", name: "Bob", role: "student" };
const admin: User = { id: "a1", name: "Root", role: "admin" };

const validProblem = {
  id: "p1",
  title: "Nav",
  difficulty: "easy",
  brief: "B",
  steps: [{ id: "s1", prompt: "P", marks: 2, checks: [{ type: "fileExists", path: "/f", marks: 2 }] }],
};

const validQuiz = {
  id: "q1",
  title: "Quiz 1",
  kind: "quiz",
  questions: [
    { kind: "mcq", id: "m1", prompt: "2+2?", options: [{ id: "a", text: "4" }, { id: "b", text: "5" }], correctOptionId: "a", marks: 2 },
  ],
};

describe("ContentStore publishing", () => {
  it("teacher publishes problems and quizzes; validation runs", () => {
    const store = new ContentStore();
    const p = store.publish(teacher, "problem", validProblem);
    expect(p.id).toBe("p1");
    const q = store.publish(teacher, "quiz", validQuiz) as Quiz;
    expect(q.questions[0].kind).toBe("mcq");
  });

  it("student cannot publish anything", () => {
    const store = new ContentStore();
    expect(() => store.publish(student, "problem", validProblem)).toThrow(AccessDeniedError);
    expect(() => store.publish(student, "quiz", validQuiz)).toThrow(AccessDeniedError);
  });

  it("admin can publish", () => {
    const store = new ContentStore();
    expect(store.publish(admin, "problem", validProblem).id).toBe("p1");
  });

  it("invalid problem JSON is rejected even from teachers", () => {
    const store = new ContentStore();
    expect(() => store.publish(teacher, "problem", { id: "bad" })).toThrow();
  });

  it("only author or admin can delete", () => {
    const store = new ContentStore();
    store.publish(teacher, "problem", validProblem);
    expect(() => store.remove(admin, "problem", "p1")).not.toThrow(); // republish below
    store.publish(teacher, "problem", validProblem);
    expect(() => store.remove({ ...teacher, id: "t2" }, "problem", "p1")).toThrow(AccessDeniedError);
    expect(store.remove(teacher, "problem", "p1")).toBe(true);
  });
});

describe("ContentStore consumption", () => {
  it("students see visible quizzes and all problems", () => {
    const store = new ContentStore({ problems: [], quizzes: [] });
    store.publish(teacher, "quiz", validQuiz);
    const q = store.visibleQuizzes(student);
    expect(q).toHaveLength(1);
  });

  it("hides quizzes not visible to the student's role", () => {
    const store = new ContentStore();
    store.publish(teacher, "quiz", { ...validQuiz, visibleTo: ["teacher"] });
    expect(store.visibleQuizzes(student)).toHaveLength(0);
    expect(store.visibleQuizzes(teacher)).toHaveLength(1);
  });

  it("students submit and get auto-graded results", () => {
    const store = new ContentStore();
    store.publish(teacher, "quiz", validQuiz);
    const sub = store.submit(student, "q1", { m1: "a" });
    expect(sub.result.earned).toBe(2);
    expect(sub.studentId).toBe("s1");
  });

  it("teacher role cannot submit answers (content:answer is student-only)", () => {
    const store = new ContentStore();
    store.publish(teacher, "quiz", validQuiz);
    expect(() => store.submit(teacher, "q1", { m1: "a" })).toThrow(AccessDeniedError);
  });

  it("submissions are private: student sees own, teacher sees all", () => {
    const store = new ContentStore();
    store.publish(teacher, "quiz", validQuiz);
    store.submit(student, "q1", { m1: "a" });
    expect(store.submissionsFor(student)).toHaveLength(1);
    expect(store.submissionsFor(student)[0].studentId).toBe("s1");
    expect(store.submissionsFor(teacher)).toHaveLength(1);
    const stranger: User = { id: "s2", name: "Eve", role: "student" };
    expect(store.submissionsFor(stranger)).toHaveLength(0);
  });

  it("submit fails for unknown quiz", () => {
    const store = new ContentStore();
    expect(() => store.submit(student, "ghost", {})).toThrow(/no such quiz/);
  });
});
