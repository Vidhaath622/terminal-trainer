"use client";

/**
 * AccountClient: the /account dashboard.
 * Signed out → pitch + connect button. Signed in → profile, synced totals,
 * per-problem progress, and a disconnect action (wipes cloud rows + cookie).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GithubAuthButton from "./GithubAuthButton";
import { useGithubUser } from "@/lib/useGithubUser";
import { fetchCloudProgress, type CloudProgressRow } from "@/lib/sync";
import { parseProgress, type ProgressData } from "@/lib/progress-schema";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import { maxMarks } from "@/engine/grader";

const PROBLEM_BY_ID = new Map(LAUNCH_PROBLEMS.map((p) => [p.id, p]));

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function AccountClient() {
  const { user, loading: userLoading } = useGithubUser();
  const [rows, setRows] = useState<CloudProgressRow[] | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!user) {
      setRows(null);
      return;
    }
    let alive = true;
    void fetchCloudProgress().then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const parsed = useMemo(() => {
    if (!rows) return null;
    const byId = new Map<string, { data: ProgressData; updatedAt: string }>();
    for (const row of rows) {
      const problemId = row.problemId;
      const data = parseProgress(row.data, problemId);
      if (data) byId.set(problemId, { data, updatedAt: row.updatedAt });
    }
    return byId;
  }, [rows]);

  const totals = useMemo(() => {
    if (!parsed) return null;
    let marks = 0;
    let marksMax = 0;
    let stepsDone = 0;
    let problemsComplete = 0;
    let timeMs = 0;
    for (const p of LAUNCH_PROBLEMS) {
      marksMax += maxMarks(p);
      const entry = parsed.get(p.id);
      if (!entry) continue;
      marks += entry.data.earned;
      stepsDone += entry.data.currentStepIndex;
      timeMs += entry.data.durationMs;
      if (entry.data.currentStepIndex >= p.steps.length) problemsComplete += 1;
    }
    return { marks, marksMax, stepsDone, problemsComplete, timeMs };
  }, [parsed]);

  const disconnect = useCallback(async () => {
    if (!window.confirm("Disconnect GitHub and delete all cloud-saved progress? Local progress on this device is kept.")) {
      return;
    }
    setDisconnecting(true);
    try {
      await fetch("/api/account", { method: "DELETE" });
      window.location.href = "/";
    } finally {
      setDisconnecting(false);
    }
  }, []);

  if (userLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
        <div className="h-40 animate-pulse rounded-xl bg-term-panel" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
        <header className="animate-slideUp">
          <p className="text-xs font-semibold uppercase tracking-widest text-term-blue">Account</p>
          <h1 className="mt-1 text-2xl font-bold">Link your GitHub account</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-term-muted">
            Signing in connects Terminal Trainer to your GitHub identity and saves every mark,
            completed step, and command session to the cloud — so your progress follows you to any
            device, and a cleared browser never costs you your work.
          </p>
        </header>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <GithubAuthButton />
          <Link href="/" className="text-sm text-term-muted transition hover:text-term-text">
            ← Back to problems
          </Link>
        </div>
        <ul className="mt-8 space-y-2 text-sm text-term-muted">
          {[
            "Marks and completed steps synced per problem",
            "Command history preserved, so you can resume mid-problem",
            "One dashboard with everything you've done so far",
            "Disconnect anytime — we delete your cloud data on the spot",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-0.5 text-term-green">✓</span> {line}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
      <header className="animate-slideUp">
        <p className="text-xs font-semibold uppercase tracking-widest text-term-blue">Account</p>
        <div className="mt-2 flex items-center gap-4">
          {user.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-14 w-14 rounded-xl ring-1 ring-term-border"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">{user.name ?? user.login}</h1>
            <p className="text-sm text-term-muted">
              @{user.login}
              {user.createdAt ? ` · linked ${timeAgo(user.createdAt)}` : ""}
            </p>
          </div>
        </div>
      </header>

      {totals && (
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-term-border bg-term-border sm:grid-cols-4">
          {[
            [`${totals.marks}`, `marks earned / ${totals.marksMax}`],
            [`${totals.problemsComplete}`, "problems complete"],
            [`${totals.stepsDone}`, "steps done"],
            [formatDuration(totals.timeMs), "time practicing"],
          ].map(([value, label]) => (
            <div key={label} className="bg-term-panel px-4 py-3">
              <dt className="font-mono text-xl font-semibold text-term-text">{value}</dt>
              <dd className="text-xs text-term-muted">{label}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Progress by problem</h2>
        {parsed === null ? (
          <div className="mt-3 h-24 animate-pulse rounded-xl bg-term-panel" />
        ) : (
          <ul className="mt-3 space-y-2">
            {LAUNCH_PROBLEMS.map((p) => {
              const entry = parsed.get(p.id);
              const max = maxMarks(p);
              const pct = entry ? Math.round((entry.data.earned / max) * 100) : 0;
              const complete = entry && entry.data.currentStepIndex >= p.steps.length;
              return (
                <li key={p.id} data-testid={`account-row-${p.id}`}>
                  <Link
                    href={`/play/${p.id}`}
                    className="card group flex items-center gap-4 p-3.5 transition hover:border-term-blue/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-semibold transition group-hover:text-term-blue">
                          {p.title}
                        </span>
                        <span className="font-mono text-xs text-term-muted">
                          {entry ? `${entry.data.earned}/${max}` : `0/${max}`}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-term-border">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            pct === 100
                              ? "bg-gradient-to-r from-term-green to-emerald-300"
                              : "bg-gradient-to-r from-term-blue to-cyan-300"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        complete
                          ? "border-term-green/40 bg-term-green/10 text-term-green"
                          : entry
                            ? "border-term-blue/40 bg-term-blue/10 text-term-blue"
                            : "border-term-border text-term-muted"
                      }`}
                    >
                      {complete ? "done" : entry ? "in progress" : "not started"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="mt-10 flex items-center justify-between border-t border-term-border pt-6">
        <Link href="/" className="text-sm text-term-muted transition hover:text-term-text">
          ← Back to problems
        </Link>
        <button
          onClick={disconnect}
          disabled={disconnecting}
          className="rounded-lg border border-term-red/40 px-4 py-2 text-sm font-medium text-term-red transition hover:bg-term-red/10 disabled:opacity-50"
          data-testid="disconnect-btn"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect GitHub"}
        </button>
      </footer>
    </main>
  );
}
