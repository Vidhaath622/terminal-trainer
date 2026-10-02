"use client";

/**
 * OwnerPanel: the body of /admin. Owner-only roster of every GitHub account
 * that has signed in, with a student/teacher selector per row.
 *
 * The UI gate is /api/me's isOwner flag, but the real gate is the API: both
 * admin routes 403 anyone who is not the owner-named session, so a forged
 * client learns nothing and changes nothing.
 */
import { useEffect, useState } from "react";
import { fetchMe, type GithubUser } from "@/lib/sync";

interface RosterUser {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  role: "admin" | "teacher" | "student";
  roleSource: "panel" | "env";
  isOwner: boolean;
}

type LoadState = "loading" | "denied" | "ready" | "error";

export default function OwnerPanel() {
  // undefined = still loading, null = signed out
  const [me, setMe] = useState<GithubUser | null | undefined>(undefined);
  const [users, setUsers] = useState<RosterUser[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMe().then(async (u) => {
      if (!alive) return;
      setMe(u);
      if (!u || !u.isOwner) {
        setState("denied");
        return;
      }
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { users: RosterUser[] };
        if (!alive) return;
        setUsers(json.users);
        setState("ready");
      } catch {
        if (alive) setState("error");
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const assign = async (githubId: number, role: "student" | "teacher") => {
    setSaving(githubId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${githubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setUsers((list) =>
        list.map((u) =>
          u.githubId === githubId ? { ...u, role, roleSource: "panel" } : u
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not update role");
    } finally {
      setSaving(null);
    }
  };

  if (state === "loading" || me === undefined) {
    return (
      <p className="font-mono text-sm text-term-text/60" data-testid="owner-loading">
        loading…
      </p>
    );
  }

  if (state === "denied") {
    return (
      <div
        className="rounded border border-term-border bg-term-panel p-6 text-sm text-term-text/70"
        data-testid="owner-denied"
      >
        ✗ <span className="font-semibold">Not authorized.</span> This panel is
        owner-only{me ? "" : " — sign in with GitHub first"}.
        {me ? ` Signed in as ${me.login}.` : ""}
        <p className="mt-2 text-xs text-term-text/50">
          The owner account is named by OWNER_GITHUB_IDS / OWNER_LOGINS on the
          server; anonymous visitors are always students.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <p className="text-sm text-term-red" data-testid="owner-error">
        ✗ could not load the roster — try again.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-term-text/60">
        Assign <span className="text-term-green">student</span> or{" "}
        <span className="text-term-green">teacher</span> to every GitHub account
        that has signed in. Assignments persist across sign-ins and override the
        env allowlists; <span className="text-term-yellow">admin</span> and{" "}
        <span className="text-term-yellow">owner</span> can only come from
        server config.
      </p>

      {error && (
        <p className="text-xs text-term-red" role="alert" data-testid="owner-error-msg">
          ✗ {error}
        </p>
      )}

      <div className="overflow-x-auto rounded border border-term-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-term-panel font-mono uppercase text-term-text/50">
            <tr>
              <th className="px-3 py-2">account</th>
              <th className="px-3 py-2">signed up</th>
              <th className="px-3 py-2">role</th>
              <th className="px-3 py-2">source</th>
              <th className="px-3 py-2">assign</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.githubId} className="border-t border-term-border" data-testid={`user-${u.login}`}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    {u.avatarUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="h-5 w-5 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span className="font-semibold">{u.login}</span>
                    {u.name && <span className="text-term-text/50">{u.name}</span>}
                    {u.isOwner && (
                      <span className="rounded bg-term-yellow/15 px-1.5 py-0.5 text-[10px] text-term-yellow">
                        owner
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-term-text/60">
                  {u.createdAt.slice(0, 10)}
                </td>
                <td className="px-3 py-2 font-mono">{u.role}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      u.roleSource === "panel"
                        ? "bg-term-green/15 text-term-green"
                        : "bg-term-panel text-term-text/60"
                    }`}
                  >
                    {u.roleSource}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {u.isOwner || u.role === "admin" ? (
                    <span className="text-term-text/40">locked</span>
                  ) : (
                    <select
                      className="rounded border border-term-border bg-term-bg px-2 py-1 font-mono"
                      value={u.role === "teacher" ? "teacher" : "student"}
                      disabled={saving === u.githubId}
                      onChange={(e) =>
                        assign(u.githubId, e.target.value as "student" | "teacher")
                      }
                      data-testid={`assign-${u.login}`}
                    >
                      <option value="student">student</option>
                      <option value="teacher">teacher</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-term-text/50">
                  No accounts have signed in yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
