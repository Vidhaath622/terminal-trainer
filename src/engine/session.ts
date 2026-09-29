/**
 * Problem session: drives the Shell, tracks per-step command usage,
 * auto-grades after every command, and persists progress.
 * Pure TypeScript - no UI imports (storage is injected).
 */
import { Vfs, type Snapshot } from "./vfs";
import { Shell, type RunResult } from "./commands";
import { gradeStep, maxMarks, type GradeResult } from "./grader";
import type { Problem } from "./schema";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const storageKey = (problemId: string, studentId: string | null) =>
  `tt:progress:${problemId}:${studentId ?? "anon"}`;

export type SessionEventType = "command" | "step:completed" | "problem:completed";

export interface SessionEvent {
  type: SessionEventType;
  problemId: string;
  /** step id, when applicable */
  stepId?: string;
  /** total earned marks after this event */
  earned: number;
  max: number;
  /** true when the last step of the problem just completed */
  problemComplete: boolean;
  durationMs: number;
  at: number;
}

export interface SessionListener {
  (event: SessionEvent): void;
}

export interface SessionProgress {
  version: 1;
  problemId: string;
  currentStepIndex: number;
  earned: number;
  /** ids of completed steps, in order */
  completedSteps: string[];
  /** full history across the problem */
  history: string[];
  startedAt: number;
  updatedAt: number;
  durationMs: number;
}

export class Session {
  readonly problem: Problem;
  vfs: Vfs;
  shell: Shell;
  currentStepIndex = 0;
  earned = 0;
  completedSteps: string[] = [];
  private stepCommands: string[] = [];
  private listeners: SessionListener[] = [];
  private startedAt: number;
  private durationMs: number;
  private storage: StorageLike | null;
  private studentId: string | null;
  private problemCompletedFired = false;

  constructor(
    problem: Problem,
    opts: { storage?: StorageLike; studentId?: string | null; now?: () => number } = {}
  ) {
    this.problem = problem;
    this.vfs = new Vfs({
      dirs: problem.fs.dirs,
      files: problem.fs.files,
      rootOwner: problem.fs.rootOwner,
    });
    this.vfs.cwd = problem.fs.home;
    this.shell = new Shell(this.vfs, { user: problem.fs.user, env: { HOME: problem.fs.home } });
    this.storage = opts.storage ?? null;
    this.studentId = opts.studentId ?? null;
    const now = opts.now ?? (() => Date.now());
    this.startedAt = now();
    this.durationMs = 0;
  }

  onChange(listener: SessionListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(type: SessionEventType, at: number): void {
    const event: SessionEvent = {
      type,
      problemId: this.problem.id,
      stepId: this.completedSteps[this.completedSteps.length - 1],
      earned: this.earned,
      max: maxMarks(this.problem),
      problemComplete: this.isComplete,
      durationMs: this.durationMs,
      at,
    };
    for (const l of this.listeners) l(event);
  }

  /** Run a command line; auto-grades the current step afterwards. */
  run(line: string, at = Date.now()): RunResult {
    const result = this.shell.run(line);
    this.lastOutput = result.stdout;
    this.stepCommands.push(line.trim());
    this.durationMs += at - (this.lastCommandAt ?? this.startedAt);
    this.lastCommandAt = at;
    this.autoGrade(at);
    this.persist();
    return result;
  }

  private lastCommandAt: number | null = null;

  /** Current step (never null until the problem is complete). */
  get currentStep() {
    return this.problem.steps[this.currentStepIndex];
  }

  get isComplete(): boolean {
    return this.currentStepIndex >= this.problem.steps.length;
  }

  /** Run all checks for the current step (Verify button). */
  verify(): GradeResult | null {
    if (this.isComplete) return null;
    return gradeStep({
      vfs: this.vfs,
      stepCommands: this.stepCommands,
      lastOutput: this.lastOutput,
      problem: this.problem,
      step: this.currentStep,
    });
  }

  private lastOutput = "";

  /** Force-complete the current step when its checks all pass. */
  private autoGrade(at: number): void {
    if (this.isComplete) return;
    const grade = gradeStep({
      vfs: this.vfs,
      stepCommands: this.stepCommands,
      lastOutput: this.lastOutput,
      problem: this.problem,
      step: this.currentStep,
    });
    if (grade.passed) {
      this.earned += grade.earned;
      this.completedSteps.push(this.currentStep.id);
      this.currentStepIndex += 1;
      this.stepCommands = [];
      this.emit("step:completed", at);
      if (this.isComplete && !this.problemCompletedFired) {
        this.problemCompletedFired = true;
        this.emit("problem:completed", at);
      }
    }
  }

  /** Explicitly set the "last output" used by output* checks (rarely needed; run() captures stdout). */
  noteOutput(stdout: string): void {
    this.lastOutput = stdout;
  }

  /** Reset the problem from scratch (fresh VFS, step 0, keeps history). */
  reset(at = Date.now()): void {
    this.vfs = new Vfs({
      dirs: this.problem.fs.dirs,
      files: this.problem.fs.files,
      rootOwner: this.problem.fs.rootOwner,
    });
    this.vfs.cwd = this.problem.fs.home;
    this.shell = new Shell(this.vfs, { user: this.problem.fs.user, env: { HOME: this.problem.fs.home } });
    this.currentStepIndex = 0;
    this.earned = 0;
    this.completedSteps = [];
    this.stepCommands = [];
    this.lastOutput = "";
    this.problemCompletedFired = false;
    this.clearPersisted();
  }

  // ---------- persistence ----------

  progress(): SessionProgress {
    return {
      version: 1,
      problemId: this.problem.id,
      currentStepIndex: this.currentStepIndex,
      earned: this.earned,
      completedSteps: [...this.completedSteps],
      history: [...this.shell.history],
      startedAt: this.startedAt,
      updatedAt: Date.now(),
      durationMs: this.durationMs,
    };
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(storageKey(this.problem.id, this.studentId), JSON.stringify(this.progress()));
    } catch {
      // storage full or unavailable: progress stays in memory
    }
  }

  private clearPersisted(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(storageKey(this.problem.id, this.studentId));
    } catch {
      // ignore
    }
  }

  /** Restore a saved progress blob (returns true when restored). */
  static restore(problem: Problem, raw: string, opts: { storage?: StorageLike; studentId?: string | null } = {}): Session {
    const data = JSON.parse(raw) as SessionProgress;
    if (data.version !== 1 || data.problemId !== problem.id) {
      throw new Error("incompatible progress data");
    }
    const session = new Session(problem, opts);
    const snap: Snapshot | null = null;
    void snap;
    session.currentStepIndex = Math.min(data.currentStepIndex, problem.steps.length);
    session.earned = data.earned;
    session.completedSteps = data.completedSteps ?? [];
    session.shell.history = data.history ?? [];
    session.durationMs = data.durationMs ?? 0;
    if (session.isComplete) session.problemCompletedFired = true;
    return session;
  }
}
