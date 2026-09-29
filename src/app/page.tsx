import Link from "next/link";
import ProblemsCatalog from "@/components/ProblemsCatalog";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import { maxMarks } from "@/engine/grader";

export default function Home() {
  const totalSteps = LAUNCH_PROBLEMS.reduce((s, p) => s + p.steps.length, 0);
  const totalMarks = LAUNCH_PROBLEMS.reduce((s, p) => s + maxMarks(p), 0);

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
      {/* hero */}
      <header className="animate-slideUp">
        <div className="inline-flex items-center gap-2 rounded-full border border-term-border bg-term-panel px-3 py-1 text-xs text-term-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-term-green opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-term-green" />
          </span>
          Built for first-year CS · embeds into any college site
        </div>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Master the <span className="text-gradient">Linux terminal</span>, one graded step at a time.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-term-muted">
          A simulated shell with pipes, redirection and permissions. Every step is auto-graded
          for marks, every problem ships with test-case verification — no setup, no risk, runs
          entirely in your browser.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/play/pwd-navigate"
            className="rounded-lg bg-term-green/15 px-5 py-2.5 text-sm font-semibold text-term-green ring-1 ring-term-green/30 transition hover:bg-term-green/25 hover:shadow-glow"
          >
            Start practicing →
          </Link>
          <Link
            href="/docs/embed"
            className="rounded-lg border border-term-border bg-term-panel px-5 py-2.5 text-sm font-semibold text-term-text transition hover:border-term-blue/50 hover:text-term-blue"
          >
            Embed in your site
          </Link>
        </div>

        {/* stats strip */}
        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-term-border bg-term-border sm:grid-cols-4">
          {[
            ["9", "authored problems"],
            [String(totalSteps), "graded steps"],
            [String(totalMarks), "marks to earn"],
            ["24", "shell commands"],
          ].map(([value, label]) => (
            <div key={label} className="bg-term-panel px-4 py-3">
              <dt className="font-mono text-xl font-semibold text-term-text">{value}</dt>
              <dd className="text-xs text-term-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* catalog */}
      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">Practice problems</h2>
            <p className="mt-1 text-sm text-term-muted">Progress and marks are saved in your browser as you go.</p>
          </div>
        </div>
        <ProblemsCatalog />
      </section>

      {/* feature strip */}
      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          {
            href: "/teacher",
            title: "Teacher console",
            body: "Author problems, quizzes and assignments. Students get a separate, locked-down view — the permission walls are real and enforced.",
            accent: "hover:border-term-violet/50",
          },
          {
            href: "/quiz",
            title: "Quizzes & assignments",
            body: "MCQ and short-answer rounds with instant auto-grading, for quick checks alongside terminal practice.",
            accent: "hover:border-term-yellow/50",
          },
          {
            href: "/docs/embed",
            title: "Drop-in integration",
            body: "One iframe plus a tiny postMessage API. Marks flow back to your LMS against your own student IDs.",
            accent: "hover:border-term-blue/50",
          },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`card group p-5 transition ${f.accent}`}
          >
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-term-muted">{f.body}</p>
            <span className="mt-3 inline-block text-xs text-term-blue opacity-0 transition group-hover:opacity-100">
              Open →
            </span>
          </Link>
        ))}
      </section>

      <footer className="mt-16 border-t border-term-border pt-6 text-xs text-term-muted">
        Terminal Trainer — simulated shell, graded practice, embeddable anywhere.
      </footer>
    </main>
  );
}
