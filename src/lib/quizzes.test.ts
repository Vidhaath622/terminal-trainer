/**
 * Content checks for the branching & merging quiz: shape and difficulty
 * spread, answer integrity (every key points at a real option or an accepted
 * answer), and a full-mark run through the real grader using the answer key —
 * so the quiz can't ship with an unresolvable or ambiguous answer.
 */
import { describe, it, expect } from "vitest";
import { gradeQuiz, type StudentAnswer } from "@/roles/quiz";
import { GIT_BRANCHING_QUIZ } from "./quizzes";

const questions = GIT_BRANCHING_QUIZ.questions;
const count = (d: string) => questions.filter((q) => q.difficulty === d).length;

/** Answer key: what a student who knows the cheat sheet would submit. */
const KEY: StudentAnswer = Object.fromEntries(
  questions.map((q) => [q.id, q.kind === "mcq" ? q.correctOptionId : q.acceptedAnswers[0]]),
);

describe("git branching & merging quiz", () => {
  it("is ten questions: 4 easy, 3 medium, 3 hard, ordered easiest first", () => {
    expect(questions).toHaveLength(10);
    expect(count("easy")).toBe(4);
    expect(count("medium")).toBe(3);
    expect(count("hard")).toBe(3);
    expect(questions.every((q) => q.difficulty !== undefined)).toBe(true);

    const rank = { easy: 0, medium: 1, hard: 2 } as const;
    const levels = questions.map((q) => rank[q.difficulty as keyof typeof rank]);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("has unique ids and answers that resolve", () => {
    const ids = questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const q of questions) {
      if (q.kind === "mcq") {
        expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
        expect(q.options.map((o) => o.id), q.id).toContain(q.correctOptionId);
        expect(new Set(q.options.map((o) => o.text)).size, q.id).toBe(q.options.length);
      } else {
        expect(q.acceptedAnswers.length, q.id).toBeGreaterThan(0);
      }
    }
  });

  it("covers the cheat sheet's moves: switch -c, merge direction, --no-ff, conflicts, -d/-D", () => {
    const text = questions.map((q) => q.prompt + " " + (q.kind === "mcq" ? q.options.map((o) => o.text).join(" ") : q.acceptedAnswers.join(" "))).join(" ");
    for (const needle of ["git switch -c", "git merge", "--no-ff", "--continue", "branch -d", "branch -D", "branch -a"]) {
      expect(text, needle).toContain(needle);
    }
  });

  it("scores 20/20 against the answer key", () => {
    const result = gradeQuiz(GIT_BRANCHING_QUIZ, KEY);
    expect(result.max).toBe(20);
    expect(result.earned).toBe(20);
    expect(result.results.every((r) => r.correct)).toBe(true);
  });

  it("scores 0 when nothing is answered", () => {
    expect(gradeQuiz(GIT_BRANCHING_QUIZ, {}).earned).toBe(0);
  });
});
