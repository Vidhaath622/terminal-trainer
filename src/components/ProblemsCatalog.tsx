"use client";

/**
 * ProblemsCatalog: grid of the launch problems with difficulty and marks.
 */
import Link from "next/link";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import { maxMarks } from "@/engine/grader";

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: "text-term-green border-term-green/40",
  medium: "text-term-yellow border-term-yellow/40",
  hard: "text-term-red border-term-red/40",
};

export default function ProblemsCatalog() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {LAUNCH_PROBLEMS.map((p) => (
        <Link
          key={p.id}
          href={`/play/${p.id}`}
          className="rounded-lg border border-term-border bg-term-panel p-4 transition hover:border-term-blue/60"
          data-testid={`problem-card-${p.id}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{p.title}</h3>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${DIFFICULTY_STYLE[p.difficulty]}`}>
              {p.difficulty}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs text-term-text/60">{p.brief}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-term-text/50">
            <span>{p.steps.length} steps</span>
            <span>{maxMarks(p)} marks</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
