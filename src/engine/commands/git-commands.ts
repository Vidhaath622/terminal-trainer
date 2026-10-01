/**
 * Simulated git: config, init, status, add, commit, log, show, diff, rm, mv
 * (+ help / -h). Pure TypeScript - no UI imports.
 *
 * Scope: the first-commit workflow plus the inspection and cleanup verbs a
 * beginner meets next (history flags, diffs, untracking, renames). No
 * remotes, no branch switching. Repository state lives in a `.git` file at
 * the repository root (JSON-serialized), so it flows through the existing
 * VFS (and therefore session persistence) for free. Global config lives in
 * ~/.gitconfig, shared across repositories like the real thing.
 *
 * Known simplifications: a rename records as a deletion plus an addition,
 * and `git add -p` / editor-driven `git commit` are not simulated.
 */
import type { CommandImpl, ShellContext } from "./types";
import { fail, ok } from "./types";
import type { Vfs } from "../vfs";
import { diffStat, unifiedDiff } from "./gitdiff";

interface GitCommit {
  id: string;
  message: string;
  time: number;
  author: string;
  email: string;
  /** Full tree snapshot: repo-relative path -> content at commit time. */
  files: Record<string, string>;
}

interface GitMeta {
  version: number;
  branch: string;
  commits: GitCommit[];
  staged: Record<string, string>;
  /** Paths staged for deletion (git rm / rm --cached); optional for older repos. */
  stagedDeletions?: string[];
  tracked: string[];
  local: Record<string, string>;
}

const NOT_A_REPO = "fatal: not a git repository (or any of the parent directories): .git";

const USAGE = `usage: git <command> [<args>]

   config   set your identity and options (user.name, user.email, ...)
   init     create an empty Git repository (.git/)
   status   show staged, modified and untracked files
   add      stage file contents for the next commit
   commit   record staged changes with a message
   log      show commit history (also: --oneline, --stat, -p, -n <number>)
   show     one commit's message and changes
   diff     compare the working tree, the staging area or two commits
   rm       delete a file and stage the deletion (--cached keeps it on disk)
   mv       rename or move a tracked file

'git help <command>' explains one command.`;

const HELP: Record<string, string> = {
  config: `git config - set or read repository/global options

USAGE
  git config --global <key> <value>   write to ~/.gitconfig
  git config <key> <value>            write to this repository only
  git config <key>                    print a value
  git config --list                   print all settings

DESCRIPTION
  Keys used most: user.name and user.email (the identity stamped on every
  commit — a label, not a login) and init.defaultBranch (the first branch
  in new repositories).`,
  init: `git init - create an empty Git repository

USAGE
  git init [-b <branch>]

DESCRIPTION
  Creates a hidden .git/ entry in the current directory — that is what
  makes a folder a repository. Run it once per project. -b names the
  starting branch (else init.defaultBranch, else master).`,
  status: `git status - show what is staged, modified or untracked

USAGE
  git status [-s]

DESCRIPTION
  Compares the working directory, the staging area and the last commit.
  The first thing to run whenever git feels confusing. -s prints one
  short line per file: ?? untracked, A  staged-new, M  staged-modified,
  D  staged-deleted, ' M' modified, ' D' deleted.`,
  add: `git add - stage file contents for the next commit

USAGE
  git add <file>...      stage named files (or whole directories)
  git add .              stage everything under the repository

DESCRIPTION
  Staging builds the snapshot you are about to commit; it does not save
  history by itself — git commit does that.`,
  commit: `git commit - record staged changes as one named snapshot

USAGE
  git commit -m "message"
  git commit -am "message"

DESCRIPTION
  Stores the staged files permanently together with the -m message. The
  first commit on a branch is the root commit. -a also stages edits and
  deletions of already-tracked files — new files still need git add.
  Messages say what and why: 'Fix login redirect', not 'changes'.`,
  log: `git log - show commit history, newest first

USAGE
  git log [--oneline] [--stat] [-p] [-n <number>]

DESCRIPTION
  Each entry shows the commit id, the author, the date and the message.
  --oneline collapses each commit to one line, --stat lists the files
  each commit changed, -p shows the full patch, -n limits to the last N.`,
  show: `git show - one commit's message and changes

USAGE
  git show [<commit>]

DESCRIPTION
  Prints a single commit — header, message, then the patch against its
  parent. Defaults to HEAD; accepts an id prefix or HEAD~<n>.`,
  diff: `git diff - compare working tree, staging area and commits

USAGE
  git diff                          changes not yet staged
  git diff --staged                 changes about to be committed
  git diff <commit1> <commit2>      changes between two commits
  git diff <commit>                 changes since that commit

DESCRIPTION
  '-' lines were removed, '+' lines were added. Untracked files never
  appear in a diff — git does not know about them yet.`,
  rm: `git rm - remove a file and stage the removal

USAGE
  git rm <file>            delete the file and stage the deletion
  git rm --cached <file>   stop tracking it, keep the file on disk

DESCRIPTION
  The removal joins the next commit. --cached leaves your working copy
  untouched — the file simply becomes untracked again.`,
  mv: `git mv - rename or move a tracked file

USAGE
  git mv <old> <new>

DESCRIPTION
  Moves the file on disk and keeps it tracked. The simulator records a
  rename as a deletion plus an addition in the next commit.`,
};

// ---------- config storage ----------

function gitconfigPath(ctx: ShellContext): string {
  const home = ctx.env.HOME ?? "/";
  return home === "/" ? "/.gitconfig" : home + "/.gitconfig";
}

function readGlobalConfig(ctx: ShellContext): Record<string, string> {
  const p = gitconfigPath(ctx);
  const out: Record<string, string> = {};
  if (!ctx.vfs.isFile(p)) return out;
  for (const line of ctx.vfs.readFile(p).split("\n")) {
    const m = line.match(/^\s*([^=#\s]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeGlobalConfig(ctx: ShellContext, cfg: Record<string, string>): void {
  const p = gitconfigPath(ctx);
  // Problems may never have created the home directory — ensure it exists.
  if (!ctx.vfs.isDir(ctx.vfs.parentOf(p))) ctx.vfs.ensureDir(ctx.vfs.parentOf(p));
  const body = Object.keys(cfg)
    .sort()
    .map((k) => `${k} = ${cfg[k]}`)
    .join("\n");
  ctx.vfs.writeFile(p, body + "\n");
}

function findRepo(ctx: ShellContext): { root: string; meta: GitMeta } | null {
  let dir = ctx.vfs.cwd;
  for (;;) {
    const dot = dir === "/" ? "/.git" : dir + "/.git";
    if (ctx.vfs.isFile(dot)) {
      try {
        const meta = JSON.parse(ctx.vfs.readFile(dot)) as GitMeta;
        if (meta && meta.version === 1) return { root: dir, meta };
        return null;
      } catch {
        return null;
      }
    }
    if (dir === "/") return null;
    dir = dir.slice(0, dir.lastIndexOf("/")) || "/";
  }
}

function saveRepo(ctx: ShellContext, root: string, meta: GitMeta): void {
  ctx.vfs.writeFile(root + "/.git", JSON.stringify(meta));
}

// ---------- meta helpers ----------

function deletionsOf(meta: GitMeta): string[] {
  return meta.stagedDeletions ?? [];
}

function headFiles(meta: GitMeta): Record<string, string> {
  return meta.commits.length > 0 ? meta.commits[meta.commits.length - 1].files : {};
}

function sortedKeys(rec: Record<string, string>): string[] {
  return Object.keys(rec).sort();
}

/** HEAD, HEAD~<n>, or an id prefix. */
function resolveCommit(meta: GitMeta, ref: string): { commit: GitCommit; index: number } | null {
  if (ref === "HEAD") {
    return meta.commits.length > 0
      ? { commit: meta.commits[meta.commits.length - 1], index: meta.commits.length - 1 }
      : null;
  }
  const tilde = ref.match(/^HEAD~(\d+)$/);
  if (tilde) {
    const index = meta.commits.length - 1 - parseInt(tilde[1], 10);
    return index >= 0 ? { commit: meta.commits[index], index } : null;
  }
  const index = meta.commits.findIndex((c) => c.id.startsWith(ref));
  return index >= 0 ? { commit: meta.commits[index], index } : null;
}

/** Patch blocks for every file that differs between two tree snapshots. */
function treePatch(oldFiles: Record<string, string>, newFiles: Record<string, string>): string {
  const paths = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);
  const blocks: string[] = [];
  for (const path of [...paths].sort()) {
    const patch = unifiedDiff(oldFiles[path] ?? null, newFiles[path] ?? null, path);
    if (patch) blocks.push(patch);
  }
  return blocks.join("\n");
}

/** Per-file change summary in the style of `git log --stat`. */
function statBlock(oldFiles: Record<string, string>, newFiles: Record<string, string>): string {
  const paths = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);
  const rows: string[] = [];
  let adds = 0;
  let dels = 0;
  let files = 0;
  for (const path of [...paths].sort()) {
    const { adds: a, dels: d } = diffStat(oldFiles[path] ?? null, newFiles[path] ?? null);
    if (a === 0 && d === 0) continue;
    files++;
    adds += a;
    dels += d;
    rows.push(` ${path} | ${a + d} ${"+".repeat(a)}${"-".repeat(d)}`);
  }
  if (files === 0) return "";
  const summary = ` ${files} file${files === 1 ? "" : "s"} changed, ${adds} insertion${adds === 1 ? "" : "s"}(+), ${dels} deletion${dels === 1 ? "" : "s"}(-)`;
  return [...rows, summary].join("\n");
}

// ---------- path helpers ----------

function relPath(root: string, abs: string): string {
  if (abs === root) return ".";
  return root === "/" ? abs.slice(1) : abs.slice(root.length + 1);
}

function absPath(root: string, rel: string): string {
  return root === "/" ? "/" + rel : root + "/" + rel;
}

/** All file paths under dir (deepest-last, sorted). */
function walkFiles(vfs: Vfs, dir: string, out: string[]): string[] {
  for (const child of vfs.listDir(dir)) {
    const p = dir === "/" ? "/" + child.name : dir + "/" + child.name;
    if (child.kind === "directory") walkFiles(vfs, p, out);
    else out.push(p);
  }
  return out;
}

function repoFiles(ctx: ShellContext, root: string): string[] {
  return walkFiles(ctx.vfs, root, []).filter((p) => relPath(root, p) !== ".git");
}

// ---------- formatting ----------

function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(7, "0").slice(-7);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function gitDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${d.getUTCFullYear()} +0000`
  );
}

function commitHeader(c: GitCommit): string {
  return `commit ${c.id}\nAuthor: ${c.author} <${c.email}>\nDate:   ${gitDate(c.time)}\n\n    ${c.message}`;
}

// ---------- subcommands ----------

function gitConfig(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  let useGlobal = false;
  let list = false;
  const rest: string[] = [];
  for (const a of args) {
    if (a === "--global") useGlobal = true;
    else if (a === "--local") useGlobal = false;
    else if (a === "--list") list = true;
    else if (a.startsWith("--")) return fail(`git config: unknown option '${a}'`);
    else rest.push(a);
  }

  if (list) {
    const repo = findRepo(ctx);
    const merged: Record<string, string> = { ...readGlobalConfig(ctx), ...(repo?.meta.local ?? {}) };
    const keys = sortedKeys(merged);
    return ok(keys.length > 0 ? keys.map((k) => `${k}=${merged[k]}`).join("\n") + "\n" : "");
  }

  if (rest.length === 0) return fail("usage: git config [<key> [<value>]] | --list");

  const key = rest[0];
  if (!/^[A-Za-z][A-Za-z0-9.-]*$/.test(key)) return fail(`git config: invalid key '${key}'`);

  if (rest.length === 1) {
    // read form
    const value = useGlobal ? readGlobalConfig(ctx)[key] : findRepo(ctx)?.meta.local[key] ?? readGlobalConfig(ctx)[key];
    return value === undefined ? fail("", 1) : ok(value + "\n");
  }

  // write form (join unquoted multi-word values, like echo)
  const value = rest.slice(1).join(" ");
  if (useGlobal) {
    const cfg = readGlobalConfig(ctx);
    cfg[key] = value;
    writeGlobalConfig(ctx, cfg);
  } else {
    const repo = findRepo(ctx);
    if (!repo) return fail("fatal: not in a git directory (use --global to configure outside a repository)");
    repo.meta.local[key] = value;
    saveRepo(ctx, repo.root, repo.meta);
  }
  return ok();
}

function gitInit(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  let branchArg: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-b" || a === "--initial-branch") {
      branchArg = args[i + 1] ?? null;
      i++;
    } else if (a.startsWith("--initial-branch=")) {
      branchArg = a.slice("--initial-branch=".length);
    } else if (a.startsWith("-")) {
      return fail(`fatal: unknown option: ${a}`);
    }
  }

  const dot = ctx.vfs.cwd === "/" ? "/.git" : ctx.vfs.cwd + "/.git";
  if (ctx.vfs.isFile(dot)) {
    return ok(`Reinitialized existing Git repository in ${ctx.vfs.cwd}/.git/\n`);
  }
  const meta: GitMeta = {
    version: 1,
    branch: branchArg ?? readGlobalConfig(ctx)["init.defaultBranch"] ?? "master",
    commits: [],
    staged: {},
    tracked: [],
    local: {},
  };
  saveRepo(ctx, ctx.vfs.cwd, meta);
  return ok(`Initialized empty Git repository in ${ctx.vfs.cwd}/.git/\n`);
}

function gitStatus(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  const short = args.includes("-s") || args.includes("--short");
  const head = headFiles(meta);
  const deletions = deletionsOf(meta);

  const stagedKeys = sortedKeys(meta.staged);
  const modified: string[] = [];
  const deleted: string[] = [];
  for (const rel of meta.tracked) {
    const abs = absPath(root, rel);
    if (!ctx.vfs.isFile(abs)) deleted.push(rel);
    else {
      // Like real git: "not staged" compares the working tree against the
      // effective index (staged content when present, else HEAD), so a
      // fully staged file stops appearing as unstaged.
      const indexContent = rel in meta.staged ? meta.staged[rel] : head[rel];
      if (indexContent !== undefined && ctx.vfs.readFile(abs) !== indexContent) modified.push(rel);
    }
  }
  const known = new Set([...meta.tracked, ...stagedKeys]);
  const untracked = repoFiles(ctx, root).map((p) => relPath(root, p)).filter((rel) => !known.has(rel)).sort();

  if (short) {
    type Row = { x: string; y: string; path: string };
    const rows: Row[] = [];
    for (const rel of new Set([...stagedKeys, ...deletions, ...meta.tracked])) {
      const inHead = rel in head;
      const stagedContent = meta.staged[rel];
      const x = deletions.includes(rel) ? "D" : stagedContent === undefined ? " " : !inHead || stagedContent !== head[rel] ? (inHead ? "M" : "A") : " ";
      const abs = absPath(root, rel);
      const work = ctx.vfs.isFile(abs) ? ctx.vfs.readFile(abs) : null;
      const indexContent = stagedContent ?? head[rel] ?? null;
      const y = deletions.includes(rel) ? " " : work === null ? "D" : work !== indexContent ? "M" : " ";
      if (x !== " " || y !== " ") rows.push({ x, y, path: rel });
    }
    for (const rel of untracked) rows.push({ x: "?", y: "?", path: rel });
    rows.sort((p, q) => p.path.localeCompare(q.path));
    return ok(rows.map((r) => `${r.x}${r.y} ${r.path}`).join("\n") + (rows.length > 0 ? "\n" : ""));
  }

  const lines: string[] = [`On branch ${meta.branch}`];
  if (meta.commits.length === 0) lines.push("No commits yet");

  if (stagedKeys.length > 0 || deletions.length > 0) {
    lines.push("Changes to be committed:");
    for (const rel of stagedKeys) lines.push(`        ${rel in head ? "modified:" : "new file:"}   ${rel}`);
    for (const rel of deletions.sort()) lines.push(`        deleted:    ${rel}`);
    lines.push("");
  }
  if (modified.length > 0 || deleted.length > 0) {
    lines.push("Changes not staged for commit:");
    for (const rel of modified) lines.push(`        modified:   ${rel}`);
    for (const rel of deleted) lines.push(`        deleted:    ${rel}`);
    lines.push("");
  }
  if (untracked.length > 0) {
    lines.push("Untracked files:");
    for (const rel of untracked) lines.push(`        ${rel}`);
    lines.push("");
  }

  const nothingStaged = stagedKeys.length === 0 && deletions.length === 0;
  if (nothingStaged && modified.length === 0 && deleted.length === 0 && untracked.length === 0) {
    lines.push("nothing to commit, working tree clean");
  } else if (nothingStaged) {
    lines.push('nothing added to commit but untracked files present (use "git add" to track)');
  }
  return ok(lines.join("\n") + "\n");
}

function gitAdd(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;

  const targets = args.filter((a) => a !== "-A" && a !== "--all");
  const addAll = args.length === 0 || targets.length !== args.length;

  const absTargets: string[] = [];
  if (addAll || targets.includes(".")) absTargets.push(root);
  for (const t of targets) {
    if (t === ".") continue;
    const abs = ctx.vfs.resolve(t);
    if (!ctx.vfs.exists(abs)) return fail(`fatal: pathspec '${t}' did not match any files`);
    absTargets.push(abs);
  }
  if (absTargets.length === 0) return fail("fatal: no files added");

  let changed = false;
  for (const abs of absTargets) {
    const files = ctx.vfs.isDir(abs) ? walkFiles(ctx.vfs, abs, []) : [abs];
    for (const file of files) {
      const rel = relPath(root, file);
      if (rel === ".git") continue;
      meta.staged[rel] = ctx.vfs.readFile(file);
      if (!meta.tracked.includes(rel)) meta.tracked.push(rel);
      // Re-adding cancels a pending deletion.
      const dels = deletionsOf(meta);
      if (dels.includes(rel)) meta.stagedDeletions = dels.filter((d) => d !== rel);
      changed = true;
    }
  }
  if (changed) saveRepo(ctx, root, meta);
  return ok();
}

function gitCommit(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;

  let message = "";
  let autoStage = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-m" || a === "--message") {
      message = args[i + 1] ?? "";
      i++;
    } else if (a.startsWith("--message=")) {
      message = a.slice("--message=".length);
    } else if (a === "-a") {
      autoStage = true;
    } else if (a === "-am") {
      autoStage = true;
      message = args[i + 1] ?? "";
      i++;
    } else {
      return fail(`fatal: unrecognized argument: '${a}'`);
    }
  }
  if (!message.trim()) return fail('error: no commit message given (use git commit -m "why this change")');

  const head = headFiles(meta);

  if (autoStage) {
    // -a stages edits and deletions of already-tracked files — new files stay out.
    for (const rel of meta.tracked) {
      const abs = absPath(root, rel);
      if (ctx.vfs.isFile(abs)) {
        const content = ctx.vfs.readFile(abs);
        if (head[rel] !== content) meta.staged[rel] = content;
      } else if (!deletionsOf(meta).includes(rel)) {
        meta.stagedDeletions = [...deletionsOf(meta), rel];
      }
    }
  }

  const stagedKeys = sortedKeys(meta.staged);
  const deletions = deletionsOf(meta).sort();
  if (stagedKeys.length === 0 && deletions.length === 0) {
    return fail("nothing to commit (stage files with git add first)");
  }

  const global = readGlobalConfig(ctx);
  const now = ctx.now().getTime();
  const files: Record<string, string> = { ...head };
  for (const rel of deletions) delete files[rel];
  for (const rel of stagedKeys) files[rel] = meta.staged[rel];
  const commit: GitCommit = {
    id: shortHash(`${now}|${message}|${meta.commits.length}`),
    message,
    time: now,
    author: global["user.name"] ?? ctx.user,
    email: global["user.email"] ?? `${ctx.user}@trainer.local`,
    files,
  };
  meta.commits.push(commit);
  meta.staged = {};
  meta.stagedDeletions = [];
  meta.tracked = meta.tracked.filter((rel) => rel in files);
  saveRepo(ctx, root, meta);

  const changed = stagedKeys.length + deletions.length;
  const isRoot = meta.commits.length === 1;
  const lines = [`[${meta.branch}${isRoot ? " (root-commit)" : ""} ${commit.id}] ${message}`];
  lines.push(` ${changed} file${changed === 1 ? "" : "s"} changed`);
  const parentFiles = meta.commits.length > 1 ? meta.commits[meta.commits.length - 2].files : {};
  for (const rel of stagedKeys) {
    if (!(rel in parentFiles)) lines.push(` create mode 100644 ${rel}`);
  }
  for (const rel of deletions) {
    if (rel in parentFiles) lines.push(` delete mode 100644 ${rel}`);
  }
  return ok(lines.join("\n") + "\n");
}

function gitLog(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { meta } = repo;
  if (meta.commits.length === 0) {
    return fail(`fatal: your current branch '${meta.branch}' does not have any commits yet`, 128);
  }

  let oneline = false;
  let stat = false;
  let patch = false;
  let limit: number | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--oneline") oneline = true;
    else if (a === "--stat") stat = true;
    else if (a === "-p" || a === "--patch") patch = true;
    else if (a === "-n") {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 0) return fail("fatal: invalid number of commits");
      limit = n;
    } else if (/^-\d+$/.test(a)) {
      limit = parseInt(a.slice(1), 10);
    } else {
      return fail(`fatal: unrecognized argument: '${a}'`);
    }
  }

  const shown = limit === null ? meta.commits : meta.commits.slice(meta.commits.length - limit);
  const blocks: string[] = [];
  for (let k = shown.length - 1; k >= 0; k--) {
    const globalIndex = meta.commits.length - shown.length + k;
    const c = meta.commits[globalIndex];
    const parent = globalIndex > 0 ? meta.commits[globalIndex - 1] : null;
    if (oneline) {
      let line = `${c.id} ${c.message}`;
      if (stat) line += "\n" + statBlock(parent?.files ?? {}, c.files);
      blocks.push(line);
      continue;
    }
    let block = commitHeader(c);
    if (stat) block += "\n\n" + statBlock(parent?.files ?? {}, c.files);
    if (patch) block += "\n\n" + treePatch(parent?.files ?? {}, c.files);
    blocks.push(block);
  }
  // Plain --oneline lines sit tight together; richer entries get blank lines.
  const separator = oneline && !stat && !patch ? "\n" : "\n\n";
  return ok(blocks.join(separator) + "\n");
}

function gitShow(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { meta } = repo;
  if (meta.commits.length === 0) {
    return fail(`fatal: your current branch '${meta.branch}' does not have any commits yet`, 128);
  }

  const ref = args.find((a) => !a.startsWith("-")) ?? "HEAD";
  const flags = args.filter((a) => a.startsWith("-"));
  for (const f of flags) {
    if (f !== "--stat") return fail(`fatal: unrecognized argument: '${f}'`);
  }
  const found = resolveCommit(meta, ref);
  if (!found) return fail(`fatal: ambiguous argument '${ref}': unknown revision`);

  const parent = found.index > 0 ? meta.commits[found.index - 1] : null;
  let out = commitHeader(found.commit);
  if (flags.includes("--stat")) out += "\n\n" + statBlock(parent?.files ?? {}, found.commit.files);
  out += "\n\n" + treePatch(parent?.files ?? {}, found.commit.files);
  return ok(out + "\n");
}

function gitDiff(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  if (meta.commits.length === 0) {
    return fail(`fatal: your current branch '${meta.branch}' does not have any commits yet`, 128);
  }

  let staged = false;
  const refs: string[] = [];
  for (const a of args) {
    if (a === "--staged" || a === "--cached") staged = true;
    else if (a.startsWith("-")) return fail(`fatal: unrecognized argument: '${a}'`);
    else refs.push(a);
  }

  const pairs = new Map<string, { before: string | null; after: string | null }>();

  if (refs.length >= 2) {
    const from = resolveCommit(meta, refs[0]);
    const to = resolveCommit(meta, refs[1]);
    if (!from) return fail(`fatal: ambiguous argument '${refs[0]}': unknown revision`);
    if (!to) return fail(`fatal: ambiguous argument '${refs[1]}': unknown revision`);
    for (const path of new Set([...Object.keys(from.commit.files), ...Object.keys(to.commit.files)])) {
      pairs.set(path, { before: from.commit.files[path] ?? null, after: to.commit.files[path] ?? null });
    }
  } else if (staged) {
    // Staging area vs HEAD.
    const deletions = deletionsOf(meta);
    for (const path of new Set([...Object.keys(meta.staged), ...deletions])) {
      const before = headFiles(meta)[path] ?? null;
      const after = deletions.includes(path) ? null : meta.staged[path] ?? null;
      if (before !== after) pairs.set(path, { before, after });
    }
  } else {
    const base = refs[0] ? resolveCommit(meta, refs[0]) : null;
    if (refs[0] && !base) return fail(`fatal: ambiguous argument '${refs[0]}': unknown revision`);
    // "Before" = the given commit, else the effective index (HEAD + staged).
    const beforeTree: Record<string, string> = base ? { ...base.commit.files } : { ...headFiles(meta) };
    if (!base) {
      for (const [rel, content] of Object.entries(meta.staged)) beforeTree[rel] = content;
      for (const rel of deletionsOf(meta)) delete beforeTree[rel];
    }
    for (const path of new Set([...Object.keys(beforeTree), ...meta.tracked])) {
      const abs = absPath(root, path);
      const work = ctx.vfs.isFile(abs) ? ctx.vfs.readFile(abs) : null;
      const before = beforeTree[path] ?? null;
      if (work !== before) pairs.set(path, { before, after: work });
    }
  }

  const blocks: string[] = [];
  for (const path of [...pairs.keys()].sort()) {
    const { before, after } = pairs.get(path)!;
    const patch = unifiedDiff(before, after, path);
    if (patch) blocks.push(patch);
  }
  return ok(blocks.length > 0 ? blocks.join("\n") + "\n" : "");
}

function gitRm(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;

  let cached = false;
  const targets: string[] = [];
  for (const a of args) {
    if (a === "--cached") cached = true;
    else if (a.startsWith("-")) return fail(`fatal: unrecognized argument: '${a}'`);
    else targets.push(a);
  }
  if (targets.length === 0) return fail("fatal: No paths were given, nothing to remove.");

  for (const target of targets) {
    const abs = ctx.vfs.resolve(target);
    const rel = relPath(root, abs);
    const known = meta.tracked.includes(rel) || rel in meta.staged || deletionsOf(meta).includes(rel);
    if (!known || rel === ".git") {
      return fail(`fatal: pathspec '${target}' did not match any files`);
    }
    if (!cached && ctx.vfs.isFile(abs)) ctx.vfs.remove(abs, false);
    meta.tracked = meta.tracked.filter((t) => t !== rel);
    delete meta.staged[rel];
    if (!deletionsOf(meta).includes(rel)) meta.stagedDeletions = [...deletionsOf(meta), rel];
  }
  saveRepo(ctx, root, meta);
  return ok();
}

function gitMv(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;

  const paths = args.filter((a) => !a.startsWith("-"));
  if (paths.length !== 2) return fail("usage: git mv <source> <destination>");
  const [fromArg, toArg] = paths;

  const fromAbs = ctx.vfs.resolve(fromArg);
  const fromRel = relPath(root, fromAbs);
  if (!ctx.vfs.isFile(fromAbs)) return fail(`fatal: bad source, source '${fromArg}' does not exist`);
  if (!meta.tracked.includes(fromRel)) return fail(`fatal: not under version control, source '${fromArg}'`);

  const toAbs = ctx.vfs.resolve(toArg);
  const toRel = relPath(root, toAbs);
  if (toRel === fromRel) return ok();
  if (toRel === ".git" || toRel.startsWith("../") || toRel === "") return fail(`fatal: bad destination '${toArg}'`);
  if (ctx.vfs.exists(toAbs)) return fail(`fatal: destination exists, destination '${toArg}'`);

  ctx.vfs.ensureDir(ctx.vfs.parentOf(toAbs));
  ctx.vfs.writeFile(toAbs, ctx.vfs.readFile(fromAbs));
  ctx.vfs.remove(fromAbs, false);

  meta.tracked = meta.tracked.map((t) => (t === fromRel ? toRel : t));
  if (fromRel in meta.staged) {
    meta.staged[toRel] = meta.staged[fromRel];
    delete meta.staged[fromRel];
  } else {
    meta.staged[toRel] = ctx.vfs.readFile(toAbs);
  }
  const dels = deletionsOf(meta).filter((d) => d !== fromRel);
  if (!dels.includes(fromRel)) dels.push(fromRel);
  meta.stagedDeletions = dels;
  saveRepo(ctx, root, meta);
  return ok();
}

// ---------- dispatcher ----------

export const git: CommandImpl = (ctx, args) => {
  try {
    return gitDispatch(ctx, args);
  } catch (e) {
    // Never let a VfsError escape into the UI — surface it as command output.
    return fail(`git: ${(e as Error).message}`, 1);
  }
};

function gitDispatch(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const sub = args[0];
  if (sub === undefined || sub === "-h" || sub === "--help") return ok(USAGE + "\n");

  if (sub === "help") {
    const topic = args[1];
    if (topic === undefined) return ok(USAGE + "\n");
    const page = HELP[topic];
    return page ? ok(page + "\n") : fail(`git: no help for '${topic}'`);
  }

  if (!(sub in HELP)) return fail(`git: '${sub}' is not a git command. See 'git --help'.`);
  if (args.includes("-h")) return ok(HELP[sub] + "\n");

  switch (sub) {
    case "config":
      return gitConfig(ctx, args.slice(1));
    case "init":
      return gitInit(ctx, args.slice(1));
    case "status":
      return gitStatus(ctx, args.slice(1));
    case "add":
      return gitAdd(ctx, args.slice(1));
    case "commit":
      return gitCommit(ctx, args.slice(1));
    case "log":
      return gitLog(ctx, args.slice(1));
    case "show":
      return gitShow(ctx, args.slice(1));
    case "diff":
      return gitDiff(ctx, args.slice(1));
    case "rm":
      return gitRm(ctx, args.slice(1));
    case "mv":
      return gitMv(ctx, args.slice(1));
    default:
      return fail(`git: '${sub}' is not a git command. See 'git --help'.`);
  }
}
