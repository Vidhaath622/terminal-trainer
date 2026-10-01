"use client";

/**
 * SyncChip: score-bar indicator for cloud sync state.
 * hidden in embed (compact) mode — the widget stays anonymous and chrome-less.
 */
import Link from "next/link";
import { useGithubUser } from "@/lib/useGithubUser";

export type SyncState = "signed-out" | "syncing" | "synced" | "error";

const LABELS: Record<SyncState, string> = {
  "signed-out": "Sign in to sync",
  syncing: "Syncing",
  synced: "Synced",
  error: "Sync failed",
};

const STYLES: Record<SyncState, string> = {
  "signed-out": "border-term-border text-term-muted hover:border-term-green/60",
  syncing: "border-term-border text-term-text",
  synced: "border-term-green/50 text-term-green",
  error: "border-term-red/50 text-term-red",
};

export default function SyncChip({ state }: { state: SyncState }) {
  const { user, loading } = useGithubUser();

  if (loading) {
    return <div className="h-7 w-28 animate-pulse rounded bg-term-raise/60" aria-hidden />;
  }

  if (state === "signed-out" || !user) {
    return (
      <Link
        href="/api/auth/github"
        className={`rounded border px-2.5 py-1.5 font-mono text-xs font-medium ${STYLES["signed-out"]}`}
        title="Sign in with GitHub to save progress to the cloud"
        data-testid="sync-chip"
      >
        Sign in to sync
      </Link>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-xs font-medium ${STYLES[state]}`}
      data-testid="sync-chip"
      title={
        state === "synced"
          ? "Progress saved to your GitHub-linked cloud storage"
          : state === "syncing"
            ? "Pushing progress to the cloud"
            : "Cloud save failed — progress is still saved in this browser"
      }
    >
      {state === "syncing" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-term-text/70" />
      )}
      {state === "synced" && <span className="h-1.5 w-1.5 rounded-full bg-term-green" />}
      {state === "error" && <span className="h-1.5 w-1.5 rounded-full bg-term-red" />}
      {LABELS[state]}
    </span>
  );
}
