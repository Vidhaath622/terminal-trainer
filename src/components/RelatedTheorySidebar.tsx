"use client";

/**
 * RelatedTheorySidebar: small card in the step sidebar of /play pages that
 * links back to the relevant theory notes on the home page (/?theory=<id>,
 * which auto-expands that card on arrival) and to /commands for the library.
 */
import Link from "next/link";
import { relatedTheoryFor, theoryHref } from "@/lib/theory";

export default function RelatedTheorySidebar({ problemId }: { problemId: string }) {
  const topics = relatedTheoryFor(problemId);

  return (
    <div
      className="rounded border border-term-border bg-term-panel/80 p-3"
      data-testid="related-theory"
    >
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-term-muted">
        Related theory
      </h2>
      <ul className="mt-2 space-y-1">
        {topics.map((t) => (
          <li key={t.id}>
            <Link
              href={theoryHref(t.id)}
              title={t.summary}
              className="block rounded border border-transparent px-1.5 py-1 text-xs text-term-muted hover:border-term-border hover:bg-term-raise hover:text-term-text"
            >
              <span className="block truncate">{t.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/commands"
        className="mt-2.5 block text-center font-mono text-[10px] font-medium text-term-muted hover:text-term-green"
        title="Browse the full command library"
      >
        Command library
      </Link>
      <p className="mt-1.5 text-[10px] leading-snug text-term-muted/70">
        Opens the theory notes on the home page.
      </p>
    </div>
  );
}
