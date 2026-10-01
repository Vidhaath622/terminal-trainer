"use client";

/**
 * Client body of the /play/[id] page (kept separate so the page can be
 * statically generated with generateStaticParams).
 *
 * Progress lifecycle:
 *  1. Restore the freshest of localStorage / cloud blob (if signed in).
 *  2. Session auto-saves to localStorage on every command (unchanged).
 *  3. When signed in, completions are debounce-pushed to /api/progress.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProblemPlayer from "@/components/ProblemPlayer";
import { getLaunchProblem, LAUNCH_PROBLEMS } from "@/problems/launch";
import type { SessionProgress } from "@/engine/session";
import {
  loadBestProgress,
  fetchCloudProgress,
  fetchMe,
  createSyncPusher,
  type GithubUser,
} from "@/lib/sync";

export default function PlayClient({ id }: { id: string }) {
  const problem = getLaunchProblem(id);

  // null until restored; undefined means "still loading"
  const [initialProgress, setInitialProgress] = useState<SessionProgress | null | undefined>(
    undefined
  );
  const [user, setUser] = useState<GithubUser | null>(null);
  const [syncState, setSyncState] = useState<"signed-out" | "syncing" | "synced" | "error">(
    "signed-out"
  );
  const pusherRef = useRef<ReturnType<typeof createSyncPusher> | null>(null);
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore + sign-in check, in parallel, once per problem.
  useEffect(() => {
    if (!problem) return;
    let alive = true;
    void Promise.all([fetchCloudProgress(), fetchMe()]).then(([cloud, me]) => {
      if (!alive) return;
      setUser(me);
      setSyncState(me ? "synced" : "signed-out");
      setInitialProgress(loadBestProgress(problem.id, me ? cloud : null));
    });
    return () => {
      alive = false;
    };
  }, [problem]);

  // Debounced cloud push, driven by the player's onProgressChange.
  const syncProgress = useCallback(
    (progress: SessionProgress) => {
      if (!user) return;
      if (!pusherRef.current) pusherRef.current = createSyncPusher();
      setSyncState("syncing");
      pusherRef.current.schedule(progress);
      if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
      syncedTimerRef.current = setTimeout(() => setSyncState("synced"), 1600);
    },
    [user]
  );

  const loading = useMemo(() => initialProgress === undefined, [initialProgress]);

  if (!problem) {
    return (
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
        <h1 className="text-xl font-bold">Problem not found</h1>
        <p className="mt-2 text-sm text-term-muted">No problem with id &quot;{id}&quot;.</p>
        <ul className="mt-5 space-y-1.5 text-sm">
          {LAUNCH_PROBLEMS.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="text-term-muted">·</span> {p.title}
              <code className="rounded bg-term-panel px-1.5 py-0.5 font-mono text-xs text-term-muted">
                {p.id}
              </code>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="h-screen p-2 sm:p-3">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <div className="animate-pulse text-sm text-term-muted">Restoring progress</div>
        </div>
      ) : (
        <ProblemPlayer
          problem={problem}
          initialProgress={initialProgress}
          signedIn={!!user}
          syncState={syncState}
          onProgressChange={syncProgress}
        />
      )}
    </main>
  );
}
