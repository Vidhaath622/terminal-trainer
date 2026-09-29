/**
 * ProblemPlayer chrome tests: the score-bar back button.
 * Shown on the standalone /play/[id] route; hidden in compact (embed) mode
 * so the host page's own navigation isn't duplicated inside the iframe.
 */
import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import ProblemPlayer from "./ProblemPlayer";
import { getLaunchProblem } from "@/problems/launch";

// xterm.js needs a real canvas; stub the terminal so jsdom only exercises the chrome.
vi.mock("./TerminalView", () => ({
  default: () => <div data-testid="terminal-stub" />,
}));

// SyncChip probes /api/me on mount; answer synchronously so React tests stay quiet.
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ user: null }), { status: 200 })))
  );
});

const problem = getLaunchProblem("pwd-navigate")!;

describe("ProblemPlayer score bar", () => {
  it("shows a back link to the home page in standalone mode", () => {
    render(<ProblemPlayer problem={problem} />);
    const back = screen.getByTestId("back-btn");
    expect(back.tagName).toBe("A");
    expect(back.getAttribute("href")).toBe("/");
  });

  it("hides the back link in compact (embed) mode", () => {
    render(<ProblemPlayer problem={problem} compact />);
    expect(screen.queryByTestId("back-btn")).toBeNull();
  });

  it("keeps title, marks, and reset in compact mode", () => {
    render(<ProblemPlayer problem={problem} compact />);
    expect(screen.getByText(problem.title)).toBeTruthy();
    expect(screen.getByTestId("marks")).toBeTruthy();
    expect(screen.getByTestId("reset-btn")).toBeTruthy();
  });
});
