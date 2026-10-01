import ProblemLibrary from "@/components/ProblemLibrary";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "Terminal Trainer: practice library",
  description:
    "Every practice problem in one place: filter by difficulty, search by skill, and jump straight into the graded terminal.",
};

export default function ProblemsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <header>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-term-text sm:text-4xl">
            Practice problems
          </h1>
          <p className="prose-body mt-3 text-sm leading-relaxed text-term-muted">
            The full set of graded problems, from your first{" "}
            <code className="rounded bg-term-panel px-1 font-mono text-[11px] text-term-green">pwd</code>{" "}
            to the boss challenge. Filter by difficulty, search by the skills a
            problem exercises, then jump in. Progress and marks are saved in
            your browser as you go.
          </p>
        </header>

        <section className="mt-8">
          <ProblemLibrary />
        </section>
      </main>
    </>
  );
}
