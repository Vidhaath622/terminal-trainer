/**
 * /git-problems page tests: the page must render one card per Git-tagged
 * problem (linked to its /play page) and must not leak non-Git problems in.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GitProblemsPage from "./page";
import { gitProblems } from "@/problems/launch";

// The real SiteHeader pulls in the GitHub auth button (network on mount);
// a stub keeps this test about the page's own rendering.
vi.mock("@/components/SiteHeader", () => ({
  default: () => <header data-testid="site-header-stub" />,
}));

describe("Git problems page", () => {
  it("renders a card for every git-tagged problem, linked to its play page", () => {
    render(<GitProblemsPage />);

    const expected = gitProblems();
    expect(expected.length).toBeGreaterThan(0);
    for (const p of expected) {
      const card = screen.getByTestId(`problem-card-${p.id}`);
      expect(card.getAttribute("href")).toBe(`/play/${p.id}`);
      expect(screen.getByText(p.title)).toBeTruthy();
    }
  });

  it("includes the first-commit problem", () => {
    render(<GitProblemsPage />);
    expect(screen.getByText("Your First Git Commit")).toBeTruthy();
  });

  it("does not list non-git problems", () => {
    render(<GitProblemsPage />);
    expect(screen.queryByTestId("problem-card-pwd-navigate")).toBeNull();
    expect(screen.queryByTestId("problem-card-grep-search")).toBeNull();
    expect(screen.queryByTestId("problem-card-boss-project")).toBeNull();
  });

  it("renders the cheat sheet at the bottom", () => {
    render(<GitProblemsPage />);
    expect(screen.getByText("Git fundamentals cheat sheet")).toBeTruthy();
    expect(screen.getByText("Compare")).toBeTruthy();
    expect(screen.getByText("Remove and rename")).toBeTruthy();
    expect(screen.getByText("git add -p")).toBeTruthy();
    expect(screen.getAllByText("not simulated").length).toBe(2);
  });
});
