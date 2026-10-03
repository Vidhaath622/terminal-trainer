/**
 * The Git practice track: thirty extra problems (five batches of six) that go
 * deeper than the launch set's twelve-problem fundamentals track -- history
 * forensics, branch gymnastics, merges that conflict, and the recovery verbs
 * (restore, reset, stash, tag, remotes) that make Git feel safe to use.
 * Each problem is anchored to a section of the two Git cheat-sheet charts.
 *
 * Pure TypeScript (data). launch.ts merges GIT_PRACTICE_PROBLEMS into
 * LAUNCH_PROBLEMS; launch.test.ts merges GIT_SOLUTIONS into its solutions
 * map so every practice problem is proven solvable to full marks.
 */
import { problemSchema, type Problem } from "@/engine/schema";

// ---------- shared fixture helpers (launch.ts owns its own; no cycles here) ----------

const ADA_NAME = "Ada Lovelace";
const ADA_EMAIL = "ada@example.com";

const HELLO_V1 = 'print("hello")\n';
const HELLO_V2 = 'print("hello")\nprint("goodbye")\n';
const README_V1 = "# Demo\n";
const README_V2 = "# Demo\n\nLearning git.\n";

/**
 * Serialized `.git` fixture: a repository whose history, staging area and
 * branch map are pre-loaded, so practice problems start from real commits.
 * Shape matches GitMeta in engine/commands/git-commands.ts. Commits may name
 * their own author; otherwise they all belong to Ada.
 */
function gitFixture(
  commits: Array<{
    id: string;
    message: string;
    time: number;
    files: Record<string, string>;
    parents?: string[];
    author?: string;
    email?: string;
  }>,
  staged: Record<string, string> = {},
  branches?: Record<string, string>,
  branch = "main"
): string {
  return JSON.stringify({
    version: 1,
    branch,
    commits: commits.map((c) => ({
      ...c,
      author: c.author ?? ADA_NAME,
      email: c.email ?? ADA_EMAIL,
    })),
    staged,
    tracked: Object.keys(commits[commits.length - 1].files).sort(),
    local: {},
    ...(branches ? { branches } : {}),
  });
}

/** fs for a repository problem: working-tree files plus the .git fixture. */
function repoFs(dir: string, tree: Record<string, string>, git: string) {
  return {
    dirs: [dir],
    files: [
      ...Object.entries(tree).map(([name, content]) => ({ path: `${dir}/${name}`, content })),
      { path: `${dir}/.git`, content: git },
    ],
    home: dir,
    user: "student",
  };
}

const rawGitProblems: unknown[] = [
  // ---- Batch 1: Fundamentals ----
  {
    id: "git-adopt-existing",
    title: "Adopt an Existing Project",
    difficulty: "easy" as const,
    tags: ["git", "init", "add", "commit", "status"],
    brief:
      "The 'Start and check' and 'Commit' rows of the cheat sheet, end to end: a folder of finished files with no history at all. Turn it into a repository (git init -b main), look, stage everything, take the root commit, and prove the tree came back clean.",
    fs: {
      dirs: ["/home/student/site"],
      files: [
        { path: "/home/student/site/index.html", content: "<h1>Hello</h1>\n" },
        { path: "/home/student/site/style.css", content: "body { color: navy; }\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Walk into the project folder: cd site.",
        hints: ["The site folder lives right in your home directory — git init works on the CURRENT folder, so be inside it first."],
        marks: 4,
        checks: [{ type: "cwdEquals" as const, path: "/home/student/site", marks: 4 }],
      },
      {
        id: "s2",
        prompt: "Turn this folder into a repository whose first branch is called main: git init -b main.",
        hints: [
          "-b names the starting branch for this one repository (the cheat sheet's 'git init [-b <branch>]').",
          "The hidden .git entry it creates is what makes the folder a repository — this is the one time you must run it.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Initialized empty Git repository", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Ask where things stand: git status. Nothing is tracked yet — find the 'No commits yet' line and the untracked section naming your files.",
        hints: ["git status is the first command to reach for whenever git feels confusing.", "Expect 'On branch main', 'No commits yet', and an 'Untracked files:' section listing index.html and style.css."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "No commits yet", marks: 2 },
          { type: "outputContains" as const, value: "Untracked files:", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Stage everything from here down — git add . — then run git status again and confirm both files sit under 'Changes to be committed:' as new files.",
        hints: [
          "git add . stages everything in the repository at once; git add index.html style.css works too.",
          "Staging builds the snapshot you are about to commit — status should now show 'new file:' lines.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Changes to be committed:", marks: 2 },
          { type: "outputContains" as const, value: "new file:", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Commit the snapshot: git commit -m \"Adopt the site\". Watch for the (root-commit) marker — this is the first commit in this repository's history.",
        hints: ["The -m flag carries the message; without it, git refuses to commit.", "The commit line reads '[main (root-commit) <id>] Adopt the site'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "(root-commit)", marks: 2 },
          { type: "outputContains" as const, value: "Adopt the site", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "One last git status — the reward line every commit ends with.",
        hints: ["Same command as step 3, but now everything is tracked and recorded: 'nothing to commit, working tree clean'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-stage-selectively",
    title: "Stage Selectively",
    difficulty: "medium" as const,
    tags: ["git", "add", "status", "commit"],
    brief:
      "Three changes are waiting, and only one of them belongs in the next commit. The 'Stage' row of the cheat sheet in practice: stage a single file, commit it, watch the other edits stay behind — then ship them as a second commit.",
    fs: repoFs(
      "/home/student/project",
      {
        "app.py": 'print("hello")\nprint("debug")\n',
        "README.md": README_V2,
        "scratch.txt": "wip notes\n",
      },
      gitFixture([
        { id: "d1e2f3a", message: "First draft", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
      ])
    ),
    steps: [
      {
        id: "s1",
        prompt: "Survey the battlefield: git status -s. Two letters per line — which file is edited, which is also edited, which is brand new?",
        hints: ["' M' (blank, M) means modified but not staged; '??' means untracked.", "The first letter column is the staging area, the second is the working directory."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: " M app.py", marks: 2 },
          { type: "outputContains" as const, value: " M README.md", marks: 1 },
          { type: "outputContains" as const, value: "?? scratch.txt", marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Stage ONLY app.py — git add app.py — then git status -s again. The M jumped to the first column for app.py; the other two lines must be untouched.",
        hints: [
          "After staging, the line reads 'M  app.py': M in the staging column, blank in the working column.",
          "git add . would have swept up README.md's edit too — that is exactly what you are NOT doing.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "M  app.py", marks: 2 },
          { type: "outputContains" as const, value: " M README.md", marks: 1 },
          { type: "outputContains" as const, value: "?? scratch.txt", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Commit just that one file: git commit -m \"Ship the app fix\".",
        hints: ["Only what is staged gets recorded — README.md's edit and scratch.txt stay out of this commit.", "The summary line reads ' 1 file changed'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Ship the app fix", marks: 2 },
          { type: "outputContains" as const, value: "1 file", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Prove nothing else slipped in: git status. Which sections are left, and which file is still waiting?",
        hints: ["README.md should sit under 'Changes not staged for commit:', and scratch.txt under 'Untracked files:'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "modified:   README.md", marks: 2 },
          { type: "outputContains" as const, value: "Untracked files:", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Now ship the readme as its own commit — git add README.md, git commit -m \"Update the readme\" — then git status. What is still left behind?",
        hints: [
          "Two commands: stage the file, then commit it. scratch.txt is untracked, so git add did not touch it.",
          "The status footer now reads 'nothing added to commit but untracked files present'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "nothing added to commit but untracked files present", marks: 2 },
          { type: "outputContains" as const, value: "scratch.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The receipts: git log --oneline — both commits, newest first.",
        hints: ["--oneline prints one line per commit: <id> <message>."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Update the readme", marks: 2 },
          { type: "outputContains" as const, value: "Ship the app fix", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-two-areas-two-commits",
    title: "Two Areas, Two Commits",
    difficulty: "medium" as const,
    tags: ["git", "diff", "staging", "commit", "status"],
    brief:
      "The three-box flow on the chart — working directory, staging area, repository — is really two borders you cross twice. Edit, review with git diff, stage, edit AGAIN without staging, and watch git diff and git status tell you two different stories before each of your two commits.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1 },
      gitFixture([
        { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
      ])
    ),
    steps: [
      {
        id: "s1",
        prompt: "Add a first line — echo 'print(\"one\")' >> app.py — then review what is sitting unstaged with git diff.",
        hints: [
          ">> appends a line instead of overwriting the file.",
          "git diff with no arguments compares the working directory against the staging area: look for the +++ line and the +print(\"one\") addition.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "diff --git a/app.py b/app.py", marks: 2 },
          { type: "outputContains" as const, value: '+print("one")', marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt: "Move it into the staging area — git add app.py — then git status -s. Where did the M go?",
        hints: ["After git add, the line reads 'M  app.py': the M is now in the staging column (first), the working column is blank."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "M  app.py", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Before committing, make a SECOND edit without staging it — echo 'print(\"two\")' >> app.py — then run git diff again. Which change does this diff show, and which one is it hiding?",
        hints: [
          "git diff compares the working directory against the effective index — so it shows only the new, unstaged line.",
          "Your staged 'one' line is invisible to plain git diff; it lives in the staging area now.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: '+print("two")', marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Commit what is staged — git commit -m \"First edit\" — then git status -s. Is the tree clean? Which area is your second edit sitting in?",
        hints: [
          "The commit records the staging area's content ('one'), not your working directory's.",
          "status -s should show ' M app.py': the second edit survived, still unstaged, waiting for the next commit.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: " M app.py", marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("two")', marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Cross the second border for the second commit — git add app.py, git commit -m \"Second edit\" — then git log --oneline to see both commits.",
        hints: ["Same two beats as before: stage, commit — this time it is the 'two' line going in.", "The log should list 'Second edit' above 'First edit', newest first."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Second edit", marks: 2 },
          { type: "outputContains" as const, value: "First edit", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Close the loop: git status one last time. What does a fully-committed tree look like?",
        hints: ["Everything crossed both borders: 'nothing to commit, working tree clean'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-clean-tree-guard",
    title: "The Clean-Tree Guard",
    difficulty: "easy" as const,
    tags: ["git", "status", "commit", "restore", "safety"],
    brief:
      "Git's quietest superpower is refusing to do damage. Start from a clean tree, try to commit nothing (twice), make an unstaged scratch edit, and learn the two refusals — then throw the scratch edit away with git restore and prove the diff has nothing left to show.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1 },
      gitFixture([
        { id: "b4c5d6e", message: "Steady state", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
      ])
    ),
    steps: [
      {
        id: "s1",
        prompt: "Prove you are starting clean: git status.",
        hints: ["A clean tree answers with 'nothing to commit, working tree clean'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Try to commit nothing — git commit -m \"Oops\" — and read the refusal word by word.",
        hints: ["With the staging area empty, git refuses rather than writing an empty commit."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "nothing to commit (stage files with git add first)", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Make a scratch edit WITHOUT staging it — echo \"temp notes\" >> README.md — then git status -s to see where it lands.",
        hints: [">> appends without touching git at all: the working directory changed, the staging area did not.", "The line should read ' M README.md' — second column M, first column blank."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: " M README.md", marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Try to commit again — git commit -m \"Still nothing\". There IS an edit on disk, so why the same refusal?",
        hints: [
          "The commit records the staging area, not the working directory — and you never ran git add.",
          "The refusal says it out loud: 'nothing to commit (stage files with git add first)'.",
        ],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "nothing to commit (stage files with git add first)", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Throw the scratch edit away — git restore README.md — then git status to confirm the tree is clean again.",
        hints: [
          "git restore <file> copies the recorded version back over your working copy — the cheat sheet's undo for edits.",
          "After the restore, status should end with 'nothing to commit, working tree clean'.",
        ],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/project/README.md", value: "# Demo", marks: 2 },
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The final guard check: run git diff. A clean tree gives you... nothing at all. Empty output is the whole answer.",
        hints: ["git diff only speaks when the working directory differs from the index — right now, nothing differs."],
        marks: 4,
        checks: [
          { type: "outputMatches" as const, pattern: "^$", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-review-loop",
    title: "The Review Loop",
    difficulty: "medium" as const,
    tags: ["git", "diff", "show", "log", "commit"],
    brief:
      "Edit, review, stage, review again, commit, read it back — the daily rhythm of the 'Compare' and 'History' rows. git diff before the commit, git diff --staged after staging, git show to replay what was actually recorded, git log --stat for the summary, then start the loop over.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1 },
      gitFixture([
        { id: "e4f5a6b", message: "Initial import", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
      ])
    ),
    steps: [
      {
        id: "s1",
        prompt: "Edit first, review second: echo 'print(\"reviewed\")' >> app.py, then git diff — your first review of the change.",
        hints: [">> appends the line; git diff shows working directory versus staging area.", "Look for the '+print(\"reviewed\")' addition under the +++ line."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "diff --git a/app.py b/app.py", marks: 2 },
          { type: "outputContains" as const, value: '+print("reviewed")', marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt: "Stage it, then review the OTHER picture: git add app.py followed by git diff --staged.",
        hints: [
          "--staged compares the staging area against the last commit — what the next commit will contain.",
          "Same +print(\"reviewed\") line, but now it is on the staged side of the border.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: '+print("reviewed")', marks: 2 },
          { type: "outputContains" as const, value: "diff --git a/app.py", marks: 1 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--staged", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Both reviews passed — commit: git commit -m \"Review the change\".",
        hints: ["-m carries the message; the summary line confirms one file changed."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Review the change", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Read the record back: git show — author, date, message, and the exact patch that was recorded.",
        hints: [
          "git show prints the commit header followed by the patch (treePatch), including the '+print(\"reviewed\")' line.",
          "You never configured an identity in this problem, so the Author line is the machine's default user.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: '+print("reviewed")', marks: 2 },
          { type: "outputContains" as const, value: "Author: student", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Zoom out: git log --stat — every commit with its files-changed summary.",
        hints: ["--stat appends the per-file tally block under each commit's message.", "Your commit's summary line reads ' 1 file changed'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Review the change", marks: 2 },
          { type: "outputContains" as const, value: "1 file changed", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "And the loop begins again: echo 'print(\"next\")' >> app.py, then git status -s. What is the very next command you would run?",
        hints: ["The new edit shows as ' M app.py' — review it with git diff before staging."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: " M app.py", marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-history-triage",
    title: "History Triage",
    difficulty: "medium" as const,
    tags: ["git", "log", "show", "diff", "triage"],
    brief:
      "Something touched the repo overnight and you were not at the keyboard. Triage it the way an incident responder would: status to see what is dirty, log --oneline to reconstruct events, show to inspect the newest commit, diff for the uncommitted change, then HEAD~1 and a two-commit diff to walk backwards through time.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V2, "README.md": README_V2 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Add a goodbye line", time: 1727827200000, files: { "app.py": HELLO_V2, "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Morning check: git status. Someone (or something) touched the repo overnight — which file is dirty?",
        hints: ["app.py matches the last commit; README.md does not — look under 'Changes not staged for commit:'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "modified:   README.md", marks: 2 },
          { type: "outputContains" as const, value: "Changes not staged for commit:", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Reconstruct the events: git log --oneline. Newest first — which commit sits on top?",
        hints: ["--oneline gives you <id> <message> per line; the top line is the most recent commit."],
        marks: 4,
        checks: [
          {
            type: "outputMatches" as const,
            pattern: "b4c5d6e Add a goodbye line[\\s\\S]*a1b2c3d Start the project",
            marks: 3,
          },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Inspect the newest commit in full: git show. Who wrote it, and what message did it carry?",
        hints: ["git show prints the commit header (commit id, Author, Date, message) followed by the patch.", "The Author line is 'Ada Lovelace <ada@example.com>'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Author: Ada Lovelace <ada@example.com>", marks: 2 },
          { type: "outputContains" as const, value: "Add a goodbye line", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Now the overnight change itself: git diff with no arguments — unstaged work versus the staging area.",
        hints: ["Plain git diff ignores committed history and looks only at what has not been staged.", "You should see 'diff --git a/README.md b/README.md' with a '+Learning git.' addition."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "diff --git a/README.md b/README.md", marks: 2 },
          { type: "outputContains" as const, value: "+Learning git.", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Walk one step further back: git show HEAD~1 — the commit BEFORE the newest one.",
        hints: ["HEAD~1 means 'the first parent of HEAD'. git show renders it exactly like any other commit.", "Its message is 'Start the project', also by Ada."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Start the project", marks: 2 },
          { type: "outputContains" as const, value: "Author: Ada Lovelace", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The last interrogation: compare the two commits directly — git diff HEAD~1 HEAD. What did the goodbye-line commit actually change?",
        hints: [
          "Two refs name the two sides: everything before the first is the old version, everything after is the new one.",
          "Only app.py differs — look for '+print(\"goodbye\")'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "diff --git a/app.py b/app.py", marks: 2 },
          { type: "outputContains" as const, value: '+print("goodbye")', marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  // ---- Batch 2: History ----
  {
    id: "git-log-graph",
    title: "Draw the Graph",
    difficulty: "medium" as const,
    tags: ["git", "log", "graph", "branch"],
    brief:
      "The 'See the branches' row of the cheat sheet in one command: git log --oneline --graph --all draws the commit graph for every branch at once. Two branches have quietly diverged here — first read them one at a time, then watch the second column appear.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V2 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Polish the readme", time: 1727827200000, files: { "app.py": HELLO_V1, "README.md": README_V2 }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Add experiments", time: 1727913600000, files: { "app.py": 'print("hello")\nprint("experiments")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e", feature: "c7d8e9f" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "List the branches: git branch. Which one carries the *?",
        hints: ["git branch prints every local branch, with * marking the one you are standing on."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* main", marks: 2 },
          { type: "outputContains" as const, value: "feature", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Read main's history alone: git log --oneline. Which commit is on top, and how far back does main go?",
        hints: ["Without --all, log only walks back from the branch you are on.", "Newest first: Polish the readme, then Start the project."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e Polish the readme\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Now the whole picture: git log --oneline --graph --all. Every branch tip joins the graph — where does the second column appear?",
        hints: [
          "--all widens the walk to every branch; --graph draws the column markers (* and |) in front of each line.",
          "'Add experiments' only exists on feature — without --all you would never see it from main.",
        ],
        marks: 5,
        checks: [
          { type: "outputContains" as const, value: "c7d8e9f Add experiments", marks: 2 },
          { type: "outputMatches" as const, pattern: "\\| \\*", marks: 2 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--graph", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Each branch's latest commit at a glance: git branch -v.",
        hints: ["-v appends '<id> <message>' after every branch name."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "c7d8e9f Add experiments", marks: 2 },
          { type: "outputContains" as const, value: "* main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Read feature's history WITHOUT switching to it: git log feature. A branch name works anywhere a commit is expected.",
        hints: ["git log <branch> starts the walk from that branch's tip — you stay exactly where you are.", "Feature's history is Add experiments on top of Start the project — Polish the readme is NOT in it."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Add experiments", marks: 2 },
          { type: "outputContains" as const, value: "Start the project", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Just the newest commit: git log -n 1 --oneline.",
        hints: ["-n 1 limits the walk to a single commit — the top of the current branch."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e Polish the readme", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-log-grep",
    title: "History by Keyword",
    difficulty: "medium" as const,
    tags: ["git", "log", "grep", "filter"],
    brief:
      "The chart's History row starts with plain git log; git help log shows the filters that make it a search engine. Hunt every commit whose MESSAGE contains a keyword with --grep, discover that matching is case-sensitive the hard way, stack filters together, and see what an empty answer looks like.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("parse")\nprint("fixed")\n', "README.md": README_V2 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Fix login bug", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Add logout button", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("logout")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Fix crash on startup", time: 1727913600000, files: { "app.py": 'print("hello")\nprint("logout")\nprint("fixed")\n', "README.md": README_V1 }, parents: ["b4c5d6e"] },
          { id: "d0e1f2a", message: "Update docs", time: 1728000000000, files: { "app.py": 'print("hello")\nprint("logout")\nprint("fixed")\n', "README.md": README_V2 }, parents: ["c7d8e9f"] },
        ],
        {},
        { main: "d0e1f2a" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "The unfiltered record: git log --oneline — all four commits, newest first.",
        hints: ["--oneline prints <id> <message> per line."],
        marks: 4,
        checks: [
          {
            type: "outputEquals" as const,
            value: "d0e1f2a Update docs\nc7d8e9f Fix crash on startup\nb4c5d6e Add logout button\na1b2c3d Fix login bug",
            marks: 3,
          },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Only the bug-hunting commits: git log --oneline --grep Fix.",
        hints: ["--grep keeps only commits whose message contains the given text.", "Two of the four messages start with 'Fix'."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "c7d8e9f Fix crash on startup\na1b2c3d Fix login bug", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--grep", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Same search, lowercase: git log --oneline --grep fix. What came back — and what does that tell you about matching?",
        hints: [
          "Git's grep matches substrings exactly as typed — 'fix' is a different string from 'Fix'.",
          "No matches means no output at all: an empty screen is the answer.",
        ],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--grep", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Narrow with a two-letter needle: git log --oneline --grep dd — which message contains it?",
        hints: ["grep matches anywhere in the message, not just at the start — but it must match the whole word as typed."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e Add logout button", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--grep", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Stack two filters: git log --oneline --grep Fix -n 1 — the NEWEST of the matching commits.",
        hints: ["Filters compose: grep narrows the pool first, then -n limits what is shown.", "The newest 'Fix' commit is the crash fix, not the login fix."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "c7d8e9f Fix crash on startup", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Drop --oneline and look at the full entries: git log --grep Fix — headers, authors, dates around each matching message.",
        hints: ["Without --oneline each match renders as a full block: commit id, Author, Date, then the indented message."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Author: Ada Lovelace <ada@example.com>", marks: 2 },
          { type: "outputContains" as const, value: "Fix login bug", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-log-author",
    title: "Whose Commits Are These?",
    difficulty: "medium" as const,
    tags: ["git", "log", "author", "filter"],
    brief:
      "Two people have been committing to this repository. git log --author filters by the Author line (substring, case-sensitive), so you can split the history person by person, stack author with --since to pin down exactly when someone worked, and see what an unknown name returns.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("parse")\nprint("fixed")\n', "README.md": README_V2 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Set up the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          {
            id: "b4c5d6e",
            message: "Add parser",
            time: 1727827200000,
            files: { "app.py": 'print("hello")\nprint("parse")\n', "README.md": README_V1 },
            parents: ["a1b2c3d"],
            author: "Alan Turing",
            email: "alan@example.com",
          },
          {
            id: "c7d8e9f",
            message: "Fix parser bug",
            time: 1727913600000,
            files: { "app.py": 'print("hello")\nprint("parse")\nprint("fixed")\n', "README.md": README_V1 },
            parents: ["b4c5d6e"],
          },
          {
            id: "d0e1f2a",
            message: "Write parser docs",
            time: 1728000000000,
            files: { "app.py": 'print("hello")\nprint("parse")\nprint("fixed")\n', "README.md": README_V2 },
            parents: ["c7d8e9f"],
            author: "Alan Turing",
            email: "alan@example.com",
          },
        ],
        {},
        { main: "d0e1f2a" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "The full roll call: git log --oneline — four commits, newest first.",
        hints: ["Right now every author is mixed together in one list."],
        marks: 4,
        checks: [
          {
            type: "outputEquals" as const,
            value: "d0e1f2a Write parser docs\nc7d8e9f Fix parser bug\nb4c5d6e Add parser\na1b2c3d Set up the project",
            marks: 3,
          },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Split the history: git log --oneline --author Ada — only Ada's commits.",
        hints: ["--author matches a substring of the Author line, not an exact address.", "Ada wrote the setup and the parser fix."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "c7d8e9f Fix parser bug\na1b2c3d Set up the project", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--author", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "And the other side: git log --oneline --author Turing — a different substring of the same Author lines.",
        hints: ["A surname works as well as a first name — git only needs one matching fragment.", "Turing wrote Add parser and Write parser docs."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "d0e1f2a Write parser docs\nb4c5d6e Add parser", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--author", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Stack author and date: git log --oneline --author Turing --since 2024-10-03 — only Turing's commits from that day onward.",
        hints: [
          "Filters compose: author narrows first, then --since cuts off anything older than the date (YYYY-MM-DD).",
          "One commit survives: Write parser docs.",
        ],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "d0e1f2a Write parser docs", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--since", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "The full record for one author: git log --author Ada — headers, dates and messages, no --oneline.",
        hints: ["Each surviving commit renders as a full block: commit id, Author line, Date, indented message."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Author: Ada Lovelace <ada@example.com>", marks: 2 },
          { type: "outputContains" as const, value: "Fix parser bug", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "A name nobody uses: git log --oneline --author Nobody. What does git do when the filter matches nothing?",
        hints: ["No match, no output — the empty screen is how git answers a filter that finds nothing."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--author", marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-log-since",
    title: "Commits on the Clock",
    difficulty: "medium" as const,
    tags: ["git", "log", "since", "until", "dates"],
    brief:
      "A year of work sits in this repository — one commit per season. Slice it with --since and --until (dates are YYYY-MM-DD, and the until day itself counts), stack both into a window, and see what the far future returns. This is git help log's date filter, drilled.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("refactor")\nprint("released")\n', "README.md": README_V2 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Kick off the year", time: 1705320000000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Mid-year refactor", time: 1718020800000, files: { "app.py": 'print("hello")\nprint("refactor")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Autumn release", time: 1728129600000, files: { "app.py": 'print("hello")\nprint("refactor")\nprint("released")\n', "README.md": README_V1 }, parents: ["b4c5d6e"] },
          { id: "d0e1f2a", message: "Winter patch", time: 1740052800000, files: { "app.py": 'print("hello")\nprint("refactor")\nprint("released")\n', "README.md": README_V2 }, parents: ["c7d8e9f"] },
        ],
        {},
        { main: "d0e1f2a" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "The whole year: git log --oneline — four commits from January to February next year.",
        hints: ["Newest first: Winter patch (2025) down to Kick off the year (Jan 2024)."],
        marks: 4,
        checks: [
          {
            type: "outputEquals" as const,
            value: "d0e1f2a Winter patch\nc7d8e9f Autumn release\nb4c5d6e Mid-year refactor\na1b2c3d Kick off the year",
            marks: 3,
          },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Everything from July onward: git log --oneline --since 2024-07-01.",
        hints: ["--since keeps commits dated on or after the given day (YYYY-MM-DD).", "Two commits are newer than July 2024."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "d0e1f2a Winter patch\nc7d8e9f Autumn release", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--since", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "The other direction: git log --oneline --until 2024-06-30 — everything up to and including that day.",
        hints: ["--until is the mirror of --since, and the until day itself counts as in-range.", "The June 10 refactor is the newest commit that qualifies."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e Mid-year refactor\na1b2c3d Kick off the year", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--until", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "A date window: git log --oneline --since 2024-06-01 --until 2024-12-31 — the second half of 2024 only.",
        hints: ["Both flags at once give a closed window: newer than the first date AND older than the second.", "Refactor (June) and release (October) qualify; January and next February do not."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "c7d8e9f Autumn release\nb4c5d6e Mid-year refactor", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--since", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Point at the far future: git log --oneline --since 2030-01-01. What does a filter with no matches print?",
        hints: ["Nothing in this repository is dated 2030 — an empty answer is the correct one."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--since", marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The patch release in full: git log --since 2025-01-01 — header, author and date of the only survivor.",
        hints: ["Without --oneline you get the full block, including the 'Date:' line that proves the filter worked."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Winter patch", marks: 2 },
          { type: "outputContains" as const, value: "Author: Ada Lovelace", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-diff-branches",
    title: "Branches, Compared",
    difficulty: "medium" as const,
    tags: ["git", "diff", "branch", "compare"],
    brief:
      "The chart's Compare row, aimed at branches instead of files: git diff <branch1> <branch2> answers 'what would I gain by switching?'. Read it in both directions, cut it down to one file with a pathspec, and use --name-only when you only need the list.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V2 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Update readme", time: 1727827200000, files: { "app.py": HELLO_V1, "README.md": README_V2 }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Tune app", time: 1727913600000, files: { "app.py": 'print("hello")\nprint("experiments")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e", feature: "c7d8e9f" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Which two histories are you about to compare? git branch.",
        hints: ["Two local branches, main carrying the * — you are standing on main."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* main", marks: 2 },
          { type: "outputContains" as const, value: "feature", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "What would switching to feature gain? git diff main feature — everything '-' is on main only, everything '+' is on feature only.",
        hints: [
          "The FIRST ref is the old side, the SECOND is the new side.",
          "Feature added a line to app.py but never saw main's readme edit.",
        ],
        marks: 5,
        checks: [
          { type: "outputContains" as const, value: "diff --git a/app.py b/app.py", marks: 2 },
          { type: "outputContains" as const, value: '+print("experiments")', marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Now read the mirror image: git diff feature main. Which file appears with a + line this time, and what does it mean?",
        hints: ["Swapped refs swap the roles: '+' is now what main has that feature lacks.", "The '+Learning git.' addition is main's readme work, missing from feature."],
        marks: 5,
        checks: [
          { type: "outputContains" as const, value: "diff --git a/README.md b/README.md", marks: 2 },
          { type: "outputContains" as const, value: "+Learning git.", marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Only care about one file? git diff main feature --name-only -- app.py — just the names that changed, pathspec-filtered.",
        hints: [
          "--name-only drops the hunks and prints the changed paths, one per line.",
          "Everything after -- is a path pattern instead of a ref: only app.py survives the filter.",
        ],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "app.py", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--name-only", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Where did feature's extra line come from? git show feature --stat — the one commit that defines it.",
        hints: ["git show accepts a branch name like any other ref; --stat adds the files-changed tally.", "One commit, one file: Tune app, 1 file changed."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Tune app", marks: 2 },
          { type: "outputContains" as const, value: "1 file changed", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Final inventory — git diff feature main --name-only: which two files separate these branches?",
        hints: ["Both sides changed something different, so two paths come back."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "README.md", marks: 2 },
          { type: "outputContains" as const, value: "app.py", marks: 1 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--name-only", marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-history-per-branch",
    title: "Two Branches, Two Histories",
    difficulty: "medium" as const,
    tags: ["git", "log", "branch", "switch"],
    brief:
      "Every branch remembers its own past. Read main's history, read feature's WITHOUT switching (a branch name works as a ref), get both at once with --all, then switch over and prove the same log looks different from the other side.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V2 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Polish the readme", time: 1727827200000, files: { "app.py": HELLO_V1, "README.md": README_V2 }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Add experiments", time: 1727913600000, files: { "app.py": 'print("hello")\nprint("experiments")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e", feature: "c7d8e9f" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Start with the map: git branch — two branches, one star.",
        hints: ["* marks where you stand; the other name is the second history."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* main", marks: 2 },
          { type: "outputContains" as const, value: "feature", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "main's version of events: git log --oneline.",
        hints: ["From main, the walk sees main's tip and everything behind it — two commits."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e Polish the readme\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "feature's version: git log --oneline feature — WITHOUT changing branches. Which commit is missing from this story?",
        hints: ["A branch name is a valid ref for log: it starts the walk from that tip, wherever you are standing.", "Polish the readme never happened as far as feature knows."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "c7d8e9f Add experiments\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Both stories at once: git log --oneline --all — every tip, one combined list.",
        hints: ["--all collects the tips of ALL branches (and remote-tracking refs) before walking.", "Three lines: experiments, readme, start — newest across the whole repository first."],
        marks: 4,
        checks: [
          {
            type: "outputEquals" as const,
            value: "c7d8e9f Add experiments\nb4c5d6e Polish the readme\na1b2c3d Start the project",
            marks: 3,
          },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--all", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Now actually go there: git switch feature, then git log --oneline. Does the default view change?",
        hints: ["After the switch, plain log walks from feature's tip — the same two commits you saw with the explicit ref.", "'Switched to branch feature' prints first, then the log takes over."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "c7d8e9f Add experiments\na1b2c3d Start the project", marks: 2 },
          { type: "onBranch" as const, branch: "feature", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The star has moved: git branch -a. Where is * now, and what does -a add to the list?",
        hints: ["-a also lists remote-tracking refs (origin/…) — this repository has none yet, so the local names are all you get.", "With no remotes configured, the output is your two local branches — but * now sits on feature."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* feature", marks: 2 },
          { type: "outputContains" as const, value: "main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  // ---- Batch 3: Branch & switch ----
  {
    id: "git-branch-cleanup",
    title: "Clean Up After Shipping",
    difficulty: "easy" as const,
    tags: ["git", "branch", "delete", "merge"],
    brief:
      "Branches are disposable — the 'Delete and rename' row of the cheat sheet exists for exactly this moment. Delete the branch you already merged with the safe -d, hit the 'not fully merged' wall on another, break glass with -D, and discover why git refuses to delete the branch you are standing on.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("feature")\n', "README.md": README_V1 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Ship the feature", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("feature")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Wild experiment", time: 1727913600000, files: { "app.py": 'print("hello")\nprint("wild")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e", feature: "a1b2c3d", experiment: "c7d8e9f" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Inventory first: git branch — three names, one star.",
        hints: ["feature points at the base commit (already part of main's history), experiment at work nobody merged."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* main", marks: 2 },
          { type: "outputContains" as const, value: "feature", marks: 1 },
          { type: "outputContains" as const, value: "experiment", marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "The feature shipped, so its branch is done — delete it safely: git branch -d feature.",
        hints: [
          "-d is the guarded delete: it only works when the branch's commits are already in your current branch's history.",
          "Success reads 'Deleted branch feature (was …)'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Deleted branch feature", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-d", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Now the experiment: git branch -d experiment. Read the refusal — git is telling you what would be lost and how to override it.",
        hints: [
          "Its tip commit is NOT reachable from main, so -d refuses: 'not fully merged'.",
          "The error message itself suggests the force flag: git branch -D experiment.",
        ],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "not fully merged", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-d", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "You have been warned and you meant it: force it with git branch -D experiment.",
        hints: ["Capital D skips the merge check — the commit becomes unreachable from any branch name."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Deleted branch experiment", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-D", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Last guard: try to delete where you stand — git branch -d main. What does git say about deleting the checked-out branch?",
        hints: ["You are standing on main — deleting it would leave HEAD pointing at nothing, so git refuses flat out."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "Cannot delete branch 'main' checked out", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The final inventory: git branch. One branch should remain — exactly as before your first delete.",
        hints: ["After two deletions the list collapses to a single starred line: '* main'."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "* main", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-two-features",
    title: "Two Feature Branches",
    difficulty: "medium" as const,
    tags: ["git", "branch", "switch", "commit"],
    brief:
      "The branching chart's flow, run twice: create a branch with git switch -c, commit work that only exists there, hop back to main and watch the file change under your feet, then spin up a second branch. By the end each branch holds a different one-line future of the same file.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1 },
      gitFixture(
        [{ id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] }],
        {},
        { main: "a1b2c3d" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Branch off and step onto it in one move: git switch -c login.",
        hints: ["-c creates the branch at your current commit AND switches to it — the chart's 'git switch -c' step.", "The confirmation reads \"Switched to a new branch 'login'\"."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to a new branch 'login'", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Land work only login should have: echo 'print(\"login\")' >> app.py, git add app.py, git commit -m \"Add login\".",
        hints: ["Three beats: append, stage, commit — all while login is checked out.", "The commit line reads '[login …] Add login'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Add login", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("login")', marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Come home — git switch main — then cat app.py. Where did your login line go?",
        hints: ["Switching restores the target branch's files; the login line only exists on login.", "cat should print just print(\"hello\") again."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: 'print("hello")', marks: 2 },
          { type: "onBranch" as const, branch: "main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Second feature, same recipe: git switch -c search, then echo 'print(\"search\")' >> app.py, git add app.py, git commit -m \"Add search\".",
        hints: ["Branch names are cheap — this one starts from main, so it never sees the login line.", "The commit line reads '[search …] Add search'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Add search", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("search")', marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Survey your branch zoo: git branch. Three names — where does the star sit?",
        hints: ["The newest branch you created is where you stand: '* search'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* search", marks: 2 },
          { type: "outputContains" as const, value: "login", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Prove the isolation: git switch login, then cat app.py. Which line greets you — and which one is missing?",
        hints: ["login carries only its own commit on top of the original file: hello, then login — no search line."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: 'print("hello")\nprint("login")', marks: 2 },
          { type: "onBranch" as const, branch: "login", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-switch-dance",
    title: "The Switch Dance",
    difficulty: "easy" as const,
    tags: ["git", "switch", "checkout", "navigation"],
    brief:
      "Back and forth, back and forth: the chart's Switch row as muscle memory. git switch to move, git switch - to bounce back to wherever you just were, the older git checkout spelling doing the same job, and the one-line shrug git prints when you are already there.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1 },
      gitFixture(
        [{ id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] }],
        {},
        { main: "a1b2c3d", docs: "a1b2c3d" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "See the floor before you dance: git branch.",
        hints: ["Two branches point at the same commit; * marks main."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* main", marks: 2 },
          { type: "outputContains" as const, value: "docs", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Step over: git switch docs.",
        hints: ["git switch <branch> checks out that branch; the confirmation reads \"Switched to branch 'docs'\"."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to branch 'docs'", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Bounce straight back with the shortcut: git switch -. Where did you land?",
        hints: ["A lone - means 'the branch I was on a moment ago'.", "git remembers one step of history: main."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to branch 'main'", marks: 2 },
          { type: "onBranch" as const, branch: "main", marks: 2 },
        ],
      },
      {
        id: "s4",
        prompt: "The older spelling says the same thing: git checkout docs.",
        hints: ["checkout is the pre-'switch' command; for branches it behaves identically.", "Even the confirmation message is word for word the same."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to branch 'docs'", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Try to switch to where you already stand: git switch docs again. Git's reply?",
        hints: ["Switching to the current branch changes nothing, so git says so instead of pretending to work: \"Already on 'docs'\"."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Already on 'docs'", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "One more bounce — this time with the old spelling of the shortcut: git checkout -. Verify where you ended up with git branch if you like.",
        hints: ["checkout - works exactly like switch -: one hop back to main.", "The star tells the truth: '* main'."],
        marks: 4,
        checks: [
          { type: "onBranch" as const, branch: "main", marks: 2 },
          { type: "outputContains" as const, value: "Switched to branch 'main'", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-legacy-checkout",
    title: "The Old Spellings",
    difficulty: "medium" as const,
    tags: ["git", "checkout", "branch", "safety"],
    brief:
      "Every chart's Create and Switch rows carry the older git checkout spellings — you will meet them in every pre-2020 tutorial and every legacy codebase. Create with checkout -b, move with plain checkout, then provoke git's dirt guard and clear it with git restore so the switch can finish.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1 },
      gitFixture(
        [{ id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] }],
        {},
        { main: "a1b2c3d" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "The old way to branch off: git checkout -b hotfix. Same result as git switch -c, different vocabulary.",
        hints: ["-b says 'create a branch and move onto it' — the confirmation reads \"Switched to a new branch 'hotfix'\"."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to a new branch 'hotfix'", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Do the work: echo 'print(\"hotfix\")' >> app.py, git add app.py, git commit -m \"Hotfix crash\".",
        hints: ["Append, stage, commit — three commands while hotfix is checked out."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Hotfix crash", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("hotfix")', marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Back to safety with the same spelling: git checkout main.",
        hints: ["Plain checkout <branch> is the older form of git switch <branch>."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to branch 'main'", marks: 2 },
          { type: "onBranch" as const, branch: "main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Now the guard: echo 'print(\"wip\")' >> app.py (leave it unstaged), then try git checkout hotfix. Read the refusal — what is git protecting?",
        hints: [
          "Your uncommitted edit differs between the two branches — switching would either lose it or smuggle it across.",
          "The error says your changes 'would be overwritten by switch' and tells you to commit or stash them first.",
        ],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "would be overwritten by switch", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "You did not want that wip line after all — discard it with git restore app.py, then git status to confirm you are clean.",
        hints: [
          "git restore <file> copies the recorded version back over your working copy — the discard button.",
          "After the restore, status should end with 'nothing to commit, working tree clean'.",
        ],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/project/app.py", value: 'print("hello")', marks: 2 },
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The tree is clean, so the old spelling works: git checkout hotfix, then git branch to see where you stand.",
        hints: ["Same guard, same command — only the dirt is gone now.", "The star should read '* hotfix'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* hotfix", marks: 2 },
          { type: "outputContains" as const, value: "main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-branch-rename",
    title: "Rename, Don't Rewrite",
    difficulty: "easy" as const,
    tags: ["git", "branch", "rename"],
    brief:
      "The name on a branch is just a label — the 'Delete and rename' row's git branch -m moves it without touching a single commit. Rename the branch you are standing on (git follows you), rename another one explicitly, watch both old names disappear, and prove the history never noticed.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1, "notes.txt": "draft\n" },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "First draft of notes", time: 1727827200000, files: { "app.py": HELLO_V1, "README.md": README_V1, "notes.txt": "draft\n" }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "a1b2c3d", develop: "b4c5d6e" },
        "develop"
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Where are we? git branch — which name carries the star?",
        hints: ["This repository opens on develop; main sits one commit behind."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* develop", marks: 2 },
          { type: "outputContains" as const, value: "main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Snapshot the history before renaming anything: git log --oneline.",
        hints: ["Memorise (or just read) the two lines — you will see them again, unchanged, at the end."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e First draft of notes\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Rename the branch you are standing on: git branch -m feature-x (one name = rename the current branch), then git branch to see it.",
        hints: [
          "With a single argument, -m renames where you are standing — no separate old name needed.",
          "The star follows the label: '* feature-x'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* feature-x", marks: 2 },
          { type: "outputContains" as const, value: "main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Rename the other one with both names spelled out: git branch -m main trunk — then confirm with git branch.",
        hints: ["Two arguments mean 'old new': git branch -m main trunk.", "git refuses if trunk already existed — labels stay unique."],
        marks: 4,
        checks: [
          { type: "branchExists" as const, branch: "trunk", marks: 2 },
          { type: "outputContains" as const, value: "* feature-x", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "The rename changed no history: git log --oneline again. Same two lines, same ids?",
        hints: ["A branch is a label pointing at a commit — moving the label cannot alter the commits behind it."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e First draft of notes\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Final listing: git branch — exactly two lines, and neither of the old names survives. What are they?",
        hints: ["Sorted alphabetically: '* feature-x' first, then '  trunk'. develop and main are gone."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "* feature-x\n  trunk", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-delete-guard",
    title: "The Delete Guards",
    difficulty: "medium" as const,
    tags: ["git", "branch", "delete", "errors"],
    brief:
      "Three refusal messages stand between you and an empty branch list — and every one of them is teaching you something. Delete the checked-out branch (refused), a branch that never existed (refused), an unmerged branch (refused with advice), then follow the advice, take the safe path, and end with one clean line.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("hardened")\n', "README.md": README_V1 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Harden the parser", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("hardened")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Wild experiment", time: 1727913600000, files: { "app.py": 'print("hello")\nprint("wild")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e", stale: "a1b2c3d", risky: "c7d8e9f" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Guard one: delete where you stand — git branch -d main. Read the refusal.",
        hints: ["HEAD is pointing at main right now; git will not pull the branch out from under itself."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "Cannot delete branch 'main' checked out", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Guard two: aim at a name that does not exist — git branch -d nosuch. What does git say?",
        hints: ["git validates the name against the branch list before doing anything."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "branch 'nosuch' not found", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Guard three, the important one: git branch -d risky. Its tip is not in main's history — read the whole refusal, suggestion included.",
        hints: [
          "-d checks reachability first: 'The branch 'risky' is not fully merged.'",
          "The second line of the error names the override you will use in the next step.",
        ],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "not fully merged", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-d", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Accept the advice — you checked and the experiment is junk: git branch -D risky.",
        hints: ["Capital D skips the reachability check entirely."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Deleted branch risky", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-D", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "One left to clear — and this one needs no force: git branch -d stale. Why does -d accept it?",
        hints: ["stale points at the base commit, which is already part of main's history — nothing would be lost.", "The output reads 'Deleted branch stale (was a1b2c3d).'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Deleted branch stale", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-d", marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The clean sweep: git branch. What survived?",
        hints: ["Three guards, two deletions, one survivor: '* main'."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "* main", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  // ---- Batch 4: Merge ----
  {
    id: "git-merge-no-ff",
    title: "Merge with a Record",
    difficulty: "hard" as const,
    tags: ["git", "merge", "no-ff", "branch"],
    brief:
      "A plain merge would silently slide main forward — fast-forward — and leave no evidence a branch ever existed. The Merge row's git merge --no-ff forces a real merge commit whose two parents document the join. Land it, then read the proof in the log: the Merge: header and your first graph join.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Add experiments", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("experiments")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "a1b2c3d", feature: "b4c5d6e" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Survey before merging: git branch — where is main, where is feature?",
        hints: ["main sits at the base commit; feature is one commit ahead of it."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* main", marks: 2 },
          { type: "outputContains" as const, value: "feature", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "main's history so far: git log --oneline. Just one commit, right?",
        hints: ["From main, the walk sees only main's tip and its ancestors."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "a1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Bring feature in — but insist on a paper trail: git merge --no-ff feature. What message does the merge commit carry?",
        hints: [
          "--no-ff refuses the fast-forward shortcut and always writes a merge commit.",
          "The result line reads \"[main …] Merge branch 'feature'\".",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Merge branch 'feature'", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--no-ff", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "The history now: git log --oneline — three lines. Which one sits on top, and which two commits does it connect?",
        hints: ["Top: the merge commit, then Add experiments, then Start the project.", "The merge id is fresh — it did not exist before this step."],
        marks: 4,
        checks: [
          { type: "outputMatches" as const, pattern: "[0-9a-f]{7} Merge branch 'feature'", marks: 2 },
          { type: "outputContains" as const, value: "b4c5d6e Add experiments", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Zoom into the merge commit itself: git log -n 1. Find the 'Merge:' header — what does it list?",
        hints: [
          "A commit with two parents prints 'Merge: <parent1> <parent2>' right under the id.",
          "The two parents are main's old tip and feature's tip — the join, recorded forever.",
        ],
        marks: 5,
        checks: [
          { type: "outputContains" as const, value: "Merge branch 'feature'", marks: 2 },
          { type: "outputContains" as const, value: "Merge: ", marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The reward: git status, then peek at app.py — feature's work is now main's work, and the tree is clean.",
        hints: ["The merge checked feature's change into your working directory: print(\"experiments\") is there.", "And status ends with 'nothing to commit, working tree clean'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("experiments")', marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-ff-vs-no-ff",
    title: "Fast-Forward vs. the Record",
    difficulty: "hard" as const,
    tags: ["git", "merge", "ff", "no-ff", "history"],
    brief:
      "The same repository, two merge styles. First a plain git merge quick — a fast-forward that just moves the label, leaving no merge commit behind. Then build a side branch and merge it with --no-ff, and compare the two shapes of history in git log --oneline.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Land the quick win", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("quick")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "a1b2c3d", quick: "b4c5d6e" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Before: git log --oneline — main's single commit.",
        hints: ["Everything else happens on top of 'a1b2c3d Start the project'."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "a1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Style one: git merge quick — a plain, fast-forwardable merge. Which word announces the shortcut?",
        hints: ["When main is strictly BEHIND, git just moves the branch pointer — no merge commit is written.", "The announcement is 'Fast-forward', preceded by an 'Updating a…b' line."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Fast-forward", marks: 2 },
          { type: "outputContains" as const, value: "Updating a1b2c3d", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Count the evidence: git log --oneline. How many lines — and is there any 'Merge' line among them?",
        hints: ["A fast-forward leaves the history looking exactly as if you had committed on main yourself.", "Two lines, no merge commit: that is the whole point of the next step."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e Land the quick win\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Style two needs a branch to merge: git switch -c sidequest.",
        hints: ["-c creates the branch at main's current tip and steps onto it."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to a new branch 'sidequest'", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Give it something to merge: echo \"Side quest begins.\" >> README.md, git add README.md, git commit -m \"Side quest work\".",
        hints: ["Append one line, stage it, commit it — all while sidequest is checked out."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Side quest work", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Back to main — git switch main — and this time demand the record: git merge --no-ff sidequest.",
        hints: [
          "Two commands: switch first (git refuses to merge from a dirty or wrong branch), then merge with the flag.",
          "The result line reads \"[main …] Merge branch 'sidequest'\".",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Merge branch 'sidequest'", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--no-ff", marks: 1 },
        ],
      },
      {
        id: "s7",
        prompt: "The comparison, settled: git log --oneline. This time a Merge line leads the list — how does the shape differ from step 3?",
        hints: [
          "The merge commit is an extra node with two parents: it remembers where the side branch joined.",
          "Fast-forward hides the branch; --no-ff documents it.",
        ],
        marks: 4,
        checks: [
          { type: "outputMatches" as const, pattern: "[0-9a-f]{7} Merge branch 'sidequest'", marks: 2 },
          { type: "outputContains" as const, value: "Side quest work", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-merge-abort",
    title: "Bailing Out",
    difficulty: "medium" as const,
    tags: ["git", "merge", "abort", "conflict"],
    brief:
      "A merge has collided with a conflict in app.py — markers everywhere, status crying 'unmerged'. You are allowed to change your mind: read the wreckage (status, cat), prove you cannot cheat past it with --continue, then cancel the whole attempt with git merge --abort and watch the working tree snap back to where you started.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("main was here")\n', "README.md": README_V1 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Add main line", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("main was here")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Add feature line", time: 1727913600000, files: { "app.py": 'print("hello")\nprint("feature line")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e", feature: "c7d8e9f" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Cause the accident: git merge feature. Both sides edited app.py — read the CONFLICT message.",
        hints: [
          "You are on main; merging feature brings in a commit that changed the same file differently.",
          "The error reads 'CONFLICT (content): Merge conflict in app.py' and 'Automatic merge failed'.",
        ],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "Merge conflict in app.py", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Survey the damage: git status. What section is the file listed under now?",
        hints: ["'You have unmerged paths.' with app.py marked 'both modified' — git will not commit until it is resolved."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "You have unmerged paths.", marks: 2 },
          { type: "outputContains" as const, value: "both modified:   app.py", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "See the markers with your own eyes: cat app.py. What three sentinels frame the two versions?",
        hints: ["<<<<<<< HEAD marks the start of your side, ======= splits, >>>>>>> feature ends theirs.", "Never commit a file that still contains them."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "<<<<<<< HEAD", marks: 2 },
          { type: "outputContains" as const, value: ">>>>>>> feature", marks: 1 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Try to sneak past: git merge --continue without fixing anything. What stops you?",
        hints: ["finishMerge re-checks for leftover markers before recording anything.", "The refusal names the file: 'you still have conflict markers in: app.py'."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "you still have conflict markers in", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--continue", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "New plan: cancel everything — git merge --abort. Then confirm app.py is byte-for-byte your pre-merge version again.",
        hints: [
          "--abort restores the branch you were on before the merge started and clears the merge state.",
          "The file returns to its main version: print(\"hello\") then print(\"main was here\") — no markers.",
        ],
        marks: 4,
        checks: [
          {
            type: "fileEquals" as const,
            path: "/home/student/project/app.py",
            value: 'print("hello")\nprint("main was here")',
            marks: 2,
          },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--abort", marks: 1 },
          { type: "onBranch" as const, branch: "main", marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Proof of a clean escape: git status. As if the merge never happened.",
        hints: ["No unmerged paths, nothing staged: 'nothing to commit, working tree clean'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 2 },
          { type: "outputContains" as const, value: "On branch main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-merge-two-conflicts",
    title: "Two Conflicts, One Merge",
    difficulty: "hard" as const,
    tags: ["git", "merge", "conflict", "continue"],
    brief:
      "The full collision protocol from the chart's Merge row, twice over: one merge, TWO conflicted files. Read the short status (UU, UU), rewrite each file with a real resolution, stage both, and only then does git merge --continue accept the result and write 'Merge branch feature'.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("main edit")\n', "README.md": "# Demo\n\nMain notes.\n" },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Main edits", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("main edit")\n', "README.md": "# Demo\n\nMain notes.\n" }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Feature edits", time: 1727913600000, files: { "app.py": 'print("hello")\nprint("feature edit")\n', "README.md": "# Demo\n\nFeature notes.\n" }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e", feature: "c7d8e9f" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Start the merge: git merge feature. Both sides rewrote BOTH files — how many conflicts does git report?",
        hints: ["The CONFLICT line lists every collided path, comma-separated, in sorted order.", "You are looking for 'Merge conflict in README.md, app.py'."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "CONFLICT (content): Merge conflict in README.md, app.py", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "The terse damage report: git status -s. What does UU mean, and which two files carry it?",
        hints: ["Both columns U = both sides modified the path (unmerged, unmerged).", "Two lines: 'UU README.md' and 'UU app.py'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "UU README.md", marks: 2 },
          { type: "outputContains" as const, value: "UU app.py", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Resolve the readme first — keep your side: echo '# Demo' > README.md (a single > rewrites the conflicted file with your resolution).",
        hints: [
          "A resolution is just a file with no markers left in it — git cannot guess, you must write it.",
          "Overwriting is fine here: the conflicted content is disposable once you decide the winner.",
        ],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/project/README.md", value: "# Demo", marks: 3 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Now app.py, where both edits deserve to survive: rebuild it as print(\"hello\"), print(\"main edit\"), print(\"feature edit\") — one > for the first line, then >> for the other two. No markers may remain.",
        hints: [
          "echo 'print(\"hello\")' > app.py, then echo 'print(\"main edit\")' >> app.py and echo 'print(\"feature edit\")' >> app.py.",
          "git merge --continue scans the file for <<<<<<< and >>>>>>> before it will record anything.",
        ],
        marks: 5,
        checks: [
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("feature edit")', marks: 2 },
          {
            type: "fileMatches" as const,
            path: "/home/student/project/app.py",
            pattern: "^(?![\\s\\S]*<<<<<<<)(?![\\s\\S]*>>>>>>>)[\\s\\S]*$",
            marks: 2,
          },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Tell git the resolutions are final — git add README.md app.py — then git status to see everything lined up under 'Changes to be committed:'.",
        hints: ["git add marks a conflicted path as resolved, moving it out of the unmerged list.", "Both files should appear as 'modified:' entries ready for the merge commit."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Changes to be committed:", marks: 2 },
          { type: "outputContains" as const, value: "modified:   README.md", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Finish the job: git merge --continue. Watch the commit message git writes for you.",
        hints: ["With no markers left and everything staged, --continue records the merge commit.", "The result line reads \"[main …] Merge branch 'feature'\"."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Merge branch 'feature'", marks: 2 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--continue", marks: 2 },
        ],
      },
    ],
  },
  {
    id: "git-merge-up-to-date",
    title: "Already Up to Date",
    difficulty: "easy" as const,
    tags: ["git", "merge", "up-to-date", "history"],
    brief:
      "The most boring merge output in Git is also the most reassuring. Merge a branch whose commits are already in your history — 'Already up to date.' Merge the branch you are standing on — same answer. Do some new work, merge again, and learn to trust that git counts ancestry, not enthusiasm.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("fixed")\n', "README.md": README_V1 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Ship the fix", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("fixed")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e", feature: "a1b2c3d" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "The layout: git branch — where does feature point compared to main?",
        hints: ["feature still sits at the base commit; main moved one commit past it."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* main", marks: 2 },
          { type: "outputContains" as const, value: "feature", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Try to merge feature into main: git merge feature. Read the one-line reply.",
        hints: [
          "feature's tip is already an ancestor of main's tip — there is literally nothing to bring in.",
          "The reply is git's classic 'Already up to date.'",
        ],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "Already up to date.", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "The degenerate case: merge the branch you are standing on — git merge main. Same reply?",
        hints: ["A branch is trivially up to date with itself — its tip IS your tip."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "Already up to date.", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Confirm nothing changed: git log --oneline — still just the original two commits?",
        hints: ["An up-to-date merge writes no commit and moves no branch."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e Ship the fix\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Do some work: echo 'print(\"more\")' >> app.py, git add app.py, git commit -m \"More work\".",
        hints: ["Append, stage, commit — main moves one commit further ahead."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "More work", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Merge feature one last time — git merge feature. feature's tip is now even further behind. Verdict?",
        hints: ["Being behind is exactly what 'up to date' means from your side: everything feature has, you already have."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "Already up to date.", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-hotfix-ship",
    title: "Ship the Hotfix",
    difficulty: "hard" as const,
    tags: ["git", "branch", "merge", "switch", "cleanup"],
    brief:
      "The branching chart's full loop as one continuous drill — main → feature branch → main again: branch off with switch -c, commit the fix, hop back, merge it into the record with --no-ff, verify the history and the working tree, then delete the branch you no longer need. Production incidents, end to end.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("release")\n', "README.md": README_V1 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Regular release", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("release")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "b4c5d6e" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Incident open — branch off immediately: git switch -c hotfix.",
        hints: ["-c creates the branch at the current release commit and steps onto it in one move."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to a new branch 'hotfix'", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Apply the fix: echo 'print(\"fixed\")' >> app.py, git add app.py, git commit -m \"Patch the crash\".",
        hints: ["Three commands: append the fix, stage it, commit it — while hotfix is checked out."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Patch the crash", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("fixed")', marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Back to the release line: git switch main. Notice app.py in your directory — is the fix here yet?",
        hints: ["Switching restores main's files: the fix lives only on hotfix so far.", "But the tree must be clean for the switch — you committed, so it is."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to branch 'main'", marks: 2 },
          { type: "onBranch" as const, branch: "main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Merge it into the record: git merge --no-ff hotfix. What message does the merge commit carry?",
        hints: ["--no-ff keeps the incident visible in history even though a fast-forward was possible.", "The result line reads \"[main …] Merge branch 'hotfix'\"."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Merge branch 'hotfix'", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--no-ff", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Verify the ship: git log --oneline (the merge leads), and confirm the fix landed in your working tree.",
        hints: [
          "Top line is the merge, then 'Patch the crash', then the older history.",
          "A file check on app.py should now find print(\"fixed\") — the merge checked it out for you.",
        ],
        marks: 4,
        checks: [
          { type: "outputMatches" as const, pattern: "[0-9a-f]{7} Merge branch 'hotfix'", marks: 2 },
          { type: "outputContains" as const, value: "Patch the crash", marks: 1 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("fixed")', marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Post-incident cleanup: git branch -d hotfix — it merged cleanly, so the safe delete should take it.",
        hints: ["-d checks that hotfix's tip is reachable from main — the merge commit made it so."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Deleted branch hotfix", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-d", marks: 1 },
        ],
      },
      {
        id: "s7",
        prompt: "Final state: git branch. The incident left no branches behind — what does the list say?",
        hints: ["One line: '* main', now carrying both the release and the fix."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "* main", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  // ---- Batch 5: Recovery ----
  {
    id: "git-restore-experiment",
    title: "Undo an Edit",
    difficulty: "medium" as const,
    tags: ["git", "restore", "worktree", "undo"],
    brief:
      "You wrecked a tracked file and there is no recycle bin — but the recorded version is one command away. This is the three-box flow's arrow pointing backwards: git restore copies from the repository over your working directory, refuses files git has never heard of, and leaves git diff with nothing left to show.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("oops I wrecked it")\n', "README.md": README_V1 },
      gitFixture(
        [{ id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] }],
        {},
        { main: "a1b2c3d" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Assess the damage: git status. Which file is dirty?",
        hints: ["Only app.py differs from the recorded version — look under 'Changes not staged for commit:'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "modified:   app.py", marks: 2 },
          { type: "outputContains" as const, value: "Changes not staged for commit:", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "See exactly what the bad edit did: git diff. Which line was added?",
        hints: ["Plain git diff shows working directory versus the recorded/staged version.", "The '+print(\"oops I wrecked it\")' line is the culprit."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "diff --git a/app.py b/app.py", marks: 2 },
          { type: "outputContains" as const, value: '+print("oops I wrecked it")', marks: 2 },
        ],
      },
      {
        id: "s3",
        prompt: "Undo it for real — git restore app.py. No confirmation prompt, no trash can: the recorded version is back on disk.",
        hints: [
          "git restore <file> without flags resets the WORKING DIRECTORY from the recorded version.",
          "The proof is state, not output: the wrecked line is simply gone.",
        ],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/project/app.py", value: 'print("hello")', marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Confirm the rescue: git status — the reward line.",
        hints: ["Nothing differs anymore: 'nothing to commit, working tree clean'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Test the boundary: git restore secrets.txt — a file git has never seen. Read the refusal.",
        hints: ["restore only knows files that are tracked or staged — everything else is not its business.", "The error reads: pathspec 'secrets.txt' did not match any file(s) known to git."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "did not match any file(s) known to git", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "One more round for muscle memory: echo \"temp\" >> README.md, then git restore README.md, then git status to prove you are clean again.",
        hints: ["Break it, restore it, verify it — the recovery loop in three commands."],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/project/README.md", value: "# Demo", marks: 2 },
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-restore-unstage",
    title: "Unstage It",
    difficulty: "medium" as const,
    tags: ["git", "restore", "staged", "unstage"],
    brief:
      "git add is easy to regret — git restore --staged is the undo, and it points the OTHER way: the index goes back to the recorded version while your edits stay untouched on disk. Unstage a brand-new file (it becomes untracked again), unstage an edit (it stays modified), and watch the two columns of git status -s trade places.",
    fs: repoFs(
      "/home/student/project",
      {
        "app.py": 'print("hello")\nprint("second line")\n',
        "README.md": README_V1,
        "scratch.txt": "wip notes\n",
      },
      gitFixture(
        [{ id: "a1b2c3d", message: "First draft", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] }],
        {},
        { main: "a1b2c3d" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Two kinds of change are waiting: git status. Find the modified file AND the brand-new one.",
        hints: ["app.py is modified (tracked, edited); scratch.txt is untracked — new files are a different species."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "modified:   app.py", marks: 1 },
          { type: "outputContains" as const, value: "Untracked files:", marks: 1 },
          { type: "outputContains" as const, value: "scratch.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Sweep it ALL in — git add . — then git status. Everything is staged now: the edit AND the new file.",
        hints: ["git add . stages everything from here down.", "Look for 'Changes to be committed:' with scratch.txt as 'new file'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Changes to be committed:", marks: 2 },
          { type: "outputContains" as const, value: "new file:   scratch.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "That new file was a mistake — unstage it: git restore --staged scratch.txt, then git status -s. What happened to its two letters?",
        hints: [
          "--staged aims the restore at the INDEX, not your disk — the file itself is left alone.",
          "A file git has never committed returns to untracked: '?? scratch.txt'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "?? scratch.txt", marks: 2 },
          { type: "outputContains" as const, value: "M  app.py", marks: 1 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--staged", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "The staged edit is still there, right? git status — confirm app.py remains under 'Changes to be committed:' (and its text is still on disk).",
        hints: ["Unstaging scratch.txt touched nothing else — app.py is staged, and the second line is still in the file."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Changes to be committed:", marks: 2 },
          { type: "outputContains" as const, value: "modified:   app.py", marks: 1 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("second line")', marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Now unstage the edit too — git restore --staged app.py — then git status -s. Where did the M go?",
        hints: [
          "The index falls back to the recorded version, but the working directory keeps your edit.",
          "The line should now read ' M app.py': first column blank, second column M.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: " M app.py", marks: 2 },
          { type: "outputContains" as const, value: "?? scratch.txt", marks: 1 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--staged", marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Nothing was thrown away: cat app.py — your second line is still there, waiting for a future git add. And scratch.txt still exists too.",
        hints: ["restore --staged only moves the index — disks are sacred.", "cat should print both print(\"hello\") and print(\"second line\")."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: 'print("second line")', marks: 2 },
          { type: "fileExists" as const, path: "/home/student/project/scratch.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-stash-context-switch",
    title: "Shelve the Side Quest",
    difficulty: "medium" as const,
    tags: ["git", "stash", "switch", "wip"],
    brief:
      "Half-finished work in the working directory, and you MUST switch branches right now. git refuses (the dirt guard), git stash offers a shelf: save the mess, switch away, inspect the shelf with stash list, come home, and pop it back. The context-switch escape hatch from git help stash.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("half-finished idea")\n', "README.md": README_V1 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Write the docs", time: 1727827200000, files: { "app.py": HELLO_V1, "README.md": "# Demo\n\nDocs live here.\n" }, parents: ["a1b2c3d"] },
        ],
        {},
        { main: "a1b2c3d", docs: "b4c5d6e" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "The situation: git status -s. One file, half-edited — what are the two letters?",
        hints: ["' M app.py' — modified, not staged, not committed."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: " M app.py", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "You need the docs branch NOW — try git switch docs. Read the refusal: git will not carry your uncommitted edit across.",
        hints: [
          "The branches hold different content for app.py, so switching would overwrite your work.",
          "The error tells you the two escapes: 'commit your changes or stash them'.",
        ],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "would be overwritten by switch", marks: 2 },
          { type: "errorContains" as const, value: "Please commit your changes or stash them before you switch", marks: 2 },
        ],
      },
      {
        id: "s3",
        prompt: "Take the second escape: git stash — shelve the mess — and watch the working directory heal itself. Then check with git status -s if you like.",
        hints: [
          "git stash (no arguments = push) saves your changes to a shelf and resets the working directory to the recorded version.",
          "The save message reads 'Saved working directory and index state WIP on main: …'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Saved working directory and index state WIP on main", marks: 2 },
          { type: "fileEquals" as const, path: "/home/student/project/app.py", value: 'print("hello")', marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "The guard lifts: git switch docs — with a clean tree, the switch just works.",
        hints: ["Same command as step 2, different working directory — now nothing is in the way."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to branch 'docs'", marks: 2 },
          { type: "onBranch" as const, branch: "docs", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Your shelf is portable: git stash list. What is waiting for you, and which branch was it saved from?",
        hints: ["Each shelf prints as 'stash@{0}: WIP on <branch>: <commit>'.", "The branch in the label is main — stashes remember where you were standing."],
        marks: 4,
        checks: [
          { type: "outputMatches" as const, pattern: "stash@\\{0\\}: WIP on main", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Job done — go home and unload the shelf: git switch main, then git stash pop. Is your half-finished line back?",
        hints: [
          "Switch first (popping onto docs would fight its files), then git stash pop applies the top shelf and drops it.",
          "The pop ends with 'Dropped refs/stash@{0}' and app.py carries the half-finished line again.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Dropped refs/stash@{0}", marks: 2 },
          {
            type: "fileEquals" as const,
            path: "/home/student/project/app.py",
            value: 'print("hello")\nprint("half-finished idea")',
            marks: 1,
          },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-reset-undo-commit",
    title: "Rewind the Last Commit",
    difficulty: "hard" as const,
    tags: ["git", "reset", "undo", "soft", "mixed", "hard"],
    brief:
      "The three undo verbs, one per box of the chart: git reset --soft keeps your work staged (index only), --mixed clears the staging but keeps the files (working directory), --hard throws everything away and resyncs from the record. Commit twice, rewind twice, then watch --hard erase a bad overwrite you just made.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": HELLO_V1, "README.md": README_V1 },
      gitFixture(
        [{ id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] }],
        {},
        { main: "a1b2c3d" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "Build the history you are going to undo: echo 'print(\"one\")' >> app.py, git add app.py, git commit -m \"First draft\".",
        hints: ["Append, stage, commit — your first commit on top of the starting one."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "First draft", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "And a second one you will regret: echo 'print(\"two\")' >> app.py, git add app.py, git commit -m \"Wip junk\".",
        hints: ["Same three beats — this commit becomes the rewind target."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Wip junk", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: 'print("two")', marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "The crime scene: git log --oneline — three commits, newest first. Which one is about to vanish?",
        hints: ["Top line: Wip junk. HEAD~1 will mean 'First draft' after the first rewind."],
        marks: 4,
        checks: [
          {
            type: "outputMatches" as const,
            pattern: "[0-9a-f]{7} Wip junk[\\s\\S]*[0-9a-f]{7} First draft[\\s\\S]*a1b2c3d Start the project",
            marks: 3,
          },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Rewind style one — keep everything STAGED: git reset --soft HEAD~1, then git status -s. Where did the commit go, and where is its content?",
        hints: [
          "--soft moves only the branch label; the index keeps the content of the commit you undid.",
          "status -s shows 'M  app.py': staged, ready to re-commit — nothing was lost.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "M  app.py", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--soft", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Rewind style two — keep the files, drop the staging: git reset --mixed HEAD~1, then git status -s again.",
        hints: [
          "--mixed (the default) moves the label AND empties the index; your edits stay on disk.",
          "The line flips to ' M app.py': modified, unstaged, uncommitted — the commit is gone entirely.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: " M app.py", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--mixed", marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Rewind style three, the dangerous one: echo \"garbage\" > README.md to wreck it, then git reset --hard HEAD, then cat README.md. What came back?",
        hints: [
          "--hard resyncs BOTH the index and the working directory from HEAD — the overwrite never happened.",
          "cat prints '# Demo' again: hard resets are absolute, which is exactly why they are guarded.",
        ],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "# Demo", marks: 2 },
          { type: "fileEquals" as const, path: "/home/student/project/README.md", value: "# Demo", marks: 1 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--hard", marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-tag-release",
    title: "Tag the Release",
    difficulty: "easy" as const,
    tags: ["git", "tag", "release", "history"],
    brief:
      "Milestones deserve names, not hash numbers. Tag the current tip with git tag v1.0.0, list your tags, pin an older commit with a second tag, watch git guard a duplicate name, then use the tag as a ref for log and show — lightweight labels, exactly as git help tag describes them.",
    fs: repoFs(
      "/home/student/project",
      { "app.py": 'print("hello")\nprint("parse")\n', "README.md": README_V2 },
      gitFixture(
        [
          { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
          { id: "b4c5d6e", message: "Add the parser", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("parse")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
          { id: "c7d8e9f", message: "Polish docs", time: 1727913600000, files: { "app.py": 'print("hello")\nprint("parse")\n', "README.md": README_V2 }, parents: ["b4c5d6e"] },
        ],
        {},
        { main: "c7d8e9f" }
      )
    ),
    steps: [
      {
        id: "s1",
        prompt: "The history you are about to milestone: git log --oneline — three commits.",
        hints: ["Polish docs is the tip; the parser landed in the middle."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "c7d8e9f Polish docs\nb4c5d6e Add the parser\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Name this moment: git tag v1.0.0 (current tip, no commit argument needed), then list with plain git tag.",
        hints: ["With one argument, git tag creates a lightweight tag at HEAD.", "The listing prints one name per line: v1.0.0."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "v1.0.0", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Pin the older milestone too — git tag v0.9.0 b4c5d6e — then git tag to see both. What order do they list in?",
        hints: ["A second argument tags a commit other than HEAD: the exact id you named.", "Tags list alphabetically: v0.9.0 above v1.0.0."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "v0.9.0\nv1.0.0", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Accidents happen: try to create v1.0.0 a second time — git tag v1.0.0. Read the guard message.",
        hints: ["Tag names are unique — git refuses rather than silently moving your milestone."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "tag 'v1.0.0' already exists", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "A tag is a ref wherever refs are accepted: git log --oneline v0.9.0 — history as of that milestone.",
        hints: ["The walk starts from the tagged commit and its ancestors — Polish docs is newer, so it is absent.", "Two lines: Add the parser, then Start the project."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e Add the parser\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Inspect the milestone itself: git show v0.9.0 --stat — message, author, and the files that commit changed.",
        hints: ["show resolves the tag exactly like a commit id.", "The tally line reads ' 1 file changed'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Add the parser", marks: 2 },
          { type: "outputContains" as const, value: "1 file changed", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-remote-push",
    title: "Push to Your First Remote",
    difficulty: "hard" as const,
    tags: ["git", "remote", "push", "tracking"],
    brief:
      "Every chapter of git help remote in one run: a push with no remote fails, git remote add registers the server, push -u publishes the branch AND records the tracking ref (git branch -a proves it), a repeat push reports 'Everything up-to-date', and origin/main becomes a readable ref for git log.",
    fs: {
      dirs: ["/home/student/project"],
      files: [
        { path: "/home/student/project/app.py", content: 'print("hello")\nprint("v1")\n' },
        { path: "/home/student/project/README.md", content: README_V1 },
        {
          path: "/home/student/project/.git",
          content: gitFixture(
            [
              { id: "a1b2c3d", message: "Start the project", time: 1727740800000, files: { "app.py": HELLO_V1, "README.md": README_V1 }, parents: [] },
              { id: "b4c5d6e", message: "Ship version 1", time: 1727827200000, files: { "app.py": 'print("hello")\nprint("v1")\n', "README.md": README_V1 }, parents: ["a1b2c3d"] },
            ],
            {},
            { main: "b4c5d6e" }
          ),
        },
        {
          path: "/home/student/server-repo.git",
          content: JSON.stringify({
            version: 1,
            branch: "main",
            commits: [],
            branches: { main: "" },
            staged: {},
            tracked: [],
            local: {},
          }),
        },
      ],
      home: "/home/student/project",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Publish without planning first: git push origin main. Read the complaint — git has no idea what 'origin' is yet.",
        hints: ["Pushes need a registered remote name; this repository has none."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "does not appear to be a git repository", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Register the server: git remote add origin /home/student/server-repo.git, then git remote to list it.",
        hints: [
          "remote add <name> <path>: the conventional name for 'the server this came from' is origin.",
          "The listing prints the path twice — once marked (fetch), once (push).",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "origin\t/home/student/server-repo.git (fetch)", marks: 2 },
          { type: "outputContains" as const, value: "(push)", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Publish, and wire up the tracking in the same stroke: git push -u origin main. What does the server answer?",
        hints: [
          "-u registers the upstream (origin/main) so future bare 'git push' / 'git pull' know where to go.",
          "The first push reports '* [new branch]      main -> main'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "[new branch]", marks: 2 },
          { type: "outputContains" as const, value: "main -> main", marks: 1 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-u", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Proof that -u did something: git branch -a. What new name joined the list?",
        hints: ["-a adds remote-tracking refs to the local list.", "origin/main is the mirror of the server's branch — it appears now because you pushed."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "origin/main", marks: 2 },
          { type: "outputContains" as const, value: "* main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Push again with nothing new: git push origin main. What does a satisfied server say?",
        hints: ["Local and remote tips are identical — there is literally nothing to transfer."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "Everything up-to-date", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "The remote-tracking ref is readable everywhere refs are accepted: git log --oneline origin/main — the server's view of history.",
        hints: [
          "origin/main resolves through the tracking map to the tip you pushed.",
          "Two lines, newest first: Ship version 1, then Start the project.",
        ],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "b4c5d6e Ship version 1\na1b2c3d Start the project", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  // @@BATCHES@@
];

/** Practice problems, schema-validated at module load. */
export const GIT_PRACTICE_PROBLEMS: Problem[] = rawGitProblems.map((p) => problemSchema.parse(p));

/** The intended solution for each practice problem, as a student would type it. */
export const GIT_SOLUTIONS: Record<string, string[]> = {
  "git-adopt-existing": [
    "cd site",
    "git init -b main",
    "git status",
    "git add .",
    "git status",
    "git commit -m \"Adopt the site\"",
    "git status",
  ],
  "git-stage-selectively": [
    "git status -s",
    "git add app.py",
    "git status -s",
    "git commit -m \"Ship the app fix\"",
    "git status",
    "git add README.md",
    "git commit -m \"Update the readme\"",
    "git status",
    "git log --oneline",
  ],
  "git-two-areas-two-commits": [
    "echo 'print(\"one\")' >> app.py",
    "git diff",
    "git add app.py",
    "git status -s",
    "echo 'print(\"two\")' >> app.py",
    "git diff",
    "git commit -m \"First edit\"",
    "git status -s",
    "git add app.py",
    "git commit -m \"Second edit\"",
    "git log --oneline",
    "git status",
  ],
  "git-clean-tree-guard": [
    "git status",
    "git commit -m \"Oops\"",
    "echo \"temp notes\" >> README.md",
    "git status -s",
    "git commit -m \"Still nothing\"",
    "git restore README.md",
    "git status",
    "git diff",
  ],
  "git-review-loop": [
    "echo 'print(\"reviewed\")' >> app.py",
    "git diff",
    "git add app.py",
    "git diff --staged",
    "git commit -m \"Review the change\"",
    "git show",
    "git log --stat",
    "echo 'print(\"next\")' >> app.py",
    "git status -s",
  ],
  "git-history-triage": [
    "git status",
    "git log --oneline",
    "git show",
    "git diff",
    "git show HEAD~1",
    "git diff HEAD~1 HEAD",
  ],
  "git-log-graph": [
    "git branch",
    "git log --oneline",
    "git log --oneline --graph --all",
    "git branch -v",
    "git log feature",
    "git log -n 1 --oneline",
  ],
  "git-log-grep": [
    "git log --oneline",
    "git log --oneline --grep Fix",
    "git log --oneline --grep fix",
    "git log --oneline --grep dd",
    "git log --oneline --grep Fix -n 1",
    "git log --grep Fix",
  ],
  "git-log-author": [
    "git log --oneline",
    "git log --oneline --author Ada",
    "git log --oneline --author Turing",
    "git log --oneline --author Turing --since 2024-10-03",
    "git log --author Ada",
    "git log --oneline --author Nobody",
  ],
  "git-log-since": [
    "git log --oneline",
    "git log --oneline --since 2024-07-01",
    "git log --oneline --until 2024-06-30",
    "git log --oneline --since 2024-06-01 --until 2024-12-31",
    "git log --oneline --since 2030-01-01",
    "git log --since 2025-01-01",
  ],
  "git-diff-branches": [
    "git branch",
    "git diff main feature",
    "git diff feature main",
    "git diff main feature --name-only -- app.py",
    "git show feature --stat",
    "git diff feature main --name-only",
  ],
  "git-history-per-branch": [
    "git branch",
    "git log --oneline",
    "git log --oneline feature",
    "git log --oneline --all",
    "git switch feature",
    "git log --oneline",
    "git branch -a",
  ],
  "git-branch-cleanup": [
    "git branch",
    "git branch -d feature",
    "git branch -d experiment",
    "git branch -D experiment",
    "git branch -d main",
    "git branch",
  ],
  "git-two-features": [
    "git switch -c login",
    "echo 'print(\"login\")' >> app.py",
    "git add app.py",
    "git commit -m \"Add login\"",
    "git switch main",
    "cat app.py",
    "git switch -c search",
    "echo 'print(\"search\")' >> app.py",
    "git add app.py",
    "git commit -m \"Add search\"",
    "git branch",
    "git switch login",
    "cat app.py",
  ],
  "git-switch-dance": ["git branch", "git switch docs", "git switch -", "git checkout docs", "git switch docs", "git checkout -"],
  "git-legacy-checkout": [
    "git checkout -b hotfix",
    "echo 'print(\"hotfix\")' >> app.py",
    "git add app.py",
    "git commit -m \"Hotfix crash\"",
    "git checkout main",
    "echo 'print(\"wip\")' >> app.py",
    "git checkout hotfix",
    "git restore app.py",
    "git status",
    "git checkout hotfix",
    "git branch",
  ],
  "git-branch-rename": [
    "git branch",
    "git log --oneline",
    "git branch -m feature-x",
    "git branch",
    "git branch -m main trunk",
    "git branch",
    "git log --oneline",
    "git branch",
  ],
  "git-delete-guard": ["git branch -d main", "git branch -d nosuch", "git branch -d risky", "git branch -D risky", "git branch -d stale", "git branch"],
  "git-merge-no-ff": [
    "git branch",
    "git log --oneline",
    "git merge --no-ff feature",
    "git log --oneline",
    "git log -n 1",
    "git status",
  ],
  "git-ff-vs-no-ff": [
    "git log --oneline",
    "git merge quick",
    "git log --oneline",
    "git switch -c sidequest",
    "echo \"Side quest begins.\" >> README.md",
    "git add README.md",
    "git commit -m \"Side quest work\"",
    "git switch main",
    "git merge --no-ff sidequest",
    "git log --oneline",
  ],
  "git-merge-abort": ["git merge feature", "git status", "cat app.py", "git merge --continue", "git merge --abort", "git status"],
  "git-merge-two-conflicts": [
    "git merge feature",
    "git status -s",
    "echo '# Demo' > README.md",
    "echo 'print(\"hello\")' > app.py",
    "echo 'print(\"main edit\")' >> app.py",
    "echo 'print(\"feature edit\")' >> app.py",
    "git add README.md app.py",
    "git status",
    "git merge --continue",
  ],
  "git-merge-up-to-date": [
    "git branch",
    "git merge feature",
    "git merge main",
    "git log --oneline",
    "echo 'print(\"more\")' >> app.py",
    "git add app.py",
    "git commit -m \"More work\"",
    "git merge feature",
  ],
  "git-hotfix-ship": [
    "git switch -c hotfix",
    "echo 'print(\"fixed\")' >> app.py",
    "git add app.py",
    "git commit -m \"Patch the crash\"",
    "git switch main",
    "git merge --no-ff hotfix",
    "git log --oneline",
    "git branch -d hotfix",
    "git branch",
  ],
  "git-restore-experiment": [
    "git status",
    "git diff",
    "git restore app.py",
    "git status",
    "git restore secrets.txt",
    "echo \"temp\" >> README.md",
    "git restore README.md",
    "git status",
  ],
  "git-restore-unstage": [
    "git status",
    "git add .",
    "git status",
    "git restore --staged scratch.txt",
    "git status -s",
    "git status",
    "git restore --staged app.py",
    "git status -s",
    "cat app.py",
  ],
  "git-stash-context-switch": ["git status -s", "git switch docs", "git stash", "git switch docs", "git stash list", "git switch main", "git stash pop"],
  "git-reset-undo-commit": [
    "echo 'print(\"one\")' >> app.py",
    "git add app.py",
    "git commit -m \"First draft\"",
    "echo 'print(\"two\")' >> app.py",
    "git add app.py",
    "git commit -m \"Wip junk\"",
    "git log --oneline",
    "git reset --soft HEAD~1",
    "git status -s",
    "git reset --mixed HEAD~1",
    "git status -s",
    "echo \"garbage\" > README.md",
    "git reset --hard HEAD",
    "cat README.md",
  ],
  "git-tag-release": [
    "git log --oneline",
    "git tag v1.0.0",
    "git tag",
    "git tag v0.9.0 b4c5d6e",
    "git tag",
    "git tag v1.0.0",
    "git log --oneline v0.9.0",
    "git show v0.9.0 --stat",
  ],
  "git-remote-push": [
    "git push origin main",
    "git remote add origin /home/student/server-repo.git",
    "git remote",
    "git push -u origin main",
    "git branch -a",
    "git push origin main",
    "git log --oneline origin/main",
  ],
  // @@SOLUTIONS@@
};
