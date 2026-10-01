import CommandReferenceSection from "@/components/CommandReference";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "Terminal Trainer: command library",
  description:
    "Every command the simulated shell supports: what it does, a runnable example with one-click copy, and cautions where a flag can bite.",
};

export default function CommandsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <header>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-term-text sm:text-4xl">
            Command library
          </h1>
          <p className="prose-body mt-3 text-sm leading-relaxed text-term-muted">
            What each command does and one runnable example. Skim it before
            attempting the practice problems, then copy an example straight
            into the terminal to try it. Search by name or text, or filter by
            category.
          </p>
        </header>

        <section className="mt-8">
          <CommandReferenceSection />
        </section>
      </main>
    </>
  );
}
