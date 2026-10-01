import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import ProblemLibrary from "@/components/ProblemLibrary";
import GitCheatSheet from "@/components/GitCheatSheet";
import { gitProblems } from "@/problems/launch";

export const metadata = {
  title: "Terminal Trainer: Git problems",
  description:
    "Git practice in a simulated terminal: set your identity, make your first commit, and read history back — graded step by step.",
};

export default function GitProblemsPage() {
  const problems = gitProblems();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <header>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-term-text sm:text-4xl">
            Git problems
          </h1>
          <p className="prose-body mt-3 text-sm leading-relaxed text-term-muted">
            Version-control practice in the simulated terminal — the one-time
            setup from the{" "}
            <Link
              href="/?theory=git-setup#theory-git-setup"
              className="text-term-blue hover:underline"
            >
              Git setup guide
            </Link>
            , put to work: configure your identity, init a repository, stage,
            commit, and read the history back. {problems.length} graded
            problem{problems.length === 1 ? "" : "s"} so far; new Git problems
            tagged for git land here automatically.
          </p>
        </header>

        <section className="mt-8">
          <ProblemLibrary problems={problems} />
        </section>

        <section className="mt-12 border-t border-term-border pt-8" id="git-cheat-sheet">
          <GitCheatSheet />
        </section>
      </main>
    </>
  );
}
