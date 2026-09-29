import { describe, it, expect } from "vitest";
import { Vfs } from "./vfs";
import { gradeStep, evaluateCheck } from "./grader";
import { problemSchema, stepSchema, problemSetSchema } from "./schema";
import type { Check, Problem, Step } from "./schema";

function makeProblem(step: Partial<Step> & { checks: Check[] }): Problem {
  const sum = step.checks.reduce((s, c) => s + c.marks, 0);
  return problemSchema.parse({
    id: "p1",
    title: "Test problem",
    difficulty: "easy",
    brief: "Do things.",
    steps: [{ id: "s1", prompt: "Do it", hints: [], marks: sum, ...step }],
  });
}

function grade(checks: Check[], opts: { files?: { path: string; content: string }[]; dirs?: string[]; commands?: string[]; lastOutput?: string; modes?: Record<string, string> } = {}) {
  const vfs = new Vfs({ files: opts.files ?? [], dirs: opts.dirs ?? [] });
  for (const [p, m] of Object.entries(opts.modes ?? {})) vfs.chmod(vfs.resolve(p), m);
  const problem = makeProblem({ checks });
  const step = problem.steps[0];
  return gradeStep({
    vfs,
    stepCommands: opts.commands ?? [],
    lastOutput: opts.lastOutput ?? "",
    problem,
    step,
  });
}

describe("filesystem checks", () => {
  it("fileExists passes when the file is there", () => {
    const r = grade([{ type: "fileExists", path: "/notes.txt", marks: 5 }], { files: [{ path: "/notes.txt", content: "" }] });
    expect(r.passed).toBe(true);
    expect(r.earned).toBe(5);
  });

  it("fileExists fails when missing", () => {
    const r = grade([{ type: "fileExists", path: "/notes.txt", marks: 5 }]);
    expect(r.passed).toBe(false);
    expect(r.results[0].message).toContain("not found");
  });

  it("dirExists distinguishes dirs from files", () => {
    const r = grade(
      [
        { type: "dirExists", path: "/d", marks: 2 },
        { type: "dirExists", path: "/f.txt", marks: 2 },
      ],
      { dirs: ["/d"], files: [{ path: "/f.txt", content: "" }] }
    );
    expect(r.results[0].passed).toBe(true);
    expect(r.results[1].passed).toBe(false);
  });

  it("fileAbsent passes after deletion", () => {
    const r = grade([{ type: "fileAbsent", path: "/gone.txt", marks: 3 }]);
    expect(r.passed).toBe(true);
  });

  it("dirEmpty passes only for empty dirs", () => {
    const r1 = grade([{ type: "dirEmpty", path: "/d", marks: 2 }], { dirs: ["/d"] });
    const r2 = grade([{ type: "dirEmpty", path: "/d", marks: 2 }], { dirs: ["/d"], files: [{ path: "/d/x", content: "" }] });
    expect(r1.passed).toBe(true);
    expect(r2.passed).toBe(false);
  });

  it("fileContains checks substring", () => {
    const r = grade([{ type: "fileContains", path: "/f", value: "ERROR", marks: 4 }], { files: [{ path: "/f", content: "an ERROR happened\n" }] });
    expect(r.passed).toBe(true);
  });

  it("fileEquals accepts exact content with or without trailing newline", () => {
    const checks: Check[] = [{ type: "fileEquals", path: "/f", value: "hello", marks: 3 }];
    expect(grade(checks, { files: [{ path: "/f", content: "hello" }] }).passed).toBe(true);
    expect(grade(checks, { files: [{ path: "/f", content: "hello\n" }] }).passed).toBe(true);
    expect(grade(checks, { files: [{ path: "/f", content: "hellox" }] }).passed).toBe(false);
  });

  it("fileMatches uses regex", () => {
    const r = grade([{ type: "fileMatches", path: "/f", pattern: "^\\d{3}$", flags: "m", marks: 3 }], { files: [{ path: "/f", content: "abc\n123\n" }] });
    expect(r.passed).toBe(true);
  });

  it("mode check reads permissions", () => {
    const r = grade([{ type: "mode", path: "/s.sh", mode: "700", marks: 4 }], {
      files: [{ path: "/s.sh", content: "" }],
      modes: { "/s.sh": "700" },
    });
    expect(r.passed).toBe(true);
    const wrong = grade([{ type: "mode", path: "/s.sh", mode: "700", marks: 4 }], { files: [{ path: "/s.sh", content: "" }] });
    expect(wrong.passed).toBe(false);
    expect(wrong.results[0].message).toContain("mode is 644");
  });
});

describe("output checks", () => {
  it("outputEquals compares exact stdout", () => {
    const r = grade([{ type: "outputEquals", value: "/home\n", marks: 2 }], { lastOutput: "/home\n" });
    expect(r.passed).toBe(true);
    const bad = grade([{ type: "outputEquals", value: "/home", marks: 2 }], { lastOutput: "/home\n" });
    expect(bad.passed).toBe(true); // newline tolerance
  });

  it("outputContains and outputMatches", () => {
    expect(grade([{ type: "outputContains", value: "docs", marks: 2 }], { lastOutput: "src docs\n" }).passed).toBe(true);
    expect(grade([{ type: "outputMatches", pattern: "^\\d+$", flags: "", marks: 2 }], { lastOutput: "42\n" }).passed).toBe(true);
    expect(grade([{ type: "outputMatches", pattern: "^\\d+$", flags: "", marks: 2 }], { lastOutput: "abc\n" }).passed).toBe(false);
  });
});

describe("command usage checks", () => {
  it("commandUsed accepts any listed command", () => {
    const r = grade([{ type: "commandUsed", commands: ["grep", "rg"], marks: 2 }], { commands: ["cat /f", "grep x /f"] });
    expect(r.passed).toBe(true);
  });

  it("commandUsed fails when none used", () => {
    const r = grade([{ type: "commandUsed", commands: ["grep"], marks: 2 }], { commands: ["cat /f"] });
    expect(r.passed).toBe(false);
  });

  it("commandUsedWithFlag detects flags", () => {
    const r = grade([{ type: "commandUsedWithFlag", command: "ls", flag: "-l", marks: 2 }], { commands: ["ls -l /"] });
    expect(r.passed).toBe(true);
    expect(grade([{ type: "commandUsedWithFlag", command: "ls", flag: "-l", marks: 2 }], { commands: ["ls /"] }).passed).toBe(false);
  });

  it("commandUsed sees past pipes and redirection", () => {
    const r = grade([{ type: "commandUsed", commands: ["grep"], marks: 2 }], { commands: ["cat /f | grep error"] });
    expect(r.passed).toBe(true);
    const r2 = grade([{ type: "commandUsed", commands: ["grep"], marks: 2 }], { commands: ["echo hi > out.txt"] });
    expect(r2.passed).toBe(false);
  });

  it("cwdEquals compares the student's working directory", () => {
    const vfs = new Vfs({ dirs: ["/home/student/docs"] });
    vfs.cwd = "/home/student/docs";
    const problem = makeProblem({ checks: [{ type: "cwdEquals", path: "/home/student/docs", marks: 3 }] });
    const r = gradeStep({ vfs, stepCommands: ["cd /home/student/docs"], lastOutput: "", problem, step: problem.steps[0] });
    expect(r.passed).toBe(true);
    const vfs2 = new Vfs();
    const r2 = gradeStep({ vfs: vfs2, stepCommands: [], lastOutput: "", problem, step: problem.steps[0] });
    expect(r2.passed).toBe(false);
  });
});

describe("gradeStep aggregation", () => {
  it("sums earned marks and reports partial passes", () => {
    const r = grade(
      [
        { type: "fileExists", path: "/a", marks: 4 },
        { type: "dirExists", path: "/b", marks: 6 },
      ],
      { files: [{ path: "/a", content: "" }] }
    );
    expect(r.earned).toBe(4);
    expect(r.max).toBe(10);
    expect(r.passed).toBe(false);
  });

  it("passes only when all checks pass", () => {
    const r = grade([
      { type: "fileExists", path: "/a", marks: 4 },
      { type: "fileAbsent", path: "/b", marks: 6 },
    ], { files: [{ path: "/a", content: "" }] });
    expect(r.passed).toBe(true);
    expect(r.earned).toBe(10);
  });
});

describe("schema validation", () => {
  it("accepts a valid problem", () => {
    const p = problemSchema.parse({
      id: "x",
      title: "T",
      difficulty: "easy",
      brief: "B",
      steps: [{ id: "s", prompt: "P", marks: 5, checks: [{ type: "fileExists", path: "/a", marks: 5 }] }],
    });
    expect(p.steps[0].checks[0].type).toBe("fileExists");
  });

  it("rejects unknown check types", () => {
    const bad = {
      id: "x", title: "T", difficulty: "easy", brief: "B",
      steps: [{ id: "s", prompt: "P", marks: 5, checks: [{ type: "nope", marks: 1 }] }],
    };
    expect(() => problemSchema.parse(bad)).toThrow();
  });

  it("rejects steps with no checks", () => {
    const bad = {
      id: "x", title: "T", difficulty: "easy", brief: "B",
      steps: [{ id: "s", prompt: "P", marks: 5, checks: [] }],
    };
    expect(() => stepSchema.parse(bad)).toThrow();
  });

  it("problemSetSchema validates a list", () => {
    const s = problemSetSchema.parse({
      problems: [
        { id: "a", title: "A", difficulty: "easy", brief: "x", steps: [{ id: "s", prompt: "p", marks: 1, checks: [{ type: "fileExists", path: "/f", marks: 1 }] }] },
      ],
    });
    expect(s.problems).toHaveLength(1);
  });

  it("applies fs defaults", () => {
    const p = problemSchema.parse({
      id: "x", title: "T", difficulty: "easy", brief: "B",
      steps: [{ id: "s", prompt: "P", marks: 1, checks: [{ type: "fileExists", path: "/a", marks: 1 }] }],
    });
    expect(p.fs.home).toBe("/");
    expect(p.fs.user).toBe("student");
  });
});

describe("evaluateCheck message quality", () => {
  it("gives useful failure messages", () => {
    const vfs = new Vfs();
    const r = evaluateCheck({ type: "fileExists", path: "/missing", marks: 1 }, {
      vfs, stepCommands: [], lastOutput: "",
      problem: makeProblem({ checks: [{ type: "fileExists", path: "/missing", marks: 1 }] }),
      step: makeProblem({ checks: [{ type: "fileExists", path: "/missing", marks: 1 }] }).steps[0],
    });
    expect(r.passed).toBe(false);
    expect(r.message).toContain("/missing");
  });
});
