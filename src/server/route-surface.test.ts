/**
 * Tripwire: the set of HTTP handlers exported by files under src/app/api must
 * equal API_ROUTES, both ways. Adding a route file (e.g. a future authoring
 * endpoint) without deliberately extending the allowlist fails here — remote
 * authoring must stay impossible, so never "just add the entry" for content.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { API_ROUTES, ALLOWED_PREFIXES } from "./api-allowlist";

// vitest runs from the project root (vitest.config.ts lives there).
const API_DIR = path.resolve(process.cwd(), "src/app/api");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (/^route\.(ts|tsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** src/app/api/progress/[problemId]/route.ts -> /api/progress/:problemId */
function routePattern(file: string): string {
  const rel = path.relative(API_DIR, path.dirname(file));
  const segs = rel === "." ? [] : rel.split(path.sep);
  const pattern = segs.map((s) => (s.startsWith("[") ? `:${s.slice(1, -1)}` : s)).join("/");
  return pattern ? `/api/${pattern}` : "/api";
}

function exportedMethods(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const re = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  return [...src.matchAll(re)].map((m) => m[1]);
}

const files = routeFiles(API_DIR);

describe("API route surface", () => {
  it("finds the known route files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every exported handler appears in the allowlist (no hidden endpoints)", () => {
    const allowed = new Set(API_ROUTES.map((r) => `${r.method} ${r.pattern}`));
    const missing: string[] = [];
    for (const file of files) {
      const pattern = routePattern(file);
      for (const method of exportedMethods(file)) {
        const key = `${method} ${pattern}`;
        if (!allowed.has(key)) missing.push(`${key} (${path.relative(process.cwd(), file)})`);
      }
    }
    expect(
      missing,
      "route handlers missing from API_ROUTES — the API is deny-by-default; " +
        "never add an endpoint that accepts authored content (problems, quizzes, test cases, assignments)"
    ).toEqual([]);
  });

  it("every allowlisted route has a real handler file (no phantom entries)", () => {
    const present = new Set<string>();
    for (const file of files) {
      for (const method of exportedMethods(file)) present.add(`${method} ${routePattern(file)}`);
    }
    const phantom = API_ROUTES.map((r) => `${r.method} ${r.pattern}`).filter((k) => !present.has(k));
    expect(phantom, "API_ROUTES lists routes that no handler exports").toEqual([]);
  });

  it("no route file lives outside the known non-authoring prefixes", () => {
    for (const file of files) {
      const pattern = routePattern(file);
      const allowed = ALLOWED_PREFIXES.some((p) => pattern === p || pattern.startsWith(p + "/"));
      expect(
        allowed,
        `authoring-shaped API surface detected: ${pattern} — remote editor access must stay impossible`
      ).toBe(true);
    }
  });
});
