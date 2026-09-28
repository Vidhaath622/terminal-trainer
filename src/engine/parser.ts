/**
 * Shell command-line parser for the terminal trainer.
 * Pure TypeScript - no DOM, no Node, no UI imports.
 *
 * Supports: word splitting, single quotes, double quotes, backslash escapes,
 * pipes (|), and output redirection (> file, >> file).
 */

export interface Redirection {
  type: ">" | ">>";
  token: string;
}

export interface SimpleCommand {
  /** argv; argv[0] is the command name */
  args: string[];
  redirect: Redirection | null;
}

export interface Pipeline {
  stages: SimpleCommand[];
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export function parseLine(line: string): Pipeline {
  const stageStrs = splitOnPipes(line);
  const stages: SimpleCommand[] = [];
  for (const s of stageStrs) {
    stages.push(parseSimple(s));
  }
  return { stages };
}

/** Split a line on unquoted, unescaped pipe characters. */
function splitOnPipes(line: string): string[] {
  const stages: string[] = [];
  let cur = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  while (i < line.length) {
    const c = line[i];
    if (inSingle) {
      if (c === "'") inSingle = false;
      cur += c;
      i++;
      continue;
    }
    if (inDouble) {
      if (c === '"' && line[i - 1] !== "\\") inDouble = false;
      cur += c;
      i++;
      continue;
    }
    if (c === "\\" && i + 1 < line.length) {
      cur += c + line[i + 1];
      i += 2;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      cur += c;
      i++;
      continue;
    }
    if (c === "|") {
      stages.push(cur);
      cur = "";
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  if (inSingle || inDouble) throw new ParseError("unexpected EOF while looking for matching quote");
  stages.push(cur);
  return stages;
}

interface Word {
  /** the word's value */
  value: string;
  /** true if the word came from any quoting (matters for empty-string args) */
  hadQuotes: boolean;
}

/** Parse one pipeline stage (no pipes) into argv + redirection. */
function parseSimple(input: string): SimpleCommand {
  const words: Word[] = [];
  let redirect: Redirection | null = null;

  let cur = "";
  let hadQuotes = false;
  let i = 0;
  let started = false; // current word has begun (needed to keep empty quoted args)

  const pushWord = () => {
    if (started) words.push({ value: cur, hadQuotes });
    cur = "";
    hadQuotes = false;
    started = false;
  };

  while (i < input.length) {
    const c = input[i];

    if (c === " " || c === "\t") {
      if (started) pushWord();
      i++;
      continue;
    }

    if (c === "'") {
      started = true;
      hadQuotes = true;
      i++;
      let closed = false;
      while (i < input.length) {
        if (input[i] === "'") {
          closed = true;
          i++;
          break;
        }
        cur += input[i];
        i++;
      }
      if (!closed) throw new ParseError("unexpected EOF while looking for matching `''");
      continue;
    }

    if (c === '"') {
      started = true;
      hadQuotes = true;
      i++;
      let closed = false;
      while (i < input.length) {
        const d = input[i];
        if (d === "\\") {
          // inside double quotes, backslash only escapes " \ $ `
          const next = input[i + 1];
          if (next === '"' || next === "\\" || next === "$" || next === "`") {
            cur += next;
            i += 2;
            continue;
          }
          cur += d;
          i++;
          continue;
        }
        if (d === '"') {
          closed = true;
          i++;
          break;
        }
        cur += d;
        i++;
      }
      if (!closed) throw new ParseError("unexpected EOF while looking for matching `\"'");
      continue;
    }

    if (c === "\\") {
      started = true;
      if (i + 1 >= input.length) throw new ParseError("unexpected EOF after backslash");
      cur += input[i + 1];
      i += 2;
      continue;
    }

    if (c === ">" || c === "<") {
      if (c === "<") throw new ParseError("input redirection (<) is not supported in this simulator");
      if (redirect) throw new ParseError("ambiguous redirect: multiple output redirections");
      if (started) pushWord();
      i++;
      let type: ">" | ">>" = ">";
      if (input[i] === ">") {
        type = ">>";
        i++;
      }
      while (i < input.length && (input[i] === " " || input[i] === "\t")) i++;
      // read target word (supports quotes)
      let target = "";
      let tStarted = false;
      while (i < input.length && input[i] !== " " && input[i] !== "\t") {
        const d = input[i];
        if (d === "'") {
          tStarted = true;
          i++;
          while (i < input.length && input[i] !== "'") {
            target += input[i];
            i++;
          }
          if (i >= input.length) throw new ParseError("unexpected EOF while looking for matching `''");
          i++;
          continue;
        }
        if (d === '"') {
          tStarted = true;
          i++;
          while (i < input.length && input[i] !== '"') {
            if (input[i] === "\\" && (input[i + 1] === '"' || input[i + 1] === "\\")) {
              target += input[i + 1];
              i += 2;
              continue;
            }
            target += input[i];
            i++;
          }
          if (i >= input.length) throw new ParseError("unexpected EOF while looking for matching `\"'");
          i++;
          continue;
        }
        if (d === ">" || d === "<" || d === "|") {
          throw new ParseError("syntax error near unexpected token `" + d + "'");
        }
        if (d === "\\" && i + 1 < input.length) {
          target += input[i + 1];
          i += 2;
          continue;
        }
        target += d;
        i++;
      }
      if (!tStarted && target.length === 0) throw new ParseError("syntax error near unexpected token `newline'");
      redirect = { type, token: target };
      continue;
    }

    // regular character
    started = true;
    cur += c;
    i++;
  }

  if (started) pushWord();

  const args = words.map((w) => w.value);
  if (args.length === 0 && redirect) {
    // e.g. "> file" alone: bash allows this (creates empty file); we keep it
    args.push("");
  }
  return { args, redirect };
}
