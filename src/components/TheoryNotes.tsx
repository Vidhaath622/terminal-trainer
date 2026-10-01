"use client";

/**
 * TheoryNotes: expandable theory cards — the minimum theory a student needs
 * before tackling CLI / file-management / git questions. Content lives in
 * @/lib/theory so /play pages can link to the same topics.
 *
 * Deep-link support: /?theory=<id>#theory-<id> (used by the related-theory
 * sidebar on /play pages) opens that card on arrival and on hash changes.
 */
import { Suspense, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { THEORY_TOPICS as TOPICS } from "@/lib/theory";
import { useReveal } from "@/lib/useReveal";

const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));

function hashTopic(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/^#theory-([\w-]+)$/);
  return m && TOPIC_IDS.has(m[1]) ? m[1] : null;
}

/**
 * Card grid. `theory` query param (set by the related-theory sidebar links on
 * /play pages) opens the matching card through Next.js soft navigations; the
 * #theory-<id> hash covers direct loads and manual URL edits.
 */
function TheoryNotesInner() {
  const searchParams = useSearchParams();
  const paramTopic = searchParams.get("theory");
  const [openId, setOpenId] = useState<string | null>(() => hashTopic());
  const { ref, shown } = useReveal<HTMLDivElement>();

  // Open the card requested via ?theory=<id> (survives soft navigations).
  useEffect(() => {
    if (paramTopic && TOPIC_IDS.has(paramTopic)) {
      setOpenId(paramTopic);
    }
  }, [paramTopic]);

  // Also react to direct hash edits / back-forward while mounted.
  useEffect(() => {
    const onHash = () => {
      const id = hashTopic();
      if (id) setOpenId(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div ref={ref} className={`grid gap-4 lg:grid-cols-2 reveal-group ${shown ? "reveal-shown" : "reveal-pending"}`}>
      {TOPICS.map((t, idx) => {
        const open = openId === t.id;
        return (
          <article
            key={t.id}
            id={`theory-${t.id}`}
            className={`card reveal-item hover-lift scroll-mt-24 ${
              open ? "border-term-border bg-term-raise/60" : "hover:bg-term-raise/40"
            }`}
            style={{ "--i": Math.min(idx, 11) } as CSSProperties}
          >
            <button
              onClick={() => setOpenId(open ? null : t.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
              data-testid={`theory-toggle-${t.id}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-term-border bg-term-raise font-mono text-sm ${t.iconColor}`}
              >
                {t.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">{t.title}</span>
                <span className="mt-0.5 block truncate text-xs text-term-muted">{t.summary}</span>
              </span>
              <span
                aria-hidden
                className={`shrink-0 font-mono text-term-muted transition-transform duration-200 ${open ? "rotate-90 text-term-green" : ""}`}
              >
                ▸
              </span>
            </button>

            {open && (
              <div className="animate-fadeIn border-t border-term-border px-5 py-4" data-testid={`theory-panel-${t.id}`}>
                <ul className="space-y-2.5">
                  {t.points.map((point, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-term-text/85">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-term-green/70" />
                      <span>
                        {renderPoint(point)}
                      </span>
                    </li>
                  ))}
                </ul>
                {t.practiceHref && (
                  <Link
                    href={t.practiceHref}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-term-border bg-term-panel px-3 py-1.5 text-xs font-medium text-term-blue transition hover:border-term-blue/50 hover:shadow-glow-blue"
                  >
                    {t.practiceLabel ?? "Practice this"} →
                  </Link>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default function TheoryNotes() {
  return (
    <Suspense fallback={<div className="grid gap-4 lg:grid-cols-2" aria-hidden />}>
      <TheoryNotesInner />
    </Suspense>
  );
}

/** Bold any text wrapped in double asterisks so key terms pop without markdown deps. */
function renderPoint(point: string) {
  const parts = point.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-term-text">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
