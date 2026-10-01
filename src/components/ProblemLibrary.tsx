"use client";

/**
 * ProblemLibrary: browsable library of every launch problem with search and
 * difficulty filter chips (All / Easy / Medium / Hard). Mirrors the command
 * library pattern (CommandReference.tsx) but for practice problems: each card
 * shows the difficulty badge, brief, a "first task" peek at step 1, tags,
 * step count and total marks, and links into /play/[id].
 */
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import { maxMarks } from "@/engine/grader";
import { useReveal } from "@/lib/useReveal";

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: "text-term-green border-term-green/40 bg-term-green/10",
  medium: "text-term-yellow border-term-yellow/40 bg-term-yellow/10",
  hard: "text-term-red border-term-red/40 bg-term-red/10",
};

const DIFFICULTY_DOT: Record<Difficulty, string> = {
  easy: "bg-term-green",
  medium: "bg-term-yellow",
  hard: "bg-term-red",
};

const DIFFICULTY_GLOW: Record<Difficulty, string> = {
  easy: "hover:border-term-green/50",
  medium: "hover:border-term-yellow/40",
  hard: "hover:border-term-red/40",
};

export default function ProblemLibrary() {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const { ref, shown } = useReveal<HTMLDivElement>();

  const counts = useMemo(() => {
    const c: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const p of LAUNCH_PROBLEMS) c[p.difficulty as Difficulty] += 1;
    return c;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LAUNCH_PROBLEMS.filter((p) => {
      if (difficulty !== "All" && p.difficulty !== difficulty) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.brief.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, difficulty]);

  return (
    <div data-testid="problem-library" ref={ref} className={`reveal-group ${shown ? "reveal-shown" : "reveal-pending"}`}>
      {/* controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems…"
            aria-label="Search problems"
            data-testid="problem-search"
            className="w-full rounded-lg border border-term-border bg-term-panel px-3 py-2 text-sm text-term-text placeholder:text-term-muted/60 focus:border-term-blue/60 focus:outline-none focus:ring-1 focus:ring-term-blue/40 sm:w-64"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["All", ...DIFFICULTY_ORDER] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                difficulty === d
                  ? "border-term-green/50 bg-term-green/15 text-term-green"
                  : "border-term-border bg-term-panel text-term-muted hover:text-term-text"
              }`}
              data-testid={`problem-chip-${d.toLowerCase()}`}
            >
              {d === "All" ? `All (${LAUNCH_PROBLEMS.length})` : `${d} (${counts[d]})`}
            </button>
          ))}
        </div>
      </div>

      {/* grid */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-term-border bg-term-panel p-6 text-center text-sm text-term-muted">
          No problems match “{query}”. Try a shorter search, or browse the{" "}
          <Link href="/commands" className="text-term-blue underline-offset-2 hover:underline">
            command library
          </Link>{" "}
          to learn the tools first.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, idx) => {
            const difficulty = p.difficulty as Difficulty;
            const firstStep = p.steps[0];
            return (
              <Link
                key={p.id}
                href={`/play/${p.id}`}
                className={`card reveal-item shine group relative flex flex-col p-5 hover-lift hover:bg-term-raise/60 ${DIFFICULTY_GLOW[difficulty]}`}
                style={{ "--i": Math.min(idx, 11) } as CSSProperties}
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
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${DIFFICULTY_STYLE[difficulty]}`}
                  >
                    {p.difficulty}
                  </span>
                </div>

                <h3 className="mt-3 font-semibold leading-snug transition group-hover:text-term-blue">
                  {p.title}
                </h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-term-muted">{p.brief}</p>

                {/* first-task peek */}
                {firstStep && (
                  <div className="mt-3 rounded-lg border border-term-border bg-[#0a0e14] p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-term-muted">
                      First task
                    </p>
                    <p className="mt-1 line-clamp-2 font-mono text-[11px] leading-relaxed text-term-text/90">
                      {firstStep.prompt}
                    </p>
                  </div>
                )}

                {/* tags */}
                {p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.tags.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="rounded border border-term-border bg-term-panel px-1.5 py-0.5 font-mono text-[10px] text-term-muted transition group-hover:text-term-text/80"
                      >
                        {t}
                      </span>
                    ))}
                    {p.tags.length > 6 && (
                      <span className="px-1 py-0.5 text-[10px] text-term-muted">
                        +{p.tags.length - 6}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-term-border pt-3 text-[11px] text-term-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1">
                      {p.steps.slice(0, 5).map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 w-1.5 rounded-full transition-transform duration-300 group-hover:scale-125 ${DIFFICULTY_DOT[difficulty]}`}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
