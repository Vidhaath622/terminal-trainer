"use client";

/**
 * ProblemPlayer: the full practice experience around the terminal.
 * Left: step list with marks. Right: terminal. Top: score bar.
 * Session auto-grades after every command; Verify shows per-check detail.
 *
 * Practice mode: once the problem is complete, "Practice again" swaps in a
 * brand-new session (no storage, no cloud push, no embed events) so the
 * solved round can be replayed purely for fun. Exit practice restores the
 * completed session from the snapshot taken on entry.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TerminalView from "./TerminalView";
import SyncChip, { type SyncState } from "./SyncChip";
import RelatedTheorySidebar from "./RelatedTheorySidebar";
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
  if (pct >= 50) return "text-term-text";
  return "text-term-muted";
}

/** Fresh or restored session for the given problem (used on mount and on exit-practice). */
function createInitialSession(
  problem: Problem,
  storage: StorageLike | undefined,
  studentId: string | null,
  initialProgress: SessionProgress | null
): Session {
  return initialProgress
    ? Session.restore(problem, JSON.stringify(initialProgress), { storage, studentId })
    : new Session(problem, { storage, studentId });
}

const COMPLETE_BANNER_CLASS =
  "mt-3 rounded border border-term-green/50 bg-term-green/10 p-3 text-xs font-medium text-term-green";
const PRACTICE_BANNER_CLASS =
  "mt-3 rounded border border-term-border bg-term-panel p-3 text-xs font-medium text-term-text";

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
  // Session lives in state so practice mode can swap in a fresh one.
  // initialProgress is only read on mount/reset; identity via problem + key.
  const [session, setSession] = useState<Session>(() =>
    createInitialSession(problem, storage, studentId, initialProgress)
  );
  const [, bump] = useState(0);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [practice, setPractice] = useState(false);
  const savedBlobRef = useRef<string | null>(null);
  // Mirrored for the session listener below (stable closure, no re-subscribe).
  const practiceRef = useRef(false);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const progressCbRef = useRef(onProgressChange);
  progressCbRef.current = onProgressChange;

  // Emit session events (step:completed / problem:completed) to the parent.
  // During practice both the embed bridge and the cloud push stay silent so
  // replayed rounds can never overwrite the earned record.
  useEffect(() => {
    const off = session.onChange((event) => {
      if (!practiceRef.current) {
        eventRef.current?.(event);
        progressCbRef.current?.(session.progress());
      }
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

  /** Start a fresh replay round on the same page. Saves nothing anywhere. */
  const enterPractice = useCallback(() => {
    savedBlobRef.current = JSON.stringify(session.progress());
    practiceRef.current = true;
    setPractice(true);
    setSession(new Session(problem, { studentId })); // no storage: local save untouched
    setSessionKey((k) => k + 1); // TerminalView re-inits
    setGrade(null);
    setShowHints(false);
  }, [problem, session, studentId]);

  /** Leave practice: restore the completed session snapshot. */
  const exitPractice = useCallback(() => {
    practiceRef.current = false;
    setPractice(false);
    const blob = savedBlobRef.current;
    savedBlobRef.current = null;
    setSession(
      blob
        ? Session.restore(problem, blob, { storage, studentId })
        : createInitialSession(problem, storage, studentId, initialProgress)
    );
    setSessionKey((k) => k + 1);
    setGrade(null);
    setShowHints(false);
  }, [problem, storage, studentId, initialProgress]);

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
      <div className={`relative z-10 flex items-center justify-between gap-4 border-b border-term-border bg-term-panel px-4 py-2 ${compact ? "py-1.5" : ""}`}>
        <div className="flex min-w-0 items-center gap-3">
          {!compact && (
            <Link
              href="/"
              aria-label="Back to home page"
              title="Back to home page"
              className="shrink-0 rounded border border-term-border bg-term-raise/60 px-2.5 py-1.5 font-mono text-xs font-medium text-term-muted hover:border-term-green/60"
              data-testid="back-btn"
            >
              Back
            </Link>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-term-text">{problem.title}</h1>
              {practice && (
                <span
                  className="shrink-0 rounded border border-term-border bg-term-raise px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-term-text"
                  data-testid="practice-pill"
                  title="Practice round — your saved score is safe"
                >
                  Practice
                </span>
              )}
            </div>
            <p className="font-mono text-xs capitalize text-term-muted">
              {problem.difficulty}, {problem.steps.length} steps
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!compact && <SyncChip state={signedIn ? syncState : "signed-out"} />}
          <div className="text-right">
            <div className={`font-mono text-sm font-semibold tabular-nums ${marksColor(session.earned, totalMax)}`} data-testid="marks">
              {session.earned} <span className="text-term-muted">/ {totalMax}</span>
            </div>
            {/* progress bar */}
            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-term-border">
              <div
                className={`h-full rounded-full ${pct === 100 ? "bg-term-green" : "bg-term-text/60"}`}
                style={{ width: `${pct}%` }}
                data-testid="progress-fill"
              />
            </div>
          </div>
          <button
            onClick={handleReset}
            className="rounded border border-term-border bg-term-raise/60 px-2.5 py-1.5 font-mono text-xs font-medium text-term-muted hover:border-term-red/50 hover:text-term-red"
            data-testid="reset-btn"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* step sidebar */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-term-border bg-term-panel/70 p-3 sm:w-80">
          <ol className="space-y-2">
            {problem.steps.map((step, idx) => {
              const stepDone = idx < session.currentStepIndex;
              const current = idx === session.currentStepIndex && !done;
              return (
                <li
                  key={step.id}
                  className={`rounded border p-2.5 text-xs ${
                    stepDone
                      ? "border-term-green/40 bg-term-green/10"
                      : current
                        ? "border-term-green/60 bg-term-green/5"
                        : "border-term-border opacity-60 hover:opacity-90"
                  }`}
                  data-testid={`step-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                          stepDone
                            ? "bg-term-green text-term-bg"
                            : current
                              ? "border border-term-green text-term-green"
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
                        className="font-medium text-term-blue hover:underline"
                        onClick={() => setShowHints((v) => !v)}
                        data-testid="hints-btn"
                      >
                        {showHints ? "Hide hint" : "Show hint"}
                      </button>
                      {showHints && (
                        <p className="mt-1.5 rounded border border-term-yellow/30 bg-term-yellow/10 p-1.5 text-term-yellow">
                          {step.hints[0]}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {!compact && (
            <div className="mt-3">
              <RelatedTheorySidebar problemId={problem.id} />
            </div>
          )}
          {done && !practice && (
            <div className={COMPLETE_BANNER_CLASS} data-testid="complete-banner">
              <span>Problem complete: {session.earned}/{totalMax} marks.</span>
              <button
                onClick={enterPractice}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-term-green/20 px-3 py-2 font-mono text-xs font-bold text-term-green ring-1 ring-term-green/40 hover:bg-term-green/30"
                data-testid="practice-btn"
                title="Replay this problem in practice mode — your saved score is safe"
              >
                Practice again
              </button>
            </div>
          )}
          {practice && !done && (
            <div className={PRACTICE_BANNER_CLASS} data-testid="practice-banner">
              <span>Practice round — your saved score is safe.</span>
              <button
                onClick={exitPractice}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-term-border bg-term-raise/60 px-3 py-2 font-mono text-xs font-semibold text-term-text hover:border-term-green/60"
                data-testid="exit-practice-btn"
                title="Return to your completed round"
              >
                Exit practice
              </button>
            </div>
          )}
          {done && practice && (
            <div className={COMPLETE_BANNER_CLASS} data-testid="complete-banner">
              <span>Problem complete: {session.earned}/{totalMax} marks.</span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-term-green/70">Practice round</span>
              <button
                onClick={enterPractice}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-term-green/20 px-3 py-2 font-mono text-xs font-bold text-term-green ring-1 ring-term-green/40 hover:bg-term-green/30"
                data-testid="practice-btn"
                title="Replay this problem in practice mode — your saved score is safe"
              >
                Practice again
              </button>
              <button
                onClick={exitPractice}
                className="mt-1.5 flex w-full items-center justify-center rounded border border-term-border bg-term-raise/60 px-3 py-1.5 font-mono text-xs font-medium text-term-muted hover:border-term-green/60"
                data-testid="exit-practice-btn"
                title="Return to your earned round"
              >
                Exit practice
              </button>
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
                className="rounded bg-term-green/15 px-4 py-2 font-mono text-xs font-semibold text-term-green ring-1 ring-term-green/30 hover:bg-term-green/25 disabled:opacity-40 disabled:ring-0"
                data-testid="verify-btn"
              >
                Verify step {done ? "—" : currentIdx + 1}
              </button>
              <span className="font-mono text-xs text-term-muted">
                Step {Math.min(currentIdx + 1, problem.steps.length)} of {problem.steps.length}
              </span>
            </div>
            {grade && !done && (
              <div className="mt-2.5 space-y-1" data-testid="verify-results">
                <div className={`text-xs font-semibold ${grade.passed ? "text-term-green" : "text-term-red"}`}>
                  {grade.passed ? "All checks passed — step complete." : "Not yet: " + grade.earned + "/" + grade.max + " marks"}
                </div>
                <ul className="space-y-1">
                  {grade.results.map((r, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2 rounded border px-2 py-1 text-xs ${
                        r.passed ? "border-term-green/25 bg-term-green/5" : "border-term-red/25 bg-term-red/5"
                      }`}
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
