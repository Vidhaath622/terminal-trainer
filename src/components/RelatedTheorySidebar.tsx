"use client";

/**
 * RelatedTheorySidebar: small card in the step sidebar of /play pages that
 * links back to the relevant theory notes on the home page (/#theory-<id>,
 * which auto-expands that card on arrival).
 */
import Link from "next/link";
import { relatedTheoryFor, theoryHref } from "@/lib/theory";

export default function RelatedTheorySidebar({ problemId }: { problemId: string }) {
  const topics = relatedTheoryFor(problemId);

  return (
    <div
      className="rounded-lg border border-term-border bg-term-panel/80 p-3"
      data-testid="related-theory"
    >
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-term-muted">
        <span aria-hidden className="text-term-yellow">✦</span> Related theory
      </h2>
      <ul className="mt-2 space-y-1">
        {topics.map((t) => (
          <li key={t.id}>
            <Link
              href={theoryHref(t.id)}
              title={t.summary}
              className="group flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-xs text-term-muted transition hover:border-term-border hover:bg-term-raise hover:text-term-text"
            >
              <span aria-hidden className={`font-mono text-[11px] ${t.iconColor}`}>
                {t.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span
                aria-hidden
                className="shrink-0 text-term-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/#commands"
        className="mt-2.5 block text-center text-[10px] font-medium text-term-muted transition hover:text-term-blue"
        title="Browse the command library on the home page"
      >
        ⌘ Command library
      </Link>
      <p className="mt-1.5 text-[10px] leading-snug text-term-muted/70">
        Opens the theory notes on the home page.
      </p>
    </div>
  );
}
