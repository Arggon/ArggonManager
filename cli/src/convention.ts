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

/**
 * One generated-doc provenance record (`x-generated` namespaced extension,
 * story-adoption-state): destination path -> entry, written by
 * `generateDocs`/`init` after stamping the file with its marker comment.
 */
export type GeneratedEntry = {
  /** Source template, package-root relative (e.g. "docs/AGENTS.md"). */
  template: string;
  /** Checksum of the file as generated, "sha256:<hex>" (marker included). */
  checksum: string;
  /** ArggonManager version that generated the file. */
  arggonVersion: string;
  /** ISO-8601 timestamp of the generating run. */
  generatedAt: string;
};

export type ConventionConfig = {
  version: number;
  /** Per-type branch patterns; always complete (missing keys fall back to defaults). */
  branchPatterns: Record<ItemType, string>;
  /** Named saved views (`x-views` extension key): view name -> filter expression. */
  views: Record<string, string>;
  /** Technology-playbook options (`x-playbooks` extension key). */
  playbooks: PlaybooksConfig;
  /**
   * Generated-doc provenance (`x-generated` extension key): destination path
   * (posix, relative to the repo root) -> provenance entry.
   */
  generated: Record<string, GeneratedEntry>;
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
 * `x-views` (saved views), `x-playbooks` (playbook staleness options), and
 * `x-generated` (generated-doc provenance) are the official namespaced
 * extensions.
 * Throws with file context on malformed `branch_patterns`, `x-views`,
 * or `x-playbooks`; `x-generated` parses tolerantly (machine-written state).
 */
export function parseConventionConfig(
  raw: string,
  sourcePath = "tasks/.convention.yml",
): ConventionConfig {
  const branchPatterns: Record<ItemType, string> = { ...DEFAULT_BRANCH_PATTERNS };
  const views: Record<string, string> = {};
  const playbooks: PlaybooksConfig = { maxAgeDays: null };
  const generated: Record<string, GeneratedEntry> = {};
  let version = CONVENTION_VERSION_DEFAULT;
  let section: string | null = null;
  let generatedDest: string | null = null;

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
      generatedDest = null;
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
      } else if (key === "x-generated") {
        if (value !== "") {
          throw new Error(
            `${sourcePath}: 'x-generated' must be a mapping, one destination per line`,
          );
        }
        section = "x-generated";
      }
      continue;
    }
    if (section === "x-generated") {
      // Namespaced machine-written state (story-adoption-state): tolerant
      // parse — unknown fields are ignored (ignore-unknown) and incomplete
      // entries are kept as-is (a missing checksum simply never matches, so
      // the file reports as adopter-modified). Hand edits must never break
      // init or doctor.
      if (indent <= 2) {
        const dest = stripQuotes(key);
        generatedDest = dest !== "" ? dest : null;
        if (generatedDest !== null && !(generatedDest in generated)) {
          generated[generatedDest] = {
            template: "",
            checksum: "",
            arggonVersion: "",
            generatedAt: "",
          };
        }
        continue;
      }
      if (generatedDest === null) continue;
      const entry = generated[generatedDest]!;
      if (key === "template") entry.template = stripQuotes(value);
      else if (key === "checksum") entry.checksum = stripQuotes(value);
      else if (key === "arggonVersion") entry.arggonVersion = stripQuotes(value);
      else if (key === "generatedAt") entry.generatedAt = stripQuotes(value);
      // Unknown nested keys are ignored.
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

  return { version, branchPatterns, views, playbooks, generated };
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
      generated: {},
    };
  }
  return parseConventionConfig(readFileSync(path, "utf8"), path);
}

/**
 * Tolerant read of the `x-generated` provenance state. Unlike
 * `readConventionConfig` this never throws: a missing file or a malformed
 * `.convention.yml` yields an empty state (docs then count as
 * adopter-modified — the conservative default).
 */
export function readGeneratedState(dir: string): Record<string, GeneratedEntry> {
  const path = join(dir, "tasks/.convention.yml");
  if (!existsSync(path)) return {};
  try {
    return parseConventionConfig(readFileSync(path, "utf8"), path).generated;
  } catch {
    return {};
  }
}

/** Serialize one quoted YAML scalar (double quotes, backslash-escaped). */
function yamlQuote(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** Quote a mapping key when it is not a plain safe path token. */
function yamlKey(key: string): string {
  return /^[A-Za-z0-9._/-]+$/.test(key) ? key : yamlQuote(key);
}

/**
 * Serialize the `x-generated` section (destinations sorted) for the given
 * provenance entries. Empty entries serialize as no section at all.
 */
export function serializeGeneratedSection(entries: Record<string, GeneratedEntry>): string[] {
  const dests = Object.keys(entries).sort();
  if (dests.length === 0) return [];
  const lines: string[] = ["x-generated:"];
  for (const dest of dests) {
    const entry = entries[dest]!;
    lines.push(`  ${yamlKey(dest)}:`);
    lines.push(`    template: ${yamlQuote(entry.template)}`);
    lines.push(`    checksum: ${yamlQuote(entry.checksum)}`);
    lines.push(`    arggonVersion: ${yamlQuote(entry.arggonVersion)}`);
    lines.push(`    generatedAt: ${yamlQuote(entry.generatedAt)}`);
  }
  return lines;
}

/**
 * Splice a fresh `x-generated` section into raw `.convention.yml` text,
 * replacing any existing section. Everything outside the section — version,
 * branch_patterns, x-views, x-playbooks, comments, blank lines, unknown keys —
 * is preserved byte-for-byte. With no entries, an existing section is removed.
 */
export function updateGeneratedSection(
  raw: string,
  entries: Record<string, GeneratedEntry>,
): string {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => /^x-generated:\s*$/.test(line));
  if (start !== -1) {
    let end = start + 1;
    while (end < lines.length && (lines[end] === "" || (lines[end]!.length - lines[end]!.trimStart().length) > 0)) {
      end++;
    }
    lines.splice(start, end - start);
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const section = serializeGeneratedSection(entries);
  if (section.length === 0) {
    return lines.length > 0 ? `${lines.join("\n")}\n` : "";
  }
  if (lines.length > 0) lines.push("");
  return `${[...lines, ...section].join("\n")}\n`;
}

/** Resolve a branch pattern for an item (`{id}` required, `{type}` optional). */
export function resolveBranchName(pattern: string, item: { id: string; type: ItemType }): string {
  return pattern.replaceAll("{id}", item.id).replaceAll("{type}", item.type);
}
