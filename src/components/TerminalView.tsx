"use client";

/**
 * TerminalView: xterm.js UI bound to a Session.
 * Handles typing, history (Up/Down), Tab completion, Ctrl+C / Ctrl+L,
 * and renders command output with basic coloring.
 */
import { useEffect, useRef } from "react";
import type { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { Session } from "@/engine/session";
import { commandNames } from "@/engine/commands";

export interface TerminalViewProps {
  session: Session;
  /** bumps when the session is replaced (reset) so the terminal re-inits */
  sessionKey?: number;
}

const PROMPT_COLOR = "\x1b[38;5;71m";
const ERROR_COLOR = "\x1b[38;5;203m";
const RESET = "\x1b[0m";

function shortCwd(cwd: string, home: string): string {
  if (home !== "/" && (cwd === home || cwd.startsWith(home + "/"))) {
    return "~" + cwd.slice(home.length);
  }
  return cwd;
}

export default function TerminalView({ session, sessionKey = 0 }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const lineRef = useRef("");
  const historyIndexRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let term: Terminal | null = null;

    const promptText = () => `${session.shell.user}@trainer:${shortCwd(session.vfs.cwd, session.problem.fs.home)}$ `;

    const writePrompt = () => {
      term?.write(`\r\n${PROMPT_COLOR}${promptText()}${RESET}`);
    };

    const runLine = () => {
      if (!term) return;
      const line = lineRef.current;
      lineRef.current = "";
      historyIndexRef.current = null;
      term.write("\r\n");
      if (line.trim() !== "") {
        const result = session.run(line);
        if (result.stdout) term.write(result.stdout.replace(/\n/g, "\r\n"));
        if (result.error) term.write(`${ERROR_COLOR}${result.error}${RESET}\r\n`);
        if (result.cleared) term.clear();
      }
      writePrompt();
    };

    const complete = () => {
      if (!term) return;
      const line = lineRef.current;
      const parts = line.split(/\s+/);
      const last = parts[parts.length - 1] ?? "";
      let candidates: string[] = [];
      if (parts.length <= 1) {
        candidates = commandNames().filter((c) => c.startsWith(last));
      } else {
        // path completion in/under cwd
        const slash = last.lastIndexOf("/");
        const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
        const namePart = slash >= 0 ? last.slice(slash + 1) : last;
        try {
          const dirAbs = session.vfs.resolve(dirPart === "" ? "." : dirPart);
          if (session.vfs.isDir(dirAbs)) {
            candidates = session.vfs
              .listDir(dirAbs)
              .filter((n) => n.name.startsWith(namePart))
              .map((n) => dirPart + n.name + (n.kind === "directory" ? "/" : ""));
          }
        } catch {
          candidates = [];
        }
      }
      if (candidates.length === 1) {
        const completion = candidates[0].slice(last.length);
        if (completion) {
          lineRef.current += completion;
          term.write(completion);
        }
      } else if (candidates.length > 1) {
        // show options on a new line, then restore the prompt+line
        term.write(`\r\n${candidates.join("  ")}\r\n`);
        term.write(`${PROMPT_COLOR}${promptText()}${RESET}${lineRef.current}`);
      }
    };

    import("@xterm/xterm").then(({ Terminal: XTerm }) => {
      if (disposed || !containerRef.current) return;
      const t = new XTerm({
        cursorBlink: true,
        fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 14,
        lineHeight: 1.35,
        theme: {
          background: "#0a0e14",
          foreground: "#dbe4ee",
          cursor: "#3fb950",
          cursorAccent: "#0a0e14",
          selectionBackground: "rgba(88,166,255,0.3)",
          black: "#0a0e14",
          brightBlack: "#8b98a9",
          green: "#3fb950",
          brightGreen: "#56d364",
          blue: "#58a6ff",
          red: "#f85149",
          yellow: "#d29922",
        },
      });
      term = t;
      termRef.current = t;
      t.open(containerRef.current);
      t.write(`${PROMPT_COLOR}${promptText()}${RESET}`);

      t.onData((data) => {
        const ENTER = "\r";
        if (data === ENTER) {
          runLine();
          return;
        }
        if (data === "\u007f") {
          // Backspace
          if (lineRef.current.length > 0) {
            lineRef.current = lineRef.current.slice(0, -1);
            term?.write("\b \b");
          }
          return;
        }
        if (data === "\t") {
          complete();
          return;
        }
        if (data === "\u0003") {
          // Ctrl+C: cancel current line
          term?.write("^C");
          lineRef.current = "";
          writePrompt();
          return;
        }
        if (data === "\u000c") {
          // Ctrl+L: clear
          term?.clear();
          term?.write(`${PROMPT_COLOR}${promptText()}${RESET}${lineRef.current}`);
          return;
        }
        if (data >= " " || data === "\u00a0") {
          lineRef.current += data;
          term?.write(data);
        }
      });

      t.attachCustomKeyEventHandler((event) => {
        if (event.type !== "keydown") return true;
        if (event.key === "ArrowUp") {
          const hist = session.shell.history;
          if (hist.length === 0) return false;
          if (historyIndexRef.current === null) historyIndexRef.current = hist.length - 1;
          else if (historyIndexRef.current > 0) historyIndexRef.current -= 1;
          const cmd = hist[historyIndexRef.current];
          // wipe current line
          const cur = lineRef.current;
          term?.write("\b \b".repeat(cur.length));
          lineRef.current = cmd;
          term?.write(cmd);
          return false;
        }
        if (event.key === "ArrowDown") {
          const hist = session.shell.history;
          if (historyIndexRef.current === null) return false;
          if (historyIndexRef.current < hist.length - 1) {
            historyIndexRef.current += 1;
            const cmd = hist[historyIndexRef.current];
            const cur = lineRef.current;
            term?.write("\b \b".repeat(cur.length));
            lineRef.current = cmd;
            term?.write(cmd);
          } else {
            historyIndexRef.current = null;
            const cur = lineRef.current;
            term?.write("\b \b".repeat(cur.length));
            lineRef.current = "";
          }
          return false;
        }
        return true;
      });

      // welcome banner
      t.writeln("\x1b[38;5;71mTerminal Trainer\x1b[0m \x1b[38;5;245msimulated shell\x1b[0m");
      t.writeln("\x1b[38;5;245mType \x1b[38;5;110mhelp\x1b[0m for commands, \x1b[38;5;110mman <cmd>\x1b[0m for details. Tab completes, arrows recall.\x1b[0m");
    });

    return () => {
      disposed = true;
      term?.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionKey]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-term-border bg-[#0a0e14]">
      {/* window chrome */}
      <div className="flex shrink-0 items-center gap-2 border-b border-term-border bg-term-panel px-4 py-2">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[11px] text-term-muted">student@trainer: ~</span>
      </div>
      <div
        ref={containerRef}
        className="min-h-0 w-full flex-1 p-3"
        data-testid="terminal"
      />
    </div>
  );
}
