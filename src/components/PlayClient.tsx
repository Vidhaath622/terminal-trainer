"use client";

/**
 * Client body of the /play/[id] page (kept separate so the page can be
 * statically exported with generateStaticParams).
 */
import ProblemPlayer from "@/components/ProblemPlayer";
import { getLaunchProblem, LAUNCH_PROBLEMS } from "@/problems/launch";

export default function PlayClient({ id }: { id: string }) {
  const problem = getLaunchProblem(id);

  if (!problem) {
    return (
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
        <h1 className="text-xl font-bold">Problem not found</h1>
        <p className="mt-2 text-sm text-term-muted">No problem with id &quot;{id}&quot;.</p>
        <ul className="mt-5 space-y-1.5 text-sm">
          {LAUNCH_PROBLEMS.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="text-term-muted">·</span> {p.title}
              <code className="rounded bg-term-panel px-1.5 py-0.5 text-xs text-term-muted">{p.id}</code>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="relative h-screen p-2 sm:p-3">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid" />
      <ProblemPlayer problem={problem} />
    </main>
  );
}
