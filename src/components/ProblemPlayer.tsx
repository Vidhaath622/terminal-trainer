"use client";

/**
 * ProblemPlayer: the full practice experience around the terminal.
 * Left: step list with marks. Right: terminal. Top: score bar.
 * Session auto-grades after every command; Verify shows per-check detail.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import TerminalView from "./TerminalView";
import SyncChip, { type SyncState } from "./SyncChip";
import { Session, type SessionEvent, type SessionProgress, type StorageLike } from "@/engine/session";
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
  /** resume from a previously saved blob (local or cloud); null = fresh start */
  initialProgress?: SessionProgress | null;
  /** signed into GitHub (drives the sync chip) */
  signedIn?: boolean;
  /** cloud sync indicator state */
  syncState?: SyncState;
  /** called after each command with the current progress blob (cloud push) */
  onProgressChange?: (progress: SessionProgress) => void;
}

function marksColor(earned: number, max: number): string {
  const pct = max === 0 ? 0 : Math.round((earned / max) * 100);
  if (pct === 100) return "text-term-green";
  if (pct >= 50) return "text-term-yellow";
  return "text-term-text";
}

export default function ProblemPlayer({
  problem,
  studentId = null,
  onEvent,
  storage,
  compact = false,
  initialProgress = null,
  signedIn = false,
  syncState = "signed-out",
  onProgressChange,
}: ProblemPlayerProps) {
  const session = useMemo(
    () =>
      initialProgress
        ? Session.restore(problem, JSON.stringify(initialProgress), { storage, studentId })
        : new Session(problem, { storage, studentId }),
    // initialProgress is only read on mount/reset; identity via problem + key
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [problem, storage, studentId]
  );
  const [, bump] = useState(0);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const progressCbRef = useRef(onProgressChange);
  progressCbRef.current = onProgressChange;

  // Emit session events (step:completed / problem:completed) to the parent.
  useEffect(() => {
    const off = session.onChange((event) => {
      eventRef.current?.(event);
      progressCbRef.current?.(session.progress());
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

  const pct = totalMax === 0 ? 0 : Math.round((session.earned / totalMax) * 100);

  return (
    <div className="flex h-full flex-col">
      {/* score bar */}
      <div className={`glass relative z-10 flex items-center justify-between gap-4 border-b border-term-border px-4 py-2 ${compact ? "py-1.5" : ""}`}>
        <div className="flex min-w-0 items-center gap-3">
          {!compact && (
            <Link
              href="/"
              aria-label="Back to home page"
              title="Back to home page"
              className="shine shrink-0 rounded-lg border border-term-border bg-term-raise/60 px-2.5 py-1.5 text-xs font-medium text-term-muted transition hover:border-term-blue/60 hover:text-term-blue"
              data-testid="back-btn"
            >
              ← Back
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{problem.title}</h1>
            <p className="text-xs capitalize tracking-wide text-term-muted">{problem.difficulty} · {problem.steps.length} steps</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!compact && <SyncChip state={signedIn ? syncState : "signed-out"} />}
          <div className="text-right">
            <div className={`font-mono text-sm font-semibold tabular-nums ${marksColor(session.earned, totalMax)}`} data-testid="marks">
              {session.earned} <span className="text-term-muted">/ {totalMax}</span>
            </div>
            {/* progress bar */}
            <div className="relative mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-term-border">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  pct === 100
                    ? "bg-gradient-to-r from-term-green to-emerald-300 shadow-glow"
                    : "bg-gradient-to-r from-term-blue to-cyan-300"
                }`}
                style={{ width: `${pct}%` }}
                data-testid="progress-fill"
              />
              {pct > 0 && pct < 100 && (
                <div
                  className="pointer-events-none absolute top-0 h-full w-6 animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  style={{ left: `max(0px, calc(${pct}% - 24px))` }}
                />
              )}
            </div>
          </div>
          <button
            onClick={handleReset}
            className="shine rounded-lg border border-term-border bg-term-raise/60 px-2.5 py-1.5 text-xs font-medium text-term-muted transition hover:border-term-red/50 hover:text-term-red"
            data-testid="reset-btn"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* step sidebar */}        <aside className="w-72 shrink-0 overflow-y-auto border-r border-term-border bg-term-panel/70 p-3 sm:w-80">
          <ol className="space-y-2">
            {problem.steps.map((step, idx) => {
              const stepDone = idx < session.currentStepIndex;
              const current = idx === session.currentStepIndex && !done;
              return (
                <li
                  key={step.id}
                  className={`relative rounded-lg border p-2.5 text-xs transition-all duration-200 ${
                    stepDone
                      ? "border-term-green/40 bg-term-green/10"
                      : current
                        ? "border-term-blue/60 bg-term-blue/10 shadow-glow-blue"
                        : "border-term-border opacity-60 hover:opacity-90 hover:border-term-muted/40"
                  }`}
                  data-testid={`step-${idx}`}
                >
                  {current && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 -left-3 w-[3px] rounded-full bg-gradient-to-b from-term-blue to-cyan-300 shadow-glow-blue"
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                          stepDone
                            ? "bg-term-green text-term-bg shadow-glow"
                            : current
                              ? "bg-term-blue text-term-bg shadow-glow-blue"
                              : "border border-term-border text-term-muted"
                        }`}
                      >
                        {stepDone ? "✓" : idx + 1}
                      </span>
                      Step {idx + 1}
                    </span>
                    <span className={`font-mono ${stepDone ? "text-term-green" : "text-term-muted"}`}>{step.marks} mk</span>
                  </div>
                  <p className={`mt-1.5 leading-snug ${stepDone ? "text-term-muted" : "text-term-text/85"}`}>{step.prompt}</p>
                  {current && step.hints.length > 0 && (
                    <div className="mt-1.5">
                      <button
                        className="font-medium text-term-blue transition hover:underline"
                        onClick={() => setShowHints((v) => !v)}
                        data-testid="hints-btn"
                      >
                        {showHints ? "Hide hint" : "Show hint"}
                      </button>
                      {showHints && (
                        <p className="mt-1.5 animate-fadeIn rounded border border-term-yellow/30 bg-term-yellow/10 p-1.5 italic text-term-yellow">
                          {step.hints[0]}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {done && (
            <div className="relative mt-3 animate-slideUp overflow-hidden rounded-lg border border-term-green/50 bg-term-green/10 p-3 text-xs font-medium text-term-green shadow-glow" data-testid="complete-banner">
              <div aria-hidden className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
              <span className="relative">🎉 Problem complete — {session.earned}/{totalMax} marks!</span>
            </div>
          )}
        </aside>

        {/* terminal + verify */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-2">
            <TerminalView session={session} sessionKey={sessionKey} />
          </div>
          <div className="border-t border-term-border bg-term-panel/70 p-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleVerify}
                disabled={done}
                className="shine rounded-lg bg-term-green/15 px-4 py-2 text-xs font-semibold text-term-green ring-1 ring-term-green/30 transition hover:bg-term-green/25 hover:shadow-glow disabled:opacity-40 disabled:ring-0"
                data-testid="verify-btn"
              >
                ⚡ Verify step {done ? "—" : currentIdx + 1}
              </button>
              <span className="text-xs text-term-muted">
                Step {Math.min(currentIdx + 1, problem.steps.length)} of {problem.steps.length}
              </span>
            </div>
            {grade && !done && (
              <div className="mt-2.5 animate-fadeIn space-y-1" data-testid="verify-results">
                <div className={`text-xs font-semibold ${grade.passed ? "text-term-green" : "text-term-red"}`}>
                  {grade.passed ? "✅ All checks passed — step complete!" : "❌ Not yet — " + grade.earned + "/" + grade.max + " marks"}
                </div>
                <ul className="space-y-1">
                  {grade.results.map((r, i) => (
                    <li
                      key={i}
                      className={`animate-fadeIn flex items-start gap-2 rounded border px-2 py-1 text-xs ${
                        r.passed ? "border-term-green/25 bg-term-green/5" : "border-term-red/25 bg-term-red/5"
                      }`}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <span className={r.passed ? "text-term-green" : "text-term-red"}>{r.passed ? "✓" : "✗"}</span>
                      <span className="flex-1 text-term-text/85">{r.message}</span>
                      <span className="font-mono text-term-muted">{r.passed ? r.marks : 0}/{r.check.marks}</span>
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
