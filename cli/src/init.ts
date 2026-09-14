import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bundledTemplatesDir } from "./paths.js";
import {
  CONVENTION_VERSION,
  DEFAULT_BRANCH_PATTERNS,
  readGeneratedState,
  updateGeneratedSection,
} from "./convention.js";
import { generateDocs } from "./docs.js";
import type { ItemType } from "./ids.js";
import {
  commitTrackerMutation,
  readAutoCommitConfig,
  resolveAutoCommit,
  trackerCommitMessage,
  type TrackerCommitResult,
} from "./tracker-commit.js";

const CONVENTION_YML =
  `version: ${CONVENTION_VERSION}\n` +
  `branch_patterns:\n` +
  (Object.keys(DEFAULT_BRANCH_PATTERNS) as ItemType[])
    .map((type) => `  ${type}: "${DEFAULT_BRANCH_PATTERNS[type]}"\n`)
    .join("");

export type InitOptions = {
  dir: string;
  force: boolean;
  /** Also generate the tier-2 doc set (ARCHITECTURE.md, docs/convention.md, ...). */
  full?: boolean;
  /** Archive adopter-modified docs to backup/<date>/<dest> before regenerating. */
  backup?: boolean;
  /** Injection point for tests: generation timestamp (defaults to now). */
  now?: Date;
  /**
   * Auto-commit the files this run wrote (tracker hygiene,
   * bug-init-leaves-docs-untracked-start-blocks-on-clean-tree): a fresh init
   * must not leave ~20 untracked docs behind, or `start`'s clean-tree
   * precondition blocks the very next step. Surgical staging — exactly the
   * written paths, never `git add -A`. `undefined` resolves via
   * `x-tracker.auto-commit` config, default ON; best effort (non-git trees
   * and git-absent machines skip with a reason, command stays ok).
   */
  commit?: boolean;
};

export type InitResult = {
  root: string;
  alreadyInitialized: boolean;
  force: boolean;
  created: string[];
  /** Untouched docs regenerated from the current template (state refreshed). */
  updated: string[];
  /** Adopter-modified docs (skipped, or regenerated after --backup). */
  modified: string[];
  /** Modified docs archived to backup/<date>/<dest> before regeneration. */
  backedUp: string[];
  /** Doc files left untouched (never overwritten). */
  skipped: string[];
  restored: string[];
  conventionPath: string;
  /** Tracker auto-commit outcome for the files written this run. */
  commit?: TrackerCommitResult;
};

function ensureTemplates(root: string, force: boolean): string[] {  const templatesDest = join(root, "templates");
  const templatesSrc = bundledTemplatesDir();
  if (!existsSync(templatesSrc)) {
    throw new Error(`Bundled templates not found at ${templatesSrc}`);
  }
  mkdirSync(templatesDest, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(templatesSrc)) {
    if (!name.endsWith(".md")) continue;
    const dest = join(templatesDest, name);
    if (existsSync(dest) && !force) continue;
    copyFileSync(join(templatesSrc, name), dest);
    copied.push(name);
  }
  return copied;
}

/**
 * Tracker hygiene (bug-init-leaves-docs-untracked-start-blocks-on-clean-tree):
 * commit exactly the files this run wrote — docs, templates, tasks/ tree and
 * tasks/.convention.yml (its x-generated state must ride along so the first
 * commit is self-consistent). Surgical staging (`git add -- <path>`), never
 * `git add -A`; best effort — non-git trees and git-absent machines skip with
 * a reason and the command stays ok. A re-run that rewrote nothing (identical
 * bytes) hits the quiet "nothing to commit" skip, keeping HEAD untouched.
 */
function commitGeneratedDocs(
  root: string,
  writtenPaths: string[],
  commitFlag: boolean | undefined,
): TrackerCommitResult {
  const paths = [...new Set(writtenPaths)].sort();
  return commitTrackerMutation(root, paths, {
    message: trackerCommitMessage("generated", [`init docs (${paths.length} files)`]),
    commit: resolveAutoCommit(commitFlag, readAutoCommitConfig(root)),
  });
}

export function runInit(opts: InitOptions): InitResult {
  const root = resolve(opts.dir);
  const tasksDir = join(root, "tasks");
  const conventionPath = join(tasksDir, ".convention.yml");

  const alreadyInitialized = existsSync(conventionPath);
  if (alreadyInitialized && !opts.force) {
    const restored = ensureTemplates(root, false)
      .map((name) => `templates/${name}`)
      .sort();
    const docs = generateDocs({ root, full: Boolean(opts.full), backup: opts.backup, now: opts.now });
    const written = [...restored, ...docs.created, ...docs.updated, "tasks/.convention.yml"];
    return {
      root,
      alreadyInitialized: true,
      force: false,
      created: docs.created,
      updated: docs.updated,
      modified: docs.modified,
      backedUp: docs.backedUp,
      skipped: docs.skipped,
      restored,
      conventionPath,
      commit: commitGeneratedDocs(root, written, opts.commit),
    };
  }

  if (existsSync(tasksDir) && !alreadyInitialized && !opts.force) {
    throw new Error(
      `tasks/ exists but is missing .convention.yml. Re-run with --force to scaffold, or fix manually.`,
    );
  }

  mkdirSync(tasksDir, { recursive: true });
  // A forced re-scaffold carries the x-generated provenance section over so
  // untouched docs keep regenerating instead of degrading to adopter-modified.
  const carried = opts.force && alreadyInitialized ? readGeneratedState(root) : {};
  writeFileSync(conventionPath, updateGeneratedSection(CONVENTION_YML, carried), "utf8");
  const copiedTemplates = ensureTemplates(root, opts.force).map((name) => `templates/${name}`);
  const docs = generateDocs({ root, full: Boolean(opts.full), backup: opts.backup, now: opts.now });
  const created = ["tasks/.convention.yml", ...copiedTemplates, ...docs.created].sort();
  const written = [...created, ...docs.updated];

  return {
    root,
    alreadyInitialized,
    force: opts.force,
    created,
    updated: docs.updated,
    modified: docs.modified,
    backedUp: docs.backedUp,
    skipped: docs.skipped,
    restored: [],
    conventionPath,
    commit: commitGeneratedDocs(root, written, opts.commit),
  };
}
