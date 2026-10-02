"use client";

/**
 * EmbedClient: the /embed route body. Chrome-less player + postMessage bridge.
 * Host sends tt:init / tt:reset; widget emits tt:ready, tt:step:completed,
 * tt:problem:completed, tt:progress.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProblemPlayer from "./ProblemPlayer";
import { LAUNCH_PROBLEMS, getLaunchProblem } from "@/problems/launch";
import {
  isHostToWidget,
  isAllowedHostMessage,
  hasInlineAuthoringAttempt,
  parseAllowedOrigins,
  type HostToWidgetMessage,
  type EmbedInitMessage,
} from "@/embed/protocol";
import type { Problem } from "@/engine/schema";
import type { SessionEvent } from "@/engine/session";
import { maxMarks } from "@/engine/grader";

function parseParams(): {
  problemId?: string;
  studentId?: string;
  compact?: boolean;
  allowedOrigins: string[];
} {
  if (typeof window === "undefined") return { allowedOrigins: [] };
  const params = new URLSearchParams(window.location.search);
  return {
    problemId: params.get("problem") ?? undefined,
    studentId: params.get("student") ?? undefined,
    compact: params.get("compact") === "1",
    // ?origin= pins which parent origins may drive (and receive) this widget.
    allowedOrigins: parseAllowedOrigins(params.get("origin")),
  };
}

export default function EmbedClient() {
  const params = useMemo(parseParams, []);
  const [problem, setProblem] = useState<Problem | null>(() =>
    params.problemId ? getLaunchProblem(params.problemId) ?? null : null
  );
  const [studentId, setStudentId] = useState<string | null>(params.studentId ?? null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const emit = useCallback((msg: unknown) => {
    if (typeof window !== "undefined" && window.parent !== window) {
      // Targeted origin when the host pinned ?origin=, else "*" (public embed).
      window.parent.postMessage(msg, params.allowedOrigins[0] ?? "*");
    }
  }, [params.allowedOrigins]);

  // Handshake: tell the host what we can offer.
  useEffect(() => {
    emit({
      type: "tt:ready",
      problems: LAUNCH_PROBLEMS.map((p) => ({ id: p.id, title: p.title, difficulty: p.difficulty })),
    });
  }, [emit]);

  const onEvent = useCallback(
    (event: SessionEvent) => {
      if (event.type === "step:completed") {
        emit({
          type: "tt:step:completed",
          studentId: studentId ?? undefined,
          problemId: event.problemId,
          stepId: event.stepId,
          earned: event.earned,
          max: event.max,
          durationMs: event.durationMs,
        });
      }
      if (event.type === "problem:completed") {
        emit({
          type: "tt:problem:completed",
          studentId: studentId ?? undefined,
          problemId: event.problemId,
          earned: event.earned,
          max: event.max,
          durationMs: event.durationMs,
        });
      }
    },
    [emit, studentId]
  );

  // Listen for host commands (parent window only; origin-pinned when asked).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (
        !isAllowedHostMessage({
          origin: e.origin,
          sourceIsParent: e.source === window.parent,
          allowedOrigins: params.allowedOrigins,
        })
      ) {
        return;
      }
      if (!isHostToWidget(e.data)) return;
      const msg = e.data as HostToWidgetMessage;
      if (msg.type === "tt:reset") {
        setProblem((p) => p); // handled by player's own Reset; host reset re-mounts below
        setResetNonce((n) => n + 1);
        return;
      }
      const init = msg as EmbedInitMessage;
      startedRef.current = true;
      setStudentId(init.studentId ?? null);
      setError(null);
      // Remote authoring is impossible: a host that sends inline problem JSON
      // is rejected outright (runtime check — untyped hosts can't bypass it).
      if (hasInlineAuthoringAttempt(e.data)) {
        setError(
          "Inline problem content is no longer accepted — use problemId from tt:ready or ?problem=..."
        );
        return;
      }
      if (init.problemId) {
        const found = getLaunchProblem(init.problemId);
        if (found) setProblem(found);
        else setError(`Unknown problemId '${init.problemId}'. Send tt:ready list or ?problem=...`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [params]);

  const [resetNonce, setResetNonce] = useState(0);
  useEffect(() => {
    if (resetNonce > 0) setProblem((p) => (p ? { ...p } : p));
  }, [resetNonce]);

  if (error) {
    return (
      <div className="p-6 text-sm text-term-red" data-testid="embed-error">
        ⚠ {error}
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="p-6 text-sm text-term-text/70" data-testid="embed-picker">
        <p className="mb-3 font-semibold">Pick a problem to practice:</p>
        <ul className="space-y-1">
          {LAUNCH_PROBLEMS.map((p) => (
            <li key={p.id}>
              <button
                className="text-term-blue underline-offset-2 hover:underline"
                onClick={() => setProblem(getLaunchProblem(p.id) ?? null)}
              >
                {p.title} <span className="text-term-text/50">({p.difficulty}, {maxMarks(p)} marks)</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return <ProblemPlayer key={`${problem.id}-${resetNonce}`} problem={problem} studentId={studentId} onEvent={onEvent} compact />;
}
