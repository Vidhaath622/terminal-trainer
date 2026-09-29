import { describe, it, expect } from "vitest";
import { quizSchema, gradeQuiz, sanitizeQuizForStudent, type Quiz } from "./quiz";

const sample: Quiz = quizSchema.parse({
  id: "q1",
  title: "Terminal basics quiz",
  kind: "quiz",
  questions: [
    {
      kind: "mcq",
      id: "m1",
      prompt: "Which command lists directory contents?",
      options: [
        { id: "a", text: "ls" },
        { id: "b", text: "cd" },
        { id: "c", text: "rm" },
      ],
      correctOptionId: "a",
      marks: 2,
    },
    {
      kind: "short",
      id: "s1",
      prompt: "What command prints your working directory?",
      acceptedAnswers: ["pwd"],
      marks: 3,
    },
  ],
});

describe("gradeQuiz", () => {
  it("awards full marks for correct answers", () => {
    const r = gradeQuiz(sample, { m1: "a", s1: "pwd" });
    expect(r.earned).toBe(5);
    expect(r.max).toBe(5);
    expect(r.results.every((x) => x.correct)).toBe(true);
  });

  it("is case-insensitive for short answers", () => {
    const r = gradeQuiz(sample, { m1: "a", s1: "  PWD " });
    expect(r.earned).toBe(5);
  });

  it("gives zero for wrong answers", () => {
    const r = gradeQuiz(sample, { m1: "b", s1: "cwd" });
    expect(r.earned).toBe(0);
  });

  it("treats missing answers as wrong, not errors", () => {
    const r = gradeQuiz(sample, {});
    expect(r.earned).toBe(0);
    expect(r.results).toHaveLength(2);
  });
});

describe("sanitizeQuizForStudent", () => {
  it("strips correct answers but keeps structure and marks", () => {
    const clean = sanitizeQuizForStudent(sample);
    const mcq = clean.questions[0] as { correctOptionId?: string };
    expect(mcq.correctOptionId).toBeUndefined();
    const short = clean.questions[1] as { acceptedAnswers?: string[] };
    expect(short.acceptedAnswers).toBeUndefined();
    expect(clean.questions).toHaveLength(2);
    expect(clean.title).toBe(sample.title);
  });

  it("grading still works on the teacher's copy after sanitizing for students", () => {
    const clean = sanitizeQuizForStudent(sample);
    expect(JSON.stringify(clean)).not.toContain("correctOptionId");
    expect(JSON.stringify(clean)).not.toContain("pwd");
  });
});

describe("quizSchema", () => {
  it("defaults kind to quiz and visibleTo to students", () => {
    const q = quizSchema.parse({ id: "x", title: "X", questions: sample.questions });
    expect(q.kind).toBe("quiz");
    expect(q.visibleTo).toEqual(["student"]);
  });

  it("rejects an MCQ with fewer than 2 options", () => {
    expect(() =>
      quizSchema.parse({
        id: "x",
        title: "X",
        questions: [{ kind: "mcq", id: "m", prompt: "?", options: [{ id: "a", text: "only" }], correctOptionId: "a", marks: 1 }],
      })
    ).toThrow();
  });
});
