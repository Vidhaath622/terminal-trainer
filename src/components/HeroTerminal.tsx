"use client";

/**
 * HeroTerminal: the hero's terminal mock, typing itself. Types the command
 * character-by-character with a blinking block cursor, fades in the output
 * and the next prompt line, pauses, then loops. Honors prefers-reduced-motion
 * by rendering the fully-typed state immediately (decided on mount, so SSR
 * and the first client render agree).
 */
import { useEffect, useState } from "react";

const COMMAND = "grep -c ERROR app.log";
const OUTPUT = "3";
const NEXT_PROMPT = "chmod 600 secret.txt && echo done";
const NEXT_OUTPUT = "done";
const TYPE_MS = 65;
const AFTER_COMMAND_MS = 500;
const AFTER_OUTPUT_MS = 700;
const AFTER_SECOND_MS = 2400;
const RESTART_MS = 3600;

export default function HeroTerminal() {
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<"typing" | "output" | "second" | "hold">("typing");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setTyped(COMMAND.length);
      setPhase("hold");
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    if (typed < COMMAND.length) {
      t = setTimeout(() => {
        setTyped((n) => n + 1);
        setPhase("typing");
      }, TYPE_MS);
    } else if (phase === "typing") {
      t = setTimeout(() => setPhase("output"), AFTER_COMMAND_MS);
    } else if (phase === "output") {
      t = setTimeout(() => setPhase("second"), AFTER_OUTPUT_MS);
    } else if (phase === "second") {
      t = setTimeout(() => setPhase("hold"), AFTER_SECOND_MS);
    } else {
      t = setTimeout(() => {
        setTyped(0);
        setPhase("typing");
      }, RESTART_MS);
    }
    return () => clearTimeout(t);
  }, [typed, phase]);

  const done = phase !== "typing" || reduced;
  const shownText = COMMAND.slice(0, reduced ? COMMAND.length : typed);

  return (
    <div className="glass scanlines overflow-hidden rounded-xl shadow-card relative border-beam">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[11px] text-term-muted">student@trainer: ~</span>
      </div>
      <div
        className="space-y-1.5 px-5 py-4 font-mono text-[13px] leading-relaxed"
        aria-label={`Terminal demo: ${COMMAND} → ${OUTPUT}`}
      >
        <div>
          <span className="text-term-green">student@trainer</span>
          <span className="text-term-muted">:</span>
          <span className="text-term-blue">~</span>
          <span className="text-term-muted">$ </span>
          <span className="text-term-text">{shownText}</span>
          <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-term-green/80" aria-hidden />
        </div>
        <div className={`text-term-text/90 transition-opacity duration-500 ${done ? "opacity-100" : "opacity-0"}`}>
          {OUTPUT}
        </div>
        <div
          className={`transition-opacity duration-500 ${phase === "second" || phase === "hold" ? "opacity-100" : "opacity-0"}`}
        >
          <span className="text-term-green">student@trainer</span>
          <span className="text-term-muted">:</span>
          <span className="text-term-blue">~</span>
          <span className="text-term-muted">$ </span>
          <span className="text-term-text">{NEXT_PROMPT}</span>
        </div>
        <div className={`text-term-green transition-opacity duration-500 ${phase === "hold" ? "opacity-100" : "opacity-0"}`}>
          {NEXT_OUTPUT}
        </div>
        <div className={`flex items-center gap-1 transition-opacity duration-500 ${phase === "hold" ? "opacity-100" : "opacity-0"}`}>
          <span className="text-term-green">student@trainer</span>
          <span className="text-term-muted">:</span>
          <span className="text-term-blue">~</span>
          <span className="text-term-muted">$ </span>
          <span className="animate-pulse inline-block h-4 w-2 bg-term-green/80" />
        </div>
      </div>
    </div>
  );
}
