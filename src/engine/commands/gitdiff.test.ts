import { describe, it, expect } from "vitest";
import { diffStat, unifiedDiff } from "./gitdiff";

describe("diffStat", () => {
  it("counts a pure modification", () => {
    expect(diffStat("a\nb\nc\n", "a\nX\nc\n")).toEqual({ adds: 1, dels: 1 });
  });

  it("counts an append as adds only", () => {
    expect(diffStat("a\n", "a\nb\n")).toEqual({ adds: 1, dels: 0 });
  });

  it("treats a missing file as all adds, a vanished file as all dels", () => {
    expect(diffStat(null, "x\ny\n")).toEqual({ adds: 2, dels: 0 });
    expect(diffStat("x\ny\n", null)).toEqual({ adds: 0, dels: 2 });
  });

  it("identical or doubly-absent snapshots change nothing", () => {
    expect(diffStat("same\n", "same\n")).toEqual({ adds: 0, dels: 0 });
    expect(diffStat(null, null)).toEqual({ adds: 0, dels: 0 });
  });
});

describe("unifiedDiff", () => {
  it("renders a modification as one hunk with context and a real header", () => {
    const out = unifiedDiff("one\ntwo\nthree\n", "one\ntwo\nTHREE\n", "f.txt");
    const lines = out.split("\n");
    expect(lines[0]).toBe("diff --git a/f.txt b/f.txt");
    expect(lines).toContain("--- a/f.txt");
    expect(lines).toContain("+++ b/f.txt");
    expect(lines).toContain("@@ -1,3 +1,3 @@");
    expect(lines).toContain(" one");
    expect(lines).toContain(" two");
    expect(lines).toContain("-three");
    expect(lines).toContain("+THREE");
  });

  it("clips context to three lines around the change", () => {
    const before = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join("\n") + "\n";
    const after = before.replace("line9", "LINE9");
    const out = unifiedDiff(before, after, "f.txt");
    const body = out.split("@@")[2];
    // 3 context lines before, the change, nothing after (end of file).
    expect(body).toContain(" line6");
    expect(body).toContain(" line7");
    expect(body).toContain(" line8");
    expect(body).not.toContain(" line5");
  });

  it("renders a created file as all additions from /dev/null", () => {
    const out = unifiedDiff(null, "hello\nworld\n", "new.txt");
    const lines = out.split("\n");
    expect(lines).toContain("new file mode 100644");
    expect(lines).toContain("--- /dev/null");
    expect(lines).toContain("+++ b/new.txt");
    expect(lines).toContain("@@ -0,0 +1,2 @@");
    expect(lines).toContain("+hello");
    expect(lines).toContain("+world");
  });

  it("renders a deleted file as all removals to /dev/null", () => {
    const out = unifiedDiff("gone\n", null, "old.txt");
    const lines = out.split("\n");
    expect(lines).toContain("deleted file mode 100644");
    expect(lines).toContain("--- a/old.txt");
    expect(lines).toContain("+++ /dev/null");
    expect(lines).toContain("@@ -1 +0,0 @@");
    expect(lines).toContain("-gone");
  });

  it("returns nothing for identical or doubly-absent snapshots", () => {
    expect(unifiedDiff("same\n", "same\n", "f.txt")).toBe("");
    expect(unifiedDiff(null, null, "f.txt")).toBe("");
  });
});
