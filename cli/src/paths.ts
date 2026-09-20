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

/**
 * Product tracker root written by `arggon init` (ADR 0012, convention v5):
 * work items and product docs live under `ArggonManager/`.
 */
export const TRACKER_DIR_NAME = "ArggonManager";

/**
 * Pre-v5 tracker root. Still auto-detected and fully operable (no hard break,
 * ADR 0012 §3): an existing `tasks/` tree keeps working until migrated with
 * `arggon migrate --layout`.
 */
export const LEGACY_TRACKER_DIR_NAME = "tasks";

/** Convention state file name inside the tracker root. */
export const CONVENTION_FILE_NAME = ".convention.yml";

/** Which of the two supported tracker roots a repo uses. */
export type TrackerLayout = "arggon-manager" | "legacy";

/** A detected tracker root plus everything derived from its layout. */
export interface TrackerLocation {
  /** Absolute tracker dir (the one containing `.convention.yml`). */
  dir: string;
  /** Absolute repo root (parent of `dir`). */
  repoRoot: string;
  /** Tracker dir name relative to `repoRoot` (`ArggonManager` or `tasks`). */
  name: string;
  layout: TrackerLayout;
  /** True when the tracker still uses the legacy `tasks/` layout. */
  legacy: boolean;
  /**
   * Absolute product-docs dir: `<dir>/docs` on the v5 layout,
   * `<repoRoot>/docs` on the legacy layout (docs travel with the tracker).
   */
  docsDir: string;
  /** Absolute `.convention.yml` path inside the tracker dir. */
  conventionPath: string;
}

function locationAt(repoRoot: string, name: string, layout: TrackerLayout): TrackerLocation {
  const dir = join(repoRoot, name);
  return {
    dir,
    repoRoot,
    name,
    layout,
    legacy: layout === "legacy",
    docsDir: layout === "legacy" ? join(repoRoot, "docs") : join(dir, "docs"),
    conventionPath: join(dir, CONVENTION_FILE_NAME),
  };
}

/**
 * Detect a tracker directly under `root` (no walk-up). The v5 layout wins
 * when both roots exist (ADR 0012 §3: prefer `ArggonManager/`, fall back to
 * legacy `tasks/`); `null` when neither carries a `.convention.yml`.
 */
export function trackerAt(root: string): TrackerLocation | null {
  if (existsSync(join(root, TRACKER_DIR_NAME, CONVENTION_FILE_NAME))) {
    return locationAt(root, TRACKER_DIR_NAME, "arggon-manager");
  }
  if (existsSync(join(root, LEGACY_TRACKER_DIR_NAME, CONVENTION_FILE_NAME))) {
    return locationAt(root, LEGACY_TRACKER_DIR_NAME, "legacy");
  }
  return null;
}

/** Walk up from startDir looking for a tracker root (v5, else legacy). */
export function findTrackerLocation(startDir: string): TrackerLocation {
  let dir = resolve(startDir);
  for (;;) {
    const found = trackerAt(dir);
    if (found) return found;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `No ${TRACKER_DIR_NAME}/ convention found (legacy ${LEGACY_TRACKER_DIR_NAME}/ also checked). ` +
          "Run `arggon init` first.",
      );
    }
    dir = parent;
  }
}

/**
 * Walk up from startDir looking for a tracker root and return its directory
 * (back-compat surface: `ArggonManager/`, or legacy `tasks/`).
 */
export function findTasksDir(startDir: string): string {
  return findTrackerLocation(startDir).dir;
}

export function repoRootFromTasks(tasksDir: string): string {
  return dirname(tasksDir);
}

/**
 * Absolute product-docs dir for a repo root with a tracker: `<root>/docs` on
 * the legacy layout, `<root>/ArggonManager/docs` on v5. Falls back to the
 * legacy `<root>/docs` when no tracker exists (commands that need a tracker
 * fail earlier with the detection error).
 */
export function docsDirForRoot(root: string): string {
  return trackerAt(root)?.docsDir ?? join(root, "docs");
}

/**
 * Absolute `.convention.yml` path for a repo root, preferring the v5 tracker
 * and falling back to the legacy path (missing file semantics are the
 * caller's: readers return defaults, writers scaffold).
 */
export function conventionPathForRoot(root: string): string {
  return (
    trackerAt(root)?.conventionPath ?? join(root, LEGACY_TRACKER_DIR_NAME, CONVENTION_FILE_NAME)
  );
}

/** Absolute `.convention.yml` path for an explicit tracker layout. */
export function conventionPathForLayout(root: string, layout: TrackerLayout): string {
  const name = layout === "legacy" ? LEGACY_TRACKER_DIR_NAME : TRACKER_DIR_NAME;
  return join(root, name, CONVENTION_FILE_NAME);
}

/**
 * Directories inside a tracker root that are NOT item containers: on the v5
 * layout `<tracker>/docs/` holds the product docs (ADR 0012), so the item
 * walkers skip it. The name is reserved — a container id `docs` is not
 * supported directly under the tracker root on v5.
 */
export function trackerNonItemDirs(trackerDir: string): string[] {
  const loc = trackerAt(dirname(trackerDir));
  if (loc && loc.dir === trackerDir && loc.docsDir.startsWith(`${loc.dir}${sep}`)) {
    return [loc.docsDir];
  }
  return [];
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
