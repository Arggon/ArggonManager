import { existsSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ItemType } from "./ids.js";

/** Repo / package root (where package.json and templates/ live). */
export function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // cli/src under tsx, or dist after build
  if (here.endsWith(`${sep}dist`) || here.split(sep).includes("dist")) {
    return resolve(here, "..");
  }
  return resolve(here, "../..");
}

export function bundledTemplatesDir(): string {
  return resolve(packageRoot(), "templates");
}

/** Walk up from startDir looking for tasks/.convention.yml. */
export function findTasksDir(startDir: string): string {
  let dir = resolve(startDir);
  for (;;) {
    const convention = join(dir, "tasks", ".convention.yml");
    if (existsSync(convention)) return join(dir, "tasks");
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("No tasks/ convention found. Run `arggon init` first.");
    }
    dir = parent;
  }
}

export function repoRootFromTasks(tasksDir: string): string {
  return dirname(tasksDir);
}

/**
 * Absolute path for a new work item.
 * parentContainerDir is the parent item's folder (dirname of its index file).
 */
export function newItemPath(opts: {
  tasksDir: string;
  type: ItemType;
  id: string;
  parentContainerDir?: string;
}): string {
  const { tasksDir, type, id, parentContainerDir } = opts;
  if (type === "initiative") {
    return join(tasksDir, id, `${id}.md`);
  }
  if (!parentContainerDir) {
    throw new Error(`${type} requires a parent path`);
  }
  if (type === "task" || type === "bug") {
    return join(parentContainerDir, `${id}.md`);
  }
  return join(parentContainerDir, id, `${id}.md`);
}
