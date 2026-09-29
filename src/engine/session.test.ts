import { describe, it, expect } from "vitest";
import { Session, storageKey, type SessionEvent, type StorageLike } from "./session";
import { problemSchema, type Problem } from "./schema";

function makeProblem(): Problem {
  return problemSchema.parse({
    id: "sess-1",
    title: "Session test",
    difficulty: "easy",
    brief: "Make things.",
    fs: { dirs: [], files: [{ path: "/start.txt", content: "hi\n" }], home: "/", user: "student" },
    steps: [
      {
        id: "s1",
        prompt: "Create a file called done.txt",
        marks: 5,
        checks: [{ type: "fileExists", path: "/done.txt", marks: 5 }],
      },
      {
        id: "s2",
        prompt: "Delete start.txt",
        marks: 5,
        checks: [{ type: "fileAbsent", path: "/start.txt", marks: 5 }],
      },
    ],
  });
}

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  has(k: string): boolean {
    return this.map.has(k);
  }
}

describe("Session", () => {
  it("starts at step 0 with a fresh VFS from the problem spec", () => {
    const s = new Session(makeProblem());
    expect(s.currentStepIndex).toBe(0);
    expect(s.currentStep.id).toBe("s1");
    expect(s.vfs.readFile("/start.txt")).toBe("hi\n");
    expect(s.vfs.cwd).toBe("/");
  });

  it("auto-completes a step when its checks pass and awards marks", () => {
    const s = new Session(makeProblem());
    s.run("touch done.txt");
    expect(s.currentStepIndex).toBe(1);
    expect(s.earned).toBe(5);
    expect(s.completedSteps).toEqual(["s1"]);
  });

  it("does not advance while checks fail", () => {
    const s = new Session(makeProblem());
    s.run("echo hello");
    expect(s.currentStepIndex).toBe(0);
    expect(s.earned).toBe(0);
  });

  it("emits step:completed then problem:completed events", () => {
    const s = new Session(makeProblem());
    const events: SessionEvent[] = [];
    s.onChange((e) => events.push(e));
    s.run("touch done.txt");
    s.run("rm start.txt");
    expect(events.map((e) => e.type)).toEqual(["step:completed", "step:completed", "problem:completed"]);
    expect(events[0].earned).toBe(5);
    expect(events[2].earned).toBe(10);
    expect(events[2].problemComplete).toBe(true);
    expect(events[2].max).toBe(10);
  });

  it("verify() returns per-check detail without advancing", () => {
    const s = new Session(makeProblem());
    const g = s.verify();
    expect(g).not.toBeNull();
    expect(g!.passed).toBe(false);
    expect(g!.results).toHaveLength(1);
    expect(g!.results[0].passed).toBe(false);
    expect(s.currentStepIndex).toBe(0);
  });

  it("verify() returns null when the problem is complete", () => {
    const s = new Session(makeProblem());
    s.run("touch done.txt");
    s.run("rm start.txt");
    expect(s.verify()).toBeNull();
  });

  it("reset restores the initial filesystem and step", () => {
    const s = new Session(makeProblem());
    s.run("touch done.txt");
    s.reset();
    expect(s.currentStepIndex).toBe(0);
    expect(s.earned).toBe(0);
    expect(s.vfs.exists("/done.txt")).toBe(false);
    expect(s.vfs.exists("/start.txt")).toBe(true);
  });

  it("tracks command history across steps", () => {
    const s = new Session(makeProblem());
    s.run("touch done.txt");
    s.run("rm start.txt");
    expect(s.shell.history).toEqual(["touch done.txt", "rm start.txt"]);
  });

  it("persists progress after each command", () => {
    const storage = new MemoryStorage();
    const s = new Session(makeProblem(), { storage });
    s.run("touch done.txt");
    expect(storage.has(storageKey("sess-1", null))).toBe(true);
    const raw = storage.getItem(storageKey("sess-1", null))!;
    const parsed = JSON.parse(raw);
    expect(parsed.currentStepIndex).toBe(1);
    expect(parsed.earned).toBe(5);
  });

  it("restores progress from a saved blob", () => {
    const storage = new MemoryStorage();
    const s1 = new Session(makeProblem(), { storage });
    s1.run("touch done.txt");
    const raw = storage.getItem(storageKey("sess-1", null))!;
    const s2 = Session.restore(makeProblem(), raw);
    expect(s2.currentStepIndex).toBe(1);
    expect(s2.earned).toBe(5);
    expect(s2.shell.history).toEqual(["touch done.txt"]);
    // filesystem itself restarts fresh (VFS snapshot restore is future work)
    expect(s2.vfs.exists("/done.txt")).toBe(false);
  });

  it("rejects progress blobs for other problems", () => {
    const storage = new MemoryStorage();
    const s1 = new Session(makeProblem(), { storage });
    s1.run("touch done.txt");
    const raw = storage.getItem(storageKey("sess-1", null))!;
    const other = { ...makeProblem(), id: "other" };
    expect(() => Session.restore(other, raw)).toThrow();
  });

  it("namespaces storage by student id", () => {
    const storage = new MemoryStorage();
    const s = new Session(makeProblem(), { storage, studentId: "stu-42" });
    s.run("touch done.txt");
    expect(storage.has(storageKey("sess-1", "stu-42"))).toBe(true);
    expect(storage.has(storageKey("sess-1", null))).toBe(false);
  });
});
