"use client";

/**
 * useReveal: one shared IntersectionObserver for scroll-reveal entrances.
 *
 * Usage:
 *   const { ref, shown } = useReveal<HTMLUListElement>();
 *   <ul ref={ref} className={shown ? "reveal-shown" : "reveal-pending"}>
 *
 * Children can set style={{ "--i": n }} for a stagger (60ms per step).
 * With prefers-reduced-motion the CSS renders the settled state immediately
 * and the observer is skipped entirely.
 */
import { useEffect, useRef, useState } from "react";

export function useReveal<T extends HTMLElement>(options?: { once?: boolean; margin?: string }) {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            if (options?.once !== false) io.disconnect();
          }
        }
      },
      { rootMargin: options?.margin ?? "0px 0px -10% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, shown };
}

export const revealClass = (shown: boolean) => (shown ? "reveal-shown" : "reveal-pending");
