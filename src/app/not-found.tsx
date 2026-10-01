import Link from "next/link";
import { LAUNCH_PROBLEMS } from "@/problems/launch";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
      <h1 className="font-mono text-xl font-bold">Page not found</h1>
      <p className="prose-body mt-2 text-sm text-term-muted">
        That page doesn&apos;t exist. Try one of the practice problems:
      </p>
      <ul className="mt-5 space-y-1.5 text-sm">
        {LAUNCH_PROBLEMS.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Link href={`/play/${p.id}`} className="text-term-blue hover:underline">
              {p.title}
            </Link>
            <code className="rounded bg-term-panel px-1.5 py-0.5 font-mono text-xs text-term-muted">{p.id}</code>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-term-muted">
        <Link href="/" className="text-term-blue hover:underline">Back to home</Link>
      </p>
    </main>
  );
}
