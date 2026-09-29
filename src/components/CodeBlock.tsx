"use client";

import { useState } from "react";

export default function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };
  return (
    <div className="relative mt-3">
      <button
        onClick={copy}
        className="absolute right-2 top-2 rounded border border-term-border bg-term-bg px-2 py-0.5 text-[10px] text-term-text/70 hover:text-term-text"
      >
        {copied ? "copied ✓" : "copy"}
      </button>
      <pre className="overflow-x-auto rounded border border-term-border bg-term-bg p-3 text-xs leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}
