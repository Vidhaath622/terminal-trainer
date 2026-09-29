"use client";

/**
 * ProblemsCatalog: grid of the launch problems with difficulty and marks.
 */
import Link from "next/link";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import { maxMarks } from "@/engine/grader";

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: "text-term-green border-term-green/40 bg-term-green/10",
  medium: "text-term-yellow border-term-yellow/40 bg-term-yellow/10",
  hard: "text-term-red border-term-red/40 bg-term-red/10",
};

const DIFFICULTY_DOT: Record<string, string> = {
  easy: "bg-term-green",
  medium: "bg-term-yellow",
  hard: "bg-term-red",
};

const DIFFICULTY_GLOW: Record<string, string> = {
  easy: "hover:shadow-glow",
  medium: "hover:border-term-yellow/40 hover:shadow-[0_0_32px_-8px_rgba(210,153,34,0.35)]",
  hard: "hover:border-term-red/40 hover:shadow-[0_0_32px_-8px_rgba(248,81,73,0.35)]",
};

export default function ProblemsCatalog() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {LAUNCH_PROBLEMS.map((p, idx) => (
        <Link
          key={p.id}
          href={`/play/${p.id}`}
          className={`card shine group relative flex flex-col p-5 transition duration-200 hover:-translate-y-1 hover:bg-term-raise/60 ${DIFFICULTY_GLOW[p.difficulty]}`}
          data-testid={`problem-card-${p.id}`}
        >
          {/* corner glint */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-term-blue/10 blur-2xl transition group-hover:bg-term-blue/20"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-term-muted transition group-hover:text-term-blue">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${DIFFICULTY_STYLE[p.difficulty]}`}
            >
              {p.difficulty}
            </span>
          </div>

          <h3 className="mt-3 font-semibold leading-snug transition group-hover:text-term-blue">
            {p.title}
          </h3>
          <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-term-muted">
            {p.brief}
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-term-border pt-3 text-[11px] text-term-muted">
            <span className="flex items-center gap-1.5">
              <span className="flex items-center gap-1">
                {p.steps.slice(0, 5).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-transform duration-300 group-hover:scale-125 ${DIFFICULTY_DOT[p.difficulty]}`}
                    style={{ transitionDelay: `${i * 40}ms` }}
                  />
                ))}
              </span>
              <span className="ml-1">{p.steps.length} steps</span>
            </span>
            <span className="font-mono transition group-hover:text-term-text">
              {maxMarks(p)} marks
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
