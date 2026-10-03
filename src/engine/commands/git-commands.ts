/**
 * Simulated git: config, init, status, add, commit, log, show, diff, rm, mv
 * (+ help / -h). Pure TypeScript - no UI imports.
 *
 * Scope: the first-commit workflow plus the inspection and cleanup verbs a
 * beginner meets next (history flags, diffs, untracking, renames), extended
 * with local branches: `branch`, `switch` (and the older `checkout` spelling)
 * and `merge` — fast-forwards, merge commits, and simulated conflicts with
 * `--continue` / `--abort`. Remotes are other repository files on this disk:
 * `remote add`, `push`, `fetch`, `pull` and `clone` really move commits
 * between them, and `git branch -a` also lists remote-tracking refs.
 * Repository state lives in a `.git` file at
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
  /**
   * Parent commit ids (two for a merge commit). Optional: repos written
   * before branches existed are linear, so the previous array entry is the
   * parent — see parentsOf().
   */
  parents?: string[];
}

/** An in-progress conflicted merge (real git's MERGE_HEAD state). */
interface MergeState {
  /** branch being merged into (the one you are standing on) */
  ours: string;
  /** branch being merged */
  theirs: string;
  /** common ancestor commit id, null when the two sides share no history */
  base: string | null;
  /** commit message to use once the conflicts are resolved */
  message: string;
  /** paths that stopped with conflict markers in the working tree */
  conflicted: string[];
}

/** A saved working-tree snapshot (real git's stash). */
interface StashEntry {
  branch: string;
  /** the branch head's message at save time, shown by `git stash list` */
  message: string;
  time: number;
  /** tracked paths that differed from HEAD; null = file was deleted */
  files: Record<string, string | null>;
}

interface GitMeta {
  version: number;
  branch: string;
  /** name -> tip commit id ("" = branch with no commits). Absent on older repos. */
  branches?: Record<string, string>;
  /** what `git switch -` jumps back to */
  previousBranch?: string;
  /** set while a conflicted merge waits for --continue / --abort */
  merge?: MergeState;
  commits: GitCommit[];
  staged: Record<string, string>;
  /** Paths staged for deletion (git rm / rm --cached); optional for older repos. */
  stagedDeletions?: string[];
  tracked: string[];
  local: Record<string, string>;
  /** lightweight tags: name -> commit id (absent on older repos). */
  tags?: Record<string, string>;
  /** saved working trees; stash@{0} is the newest entry. */
  stash?: StashEntry[];
  /** remote name -> absolute path of its serialized repository file */
  remotes?: Record<string, string>;
  /** remote-tracking refs: "origin/main" -> commit id */
  tracking?: Record<string, string>;
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
   branch   list, create, delete or rename branches
   switch   move to another branch (-c creates it, - jumps back)
   checkout older spelling of switch (branch forms only)
   merge    bring another branch into this one (--no-ff, --continue, --abort)
   restore  throw away changes; --staged takes a file back out of the index
   reset    move a branch backwards (--soft keeps changes, --hard discards)
   stash    shelve uncommitted work (stash list, stash pop)
   tag      mark a commit with a name (lightweight tags)
   remote   list servers this repo knows (remote add <name> <path>)
   push     upload a branch (push [-u] <remote> <branch>)
   fetch    download a remote's branches (updates <remote>/<branch> refs)
   pull     fetch and fast-forward the current branch
   clone    copy a remote repository into a new folder

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
  git log [--oneline] [--stat] [-p] [-n <number>] [<ref>]
  git log --grep <text>            only commits whose message contains <text>
  git log --author <name>          only commits by that author
  git log --since <date> [--until <date>]  only commits that day or later
                                    (dates are YYYY-MM-DD)

DESCRIPTION
  Each entry shows the commit id, the author, the date and the message.
  --oneline collapses each commit to one line, --stat lists the files
  each commit changed, -p shows the full patch, -n limits to the last N.
  With a <ref> (branch, tag or id) the walk starts there instead of HEAD.`,
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
  git diff <commit1> <commit2>      changes between two commits (ids, branches, tags)
  git diff <commit>                 changes since that commit
  git diff --name-only              just the names of the changed files
  git diff -- <path>...             only those paths

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
  branch: `git branch - list, create, delete or rename branches

USAGE
  git branch                 list local branches (* marks the one you are on)
  git branch -v              also show each branch's last commit
  git branch -a              local branches plus origin/main tracking refs
  git branch <name>          create a branch here, without switching to it
  git branch -d <name>       delete a branch that is fully merged (safe)
  git branch -D <name>       delete it even when it is not merged
  git branch -m <old> <new>  rename a branch

DESCRIPTION
  A branch is a name pointing at a commit. Creating one records where you
  are now; the name only moves when commits land on it. -d refuses to lose
  work: it deletes only when the branch's commits are already reachable
  from where you are standing.`,
  switch: `git switch - move to another branch

USAGE
  git switch <branch>        move to an existing branch
  git switch -c <new-branch> create it and move onto it in one step
  git switch -               jump back to the branch you were on before

DESCRIPTION
  The branch you are standing on is the one that moves. The working tree is
  replaced with the target branch's files, so switch refuses while
  uncommitted changes would be lost — commit first. checkout <branch> and
  checkout -b <new-branch> are the older spellings of the same moves.`,
  checkout: `git checkout - older spelling of git switch

USAGE
  git checkout <branch>        move to an existing branch
  git checkout -b <new-branch> create it and move onto it
  git checkout -               jump back to the previous branch

DESCRIPTION
  Same effect as git switch for branches; git switch just says what it
  does. Restoring a single file (git checkout -- <file>) is not simulated.`,
  merge: `git merge - bring another branch into the one you are on

USAGE
  git merge <branch>          merge <branch> INTO the branch you are on
  git merge --no-ff <branch>  always write a merge commit
  git merge --continue        finish after resolving conflicts
  git merge --abort           cancel the merge and restore the working tree

DESCRIPTION
  Check git status first: the branch you are standing on is the one that
  moves. When the other branch is strictly ahead Git fast-forwards (moves
  the name) unless --no-ff forces a merge commit. Diverged histories get a
  merge commit joining both lines. Files both sides changed differently
  stop with conflict markers (<<<<<<< HEAD ... ======= ... >>>>>>>) in the
  working tree: edit them, then run git merge --continue (it stages the
  resolution), or give up with git merge --abort.`,
  restore: `git restore - throw away changes or unstage a file

USAGE
  git restore <file>...           discard uncommitted edits (back to the index)
  git restore --staged <file>...  unstage: put the file back in the index as
                                  it looks in the last commit

DESCRIPTION
  The safe undo: it never touches history, only files. --staged is how you
  take something back out of the staging area before committing.`,
  reset: `git reset - move a branch (and maybe the working tree) backwards

USAGE
  git reset --soft <commit>    move the branch only - changes stay staged
  git reset [--mixed] <commit> move the branch and unstage - files keep edits
  git reset --hard <commit>    move the branch and throw everything away

DESCRIPTION
  Reset rewrites where a branch points. --soft is how you redo a commit
  with a better message (reset --soft HEAD~1, then commit again); --hard
  is the emergency button that discards changes. The commit defaults to HEAD.`,
  stash: `git stash - temporarily shelve uncommitted work

USAGE
  git stash           save your dirty work and clean the working tree
  git stash list      show saved stashes (stash@{0} is the newest)
  git stash pop       put the newest stash back and drop it

DESCRIPTION
  Stashing answers "I need a clean tree right now": save your edits,
  switch or merge safely, then pop them back where you left off.
  Only tracked files are stashed; untracked files stay put.`,
  tag: `git tag - mark a commit with a name

USAGE
  git tag             list all tags
  git tag <name> [<ref>]  create a tag at <ref> (default: HEAD)

DESCRIPTION
  Tags are permanent labels for releases: name a commit v1.0, then log,
  show and diff accept the name anywhere a commit is expected.`,
  remote: `git remote - list the servers this repository talks to

USAGE
  git remote                    list them (with fetch/push lines)
  git remote add <name> <path>  remember a repository file as a server

DESCRIPTION
  A remote is just a stored address. The simulator's remotes point at
  other repository files on this disk, so push/fetch/clone really move
  commits between them.`,
  push: `git push - upload your commits to a remote

USAGE
  git push [-u] <remote> <branch>

DESCRIPTION
  Copies the branch's commits to the remote and moves its branch there.
  Only fast-forward pushes are accepted: if the remote has commits you
  lack, fetch (or pull) first. -u records the connection so later
  'git push' alone knows where to go.`,
  fetch: `git fetch - download a remote's branches without merging

USAGE
  git fetch [<remote>]          default remote: origin

DESCRIPTION
  Brings the remote's commits into your repository and refreshes the
  remote-tracking refs (origin/main and friends) you can log, show and
  diff. Nothing on your branches changes until you merge or pull.`,
  pull: `git pull - fetch the current branch's upstream and fast-forward

USAGE
  git pull                      uses origin and your current branch

DESCRIPTION
  = git fetch + fast-forward. Your branch must be strictly behind the
  upstream (origin/<branch>); if you have diverged, merge by hand instead.
  Uncommitted changes that would be overwritten stop the pull.`,
  clone: `git clone - copy a remote repository into a new folder

USAGE
  git clone <path> [<directory>]

DESCRIPTION
  Creates <directory> (named after the path by default) containing the
  remote's full history, checked-out files, and origin preconfigured —
  the other half of push: commit here, push, then clone or pull over
  there.`,
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

// ---------- history and branch helpers ----------

function commitIndex(meta: GitMeta, id: string): number {
  return meta.commits.findIndex((c) => c.id === id);
}

function commitById(meta: GitMeta, id: string): GitCommit | null {
  const i = commitIndex(meta, id);
  return i >= 0 ? meta.commits[i] : null;
}

/** name -> tip commit id. Legacy repos predate the map: one implicit branch. */
function branchTips(meta: GitMeta): Record<string, string> {
  if (meta.branches) return meta.branches;
  const last = meta.commits[meta.commits.length - 1];
  return { [meta.branch]: last ? last.id : "" };
}

/** Same as branchTips, but materialises the map so callers can write to it. */
function mutableBranchTips(meta: GitMeta): Record<string, string> {
  if (!meta.branches) meta.branches = { ...branchTips(meta) };
  return meta.branches;
}

function tipOf(meta: GitMeta, branch: string): string {
  return branchTips(meta)[branch] ?? "";
}

/** Parent ids. Commits written before branches existed are linear. */
function parentsOf(meta: GitMeta, c: GitCommit): string[] {
  if (c.parents) return c.parents;
  const i = commitIndex(meta, c.id);
  return i > 0 ? [meta.commits[i - 1].id] : [];
}

/** The commit HEAD points at: the tip of the current branch. */
function headCommit(meta: GitMeta): GitCommit | null {
  const id = tipOf(meta, meta.branch);
  return id ? commitById(meta, id) : null;
}

function headFiles(meta: GitMeta): Record<string, string> {
  return headCommit(meta)?.files ?? {};
}

/** Every commit reachable from the given tips, following parent links. */
function reachable(meta: GitMeta, tips: string[]): GitCommit[] {
  const seen = new Set<string>();
  const out: GitCommit[] = [];
  const stack = tips.filter((t) => t.length > 0);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    const c = commitById(meta, id);
    if (!c) continue;
    seen.add(id);
    out.push(c);
    for (const p of parentsOf(meta, c)) stack.push(p);
  }
  return out;
}

/** Newest first — commit time, then creation order. This is git log's order. */
function byRecency(meta: GitMeta, list: GitCommit[]): GitCommit[] {
  return [...list].sort((a, b) => b.time - a.time || commitIndex(meta, b.id) - commitIndex(meta, a.id));
}

/** Is `ancestor` reachable from `descendant`? Used by merge and branch -d. */
function isAncestor(meta: GitMeta, ancestor: string, descendant: string): boolean {
  if (!ancestor) return false;
  return reachable(meta, [descendant]).some((c) => c.id === ancestor);
}

/** Nearest commit both sides descend from (fewest hops), or null. */
function commonAncestor(meta: GitMeta, a: string, b: string): string | null {
  const depths = new Map<string, number>();
  const fromA: Array<[string, number]> = [[a, 0]];
  while (fromA.length > 0) {
    const [id, d] = fromA.shift()!;
    if (depths.has(id)) continue;
    depths.set(id, d);
    const c = commitById(meta, id);
    if (c) for (const p of parentsOf(meta, c)) fromA.push([p, d + 1]);
  }
  let best: string | null = null;
  let bestSum = Infinity;
  const fromB: Array<[string, number]> = [[b, 0]];
  const seen = new Set<string>();
  while (fromB.length > 0) {
    const [id, d] = fromB.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const da = depths.get(id);
    if (da !== undefined && da + d < bestSum) {
      bestSum = da + d;
      best = id;
    }
    const c = commitById(meta, id);
    if (c) for (const p of parentsOf(meta, c)) fromB.push([p, d + 1]);
  }
  return best;
}

/** Tracked files whose working copy differs from the index. Untracked files are free to move. */
function dirtyPaths(ctx: ShellContext, root: string, meta: GitMeta): string[] {
  const head = headFiles(meta);
  const out = new Set<string>();
  for (const rel of Object.keys(meta.staged)) {
    if (meta.staged[rel] !== head[rel]) out.add(rel);
  }
  for (const rel of deletionsOf(meta)) out.add(rel);
  for (const rel of meta.tracked) {
    const abs = absPath(root, rel);
    const work = ctx.vfs.isFile(abs) ? ctx.vfs.readFile(abs) : null;
    const index = rel in meta.staged ? meta.staged[rel] : head[rel] ?? null;
    if (work !== index) out.add(rel);
  }
  return [...out].sort();
}

/** Replace the working tree with `files` and reset the index (checkout/merge). */
function checkoutFiles(ctx: ShellContext, root: string, meta: GitMeta, files: Record<string, string>): void {
  const keep = new Set(Object.keys(files));
  for (const rel of meta.tracked) {
    if (keep.has(rel)) continue;
    const abs = absPath(root, rel);
    if (ctx.vfs.isFile(abs)) ctx.vfs.remove(abs, false);
  }
  for (const [rel, content] of Object.entries(files)) {
    const abs = absPath(root, rel);
    const dir = ctx.vfs.parentOf(abs);
    if (!ctx.vfs.isDir(dir)) ctx.vfs.ensureDir(dir);
    ctx.vfs.writeFile(abs, content);
  }
  meta.tracked = Object.keys(files);
  meta.staged = {};
  meta.stagedDeletions = [];
}

function sortedKeys(rec: Record<string, string>): string[] {
  return Object.keys(rec).sort();
}

/** HEAD (the current branch's tip), HEAD~<n> along first parents, or an id prefix. */
function resolveCommit(meta: GitMeta, ref: string): { commit: GitCommit; index: number } | null {
  if (ref === "HEAD") {
    const head = headCommit(meta);
    return head ? { commit: head, index: commitIndex(meta, head.id) } : null;
  }
  const tilde = ref.match(/^HEAD~(\d+)$/);
  if (tilde) {
    const start = headCommit(meta);
    if (!start) return null;
    let current: GitCommit = start;
    const n = parseInt(tilde[1], 10);
    for (let i = 0; i < n; i++) {
      const parentId = parentsOf(meta, current)[0];
      const next = parentId ? commitById(meta, parentId) : null;
      if (!next) return null;
      current = next;
    }
    return { commit: current, index: commitIndex(meta, current.id) };
  }
  const named =
    branchTips(meta)[ref] ??
    (meta.tags ? meta.tags[ref] : undefined) ??
    (meta.tracking ? meta.tracking[ref] : undefined);
  if (named) {
    const c = commitById(meta, named);
    if (c) return { commit: c, index: commitIndex(meta, c.id) };
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

function commitHeader(c: GitCommit, parents: string[] = []): string {
  const merge = parents.length > 1 ? `Merge: ${parents.join(" ")}\n` : "";
  return `commit ${c.id}\n${merge}Author: ${c.author} <${c.email}>\nDate:   ${gitDate(c.time)}\n\n    ${c.message}`;
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
  // Paths still carrying conflict markers belong to a merge in progress.
  const conflicted = (meta.merge?.conflicted ?? []).filter((rel) => {
    const abs = absPath(root, rel);
    return ctx.vfs.isFile(abs) && ctx.vfs.readFile(abs).includes("<<<<<<<");
  });

  const stagedKeys = sortedKeys(meta.staged);
  const modified: string[] = [];
  const deleted: string[] = [];
  for (const rel of meta.tracked) {
    if (conflicted.includes(rel)) continue;
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
    for (const rel of conflicted) {
      const row = { x: "U", y: "U", path: rel };
      const i = rows.findIndex((r) => r.path === rel);
      if (i >= 0) rows[i] = row;
      else rows.push(row);
    }
    for (const rel of untracked) rows.push({ x: "?", y: "?", path: rel });
    rows.sort((p, q) => p.path.localeCompare(q.path));
    return ok(rows.map((r) => `${r.x}${r.y} ${r.path}`).join("\n") + (rows.length > 0 ? "\n" : ""));
  }

  const lines: string[] = [`On branch ${meta.branch}`];
  if (meta.commits.length === 0) lines.push("No commits yet");
  if (conflicted.length > 0) {
    lines.push("You have unmerged paths.");
    lines.push('  (fix the conflicts, then run "git merge --continue")');
    lines.push("");
    lines.push("Unmerged paths:");
    for (const rel of conflicted) lines.push(`        both modified:   ${rel}`);
    lines.push("");
  }

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
  if (conflicted.length > 0) {
    lines.push('nothing added to commit (use "git add" and/or "git commit -a")');
  } else if (nothingStaged && modified.length === 0 && deleted.length === 0 && untracked.length === 0) {
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

  const parentCommit = headCommit(meta);
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
    parents: parentCommit ? [parentCommit.id] : [],
  };
  meta.commits.push(commit);
  // The current branch (materialised for repos created before branches) now
  // points at this commit; other branches stay where they were.
  mutableBranchTips(meta)[meta.branch] = commit.id;
  meta.staged = {};
  meta.stagedDeletions = [];
  meta.tracked = meta.tracked.filter((rel) => rel in files);
  saveRepo(ctx, root, meta);

  const changed = stagedKeys.length + deletions.length;
  const isRoot = !parentCommit;
  const lines = [`[${meta.branch}${isRoot ? " (root-commit)" : ""} ${commit.id}] ${message}`];
  lines.push(` ${changed} file${changed === 1 ? "" : "s"} changed`);
  const parentFiles = parentCommit ? parentCommit.files : {};
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
  let all = false;
  let graph = false;
  let limit: number | null = null;
  let grep: string | null = null;
  let author: string | null = null;
  let since: number | null = null;
  let until: number | null = null;
  let ref: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--oneline") oneline = true;
    else if (a === "--stat") stat = true;
    else if (a === "-p" || a === "--patch") patch = true;
    else if (a === "--all") all = true;
    else if (a === "--graph") graph = true;
    else if (a === "-n") {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 0) return fail("fatal: invalid number of commits");
      limit = n;
    } else if (/^-\d+$/.test(a)) {
      limit = parseInt(a.slice(1), 10);
    } else if (a === "--grep" || a === "--author" || a === "--since" || a === "--until") {
      const value = args[++i];
      if (value === undefined) return fail(`fatal: option '${a}' requires a value`);
      if (a === "--grep") grep = value;
      else if (a === "--author") author = value;
      else {
        const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN;
        if (Number.isNaN(day)) return fail(`fatal: invalid date: '${value}'`);
        if (a === "--since") since = day;
        else until = day + 86_399_999; // inclusive: the whole day counts
      }
    } else if (a.startsWith("-")) {
      return fail(`fatal: unrecognized argument: '${a}'`);
    } else if (ref === null) {
      ref = a;
    } else {
      return fail(`fatal: unrecognized argument: '${a}'`);
    }
  }

  // History = everything reachable from the given ref's tip (or from every
  // branch tip with --all), newest first. Merges pull in both parents.
  let tips: string[];
  if (ref !== null) {
    const start = resolveCommit(meta, ref);
    if (!start) return fail(`fatal: ambiguous argument '${ref}': unknown revision or path not in the working tree`);
    tips = [start.commit.id];
  } else {
    tips = all
      ? [
          ...new Set(
            [...Object.values(branchTips(meta)), ...Object.values(meta.tracking ?? {})].filter(
              (t) => t.length > 0
            )
          ),
        ]
      : [tipOf(meta, meta.branch)];
  }
  let pool = byRecency(meta, reachable(meta, tips));
  if (pool.length === 0) {
    return fail(`fatal: your current branch '${meta.branch}' does not have any commits yet`, 128);
  }
  if (grep !== null) pool = pool.filter((c) => c.message.includes(grep!));
  if (author !== null) pool = pool.filter((c) => c.author.includes(author!));
  if (since !== null) pool = pool.filter((c) => c.time >= since!);
  if (until !== null) pool = pool.filter((c) => c.time <= until!);
  const shown = limit === null ? pool : pool.slice(0, limit);
  const prefixes = graph ? graphPrefixes(meta, shown) : null;

  const blocks: string[] = [];
  for (let k = 0; k < shown.length; k++) {
    const c = shown[k];
    const parents = parentsOf(meta, c);
    const parentTree = parents[0] ? commitById(meta, parents[0])?.files ?? {} : {};
    const prefix = prefixes ? prefixes[k] : "";
    if (oneline) {
      let line = `${prefix}${c.id} ${c.message}`;
      if (stat) line += "\n" + statBlock(parentTree, c.files);
      blocks.push(line);
      continue;
    }
    let block = prefix + commitHeader(c, parents);
    if (stat) block += "\n\n" + statBlock(parentTree, c.files);
    if (patch) block += "\n\n" + treePatch(parentTree, c.files);
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

  const parents = parentsOf(meta, found.commit);
  const parent = parents[0] ? commitById(meta, parents[0]) : null;
  let out = commitHeader(found.commit, parents);
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
  let nameOnly = false;
  let sep = false;
  const refs: string[] = [];
  const specs: string[] = [];
  for (const a of args) {
    if (sep) specs.push(a);
    else if (a === "--") sep = true;
    else if (a === "--staged" || a === "--cached") staged = true;
    else if (a === "--name-only") nameOnly = true;
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

  if (specs.length > 0) {
    for (const path of [...pairs.keys()]) {
      if (!specs.some((spec) => path === spec || path.startsWith(spec + "/"))) pairs.delete(path);
    }
  }
  const changed = [...pairs.keys()]
    .filter((path) => {
      const { before, after } = pairs.get(path)!;
      return before !== after;
    })
    .sort();
  if (nameOnly) return ok(changed.length > 0 ? changed.join("\n") + "\n" : "");
  const blocks: string[] = [];
  for (const path of changed) {
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

// ---------- graph rendering ----------

/**
 * Column markers for `git log --graph`: one cell per column, `*` on the
 * commit itself, `|` on columns that still have commits to print, blank
 * otherwise. A merge opens a column to the right of its line. Simplified
 * layout: the edge lines git draws (`|\`, `|/`) are omitted.
 */
function graphPrefixes(meta: GitMeta, ordered: GitCommit[]): string[] {
  const columns: Array<string | null> = [];
  const out: string[] = [];
  for (const c of ordered) {
    let col = columns.indexOf(c.id);
    if (col === -1) {
      col = columns.indexOf(null);
      if (col === -1) {
        columns.push(null);
        col = columns.length - 1;
      }
      columns[col] = c.id;
    }
    // The commit closes its line in every other column.
    for (let j = 0; j < columns.length; j++) {
      if (j !== col && columns[j] === c.id) columns[j] = null;
    }
    out.push(columns.map((id, j) => (j === col ? "*" : id ? "|" : " ")).join(" ") + " ");
    const parents = parentsOf(meta, c);
    columns[col] = parents[0] ?? null;
    if (parents.length > 1) columns.splice(col + 1, 0, parents[1]);
  }
  return out;
}

// ---------- branches, switching, merging ----------

const BRANCH_NAME_RE = /^[\w][\w./-]*$/;

// ---------- restore / reset / stash / tag ----------

/** git restore: worktree back from the index, or index back from HEAD. */
function gitRestore(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  let staged = false;
  const targets: string[] = [];
  for (const a of args) {
    if (a === "--staged" || a === "--cached") staged = true;
    else if (a === "--") continue;
    else if (a.startsWith("-")) return fail(`fatal: unrecognized argument: '${a}'`);
    else targets.push(a);
  }
  if (targets.length === 0) return fail("usage: git restore [--staged] <file>...");

  const head = headFiles(meta);
  for (const rel of targets) {
    const known = meta.tracked.includes(rel) || rel in meta.staged || deletionsOf(meta).includes(rel);
    if (!known) return fail(`error: pathspec '${rel}' did not match any file(s) known to git`);
    if (staged) {
      // Index back to HEAD: drop the staged overlay entirely. A file HEAD has
      // never seen leaves the index too (git add had marked it tracked), so it
      // becomes untracked again; a tracked file stays tracked.
      delete meta.staged[rel];
      meta.stagedDeletions = deletionsOf(meta).filter((d) => d !== rel);
      if (rel in head) {
        if (!meta.tracked.includes(rel)) meta.tracked.push(rel);
      } else {
        meta.tracked = meta.tracked.filter((t) => t !== rel);
      }
      continue;
    }
    // Worktree back to the index (staged content, else HEAD). A file the
    // index says is deleted has nothing to restore — leave it alone.
    const content = deletionsOf(meta).includes(rel)
      ? undefined
      : rel in meta.staged
        ? meta.staged[rel]
        : head[rel];
    if (content === undefined) continue;
    const abs = absPath(root, rel);
    const dir = ctx.vfs.parentOf(abs);
    if (!ctx.vfs.isDir(dir)) ctx.vfs.ensureDir(dir);
    ctx.vfs.writeFile(abs, content);
  }
  if (staged) saveRepo(ctx, root, meta);
  return ok();
}

/** git reset: move the current branch (and optionally the tree) backwards. */
function gitReset(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  if (meta.merge) {
    return fail(
      "fatal: You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes or run git merge --abort first.",
      128
    );
  }
  let mode: "soft" | "mixed" | "hard" = "mixed";
  let ref: string | null = null;
  for (const a of args) {
    if (a === "--soft") mode = "soft";
    else if (a === "--mixed") mode = "mixed";
    else if (a === "--hard") mode = "hard";
    else if (a.startsWith("-")) return fail(`fatal: invalid option: '${a}'`);
    else if (ref === null) ref = a;
    else return fail(`fatal: too many arguments (from '${ref}' to '${a}')`);
  }
  const found = resolveCommit(meta, ref ?? "HEAD");
  if (!found) return fail(`fatal: ambiguous argument '${ref}': unknown revision`);

  const oldHead = headFiles(meta);
  mutableBranchTips(meta)[meta.branch] = found.commit.id;
  if (mode === "hard") checkoutFiles(ctx, root, meta, { ...found.commit.files });
  else if (mode === "mixed") {
    meta.staged = {};
    meta.stagedDeletions = [];
  } else {
    // --soft: the index keeps whatever it held, so the undone work shows up
    // as staged changes against the new head.
    const index: Record<string, string> = { ...oldHead };
    for (const [rel, content] of Object.entries(meta.staged)) index[rel] = content;
    for (const rel of deletionsOf(meta)) delete index[rel];
    const staged: Record<string, string> = {};
    for (const [rel, content] of Object.entries(index)) {
      if (found.commit.files[rel] !== content) staged[rel] = content;
    }
    meta.staged = staged;
    meta.stagedDeletions = Object.keys(found.commit.files).filter((rel) => !(rel in index));
  }
  saveRepo(ctx, root, meta);
  if (mode === "soft") return ok();
  return ok(`HEAD is now at ${found.commit.id} ${found.commit.message}\n`);
}

/** git stash — save, list and pop shelve working-tree snapshots. */
function gitStash(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  if (args.length > 1) return fail("usage: git stash [push | list | pop]");
  const action = args[0] ?? "push";

  if (action === "list") {
    const entries = meta.stash ?? [];
    const lines = entries.map((e, i) => `stash@{${i}}: WIP on ${e.branch}: ${e.message}`);
    return ok(lines.length > 0 ? lines.join("\n") + "\n" : "");
  }
  if (action !== "push" && action !== "save" && action !== "pop") {
    return fail(`error: 'git stash ${action}' is not simulated (use: stash, stash list, stash pop)`, 1);
  }

  const head = headFiles(meta);
  const headCommitRef = headCommit(meta);

  if (action === "pop") {
    const entries = meta.stash ?? [];
    if (entries.length === 0) return fail("No stash entries found.");
    const entry = entries[0];
    // Refuse to clobber edits made after the stash was taken.
    for (const rel of Object.keys(entry.files)) {
      const abs = absPath(root, rel);
      const work = ctx.vfs.isFile(abs) ? ctx.vfs.readFile(abs) : null;
      if (work !== (head[rel] ?? null)) {
        return fail(`error: local changes to '${rel}' would be overwritten by stash pop`, 1);
      }
    }
    for (const [rel, content] of Object.entries(entry.files)) {
      const abs = absPath(root, rel);
      if (content === null) {
        if (ctx.vfs.isFile(abs)) ctx.vfs.remove(abs, false);
      } else {
        const dir = ctx.vfs.parentOf(abs);
        if (!ctx.vfs.isDir(dir)) ctx.vfs.ensureDir(dir);
        ctx.vfs.writeFile(abs, content);
      }
    }
    meta.stash = entries.slice(1);
    saveRepo(ctx, root, meta);
    return ok(`Dropped refs/stash@{0}\n`);
  }

  // push/save: capture tracked files that differ from HEAD, then clean them.
  const files: Record<string, string | null> = {};
  for (const rel of meta.tracked) {
    const abs = absPath(root, rel);
    const work = ctx.vfs.isFile(abs) ? ctx.vfs.readFile(abs) : null;
    if (work !== (head[rel] ?? null)) files[rel] = work;
  }
  if (Object.keys(files).length === 0) return ok("No local changes to save\n");
  for (const rel of Object.keys(files)) {
    const abs = absPath(root, rel);
    const back = head[rel];
    if (back === undefined) {
      if (ctx.vfs.isFile(abs)) ctx.vfs.remove(abs, false);
    } else {
      const dir = ctx.vfs.parentOf(abs);
      if (!ctx.vfs.isDir(dir)) ctx.vfs.ensureDir(dir);
      ctx.vfs.writeFile(abs, back);
    }
    delete meta.staged[rel];
  }
  meta.stagedDeletions = deletionsOf(meta).filter((d) => !(d in files));
  const entry: StashEntry = {
    branch: meta.branch,
    message: headCommitRef ? headCommitRef.message : "",
    time: ctx.now().getTime(),
    files,
  };
  meta.stash = [entry, ...(meta.stash ?? [])];
  saveRepo(ctx, root, meta);
  return ok(
    `Saved working directory and index state WIP on ${meta.branch}: ${headCommitRef ? `${headCommitRef.id} ${headCommitRef.message}` : ""}\n`
  );
}

/** git tag — lightweight tags: list, or create at a ref (default HEAD). */
function gitTag(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  if (args.length === 0) {
    const names = Object.keys(meta.tags ?? {}).sort();
    return ok(names.length > 0 ? names.join("\n") + "\n" : "");
  }
  if (args.length > 2) return fail("usage: git tag [<name> [<commit>]]");
  const name = args[0];
  const ref = args[1] ?? "HEAD";
  if (!/^[\w][\w./-]*$/.test(name)) return fail(`fatal: invalid tag name '${name}'`);
  if (meta.tags && name in meta.tags) return fail(`fatal: tag '${name}' already exists`, 128);
  const found = resolveCommit(meta, ref);
  if (!found) return fail(`fatal: ambiguous argument '${ref}': unknown revision`, 128);
  meta.tags = { ...(meta.tags ?? {}), [name]: found.commit.id };
  saveRepo(ctx, root, meta);
  return ok();
}

// ---------- remotes: remote / push / fetch / pull / clone ----------

/** Parse a serialized repository file (the simulator's idea of a server). */
function readRepoFile(ctx: ShellContext, abs: string): GitMeta | null {
  if (!ctx.vfs.isFile(abs)) return null;
  try {
    const meta = JSON.parse(ctx.vfs.readFile(abs)) as GitMeta;
    return meta && meta.version === 1 ? meta : null;
  } catch {
    return null;
  }
}

/** Copy every commit reachable from `tip` that `into` does not have yet. */
function copyMissingCommits(into: GitMeta, from: GitMeta, tip: string): void {
  const have = new Set(into.commits.map((c) => c.id));
  const stack = [tip];
  while (stack.length) {
    const id = stack.pop()!;
    if (have.has(id)) continue;
    const c = from.commits.find((x) => x.id === id);
    if (!c) continue;
    into.commits.push({ ...c, files: { ...c.files } });
    have.add(id);
    for (const parent of parentsOf(from, c)) stack.push(parent);
  }
}

/** Resolve a remote name to its server file, or report git's classic error. */
function requireRemote(
  ctx: ShellContext,
  meta: GitMeta,
  name: string
): { path: string; server: GitMeta } | { error: string } {
  const path = (meta.remotes ?? {})[name];
  if (!path) return { error: `fatal: '${name}' does not appear to be a git repository` };
  const server = readRepoFile(ctx, path);
  if (!server) return { error: `fatal: '${path}' does not appear to be a git repository` };
  return { path, server };
}

function gitRemote(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;

  if (!args.length) {
    const remotes = meta.remotes ?? {};
    const lines: string[] = [];
    for (const name of Object.keys(remotes).sort()) {
      lines.push(`${name}\t${remotes[name]} (fetch)`);
      lines.push(`${name}\t${remotes[name]} (push)`);
    }
    return ok(lines.length ? lines.join("\n") + "\n" : "");
  }

  if (args[0] === "add" && args.length === 3) {
    const [, name, raw] = args;
    if (meta.remotes && name in meta.remotes) return fail(`fatal: a remote named '${name}' already exists`);
    if (!/^[\w][\w./-]*$/.test(name)) return fail(`fatal: invalid remote name '${name}'`);
    const abs = ctx.vfs.resolve(raw);
    if (!readRepoFile(ctx, abs)) return fail(`fatal: '${raw}' does not appear to be a git repository`, 128);
    meta.remotes = { ...(meta.remotes ?? {}), [name]: abs };
    saveRepo(ctx, root, meta);
    return ok();
  }
  return fail("usage: git remote [add <name> <path>]");
}

function gitPush(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;

  let upstream = false;
  const positional: string[] = [];
  for (const a of args) {
    if (a === "-u" || a === "--set-upstream") upstream = true;
    else if (a.startsWith("-")) return fail(`git push: unknown option '${a}'`);
    else positional.push(a);
  }
  if (positional.length !== 2) return fail("usage: git push [-u] <remote> <branch>");
  const [remoteName, branchName] = positional;

  const remote = requireRemote(ctx, meta, remoteName);
  if ("error" in remote) return fail(remote.error, 128);
  const { path, server } = remote;
  if (!(branchName in branchTips(meta))) {
    return fail(`error: src refspec ${branchName} does not match any source`, 128);
  }

  const localTip = tipOf(meta, branchName);
  const serverTips = mutableBranchTips(server);
  const remoteTip = serverTips[branchName] ?? "";
  if (remoteTip === localTip) {
    // An up-to-date push still records the remote-tracking ref: that is what
    // -u promises and what git pull / git log origin/main read afterwards.
    meta.tracking = { ...(meta.tracking ?? {}), [`${remoteName}/${branchName}`]: localTip };
    saveRepo(ctx, root, meta);
    return ok("Everything up-to-date\n");
  }
  if (remoteTip && !isAncestor(meta, remoteTip, localTip)) {
    return fail(
      `! [rejected]    ${branchName} -> ${branchName} (non-fast-forward)\n` +
        `error: failed to push some refs to '${path}'\n` +
        `hint: Updates were rejected because the remote contains work that you do not have locally.`,
      1
    );
  }

  copyMissingCommits(server, meta, localTip);
  serverTips[branchName] = localTip;
  ctx.vfs.writeFile(path, JSON.stringify(server));

  // Every push refreshes the remote-tracking ref; -u is accepted for the
  // classic muscle-memory form even though upstreams are not modeled further.
  meta.tracking = { ...(meta.tracking ?? {}), [`${remoteName}/${branchName}`]: localTip };
  saveRepo(ctx, root, meta);

  const arrow = remoteTip
    ? `${remoteTip}..${localTip}  ${branchName} -> ${branchName}`
    : ` * [new branch]      ${branchName} -> ${branchName}`;
  return ok(`To ${path}\n${arrow}\n`);
}

function gitFetch(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  if (args.length >= 2) return fail("usage: git fetch [<remote>]");
  const remoteName = args[0] ?? "origin";

  const remote = requireRemote(ctx, meta, remoteName);
  if ("error" in remote) return fail(remote.error, 128);
  const { path, server } = remote;

  const lines: string[] = [];
  for (const [branch, tip] of Object.entries(branchTips(server))) {
    if (!tip) continue;
    copyMissingCommits(meta, server, tip);
    const ref = `${remoteName}/${branch}`;
    meta.tracking = { ...(meta.tracking ?? {}), [ref]: tip };
    lines.push(` * branch            ${branch} -> ${ref}`);
  }
  saveRepo(ctx, root, meta);
  return ok(`From ${path}\n` + (lines.length ? lines.join("\n") + "\n" : ""));
}

function gitPull(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  if (args.length) return fail("usage: git pull");
  if (meta.merge) {
    return fail(
      "fatal: You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes or run git merge --abort first.",
      128
    );
  }

  // The upstream is <remote>/<current branch> for some configured remote.
  const remotes = meta.remotes ?? {};
  let remoteName: string | null = null;
  for (const name of Object.keys(remotes)) {
    if ((meta.tracking ?? {})[`${name}/${meta.branch}`]) {
      remoteName = name;
      break;
    }
  }
  if (!remoteName) {
    return fail(`There is no tracking information for the current branch '${meta.branch}'.`, 1);
  }
  const remote = requireRemote(ctx, meta, remoteName);
  if ("error" in remote) return fail(remote.error, 128);
  const { path, server } = remote;

  // fetch first: refresh tracking and download any new commits
  const serverTips = branchTips(server);
  for (const tip of Object.values(serverTips)) {
    if (tip) copyMissingCommits(meta, server, tip);
  }
  const upstreamTip = serverTips[meta.branch] ?? "";
  meta.tracking = { ...(meta.tracking ?? {}), [`${remoteName}/${meta.branch}`]: upstreamTip };
  saveRepo(ctx, root, meta);

  const localTip = tipOf(meta, meta.branch);
  if (!upstreamTip || upstreamTip === localTip) return ok("Already up to date.\n");
  if (!isAncestor(meta, localTip, upstreamTip)) {
    return fail("fatal: Not possible to fast-forward, aborting.\nYou need to do a merge first.", 1);
  }
  const dirty = dirtyPaths(ctx, root, meta);
  if (dirty.length) {
    return fail(
      `error: Your local changes to the following files would be overwritten by pull:\n` +
        dirty.map((f) => `\t${f}`).join("\n") +
        `\nPlease commit your changes or stash them before you pull.\nAborting`,
      1
    );
  }
  const oldFiles = headFiles(meta);
  const target = commitById(meta, upstreamTip);
  if (!target) return fail(`fatal: '${path}' does not appear to be a git repository`, 128);
  checkoutFiles(ctx, root, meta, { ...target.files });
  mutableBranchTips(meta)[meta.branch] = upstreamTip;
  saveRepo(ctx, root, meta);
  return ok(`Updating ${localTip}..${upstreamTip}\nFast-forward\n${statBlock(oldFiles, target.files)}\n`);
}

function gitClone(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  // cloning FROM inside a repository is fine
  if (args.length === 0 || args.length >= 3) return fail("usage: git clone <path> [<directory>]");

  const srcAbs = ctx.vfs.resolve(args[0]);
  const server = readRepoFile(ctx, srcAbs);
  if (!server || !server.commits.length) return fail(`fatal: repository '${args[0]}' does not exist`, 128);

  const base = srcAbs.split("/").pop() ?? "repo";
  const dirName = args[1] ?? (base.endsWith(".git") ? base.slice(0, -4) : base);
  const target = ctx.vfs.resolve(dirName);
  if (ctx.vfs.exists(target)) {
    return fail(`fatal: destination path '${dirName}' already exists and is not an empty directory.`, 128);
  }

  const tips = { ...branchTips(server) };
  if (!tips[server.branch]) {
    const fallback = Object.entries(tips).find(([, t]) => t);
    if (fallback) server.branch = fallback[0];
  }
  const checkout = commitById(server, tips[server.branch] ?? "");
  const clone: GitMeta = {
    version: 1,
    branch: server.branch,
    branches: tips,
    commits: server.commits.map((c) => ({ ...c, files: { ...c.files } })),
    staged: {},
    stagedDeletions: [],
    tracked: checkout ? Object.keys(checkout.files).sort() : [...server.tracked],
    local: { ...server.local },
    remotes: { origin: srcAbs },
    tracking: {},
  };
  if (server.tags) clone.tags = { ...server.tags };
  for (const [branch, tip] of Object.entries(tips)) {
    if (tip) clone.tracking![`origin/${branch}`] = tip;
  }

  ctx.vfs.ensureDir(target);
  ctx.vfs.writeFile(target + "/.git", JSON.stringify(clone));
  for (const [rel, content] of Object.entries(checkout ? checkout.files : {})) {
    const abs = target + "/" + rel;
    const dir = ctx.vfs.parentOf(abs);
    if (!ctx.vfs.isDir(dir)) ctx.vfs.ensureDir(dir);
    ctx.vfs.writeFile(abs, content);
  }
  return ok(`Cloning into '${dirName}'...\n`);
}

function gitBranch(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  const tips = mutableBranchTips(meta);

  let showLast = false;
  let showAll = false;
  let mode: "list" | "delete" | "force-delete" | "rename" = "list";
  const positional: string[] = [];
  for (const a of args) {
    if (a === "-v" || a === "-vv" || a === "--verbose") showLast = true;
    else if (a === "-a" || a === "--all") showAll = true; else if (a === "-d" || a === "--delete") mode = "delete";
    else if (a === "-D" || a === "--force-delete") mode = "force-delete";
    else if (a === "-m" || a === "--move") mode = "rename";
    else if (a.startsWith("-")) return fail(`git branch: unknown option '${a}'`);
    else positional.push(a);
  }

  if (mode === "rename") {
    const oldName = positional.length === 1 ? meta.branch : positional[0];
    const newName = positional.length === 1 ? positional[0] : positional[1];
    if (!oldName || !newName) return fail("usage: git branch -m [<old>] <new>");
    if (!(oldName in tips)) return fail(`error: branch '${oldName}' not found`, 1);
    if (newName in tips) return fail(`fatal: a branch named '${newName}' already exists`, 1);
    if (!BRANCH_NAME_RE.test(newName)) return fail(`fatal: '${newName}' is not a valid branch name`, 1);
    tips[newName] = tips[oldName];
    delete tips[oldName];
    if (meta.branch === oldName) meta.branch = newName;
    if (meta.previousBranch === oldName) meta.previousBranch = newName;
    saveRepo(ctx, root, meta);
    return ok();
  }

  if (mode === "delete" || mode === "force-delete") {
    const name = positional[0];
    if (!name) return fail(`usage: git branch -${mode === "delete" ? "d" : "D"} <branch>`);
    if (!(name in tips)) return fail(`error: branch '${name}' not found`, 1);
    if (name === meta.branch) return fail(`fatal: Cannot delete branch '${name}' checked out`, 1);
    const tip = tips[name];
    if (mode === "delete" && tip && !isAncestor(meta, tip, tipOf(meta, meta.branch))) {
      return fail(`error: The branch '${name}' is not fully merged.\n  (use git branch -D ${name} to force)`, 1);
    }
    delete tips[name];
    if (meta.previousBranch === name) delete meta.previousBranch;
    saveRepo(ctx, root, meta);
    return ok(tip ? `Deleted branch ${name} (was ${tip}).\n` : `Deleted branch ${name} (was never started).\n`);
  }

  if (positional.length > 1) return fail("usage: git branch [<name> | -d <name> | -m <old> <new>]");

  if (positional.length === 1) {
    const name = positional[0];
    if (!BRANCH_NAME_RE.test(name)) return fail(`fatal: '${name}' is not a valid branch name`, 1);
    if (name in tips) return fail(`fatal: a branch named '${name}' already exists`, 1);
    // A branch is just a name pointing where HEAD points right now.
    tips[name] = tipOf(meta, meta.branch);
    saveRepo(ctx, root, meta);
    return ok();
  }

  const names = Object.keys(tips).sort();
  const lines = names.map((name) => {
    const tip = tips[name];
    const marker = name === meta.branch ? "* " : "  ";
    if (!showLast || !tip) return `${marker}${name}`;
    const c = commitById(meta, tip);
    return `${marker}${name}  ${tip} ${c ? c.message : ""}`.trimEnd();
  });
  if (showAll) {
    for (const ref of Object.keys(meta.tracking ?? {}).sort()) {
      const tip = meta.tracking![ref];
      const c = tip ? commitById(meta, tip) : null;
      lines.push(showLast && c ? `  ${ref}  ${tip} ${c.message}` : `  ${ref}`);
    }
  }
  return ok(lines.length > 0 ? lines.join("\n") + "\n" : "");
}

function gitSwitch(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  return switchBranch(ctx, args, ["-c", "--create"]);
}

function gitCheckout(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  return switchBranch(ctx, args, ["-b", "--branch"]);
}

/** Shared body of git switch and git checkout's branch forms. */
function switchBranch(ctx: ShellContext, args: string[], createFlags: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  if (meta.merge) {
    return fail(
      "fatal: You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes or run git merge --abort first.",
      128
    );
  }

  let create: string | null = null;
  let back = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") continue;
    if (createFlags.includes(a)) {
      create = args[i + 1] ?? "";
      i++;
      continue;
    }
    if (createFlags.some((f) => a.startsWith(f + "="))) {
      create = a.slice(a.indexOf("=") + 1);
      continue;
    }
    if (a === "-") {
      back = true;
      continue;
    }
    if (a.startsWith("-")) return fail(`git switch: unknown option '${a}'`);
    positional.push(a);
  }

  const tips = mutableBranchTips(meta);
  let target: string;
  let created = false;
  if (create !== null) {
    if (!BRANCH_NAME_RE.test(create)) return fail(`fatal: '${create}' is not a valid branch name`, 128);
    if (create in tips) return fail(`fatal: a branch named '${create}' already exists`, 128);
    tips[create] = tipOf(meta, meta.branch);
    target = create;
    created = true;
  } else if (back) {
    if (!meta.previousBranch || !(meta.previousBranch in tips)) return fail("fatal: no previous branch", 128);
    target = meta.previousBranch;
  } else if (positional.length === 1) {
    target = positional[0];
  } else {
    return fail("usage: git switch [-c <new-branch>] <branch> | git switch -", 128);
  }

  if (!(target in tips)) {
    if (created) delete tips[target];
    return fail(`fatal: invalid reference: ${target}`, 128);
  }
  if (target === meta.branch) {
    if (created) saveRepo(ctx, root, meta);
    return ok(`Already on '${meta.branch}'\n`);
  }

  const sameCommit = tips[target] === tipOf(meta, meta.branch);
  if (!sameCommit) {
    const dirty = dirtyPaths(ctx, root, meta);
    if (dirty.length > 0) {
      return fail(
        `error: Your local changes to the following files would be overwritten by switch:\n` +
          dirty.map((f) => `\t${f}`).join("\n") +
          `\nPlease commit your changes or stash them before you switch.\nAborting`,
        1
      );
    }
    const tip = tips[target];
    const tipCommit = tip ? commitById(meta, tip) : null;
    checkoutFiles(ctx, root, meta, tipCommit ? { ...tipCommit.files } : {});
  }

  const from = meta.branch;
  meta.branch = target;
  meta.previousBranch = from;
  saveRepo(ctx, root, meta);
  if (created) return ok(`Switched to a new branch '${target}'\n`);
  return ok(`Switched to branch '${target}'\n`);
}

/** Three-way merge of two full trees over a common base. */
function mergeTrees(
  base: Record<string, string>,
  ours: Record<string, string>,
  theirs: Record<string, string>,
  theirLabel: string
): { files: Record<string, string>; conflicted: string[] } {
  const paths = [...new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])].sort();
  const files: Record<string, string> = {};
  const conflicted: string[] = [];
  for (const p of paths) {
    const b = base[p] ?? null;
    const o = ours[p] ?? null;
    const t = theirs[p] ?? null;
    let value: string | null;
    if (o === null && t === null) value = null; // deleted on both sides
    else if (o === t) value = o; // same content (both changed alike, or neither)
    else if (b === o) value = t; // only theirs changed
    else if (b === t) value = o; // only ours changed
    else {
      // Both sides changed it differently — keep both, marked up.
      value = conflictMarkers(o ?? "", t ?? "", theirLabel);
      conflicted.push(p);
    }
    if (value !== null) files[p] = value;
  }
  return { files, conflicted };
}

function conflictMarkers(ours: string, theirs: string, theirLabel: string): string {
  const block = (s: string) => (s === "" || s.endsWith("\n") ? s : s + "\n");
  return `<<<<<<< HEAD\n${block(ours)}=======\n${block(theirs)}>>>>>>> ${theirLabel}\n`;
}

function createMergeCommit(
  ctx: ShellContext,
  meta: GitMeta,
  message: string,
  files: Record<string, string>,
  parents: string[]
): GitCommit {
  const global = readGlobalConfig(ctx);
  const now = ctx.now().getTime();
  const commit: GitCommit = {
    id: shortHash(`${now}|${message}|${parents.join("|")}|${meta.commits.length}`),
    message,
    time: now,
    author: global["user.name"] ?? ctx.user,
    email: global["user.email"] ?? `${ctx.user}@trainer.local`,
    files,
    parents,
  };
  meta.commits.push(commit);
  mutableBranchTips(meta)[meta.branch] = commit.id;
  return commit;
}

/** git merge --continue: the working tree now holds the resolutions. */
function finishMerge(
  ctx: ShellContext,
  root: string,
  meta: GitMeta,
  tips: Record<string, string>
): ReturnType<CommandImpl> {
  const st = meta.merge;
  if (!st) return fail("error: There is no merge to continue (MERGE_HEAD missing).");

  const leftover = st.conflicted.filter((rel) => {
    const abs = absPath(root, rel);
    return ctx.vfs.isFile(abs) && ctx.vfs.readFile(abs).includes("<<<<<<<");
  });
  if (leftover.length > 0) {
    return fail(
      `error: you still have conflict markers in:\n` +
        leftover.map((f) => `  ${f}`).join("\n") +
        `\nEdit the file, then run git merge --continue (or git merge --abort to cancel).`
    );
  }

  const ourCommit = commitById(meta, tipOf(meta, st.ours));
  const theirCommit = commitById(meta, tips[st.theirs] ?? "");
  if (!ourCommit || !theirCommit) return fail("error: the branches being merged no longer exist");

  const baseFiles = st.base ? commitById(meta, st.base)?.files ?? {} : {};
  const { files } = mergeTrees(baseFiles, ourCommit.files, theirCommit.files, st.theirs);
  // Whatever the student left in the working tree is the resolution.
  for (const rel of st.conflicted) {
    const abs = absPath(root, rel);
    if (ctx.vfs.isFile(abs)) files[rel] = ctx.vfs.readFile(abs);
    else delete files[rel];
  }

  const commit = createMergeCommit(ctx, meta, st.message, files, [ourCommit.id, theirCommit.id]);
  checkoutFiles(ctx, root, meta, files);
  delete meta.merge;
  saveRepo(ctx, root, meta);

  const changed =
    Object.keys(files).filter((rel) => ourCommit.files[rel] !== files[rel]).length +
    Object.keys(ourCommit.files).filter((rel) => !(rel in files)).length;
  return ok(`[${meta.branch} ${commit.id}] ${st.message}\n ${changed} file${changed === 1 ? "" : "s"} changed\n`);
}

function gitMerge(ctx: ShellContext, args: string[]): ReturnType<CommandImpl> {
  const repo = findRepo(ctx);
  if (!repo) return fail(NOT_A_REPO, 128);
  const { root, meta } = repo;
  const tips = mutableBranchTips(meta);

  let noFf = false;
  let cont = false;
  let abort = false;
  let message: string | null = null;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--no-ff") noFf = true;
    else if (a === "--continue") cont = true;
    else if (a === "--abort") abort = true;
    else if (a === "-m" || a === "--message") message = args[++i] ?? "";
    else if (a.startsWith("--message=")) message = a.slice("--message=".length);
    else if (a.startsWith("-")) return fail(`git merge: unknown option '${a}'`);
    else positional.push(a);
  }

  if (abort) {
    const st = meta.merge;
    if (!st) return fail("error: There is no merge to abort (MERGE_HEAD missing).");
    const ours = commitById(meta, tipOf(meta, st.ours));
    checkoutFiles(ctx, root, meta, ours ? { ...ours.files } : {});
    delete meta.merge;
    saveRepo(ctx, root, meta);
    return ok();
  }

  if (cont) return finishMerge(ctx, root, meta, tips);

  if (positional.length !== 1) {
    return fail("usage: git merge [--no-ff] <branch> | git merge --continue | git merge --abort");
  }
  if (meta.merge) {
    return fail(
      "fatal: You have not concluded your merge (MERGE_HEAD exists).\nUse git merge --continue or git merge --abort.",
      128
    );
  }

  const theirs = positional[0];
  if (!(theirs in tips)) return fail(`fatal: '${theirs}' is not a mergeable branch`, 128);

  const ourTip = tipOf(meta, meta.branch);
  const theirTip = tips[theirs];
  // Nothing to do when their work is already in our history.
  if (!theirTip || theirTip === ourTip || isAncestor(meta, theirTip, ourTip)) return ok("Already up to date.\n");

  const ourCommit = commitById(meta, ourTip);
  const theirCommit = commitById(meta, theirTip);
  if (!ourCommit || !theirCommit) return fail(`fatal: '${theirs}' is not a mergeable branch`, 128);

  const dirty = dirtyPaths(ctx, root, meta);
  if (dirty.length > 0) {
    return fail(
      `error: Your local changes to the following files would be overwritten by merge:\n` +
        dirty.map((f) => `\t${f}`).join("\n") +
        `\nPlease commit your changes or stash them before you merge.\nAborting`,
      1
    );
  }

  const defaultMessage =
    meta.branch === "main" ? `Merge branch '${theirs}'` : `Merge branch '${theirs}' into ${meta.branch}`;
  const mergeMessage = message && message.trim() ? message : defaultMessage;

  // Strictly ahead: move the name (unless --no-ff demands a merge commit).
  if (isAncestor(meta, ourTip, theirTip) && !noFf) {
    tips[meta.branch] = theirTip;
    checkoutFiles(ctx, root, meta, { ...theirCommit.files });
    saveRepo(ctx, root, meta);
    const stat = statBlock(ourCommit.files, theirCommit.files);
    return ok(`Updating ${ourTip.slice(0, 7)}..${theirTip.slice(0, 7)}\nFast-forward\n${stat ? stat + "\n" : ""}`);
  }

  const base = commonAncestor(meta, ourTip, theirTip);
  const baseFiles = base ? commitById(meta, base)?.files ?? {} : {};
  const { files, conflicted } = mergeTrees(baseFiles, ourCommit.files, theirCommit.files, theirs);

  if (conflicted.length > 0) {
    // Apply the merge, markers and all, then wait for --continue / --abort.
    checkoutFiles(ctx, root, meta, files);
    meta.merge = { ours: meta.branch, theirs, base, message: mergeMessage, conflicted };
    saveRepo(ctx, root, meta);
    return fail(
      conflicted.map((rel) => `Auto-merging ${rel}\n`).join("") +
        `CONFLICT (content): Merge conflict in ${conflicted.join(", ")}\n` +
        `Automatic merge failed; fix conflicts and then commit the result.`,
      1
    );
  }

  const commit = createMergeCommit(ctx, meta, mergeMessage, files, [ourTip, theirTip]);
  checkoutFiles(ctx, root, meta, files);
  saveRepo(ctx, root, meta);
  const stat = statBlock(ourCommit.files, files);
  return ok(`[${meta.branch} ${commit.id}] ${mergeMessage}\n${stat ? stat + "\n" : ""}`);
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
    case "branch":
      return gitBranch(ctx, args.slice(1));
    case "switch":
      return gitSwitch(ctx, args.slice(1));
    case "checkout":
      return gitCheckout(ctx, args.slice(1));
    case "merge":
      return gitMerge(ctx, args.slice(1));
    case "restore":
      return gitRestore(ctx, args.slice(1));
    case "reset":
      return gitReset(ctx, args.slice(1));
    case "stash":
      return gitStash(ctx, args.slice(1));
    case "tag":
      return gitTag(ctx, args.slice(1));
    case "remote":
      return gitRemote(ctx, args.slice(1));
    case "push":
      return gitPush(ctx, args.slice(1));
    case "fetch":
      return gitFetch(ctx, args.slice(1));
    case "pull":
      return gitPull(ctx, args.slice(1));
    case "clone":
      return gitClone(ctx, args.slice(1));
    default:
      return fail(`git: '${sub}' is not a git command. See 'git --help'.`);
  }
}
