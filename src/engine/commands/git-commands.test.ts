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

describe("git branch / switch / merge", () => {
  let sh: Shell;

  /** Fresh repo on main with one commit: README.md = "version 1\n". */
  function freshRepo() {
    _resetClock();
    sh = makeShell({ dirs: ["/home/student/proj"], home: "/home/student" } as never);
    sh.run(`git config --global user.name "Ada Lovelace"`);
    sh.run("git config --global user.email ada@example.com");
    sh.run("git config --global init.defaultBranch main");
    sh.run("cd proj");
    sh.run("git init");
    sh.run(`echo "version 1" > README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Start"`);
  }

  beforeEach(freshRepo);

  it("lists branches with * on the current one and -v adds the last commit", () => {
    sh.run("git branch feature");
    const out = sh.run("git branch").stdout;
    expect(out).toContain("* main");
    expect(out).toContain("  feature");

    const verbose = sh.run("git branch -v").stdout;
    expect(verbose).toMatch(/\* main\s+\w{7} Start/);
    expect(verbose).toContain("feature");
    // -a has nothing extra to show: the simulator has no remotes
    expect(sh.run("git branch -a").stdout).toBe(out);
  });

  it("switch moves HEAD and the working tree, and - jumps back", () => {
    const sw = sh.run("git switch -c feature");
    expect(sw.stdout).toContain("Switched to a new branch 'feature'");
    expect(sh.run("git status").stdout).toContain("On branch feature");

    sh.run(`echo "version 2" > README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Second"`);

    // back to the old commit's content
    sh.run("git switch main");
    expect(sh.run("cat README.md").stdout).toBe("version 1\n");

    sh.run("git switch feature");
    expect(sh.run("cat README.md").stdout).toBe("version 2\n");

    sh.run("git switch -");
    expect(sh.run("git status").stdout).toContain("On branch main");
  });

  it("checkout -b is the older spelling of switch -c", () => {
    expect(sh.run("git checkout -b spike").stdout).toContain("Switched to a new branch 'spike'");
    expect(sh.run("git status").stdout).toContain("On branch spike");
    expect(sh.run("git checkout main").stdout).toContain("Switched to branch 'main'");
  });

  it("refuses to switch away from uncommitted changes", () => {
    // "other" must point at a different commit that also touches README.md,
    // otherwise there is nothing to overwrite (git allows that switch too).
    sh.run("git switch -c other");
    sh.run(`echo "other edit" > README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Other edit"`);
    sh.run("git switch main");
    sh.run(`echo "uncommitted" >> README.md`);
    const r = sh.run("git switch other");
    expect(r.error).toContain("would be overwritten by switch");
    expect(sh.run("git status").stdout).toContain("modified:   README.md");
  });

  it("history is per-branch: commits on a branch stay off main", () => {
    sh.run("git switch -c feature");
    sh.run(`echo "feature work" >> README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Feature work"`);

    sh.run("git switch main");
    const mainLog = sh.run("git log --oneline").stdout;
    expect(mainLog).toContain("Start");
    expect(mainLog).not.toContain("Feature work");

    // --all reaches every branch tip
    const allLog = sh.run("git log --oneline --all").stdout;
    expect(allLog).toContain("Feature work");
    expect(allLog).toContain("Start");
  });

  it("merges by fast-forward and then -d accepts the branch", () => {
    sh.run("git switch -c feature");
    sh.run(`echo "feature work" >> README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Feature work"`);
    sh.run("git switch main");

    const merge = sh.run("git merge feature");
    expect(merge.stdout).toContain("Fast-forward");
    expect(sh.run("cat README.md").stdout).toContain("feature work");
    expect(sh.run("git log --oneline").stdout).toContain("Feature work");

    expect(sh.run("git branch -d feature").stdout).toContain("Deleted branch feature (was");
  });

  it("branch -d refuses unmerged work, -D forces it", () => {
    sh.run("git switch -c feature");
    sh.run(`echo "feature work" >> README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Feature work"`);
    sh.run("git switch main");

    const refused = sh.run("git branch -d feature");
    expect(refused.error).toContain("not fully merged");
    expect(sh.run("git branch").stdout).toContain("feature");

    expect(sh.run("git branch -D feature").stdout).toContain("Deleted branch feature");
    expect(sh.run("git branch").stdout).not.toContain("feature");
  });

  it("--no-ff writes a merge commit with two parents", () => {
    sh.run("git switch -c feature");
    sh.run(`echo "feature work" >> README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Feature work"`);
    sh.run("git switch main");

    const merge = sh.run("git merge --no-ff feature");
    expect(merge.stdout).toContain("Merge branch 'feature'");
    const show = sh.run("git show HEAD").stdout;
    expect(show).toMatch(/^Merge: \w{7} \w{7}/m);
    expect(sh.run("git log --oneline").stdout).toContain("Merge branch 'feature'");
  });

  it("divergent edits conflict, and --continue finishes after the fix", () => {
    // feature changes the file...
    sh.run("git switch -c feature");
    sh.run(`echo "version 2" > README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Feature edit"`);
    // ...and main changes the same file differently
    sh.run("git switch main");
    sh.run(`echo "version 1.1" > README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Main edit"`);

    const clash = sh.run("git merge feature");
    expect(clash.error).toContain("Merge conflict in README.md");
    const conflicted = sh.run("cat README.md").stdout;
    expect(conflicted).toContain("<<<<<<< HEAD");
    expect(conflicted).toContain("=======");
    expect(conflicted).toContain(">>>>>>> feature");

    const status = sh.run("git status").stdout;
    expect(status).toContain("You have unmerged paths.");
    expect(status).toContain("both modified:   README.md");

    // continuing with markers still in the file is refused
    expect(sh.run("git merge --continue").error).toContain("conflict markers");

    sh.run(`echo "merged" > README.md`);
    const done = sh.run("git merge --continue");
    expect(done.stdout).toContain("Merge branch 'feature'");
    expect(sh.run("cat README.md").stdout).toBe("merged\n");
    expect(sh.run("git status").stdout).toContain("working tree clean");
  });

  it("--abort restores the pre-merge state", () => {
    sh.run("git switch -c feature");
    sh.run(`echo "version 2" > README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Feature edit"`);
    sh.run("git switch main");
    sh.run(`echo "version 1.1" > README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Main edit"`);

    expect(sh.run("git merge feature").error).toContain("CONFLICT");
    expect(sh.run("git merge --abort").error).toBeNull();
    expect(sh.run("cat README.md").stdout).toBe("version 1.1\n");
    expect(sh.run("git status").stdout).toContain("working tree clean");
    // the merge is over: switching works again
    expect(sh.run("git switch feature").error).toBeNull();
    expect(sh.run("cat README.md").stdout).toBe("version 2\n");
  });

  it("renames a branch and keeps HEAD on it", () => {
    expect(sh.run("git branch -m main trunk").error).toBeNull();
    expect(sh.run("git status").stdout).toContain("On branch trunk");
    expect(sh.run("git branch").stdout).toContain("* trunk");
    expect(sh.run("git branch").stdout).not.toContain("main");
  });

  it("switch refuses unknown branches and duplicate -c names", () => {
    expect(sh.run("git switch nope").error).toContain("invalid reference: nope");
    sh.run("git switch -c dupe");
    expect(sh.run("git switch -c dupe").error).toContain("already exists");
    expect(sh.run("git branch dupe").error).toContain("already exists");
  });

  it("log --graph draws columns across the two branch lines", () => {
    sh.run("git switch -c feature");
    sh.run(`echo "feature work" >> README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Feature work"`);
    sh.run("git switch main");
    sh.run(`echo "main work" >> README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Main work"`);

    const graph = sh.run("git log --oneline --graph --all").stdout;
    const lines = graph.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^[*|] /); // both branch tips line up on the left
    expect(lines.some((l) => l.includes("|"))).toBe(true); // the other branch's column
    expect(graph).toContain("Main work");
    expect(graph).toContain("Feature work");
  });

  it("HEAD~1 follows first parents after a merge", () => {
    sh.run("git switch -c feature");
    sh.run(`echo "feature work" >> README.md`);
    sh.run("git add README.md");
    sh.run(`git commit -m "Feature work"`);
    sh.run("git switch main");
    sh.run("git merge --no-ff feature");

    const head = sh.run("git show --stat HEAD").stdout;
    expect(head).toMatch(/^Merge: \w{7} \w{7}/m);
    const parent = sh.run("git show --stat HEAD~1").stdout;
    expect(parent).toContain("Start"); // first parent is main's tip...
    expect(parent).not.toContain("Feature work"); // ...not the merged branch
  });
});
