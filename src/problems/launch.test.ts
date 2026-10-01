import { describe, it, expect } from "vitest";
import { LAUNCH_PROBLEMS, getLaunchProblem, gitProblems, GIT_PROBLEM_TAGS } from "./launch";
import { Session } from "@/engine/session";
import { maxMarks } from "@/engine/grader";

describe("launch problem set", () => {
  it("has exactly 20 valid problems", () => {
    expect(LAUNCH_PROBLEMS).toHaveLength(20);
    const ids = LAUNCH_PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(20);
  });

  it("lookup finds a problem by id", () => {
    expect(getLaunchProblem("grep-search")?.title).toBe("Searching with grep");
    expect(getLaunchProblem("nope")).toBeUndefined();
  });

  it("difficulty and marks are sane", () => {
    for (const p of LAUNCH_PROBLEMS) {
      expect(maxMarks(p)).toBeGreaterThan(0);
      expect(p.steps.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("git problem filter", () => {
  it("selects every problem carrying a git tag and nothing else", () => {
    const git = gitProblems();
    const expected = LAUNCH_PROBLEMS.filter((p) => p.tags.some((t) => (GIT_PROBLEM_TAGS as readonly string[]).includes(t)));
    expect(git.map((p) => p.id)).toEqual(expected.map((p) => p.id));
    expect(git.length).toBeGreaterThan(0);
    for (const p of git) {
      expect(p.tags.some((t) => (GIT_PROBLEM_TAGS as readonly string[]).includes(t))).toBe(true);
    }
  });

  it("finds the first-commit problem but not CLI-only problems", () => {
    const ids = gitProblems().map((p) => p.id);
    expect(ids).toContain("git-first-commit");
    expect(getLaunchProblem("git-first-commit")?.title).toBe("Your First Git Commit");
    expect(ids).not.toContain("pwd-navigate");
    expect(ids).not.toContain("grep-search");
  });
});

describe("launch problems are solvable to full marks", () => {
  // The intended solution for each problem, as a student would type it.
  const solutions: Record<string, string[]> = {
    "pwd-navigate": ["pwd", "ls", "cd documents", "cd ~"],
    "ls-inspect": [
      "cat README.md",
      "ls -l",
      "head -n 2 notes/todo.txt",
      "tail -n 1 notes/todo.txt",
    ],
    "mkdir-touch": [
      "mkdir projects",
      "mkdir projects/web",
      "touch projects/web/index.html",
      "mkdir -p deep/a/b/c",
      "tree",
    ],
    "terminal-practice": [
      "mkdir Desktop/terminal-practice",
      "cd Desktop/terminal-practice",
      "pwd",
      "mkdir folder_1",
      "mkdir folder_2",
      "mkdir folder_3",
      "ls",
      "cd folder_1",
      "ls",
      "touch hello.txt",
      "echo \"Hello Terminal\" > hello.txt",
      "cat hello.txt",
    ],
    "morning-routine": [
      "whoami",
      "date",
      "mkdir diary",
      "touch diary/today.txt",
      "echo \"Good morning, terminal!\" > diary/today.txt",
      "cat diary/today.txt",
    ],
    "ask-for-help": ["help", "man ls", "man mkdir", "history", "clear"],
    "treasure-hunt": [
      "cat note.txt",
      "cd downloads",
      "cat clue2.txt",
      "cd ../music",
      "cat clue3.txt",
      "cd ../pictures",
      "cat clue4.txt",
      "cd ~",
      "tree",
      "find . -name '*.secret'",
      "cat music/treasure.secret",
    ],
    "recipe-cards": [
      "mkdir recipes",
      "touch recipes/pasta.txt recipes/salad.txt recipes/dal.txt",
      "echo \"Boil the water.\" > recipes/pasta.txt",
      "echo \"Add the pasta.\" >> recipes/pasta.txt",
      "echo \"Stir often.\" >> recipes/pasta.txt",
      "echo \"Taste it.\" >> recipes/pasta.txt",
      "echo \"Plate it up.\" >> recipes/pasta.txt",
      "echo \"Toss the greens.\" > recipes/salad.txt",
      "echo \"Drizzle olive oil.\" >> recipes/salad.txt",
      "echo \"Serve cold.\" >> recipes/salad.txt",
      "echo \"Rinse the dal.\" > recipes/dal.txt",
      "echo \"Boil water with turmeric.\" >> recipes/dal.txt",
      "echo \"Simmer until soft.\" >> recipes/dal.txt",
      "echo \"Add salt.\" >> recipes/dal.txt",
      "echo \"Garnish with coriander.\" >> recipes/dal.txt",
      "echo \"Serve hot.\" >> recipes/dal.txt",
      "head -n 2 recipes/pasta.txt",
      "tail -n 1 recipes/dal.txt",
      "wc -l recipes/dal.txt",
      "cat recipes/salad.txt",
    ],
    "overwrite-trap": [
      "echo eggs > list.txt",
      "echo flour >> list.txt",
      "echo sugar >> list.txt",
      "cat list.txt",
      "wc -l list.txt",
      "echo \"eggs flour sugar\" > list.txt",
      "wc -l list.txt",
    ],
    "alphabets-workshop": [
      "mkdir alphabets",
      "touch a.txt",
      "ls",
      "echo apple > a.txt",
      "cat a.txt",
      "cp a.txt b.txt",
      "cat b.txt",
      "echo banana > b.txt",
      "cat b.txt",
      "cp a.txt b.txt",
      "cat b.txt",
      "mv alphabets letters",
      "mv a.txt letters/a.txt",
      "ls letters",
      "mv b.txt modifiedName.txt",
      "rm modifiedName.txt",
      "ls",
      "say Terminal is fun",
    ],
    "rename-refactor": [
      "cd mess",
      "ls",
      "mkdir docs",
      "mv \"My Notes.txt\" docs/my-notes.txt",
      "mv draft2FINAL.txt docs/draft-2-final.txt",
      "mv todo.old docs/todo.txt",
      "tree",
    ],
    "cp-mv-rename": [
      "cp report.txt backup/",
      "whoami", // original still exists; no-op command
      "mv photo.jpg portrait.jpg",
      "mv portrait.jpg backup/",
    ],
    "rm-cleanup": [
      "rm junk.txt",
      "rm tmp/old1.log tmp/old2.log",
      "rm keep", // should error, then:
      "rm -r keep",
      "ls", // filler; precious.txt gone with the dir
    ],
    "trash-day": [
      "cd tidy-me",
      "tree",
      "rm old-photo.jpg",
      "rm old-project",
      "rm -r old-project",
      "tree",
    ],
    "grep-search": [
      "grep ERROR /var/log/app.log",
      "grep -c ERROR /var/log/app.log",
      "grep -v INFO /var/log/app.log",
      "cat /var/log/app.log | grep INFO | wc -l",
    ],
    "log-detective": [
      "grep -c ERROR /var/log/server.log",
      "grep -v INFO /var/log/server.log",
      "grep -i error /var/log/server.log",
      "grep WARN /var/log/server.log | sort | uniq -c",
      "grep WARN /var/log/server.log | sort | uniq -c > /home/student/warning-report.txt",
      "wc -l /home/student/warning-report.txt",
    ],
    "find-redirect": [
      "find media -name '*.jpg'",
      "find media -type d",
      "sort readme.txt > sorted.txt",
      "echo done >> sorted.txt",
    ],
    "git-first-commit": [
      "git config --global user.name \"Ada Lovelace\"",
      "git config --global user.email ada@example.com",
      "git config --list",
      "git config --global init.defaultBranch main",
      "cd project",
      "git init",
      "git status",
      "git add .",
      "git status",
      "git commit -m \"First commit\"",
      "git log",
      "git status",
    ],
    "chmod-permissions": [
      "ls -l scripts/backup.sh",
      "chmod 755 scripts/backup.sh",
      "chmod 600 secret.txt",
      "ls -l scripts",
    ],
    "boss-project": [
      "mkdir -p project/src project/docs",
      "cp /tmp/raw-notes.txt /project/docs/",
      "grep DONE /project/docs/raw-notes.txt | wc -l",
      "grep idea /project/docs/raw-notes.txt > /project/ideas.txt",
      "mv /project/docs/raw-notes.txt /project/docs/meeting-notes.txt",
      "rm /tmp/raw-notes.txt",
      "chmod 600 /project/ideas.txt",
    ],
  };

  for (const problem of LAUNCH_PROBLEMS) {
    it(`${problem.id}: solution earns full marks`, () => {
      const session = new Session(problem);
      const cmds = solutions[problem.id];
      expect(cmds, `no solution recorded for ${problem.id}`).toBeDefined();
      for (const cmd of cmds) {
        session.run(cmd);
      }
      expect(session.isComplete).toBe(true);
      expect(session.earned).toBe(maxMarks(problem));
    });
  }

  it("grep-search s3 accepts only the inverted match, not re-grepping", () => {
    const problem = getLaunchProblem("grep-search")!;
    const session = new Session(problem);
    session.run("grep ERROR /var/log/app.log");
    session.run("grep -c ERROR /var/log/app.log");
    session.run("grep ERROR /var/log/app.log"); // wrong: not inverted
    expect(session.currentStepIndex).toBe(2); // stuck on step 3
    session.run("grep -v INFO /var/log/app.log");
    expect(session.currentStepIndex).toBe(3);
  });
});
