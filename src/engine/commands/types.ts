/**
 * Command execution types shared by all commands. Pure TypeScript.
 */
import type { Vfs } from "../vfs";

export interface ShellContext {
  vfs: Vfs;
  /** previously executed command lines (oldest first) */
  history: string[];
  env: Record<string, string>;
  user: string;
  /** text piped into this command from the previous pipeline stage ("" if none) */
  stdin: string;
  /** injectable clock for determinism in tests */
  now: () => Date;
}

export interface CommandResult {
  /** stdout text (already newline-normalized by the shell) */
  stdout: string;
  /** exit-style status: 0 = success */
  code: number;
  /** error message printed to stderr; null on success */
  error: string | null;
}

export type CommandImpl = (ctx: ShellContext, args: string[]) => CommandResult;

export function ok(stdout = ""): CommandResult {
  return { stdout, code: 0, error: null };
}

export function fail(error: string, code = 1): CommandResult {
  return { stdout: "", code, error };
}
