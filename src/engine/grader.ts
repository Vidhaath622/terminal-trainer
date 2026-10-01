/**
 * Grader: evaluates a step's checks against the student's session state.
 * Pure TypeScript - no UI imports.
 */
import { Vfs } from "./vfs";
import type { Check, Problem, Step } from "./schema";

export interface GradeInput {
  vfs: Vfs;
  /** commands the student ran during the CURRENT step only */
  stepCommands: string[];
  /** stdout of the most recent command (for output* checks) */
  lastOutput: string;
  /** stderr of the most recent command, null when it succeeded (for errorContains) */
  lastError: string | null;
  problem: Problem;
  step: Step;
}

export interface CheckResult {
  check: Check;
  passed: boolean;
  marks: number;
  /** human-readable explanation for the verify panel */
  message: string;
}

export interface GradeResult {
  stepId: string;
  passed: boolean;
  earned: number;
  max: number;
  results: CheckResult[];
}

export function evaluateCheck(check: Check, input: GradeInput): CheckResult {
  const { vfs } = input;
  const pass = (message: string): CheckResult => ({ check, passed: true, marks: check.marks, message });
  const fail = (message: string): CheckResult => ({ check, passed: false, marks: 0, message });

  switch (check.type) {
    case "fileExists": {
      const abs = vfs.resolve(check.path);
      return vfs.isFile(abs)
        ? pass(`file exists: ${check.path}`)
        : fail(`file not found: ${check.path}`);
    }
    case "dirExists": {
      const abs = vfs.resolve(check.path);
      return vfs.isDir(abs)
        ? pass(`directory exists: ${check.path}`)
        : fail(`directory not found: ${check.path}`);
    }
    case "fileAbsent": {
      const abs = vfs.resolve(check.path);
      return vfs.exists(abs)
        ? fail(`still exists: ${check.path}`)
        : pass(`absent: ${check.path}`);
    }
    case "dirEmpty": {
      const abs = vfs.resolve(check.path);
      if (!vfs.isDir(abs)) return fail(`not a directory: ${check.path}`);
      return vfs.listDir(abs).length === 0
        ? pass(`directory empty: ${check.path}`)
        : fail(`directory not empty: ${check.path}`);
    }
    case "fileContains": {
      const abs = vfs.resolve(check.path);
      if (!vfs.isFile(abs)) return fail(`file not found: ${check.path}`);
      return vfs.readFile(abs).includes(check.value)
        ? pass(`file contains ${JSON.stringify(check.value)}`)
        : fail(`file does not contain ${JSON.stringify(check.value)}`);
    }
    case "fileEquals": {
      const abs = vfs.resolve(check.path);
      if (!vfs.isFile(abs)) return fail(`file not found: ${check.path}`);
      const got = vfs.readFile(abs);
      return got === check.value || got === check.value + "\n"
        ? pass(`file equals expected content`)
        : fail(`file content mismatch`);
    }
    case "fileMatches": {
      const abs = vfs.resolve(check.path);
      if (!vfs.isFile(abs)) return fail(`file not found: ${check.path}`);
      const re = new RegExp(check.pattern, check.flags);
      return re.test(vfs.readFile(abs)) ? pass(`file matches /${check.pattern}/`) : fail(`file does not match /${check.pattern}/`);
    }
    case "mode": {
      const abs = vfs.resolve(check.path);
      if (!vfs.exists(abs)) return fail(`not found: ${check.path}`);
      return vfs.getNode(abs)!.mode === check.mode
        ? pass(`mode is ${check.mode}`)
        : fail(`mode is ${vfs.getNode(abs)!.mode}, expected ${check.mode}`);
    }
    case "outputEquals": {
      const got = input.lastOutput;
      const want = check.value.endsWith("\n") ? check.value : check.value + "\n";
      return got === want ? pass("output matches exactly") : fail(`expected output ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
    case "outputContains": {
      return input.lastOutput.includes(check.value)
        ? pass(`output contains ${JSON.stringify(check.value)}`)
        : fail(`output does not contain ${JSON.stringify(check.value)}`);
    }
    case "outputMatches": {
      const re = new RegExp(check.pattern, check.flags);
      const text = input.lastOutput.replace(/\n$/, "");
      return re.test(text) ? pass(`output matches /${check.pattern}/`) : fail(`output does not match /${check.pattern}/`);
    }
    case "errorContains": {
      const err = input.lastError;
      if (err === null) return fail("no error printed - the last command succeeded");
      return err.includes(check.value)
        ? pass(`error contains ${JSON.stringify(check.value)}`)
        : fail(`error does not contain ${JSON.stringify(check.value)}: got ${JSON.stringify(err)}`);
    }
    case "commandUsed": {
      const used = input.stepCommands.some((cmd) => {
        const names = cmd.trim().split(/\s+/);
        return check.commands.some((want) =>
          names.some((n) => n === want || n.split("/").pop() === want)
        );
      });
      return used ? pass(`used one of: ${check.commands.join(", ")}`) : fail(`expected use of: ${check.commands.join(", ")}`);
    }
    case "cwdEquals": {
      return vfs.cwd === check.path
        ? pass(`working directory is ${check.path}`)
        : fail(`working directory is ${vfs.cwd}, expected ${check.path}`);
    }
    case "commandUsedWithFlag": {
      const used = input.stepCommands.some((cmd) => {
        const tokens = cmd.trim().split(/\s+/);
        if (tokens[0] !== check.command) return false;
        return tokens.some((t) => t.includes(check.flag) || t === check.flag);
      });
      return used ? pass(`used ${check.command} with ${check.flag}`) : fail(`expected ${check.command} with ${check.flag}`);
    }
  }
}

export function gradeStep(input: GradeInput): GradeResult {
  const results = input.step.checks.map((c) => evaluateCheck(c, input));
  const earned = results.reduce((s, r) => s + (r.passed ? r.marks : 0), 0);
  const max = input.step.checks.reduce((s, c) => s + c.marks, 0);
  return {
    stepId: input.step.id,
    passed: results.every((r) => r.passed),
    earned,
    max: max === 0 ? input.step.marks : max,
    results,
  };
}

export function maxMarks(problem: Problem): number {
  return problem.steps.reduce((s, st) => s + st.marks, 0);
}

export function stepMaxMarks(step: Step): number {
  return step.checks.reduce((s, c) => s + c.marks, 0);
}
