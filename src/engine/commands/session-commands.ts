/**
 * Session commands: whoami, date, history, clear, say, help.
 * Pure TypeScript - no UI imports. "clear" is handled specially by the shell
 * (it signals the UI to clear), so its impl here is a placeholder.
 */
import type { CommandImpl } from "./types";
import { fail, ok } from "./types";

export const whoami: CommandImpl = (ctx) => ok(ctx.user + "\n");

export const date: CommandImpl = (ctx) => ok(ctx.now().toString() + "\n");

export const historyCmd: CommandImpl = (ctx) => {
  if (ctx.history.length === 0) return ok("");
  const lines = ctx.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`);
  return ok(lines.join("\n") + "\n");
};

export const clearCmd: CommandImpl = () => ok();

export const say: CommandImpl = (_ctx, args) => {
  const sentence = args.join(" ");
  if (sentence === "") return fail("usage: say TEXT...");
  return ok(`🔊 "${sentence}"\n`);
};

export const help: CommandImpl = (_ctx) => {
  const lines = [
    "Available commands:",
    "  Filesystem:  pwd cd ls mkdir touch cp mv rm chmod tree",
    "  Text:        cat echo grep head tail wc sort uniq find",
    "  Session:     whoami date history clear man say",
    "",
    "Tips: use Tab for completion, Up/Down for history, pipes (|) and redirection (> >>) work.",
    "Type 'verify' to check the current step, or use the Verify button.",
  ];
  return ok(lines.join("\n") + "\n");
};
