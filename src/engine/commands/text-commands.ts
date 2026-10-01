/**
 * Text and filter commands: cat, echo, grep, head, tail, wc, sort, uniq, find, man.
 * Pure TypeScript - no UI imports.
 */
import type { CommandImpl } from "./types";
import { fail, ok } from "./types";
import { VfsError } from "../vfs";

export const cat: CommandImpl = (ctx, args) => {
  const files = args.filter((a) => !a.startsWith("-"));
  if (files.length === 0) return ok(ctx.stdin);
  let out = "";
  for (const f of files) {
    const abs = ctx.vfs.resolve(f);
    if (!ctx.vfs.exists(abs)) return fail(`cat: ${f}: No such file or directory`);
    if (ctx.vfs.isDir(abs)) return fail(`cat: ${f}: Is a directory`);
    out += ctx.vfs.readFile(abs);
  }
  return ok(out);
};

export const echo: CommandImpl = (_ctx, args) => {
  // join like echo does; strip -e/-n for simplicity but honor -n (no trailing newline)
  let newline = true;
  const parts: string[] = [];
  for (const a of args) {
    if (a === "-n") {
      newline = false;
      continue;
    }
    if (a === "-e") continue;
    parts.push(a);
  }
  return ok(parts.join(" ") + (newline && parts.length > 0 ? "\n" : ""));
};

export const grep: CommandImpl = (ctx, args) => {
  let ignoreCase = false;
  let invert = false;
  let count = false;
  let lineNumber = false;
  const rest: string[] = [];
  for (const a of args) {
    if (a.startsWith("-") && a.length > 1 && !/^-\d+$/.test(a)) {
      for (const ch of a.slice(1)) {
        if (ch === "i") ignoreCase = true;
        else if (ch === "v") invert = true;
        else if (ch === "c") count = true;
        else if (ch === "n") lineNumber = true;
        else return fail(`grep: invalid option -- '${ch}'`);
      }
      continue;
    }
    rest.push(a);
  }
  const pattern = rest[0];
  const files = rest.slice(1);
  if (pattern === undefined) return fail("usage: grep [-invcl] PATTERN [FILE...]");

  let re: RegExp;
  try {
    re = new RegExp(pattern, ignoreCase ? "i" : "");
  } catch {
    return fail(`grep: invalid regular expression: ${pattern}`);
  }

  type Line = { text: string; file: string | null; lineNo: number };
  const lines: Line[] = [];

  const collect = (text: string, file: string | null) => {
    const split = text.split("\n");
    // trailing empty from final newline is not a line
    if (split.length > 0 && split[split.length - 1] === "") split.pop();
    split.forEach((t, i) => lines.push({ text: t, file, lineNo: i + 1 }));
  };

  if (files.length === 0) {
    collect(ctx.stdin, null);
  } else {
    for (const f of files) {
      const abs = ctx.vfs.resolve(f);
      if (!ctx.vfs.exists(abs)) return fail(`grep: ${f}: No such file or directory`);
      if (ctx.vfs.isDir(abs)) {
        return fail(`grep: ${f}: Is a directory`);
      }
      collect(ctx.vfs.readFile(abs), f);
    }
  }

  let matched = lines.filter((l) => re.test(l.text));
  if (invert) matched = lines.filter((l) => !re.test(l.text));

  if (count) {
    return ok(`${matched.length}\n`);
  }

  const out = matched.map((l) => {
    const prefix = files.length > 1 && l.file !== null ? `${l.file}:` : "";
    const num = lineNumber ? `${l.lineNo}:` : "";
    return `${prefix}${num}${l.text}`;
  });
  return ok(out.length > 0 ? out.join("\n") + "\n" : "");
};

export const head: CommandImpl = (ctx, args) => {
  return headTail(ctx, args, true);
};

export const tail: CommandImpl = (ctx, args) => {
  return headTail(ctx, args, false);
};

function headTail(ctx: Parameters<CommandImpl>[0], args: string[], isHead: boolean) {
  let n = 10;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-n") {
      n = parseInt(args[i + 1] ?? "10", 10);
      i++;
      continue;
    }
    if (/^-\d+$/.test(a)) {
      n = parseInt(a.slice(1), 10);
      continue;
    }
    if (a.startsWith("-") && !/^-\d+$/.test(a)) return fail(`${isHead ? "head" : "tail"}: invalid option '${a}'`);
    rest.push(a);
  }
  let text: string;
  if (rest.length === 0) {
    text = ctx.stdin;
  } else {
    const abs = ctx.vfs.resolve(rest[0]);
    if (!ctx.vfs.exists(abs)) return fail(`${isHead ? "head" : "tail"}: cannot open '${rest[0]}' for reading: No such file or directory`);
    text = ctx.vfs.readFile(abs);
  }
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  const picked = isHead ? parts.slice(0, n) : parts.slice(Math.max(0, parts.length - n));
  return ok(picked.length > 0 ? picked.join("\n") + "\n" : "");
}

export const wc: CommandImpl = (ctx, args) => {
  let lines = false;
  let words = false;
  let chars = false;
  const rest: string[] = [];
  for (const a of args) {
    if (a.startsWith("-") && a.length > 1) {
      for (const ch of a.slice(1)) {
        if (ch === "l") lines = true;
        else if (ch === "w") words = true;
        else if (ch === "c" || ch === "m") chars = true;
        else return fail(`wc: invalid option -- '${ch}'`);
      }
      continue;
    }
    rest.push(a);
  }
  let text: string;
  let label = "";
  if (rest.length === 0) {
    text = ctx.stdin;
  } else {
    const abs = ctx.vfs.resolve(rest[0]);
    if (!ctx.vfs.exists(abs)) return fail(`wc: ${rest[0]}: No such file or directory`);
    text = ctx.vfs.readFile(abs);
    label = " " + rest[0];
  }
  const lineCount = text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0) + (text.endsWith("\n") ? 0 : 1);
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const charCount = text.length;
  const any = lines || words || chars;
  const cols: string[] = [];
  if (!any || lines) cols.push(String(lineCount));
  if (!any || words) cols.push(String(wordCount));
  if (!any || chars) cols.push(String(charCount));
  return ok(cols.join(" ").padEnd(cols.join(" ").length) + label + "\n");
};

export const sort: CommandImpl = (ctx, args) => {
  const rest = args.filter((a) => !a.startsWith("-"));
  let text: string;
  if (rest.length === 0) text = ctx.stdin;
  else {
    const abs = ctx.vfs.resolve(rest[0]);
    if (!ctx.vfs.exists(abs)) return fail(`sort: cannot read: ${rest[0]}: No such file or directory`);
    text = ctx.vfs.readFile(abs);
  }
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  parts.sort((a, b) => a.localeCompare(b));
  return ok(parts.length > 0 ? parts.join("\n") + "\n" : "");
};

export const uniq: CommandImpl = (ctx, args) => {
  let count = false;
  const rest: string[] = [];
  for (const a of args) {
    if (a === "-c") {
      count = true;
      continue;
    }
    if (a.startsWith("-") && a.length > 1) return fail(`uniq: invalid option '${a}'`);
    rest.push(a);
  }
  let text: string;
  if (rest.length === 0) text = ctx.stdin;
  else {
    const abs = ctx.vfs.resolve(rest[0]);
    if (!ctx.vfs.exists(abs)) return fail(`uniq: ${rest[0]}: No such file or directory`);
    text = ctx.vfs.readFile(abs);
  }
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  const out: string[] = [];
  let prev: string | null = null;
  let n = 1;
  const flush = () => {
    if (prev !== null) out.push(count ? `${n} ${prev}` : prev);
  };
  for (const p of parts) {
    if (p === prev) n++;
    else {
      flush();
      prev = p;
      n = 1;
    }
  }
  flush();
  return ok(out.length > 0 ? out.join("\n") + "\n" : "");
};

export const find: CommandImpl = (ctx, args) => {
  let start = ".";
  let namePattern: string | null = null;
  let typeFilter: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-name") {
      namePattern = args[++i];
      continue;
    }
    if (a === "-type") {
      typeFilter = args[++i];
      continue;
    }
    if (!a.startsWith("-")) start = a;
  }
  const abs = ctx.vfs.resolve(start);
  if (!ctx.vfs.exists(abs)) return fail(`find: '${start}': No such file or directory`);

  let re: RegExp | null = null;
  if (namePattern !== null) {
    try {
      re = globToRegex(namePattern);
    } catch {
      return fail(`find: invalid pattern: ${namePattern}`);
    }
  }

  const out: string[] = [];
  const walkFrom = (dirAbs: string, prefix: string) => {
    const display = prefix === "" ? displayPath(dirAbs) : prefix;
    out.push(display);
    const node = ctx.vfs.getNode(dirAbs);
    if (!node || node.kind !== "directory") return;
    for (const child of ctx.vfs.listDir(dirAbs)) {
      const childPath = prefix === "" ? displayPath(joinPath(dirAbs, child.name)) : prefix + "/" + child.name;
      if (child.kind === "directory") {
        walkFrom(joinPath(dirAbs, child.name), childPath);
      } else {
        out.push(childPath);
      }
    }
  };
  walkFrom(abs, "");

  const filtered = out.filter((entryPath) => {
    const name = entryPath.split("/").pop() ?? entryPath;
    const nodeAbs = ctx.vfs.resolve(entryPath);
    const node = ctx.vfs.getNode(nodeAbs);
    if (typeFilter === "f" && node?.kind !== "file") return false;
    if (typeFilter === "d" && node?.kind !== "directory") return false;
    if (re && !re.test(name)) return false;
    return true;
  });
  return ok(filtered.length > 0 ? filtered.join("\n") + "\n" : "");
};

function displayPath(p: string): string {
  if (p === "/") return ".";
  // relative start like /p stays absolute in display for simplicity
  return p;
}

function joinPath(a: string, b: string): string {
  if (a === "/") return "/" + b;
  return a + "/" + b;
}

function globToRegex(glob: string): RegExp {
  let out = "";
  for (const ch of glob) {
    if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + out + "$");
}

const MAN_PAGES: Record<string, string> = {
  pwd: "pwd - print name of current/working directory\n\nSYNOPSIS\n  pwd\n\nDESCRIPTION\n  Print the full filename of the current working directory.\n",
  ls: "ls - list directory contents\n\nSYNOPSIS\n  ls [-l] [-a] [FILE]\n\nDESCRIPTION\n  List information about the FILEs (the current directory by default).\n  -l  use a long listing format\n  -a  do not ignore entries starting with .\n",
  cd: "cd - change the working directory\n\nSYNOPSIS\n  cd [DIR]\n\nDESCRIPTION\n  Change the current directory to DIR. With no argument, go to HOME.\n",
  mkdir: "mkdir - make directories\n\nSYNOPSIS\n  mkdir [-p] DIR\n\nDESCRIPTION\n  Create the DIRECTORY(ies), if they do not already exist.\n  -p  no error if existing, make parent directories as needed\n",
  touch: "touch - create an empty file or update file timestamps\n\nSYNOPSIS\n  touch FILE\n\nDESCRIPTION\n  Create an empty FILE if it does not exist.\n",
  cp: "cp - copy files\n\nSYNOPSIS\n  cp SOURCE DEST\n\nDESCRIPTION\n  Copy SOURCE to DEST, or into DEST if DEST is an existing directory.\n",
  mv: "mv - move (rename) files\n\nSYNOPSIS\n  mv SOURCE DEST\n\nDESCRIPTION\n  Rename SOURCE to DEST, or move it into DEST if DEST is an existing directory.\n",
  rm: "rm - remove files or directories\n\nSYNOPSIS\n  rm [-r] FILE\n\nDESCRIPTION\n  Remove FILE. Use -r to remove directories recursively.\n  There is no trash: removed files are gone.\n",
  cat: "cat - concatenate files and print on standard output\n\nSYNOPSIS\n  cat [FILE...]\n\nDESCRIPTION\n  Print the contents of FILE(s), or stdin if no file is given.\n",
  echo: "echo - display a line of text\n\nSYNOPSIS\n  echo [-n] TEXT\n\nDESCRIPTION\n  Print TEXT followed by a newline (no newline with -n).\n",
  grep: "grep - print lines matching a pattern\n\nSYNOPSIS\n  grep [-invcl] PATTERN [FILE...]\n\nDESCRIPTION\n  Search for PATTERN in each FILE or standard input.\n  -i  ignore case\n  -v  invert match\n  -c  count matching lines\n  -n  print line numbers\n",
  head: "head - output the first part of files\n\nSYNOPSIS\n  head [-n N] [FILE]\n\nDESCRIPTION\n  Print the first N lines (default 10) of FILE or stdin.\n",
  tail: "tail - output the last part of files\n\nSYNOPSIS\n  tail [-n N] [FILE]\n\nDESCRIPTION\n  Print the last N lines (default 10) of FILE or stdin.\n",
  wc: "wc - print newline, word and byte counts\n\nSYNOPSIS\n  wc [-l] [-w] [-c] [FILE]\n\nDESCRIPTION\n  Print counts for FILE or stdin: lines (-l), words (-w), characters (-c).\n",
  sort: "sort - sort lines of text\n\nSYNOPSIS\n  sort [FILE]\n\nDESCRIPTION\n  Sort the lines of FILE or stdin alphabetically.\n",
  uniq: "uniq - report or omit repeated lines\n\nSYNOPSIS\n  uniq [-c] [FILE]\n\nDESCRIPTION\n  Filter adjacent matching lines from FILE or stdin.\n  -c  prefix each output line with its occurrence count\n",
  find: "find - search for files in a directory hierarchy\n\nSYNOPSIS\n  find [PATH] [-name GLOB] [-type f|d]\n\nDESCRIPTION\n  Walk PATH and print every file and directory. Filter by name glob or type.\n",
  tree: "tree - list contents of directories in a tree-like format\n\nSYNOPSIS\n  tree [DIR]\n\nDESCRIPTION\n  List directory contents recursively with indentation.\n",
  chmod: "chmod - change file permissions\n\nSYNOPSIS\n  chmod MODE FILE\n\nDESCRIPTION\n  Change file permissions using octal MODE, e.g. chmod 644 notes.txt.\n  7 = rwx, 6 = rw-, 5 = r-x, 4 = r--, 0 = ---.\n",
  whoami: "whoami - print effective user name\n\nSYNOPSIS\n  whoami\n\nDESCRIPTION\n  Print the user name associated with the current session.\n",
  clear: "clear - clear the terminal screen\n\nSYNOPSIS\n  clear\n\nDESCRIPTION\n  Clears the terminal screen.\n",
  history: "history - display command history\n\nSYNOPSIS\n  history\n\nDESCRIPTION\n  Display previously executed commands, oldest first.\n",
  date: "date - print the system date and time\n\nSYNOPSIS\n  date\n\nDESCRIPTION\n  Print the current date and time.\n",
  git: "git - the stupid content tracker (simulated)\n\nSYNOPSIS\n  git config | init | status | add | commit | log\n\nDESCRIPTION\n  A first-commit-sized git: set your identity, create a repository,\n  stage files, commit them, and read the history back.\n  'git help <command>' or 'git <command> -h' explains one command.\n",
};

export const man: CommandImpl = (_ctx, args) => {
  const page = args[0];
  if (!page) return fail("What manual page do you want?\nFor example, try 'man man'.");
  const text = MAN_PAGES[page];
  if (!text) return fail(`No manual entry for ${page}`);
  return ok(text);
};

export const manPages = () => Object.keys(MAN_PAGES);
