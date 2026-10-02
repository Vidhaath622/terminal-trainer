"use client";

/**
 * Browser-side progress sync: local storage always works; when the visitor
 * is signed in with GitHub, progress blobs are also pushed to /api/progress.
 * Pure functions + thin fetch wrappers — no React imports, so tests stay easy.
 */
import { storageKey } from "@/engine/session";
import type { SessionProgress } from "@/engine/session";
import { parseProgress, mergeProgress, type ProgressData } from "./progress-schema";
import type { Role } from "@/roles/types";

export interface GithubUser {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  /** Effective server-computed role; never trust a client-asserted one. */
  role: Role;
  /** True only for the owner-named account (gates the /admin panel UI). */
  isOwner: boolean;
}

/** Fetch the signed-in user (or null) from /api/me. */
export async function fetchMe(): Promise<GithubUser | null> {
  try {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { user: GithubUser | null };
    return json.user;
  } catch {
    return null; // offline / static hosting: treat as signed out
  }
}

export interface CloudProgressRow {
  problemId: string;
  data: unknown;
  updatedAt: string;
}

/** Fetch every cloud progress row for the signed-in user. */
export async function fetchCloudProgress(): Promise<CloudProgressRow[]> {
  try {
    const res = await fetch("/api/progress", { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { progress: CloudProgressRow[] };
    return json.progress ?? [];
  } catch {
    return [];
  }
}

/** Load a problem's saved blob from localStorage (null when absent/invalid). */
export function loadLocalProgress(problemId: string): ProgressData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(problemId, null));
    if (!raw) return null;
    return parseProgress(JSON.parse(raw), problemId);
  } catch {
    return null;
  }
}

/**
 * Best progress for a problem: freshest of localStorage vs cloud.
 * Returns null when nothing valid exists anywhere.
 */
export function loadBestProgress(
  problemId: string,
  cloud: CloudProgressRow[] | null
): ProgressData | null {
  const local = loadLocalProgress(problemId);
  const cloudRow = cloud?.find((r) => r.problemId === problemId);
  const cloudParsed = cloudRow ? parseProgress(cloudRow.data, problemId) : null;
  return mergeProgress(local, cloudParsed);
}

/** Push one progress blob to the cloud. Returns updatedAt on success. */
export async function pushProgress(
  progress: SessionProgress
): Promise<string | null> {
  try {
    const res = await fetch(`/api/progress/${encodeURIComponent(progress.problemId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: progress.problemId, data: progress }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { updatedAt?: string };
    return json.updatedAt ?? null;
  } catch {
    return null;
  }
}

/**
 * Debounced pusher: coalesces rapid completions (e.g. a command finishing
 * two steps) into one request per quiet period.
 */
export function createSyncPusher(delayMs = 1200) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: SessionProgress | null = null;

  return {
    schedule(progress: SessionProgress) {
      pending = progress;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const toPush = pending;
        pending = null;
        if (toPush) void pushProgress(toPush);
      }, delayMs);
    },
    flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const toPush = pending;
      pending = null;
      if (toPush) void pushProgress(toPush);
    },
  };
}
