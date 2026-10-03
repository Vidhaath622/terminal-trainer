"use client";

/**
 * ProblemLibrary: browsable library of problems with search and a
 * "Sort Problems" dropdown for difficulty (All / Easy / Medium / Hard). The
 * collapsed button never shows counts -- the counts live only inside the
 * open menu, next to each difficulty option. Each card shows the difficulty
 * badge, brief, a "first task" peek at step 1, tags, step count and total
 * marks, and links into /play/[id].
 *
 * Defaults to every launch problem; pass `problems` to show a subset (the
 * /git-problems page does this) without duplicating card markup.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LAUNCH_PROBLEMS } from "@/problems/launch";
import { maxMarks } from "@/engine/grader";
import type { Problem } from "@/engine/schema";

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: "text-term-green border-term-green/40 bg-term-green/10",
  medium: "text-term-yellow border-term-yellow/40 bg-term-yellow/10",
  hard: "text-term-red border-term-red/40 bg-term-red/10",
};

/** Text colour for a difficulty label inside the sort menu. */
const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  easy: "text-term-green",
  medium: "text-term-yellow",
  hard: "text-term-red",
};

export default function ProblemLibrary({ problems = LAUNCH_PROBLEMS }: { problems?: Problem[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close the sort menu on outside click or Escape.
  useEffect(() => {
    if (!sortOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sortOpen]);

  const counts = useMemo(() => {
    const c: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const p of problems) c[p.difficulty as Difficulty] += 1;
    return c;
  }, [problems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      if (difficulty !== "All" && p.difficulty !== difficulty) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.brief.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, difficulty, problems]);

  return (
    <div data-testid="problem-library">
      {/* controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems"
            aria-label="Search problems"
            data-testid="problem-search"
            className="w-full rounded border border-term-border bg-term-panel px-3 py-2 font-mono text-sm text-term-text placeholder:text-term-muted/60 focus:border-term-green/60 focus:outline-none sm:w-64"
          />
        </div>
        {/* Sort dropdown: counts live only inside the open menu */}
        <div className="relative self-start sm:self-auto" ref={sortRef}>
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            data-testid="problem-sort-toggle"
            className={`flex items-center gap-2 rounded border px-3 py-2 font-mono text-xs font-medium capitalize transition-colors ${
              difficulty === "All"
                ? "border-term-border bg-term-panel text-term-muted hover:text-term-text"
                : "border-term-green/50 bg-term-green/15 text-term-green"
            }`}
          >
            Sort Problems
            {difficulty !== "All" && <span className="text-term-green/90">· {difficulty}</span>}
            <span aria-hidden="true" className={`text-[10px] leading-none transition-transform ${sortOpen ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>

          {sortOpen && (
            <div
              role="menu"
              aria-label="Sort problems by difficulty"
              data-testid="problem-sort-menu"
              className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded border border-term-border bg-term-panel py-1 shadow-lg"
            >
              {(["All", ...DIFFICULTY_ORDER] as const).map((d) => {
                const active = difficulty === d;
                const count = d === "All" ? problems.length : counts[d];
                return (
                  <button
                    key={d}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setDifficulty(d);
                      setSortOpen(false);
                    }}
                    data-testid={`problem-chip-${d.toLowerCase()}`}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left font-mono text-xs capitalize transition-colors ${
                      active ? "bg-term-green/15" : "text-term-text hover:bg-term-green/10"
                    }`}
                  >
                    <span className={active ? "text-term-green" : d === "All" ? "text-term-text" : DIFFICULTY_TEXT[d]}>{d}</span>
                    <span className={active ? "text-term-green" : "text-term-muted"}>({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <p className="rounded border border-term-border bg-term-panel p-6 text-center text-sm text-term-muted">
          No problems match “{query}”. Try a shorter search, or browse the{" "}
          <Link href="/commands" className="text-term-blue underline-offset-2 hover:underline">
            command library
          </Link>{" "}
          to learn the tools first.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const difficulty = p.difficulty as Difficulty;
            const firstStep = p.steps[0];
            return (
              <li key={p.id}>
                <Link
                  href={`/play/${p.id}`}
                  className="card flex h-full flex-col p-5 hover:border-term-green/60"
                  data-testid={`problem-card-${p.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-term-muted">
                      {p.steps.length} steps
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${DIFFICULTY_STYLE[difficulty]}`}
                    >
                      {p.difficulty}
                    </span>
                  </div>

                  <h3 className="mt-3 font-semibold leading-snug text-term-text">
                    {p.title}
                  </h3>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-term-muted">{p.brief}</p>

                  {/* first-task peek */}
                  {firstStep && (
                    <div className="mt-3 rounded border border-term-border bg-[#0a0e14] p-2.5">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-term-muted">
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
                          className="rounded border border-term-border bg-term-panel px-1.5 py-0.5 font-mono text-[10px] text-term-muted"
                        >
                          {t}
                        </span>
                      ))}
                      {p.tags.length > 6 && (
                        <span className="px-1 py-0.5 font-mono text-[10px] text-term-muted">
                          +{p.tags.length - 6}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 border-t border-term-border pt-3 font-mono text-[11px] text-term-muted">
                    {maxMarks(p)} marks
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
