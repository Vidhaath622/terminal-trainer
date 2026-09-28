import { describe, it, expect } from "vitest";
import { parseLine, ParseError } from "./parser";

describe("parseLine: basic argv", () => {
  it("splits on whitespace", () => {
    const p = parseLine("ls -l /tmp");
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0].args).toEqual(["ls", "-l", "/tmp"]);
    expect(p.stages[0].redirect).toBeNull();
  });

  it("collapses multiple spaces and tabs", () => {
    expect(parseLine("  echo   a\tb  ").stages[0].args).toEqual(["echo", "a", "b"]);
  });

  it("empty line yields empty stage", () => {
    expect(parseLine("").stages[0].args).toEqual([]);
    expect(parseLine("   ").stages[0].args).toEqual([]);
  });
});

describe("parseLine: quoting", () => {
  it("single quotes preserve spaces", () => {
    expect(parseLine("echo 'hello world'").stages[0].args).toEqual(["echo", "hello world"]);
  });

  it("double quotes preserve spaces", () => {
    expect(parseLine('echo "a  b"').stages[0].args).toEqual(["echo", "a  b"]);
  });

  it("empty quoted string is kept as an argument", () => {
    expect(parseLine("echo ''").stages[0].args).toEqual(["echo", ""]);
    expect(parseLine('echo ""').stages[0].args).toEqual(["echo", ""]);
  });

  it("adjacent quoted and unquoted parts concatenate", () => {
    expect(parseLine("echo foo'bar'baz").stages[0].args).toEqual(["echo", "foobarbaz"]);
    expect(parseLine('echo "a"b\'c\'').stages[0].args).toEqual(["echo", "abc"]);
  });

  it("backslash escapes outside quotes", () => {
    expect(parseLine("echo a\\ b").stages[0].args).toEqual(["echo", "a b"]);
    expect(parseLine("echo \\$HOME").stages[0].args).toEqual(["echo", "$HOME"]);
  });

  it("backslash inside double quotes only escapes specials", () => {
    expect(parseLine('echo "a\\nb"').stages[0].args).toEqual(["echo", "a\\nb"]);
    expect(parseLine('echo "a\\"b"').stages[0].args).toEqual(["echo", 'a"b']);
  });

  it("quotes in the middle of a word with spaces inside", () => {
    expect(parseLine("grep 'error log' file.txt").stages[0].args).toEqual(["grep", "error log", "file.txt"]);
  });
});

describe("parseLine: pipes", () => {
  it("splits on unquoted pipes", () => {
    const p = parseLine("cat f | grep x | wc -l");
    expect(p.stages).toHaveLength(3);
    expect(p.stages[0].args).toEqual(["cat", "f"]);
    expect(p.stages[1].args).toEqual(["grep", "x"]);
    expect(p.stages[2].args).toEqual(["wc", "-l"]);
  });

  it("does not split on quoted pipes", () => {
    const p = parseLine("echo 'a|b'");
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0].args).toEqual(["echo", "a|b"]);
  });

  it("does not split on escaped pipes", () => {
    const p = parseLine("echo a\\|b");
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0].args).toEqual(["echo", "a|b"]);
  });
});

describe("parseLine: redirection", () => {
  it("parses > with target", () => {
    const p = parseLine("echo hi > out.txt");
    expect(p.stages[0].redirect).toEqual({ type: ">", token: "out.txt" });
    expect(p.stages[0].args).toEqual(["echo", "hi"]);
  });

  it("parses >> with target", () => {
    expect(parseLine("echo hi >> log").stages[0].redirect).toEqual({ type: ">>", token: "log" });
  });

  it("parses > with quoted target", () => {
    expect(parseLine("echo hi > 'my file.txt'").stages[0].redirect).toEqual({ type: ">", token: "my file.txt" });
  });

  it("redirect may be the only content", () => {
    const p = parseLine("> empty.txt");
    expect(p.stages[0].redirect).toEqual({ type: ">", token: "empty.txt" });
  });
});

describe("parseLine: errors", () => {
  it("throws on unclosed single quote", () => {
    expect(() => parseLine("echo 'abc")).toThrow(ParseError);
  });

  it("throws on unclosed double quote", () => {
    expect(() => parseLine('echo "abc')).toThrow(ParseError);
  });

  it("throws on input redirection", () => {
    expect(() => parseLine("cat < file")).toThrow(ParseError);
  });

  it("throws on missing redirect target", () => {
    expect(() => parseLine("echo hi >")).toThrow(ParseError);
  });

  it("throws on double redirect", () => {
    expect(() => parseLine("echo hi > a > b")).toThrow(ParseError);
  });

  it("throws on stray > or | inside redirect target position", () => {
    expect(() => parseLine("echo hi > | x")).toThrow(ParseError);
  });
});
