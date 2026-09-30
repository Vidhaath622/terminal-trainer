import Link from "next/link";
import GithubAuthButton from "@/components/GithubAuthButton";
import AuthErrorToast from "@/components/AuthErrorToast";
import ProblemsCatalog from "@/components/ProblemsCatalog";
import TheoryNotes from "@/components/TheoryNotes";
import CommandReferenceSection from "@/components/CommandReference";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import { maxMarks } from "@/engine/grader";

export default function Home() {
  const totalSteps = LAUNCH_PROBLEMS.reduce((s, p) => s + p.steps.length, 0);
  const totalMarks = LAUNCH_PROBLEMS.reduce((s, p) => s + maxMarks(p), 0);

  return (
    <main className="relative mx-auto max-w-6xl px-6 pb-16 pt-10">
      <AuthErrorToast />
      {/* ambient orbs + blueprint grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
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

        <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Master the <span className="text-gradient">Linux terminal</span>, one graded step at a
          time.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-term-muted">
          A simulated shell with pipes, redirection and permissions. Every step is auto-graded for
          marks, every problem ships with test-case verification — no setup, no risk, runs entirely
          in your browser.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/play/pwd-navigate"
            className="shine rounded-lg bg-term-green/15 px-5 py-2.5 text-sm font-semibold text-term-green ring-1 ring-term-green/30 transition hover:bg-term-green/25 hover:shadow-glow"
          >
            Start practicing →
          </Link>
          <Link
            href="/docs/embed"
            className="shine rounded-lg border border-term-border glass px-5 py-2.5 text-sm font-semibold text-term-text transition hover:border-term-blue/50 hover:text-term-blue"
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

        {/* hero terminal mock */}
        <div className="relative mt-12 max-w-3xl">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-term-green/15 via-term-blue/10 to-term-violet/15 blur-2xl"
          />
          <div className="glass scanlines overflow-hidden rounded-xl shadow-card relative">
            {/* window chrome */}
            <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 font-mono text-[11px] text-term-muted">
                student@trainer: ~
              </span>
            </div>
            <div className="space-y-1.5 px-5 py-4 font-mono text-[13px] leading-relaxed">
              <div className="animate-pulse-glow">
                <span className="text-term-green">student@trainer</span>
                <span className="text-term-muted">:</span>
                <span className="text-term-blue">~</span>
                <span className="text-term-muted">$ </span>
                <span className="text-term-text">grep -c ERROR app.log</span>
              </div>
              <div className="text-term-text/90">3</div>
              <div>
                <span className="text-term-green">student@trainer</span>
                <span className="text-term-muted">:</span>
                <span className="text-term-blue">~</span>
                <span className="text-term-muted">$ </span>
                <span className="text-term-text">chmod 600 secret.txt && echo done</span>
              </div>
              <div className="text-term-green">done</div>
              <div className="flex items-center gap-1">
                <span className="text-term-green">student@trainer</span>
                <span className="text-term-muted">:</span>
                <span className="text-term-blue">~</span>
                <span className="text-term-muted">$ </span>
                <span className="animate-pulse inline-block h-4 w-2 bg-term-green/80" />
              </div>
            </div>
          </div>
        </div>

        {/* stats strip */}
        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-term-border bg-term-border sm:grid-cols-4">
          {[
            ["9", "authored problems"],
            [String(totalSteps), "graded steps"],
            [String(totalMarks), "marks to earn"],
            ["24", "shell commands"],
          ].map(([value, label]) => (
            <div key={label} className="bg-term-panel px-4 py-3 transition hover:bg-term-raise">
              <dt className="font-mono text-xl font-semibold text-term-text transition hover:text-term-green">
                {value}
              </dt>
              <dd className="text-xs text-term-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* catalog */}
      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Practice <span className="text-gradient">problems</span>
            </h2>
            <p className="mt-1 text-sm text-term-muted">
              Progress and marks are saved in your browser as you go.
            </p>
          </div>
        </div>
        <ProblemsCatalog />
      </section>

      {/* command library */}
      <section id="commands" className="mt-14">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Command <span className="text-gradient">library</span>
            </h2>
            <p className="mt-1 text-sm text-term-muted">
              What each command does and one runnable example — skim this before attempting the
              questions. Copy an example straight into the terminal to try it.
            </p>
          </div>
        </div>
        <CommandReferenceSection />
      </section>

      {/* theory primer */}
      <section id="theory" className="mt-14">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Theory <span className="text-gradient">before practice</span>
            </h2>
            <p className="mt-1 text-sm text-term-muted">
              The minimum theory behind CLI, file-management and git questions — click a card to
              expand it, then jump straight into the matching problem.
            </p>
          </div>
        </div>
        <TheoryNotes />
      </section>

      {/* feature strip */}
      <section className="mt-14 grid gap-4 sm:grid-cols-3">
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
            accent: "hover:border-term-yellow/50",
            icon: "✦",
            iconColor: "text-term-yellow",
          },
          {
            href: "/docs/embed",
            title: "Drop-in integration",
            body: "One iframe plus a tiny postMessage API. Marks flow back to your LMS against your own student IDs.",
            accent: "hover:border-term-blue/50",
            icon: "⌗",
            iconColor: "text-term-blue",
          },
        ].map((f) => (
          <Link key={f.href} href={f.href} className={`card shine group p-5 transition ${f.accent}`}>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-term-border bg-term-raise font-mono text-base ${f.iconColor}`}
            >
              {f.icon}
            </div>
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-term-muted">{f.body}</p>
            <span className="mt-3 inline-block text-xs text-term-blue opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100">
              Open →
            </span>
          </Link>
        ))}
      </section>

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
