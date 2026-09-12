import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isItemType, type ItemType } from "./ids.js";

/** Latest task-tree convention version written by `arggon init` (docs/convention.md). */
export const CONVENTION_VERSION = 3;

/** Version assumed when `tasks/.convention.yml` is missing or unparseable (omit file = 0). */
export const CONVENTION_VERSION_DEFAULT = 0;

/**
 * Read the tree convention version from `<dir>/tasks/.convention.yml`.
 * Returns CONVENTION_VERSION_DEFAULT when the file is missing or has no
 * parseable `version: N` line (per docs/json-output.md: omit file = 0).
 */
export function readConventionVersion(dir: string): number {
  const path = join(dir, "tasks/.convention.yml");
  if (!existsSync(path)) return CONVENTION_VERSION_DEFAULT;
  try {
    const raw = readFileSync(path, "utf8");
    const match = raw.match(/^version\s*:\s*(\d+)/m);
    if (!match) return CONVENTION_VERSION_DEFAULT;
    const parsed = Number.parseInt(match[1] ?? "", 10);
    return Number.isFinite(parsed) ? parsed : CONVENTION_VERSION_DEFAULT;
  } catch {
    return CONVENTION_VERSION_DEFAULT;
  }
}

/** Default `branch_patterns` (docs/convention.md): feat/ everywhere, fix/ for bugs. */
export const DEFAULT_BRANCH_PATTERNS: Record<ItemType, string> = {
  initiative: "feat/{id}",
  epic: "feat/{id}",
  story: "feat/{id}",
  task: "feat/{id}",
  bug: "fix/{id}",
};

/** `x-playbooks` namespaced extension options (story-tech-playbooks). */
export type PlaybooksConfig = {
  /**
   * Stale threshold for `arggon playbook status`, in days, from
   * `x-playbooks.max-age-days`. `null` when unset (the command applies its
   * own default of 90).
   */
  maxAgeDays: number | null;
};

export type ConventionConfig = {
  version: number;
  /** Per-type branch patterns; always complete (missing keys fall back to defaults). */
  branchPatterns: Record<ItemType, string>;
  /** Named saved views (`x-views` extension key): view name -> filter expression. */
  views: Record<string, string>;
  /** Technology-playbook options (`x-playbooks` extension key). */
  playbooks: PlaybooksConfig;
};

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse `tasks/.convention.yml` (line-oriented, no YAML dependency).
 * Unknown top-level keys are ignored for forward compatibility;
 * `x-views` (saved views) and `x-playbooks` (playbook staleness options)
 * are the official namespaced extensions.
 * Throws with file context on malformed `branch_patterns`, `x-views`,
 * or `x-playbooks`.
 */
export function parseConventionConfig(
  raw: string,
  sourcePath = "tasks/.convention.yml",
): ConventionConfig {
  const branchPatterns: Record<ItemType, string> = { ...DEFAULT_BRANCH_PATTERNS };
  const views: Record<string, string> = {};
  const playbooks: PlaybooksConfig = { maxAgeDays: null };
  let version = CONVENTION_VERSION_DEFAULT;
  let section: string | null = null;

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const idx = line.indexOf(":");
    if (idx === -1) {
      throw new Error(`${sourcePath}: invalid line ${JSON.stringify(line)}`);
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (indent === 0) {
      section = null;
      if (key === "version") {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) version = parsed;
      } else if (key === "branch_patterns") {
        if (value !== "") {
          throw new Error(`${sourcePath}: 'branch_patterns' must be a mapping, one type per line`);
        }
        section = "branch_patterns";
      } else if (key === "x-views") {
        if (value !== "") {
          throw new Error(`${sourcePath}: 'x-views' must be a mapping, one view per line`);
        }
        section = "x-views";
      } else if (key === "x-playbooks") {
        if (value !== "") {
          throw new Error(`${sourcePath}: 'x-playbooks' must be a mapping, one option per line`);
        }
        section = "x-playbooks";
      }
      continue;
    }
    if (section === "x-playbooks") {
      // Namespaced extension: unknown nested keys are ignored (ignore-unknown),
      // only the official `max-age-days` option is read.
      if (key !== "max-age-days") continue;
      if (!/^\d+$/.test(value) || Number.parseInt(value, 10) <= 0) {
        throw new Error(
          `${sourcePath}: 'max-age-days' must be a positive integer (got ${JSON.stringify(value)})`,
        );
      }
      playbooks.maxAgeDays = Number.parseInt(value, 10);
      continue;
    }
    if (section === "x-views") {
      if (!key) {
        throw new Error(`${sourcePath}: invalid x-views entry ${JSON.stringify(line)}`);
      }
      if (key in views) {
        throw new Error(`${sourcePath}: duplicate view '${key}' in x-views`);
      }
      const expr = stripQuotes(value);
      if (!expr) {
        throw new Error(`${sourcePath}: empty expression for view '${key}'`);
      }
      views[key] = expr;
      continue;
    }
    if (section !== "branch_patterns") continue;
    if (!isItemType(key)) {
      throw new Error(
        `${sourcePath}: unknown type '${key}' in branch_patterns (expected: initiative | epic | story | task | bug)`,
      );
    }
    const pattern = stripQuotes(value);
    if (!pattern) {
      throw new Error(`${sourcePath}: empty pattern for type '${key}'`);
    }
    if (!pattern.includes("{id}")) {
      throw new Error(
        `${sourcePath}: pattern for type '${key}' must contain an {id} placeholder (got ${JSON.stringify(pattern)})`,
      );
    }
    branchPatterns[key] = pattern;
  }

  return { version, branchPatterns, views, playbooks };
}

/** Read and parse `<dir>/tasks/.convention.yml`. Missing file yields version 0 + defaults. */
export function readConventionConfig(dir: string): ConventionConfig {
  const path = join(dir, "tasks/.convention.yml");
  if (!existsSync(path)) {
    return {
      version: CONVENTION_VERSION_DEFAULT,
      branchPatterns: { ...DEFAULT_BRANCH_PATTERNS },
      views: {},
      playbooks: { maxAgeDays: null },
    };
  }
  return parseConventionConfig(readFileSync(path, "utf8"), path);
}

/** Resolve a branch pattern for an item (`{id}` required, `{type}` optional). */
export function resolveBranchName(pattern: string, item: { id: string; type: ItemType }): string {
  return pattern.replaceAll("{id}", item.id).replaceAll("{type}", item.type);
}
