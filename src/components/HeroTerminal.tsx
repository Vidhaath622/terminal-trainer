/**
 * HeroTerminal: a static terminal mock for the homepage. Flat panel with the
 * browser's own terminal colors; the only motion is the cursor blink.
 */
export default function HeroTerminal() {
  return (
    <div className="overflow-hidden rounded-md border border-term-border bg-[#0a0e14]">
      <div className="flex items-center gap-2 border-b border-term-border bg-term-panel px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[11px] text-term-muted">student@trainer: ~</span>
      </div>
      <div
        className="space-y-1.5 px-5 py-4 font-mono text-[13px] leading-relaxed"
        aria-label="Terminal demo: grep -c ERROR app.log prints 3"
      >
        <div>
          <span className="text-term-green">student@trainer</span>
          <span className="text-term-muted">:</span>
          <span className="text-term-blue">~</span>
          <span className="text-term-muted">$ </span>
          <span className="text-term-text">grep -c ERROR app.log</span>
          <span
            className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-term-green/80"
            aria-hidden
          />
        </div>
        <div className="text-term-text/90">3</div>
        <div>
          <span className="text-term-green">student@trainer</span>
          <span className="text-term-muted">:</span>
          <span className="text-term-blue">~</span>
          <span className="text-term-muted">$ </span>
          <span className="text-term-text">chmod 600 secret.txt</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-term-green">student@trainer</span>
          <span className="text-term-muted">:</span>
          <span className="text-term-blue">~</span>
          <span className="text-term-muted">$ </span>
          <span className="inline-block h-4 w-2 bg-term-green/80" aria-hidden />
        </div>
      </div>
    </div>
  );
}
