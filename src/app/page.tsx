import Link from "next/link";
import type { CSSProperties } from "react";
import GithubAuthButton from "@/components/GithubAuthButton";
import AuthErrorToast from "@/components/AuthErrorToast";
import HeroTerminal from "@/components/HeroTerminal";
import StatCountUp from "@/components/StatCountUp";
import RevealSection from "@/components/RevealSection";
import TheoryNotes from "@/components/TheoryNotes";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import { commandNames } from "@/engine/commands";
import { maxMarks } from "@/engine/grader";

export default function Home() {
  const totalSteps = LAUNCH_PROBLEMS.reduce((s, p) => s + p.steps.length, 0);
  const totalMarks = LAUNCH_PROBLEMS.reduce((s, p) => s + maxMarks(p), 0);

  return (
    <main className="relative mx-auto max-w-6xl px-6 pb-16 pt-10">
      <AuthErrorToast />
      {/* ambient orbs + blueprint grid + aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute left-1/2 top-[6rem] h-[34rem] w-[70rem] -translate-x-1/2">
          <div className="aurora" />
        </div>
        <div className="animate-float absolute -top-20 right-[8%] h-72 w-72 rounded-full bg-term-blue/10 blur-3xl" />
        <div className="animate-float-slow absolute top-40 -left-24 h-80 w-80 rounded-full bg-term-green/10 blur-3xl" />
        <div className="animate-float absolute top-[30rem] right-[30%] h-64 w-64 rounded-full bg-term-violet/10 blur-3xl [animation-delay:-3s]" />
      </div>

      {/* hero */}
      <header className="animate-slideUp">
        <div className="inline-flex items-center gap-2 rounded-full border border-term-border glass px-3 py-1 text-xs text-term-muted">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-term-green opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-term-green" />
          </span>
          Built for first-year CS · embeds into any college site
        </div>

        <h1
          className="mt-6 max-w-4xl font-display font-bold text-term-text"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          Master the <span className="text-gradient">Linux terminal</span>, one graded step at a
          time.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-term-muted">
          A simulated shell with pipes, redirection and permissions. Every step is auto-graded for
          marks, every problem ships with test-case verification — no setup, no risk, runs entirely
          in your browser.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/problems"
            className="border-beam shine hover-lift rounded-lg bg-term-green/15 px-5 py-2.5 text-sm font-semibold text-term-green ring-1 ring-term-green/30"
          >
            Browse problems →
          </Link>
          <Link
            href="/commands"
            className="shine hover-lift rounded-lg border border-term-border glass px-5 py-2.5 text-sm font-semibold text-term-text transition hover:border-term-blue/50 hover:text-term-blue"
          >
            Browse commands →
          </Link>
          <Link
            href="/docs/embed"
            className="shine hover-lift rounded-lg border border-term-border glass px-5 py-2.5 text-sm font-semibold text-term-text transition hover:border-term-blue/50 hover:text-term-blue"
          >
            Embed in your site
          </Link>
          <span className="mx-1 hidden text-term-border sm:inline">|</span>
          <GithubAuthButton />
        </div>
        <p className="mt-2 text-xs text-term-muted">
          Signing in links your GitHub account and syncs marks + progress to the cloud — pick up
          on any device, never lose a step.
        </p>

        {/* hero terminal mock (types itself) */}
        <div className="relative mt-12 max-w-3xl">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-term-green/15 via-term-blue/10 to-term-violet/15 blur-2xl"
          />
          <HeroTerminal />
        </div>

        {/* stats strip */}
        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-term-border bg-term-border sm:grid-cols-4">
          {[
            [LAUNCH_PROBLEMS.length, "authored problems"],
            [totalSteps, "graded steps"],
            [totalMarks, "marks to earn"],
            [commandNames().length, "shell commands"],
          ].map(([value, label]) => (
            <div key={label as string} className="bg-term-panel px-4 py-3 transition hover:bg-term-raise">
              <dt className="font-mono text-xl font-semibold text-term-text transition hover:text-term-green">
                <StatCountUp value={value as number} />
              </dt>
              <dd className="text-xs text-term-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* practice library banner */}
      <RevealSection className="mt-14">
        <hr className="hairline mb-10" />
        <p className="overline" style={{ "--overline-color": "#3fb950" } as CSSProperties}>
          01 — Practice library
        </p>
        <Link
          href="/problems"
          className="card shine hover-lift group mt-3 flex items-center justify-between gap-4 p-5 hover:border-term-green/50"
        >
          <div>
            <h2
              className="font-display font-semibold text-term-text"
              style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", letterSpacing: "-0.02em", lineHeight: 1.15 }}
            >
              Practice <span className="text-gradient">problems</span>
            </h2>
            <p className="mt-1 text-sm text-term-muted">
              {LAUNCH_PROBLEMS.length} graded problems, from your first pwd to the boss challenge —
              filter by difficulty in the practice library.
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-term-green transition group-hover:translate-x-1">
            Open the library →
          </span>
        </Link>
      </RevealSection>

      {/* theory primer */}
      <RevealSection id="theory" className="mt-14">
        <hr className="hairline mb-10" />
        <p className="overline" style={{ "--overline-color": "#58a6ff" } as CSSProperties}>
          02 — Theory before practice
        </p>
        <h2
          className="mt-3 font-display font-semibold text-term-text"
          style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", letterSpacing: "-0.02em", lineHeight: 1.15 }}
        >
          Theory <span className="text-gradient">before practice</span>
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-term-muted">
          The minimum theory behind CLI, file-management and git questions — click a card to expand
          it, then jump straight into the matching problem.
        </p>
        <div className="mt-5">
          <TheoryNotes />
        </div>
      </RevealSection>

      {/* feature strip */}
      <RevealSection className="mt-14">
        <hr className="hairline mb-10" />
        <p className="overline" style={{ "--overline-color": "#a371f7" } as CSSProperties}>
          03 — Around the platform
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            {
              href: "/teacher",
              title: "Teacher console",
              body: "Author problems, quizzes and assignments. Students get a separate, locked-down view — the permission walls are real and enforced.",
              accent: "hover:border-term-violet/50",
              icon: "◈",
              iconColor: "text-term-violet",
            },
            {
              href: "/quiz",
              title: "Quizzes & assignments",
              body: "MCQ and short-answer rounds with instant auto-grading, for quick checks alongside terminal practice.",
              accent: "hover:border-term-violet/40",
              icon: "✦",
              iconColor: "text-term-violet",
            },
            {
              href: "/docs/embed",
              title: "Drop-in integration",
              body: "One iframe plus a tiny postMessage API. Marks flow back to your LMS against your own student IDs.",
              accent: "hover:border-term-violet/40",
              icon: "⌗",
              iconColor: "text-term-violet",
            },
          ].map((f, i) => (
            <Link
              key={f.href}
              href={f.href}
              className={`card reveal-item shine hover-lift group p-5 ${f.accent}`}
              style={{ "--i": i } as CSSProperties}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-term-border bg-term-raise font-mono text-base ${f.iconColor}`}
              >
                {f.icon}
              </div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-term-muted">{f.body}</p>
              <span className="mt-3 inline-block text-xs text-term-violet opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100">
                Open →
              </span>
            </Link>
          ))}
        </div>
      </RevealSection>

      <footer className="mt-16 flex flex-col items-center gap-2 border-t border-term-border pt-6 text-center text-xs text-term-muted sm:flex-row sm:justify-between sm:text-left">
        <span>Terminal Trainer — simulated shell, graded practice, embeddable anywhere.</span>
        <span className="flex items-center gap-1.5">
          <span className="animate-pulse-glow inline-block h-1.5 w-1.5 rounded-full bg-term-green" />
          all systems simulated
        </span>
      </footer>
    </main>
  );
}
