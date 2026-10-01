import Link from "next/link";
import GithubAuthButton from "./GithubAuthButton";

/**
 * SiteHeader: shared top navigation for every page that renders its own
 * header. Flat panel, mono labels, no decorative effects.
 */
export default function SiteHeader() {
  return (
    <header className="border-b border-term-border bg-term-bg/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="font-mono text-sm font-semibold text-term-text hover:text-term-green"
        >
          <span className="text-term-green">&gt;_</span> Terminal Trainer
        </Link>
        <nav aria-label="Site" className="flex items-center gap-4">
          <Link
            href="/problems"
            className="font-mono text-sm text-term-muted hover:text-term-green"
          >
            Problems
          </Link>
          <Link
            href="/commands"
            className="font-mono text-sm text-term-muted hover:text-term-green"
          >
            Commands
          </Link>
          <Link
            href="/docs/embed"
            className="hidden font-mono text-sm text-term-muted hover:text-term-green sm:inline"
          >
            Embed
          </Link>
          <GithubAuthButton />
        </nav>
      </div>
    </header>
  );
}
