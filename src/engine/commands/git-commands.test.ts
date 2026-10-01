import { describe, it, expect, beforeEach } from "vitest";
import { Vfs, _resetClock } from "../vfs";
import { Shell } from "./index";

function makeShell(spec?: ConstructorParameters<typeof Vfs>[0], user = "student"): Shell {
  const vfs = new Vfs(spec);
  const home = (spec as { home?: string } | undefined)?.home ?? "/";
  vfs.cwd = home; // a fresh Shell otherwise starts at "/", unlike Session
  return new Shell(vfs, { user, env: { HOME: home } });
}

describe("git config", () => {
  beforeEach(() => _resetClock());

  it("writes and reads global identity outside any repository", () => {
    const sh = makeShell({ dirs: ["/home/student"], home: "/home/student", user: "student" } as never);
    expect(sh.run(`git config --global user.name "Ada Lovelace"`).error).toBeNull();
    expect(sh.run(`git config --global user.email "ada@example.com"`).error).toBeNull();
    expect(sh.run("git config --global user.name").stdout).toBe("Ada Lovelace\n");
    expect(sh.run("git config --global user.email").stdout).toBe("ada@example.com\n");
  });

  it("--list merges global and local, local winning", () => {
    const sh = makeShell({ dirs: ["/home/student/proj"], home: "/home/student" } as never);
    sh.run(`git config --global user.name "Ada Lovelace"`);
    sh.run(`git config --global user.email "ada@example.com"`);
    sh.run("cd proj");
    sh.run("git init");
    sh.run(`git config user.name "Grace Hopper"`);
    const out = sh.run("git config --list").stdout;
    expect(out).toContain("user.name=Grace Hopper");
    expect(out).toContain("user.email=ada@example.com");
  });

  it("reading an unset key fails quietly with code 1", () => {
    const sh = makeShell({ home: "/home/student" } as never);
    expect(sh.run("git config --global user.name").code).toBe(1);
  });

  it("local config outside a repository hints at --global", () => {
    const sh = makeShell({ home: "/home/student" } as never);
    expect(sh.run(`git config user.name "X"`).error).toContain("--global");
  });
});

describe("git init", () => {
  beforeEach(() => _resetClock());

  it("creates a repository and is idempotent", () => {
    const sh = makeShell({ dirs: ["/home/student/proj"], home: "/home/student" } as never);
    sh.run("cd proj");
    const first = sh.run("git init");
    expect(first.stdout).toContain("Initialized empty Git repository");
    const second = sh.run("git init");
    expect(second.stdout).toContain("Reinitialized existing Git repository");
  });

  it("honors init.defaultBranch for new repositories", () => {
    const sh = makeShell({ dirs: ["/home/student/proj"], home: "/home/student" } as never);
    sh.run(`git config --global init.defaultBranch main`);
    sh.run("cd proj");
    sh.run("git init");
    expect(sh.run("git status").stdout).toContain("On branch main");
  });

  it("a repo made before the default-branch setting still says master", () => {
    const sh = makeShell({ dirs: ["/home/student/proj"], home: "/home/student" } as never);
    sh.run("cd proj");
    sh.run("git init");
    sh.run(`git config --global init.defaultBranch main`);
    expect(sh.run("git status").stdout).toContain("On branch master");
  });
});

describe("git status / add / commit / log", () => {
  let sh: Shell;
  beforeEach(() => {
    _resetClock();
    sh = makeShell({ dirs: ["/home/student/proj"], home: "/home/student" } as never);
    sh.run(`git config --global user.name "Ada Lovelace"`);
    sh.run(`git config --global user.email "ada@example.com"`);
    sh.run(`git config --global init.defaultBranch main`);
    sh.run("cd proj");
    sh.run("git init");
  });

  it("status on an empty repo lists untracked files", () => {
    sh.run("touch hello.txt");
    const out = sh.run("git status").stdout;
    expect(out).toContain("On branch main");
    expect(out).toContain("No commits yet");
    expect(out).toContain("Untracked files:");
    expect(out).toContain("hello.txt");
  });

  it("add stages, status shows it, commit stores it, log reads it back", () => {
    sh.run(`echo "console.log('hi')" > hello.js`);
    sh.run("git add hello.js");
    const status = sh.run("git status").stdout;
    expect(status).toContain("Changes to be committed:");
    expect(status).toContain("new file:   hello.js");

    const commit = sh.run(`git commit -m "Add hello.js"`);
    expect(commit.error).toBeNull();
    expect(commit.stdout).toContain("[main (root-commit)");
    expect(commit.stdout).toContain("Add hello.js");

    const log = sh.run("git log").stdout;
    expect(log).toContain("commit ");
    expect(log).toContain("Author: Ada Lovelace <ada@example.com>");
    expect(log).toContain("Add hello.js");
  });

  it("tracks edits: modified appears after a second change", () => {
    sh.run(`echo v1 > notes.txt`);
    sh.run("git add notes.txt");
    sh.run(`git commit -m "first"`);
    sh.run(`echo v2 > notes.txt`);
    expect(sh.run("git status").stdout).toContain("modified:   notes.txt");
  });

  it("git add . stages everything at once", () => {
    sh.run("touch a.txt b.txt");
    sh.run("git add .");
    const out = sh.run("git status").stdout;
    expect(out).toContain("new file:   a.txt");
    expect(out).toContain("new file:   b.txt");
  });

  it("clean tree prints nothing to commit", () => {
    sh.run(`echo hi > f.txt`);
    sh.run("git add f.txt");
    sh.run(`git commit -m "x"`);
    expect(sh.run("git status").stdout).toContain("nothing to commit, working tree clean");
  });

  it("commit without -m fails with a teaching error", () => {
    sh.run("touch f.txt");
    sh.run("git add f.txt");
    expect(sh.run("git commit").error).toContain("no commit message");
  });

  it("commit with nothing staged fails", () => {
    expect(sh.run(`git commit -m "empty"`).error).toContain("nothing to commit");
  });

  it("log with no commits fails like real git", () => {
    expect(sh.run("git log").error).toContain("does not have any commits yet");
  });

  it("git commands outside a repository fail", () => {
    const bare = makeShell({ home: "/home/student" } as never);
    expect(bare.run("git status").error).toContain("not a git repository");
    expect(bare.run("git add f.txt").error).toContain("not a git repository");
    expect(bare.run(`git commit -m "x"`).error).toContain("not a git repository");
    expect(bare.run("git log").error).toContain("not a git repository");
  });

  it("status/add/commit/log reach upward to find the repository", () => {
    sh.run("mkdir -p sub/deep");
    sh.run("cd sub/deep");
    sh.run("touch leaf.txt");
    sh.run("git add .");
    sh.run(`git commit -m "from a subdirectory"`);
    expect(sh.run("git log").stdout).toContain("from a subdirectory");
  });

  it("commits keep the repo portable through VFS snapshots", () => {
    sh.run(`echo data > d.txt`);
    sh.run("git add d.txt");
    sh.run(`git commit -m "snapshot"`);
    const clone = sh.vfs.clone();
    const sh2 = new Shell(clone, { user: "student", env: { HOME: "/home/student" } });
    sh2.run("cd proj");
    expect(sh2.run("git log").stdout).toContain("snapshot");
  });

  it("help and -h summarize commands", () => {
    expect(sh.run("git").stdout).toContain("usage: git");
    expect(sh.run("git --help").stdout).toContain("init");
    expect(sh.run("git help commit").stdout).toContain("record staged changes");
    expect(sh.run("git commit -h").stdout).toContain("USAGE");
    expect(sh.run("git help bogus").error).toContain("no help");
    expect(sh.run("git push").error).toContain("is not a git command");
  });
});

describe("git log flags, show, diff, rm, mv", () => {
  let sh: Shell;
  beforeEach(() => {
    _resetClock();
    sh = makeShell({ dirs: ["/home/student/proj"], home: "/home/student" } as never);
    sh.run(`git config --global user.name "Ada Lovelace"`);
    sh.run(`git config --global user.email "ada@example.com"`);
    sh.run("cd proj");
    sh.run("git init -b main");
    sh.run(`echo "one" > a.txt`);
    sh.run("git add a.txt");
    sh.run(`git commit -m "first"`);
    sh.run(`echo "two" > b.txt`);
    sh.run("git add b.txt");
    sh.run(`git commit -m "second"`);
    sh.run(`echo "one two" > a.txt`);
    sh.run("git add a.txt");
    sh.run(`git commit -m "third"`);
  });

  it("log --oneline prints one line per commit, newest first", () => {
    const lines = sh.run("git log --oneline").stdout.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("third");
    expect(lines[2]).toContain("first");
  });

  it("log -n limits to the last N commits, -3 is shorthand", () => {
    const out = sh.run("git log -n 2").stdout;
    expect(out).toContain("third");
    expect(out).toContain("second");
    expect(out).not.toContain("first");
    expect(sh.run("git log -3").stdout).toContain("first");
  });

  it("log --stat lists the files each commit changed", () => {
    const out = sh.run("git log --stat").stdout;
    expect(out).toContain(" a.txt | ");
    expect(out).toContain(" b.txt | ");
    expect(out).toContain("1 file changed");
  });

  it("log -p prints the patch between commits", () => {
    const out = sh.run("git log -p").stdout;
    expect(out).toContain("-one");
    expect(out).toContain("+one two");
  });

  it("show HEAD prints the newest commit with its patch", () => {
    const out = sh.run("git show HEAD").stdout;
    expect(out).toContain("commit ");
    expect(out).toContain("third");
    expect(out).toContain("-one");
    expect(out).toContain("+one two");
  });

  it("show accepts an id prefix and rejects unknown revisions", () => {
    const rootId = sh.run("git log --oneline").stdout.trim().split("\n")[2].split(" ")[0];
    expect(sh.run(`git show ${rootId}`).stdout).toContain("first");
    expect(sh.run("git show deadbeef").error).toContain("unknown revision");
  });

  it("diff shows unstaged edits against HEAD", () => {
    sh.run(`echo "one TWO" > a.txt`);
    const out = sh.run("git diff").stdout;
    expect(out).toContain("diff --git a/a.txt b/a.txt");
    expect(out).toContain("-one");
    expect(out).toContain("+one TWO");
  });

  it("diff ignores staged content; --staged shows it", () => {
    sh.run(`echo "one TWO" > a.txt`);
    sh.run("git add a.txt");
    expect(sh.run("git diff").stdout).toBe("");
    expect(sh.run("git diff --staged").stdout).toContain("+one TWO");
  });

  it("diff between two commits via HEAD~1", () => {
    const out = sh.run("git diff HEAD~1 HEAD").stdout;
    expect(out).toContain("-one");
    expect(out).toContain("+one two");
  });

  it("rm deletes the file and stages the deletion", () => {
    expect(sh.run("git rm b.txt").error).toBeNull();
    expect(sh.vfs.isFile("/home/student/proj/b.txt")).toBe(false);
    expect(sh.run("git status").stdout).toContain("deleted:    b.txt");
    sh.run(`git commit -m "drop b"`);
    expect(sh.run("git log --oneline").stdout).toContain("drop b");
  });

  it("rm --cached untracks but keeps the file on disk", () => {
    sh.run("git rm --cached b.txt");
    expect(sh.vfs.isFile("/home/student/proj/b.txt")).toBe(true);
    const short = sh.run("git status -s").stdout;
    expect(short).toContain("D  b.txt");
    expect(short).toContain("?? b.txt");
    sh.run(`git commit -m "untrack b"`);
    expect(sh.run("git status -s").stdout).toContain("?? b.txt");
  });

  it("mv renames and keeps the path tracked", () => {
    expect(sh.run("git mv b.txt c.txt").error).toBeNull();
    expect(sh.vfs.isFile("/home/student/proj/c.txt")).toBe(true);
    const short = sh.run("git status -s").stdout;
    expect(short).toContain("A  c.txt");
    expect(short).toContain("D  b.txt");
    sh.run(`git commit -m "rename b to c"`);
    expect(sh.run("git status -s").stdout).toBe("");
  });

  it("commit -am stages tracked edits but skips new files", () => {
    sh.run(`echo "one two three" > a.txt`);
    sh.run(`echo "1" > new.txt`);
    const commit = sh.run(`git commit -am "patch a"`);
    expect(commit.error).toBeNull();
    expect(commit.stdout).toContain("1 file changed");
    expect(sh.run("git status -s").stdout).toContain("?? new.txt");
    sh.run("git add new.txt");
    sh.run(`git commit -m "add new"`);
    expect(sh.run("git status -s").stdout).toBe("");
  });

  it("init -b names the first branch", () => {
    const fresh = makeShell({ dirs: ["/home/student/fresh"], home: "/home/student" } as never);
    fresh.run("cd fresh");
    fresh.run("git init -b trunk");
    expect(fresh.run("git status").stdout).toContain("On branch trunk");
  });

  it("the new subcommands also fail outside a repository", () => {
    const bare = makeShell({ dirs: ["/home/student"], home: "/home/student" } as never);
    expect(bare.run("git diff").error).toContain("not a git repository");
    expect(bare.run("git show HEAD").error).toContain("not a git repository");
    expect(bare.run("git rm f.txt").error).toContain("not a git repository");
    expect(bare.run("git mv a b").error).toContain("not a git repository");
  });
});
