import Link from "next/link";
import type { CSSProperties } from "react";
import ProblemLibrary from "@/components/ProblemLibrary";

export const metadata = {
  title: "Terminal Trainer — practice library",
  description:
    "Every practice problem in one place: filter by difficulty, search by skill, and jump straight into the graded terminal.",
};

export default function ProblemsPage() {
  return (
    <main className="relative mx-auto max-w-6xl px-6 pb-16 pt-10">
      {/* ambient orbs + blueprint grid, matching the home page backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        <div className="animate-float absolute -top-20 right-[8%] h-72 w-72 rounded-full bg-term-blue/10 blur-3xl" />
        <div className="animate-float-slow absolute top-40 -left-24 h-80 w-80 rounded-full bg-term-green/10 blur-3xl" />
      </div>

      <header className="animate-slideUp">
        <p className="overline" style={{ "--overline-color": "#3fb950" } as CSSProperties}>
          01 — Practice library
        </p>
        <h1
          className="mt-3 font-display font-bold text-term-text"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "-0.03em", lineHeight: 1.05 }}
        >
          Every problem, <span className="text-gradient">one glance</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-term-muted">
          The full set of graded problems, from first <code className="rounded bg-term-panel px-1 font-mono text-[11px] text-term-green">pwd</code> to
          the boss challenge. Filter by difficulty, search by the skills a problem exercises, then
          jump in — progress and marks are saved in your browser as you go.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/play/pwd-navigate"
            className="shine hover-lift rounded-lg bg-term-green/15 px-5 py-2.5 text-sm font-semibold text-term-green ring-1 ring-term-green/30"
          >
            Start practicing →
          </Link>
          <Link
            href="/"
            className="shine hover-lift rounded-lg border border-term-border glass px-5 py-2.5 text-sm font-semibold text-term-text transition hover:border-term-blue/50 hover:text-term-blue"
          >
            ← Back to home
          </Link>
        </div>
        <hr className="hairline mt-8" />
      </header>

      <section className="mt-10">
        <ProblemLibrary />
      </section>
    </main>
  );
}
