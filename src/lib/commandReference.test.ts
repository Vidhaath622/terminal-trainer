import { describe, it, expect } from "vitest";
import { COMMANDS, commandNames } from "@/engine/commands";
import {
  COMMAND_REFERENCE,
  COMMAND_CATEGORIES,
  type CommandEntry,
} from "@/lib/commandReference";

/** Reference entries that document shell operators rather than engine commands. */
const OPERATOR_NAMES = new Set(["|", "> and >>"]);

/** Reference name → engine command name it must cover (null for operators). */
function engineName(entry: CommandEntry): string | null {
  if (OPERATOR_NAMES.has(entry.name)) return null;
  if (entry.name === "history") return "history"; // registered as historyCmd
  return entry.name;
}

describe("command reference library", () => {
  it("covers every command the simulated shell supports", () => {
    const documented = new Set(
      COMMAND_REFERENCE.map(engineName).filter((n): n is string => n !== null)
    );
    for (const cmd of commandNames()) {
      expect(documented, `command '${cmd}' has no reference entry`).toContain(cmd);
    }
  });

  it("does not document commands that do not exist in the engine", () => {
    const engine = new Set(commandNames());
    for (const entry of COMMAND_REFERENCE) {
      const name = engineName(entry);
      if (name === null) continue;
      expect(engine.has(name), `reference documents unknown command '${entry.name}'`).toBe(true);
    }
  });

  it("has exactly one entry per command (no duplicates)", () => {
    const names = COMMAND_REFERENCE.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every entry has a summary, a runnable example and an example note", () => {
    for (const entry of COMMAND_REFERENCE) {
      expect(entry.summary.trim().length, `${entry.name}: summary`).toBeGreaterThan(10);
      expect(entry.summary.endsWith("."), `${entry.name}: summary is a sentence`).toBe(true);
      expect(entry.example.trim().length, `${entry.name}: example`).toBeGreaterThan(1);
      expect(entry.exampleNote.trim().length, `${entry.name}: exampleNote`).toBeGreaterThan(5);
    }
  });

  it("examples start with the documented command name (or are operators)", () => {
    for (const entry of COMMAND_REFERENCE) {
      if (OPERATOR_NAMES.has(entry.name)) {
        // operator examples must actually use the operator symbol
        if (entry.name === "|") expect(entry.example).toContain("|");
        else expect(entry.example).toMatch(/(^|\s)>(>|\s)/);
        continue;
      }
      const first = entry.example.trim().split(/\s+/)[0];
      expect(first, `${entry.name}: example should start with '${entry.name}'`).toBe(entry.name);
    }
  });

  it("uses only the declared categories, all non-empty", () => {
    const cats = new Set(COMMAND_REFERENCE.map((c) => c.category));
    for (const c of cats) expect(COMMAND_CATEGORIES).toContain(c);
    expect(COMMAND_CATEGORIES.length).toBe(cats.size);
  });

  it("keeps the registry and reference in sync both ways (26 engine commands + 2 operators)", () => {
    expect(Object.keys(COMMANDS).length).toBe(26);
    expect(COMMAND_REFERENCE.length).toBe(28);
  });
});
