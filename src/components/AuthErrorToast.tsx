"use client";

/**
 * AuthErrorToast: surfaces OAuth failures that come back as
 * /?auth_error=... after the callback redirect. Auto-hides after 8s.
 */
import { useEffect, useState } from "react";

export default function AuthErrorToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("auth_error");
    if (err) {
      setMessage(err);
      // Clean the query string so refresh doesn't re-show it.
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      window.history.replaceState({}, "", url.toString());
      const timer = setTimeout(() => setMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[90vw] rounded border border-term-red/40 bg-term-panel px-4 py-2.5 text-sm text-term-red"
      data-testid="auth-error-toast"
    >
      GitHub sign-in failed: {message}
    </div>
  );
}
