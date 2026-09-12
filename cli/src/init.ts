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
};

function ensureTemplates(root: string, force: boolean): string[] {
  const templatesDest = join(root, "templates");
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
  };
}
