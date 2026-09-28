/**
 * Virtual filesystem for the terminal trainer.
 * Pure TypeScript — no DOM, no Node, no UI imports. Runs in browser and Node.
 */

export type NodeKind = "file" | "directory";

export interface VfsNode {
  name: string;
  kind: NodeKind;
  /** octal permission string, e.g. "644" for files, "755" for dirs */
  mode: string;
  owner: string;
  group: string;
  mtime: number;
  /** only for files */
  content?: string;
  children?: Map<string, VfsNode>;
}

export class VfsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VfsError";
  }
}

let clock = 0;
export function _advanceClock(ms: number): void {
  clock += ms;
}
export function _resetClock(): void {
  clock = 0;
}

function now(): number {
  return 1704067200000 + clock;
}

function makeDir(name: string, mode = "755", owner = "student"): VfsNode {
  return { name, kind: "directory", mode, owner, group: owner, mtime: now(), children: new Map() };
}

function makeFile(name: string, content: string, mode = "644", owner = "student"): VfsNode {
  return { name, kind: "file", mode, owner, group: owner, mtime: now(), content, children: undefined };
}

export class Vfs {
  root: VfsNode;
  /** absolute cwd path, always normalized, no trailing slash except "/" */
  cwd = "/";

  constructor(spec?: FsSpec) {
    this.root = makeDir("", "755", "root");
    if (spec) {
      this.root.owner = spec.rootOwner ?? "root";
      this.root.group = spec.rootOwner ?? "root";
    }
    if (spec?.dirs) {
      for (const d of spec.dirs) this.ensureDir(d);
    }
    if (spec?.files) {
      for (const f of spec.files) this.writeFile(f.path, f.content);
    }
  }

  // ---------- path utilities ----------

  /** Normalize a path against cwd; returns absolute path without trailing slash. */
  resolve(p: string): string {
    if (!p || p === ".") p = ".";
    const abs = p.startsWith("/") ? p : joinRel(this.cwd, p);
    const parts = abs.split("/").filter((s) => s.length > 0);
    const out: string[] = [];
    for (const part of parts) {
      if (part === ".") continue;
      if (part === "..") {
        out.pop();
        continue;
      }
      out.push(part);
    }
    return "/" + out.join("/");
  }

  /** Resolve but never go above the resolved symlink-free parent (used by glob-like ops). */
  parentOf(absPath: string): string {
    const parts = absPath.split("/").filter(Boolean);
    parts.pop();
    return "/" + parts.join("/");
  }

  baseName(absPath: string): string {
    const parts = absPath.split("/").filter(Boolean);
    return parts.length === 0 ? "/" : parts[parts.length - 1];
  }

  // ---------- node access ----------

  getNode(absPath: string): VfsNode | null {
    const parts = absPath.split("/").filter(Boolean);
    let node: VfsNode = this.root;
    for (const part of parts) {
      if (node.kind !== "directory" || !node.children) return null;
      const child = node.children.get(part);
      if (!child) return null;
      node = child;
    }
    return node;
  }

  requireNode(absPath: string): VfsNode {
    const n = this.getNode(absPath);
    if (!n) throw new VfsError(`no such file or directory: ${absPath}`);
    return n;
  }

  exists(absPath: string): boolean {
    return this.getNode(absPath) !== null;
  }

  isDir(absPath: string): boolean {
    const n = this.getNode(absPath);
    return n?.kind === "directory";
  }

  isFile(absPath: string): boolean {
    const n = this.getNode(absPath);
    return n?.kind === "file";
  }

  readFile(absPath: string): string {
    const n = this.requireNode(absPath);
    if (n.kind !== "file") throw new VfsError(`${absPath} is a directory`);
    return n.content ?? "";
  }

  writeFile(absPath: string, content: string): void {
    const parentPath = this.parentOf(absPath);
    const parent = this.getNode(parentPath);
    if (!parent || parent.kind !== "directory") {
      throw new VfsError(`no such file or directory: ${parentPath}`);
    }
    const name = this.baseName(absPath);
    const existing = parent.children!.get(name);
    if (existing && existing.kind === "directory") {
      throw new VfsError(`${absPath} is a directory`);
    }
    if (existing) {
      existing.content = content;
      existing.mtime = now();
    } else {
      parent.children!.set(name, makeFile(name, content));
    }
  }

  ensureDir(absPath: string): VfsNode {
    const parts = absPath.split("/").filter(Boolean);
    let node = this.root;
    for (const part of parts) {
      if (node.kind !== "directory") throw new VfsError(`${absPath}: not a directory`);
      let child = node.children!.get(part);
      if (!child) {
        child = makeDir(part);
        node.children!.set(part, child);
      } else if (child.kind !== "directory") {
        throw new VfsError(`${part}: not a directory`);
      }
      node = child;
    }
    return node;
  }

  mkdir(absPath: string, recursive = false): void {
    if (this.exists(absPath)) throw new VfsError(`cannot create directory '${absPath}': File exists`);
    if (recursive) {
      this.ensureDir(absPath);
      return;
    }
    const parent = this.getNode(this.parentOf(absPath));
    if (!parent || parent.kind !== "directory") {
      throw new VfsError(`cannot create directory '${absPath}': No such file or directory`);
    }
    parent.children!.set(this.baseName(absPath), makeDir(this.baseName(absPath)));
  }

  remove(absPath: string, recursive: boolean): void {
    const node = this.requireNode(absPath);
    if (node.kind === "directory") {
      if (!recursive) throw new VfsError(`cannot remove '${absPath}': Is a directory`);
      if (absPath === "/" ) throw new VfsError("refusing to remove root");
    }
    const parent = this.getNode(this.parentOf(absPath));
    if (!parent || !parent.children) throw new VfsError(`no such file or directory: ${absPath}`);
    parent.children.delete(this.baseName(absPath));
  }

  /** Deep clone of subtree. */
  cloneSubtree(absPath: string): VfsNode {
    const n = this.requireNode(absPath);
    return cloneNode(n);
  }

  attach(absPath: string, node: VfsNode): void {
    const parent = this.getNode(this.parentOf(absPath));
    if (!parent || parent.kind !== "directory") {
      throw new VfsError(`cannot stat '${absPath}': No such file or directory`);
    }
    parent.children!.set(this.baseName(absPath), node);
  }

  chmod(absPath: string, mode: string): void {
    const n = this.requireNode(absPath);
    n.mode = mode;
  }

  // ---------- traversal ----------

  listDir(absPath: string): VfsNode[] {
    const n = this.requireNode(absPath);
    if (n.kind !== "directory") throw new VfsError(`not a directory: ${absPath}`);
    return [...n.children!.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  walk(absPath: string): VfsNode[] {
    const out: VfsNode[] = [];
    const n = this.requireNode(absPath);
    out.push(n);
    if (n.kind === "directory") {
      for (const child of this.listDir(absPath)) {
        out.push(...this.walk(joinRel(absPath, child.name)));
      }
    }
    return out;
  }

  /** Count of all nodes (for tree total). */
  countAll(): { dirs: number; files: number } {
    let dirs = 0;
    let files = 0;
    for (const n of this.walk("/")) {
      if (n.kind === "directory") dirs++;
      else files++;
    }
    return { dirs, files };
  }

  /** Snapshot for persistence and grading. */
  snapshot(): Snapshot {
    return { root: serialize(this.root), cwd: this.cwd };
  }

  static fromSnapshot(snap: Snapshot): Vfs {
    const vfs = new Vfs();
    vfs.root = deserialize(snap.root);
    vfs.cwd = snap.cwd ?? "/";
    return vfs;
  }

  clone(): Vfs {
    return Vfs.fromSnapshot(this.snapshot());
  }
}

// ---------- helpers ----------

function joinRel(base: string, rel: string): string {
  if (base === "/") return "/" + rel;
  return base + "/" + rel;
}

function cloneNode(n: VfsNode): VfsNode {
  const copy: VfsNode = { ...n, children: undefined, content: n.content };
  if (n.kind === "directory" && n.children) {
    const m = new Map<string, VfsNode>();
    for (const [k, v] of n.children) m.set(k, cloneNode(v));
    copy.children = m;
  }
  return copy;
}

export interface FsSpec {
  dirs?: string[];
  files?: { path: string; content: string }[];
  rootOwner?: string;
}

export interface Snapshot {
  root: SerializedNode;
  cwd: string;
}

export interface SerializedNode {
  name: string;
  kind: NodeKind;
  mode: string;
  owner: string;
  group: string;
  mtime: number;
  content?: string;
  children?: SerializedNode[];
}

function serialize(n: VfsNode): SerializedNode {
  const out: SerializedNode = {
    name: n.name,
    kind: n.kind,
    mode: n.mode,
    owner: n.owner,
    group: n.group,
    mtime: n.mtime,
  };
  if (n.kind === "file") out.content = n.content ?? "";
  else out.children = [...n.children!.values()].sort((a, b) => a.name.localeCompare(b.name)).map(serialize);
  return out;
}

function deserialize(n: SerializedNode): VfsNode {
  if (n.kind === "file") {
    return { ...n, content: n.content ?? "", children: undefined };
  }
  const children = new Map<string, VfsNode>();
  const node: VfsNode = { ...n, children, content: undefined };
  for (const c of n.children ?? []) children.set(c.name, deserialize(c));
  return node;
}
