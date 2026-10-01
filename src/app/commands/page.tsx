import Link from "next/link";
import type { CSSProperties } from "react";
import CommandReferenceSection from "@/components/CommandReference";

export const metadata = {
  title: "Terminal Trainer — command library",
  description:
    "Every command the simulated shell supports: what it does, a runnable example with one-click copy, and cautions where a flag can bite.",
};

export default function CommandsPage() {
  return (
    <main className="relative mx-auto max-w-6xl px-6 pb-16 pt-10">
      {/* ambient orbs + blueprint grid, matching the home page backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        <div className="animate-float absolute -top-20 right-[8%] h-72 w-72 rounded-full bg-term-blue/10 blur-3xl" />
        <div className="animate-float-slow absolute top-40 -left-24 h-80 w-80 rounded-full bg-term-green/10 blur-3xl" />
      </div>

      <header className="animate-slideUp">
        <p className="overline" style={{ "--overline-color": "#58a6ff" } as CSSProperties}>
          02 — Command library
        </p>
        <h1
          className="mt-3 font-display font-bold text-term-text"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "-0.03em", lineHeight: 1.05 }}
        >
          Every command, <span className="text-gradient">one glance</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-term-muted">
          What each command does and one runnable example — skim it before attempting the
          practice problems, then copy an example straight into the terminal to try it. Search by
          name or text, or filter by category.
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
        <CommandReferenceSection />
      </section>
    </main>
  );
}
