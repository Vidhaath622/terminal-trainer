"use client";

/**
 * RevealSection: section wrapper that reveals its children on first scroll
 * into view. Children marked with the `reveal-item` class (and an optional
 * inline `--i` index) stagger in; everything else simply fades up as a block.
 * Under prefers-reduced-motion the settled state renders immediately.
 */
import type { HTMLAttributes, ReactNode } from "react";
import { useReveal } from "@/lib/useReveal";

export default function RevealSection({
  children,
  className = "",
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLElement>) {
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <section ref={ref} className={`${className} reveal-group ${shown ? "reveal-shown" : "reveal-pending"}`} {...rest}>
      {children}
    </section>
  );
}
