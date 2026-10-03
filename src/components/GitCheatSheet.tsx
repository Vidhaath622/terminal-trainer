/**
 * GitCheatSheet: the "Git fundamentals" wall chart, rendered from the data
 * in @/lib/git-cheatsheet. Shown at the bottom of the /git-problems page.
 * Entries flagged simulated: false render dimmed with a "not simulated"
 * badge — real Git commands this simulator can't reproduce faithfully.
 */
import { GIT_BRANCH_FLOW, GIT_CHEAT_FLOW, GIT_CHEAT_SHEET } from "@/lib/git-cheatsheet";

type Flow = {
  boxes: readonly string[];
  subtitles: readonly string[];
  steps: readonly string[];
};

/** The three-box flow diagram: boxes joined by labeled arrows. */
function FlowRow({ flow }: { flow: Flow }) {
  return (
    <div className="mt-4 flex flex-col items-stretch gap-2 rounded-md border border-term-border bg-term-panel p-4 sm:flex-row sm:items-center">
      {flow.boxes.map((box, i) => (
        <div key={box} className="contents">
          <div className="flex-1 rounded border border-term-border bg-term-bg/60 px-4 py-3 text-center">
            <p className="font-mono text-sm font-semibold text-term-text">{box}</p>
            <p className="mt-0.5 text-xs text-term-muted">{flow.subtitles[i]}</p>
          </div>
          {i < flow.steps.length && (
            <div className="flex items-center justify-center gap-2 py-1 sm:w-28 sm:flex-col sm:py-0">
              <span className="rounded bg-term-green/10 px-2 py-0.5 font-mono text-xs text-term-green ring-1 ring-term-green/30">
                {flow.steps[i]}
              </span>
              <span aria-hidden className="text-term-muted sm:hidden">
                ↓
              </span>
              <span aria-hidden className="hidden text-term-muted sm:inline">
                →
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function GitCheatSheet() {
  // The sheet carries both charts; the branching chart starts at "See the branches".
  const split = GIT_CHEAT_SHEET.findIndex((s) => s.title === "See the branches");
  const basics = GIT_CHEAT_SHEET.slice(0, split < 0 ? undefined : split);
  const branching = split < 0 ? [] : GIT_CHEAT_SHEET.slice(split);

  const renderSections = (sections: typeof GIT_CHEAT_SHEET) => (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {sections.map((section) => (
        <div key={section.title} className="card p-5">
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-term-text">
            {section.title}
          </h3>
          <ul className="mt-3 space-y-2.5">
            {section.entries.map((entry) => (
              <li key={entry.cmd} className={entry.simulated === false ? "opacity-60" : undefined}>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-term-panel px-1.5 py-0.5 font-mono text-[11px] text-term-green">
                    {entry.cmd}
                  </code>
                  {entry.simulated === false && (
                    <span className="rounded border border-term-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-term-muted">
                      not simulated
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-term-muted">{entry.note}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <h2 className="font-mono text-xl font-semibold text-term-text">
        Git fundamentals cheat sheet
      </h2>
      <p className="prose-body mt-1 text-sm text-term-muted">
        <code className="font-mono text-term-green">&lt;value&gt;</code> means fill it
        in. <code className="font-mono text-term-green">[option]</code> means optional.
        Every command below runs in the simulator except where marked.
      </p>

      {/* the three areas and what moves changes between them */}
      <FlowRow flow={GIT_CHEAT_FLOW} />

      {/* command groups */}
      {renderSections(basics)}

      {/* the branching chart: its own flow and command groups */}
      <h2 className="mt-8 font-mono text-xl font-semibold text-term-text">
        Git branching and merging cheat sheet
      </h2>
      <p className="prose-body mt-1 text-sm text-term-muted">
        Branch off, commit your work, then merge it back — every command below
        runs in the simulator.
      </p>
      <FlowRow flow={GIT_BRANCH_FLOW} />
      {renderSections(branching)}
    </div>
  );
}
