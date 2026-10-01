"use client";

/**
 * CommandReference: browsable library of every simulated shell command with a
 * one-line explanation and a runnable example. Search box filters by name or
 * text; category chips narrow the grid. Examples are one-click copy.
 */
import { useMemo, useState, type CSSProperties } from "react";
import { COMMAND_REFERENCE, COMMAND_CATEGORIES, type CommandCategory } from "@/lib/commandReference";
import { useReveal } from "@/lib/useReveal";

const CATEGORY_ACCENT: Record<CommandCategory, { icon: string; color: string }> = {
  Filesystem: { icon: "▤", color: "text-term-yellow" },
  Text: { icon: "≡", color: "text-term-blue" },
  Session: { icon: "◷", color: "text-term-green" },
  Operators: { icon: "|", color: "text-term-violet" },
};

/** Render `backtick` spans as inline code chips. */
function renderInline(text: string) {
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <code key={i} className="rounded bg-term-panel px-1 font-mono text-[11px] text-term-green">
        {part}
      </code>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable
    }
  };
  return (
    <button
      onClick={copy}
      className="shrink-0 rounded-md border border-term-border bg-term-panel px-1.5 py-0.5 text-[10px] font-medium text-term-muted transition hover:text-term-green"
      data-testid="copy-example"
      title="Copy example"
    >
      {copied ? "✓" : "copy"}
    </button>
  );
}

export default function CommandReferenceSection() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CommandCategory | "All">("All");
  const { ref, shown } = useReveal<HTMLDivElement>();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMMAND_REFERENCE.filter((c) => {
      if (category !== "All" && c.category !== category) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.example.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  return (
    <div data-testid="command-library" ref={ref} className={`reveal-group ${shown ? "reveal-shown" : "reveal-pending"}`}>
      {/* controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            aria-label="Search commands"
            data-testid="command-search"
            className="w-full rounded-lg border border-term-border bg-term-panel px-3 py-2 text-sm text-term-text placeholder:text-term-muted/60 focus:border-term-blue/60 focus:outline-none focus:ring-1 focus:ring-term-blue/40 sm:w-64"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["All", ...COMMAND_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                category === c
                  ? "border-term-green/50 bg-term-green/15 text-term-green"
                  : "border-term-border bg-term-panel text-term-muted hover:text-term-text"
              }`}
              data-testid={`command-chip-${c.toLowerCase()}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* grid */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-term-border bg-term-panel p-6 text-center text-sm text-term-muted">
          No commands match “{query}”. Try a shorter search, or type <code>help</code> in the
          terminal.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, idx) => {
            const accent = CATEGORY_ACCENT[c.category];
            return (
              <article
                key={c.name}
                className={`card reveal-item flex flex-col p-4 hover-lift hover:bg-term-raise/40 ${
                  c.category === "Session" ? "hover:border-term-green/50" : ""
                }`}
                style={{ "--i": Math.min(idx, 11) } as CSSProperties}
                data-testid={`command-card-${c.name === "| (pipe)" ? "pipe" : c.name.replace(/[^a-z]/gi, "")}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-sm font-bold text-term-green">{c.name}</code>
                  <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${accent.color}`}>
                    <span aria-hidden>{accent.icon}</span> {c.category}
                  </span>
                </div>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-term-text/85">{renderInline(c.summary)}</p>
                <div className="mt-3 rounded-lg border border-term-border bg-[#0a0e14] p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <code className="min-w-0 break-all font-mono text-[11px] leading-relaxed text-term-text/90">
                      <span className="text-term-muted">$ </span>
                      {c.example}
                    </code>
                    <CopyButton text={c.example} />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-term-muted">{renderInline(c.exampleNote)}</p>
                </div>
                {c.caution && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-term-yellow/90">
                    <span aria-hidden>⚠</span> {c.caution}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
