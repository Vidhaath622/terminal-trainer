/**
 * Minimal unified-diff generator for the simulated git.
 * Pure TypeScript - no UI imports.
 *
 * Teaching-sized files only: a change between two snapshots renders as a
 * single hunk (common prefix/suffix trimmed, up to 3 context lines around
 * the change). Deterministic and easy to read, which is what the practice
 * problems need. A `null` snapshot means the file does not exist — a
 * creation (everything added) or a deletion (everything removed).
 */

const CONTEXT_LINES = 3;

function toLines(text: string | null): string[] | null {
  if (text === null) return null;
  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export interface DiffStats {
  adds: number;
  dels: number;
}

/** Lines added/removed between two snapshots. `null` = file absent. */
export function diffStat(before: string | null, after: string | null): DiffStats {
  const a = toLines(before);
  const b = toLines(after);
  if (a === null && b === null) return { adds: 0, dels: 0 };
  if (a === null) return { adds: b!.length, dels: 0 };
  if (b === null) return { adds: 0, dels: a.length };
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  return { adds: endB - start, dels: endA - start };
}

/** `1` renders as a bare number, matching git's hunk headers. */
function range(start: number, count: number): string {
  return count === 1 ? String(start) : `${start},${count}`;
}

/** Unified diff of two snapshots; empty string when there is no change. */
export function unifiedDiff(before: string | null, after: string | null, path: string): string {
  const a = toLines(before);
  const b = toLines(after);
  if (a === null && b === null) return "";

  const created = a === null;
  const deleted = b === null;
  if (!created && !deleted) {
    const same = a!.length === b!.length && a!.every((line, i) => line === b![i]);
    if (same) return "";
  }

  let start = 0;
  let endA = a === null ? 0 : a.length;
  let endB = b === null ? 0 : b.length;
  if (a !== null && b !== null) {
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    endA = a.length;
    endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
      endA--;
      endB--;
    }
  }

  const ctxStart = Math.max(0, start - CONTEXT_LINES);
  const ctxBefore = created || deleted ? [] : a!.slice(ctxStart, start);
  const ctxAfter = created || deleted ? [] : a!.slice(endA, Math.min(a!.length, endA + CONTEXT_LINES));

  const oldCount = ctxBefore.length + (endA - start) + ctxAfter.length;
  const newCount = ctxBefore.length + (endB - start) + ctxAfter.length;
  const oldStart = created || oldCount === 0 ? 0 : ctxStart + 1;
  const newStart = deleted || newCount === 0 ? 0 : ctxStart + 1;

  const lines: string[] = [`diff --git a/${path} b/${path}`];
  if (created) lines.push("new file mode 100644");
  if (deleted) lines.push("deleted file mode 100644");
  lines.push(created ? "--- /dev/null" : `--- a/${path}`);
  lines.push(deleted ? "+++ /dev/null" : `+++ b/${path}`);
  lines.push(`@@ -${range(oldStart, oldCount)} +${range(newStart, newCount)} @@`);
  for (const line of ctxBefore) lines.push(` ${line}`);
  for (let i = start; i < endA; i++) lines.push(`-${a![i]}`);
  for (let i = start; i < endB; i++) lines.push(`+${b![i]}`);
  for (const line of ctxAfter) lines.push(` ${line}`);
  return lines.join("\n");
}
