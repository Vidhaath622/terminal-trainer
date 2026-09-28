/**
 * Filesystem commands: pwd, cd, ls, mkdir, touch, cp, mv, rm, chmod, tree.
 * Pure TypeScript - no UI imports.
 */
import type { CommandImpl } from "./types";
import { fail, ok } from "./types";
import { Vfs, VfsError } from "../vfs";

export const pwd: CommandImpl = (ctx) => ok(ctx.vfs.cwd + "\n");

export const cd: CommandImpl = (ctx, args) => {
  const target = args[0] ?? ctx.env.HOME ?? "/";
  const abs = ctx.vfs.resolve(target);
  if (!ctx.vfs.exists(abs)) return fail(`cd: ${target}: No such file or directory`);
  if (!ctx.vfs.isDir(abs)) return fail(`cd: ${target}: Not a directory`);
  ctx.vfs.cwd = abs;
  return ok();
};

export const ls: CommandImpl = (ctx, args) => {
  let long = false;
  let all = false;
  const targets: string[] = [];
  for (const a of args) {
    if (a.startsWith("-") && a.length > 1 && !a.startsWith("--")) {
      for (const ch of a.slice(1)) {
        if (ch === "l") long = true;
        else if (ch === "a") all = true;
        else return fail(`ls: invalid option -- '${ch}'`);
      }
      continue;
    }
    targets.push(a);
  }
  const t = targets[0] ? ctx.vfs.resolve(targets[0]) : ctx.vfs.cwd;
  if (targets.length > 1) return fail("ls: multiple targets not supported");
  if (!ctx.vfs.exists(t)) return fail(`ls: cannot access '${targets[0]}': No such file or directory`);

  const nodes = ctx.vfs.isDir(t) ? ctx.vfs.listDir(t) : [ctx.vfs.requireNode(t)];
  const visible = nodes.filter((n) => all || !n.name.startsWith("."));
  if (visible.length === 0) return ok("");

  if (!long) {
    return ok(visible.map((n) => n.name).join("\n") + "\n");
  }

  const lines: string[] = [`total ${visible.length}`];
  for (const n of visible) {
    const kindChar = n.kind === "directory" ? "d" : "-";
    const mode = modeToRwx(n.mode);
    const size = n.kind === "file" ? (n.content ?? "").length : 4096;
    const date = new Date(ctx.now()).toISOString().slice(0, 16).replace("T", " ");
    lines.push(`${kindChar}${mode} 1 ${n.owner} ${n.group} ${String(size).padStart(6)} ${date} ${n.name}`);
  }
  return ok(lines.join("\n") + "\n");
};

function modeToRwx(mode: string): string {
  const map: Record<string, string> = {
    "0": "---",
    "1": "--x",
    "2": "-w-",
    "3": "-wx",
    "4": "r--",
    "5": "r-x",
    "6": "rw-",
    "7": "rwx",
  };
  const digits = mode.split("");
  while (digits.length < 3) digits.unshift("0");
  return digits.slice(-3).map((d) => map[d] ?? "---").join("");
}

export const mkdir: CommandImpl = (ctx, args) => {
  let recursive = false;
  const names: string[] = [];
  for (const a of args) {
    if (a === "-p") {
      recursive = true;
      continue;
    }
    if (a.startsWith("-")) return fail(`mkdir: invalid option '${a}'`);
    names.push(a);
  }
  if (names.length === 0) return fail("mkdir: missing operand");
  for (const name of names) {
    try {
      ctx.vfs.mkdir(ctx.vfs.resolve(name), recursive);
    } catch (e) {
      return fail(`mkdir: ${(e as VfsError).message}`);
    }
  }
  return ok();
};

export const touch: CommandImpl = (ctx, args) => {
  const names = args.filter((a) => !a.startsWith("-"));
  if (names.length === 0) return fail("touch: missing file operand");
  for (const name of names) {
    const abs = ctx.vfs.resolve(name);
    if (ctx.vfs.exists(abs)) continue;
    try {
      ctx.vfs.writeFile(abs, "");
    } catch (e) {
      return fail(`touch: ${(e as VfsError).message}`);
    }
  }
  return ok();
};

export const cp: CommandImpl = (ctx, args) => {
  if (args.length < 2) return fail("cp: missing destination file operand");
  const srcArg = args[0];
  const dstArg = args[args.length - 1];
  const src = ctx.vfs.resolve(srcArg);
  const dst = ctx.vfs.resolve(dstArg);
  if (!ctx.vfs.exists(src)) return fail(`cp: cannot stat '${srcArg}': No such file or directory`);
  if (ctx.vfs.isDir(src)) return fail(`cp: ${srcArg} is a directory (not copied)`);

  let dstPath = dst;
  if (ctx.vfs.isDir(dst)) {
    dstPath = dst === "/" ? "/" + ctx.vfs.baseName(src) : dst + "/" + ctx.vfs.baseName(src);
  }
  try {
    const clone = ctx.vfs.cloneSubtree(src);
    clone.name = ctx.vfs.baseName(dstPath);
    ctx.vfs.attach(dstPath, clone);
  } catch (e) {
    return fail(`cp: ${(e as VfsError).message}`);
  }
  return ok();
};

export const mv: CommandImpl = (ctx, args) => {
  if (args.length < 2) return fail("mv: missing destination file operand");
  const srcArg = args[0];
  const dstArg = args[1];
  const src = ctx.vfs.resolve(srcArg);
  const dst = ctx.vfs.resolve(dstArg);
  if (!ctx.vfs.exists(src)) return fail(`mv: cannot stat '${srcArg}': No such file or directory`);

  let dstPath = dst;
  if (ctx.vfs.isDir(dst)) {
    dstPath = dst === "/" ? "/" + ctx.vfs.baseName(src) : dst + "/" + ctx.vfs.baseName(src);
  }
  try {
    const clone = ctx.vfs.cloneSubtree(src);
    clone.name = ctx.vfs.baseName(dstPath);
    ctx.vfs.attach(dstPath, clone);
    ctx.vfs.remove(src, true);
  } catch (e) {
    return fail(`mv: ${(e as VfsError).message}`);
  }
  return ok();
};

export const rm: CommandImpl = (ctx, args) => {
  let recursive = false;
  const names: string[] = [];
  for (const a of args) {
    if (a === "-r" || a === "-rf" || a === "-fr" || a === "-R") {
      recursive = true;
      continue;
    }
    if (a.startsWith("-")) return fail(`rm: invalid option -- '${a}'`);
    names.push(a);
  }
  if (names.length === 0) return fail("rm: missing operand");
  for (const name of names) {
    const abs = ctx.vfs.resolve(name);
    if (!ctx.vfs.exists(abs)) return fail(`rm: cannot remove '${name}': No such file or directory`);
    try {
      ctx.vfs.remove(abs, recursive);
    } catch (e) {
      return fail(`rm: ${(e as VfsError).message}`);
    }
  }
  return ok();
};

export const chmod: CommandImpl = (ctx, args) => {
  const usage = "chmod: invalid mode";
  if (args.length < 2) return fail("chmod: missing operand");
  const mode = args[0];
  if (!/^[0-7]{3,4}$/.test(mode)) return fail(usage + `: '${mode}'`);
  const targets = args.slice(1);
  for (const t of targets) {
    const abs = ctx.vfs.resolve(t);
    if (!ctx.vfs.exists(abs)) return fail(`chmod: cannot access '${t}': No such file or directory`);
    ctx.vfs.chmod(abs, mode.slice(-3));
  }
  return ok();
};

export const tree: CommandImpl = (ctx, args) => {
  const startArg = args.find((a) => !a.startsWith("-")) ?? ".";
  const start = ctx.vfs.resolve(startArg);
  if (!ctx.vfs.exists(start)) return fail(`tree: ${startArg}: No such file or directory`);

  const lines: string[] = [ctx.vfs.baseName(start) === "/" ? "." : ctx.vfs.baseName(start)];
  const { dirs, files } = walkTree(ctx.vfs, start, "", lines);
  lines.push("", `${dirs} directories, ${files} files`);
  return ok(lines.join("\n") + "\n");
};

function walkTree(vfs: Vfs, dir: string, prefix: string, lines: string[]): { dirs: number; files: number } {
  const entries = vfs.listDir(dir);
  let dirs = 0;
  let files = 0;
  entries.forEach((entry, idx) => {
    const last = idx === entries.length - 1;
    const branch = last ? "└── " : "├── ";
    lines.push(prefix + branch + entry.name);
    if (entry.kind === "directory") {
      dirs++;
      const sub = walkTree(vfs, dir === "/" ? "/" + entry.name : dir + "/" + entry.name, prefix + (last ? "   " : "│   "), lines);
      dirs += sub.dirs;
      files += sub.files;
    } else {
      files++;
    }
  });
  return { dirs, files };
}
