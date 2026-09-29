import Link from "next/link";
import ProblemsCatalog from "@/components/ProblemsCatalog";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Terminal Trainer</h1>
        <p className="mt-2 text-term-text/70">
          Practice Linux terminal commands with graded, step-by-step problems — built for first-year CS students.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Practice problems</h2>
        <ProblemsCatalog />
      </section>

      <section className="grid gap-3 text-sm sm:grid-cols-3">
        <Link href="/teacher" className="rounded border border-term-border bg-term-panel p-3 hover:border-term-blue/60">
          <strong>Teacher console</strong>
          <p className="mt-1 text-xs text-term-text/60">Author problems & quizzes; role-gated.</p>
        </Link>
        <Link href="/quiz" className="rounded border border-term-border bg-term-panel p-3 hover:border-term-blue/60">
          <strong>Quiz demo</strong>
          <p className="mt-1 text-xs text-term-text/60">Students answer; auto-graded.</p>
        </Link>
        <Link href="/docs/embed" className="rounded border border-term-border bg-term-panel p-3 hover:border-term-blue/60">
          <strong>Embed into your site</strong>
          <p className="mt-1 text-xs text-term-text/60">iframe + postMessage API for any college website.</p>
        </Link>
      </section>
    </main>
  );
}
