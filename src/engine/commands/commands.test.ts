import { describe, it, expect, beforeEach } from "vitest";
import { Vfs, _resetClock, type FsSpec } from "../vfs";
import { Shell } from "./index";

function makeShell(spec?: FsSpec, user = "student"): Shell {
  return new Shell(new Vfs(spec), { user });
}

describe("Shell basics", () => {
  it("returns empty output for empty input", () => {
    const sh = makeShell();
    const r = sh.run("");
    expect(r.stdout).toBe("");
    expect(r.error).toBeNull();
  });

  it("records history including the current command", () => {
    const sh = makeShell();
    sh.run("pwd");
    sh.run("whoami");
    expect(sh.history).toEqual(["pwd", "whoami"]);
  });

  it("unknown command gives command not found with exit 127", () => {
    const sh = makeShell();
    const r = sh.run("frobnicate");
    expect(r.code).toBe(127);
    expect(r.error).toBe("frobnicate: command not found");
  });

  it("clear sets the cleared flag", () => {
    expect(makeShell().run("clear").cleared).toBe(true);
  });

  it("parse errors are surfaced with code 2", () => {
    const sh = makeShell();
    const r = sh.run("echo 'unclosed");
    expect(r.code).toBe(2);
    expect(r.error).toContain("syntax error");
  });
});

describe("pwd / cd", () => {
  let sh: Shell;
  beforeEach(() => {
    sh = makeShell({ dirs: ["/home/student/docs"], home: "/home/student", user: "student" } as FsSpec);
  });

  it("pwd prints the cwd", () => {
    expect(sh.run("pwd").stdout).toBe("/\n");
  });

  it("cd changes cwd and pwd follows", () => {
    sh.run("cd /home/student/docs");
    expect(sh.run("pwd").stdout).toBe("/home/student/docs\n");
  });

  it("cd into a file fails", () => {
    sh.run("touch /f");
    const r = sh.run("cd /f");
    expect(r.error).toContain("Not a directory");
  });

  it("cd to missing dir fails", () => {
    expect(sh.run("cd /nope").error).toContain("No such file or directory");
  });
});

describe("ls", () => {
  it("lists plain names by default", () => {
    const sh = makeShell({ files: [{ path: "/a.txt", content: "x" }, { path: "/b.txt", content: "y" }] });
    expect(sh.run("ls").stdout).toBe("a.txt\nb.txt\n");
  });

  it("-l prints long lines with permissions", () => {
    const sh = makeShell({ files: [{ path: "/script.sh", content: "#!/bin/sh" }] });
    const out = sh.run("ls -l /").stdout;
    expect(out).toContain("total");
    expect(out).toContain("-rw-r--r--");
    expect(out).toContain("script.sh");
  });

  it("-a shows dotfiles, default hides them", () => {
    const sh = makeShell();
    sh.run("touch /.hidden");
    sh.run("touch /visible");
    expect(sh.run("ls").stdout).toBe("visible\n");
    expect(sh.run("ls -a").stdout).toContain(".hidden");
  });

  it("fails on missing target", () => {
    expect(sh_runError("ls /nope")).toContain("No such file or directory");
  });

  function sh_runError(line: string): string {
    const sh = makeShell();
    return sh.run(line).error ?? "";
  }
});

describe("mkdir / touch", () => {
  it("creates a directory", () => {
    const sh = makeShell();
    expect(sh.run("mkdir demo").error).toBeNull();
    expect(sh.run("cd demo") && sh.run("pwd").stdout).toBe("/demo\n");
  });

  it("mkdir without -p fails on missing parent, with -p succeeds", () => {
    const sh = makeShell();
    expect(sh.run("mkdir a/b/c").error).not.toBeNull();
    expect(sh.run("mkdir -p a/b/c").error).toBeNull();
  });

  it("touch creates an empty file", () => {
    const sh = makeShell();
    sh.run("touch notes.txt");
    expect(sh.run("cat notes.txt").stdout).toBe("");
  });

  it("touch on existing file leaves content alone", () => {
    const sh = makeShell({ files: [{ path: "/n.txt", content: "keep" }] });
    sh.run("touch /n.txt");
    expect(sh.run("cat /n.txt").stdout).toBe("keep");
  });
});

describe("cp / mv / rm", () => {
  it("cp copies file content", () => {
    const sh = makeShell({ files: [{ path: "/src.txt", content: "data" }] });
    sh.run("cp /src.txt /dst.txt");
    expect(sh.run("cat /dst.txt").stdout).toBe("data");
    expect(sh.run("cat /src.txt").stdout).toBe("data");
  });

  it("cp into an existing directory places the file inside", () => {
    const sh = makeShell({ files: [{ path: "/f.txt", content: "x" }] });
    sh.run("mkdir /d");
    sh.run("cp /f.txt /d");
    expect(sh.run("cat /d/f.txt").stdout).toBe("x");
  });

  it("mv renames a file", () => {
    const sh = makeShell({ files: [{ path: "/old.txt", content: "x" }] });
    sh.run("mv /old.txt /new.txt");
    expect(sh.run("cat /new.txt").stdout).toBe("x");
    expect(sh.run("ls /old.txt").error).not.toBeNull();
  });

  it("mv moves a file into a directory", () => {
    const sh = makeShell({ files: [{ path: "/f.txt", content: "x" }] });
    sh.run("mkdir /d");
    sh.run("mv /f.txt /d");
    expect(sh.run("cat /d/f.txt").stdout).toBe("x");
    expect(sh.run("ls /f.txt").error).not.toBeNull();
  });

  it("rm deletes a file; rm -r deletes a directory", () => {
    const sh = makeShell({ files: [{ path: "/f.txt", content: "x" }] });
    sh.run("mkdir /d");
    expect(sh.run("rm /f.txt").error).toBeNull();
    expect(sh.run("rm /d").error).not.toBeNull();
    expect(sh.run("rm -r /d").error).toBeNull();
  });

  it("rm on missing file errors", () => {
    expect(makeShell().run("rm /ghost").error).toContain("No such file");
  });
});

describe("cat / echo", () => {
  it("cat prints file content", () => {
    const sh = makeShell({ files: [{ path: "/hello.txt", content: "hello\nworld\n" }] });
    expect(sh.run("cat hello.txt").stdout).toBe("hello\nworld\n");
  });

  it("cat with multiple files concatenates", () => {
    const sh = makeShell({ files: [{ path: "/a", content: "a\n" }, { path: "/b", content: "b\n" }] });
    expect(sh.run("cat a b").stdout).toBe("a\nb\n");
  });

  it("cat with no args echoes stdin (pipeline)", () => {
    const sh = makeShell({ files: [{ path: "/f", content: "x\n" }] });
    expect(sh.run("cat f | cat").stdout).toBe("x\n");
  });

  it("echo prints its args", () => {
    expect(makeShell().run("echo hello world").stdout).toBe("hello world\n");
  });

  it("echo -n omits the trailing newline", () => {
    expect(makeShell().run("echo -n hi").stdout).toBe("hi");
  });
});

describe("grep", () => {
  const spec: FsSpec = { files: [{ path: "/log.txt", content: "INFO ok\nERROR bad\nINFO fine\nERROR worse\n" }] };

  it("filters matching lines", () => {
    const sh = makeShell(spec);
    expect(sh.run("grep ERROR /log.txt").stdout).toBe("ERROR bad\nERROR worse\n");
  });

  it("-i ignores case", () => {
    const sh = makeShell({ files: [{ path: "/f", content: "Hello\nworld\n" }] });
    expect(sh.run("grep -i hello /f").stdout).toBe("Hello\n");
  });

  it("-v inverts", () => {
    const sh = makeShell(spec);
    expect(sh.run("grep -v ERROR /log.txt").stdout).toBe("INFO ok\nINFO fine\n");
  });

  it("-c counts", () => {
    const sh = makeShell(spec);
    expect(sh.run("grep -c ERROR /log.txt").stdout).toBe("2\n");
  });

  it("-n shows line numbers", () => {
    const sh = makeShell(spec);
    expect(sh.run("grep -n ERROR /log.txt").stdout).toBe("2:ERROR bad\n4:ERROR worse\n");
  });

  it("works in a pipeline from cat", () => {
    const sh = makeShell(spec);
    expect(sh.run("cat /log.txt | grep INFO").stdout).toBe("INFO ok\nINFO fine\n");
  });

  it("supports regex patterns", () => {
    const sh = makeShell(spec);
    expect(sh.run("grep 'ERR.*worse' /log.txt").stdout).toBe("ERROR worse\n");
  });

  it("no matches prints nothing", () => {
    const sh = makeShell(spec);
    expect(sh.run("grep zzz /log.txt").stdout).toBe("");
  });
});

describe("head / tail / wc", () => {
  const spec: FsSpec = { files: [{ path: "/nums", content: "1\n2\n3\n4\n5\n" }] };

  it("head gives first N lines", () => {
    expect(makeShell(spec).run("head -n 2 /nums").stdout).toBe("1\n2\n");
  });

  it("head -N shorthand works", () => {
    expect(makeShell(spec).run("head -2 /nums").stdout).toBe("1\n2\n");
  });

  it("tail gives last N lines", () => {
    expect(makeShell(spec).run("tail -n 2 /nums").stdout).toBe("4\n5\n");
  });

  it("wc counts lines words chars", () => {
    const sh = makeShell({ files: [{ path: "/f", content: "one two\nthree\n" }] });
    expect(sh.run("wc /f").stdout).toBe("2 3 14 /f\n");
  });

  it("wc -l counts lines only", () => {
    const sh = makeShell({ files: [{ path: "/f", content: "a\nb\nc\n" }] });
    expect(sh.run("wc -l /f").stdout).toBe("3 /f\n");
  });

  it("wc counts stdin in a pipeline", () => {
    const sh = makeShell(spec);
    expect(sh.run("cat /nums | wc -l").stdout).toBe("5\n");
  });
});

describe("sort / uniq", () => {
  it("sort orders lines", () => {
    const sh = makeShell({ files: [{ path: "/f", content: "banana\napple\ncherry\n" }] });
    expect(sh.run("sort /f").stdout).toBe("apple\nbanana\ncherry\n");
  });

  it("uniq removes adjacent duplicates", () => {
    const sh = makeShell({ files: [{ path: "/f", content: "a\na\nb\na\n" }] });
    expect(sh.run("uniq /f").stdout).toBe("a\nb\na\n");
  });
});

describe("find", () => {
  it("lists everything under a path", () => {
    const sh = makeShell({ dirs: ["/p/src"], files: [{ path: "/p/src/a.ts", content: "" }, { path: "/p/README.md", content: "" }] });
    const out = sh.run("find /p").stdout.split("\n").filter(Boolean);
    expect(out).toEqual(["/p", "/p/README.md", "/p/src", "/p/src/a.ts"]);
  });

  it("-name filters by glob", () => {
    const sh = makeShell({ files: [{ path: "/a.log", content: "" }, { path: "/b.txt", content: "" }] });
    expect(sh.run("find / -name '*.log'").stdout).toBe("/a.log\n");
  });

  it("-type f filters files only", () => {
    const sh = makeShell({ dirs: ["/d"], files: [{ path: "/d/f.txt", content: "" }] });
    const out = sh.run("find /d -type f").stdout.split("\n").filter(Boolean);
    expect(out).toEqual(["/d/f.txt"]);
  });
});

describe("chmod / ls -l modes", () => {
  it("chmod changes the mode shown by ls -l", () => {
    const sh = makeShell({ files: [{ path: "/s.sh", content: "x" }] });
    sh.run("chmod 700 /s.sh");
    expect(sh.run("ls -l /s.sh").stdout).toContain("-rwx------");
  });

  it("chmod with invalid mode fails", () => {
    expect(makeShell().run("chmod abc /f").error).not.toBeNull();
  });
});

describe("pipes and redirection", () => {
  it("> writes stdout to a file", () => {
    const sh = makeShell();
    sh.run("echo hello > out.txt");
    expect(sh.run("cat out.txt").stdout).toBe("hello\n");
  });

  it(">> appends to a file", () => {
    const sh = makeShell();
    sh.run("echo one > f.txt");
    sh.run("echo two >> f.txt");
    expect(sh.run("cat f.txt").stdout).toBe("one\ntwo\n");
  });

  it("redirection output is not echoed to the terminal", () => {
    const sh = makeShell();
    expect(sh.run("echo hidden > f.txt").stdout).toBe("");
  });

  it("multi-stage pipeline: grep | sort | head", () => {
    const sh = makeShell({
      files: [{ path: "/f", content: "pear\napple\npear\nbanana\napple\nkumquat\n" }],
    });
    // grep 'an' matches only banana
    expect(sh.run("cat /f | grep an | sort").stdout).toBe("banana\n");
  });
});

describe("session commands", () => {
  it("whoami prints the user", () => {
    expect(makeShell({}, "alice").run("whoami").stdout).toBe("alice\n");
  });

  it("history lists previous commands", () => {
    const sh = makeShell();
    sh.run("pwd");
    sh.run("whoami");
    const out = sh.run("history").stdout;
    expect(out).toContain("1  pwd");
    expect(out).toContain("2  whoami");
    expect(out).toContain("3  history");
  });

  it("man prints a manual page", () => {
    expect(makeShell().run("man grep").stdout).toContain("grep - print lines matching a pattern");
  });

  it("man on unknown topic fails", () => {
    expect(makeShell().run("man bogus").error).not.toBeNull();
  });

  it("help lists commands", () => {
    expect(makeShell().run("help").stdout).toContain("grep");
  });

  it("date prints something date-like", () => {
    const fixed = new Date("2026-01-15T10:30:00Z");
    const sh = new Shell(new Vfs(), { now: () => fixed });
    expect(sh.run("date").stdout).toBe(fixed.toString() + "\n");
  });
});
