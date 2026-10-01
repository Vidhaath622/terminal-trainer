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
        className="absolute right-2 top-2 rounded border border-term-border bg-term-panel px-2 py-0.5 font-mono text-[10px] font-medium text-term-muted hover:text-term-text"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto rounded-md border border-term-border bg-[#0a0e14] p-4 pr-16 font-mono text-xs leading-relaxed">
        <code className="font-mono">{children}</code>
      </pre>
    </div>
  );
}
