"use client";

/**
 * useGithubUser: tiny hook exposing the signed-in GitHub user (or null).
 * One fetch per mount; no global cache needed at this app's scale.
 */
import { useEffect, useState } from "react";
import { fetchMe, type GithubUser } from "./sync";

export function useGithubUser(): { user: GithubUser | null; loading: boolean } {
  const [user, setUser] = useState<GithubUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void fetchMe().then((u) => {
      if (alive) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  return { user, loading };
}
