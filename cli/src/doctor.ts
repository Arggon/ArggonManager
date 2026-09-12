/**
 * `arggon doctor` — installation state report (story-adoption-state,
 * task-doctor-command). Report-only, exit 0: answers "is ArggonManager
 * installed here, and in what shape" from the same sources init writes —
 * tasks/.convention.yml (convention version, x-generated provenance) and the
 * work-item tree (tracker counts). Never writes anything.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readConventionConfig, readConventionVersion } from "./convention.js";
import { checksumOf, currentGeneratedTemplates } from "./docs.js";
import { loadItems } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";

export type DoctorDocs = {
  /** Total x-generated provenance entries. */
  managed: number;
  /** Files whose checksum still matches the recorded one. */
  untouched: number;
  /** Files on disk whose checksum differs from the recorded one. */
  modified: number;
  /** State entries whose template no longer exists in the current bundle. */
  stale: number;
  /** State entries whose destination file is absent. */
  missing: number;
};

export type DoctorResult = {
  /** Repo root, or null when no tasks/.convention.yml was found. */
  root: string | null;
  initialized: boolean;
  /** Convention version from tasks/.convention.yml (0-3; 0 when missing). */
  conventionVersion: number;
  docs: DoctorDocs;
  tracker: {
    /** Total work items under tasks/. */
    items: number;
    /** Items with status todo. */
    todo: number;
  };
};

const ZERO_DOCS: DoctorDocs = { managed: 0, untouched: 0, modified: 0, stale: 0, missing: 0 };

export function runDoctor(opts: { cwd: string }): DoctorResult {
  let tasksDir: string;
  let root: string;
  try {
    tasksDir = findTasksDir(opts.cwd);
    root = repoRootFromTasks(tasksDir);
  } catch {
    // Missing tree: a normal report, not a failure (task-doctor-command).
    return {
      root: null,
      initialized: false,
      conventionVersion: 0,
      docs: { ...ZERO_DOCS },
      tracker: { items: 0, todo: 0 },
    };
  }

  const conventionVersion = readConventionVersion(root);
  const config = readConventionConfig(root);
  const currentTemplates = new Set(currentGeneratedTemplates().map((t) => t.template));

  let untouched = 0;
  let modified = 0;
  let stale = 0;
  let missing = 0;
  const entries = Object.entries(config.generated);
  for (const [dest, entry] of entries) {
    const destAbs = join(root, ...dest.split("/"));
    if (!existsSync(destAbs)) {
      missing++;
      continue;
    }
    if (!currentTemplates.has(entry.template)) {
      stale++;
      continue;
    }
    let actual: string;
    try {
      actual = checksumOf(readFileSync(destAbs, "utf8"));
    } catch {
      modified++;
      continue;
    }
    if (entry.checksum && actual === entry.checksum) {
      untouched++;
    } else {
      modified++;
    }
  }

  const items = loadItems(tasksDir);
  return {
    root,
    initialized: true,
    conventionVersion,
    docs: {
      managed: entries.length,
      untouched,
      modified,
      stale,
      missing,
    },
    tracker: {
      items: items.length,
      todo: items.filter((item) => item.status === "todo").length,
    },
  };
}

/** Human-readable report (never writes; pairs with the doctor --json payload). */
export function formatDoctorReport(result: DoctorResult): string {
  if (!result.initialized) {
    return "arggon doctor: not initialized (no tasks/.convention.yml found) — run `arggon init`\n";
  }
  const lines = [
    `arggon doctor: initialized (convention v${result.conventionVersion}) at ${result.root}`,
    `  docs: ${result.docs.managed} managed, ${result.docs.untouched} untouched, ` +
      `${result.docs.modified} modified, ${result.docs.stale} stale, ${result.docs.missing} missing`,
    `  tracker: ${result.tracker.items} item(s), ${result.tracker.todo} todo`,
  ];
  if (result.docs.modified > 0) {
    lines.push(
      "  hint: re-run `arggon init --backup` to archive modified docs and regenerate them",
    );
  }
  return `${lines.join("\n")}\n`;
}
