import { describe, it, expect } from "vitest";
import { LAUNCH_PROBLEMS, getLaunchProblem } from "./launch";
import { Session } from "@/engine/session";
import { maxMarks } from "@/engine/grader";

describe("launch problem set", () => {
  it("has exactly 9 valid problems", () => {
    expect(LAUNCH_PROBLEMS).toHaveLength(9);
    const ids = LAUNCH_PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(9);
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
    "grep-search": [
      "grep ERROR /var/log/app.log",
      "grep -c ERROR /var/log/app.log",
      "grep -v INFO /var/log/app.log",
      "cat /var/log/app.log | grep INFO | wc -l",
    ],
    "find-redirect": [
      "find media -name '*.jpg'",
      "find media -type d",
      "sort readme.txt > sorted.txt",
      "echo done >> sorted.txt",
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
