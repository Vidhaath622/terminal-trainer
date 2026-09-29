"use client";

import ProblemPlayer from "@/components/ProblemPlayer";
import { getLaunchProblem, LAUNCH_PROBLEMS } from "@/problems/launch";

export default function PlayPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const problem = getLaunchProblem(id);

  if (!problem) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-bold">Problem not found</h1>
        <p className="mt-2 text-sm text-term-text/70">No problem with id &quot;{id}&quot;.</p>
        <ul className="mt-4 space-y-1 text-sm">
          {LAUNCH_PROBLEMS.map((p) => (
            <li key={p.id}>• {p.title} <code className="text-term-text/50">{p.id}</code></li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="h-screen">
      <ProblemPlayer problem={problem} />
    </main>
  );
}
