/**
 * Progress blob schema + merge rules, shared by the browser and the API.
 * Mirrors the shape Session.persist() writes (src/engine/session.ts).
 */
import { z } from "zod";

export const progressDataSchema = z.object({
  version: z.literal(1),
  problemId: z.string().min(1),
  currentStepIndex: z.number().int().nonnegative(),
  earned: z.number().nonnegative(),
  completedSteps: z.array(z.string()),
  history: z.array(z.string()),
  startedAt: z.number(),
  updatedAt: z.number(),
  durationMs: z.number().nonnegative(),
});

export type ProgressData = z.infer<typeof progressDataSchema>;

export const putProgressSchema = z.object({
  problemId: z.string().min(1),
  data: progressDataSchema,
});

/** Parse one stored progress blob; null when invalid or foreign. */
export function parseProgress(raw: unknown, problemId: string): ProgressData | null {
  const parsed = progressDataSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (parsed.data.problemId !== problemId) return null;
  return parsed.data;
}

/**
 * Pick the freshest of two progress blobs for the same problem (cloud vs
 * local). Ties go to the cloud copy so a device that just pushed wins.
 */
export function mergeProgress(
  local: ProgressData | null,
  cloud: ProgressData | null
): ProgressData | null {
  if (!local) return cloud;
  if (!cloud) return local;
  return cloud.updatedAt >= local.updatedAt ? cloud : local;
}
