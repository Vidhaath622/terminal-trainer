import { describe, expect, it } from "vitest";
import {
  parseProgress,
  mergeProgress,
  putProgressSchema,
  type ProgressData,
} from "./progress-schema";

function blob(overrides: Partial<ProgressData> = {}): ProgressData {
  return {
    version: 1,
    problemId: "pwd-navigate",
    currentStepIndex: 2,
    earned: 6,
    completedSteps: ["s1", "s2"],
    history: ["pwd", "ls"],
    startedAt: 1_000,
    updatedAt: 2_000,
    durationMs: 45_000,
    ...overrides,
  };
}

describe("parseProgress", () => {
  it("accepts a valid blob", () => {
    const parsed = parseProgress(blob(), "pwd-navigate");
    expect(parsed).not.toBeNull();
    expect(parsed!.earned).toBe(6);
  });

  it("rejects blobs for a different problem", () => {
    expect(parseProgress(blob(), "grep-search")).toBeNull();
  });

  it("rejects malformed blobs", () => {
    expect(parseProgress(null, "pwd-navigate")).toBeNull();
    expect(parseProgress({}, "pwd-navigate")).toBeNull();
    expect(parseProgress({ ...blob(), version: 2 }, "pwd-navigate")).toBeNull();
    expect(parseProgress({ ...blob(), earned: -1 }, "pwd-navigate")).toBeNull();
    expect(parseProgress({ ...blob(), currentStepIndex: 1.5 }, "pwd-navigate")).toBeNull();
  });
});

describe("mergeProgress", () => {
  it("returns whichever side exists", () => {
    const b = blob();
    expect(mergeProgress(b, null)).toEqual(b);
    expect(mergeProgress(null, b)).toEqual(b);
    expect(mergeProgress(null, null)).toBeNull();
  });

  it("prefers the fresher updatedAt", () => {
    const older = blob({ updatedAt: 1_000, earned: 3 });
    const newer = blob({ updatedAt: 2_000, earned: 9 });
    expect(mergeProgress(older, newer)).toEqual(newer);
    expect(mergeProgress(newer, older)).toEqual(newer);
  });

  it("breaks ties in favor of the cloud copy", () => {
    const local = blob({ updatedAt: 5_000, earned: 1 });
    const cloud = blob({ updatedAt: 5_000, earned: 3 });
    expect(mergeProgress(local, cloud)).toEqual(cloud);
  });
});

describe("putProgressSchema", () => {
  it("accepts a well-formed PUT body", () => {
    const ok = putProgressSchema.safeParse({ problemId: "pwd-navigate", data: blob() });
    expect(ok.success).toBe(true);
  });

  it("rejects mismatched or missing fields", () => {
    expect(
      putProgressSchema.safeParse({ problemId: "pwd-navigate", data: { nope: true } }).success
    ).toBe(false);
    expect(putProgressSchema.safeParse({ data: blob() }).success).toBe(false);
  });
});
