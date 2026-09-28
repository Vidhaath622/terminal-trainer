/**
 * Command registry + Shell executor. Pure TypeScript - no UI imports.
 */
import type { Vfs } from "../vfs";
import { VfsError } from "../vfs";
import { parseLine, ParseError, type Pipeline } from "../parser";
import type { ShellContext, CommandImpl } from "./types";
import { pwd, cd, ls, mkdir, touch, cp, mv, rm, chmod, tree } from "./fs-commands";
import { cat, echo, grep, head, tail, wc, sort, uniq, find, man } from "./text-commands";
import { whoami, date, historyCmd, clearCmd, help } from "./session-commands";

export const COMMANDS: Record<string, CommandImpl> = {
  pwd, cd, ls, mkdir, touch, cp, mv, rm, chmod, tree,
  cat, echo, grep, head, tail, wc, sort, uniq, find,
  whoami, date, history: historyCmd, clear: clearCmd, help, man,
};

export function commandNames(): string[] {
  return Object.keys(COMMANDS).sort();
}

export interface ShellOptions {
  user?: string;
  env?: Record<string, string>;
  now?: () => Date;
}

export interface RunResult {
  stdout: string;
  code: number;
  error: string | null;
  /** true when the command asked the UI to clear the screen */
  cleared: boolean;
}

export class Shell {
  vfs: Vfs;
  user: string;
  env: Record<string, string>;
  history: string[] = [];
  private nowFn: () => Date;

  constructor(vfs: Vfs, options: ShellOptions = {}) {
    this.vfs = vfs;
    this.user = options.user ?? "student";
    this.env = { HOME: "/", ...options.env };
    this.nowFn = options.now ?? (() => new Date());
  }

  /** Execute one command line (supports pipes and output redirection). */
  run(line: string): RunResult {
    const trimmed = line.trim();
    if (trimmed === "") return { stdout: "", code: 0, error: null, cleared: false };
    this.history.push(trimmed);
    try {
      const pipeline = parseLine(trimmed);
      return this.execute(pipeline);
    } catch (e) {
      if (e instanceof ParseError) {
        return { stdout: "", code: 2, error: `bash: syntax error: ${e.message}`, cleared: false };
      }
      throw e;
    }
  }

  private execute(pipeline: Pipeline): RunResult {
    let stdin = "";
    let result: RunResult = { stdout: "", code: 0, error: null, cleared: false };

    for (let i = 0; i < pipeline.stages.length; i++) {
      const stage = pipeline.stages[i];
      const cmdName = stage.args[0] ?? "";
      const isLast = i === pipeline.stages.length - 1;

      if (cmdName === "") {
        return { stdout: "", code: 2, error: "bash: syntax error near unexpected token `|'", cleared: false };
      }

      const impl = COMMANDS[cmdName];
      if (!impl) {
        return { stdout: "", code: 127, error: `${cmdName}: command not found`, cleared: false };
      }

      const ctx: ShellContext = {
        vfs: this.vfs,
        history: this.history,
        env: this.env,
        user: this.user,
        stdin,
        now: this.nowFn,
      };

      const res = impl(ctx, stage.args.slice(1));
      if (res.error !== null && res.code !== 0) {
        return { stdout: "", code: res.code, error: res.error, cleared: false };
      }

      let stdout = res.stdout;

      if (stage.redirect && isLast) {
        const { type, token } = stage.redirect;
        const abs = this.vfs.resolve(token);
        try {
          if (type === ">") {
            this.vfs.writeFile(abs, stdout);
          } else {
            const prev = this.vfs.exists(abs) && this.vfs.isFile(abs) ? this.vfs.readFile(abs) : "";
            this.vfs.writeFile(abs, prev + stdout);
          }
        } catch (e) {
          return { stdout: "", code: 1, error: `bash: ${token}: ${(e as VfsError).message}`, cleared: false };
        }
        stdout = "";
      }

      stdin = stdout;
      result = { stdout, code: res.code, error: null, cleared: cmdName === "clear" };
    }
    return result;
  }
}
