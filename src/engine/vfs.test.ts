import { describe, it, expect, beforeEach } from "vitest";
import { Vfs, VfsError, _resetClock } from "./vfs";

describe("Vfs path resolution", () => {
  it("resolves absolute and relative paths", () => {
    const vfs = new Vfs();
    expect(vfs.resolve("/a/b")).toBe("/a/b");
    expect(vfs.resolve("a")).toBe("/a");
    expect(vfs.resolve(".")).toBe("/");
    expect(vfs.resolve("..")).toBe("/");
    expect(vfs.resolve("/a/../b")).toBe("/b");
    expect(vfs.resolve("a/b/../c")).toBe("/a/c");
  });

  it("normalizes redundant slashes and dots", () => {
    const vfs = new Vfs();
    expect(vfs.resolve("//a///b/./")).toBe("/a/b");
    expect(vfs.resolve("a/./b")).toBe("/a/b");
  });
});

describe("Vfs node operations", () => {
  let vfs: Vfs;
  beforeEach(() => {
    _resetClock();
    vfs = new Vfs();
  });

  it("writes and reads files", () => {
    vfs.writeFile("/notes.txt", "hello");
    expect(vfs.readFile("/notes.txt")).toBe("hello");
  });

  it("overwrites existing files", () => {
    vfs.writeFile("/f.txt", "one");
    vfs.writeFile("/f.txt", "two");
    expect(vfs.readFile("/f.txt")).toBe("two");
  });

  it("throws writing into a missing parent", () => {
    expect(() => vfs.writeFile("/no/parent/f.txt", "x")).toThrow(VfsError);
  });

  it("refuses to overwrite a directory with a file", () => {
    vfs.mkdir("/d");
    expect(() => vfs.writeFile("/d", "x")).toThrow(VfsError);
  });

  it("mkdir non-recursive fails on missing parent", () => {
    expect(() => vfs.mkdir("/a/b/c")).toThrow(VfsError);
  });

  it("mkdir recursive creates nested dirs", () => {
    vfs.mkdir("/a/b/c", true);
    expect(vfs.isDir("/a/b/c")).toBe(true);
  });

  it("mkdir fails when dir exists", () => {
    vfs.mkdir("/d");
    expect(() => vfs.mkdir("/d")).toThrow(VfsError);
  });

  it("removes files and recursive dirs", () => {
    vfs.writeFile("/f.txt", "x");
    vfs.remove("/f.txt", false);
    expect(vfs.exists("/f.txt")).toBe(false);
    vfs.mkdir("/d/sub", true);
    vfs.writeFile("/d/sub/g.txt", "x");
    vfs.remove("/d", true);
    expect(vfs.exists("/d")).toBe(false);
  });

  it("refuses to remove a dir without -r", () => {
    vfs.mkdir("/d");
    expect(() => vfs.remove("/d", false)).toThrow(VfsError);
  });

  it("refuses to remove root", () => {
    expect(() => vfs.remove("/", true)).toThrow(VfsError);
  });

  it("cp clones subtree via cloneSubtree + attach", () => {
    vfs.mkdir("/src/sub", true);
    vfs.writeFile("/src/sub/a.txt", "aaa");
    const clone = vfs.cloneSubtree("/src");
    clone.name = "dst";
    vfs.attach("/dst", clone);
    expect(vfs.readFile("/dst/sub/a.txt")).toBe("aaa");
    expect(vfs.readFile("/src/sub/a.txt")).toBe("aaa");
  });

  it("chmod changes mode", () => {
    vfs.writeFile("/f.txt", "x");
    vfs.chmod("/f.txt", "600");
    expect(vfs.getNode("/f.txt")!.mode).toBe("600");
  });

  it("listDir sorts entries", () => {
    vfs.writeFile("/b.txt", "");
    vfs.writeFile("/a.txt", "");
    vfs.mkdir("/c");
    expect(vfs.listDir("/").map((n) => n.name)).toEqual(["a.txt", "b.txt", "c"]);
  });

  it("walk visits the start dir first, then descendants pre-order", () => {
    vfs.mkdir("/d/sub", true);
    vfs.writeFile("/d/f.txt", "");
    const names = vfs.walk("/d").map((n) => n.name);
    expect(names).toEqual(["d", "f.txt", "sub"]);
  });

  it("snapshot round-trip preserves structure and content", () => {
    vfs.mkdir("/proj/src", true);
    vfs.writeFile("/proj/src/main.txt", "int main(){}");
    vfs.chmod("/proj/src/main.txt", "600");
    vfs.cwd = "/proj";
    const clone = Vfs.fromSnapshot(vfs.snapshot());
    expect(clone.cwd).toBe("/proj");
    expect(clone.readFile("/proj/src/main.txt")).toBe("int main(){}");
    expect(clone.getNode("/proj/src/main.txt")!.mode).toBe("600");
    clone.writeFile("/proj/src/other.txt", "x");
    expect(vfs.exists("/proj/src/other.txt")).toBe(false);
  });
});
