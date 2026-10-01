/**
 * Cheat-sheet integrity tests: the sheet must mirror the wall chart's
 * structure, and every command it presents as runnable must be one the
 * simulated git actually dispatches — so the sheet and the engine can't
 * drift apart.
 */
import { describe, it, expect } from "vitest";
import { GIT_CHEAT_FLOW, GIT_CHEAT_SHEET } from "./git-cheatsheet";

/** Subcommands the simulated git dispatches (see git-commands.ts). */
const DISPATCHED = new Set([
  "config",
  "init",
  "status",
  "add",
  "commit",
  "log",
  "show",
  "diff",
  "rm",
  "mv",
]);

describe("git cheat sheet", () => {
  it("mirrors the chart: three areas, two transitions, seven sections", () => {
    expect(GIT_CHEAT_FLOW.boxes).toEqual(["Working directory", "Staging area", "Repository"]);
    expect(GIT_CHEAT_FLOW.subtitles).toEqual(["your files", "next commit", "saved history"]);
    expect(GIT_CHEAT_FLOW.steps).toEqual(["git add", "git commit"]);
    expect(GIT_CHEAT_SHEET.map((s) => s.title)).toEqual([
      "Setup (once per machine)",
      "Start and check",
      "Stage",
      "Commit",
      "History",
      "Compare",
      "Remove and rename",
    ]);
  });

  it("every runnable entry uses a subcommand the engine dispatches", () => {
    for (const section of GIT_CHEAT_SHEET) {
      for (const entry of section.entries) {
        expect(entry.cmd.startsWith("git "), `${entry.cmd}`).toBe(true);
        expect(entry.note.trim().length, `${entry.cmd}`).toBeGreaterThan(0);
        if (entry.simulated === false) continue;
        const sub = entry.cmd.split(/\s+/)[1];
        expect(DISPATCHED.has(sub), `${entry.cmd} is documented but not simulated`).toBe(true);
      }
    }
  });

  it("flags exactly the two commands the simulator cannot reproduce", () => {
    const unsimulated = GIT_CHEAT_SHEET.flatMap((s) => s.entries)
      .filter((e) => e.simulated === false)
      .map((e) => e.cmd);
    expect(unsimulated).toEqual(["git add -p", "git commit"]);
  });
});
