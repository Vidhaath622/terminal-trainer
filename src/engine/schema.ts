/**
 * Zod schemas for problems, steps, checks, and grading. Pure TypeScript.
 */
import { z } from "zod";

export const fsFileSpecSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const fsSpecSchema = z.object({
  dirs: z.array(z.string()).default([]),
  files: z.array(fsFileSpecSchema).default([]),
  rootOwner: z.string().default("root"),
  home: z.string().default("/"),
  user: z.string().default("student"),
});

export const fileExistsCheck = z.object({
  type: z.literal("fileExists"),
  path: z.string(),
  marks: z.number().nonnegative(),
});

export const dirExistsCheck = z.object({
  type: z.literal("dirExists"),
  path: z.string(),
  marks: z.number().nonnegative(),
});

export const fileContainsCheck = z.object({
  type: z.literal("fileContains"),
  path: z.string(),
  /** exact substring */
  value: z.string(),
  marks: z.number().nonnegative(),
});

export const fileEqualsCheck = z.object({
  type: z.literal("fileEquals"),
  path: z.string(),
  value: z.string(),
  marks: z.number().nonnegative(),
});

export const fileMatchesCheck = z.object({
  type: z.literal("fileMatches"),
  path: z.string(),
  pattern: z.string(),
  flags: z.string().default(""),
  marks: z.number().nonnegative(),
});

export const fileAbsentCheck = z.object({
  type: z.literal("fileAbsent"),
  path: z.string(),
  marks: z.number().nonnegative(),
});

export const dirEmptyCheck = z.object({
  type: z.literal("dirEmpty"),
  path: z.string(),
  marks: z.number().nonnegative(),
});

export const modeCheck = z.object({
  type: z.literal("mode"),
  path: z.string(),
  mode: z.string(),
  marks: z.number().nonnegative(),
});

export const outputEqualsCheck = z.object({
  type: z.literal("outputEquals"),
  value: z.string(),
  marks: z.number().nonnegative(),
});

export const outputContainsCheck = z.object({
  type: z.literal("outputContains"),
  value: z.string(),
  marks: z.number().nonnegative(),
});

export const outputMatchesCheck = z.object({
  type: z.literal("outputMatches"),
  pattern: z.string(),
  flags: z.string().default(""),
  marks: z.number().nonnegative(),
});

export const commandUsedCheck = z.object({
  type: z.literal("commandUsed"),
  /** any of these commands must appear in the current step's commands */
  commands: z.array(z.string().min(1)).min(1),
  marks: z.number().nonnegative(),
});

export const commandUsedWithFlagCheck = z.object({
  type: z.literal("commandUsedWithFlag"),
  command: z.string(),
  flag: z.string(),
  marks: z.number().nonnegative(),
});

export const checkSchema = z.discriminatedUnion("type", [
  fileExistsCheck,
  dirExistsCheck,
  fileContainsCheck,
  fileEqualsCheck,
  fileMatchesCheck,
  fileAbsentCheck,
  dirEmptyCheck,
  modeCheck,
  outputEqualsCheck,
  outputContainsCheck,
  outputMatchesCheck,
  commandUsedCheck,
  commandUsedWithFlagCheck,
]);

export type Check = z.infer<typeof checkSchema>;

export const stepSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  hints: z.array(z.string()).default([]),
  marks: z.number().nonnegative(),
  checks: z.array(checkSchema).min(1),
});

export type Step = z.infer<typeof stepSchema>;

export const problemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  tags: z.array(z.string()).default([]),
  brief: z.string().min(1),
  fs: fsSpecSchema.default({ dirs: [], files: [], rootOwner: "root", home: "/", user: "student" }),
  steps: z.array(stepSchema).min(1),
});

export type Problem = z.infer<typeof problemSchema>;

export const problemSetSchema = z.object({
  problems: z.array(problemSchema).min(1),
});

export type ProblemSet = z.infer<typeof problemSetSchema>;
