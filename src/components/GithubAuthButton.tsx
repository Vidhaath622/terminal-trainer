"use client";

/**
 * GithubAuthButton: "Sign in with GitHub" when signed out; avatar + name
 * linking to /account when signed in.
 */
import Link from "next/link";
import { useGithubUser } from "@/lib/useGithubUser";

export default function GithubAuthButton({ compact = false }: { compact?: boolean }) {
  const { user, loading } = useGithubUser();

  if (loading) {
    return (
      <div
        className={`animate-pulse rounded-lg border border-term-border bg-term-raise/60 ${compact ? "h-8 w-24" : "h-10 w-36"}`}
        aria-hidden
      />
    );
  }

  if (user) {
    return (
      <Link
        href="/account"
        className="group flex items-center gap-2 rounded-lg border border-term-border glass px-3 py-2 text-sm font-medium text-term-text transition hover:border-term-blue/50"
        data-testid="github-account-link"
        title="View your synced progress"
      >
        {user.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="h-5 w-5 rounded-full ring-1 ring-term-border"
          />
        )}
        <span className="max-w-32 truncate">{user.login}</span>
      </Link>
    );
  }

  return (
    <a
      href="/api/auth/github"
      className="shine flex items-center gap-2 rounded-lg bg-term-panel px-4 py-2.5 text-sm font-semibold text-term-text ring-1 ring-term-border transition hover:border-term-blue/50 hover:text-term-blue"
      data-testid="github-signin-btn"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      Sign in with GitHub
    </a>
  );
}
