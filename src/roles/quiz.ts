/**
 * Quizzes and assignments: authored by teachers, answered by students.
 * Pure TypeScript data model + grading. No UI imports.
 */
import { z } from "zod";

export const mcqOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const questionDifficultySchema = z.enum(["easy", "medium", "hard"]);

export const mcqQuestionSchema = z.object({
  kind: z.literal("mcq"),
  id: z.string().min(1),
  prompt: z.string().min(1),
  /** easy | medium | hard, shown as a badge by QuizRunner */
  difficulty: questionDifficultySchema.optional(),
  options: z.array(mcqOptionSchema).min(2),
  correctOptionId: z.string().min(1),
  marks: z.number().positive(),
});

export const shortAnswerQuestionSchema = z.object({
  kind: z.literal("short"),
  id: z.string().min(1),
  prompt: z.string().min(1),
  difficulty: questionDifficultySchema.optional(),
  /** accepted answers, case-insensitive, trimmed */
  acceptedAnswers: z.array(z.string().min(1)).min(1),
  marks: z.number().positive(),
});

export const questionSchema = z.discriminatedUnion("kind", [mcqQuestionSchema, shortAnswerQuestionSchema]);
export type Question = z.infer<typeof questionSchema>;

export const quizSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** quiz vs assignment - same mechanics, different classroom meaning */
  kind: z.enum(["quiz", "assignment"]).default("quiz"),
  instructions: z.string().default(""),
  questions: z.array(questionSchema).min(1),
  createdBy: z.string().default(""),
  visibleTo: z.array(z.enum(["student", "teacher", "admin"])).default(["student"]),
});

export type Quiz = z.infer<typeof quizSchema>;

export type StudentAnswer = Record</** questionId */ string, /** optionId or text */ string>;

export interface QuestionResult {
  questionId: string;
  correct: boolean;
  marks: number;
}

export interface QuizResult {
  quizId: string;
  earned: number;
  max: number;
  results: QuestionResult[];
}

export function gradeQuiz(quiz: Quiz, answers: StudentAnswer): QuizResult {
  const results: QuestionResult[] = quiz.questions.map((q) => {
    const given = (answers[q.id] ?? "").trim();
    if (q.kind === "mcq") {
      const correct = given === q.correctOptionId;
      return { questionId: q.id, correct, marks: correct ? q.marks : 0 };
    }
    const correct = q.acceptedAnswers.some((a) => a.trim().toLowerCase() === given.toLowerCase());
    return { questionId: q.id, correct, marks: correct ? q.marks : 0 };
  });
  return {
    quizId: quiz.id,
    earned: results.reduce((s, r) => s + r.marks, 0),
    max: quiz.questions.reduce((s, q) => s + q.marks, 0),
    results,
  };
}

/** Teacher-facing: strip answers before sending a quiz to students. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type SanitizedQuestion =
  | DistributiveOmit<Extract<Question, { kind: "mcq" }>, "correctOptionId">
  | DistributiveOmit<Extract<Question, { kind: "short" }>, "acceptedAnswers">;

export function sanitizeQuizForStudent(quiz: Quiz): Omit<Quiz, "questions"> & {
  questions: SanitizedQuestion[];
} {
  const questions = quiz.questions.map((q) => {
    if (q.kind === "mcq") {
      const { correctOptionId: _drop, ...rest } = q;
      return rest;
    }
    const { acceptedAnswers: _drop, ...rest } = q;
    return rest;
  });
  const { questions: _q, ...rest } = quiz;
  return { ...rest, questions };
}
