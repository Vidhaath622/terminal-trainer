import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isHostToWidget,
  connectWidget,
  isAllowedHostMessage,
  parseAllowedOrigins,
  hasInlineAuthoringAttempt,
  type WidgetToHostMessage,
} from "./protocol";

describe("isHostToWidget", () => {
  it("accepts init and reset messages", () => {
    expect(isHostToWidget({ type: "tt:init" })).toBe(true);
    expect(isHostToWidget({ type: "tt:reset" })).toBe(true);
    expect(isHostToWidget({ type: "tt:init", studentId: "s1" })).toBe(true);
  });

  it("rejects widget messages, garbage, and nulls", () => {
    expect(isHostToWidget({ type: "tt:ready" })).toBe(false);
    expect(isHostToWidget({ type: "other:init" })).toBe(false);
    expect(isHostToWidget("hello")).toBe(false);
    expect(isHostToWidget(null)).toBe(false);
    expect(isHostToWidget(42)).toBe(false);
  });
});

describe("hasInlineAuthoringAttempt", () => {
  it("flags any host message carrying an inline problem payload", () => {
    expect(hasInlineAuthoringAttempt({ type: "tt:init", problem: { id: "x" } })).toBe(true);
    expect(hasInlineAuthoringAttempt({ type: "tt:init", problem: null })).toBe(true);
    expect(hasInlineAuthoringAttempt({ type: "tt:init", problem: undefined })).toBe(false);
  });

  it("passes clean init messages and non-objects through", () => {
    expect(hasInlineAuthoringAttempt({ type: "tt:init", problemId: "grep-search" })).toBe(false);
    expect(hasInlineAuthoringAttempt({ type: "tt:reset" })).toBe(false);
    expect(hasInlineAuthoringAttempt(null)).toBe(false);
    expect(hasInlineAuthoringAttempt("tt:init")).toBe(false);
  });
});

describe("parseAllowedOrigins", () => {
  it("parses a comma-separated list into normalized origins", () => {
    expect(parseAllowedOrigins("https://college.edu, http://localhost:3000")).toEqual([
      "https://college.edu",
      "http://localhost:3000",
    ]);
    expect(parseAllowedOrigins("https://college.edu/path#frag")).toEqual(["https://college.edu"]);
  });

  it("returns an empty list for nothing, junk, or non-http schemes", () => {
    expect(parseAllowedOrigins(null)).toEqual([]);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins("")).toEqual([]);
    expect(parseAllowedOrigins("not a url")).toEqual([]);
    expect(parseAllowedOrigins("javascript:alert(1)")).toEqual([]);
    expect(parseAllowedOrigins("https://a.edu, junk, https://b.edu")).toEqual([
      "https://a.edu",
      "https://b.edu",
    ]);
  });
});

describe("isAllowedHostMessage", () => {
  it("accepts the parent window with no origin pin (public embed)", () => {
    expect(
      isAllowedHostMessage({ origin: "https://any-college.edu", sourceIsParent: true, allowedOrigins: [] })
    ).toBe(true);
  });

  it("rejects senders that are not the parent window", () => {
    expect(
      isAllowedHostMessage({ origin: "https://any-college.edu", sourceIsParent: false, allowedOrigins: [] })
    ).toBe(false);
    expect(
      isAllowedHostMessage({ origin: "https://any-college.edu", sourceIsParent: false, allowedOrigins: ["https://any-college.edu"] })
    ).toBe(false);
  });

  it("enforces the origin allowlist when pinned", () => {
    const allowedOrigins = ["https://college.edu"];
    expect(
      isAllowedHostMessage({ origin: "https://college.edu", sourceIsParent: true, allowedOrigins })
    ).toBe(true);
    expect(
      isAllowedHostMessage({ origin: "https://evil.example", sourceIsParent: true, allowedOrigins })
    ).toBe(false);
  });
});

describe("connectWidget", () => {
  const fakeIframe = () => {
    const sent: unknown[] = [];
    return {
      el: {
        contentWindow: {
          postMessage: (msg: unknown) => sent.push(msg),
        },
      } as unknown as HTMLIFrameElement,
      sent,
    };
  };

  beforeEach(() => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("sends init with studentId and problemId", () => {
    const { el, sent } = fakeIframe();
    const widget = connectWidget(el);
    widget.init({ studentId: "stu-9", problemId: "grep-search" });
    expect(sent).toEqual([{ type: "tt:init", studentId: "stu-9", problemId: "grep-search" }]);
    widget.detach();
  });

  it("sends reset", () => {
    const { el, sent } = fakeIframe();
    const widget = connectWidget(el);
    widget.reset();
    expect(sent).toEqual([{ type: "tt:reset" }]);
    widget.detach();
  });

  it("routes widget events to the right handler", () => {
    const { el } = fakeIframe();
    const onProblemCompleted = vi.fn();
    const onReady = vi.fn();
    connectWidget(el, { onReady, onProblemCompleted });

    const listener = vi.mocked(window.addEventListener).mock.calls[0][1] as (e: MessageEvent) => void;
    const makeEvent = (data: unknown) => ({ source: (el as HTMLIFrameElement).contentWindow, data }) as MessageEvent;

    const readyMsg = { type: "tt:ready", problems: [{ id: "x", title: "X", difficulty: "easy" }] };
    listener(makeEvent(readyMsg));
    expect(onReady).toHaveBeenCalledWith(readyMsg);

    const doneMsg: WidgetToHostMessage = {
      type: "tt:problem:completed",
      problemId: "x",
      earned: 10,
      max: 10,
      durationMs: 5000,
    };
    listener(makeEvent(doneMsg));
    expect(onProblemCompleted).toHaveBeenCalledWith(doneMsg);
    expect(onProblemCompleted.mock.calls[0][0].studentId).toBeUndefined();
  });

  it("ignores messages from other windows and non-tt types", () => {
    const { el } = fakeIframe();
    const onReady = vi.fn();
    connectWidget(el, { onReady });

    const listener = vi.mocked(window.addEventListener).mock.calls[0][1] as (e: MessageEvent) => void;
    listener({ source: null, data: { type: "tt:ready" } } as MessageEvent);
    listener({ source: el.contentWindow, data: { type: "host:chat" } } as MessageEvent);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("detach removes the listener", () => {
    const { el } = fakeIframe();
    const widget = connectWidget(el);
    widget.detach();
    expect(vi.mocked(window.removeEventListener).mock.calls.length).toBe(1);
  });
});
