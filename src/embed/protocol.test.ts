import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isHostToWidget,
  parseHostProblem,
  connectWidget,
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

describe("parseHostProblem", () => {
  it("accepts a valid teacher-authored problem", () => {
    const result = parseHostProblem({
      id: "custom-1",
      title: "Custom",
      difficulty: "easy",
      brief: "Do it.",
      steps: [{ id: "s1", prompt: "P", marks: 2, checks: [{ type: "fileExists", path: "/f", marks: 2 }] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.problem.id).toBe("custom-1");
  });

  it("rejects invalid problems with readable errors", () => {
    const result = parseHostProblem({ id: "bad" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
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
