import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import HeroTerminal from "@/components/HeroTerminal";
import TheoryNotes from "@/components/TheoryNotes";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import { commandNames } from "@/engine/commands";
import { maxMarks } from "@/engine/grader";

export default function Home() {
  const totalSteps = LAUNCH_PROBLEMS.reduce((s, p) => s + p.steps.length, 0);
  const totalMarks = LAUNCH_PROBLEMS.reduce((s, p) => s + maxMarks(p), 0);
  const firstProblem = LAUNCH_PROBLEMS[0];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <section>
          <h1 className="max-w-4xl font-mono text-4xl font-bold leading-tight tracking-tight text-term-text sm:text-5xl">
            Practice Linux commands in a simulated terminal
          </h1>
          <p className="prose-body mt-4 text-base text-term-muted">
            Every problem runs in a simulated shell with pipes, redirection, and
            permissions. Each step is auto-graded for marks, and every problem
            ships with a machine-verified solution. Nothing to install; it runs
            in the browser.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/play/${firstProblem.id}`}
              className="rounded bg-term-green/15 px-5 py-2.5 font-mono text-sm font-semibold text-term-green ring-1 ring-term-green/30 hover:ring-term-green/60"
            >
              Start practicing
            </Link>
            <Link
              href="/problems"
              className="rounded border border-term-border bg-term-panel px-5 py-2.5 font-mono text-sm font-semibold text-term-text hover:border-term-green/60"
            >
              Browse problems
            </Link>
          </div>

          <div className="mt-10 max-w-3xl">
            <HeroTerminal />
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded border border-term-border bg-term-border sm:grid-cols-4">
            {[
              [LAUNCH_PROBLEMS.length, "authored problems"],
              [totalSteps, "graded steps"],
              [totalMarks, "marks to earn"],
              [commandNames().length, "shell commands"],
            ].map(([value, label]) => (
              <div key={label as string} className="bg-term-panel px-4 py-3">
                <dt className="font-mono text-xl font-semibold text-term-text">{value}</dt>
                <dd className="text-xs text-term-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14">
          <h2 className="font-mono text-xl font-semibold text-term-text">
            Practice problems
          </h2>
          <p className="prose-body mt-2 text-sm text-term-muted">
            {LAUNCH_PROBLEMS.length} graded problems, from your first pwd to a
            boss challenge. Filter by difficulty in the{" "}
            <Link href="/problems" className="text-term-blue hover:underline">
              problem library
            </Link>
            .
          </p>
          <ul className="mt-5 divide-y divide-term-border rounded-md border border-term-border bg-term-panel">
            {LAUNCH_PROBLEMS.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/play/${p.id}`}
                  className="flex flex-col gap-1 p-4 hover:bg-term-raise/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-term-text">{p.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-term-muted">
                      {p.brief}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-term-muted">
                    {p.difficulty}, {p.steps.length} steps, {maxMarks(p)} marks
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-term-muted">
            <Link href="/problems" className="text-term-blue hover:underline">
              See all {LAUNCH_PROBLEMS.length} problems
            </Link>
          </p>
        </section>

        <section id="theory" className="mt-14">
          <h2 className="font-mono text-xl font-semibold text-term-text">
            Theory before practice
          </h2>
          <p className="prose-body mt-2 text-sm text-term-muted">
            The minimum theory behind CLI, file-management, and git questions.
            Click a card to expand it, then jump into the matching problem.
          </p>
          <div className="mt-5">
            <TheoryNotes />
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-mono text-xl font-semibold text-term-text">
            Around the platform
          </h2>
          <ul className="mt-5 space-y-3">
            <li>
              <Link
                href="/teacher"
                className="card block p-5 hover:border-term-green/60"
              >
                <h3 className="font-mono font-semibold text-term-text">Teacher console</h3>
                <p className="prose-body mt-1 text-sm text-term-muted">
                  Author problems, quizzes, and assignments. Students get a
                  separate, locked-down view; the permission rules are enforced
                  by capability checks in the content store.
                </p>
              </Link>
            </li>
            <li>
              <Link
                href="/quiz"
                className="card block p-5 hover:border-term-green/60"
              >
                <h3 className="font-mono font-semibold text-term-text">Quizzes and assignments</h3>
                <p className="prose-body mt-1 text-sm text-term-muted">
                  Multiple-choice and short-answer rounds with instant
                  auto-grading, for quick checks alongside terminal practice.
                </p>
              </Link>
            </li>
            <li>
              <Link
                href="/docs/embed"
                className="card block p-5 hover:border-term-green/60"
              >
                <h3 className="font-mono font-semibold text-term-text">Embed in your site</h3>
                <p className="prose-body mt-1 text-sm text-term-muted">
                  One iframe plus a small postMessage API. Marks flow back to
                  your LMS against your own student IDs.
                </p>
              </Link>
            </li>
          </ul>
        </section>

        <footer className="mt-16 border-t border-term-border pt-6 text-sm text-term-muted">
          <p>
            Terminal Trainer: a simulated shell with graded practice, embeddable
            anywhere.
          </p>
        </footer>
      </main>
    </>
  );
}
