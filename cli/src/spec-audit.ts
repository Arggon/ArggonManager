/**
 * `arggon spec audit` — REPORT-ONLY pairwise duplication detection over
 * docs/specs/*.md. Turns the ad-hoc ArggonStores-am migration analysis
 * (9,453 pairwise comparisons -> 1 diverging duplicate + 6 consolidations
 * among ~130 healthy specs) into a first-class command.
 *
 * Pure read: the command NEVER edits, creates or deletes anything — stdout is
 * the only output. Evidence per pair: shingle-Jaccard similarity over
 * normalized text + shared verbatim requirement/scenario titles. Classification
 * and thresholds are documented in docs/specs/spec-spec-audit-006.md.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { docsDirForRoot, findTasksDir, repoRootFromTasks } from "./paths.js";
import { sanitizeHumanTextUncapped } from "./sanitize.js";

// ---------------------------------------------------------------------------
// Normalization + similarity (exported for tests)
// ---------------------------------------------------------------------------

/** Shingle size k: 3 consecutive normalized words per shingle (documented). */
export const SHINGLE_SIZE = 3;

/** Default thresholds (documented in the spec, --help, README). */
export const SPEC_AUDIT_DEFAULTS = {
  duplicateThreshold: 0.85,
  mergeThreshold: 0.45,
  minSharedTitles: 2,
  sharedTitleFloor: 0.15,
  reportFloor: 0.15,
} as const;

/**
 * Normalize a spec document for similarity: strip YAML frontmatter, strip
 * fenced code blocks (code samples are boilerplate, not prose), lowercase,
 * keep [a-z0-9] word tokens, single-space join.
 */
export function normalizeForSimilarity(raw: string): string {
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const noFences = body.replace(/```[\s\S]*?```/g, " ");
  const tokens = noFences.toLowerCase().match(/[a-z0-9]+/g);
  return (tokens ?? []).join(" ");
}

/** Word shingles (k consecutive words) of normalized text, as a Set. */
export function shingles(normalized: string, k = SHINGLE_SIZE): Set<string> {
  if (normalized === "") return new Set();
  const words = normalized.split(" ");
  if (words.length < k) {
    // Too short for a full shingle: fall back to the whole text as one shingle
    // so short documents remain comparable instead of collapsing to empty.
    return new Set([normalized]);
  }
  const out = new Set<string>();
  for (let i = 0; i + k <= words.length; i++) {
    out.add(words.slice(i, i + k).join(" "));
  }
  return out;
}

/** Jaccard similarity |A∩B|/|A∪B|; two empty sets count as identical (1.0). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) if (large.has(item)) inter++;
  return inter / (a.size + b.size - inter);
}

const TITLE_PATTERNS = [
  /^###\s+Requirement:\s*(.+?)\s*$/,
  /^####\s+Scenario:\s*(.+?)\s*$/,
] as const;

/**
 * Extract `### Requirement:` / `#### Scenario:` titles VERBATIM (text after
 * the prefix, trimmed) from the raw document.
 */
export function extractTitles(raw: string): string[] {
  const titles: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    for (const pattern of TITLE_PATTERNS) {
      const m = line.match(pattern);
      if (m) titles.push(m[1]!);
    }
  }
  return titles;
}

// ---------------------------------------------------------------------------
// Audit runner
// ---------------------------------------------------------------------------

export type SpecAuditThresholds = {
  duplicateThreshold: number;
  mergeThreshold: number;
  minSharedTitles: number;
  sharedTitleFloor: number;
  reportFloor: number;
};

export type SpecAuditClassification = "duplicate" | "merge" | "keep-separate";

export type SpecAuditFinding = {
  classification: SpecAuditClassification;
  /** Posix paths, relative to the repo root, sorted. */
  files: [string, string];
  similarity: number;
  /** Shared `### Requirement:` / `#### Scenario:` titles, verbatim, sorted. */
  sharedTitles: string[];
  note: string;
};

export type SpecAuditResult = {
  root: string;
  /** Number of spec documents scanned. */
  specs: number;
  /** Number of pairs compared. */
  pairs: number;
  thresholds: SpecAuditThresholds;
  findings: SpecAuditFinding[];
  counts: { duplicate: number; merge: number; keepSeparate: number; belowFloor: number };
};

export type SpecAuditOptions = {
  cwd: string;
  thresholds?: Partial<SpecAuditThresholds>;
};

/** Validate threshold flags; NaN / out-of-range / inverted thresholds fail. */
export function resolveSpecAuditThresholds(
  overrides?: Partial<SpecAuditThresholds>,
): SpecAuditThresholds {
  const t: SpecAuditThresholds = { ...SPEC_AUDIT_DEFAULTS };
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) (t as Record<string, number>)[key] = value;
    }
  }
  for (const key of [
    "duplicateThreshold",
    "mergeThreshold",
    "sharedTitleFloor",
    "reportFloor",
  ] as const) {
    const v = t[key];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 1) {
      throw new Error(
        `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()} must be a number in [0,1] (got ${v})`,
      );
    }
  }
  if (!Number.isInteger(t.minSharedTitles) || t.minSharedTitles < 0) {
    throw new Error(
      `--min-shared-titles must be a non-negative integer (got ${t.minSharedTitles})`,
    );
  }
  if (t.duplicateThreshold < t.mergeThreshold) {
    throw new Error(
      `--duplicate-threshold (${t.duplicateThreshold}) must be >= --merge-threshold (${t.mergeThreshold})`,
    );
  }
  return t;
}

function classify(
  similarity: number,
  sharedTitleCount: number,
  t: SpecAuditThresholds,
): SpecAuditClassification | "below-floor" {
  if (similarity >= t.duplicateThreshold) return "duplicate";
  if (similarity >= t.mergeThreshold) return "merge";
  if (sharedTitleCount >= t.minSharedTitles && similarity >= t.sharedTitleFloor) return "merge";
  if (similarity >= t.reportFloor || sharedTitleCount >= 1) return "keep-separate";
  return "below-floor";
}

function posixRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

export function runSpecAudit(opts: SpecAuditOptions): SpecAuditResult {
  const thresholds = resolveSpecAuditThresholds(opts.thresholds);
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const specsDir = join(docsDirForRoot(root), "specs");
  if (!existsSync(specsDir)) {
    throw new Error(`no docs/specs directory under ${root} — nothing to audit`);
  }
  const names = readdirSync(specsDir)
    .filter((n) => n.endsWith(".md"))
    .sort();
  if (names.length === 0) {
    throw new Error(`no *.md specs under docs/specs — nothing to audit`);
  }

  type Doc = { rel: string; shingleSet: Set<string>; titles: string[] };
  const docs: Doc[] = [];
  for (const name of names) {
    const abs = join(specsDir, name);
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch (err) {
      throw new Error(
        `cannot read ${posixRel(root, abs)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    docs.push({
      rel: posixRel(root, abs),
      shingleSet: shingles(normalizeForSimilarity(raw)),
      titles: [...new Set(extractTitles(raw))],
    });
  }

  const findings: SpecAuditFinding[] = [];
  let belowFloor = 0;
  let pairs = 0;
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      pairs++;
      const a = docs[i]!;
      const b = docs[j]!;
      const similarity = jaccard(a.shingleSet, b.shingleSet);
      const sharedTitles = a.titles
        .filter((t) => b.titles.includes(t))
        .sort((x, y) => x.localeCompare(y));
      const c = classify(similarity, sharedTitles.length, thresholds);
      if (c === "below-floor") {
        belowFloor++;
        continue;
      }
      let note: string;
      if (c === "duplicate") {
        note = `${Math.round(similarity * 100)}% shingle overlap — near-identical prose`;
      } else if (c === "merge" && similarity >= thresholds.mergeThreshold) {
        note = `${Math.round(similarity * 100)}% shingle overlap — heavy overlap, likely consolidatable`;
      } else if (c === "merge") {
        note = `${sharedTitles.length} shared requirement/scenario titles with rewritten prose — the diverging-duplicate shape`;
      } else {
        note =
          sharedTitles.length > 0
            ? `${sharedTitles.length} shared title(s), low overlap — human decides`
            : `moderate overlap (${Math.round(similarity * 100)}%), below the merge threshold`;
      }
      findings.push({
        classification: c,
        files: [a.rel, b.rel],
        similarity,
        sharedTitles,
        note,
      });
    }
  }

  const byPair = (a: SpecAuditFinding, b: SpecAuditFinding): number =>
    a.files[0]!.localeCompare(b.files[0]!) || a.files[1]!.localeCompare(b.files[1]!);
  findings.sort(byPair);

  return {
    root,
    specs: docs.length,
    pairs,
    thresholds,
    findings,
    counts: {
      duplicate: findings.filter((f) => f.classification === "duplicate").length,
      merge: findings.filter((f) => f.classification === "merge").length,
      keepSeparate: findings.filter((f) => f.classification === "keep-separate").length,
      belowFloor,
    },
  };
}

// ---------------------------------------------------------------------------
// Human output
// ---------------------------------------------------------------------------

function truncateList(items: string[], max: number): string[] {
  if (items.length <= max) return items;
  return [...items.slice(0, max), `… and ${items.length - max} more`];
}

export function formatSpecAuditHuman(result: SpecAuditResult): string {
  const lines: string[] = [];
  const sections: Array<[SpecAuditClassification, string]> = [
    ["duplicate", "DUPLICATE"],
    ["merge", "MERGE"],
    ["keep-separate", "KEEP-SEPARATE"],
  ];
  for (const [classification, label] of sections) {
    const group = result.findings.filter((f) => f.classification === classification);
    if (group.length === 0) continue;
    lines.push(`${label} (${group.length})`);
    for (const f of group) {
      // Spec paths and requirement/scenario titles are repo-controlled: escape
      // in place (task-row-table-stdout-sanitize); --json keeps them raw.
      lines.push(
        `  ${sanitizeHumanTextUncapped(f.files[0])} <-> ${sanitizeHumanTextUncapped(f.files[1])}`,
      );
      lines.push(`    similarity: ${f.similarity.toFixed(2)}`);
      if (f.sharedTitles.length > 0) {
        lines.push(`    shared titles (${f.sharedTitles.length}):`);
        for (const t of truncateList(f.sharedTitles, 5)) {
          lines.push(`      - ${sanitizeHumanTextUncapped(t)}`);
        }
      }
      lines.push(`    note: ${f.note}`);
    }
  }
  lines.push(
    `arggon spec audit: ${result.pairs} pair(s) over ${result.specs} spec(s) — ` +
      `${result.counts.duplicate} duplicate, ${result.counts.merge} merge, ` +
      `${result.counts.keepSeparate} keep-separate, ${result.counts.belowFloor} below floor — ` +
      `report only, nothing was edited`,
  );
  lines.push(
    `  thresholds: duplicate>=${result.thresholds.duplicateThreshold}, merge>=${result.thresholds.mergeThreshold}, ` +
      `min-shared-titles=${result.thresholds.minSharedTitles}, shared-title-floor>=${result.thresholds.sharedTitleFloor}, ` +
      `report-floor>=${result.thresholds.reportFloor}`,
  );
  return `${lines.join("\n")}\n`;
}
