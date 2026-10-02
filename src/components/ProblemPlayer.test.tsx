/**
 * ProblemPlayer chrome tests: the score-bar back button, practice mode, and
 * the completion "next problem" CTA. Back link shows on the standalone
 * /play/[id] route; hidden in compact (embed) mode so the host page's own
 * navigation isn't duplicated.
 *
 * Practice mode: after completion, "Practice again" runs a fresh round on
 * the same page with cloud sync, local persistence, and embed events off.
 */
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ProblemPlayer from "./ProblemPlayer";
import { getLaunchProblem, LAUNCH_PROBLEMS } from "@/problems/launch";
import { maxMarks } from "@/engine/grader";
import type { Problem } from "@/engine/schema";
import { Session, type SessionProgress, type StorageLike } from "@/engine/session";

// xterm.js needs a real canvas; stub the terminal so jsdom only exercises the chrome.
// The stub publishes the session prop so tests can run commands through the engine.
vi.mock("./TerminalView", () => ({
  default: ({ session }: { session: unknown }) => {
    (globalThis as Record<string, unknown>).__lastSession = session;
    return <div data-testid="terminal-stub" />;
  },
}));

// SyncChip probes /api/me on mount; answer synchronously so React tests stay quiet.
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ user: null }), { status: 200 })))
  );
});

const problem = getLaunchProblem("pwd-navigate")!;
const TOTAL = 12; // 4 steps x 3 marks

/** Minimal storage spy: records writes, serves nothing unless seeded. */
function makeStorage(initial: Record<string, string> = {}): StorageLike & {
  writes: Record<string, string>;
  removed: string[];
} {
  const store: Record<string, string> = { ...initial };
  const writes: Record<string, string> = {};
  const removed: string[] = [];
  return {
    writes,
    removed,
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      writes[key] = value;
      store[key] = value;
    },
    removeItem: (key) => {
      removed.push(key);
      delete store[key];
    },
  };
}

/**
 * Solve pwd-navigate with the real engine and return its progress blob.
 * Throws if the run didn't complete every step, so assertions downstream
 * never test a half-solved blob.
 */
function completedProgress(): SessionProgress {
  const session = new Session(problem);
  for (const line of ["pwd", "ls", "cd documents", "cd ~"]) {
    session.run(line);
  }
  if (!session.isComplete || session.earned !== TOTAL) {
    throw new Error(`fixture incomplete: earned ${session.earned}, complete=${session.isComplete}`);
  }
  return session.progress();
}

/** Run a command through the session the stubbed TerminalView received. */
function typeIntoTerminal(line: string): void {
  const session = (globalThis as Record<string, unknown>).__lastSession as Session;
  if (!session) throw new Error("TerminalView has not rendered a session yet");
  act(() => {
    session.run(line);
  });
}

function lastSession(): Session {
  return (globalThis as Record<string, unknown>).__lastSession as Session;
}

/**
 * A completed progress blob for any problem without solving it — enough for
 * chrome tests that only care about the finished state (restore is permissive:
 * version + problemId must match, then fields are copied as-is).
 */
function completedProgressFor(p: Problem): SessionProgress {
  return {
    version: 1,
    problemId: p.id,
    currentStepIndex: p.steps.length,
    earned: maxMarks(p),
    completedSteps: p.steps.map((s) => s.id),
    history: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    durationMs: 0,
  };
}

beforeEach(() => {
  delete (globalThis as Record<string, unknown>).__lastSession;
});

describe("ProblemPlayer score bar", () => {
  it("shows a back link to the home page in standalone mode", () => {
    render(<ProblemPlayer problem={problem} />);
    const back = screen.getByTestId("back-btn");
    expect(back.tagName).toBe("A");
    expect(back.getAttribute("href")).toBe("/");
  });

  it("hides the back link in compact (embed) mode", () => {
    render(<ProblemPlayer problem={problem} compact />);
    expect(screen.queryByTestId("back-btn")).toBeNull();
  });

  it("keeps title, marks, and reset in compact mode", () => {
    render(<ProblemPlayer problem={problem} compact />);
    expect(screen.getByText(problem.title)).toBeTruthy();
    expect(screen.getByTestId("marks")).toBeTruthy();
    expect(screen.getByTestId("reset-btn")).toBeTruthy();
  });
});

describe("ProblemPlayer practice mode", () => {
  it("offers Practice again only after completion", () => {
    const storage = makeStorage();
    const { unmount } = render(<ProblemPlayer problem={problem} storage={storage} />);
    expect(screen.queryByTestId("practice-btn")).toBeNull();
    expect(screen.queryByTestId("complete-banner")).toBeNull();
    unmount();

    render(
      <ProblemPlayer problem={problem} storage={storage} initialProgress={completedProgress()} />
    );
    expect(screen.getByTestId("complete-banner")).toBeTruthy();
    expect(screen.getByTestId("practice-btn")).toBeTruthy();
  });

  it("entering practice starts a fresh round on the same page", () => {
    const storage = makeStorage();
    render(
      <ProblemPlayer problem={problem} storage={storage} initialProgress={completedProgress()} />
    );
    fireEvent.click(screen.getByTestId("practice-btn"));

    // Fresh round: no marks, step 1 active, verify enabled, practice chrome visible.
    expect(screen.getByTestId("marks").textContent).toContain("0 /");
    expect(screen.getByTestId("practice-pill")).toBeTruthy();
    expect(screen.queryByTestId("complete-banner")).toBeNull();
    expect(screen.getByTestId("practice-banner")).toBeTruthy();
    expect(screen.getByTestId("exit-practice-btn")).toBeTruthy();
    const verify = screen.getByTestId("verify-btn") as HTMLButtonElement;
    expect(verify.disabled).toBe(false);
    expect(verify.textContent).toContain("Verify step 1");

    // The live session is a new one (step 0), not the completed restore.
    expect(lastSession().currentStepIndex).toBe(0);
    expect(lastSession().earned).toBe(0);

    // Progress bar drained to 0.
    expect((screen.getByTestId("progress-fill") as HTMLElement).style.width).toBe("0%");
  });

  it("practice runs push nothing to the cloud, storage, or embed bridge", () => {
    const storage = makeStorage();
    const onEvent = vi.fn();
    const onProgressChange = vi.fn();
    render(
      <ProblemPlayer
        problem={problem}
        storage={storage}
        initialProgress={completedProgress()}
        onEvent={onEvent}
        onProgressChange={onProgressChange}
      />
    );

    const savedBefore = { ...storage.writes };
    fireEvent.click(screen.getByTestId("practice-btn"));

    // Solve step 1 and 2 inside practice.
    typeIntoTerminal("pwd");
    typeIntoTerminal("ls");

    expect(onEvent).not.toHaveBeenCalled();
    expect(onProgressChange).not.toHaveBeenCalled();
    // No new writes, and the previously saved blob was never deleted.
    expect(storage.writes).toEqual(savedBefore);
    expect(storage.removed).toEqual([]);
    // Practice session made real progress (steps completed silently).
    expect(lastSession().earned).toBe(6);
  });

  it("completing a practice round shows the celebration again — still no pushes", () => {
    const storage = makeStorage();
    const onEvent = vi.fn();
    const onProgressChange = vi.fn();
    render(
      <ProblemPlayer
        problem={problem}
        storage={storage}
        initialProgress={completedProgress()}
        onEvent={onEvent}
        onProgressChange={onProgressChange}
      />
    );
    fireEvent.click(screen.getByTestId("practice-btn"));
    for (const line of ["pwd", "ls", "cd documents", "cd ~"]) {
      typeIntoTerminal(line);
    }

    // The dopamine hit: full marks and the completion banner, practice-labelled.
    expect(lastSession().earned).toBe(TOTAL);
    expect(lastSession().isComplete).toBe(true);
    expect(screen.getByTestId("complete-banner")).toBeTruthy();
    expect(screen.getByTestId("practice-pill")).toBeTruthy();
    expect(screen.getByTestId("marks").textContent).toContain(`${TOTAL} /`);
    // Replay can loop: Practice again is offered once more.
    expect(screen.getByTestId("practice-btn")).toBeTruthy();

    expect(onEvent).not.toHaveBeenCalled();
    expect(onProgressChange).not.toHaveBeenCalled();
    expect(storage.removed).toEqual([]);
  });

  it("exiting practice restores the completed round", () => {
    const storage = makeStorage();
    render(
      <ProblemPlayer problem={problem} storage={storage} initialProgress={completedProgress()} />
    );
    fireEvent.click(screen.getByTestId("practice-btn"));
    typeIntoTerminal("pwd"); // partial practice progress: 3 marks
    expect(lastSession().earned).toBe(3);

    fireEvent.click(screen.getByTestId("exit-practice-btn"));
    expect(screen.queryByTestId("practice-banner")).toBeNull();
    expect(screen.queryByTestId("practice-pill")).toBeNull();
    expect(screen.getByTestId("complete-banner")).toBeTruthy();
    expect(screen.getByTestId("marks").textContent).toContain(`${TOTAL} /`);
    expect(screen.getByTestId("practice-btn")).toBeTruthy();
    expect(lastSession().earned).toBe(TOTAL);
    expect(lastSession().currentStepIndex).toBe(problem.steps.length);

    // Enter/exit again: the loop keeps working.
    fireEvent.click(screen.getByTestId("practice-btn"));
    expect(lastSession().earned).toBe(0);
    fireEvent.click(screen.getByTestId("exit-practice-btn"));
    expect(lastSession().earned).toBe(TOTAL);
  });
});

describe("ProblemPlayer next problem button", () => {
  it("stays hidden until the problem is finished", () => {
    render(<ProblemPlayer problem={problem} />);
    expect(screen.queryByTestId("next-problem-btn")).toBeNull();
  });

  it("links to the next problem in the /problems order once complete", () => {
    render(<ProblemPlayer problem={problem} initialProgress={completedProgress()} />);
    const btn = screen.getByTestId("next-problem-btn");
    expect(btn.tagName).toBe("A");
    const next = LAUNCH_PROBLEMS[LAUNCH_PROBLEMS.indexOf(problem) + 1];
    expect(next).toBeDefined();
    expect(btn.getAttribute("href")).toBe(`/play/${next.id}`);
    expect(btn.textContent).toMatch(/Next problem/);
    expect(btn.getAttribute("title")).toBe(`Next: ${next.title}`);
  });

  it("becomes a link back to the library on the last problem of the set", () => {
    const last = LAUNCH_PROBLEMS[LAUNCH_PROBLEMS.length - 1];
    const { unmount } = render(
      <ProblemPlayer problem={last} initialProgress={completedProgressFor(last)} />
    );
    const btn = screen.getByTestId("next-problem-btn");
    expect(btn.getAttribute("href")).toBe("/problems");
    expect(btn.textContent).toMatch(/Back to problems/);
    unmount();

    // The problem before the last still points forward.
    const penultimate = LAUNCH_PROBLEMS[LAUNCH_PROBLEMS.length - 2];
    render(<ProblemPlayer problem={penultimate} initialProgress={completedProgressFor(penultimate)} />);
    expect(screen.getByTestId("next-problem-btn").getAttribute("href")).toBe(`/play/${last.id}`);
  });

  it("stays hidden in compact (embed) mode even when complete", () => {
    render(<ProblemPlayer problem={problem} compact initialProgress={completedProgress()} />);
    expect(screen.queryByTestId("next-problem-btn")).toBeNull();
  });

  it("follows practice rounds: hidden when the replay starts, back when it finishes", () => {
    render(<ProblemPlayer problem={problem} initialProgress={completedProgress()} />);
    expect(screen.getByTestId("next-problem-btn")).toBeTruthy();

    fireEvent.click(screen.getByTestId("practice-btn")); // fresh round: not complete
    expect(screen.queryByTestId("next-problem-btn")).toBeNull();

    for (const line of ["pwd", "ls", "cd documents", "cd ~"]) typeIntoTerminal(line);
    expect(screen.getByTestId("next-problem-btn")).toBeTruthy();
  });
});
