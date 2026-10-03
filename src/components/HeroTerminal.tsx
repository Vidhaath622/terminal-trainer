"use client";

/**
 * HeroTerminal: an interactive hero terminal backed by the real engine.
 *
 * Reuses LAUNCH_PROBLEMS[0], the Session auto-grader, and the same
 * TerminalView component as /play/[id] — there is no second shell, parser,
 * or grading path here. Pass/fail verdicts come from the session's own
 * auto-grader (step:completed events) and session.verify() (the same
 * gradeStep the Verify button uses).
 *
 * Progress is anonymous and local-only: the session persists through a
 * StorageLike wrapper that namespaces the engine's storage key under
 * "tt:hero:" in localStorage. Nothing is sent to the server, sync,
 * analytics, or account APIs, and no student id is attached.
 *
 * The terminal is never focused on mount or hydration; xterm focuses its
 * hidden input only when the visitor clicks the terminal.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import TerminalView from "./TerminalView";
import { Session, storageKey } from "@/engine/session";
import { maxMarks } from "@/engine/grader";
import { LAUNCH_PROBLEMS } from "@/problems/launch";

const HERO_PREFIX = "tt:hero:";

/** StorageLike over localStorage, namespaced for the hero. Invoked client-side only. */
function heroStorage() {
  return {
    getItem(key: string): string | null {
      try {
        return window.localStorage.getItem(HERO_PREFIX + key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        window.localStorage.setItem(HERO_PREFIX + key, value);
      } catch {
        // storage unavailable: progress stays in memory
      }
    },
    removeItem(key: string): void {
      try {
        window.localStorage.removeItem(HERO_PREFIX + key);
      } catch {
        // ignore
      }
    },
  };
}

export default function HeroTerminal() {
  const problem = LAUNCH_PROBLEMS[0];
  // Session construction is pure data (no window access), same as /play/[id].
  const [session, setSession] = useState(() => new Session(problem, { storage: heroStorage() }));
  const [sessionKey, setSessionKey] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const justCompletedRef = useRef(false);
  const commandRanRef = useRef<() => void>(() => {});

  // Restore anonymous local progress after hydration (client only).
  useEffect(() => {
    const store = heroStorage();
    const raw = store.getItem(storageKey(problem.id, null));
    if (!raw) return;
    try {
      setSession(Session.restore(problem, raw, { storage: store }));
      setSessionKey((k) => k + 1);
    } catch {
      // incompatible or corrupted blob: start fresh
    }
  }, [problem]);

  // Pass feedback comes from the session's own auto-grader events.
  useEffect(() => {
    const off = session.onChange((event) => {
      if (event.type === "step:completed" || event.type === "problem:completed") {
        justCompletedRef.current = true;
        if (event.type === "problem:completed") {
          setFeedback({ ok: true, text: `Problem complete — ${event.earned}/${event.max} marks.` });
        } else {
          const stepMarks = problem.steps.find((s) => s.id === event.stepId)?.marks ?? 0;
          setFeedback({
            ok: true,
            text: `Step complete — +${stepMarks} marks (${event.earned}/${event.max} total).`,
          });
        }
      }
    });
    return off;
  }, [session, problem]);

  // Fail feedback comes from the real grader over the current step, checked
  // after each command the terminal runs. The wrapper below only observes:
  // every call still goes through the one Session instance.
  useEffect(() => {
    commandRanRef.current = () => {
      if (justCompletedRef.current) {
        justCompletedRef.current = false;
        return;
      }
      const grade = session.verify();
      if (grade) {
        setFeedback({ ok: false, text: `Not yet — ${grade.earned}/${grade.max} marks on this step.` });
      }
    };
  }, [session]);

  // Delegate everything to the real session; only `run` is observed so the
  // hero can show the grader's verdict. No engine behavior is changed.
  const instrumented = useMemo(() => {
    const wrapper = Object.create(session) as Session;
    wrapper.run = (line: string) => {
      const result = session.run(line);
      commandRanRef.current();
      return result;
    };
    return wrapper;
  }, [session]);

  const done = session.isComplete;
  const stepIndex = session.currentStepIndex;

  const startOver = () => {
    session.reset(); // also clears the hero's localStorage entry
    setSessionKey((k) => k + 1);
    setFeedback(null);
  };

  return (
    <div>
      <p className="font-mono text-sm text-term-muted">
        {done ? (
          <span className="text-term-green">
            Problem complete — {session.earned}/{maxMarks(problem)} marks.
          </span>
        ) : stepIndex === 0 ? (
          <>
            Press <code className="rounded bg-term-panel px-1 font-mono text-term-green">Enter</code>{" "}
            to run <code className="rounded bg-term-panel px-1 font-mono text-term-green">pwd</code>
          </>
        ) : (
          <span>{session.currentStep.prompt}</span>
        )}
      </p>
      <div className="mt-2 h-64 sm:h-72">
        <TerminalView session={instrumented} sessionKey={sessionKey} initialCommand="pwd" />
      </div>
      <p
        aria-live="polite"
        className={`mt-2 min-h-[1rem] font-mono text-xs ${feedback ? (feedback.ok ? "text-term-green" : "text-term-red") : "invisible"}`}
      >
        {feedback ? feedback.text : "\u00A0"}
      </p>
      {done && (
        <button
          onClick={startOver}
          className="rounded border border-term-border px-2.5 py-1 font-mono text-xs text-term-muted hover:border-term-green/60"
        >
          Start over
        </button>
      )}
    </div>
  );
}
