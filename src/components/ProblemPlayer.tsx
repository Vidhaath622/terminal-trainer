"use client";

/**
 * ProblemPlayer: the full practice experience around the terminal.
 * Left: step list with marks. Right: terminal. Top: score bar.
 * Session auto-grades after every command; Verify shows per-check detail.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TerminalView from "./TerminalView";
import { Session, type SessionEvent, type StorageLike } from "@/engine/session";
import { maxMarks, type GradeResult } from "@/engine/grader";
import type { Problem } from "@/engine/schema";

export interface ProblemPlayerProps {
  problem: Problem;
  studentId?: string | null;
  /** called on step/problem completion (the embed bridge subscribes here) */
  onEvent?: (event: SessionEvent) => void;
  storage?: StorageLike;
  /** true inside iframes: hide chrome that would duplicate the host page */
  compact?: boolean;
}

function marksColor(earned: number, max: number): string {
  const pct = max === 0 ? 0 : Math.round((earned / max) * 100);
  if (pct === 100) return "text-term-green";
  if (pct >= 50) return "text-term-yellow";
  return "text-term-text";
}

export default function ProblemPlayer({ problem, studentId = null, onEvent, storage, compact = false }: ProblemPlayerProps) {
  const session = useMemo(
    () => new Session(problem, { storage, studentId }),
    [problem, storage, studentId]
  );
  const [, bump] = useState(0);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;

  // Emit session events (step:completed / problem:completed) to the parent.
  useEffect(() => {
    const off = session.onChange((event) => {
      eventRef.current?.(event);
      bump((n) => n + 1);
    });
    return off;
  }, [session]);

  const handleVerify = useCallback(() => {
    setGrade(session.verify());
  }, [session]);

  const handleReset = useCallback(() => {
    session.reset();
    setSessionKey((k) => k + 1);
    setGrade(null);
    setShowHints(false);
    bump((n) => n + 1);
  }, [session]);

  // Re-run verify automatically after each command while a verify result is showing.
  useEffect(() => {
    if (!grade) return;
    const off = session.onChange(() => setGrade(session.verify()));
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, grade !== null]);

  const totalMax = maxMarks(problem);
  const done = session.isComplete;
  const currentIdx = Math.min(session.currentStepIndex, problem.steps.length - 1);

  return (
    <div className="flex h-full flex-col">
      {/* score bar */}
      <div className={`flex items-center justify-between border-b border-term-border bg-term-panel px-4 py-2 ${compact ? "py-1.5" : ""}`}>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{problem.title}</h1>
          <p className="text-xs text-term-text/60">{problem.difficulty} · {problem.steps.length} steps</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`font-mono text-sm ${marksColor(session.earned, totalMax)}`} data-testid="marks">
            {session.earned} / {totalMax}
          </div>
          <button
            onClick={handleReset}
            className="rounded border border-term-border px-2 py-1 text-xs hover:bg-term-border/40"
            data-testid="reset-btn"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* step sidebar */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-term-border bg-term-panel p-3 sm:w-80">
          <ol className="space-y-2">
            {problem.steps.map((step, idx) => {
              const stepDone = idx < session.currentStepIndex;
              const current = idx === session.currentStepIndex && !done;
              return (
                <li
                  key={step.id}
                  className={`rounded border p-2 text-xs ${
                    stepDone
                      ? "border-term-green/40 bg-term-green/10"
                      : current
                        ? "border-term-blue/60 bg-term-blue/10"
                        : "border-term-border opacity-60"
                  }`}
                  data-testid={`step-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{stepDone ? "✓" : current ? "→" : "·"} Step {idx + 1}</span>
                    <span className="font-mono">{step.marks} mk</span>
                  </div>
                  <p className="mt-1 leading-snug text-term-text/80">{step.prompt}</p>
                  {current && step.hints.length > 0 && (
                    <div className="mt-1">
                      <button
                        className="text-term-blue hover:underline"
                        onClick={() => setShowHints((v) => !v)}
                        data-testid="hints-btn"
                      >
                        {showHints ? "Hide hint" : "Show hint"}
                      </button>
                      {showHints && <p className="mt-1 italic text-term-yellow">💡 {step.hints[0]}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {done && (
            <div className="mt-3 rounded border border-term-green/50 bg-term-green/10 p-2 text-xs text-term-green" data-testid="complete-banner">
              🎉 Problem complete — {session.earned}/{totalMax} marks!
            </div>
          )}
        </aside>

        {/* terminal + verify */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-2">
            <TerminalView session={session} sessionKey={sessionKey} />
          </div>
          <div className="border-t border-term-border bg-term-panel p-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleVerify}
                disabled={done}
                className="rounded bg-term-green/20 px-3 py-1.5 text-xs font-semibold text-term-green hover:bg-term-green/30 disabled:opacity-40"
                data-testid="verify-btn"
              >
                Verify step {done ? "—" : currentIdx + 1}
              </button>
              <span className="text-xs text-term-text/60">
                Step {Math.min(currentIdx + 1, problem.steps.length)} of {problem.steps.length}
              </span>
            </div>
            {grade && !done && (
              <div className="mt-2 space-y-1" data-testid="verify-results">
                <div className="text-xs font-semibold">
                  {grade.passed ? "✅ All checks passed" : "❌ Not yet"} — {grade.earned}/{grade.max} marks
                </div>
                <ul className="space-y-0.5">
                  {grade.results.map((r, i) => (
                    <li key={i} className="text-xs">
                      <span className={r.passed ? "text-term-green" : "text-term-red"}>{r.passed ? "✓" : "✗"}</span>{" "}
                      <span className="text-term-text/80">{r.message}</span>{" "}
                      <span className="text-term-text/50">({r.passed ? r.marks : 0}/{r.check.marks})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
