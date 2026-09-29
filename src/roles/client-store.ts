/**
 * Client-side content catalog with role enforcement.
 * The browser-side twin of the teacher/student split: everything a student
 * sees was published by a teacher; every mutation checks capabilities.
 * Swap for server-backed storage without changing callers.
 */
import { AccessDeniedError, can, requireCapability, type Capability, type User } from "./types";
import { problemSchema, type Problem } from "@/engine/schema";
import { quizSchema, type Quiz, type StudentAnswer, gradeQuiz, type QuizResult } from "./quiz";

export interface Submission {
  id: string;
  contentId: string;
  studentId: string;
  answers: StudentAnswer;
  result: QuizResult;
  submittedAt: number;
}

export interface ContentCatalog {
  problems: Problem[];
  quizzes: Quiz[];
}

type AuthoredProblem = Problem & { createdBy: string };

export class ContentStore {
  private problems = new Map<string, AuthoredProblem>();
  private quizzes = new Map<string, Quiz>();
  private submissions: Submission[] = [];

  constructor(seed?: ContentCatalog) {
    for (const p of seed?.problems ?? []) this.problems.set(p.id, { ...p, createdBy: "seed" });
    for (const q of seed?.quizzes ?? []) this.quizzes.set(q.id, q);
  }

  /** Teachers (problem:create / quiz:create) publish; validation is mandatory. */
  publish(user: User, kind: "problem" | "quiz", data: unknown): Problem | Quiz {
    const capability: Capability = kind === "problem" ? "problem:create" : "quiz:create";
    requireCapability(user, capability);
    if (kind === "problem") {
      const problem = problemSchema.parse(data);
      const stamped: AuthoredProblem = { ...problem, createdBy: user.id };
      this.problems.set(stamped.id, stamped);
      return stamped;
    }
    const quiz = quizSchema.parse(data);
    const stamped = { ...quiz, createdBy: user.id };
    this.quizzes.set(stamped.id, stamped);
    return stamped;
  }

  /** Only the author or an admin may remove content. */
  remove(user: User, kind: "problem" | "quiz", id: string): boolean {
    requireCapability(user, "problem:delete");
    if (kind === "problem") {
      const existing = this.problems.get(id);
      if (!existing) return false;
      if (existing.createdBy !== user.id && !can(user, "user:manage")) {
        throw new AccessDeniedError("only the author or an admin can delete this content");
      }
      this.problems.delete(id);
      return true;
    }
    const existing = this.quizzes.get(id);
    if (!existing) return false;
    if (existing.createdBy !== user.id && !can(user, "user:manage")) {
      throw new AccessDeniedError("only the author or an admin can delete this content");
    }
    this.quizzes.delete(id);
    return true;
  }

  /** Students (and everyone) see published problems. */
  visibleProblems(user: User): Problem[] {
    void user;
    return [...this.problems.values()];
  }

  visibleQuizzes(user: User): Quiz[] {
    return [...this.quizzes.values()].filter((q) => q.visibleTo.includes(user.role));
  }

  getProblem(id: string): Problem | undefined {
    return this.problems.get(id);
  }

  getQuiz(id: string): Quiz | undefined {
    return this.quizzes.get(id);
  }

  /** Only students (content:answer) submit; auto-graded immediately. */
  submit(user: User, quizId: string, answers: StudentAnswer, at = Date.now()): Submission {
    requireCapability(user, "content:answer");
    const quiz = this.quizzes.get(quizId);
    if (!quiz) throw new Error(`no such quiz: ${quizId}`);
    const result = gradeQuiz(quiz, answers);
    const submission: Submission = {
      id: `sub-${this.submissions.length + 1}`,
      contentId: quizId,
      studentId: user.id,
      answers,
      result,
      submittedAt: at,
    };
    this.submissions.push(submission);
    return submission;
  }

  /** Students see only their own submissions; teachers/admins see all. */
  submissionsFor(viewer: User, studentId?: string): Submission[] {
    if (can(viewer, "progress:viewAll")) {
      return this.submissions.filter((s) => (studentId ? s.studentId === studentId : true));
    }
    requireCapability(viewer, "progress:viewOwn");
    return this.submissions.filter((s) => s.studentId === viewer.id);
  }
}
