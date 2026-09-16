/**
 * `arggon spec import openspec` — mechanical migration of an OpenSpec corpus
 * into Arggon spec docs, with a per-file ZERO-LOSS assertion and all-or-nothing
 * writes per run.
 *
 * Extension point (docs/specs/spec-spec-import-openspec-005.md): the format
 * parsing/mapping lives behind the `CorpusAdapter` API so future corpus
 * formats plug in without touching the command. `runSpecImport` only
 * orchestrates: discover -> read -> parse -> map -> zero-loss assert (every
 * file first) -> collision check -> write all.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { writeFileAtomic } from "./atomic.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";

// ---------------------------------------------------------------------------
// Shared corpus-adapter extension point
// ---------------------------------------------------------------------------

/** One source file discovered in a corpus, in a format-agnostic shape. */
export type DiscoveredFile = {
  /** Capability / unit slug; becomes the Arggon spec slug. Must be kebab-case. */
  capability: string;
  /** Absolute path of the source file. */
  absPath: string;
  /** Posix path relative to the corpus root (for provenance + errors). */
  sourceRel: string;
};

/**
 * The sections an adapter extracts from one source file. Both are copied
 * verbatim into the generated Arggon spec; together they must account for the
 * whole source body (zero-loss).
 */
export type ParsedSpec = {
  purpose: string;
  requirements: string;
};

/** Metadata handed to `map` when rendering the Arggon spec document. */
export type MapMeta = {
  capability: string;
  specId: string;
  title: string;
  date: string;
  sourceRel: string;
};

/**
 * Format adapter: the extension point for future corpus formats. A new format
 * only implements these three functions; zero-loss assertion, collision
 * refusal, id sequencing and the two-phase write are shared in `runSpecImport`.
 */
export type CorpusAdapter = {
  format: string;
  /** List the source files of a corpus (sorted, deterministic). */
  discover(corpusRoot: string): DiscoveredFile[];
  /** Extract the Purpose and Requirements sections of one source file. */
  parse(raw: string, file: DiscoveredFile): ParsedSpec;
  /** Render the full Arggon spec document (frontmatter + body) for one file. */
  map(parsed: ParsedSpec, meta: MapMeta): string;
  /**
   * Source side of the zero-loss comparison: the source body as it must
   * re-assemble from the mapped sections. Defaults to a normalized
   * `## Purpose` / `## Requirements` reconstruction of `parsed`; override for
   * formats whose raw body differs structurally.
   */
  assembleSource?(raw: string, parsed: ParsedSpec): string;
};

/** Default `assembleSource` (used when the adapter does not override it). */
function defaultAssembleSource(_raw: string, parsed: ParsedSpec): string {
  return `## Purpose\n\n${parsed.purpose.trim()}\n\n## Requirements\n\n${parsed.requirements.trim()}`;
}

// ---------------------------------------------------------------------------
// Normalization (documented in spec-spec-import-openspec-005)
// ---------------------------------------------------------------------------

/**
 * The zero-loss normalization: strip `\r`, trim trailing whitespace per line,
 * collapse runs of blank lines to a single blank line, trim leading/trailing
 * blank lines. Both sides of the assertion pass through this.
 */
export function normalizeForZeroLoss(text: string): string {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""));
  const collapsed: string[] = [];
  for (const line of lines) {
    if (line === "" && collapsed[collapsed.length - 1] === "") continue;
    collapsed.push(line);
  }
  while (collapsed.length > 0 && collapsed[0] === "") collapsed.shift();
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === "") collapsed.pop();
  return collapsed.join("\n");
}

/** Compact line diff for error reporting: `- source` / `+ output` with counts. */
export function diffLines(source: string, output: string): string[] {
  const a = source.split("\n");
  const b = output.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const out: string[] = [];
  const ctx = (n: number): string => `  ${n + 1}: ${a[n] ?? ""}`;
  if (start > 0) out.push(ctx(start - 1));
  for (let i = start; i < endA; i++) out.push(`- ${i + 1}: ${a[i] ?? ""}`);
  for (let i = start; i < endB; i++) out.push(`+ ${i + 1}: ${b[i] ?? ""}`);
  if (endA < a.length) out.push(ctx(endA));
  return out;
}

// ---------------------------------------------------------------------------
// OpenSpec adapter
// ---------------------------------------------------------------------------

const KEbabPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function splitH2Sections(body: string): Array<{ heading: string; content: string }> {
  const lines = body.split("\n");
  const sections: Array<{ heading: string; content: string }> = [];
  let current: { heading: string; content: string[] } | null = null;
  for (const line of lines) {
    const match = line.match(/^##\s+(?!#)(.+?)\s*$/);
    if (match) {
      if (current) sections.push({ heading: current.heading, content: current.content.join("\n") });
      current = { heading: match[1]!, content: [] };
      continue;
    }
    if (current) current.content.push(line);
  }
  if (current) sections.push({ heading: current.heading, content: current.content.join("\n") });
  return sections;
}

/**
 * The OpenSpec layout: `<path>/specs/<capability>/spec.md` per capability,
 * sorted capability order.
 */
export const openspecAdapter: CorpusAdapter = {
  format: "openspec",

  discover(corpusRoot: string): DiscoveredFile[] {
    const specsDir = join(corpusRoot, "specs");
    if (!existsSync(specsDir)) {
      throw new Error(`not an OpenSpec corpus: ${corpusRoot} has no specs/ directory`);
    }
    const out: DiscoveredFile[] = [];
    for (const entry of readdirSync(specsDir, { withFileTypes: true }).sort((x, y) =>
      x.name.localeCompare(y.name),
    )) {
      if (!entry.isDirectory()) continue;
      const absPath = join(specsDir, entry.name, "spec.md");
      out.push({
        capability: entry.name,
        absPath,
        sourceRel: `specs/${entry.name}/spec.md`,
      });
    }
    if (out.length === 0) {
      throw new Error(`no capabilities found under ${join(corpusRoot, "specs")}`);
    }
    return out;
  },

  parse(raw: string, file: DiscoveredFile): ParsedSpec {
    const body = raw.replace(/^#\s+.+\r?\n/, ""); // drop the leading H1 line
    const sections = splitH2Sections(body);
    const byHeading = new Map<string, string>();
    for (const section of sections) {
      if (byHeading.has(section.heading)) {
        throw new Error(`duplicate section '## ${section.heading}' in ${file.sourceRel}`);
      }
      byHeading.set(section.heading, section.content);
    }
    for (const heading of byHeading.keys()) {
      if (heading !== "Purpose" && heading !== "Requirements") {
        throw new Error(
          `unsupported section '## ${heading}' in ${file.sourceRel} — the openspec adapter maps only '## Purpose' and '## Requirements'`,
        );
      }
    }
    const purpose = byHeading.get("Purpose");
    const requirements = byHeading.get("Requirements");
    if (purpose === undefined || requirements === undefined) {
      throw new Error(
        `${file.sourceRel} must contain both '## Purpose' and '## Requirements' sections`,
      );
    }
    return { purpose, requirements };
  },

  // Zero-loss source side: the raw body after dropping the leading H1 line.
  assembleSource: (raw) => raw.replace(/^#\s+.+\r?\n/, ""),

  map(parsed: ParsedSpec, meta: MapMeta): string {
    const requirementsMapped = mapRequirements(parsed.requirements, meta);
    return `---
spec_id: ${meta.specId}
title: ${meta.title}
status: proposed
created: ${meta.date}
---

# Spec: ${meta.capability} (${meta.specId})

## Purpose

${parsed.purpose.trim()}

## Synopsis

\`\`\`bash
arggon spec import openspec <path>
\`\`\`

Migrated mechanically from the OpenSpec corpus (\`${meta.sourceRel}\`); the mapping
and zero-loss contract are documented in \`docs/specs/spec-spec-import-openspec-005.md\`.

## Acceptance criteria

${requirementsMapped}
`;
  },
};

const CHECKLIST_HEADING = "### Verification checklist";

/** One checkbox per `#### Scenario:`; a single statement checkbox when none. */
export function verificationChecklist(requirementBody: string): string {
  const scenarios = [...requirementBody.matchAll(/^####\s+Scenario:\s*(.+?)\s*$/gm)].map(
    (m) => m[1]!,
  );
  const items =
    scenarios.length > 0
      ? scenarios.map((title) => `- [ ] Scenario: ${title}`)
      : ["- [ ] Requirement verified as stated above."];
  return `${CHECKLIST_HEADING}\n\n${items.join("\n")}\n`;
}

/**
 * Copy the `## Requirements` body verbatim, inserting a `### Verification
 * checklist` after each `### Requirement:` block's content (before the next
 * requirement heading or the end).
 */
function mapRequirements(requirements: string, meta: MapMeta): string {
  const lines = requirements.split("\n");
  const blocks: string[][] = [];
  for (const line of lines) {
    if (/^###\s+Requirement:/.test(line) || blocks.length === 0) {
      if (blocks.length === 0 && !/^###\s+Requirement:/.test(line) && line.trim() === "") continue;
      blocks.push([line]);
      continue;
    }
    blocks[blocks.length - 1]!.push(line);
  }
  const mapped = blocks.map((blockLines) => {
    const block = blockLines.join("\n").replace(/\s+$/, "");
    return `${block}\n\n${verificationChecklist(block)}`;
  });
  const provenance = `*Source: ${meta.sourceRel} — migrated ${meta.date} via arggon spec import openspec.*`;
  return `${mapped.join("\n")}\n${provenance}`;
}

// ---------------------------------------------------------------------------
// Zero-loss assertion (shared across adapters)
// ---------------------------------------------------------------------------

const CHECKLIST_BLOCK = new RegExp(
  `\\n?${CHECKLIST_HEADING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?(?=\\n###\\s|\\n##\\s|$)`,
  "g",
);

/**
 * Re-assemble the source body from the generated Arggon spec document:
 * Purpose body + Acceptance criteria body minus the inserted `### Verification
 * checklist` subsections and `*Source: ...` provenance lines. The caller
 * compares this against the parsed sections (normalized) — a mismatch means
 * the mapper dropped or mangled content.
 */
export function reassemble(mapped: string): { purpose: string; requirements: string } {
  const body = mapped.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const sections = splitH2Sections(body);
  const get = (name: string): string => {
    const section = sections.find((s) => s.heading === name);
    if (section === undefined) throw new Error(`generated spec lost its '## ${name}' section`);
    return section.content;
  };
  const purpose = get("Purpose").trim();
  const acceptance = get("Acceptance criteria")
    .replace(CHECKLIST_BLOCK, "\n")
    .split("\n")
    .filter((line) => !line.startsWith("*Source: "))
    .join("\n");
  return { purpose, requirements: acceptance };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export type SpecImportOptions = {
  cwd: string;
  /** OpenSpec corpus root (contains specs/<capability>/spec.md). */
  path: string;
  adapter?: CorpusAdapter;
  dryRun?: boolean;
  /** Determinism hook for tests (YYYY-MM-DD); defaults to today (UTC). */
  today?: string;
  /**
   * Test hook: first NNN of the run (defaults to `nextDocNumber(root)`).
   * Lets tests simulate the race where a target file appears between numbering
   * and writing — the collision refusal path.
   */
  startNumber?: number;
};

export type SpecImportEntry = {
  capability: string;
  /** Posix repo-relative target file. */
  file: string;
  specId: string;
  /** Posix path of the source, relative to the corpus root. */
  source: string;
};

export type SpecImportFailure = {
  capability: string;
  source: string;
  message: string;
  /** Per-file `- source` / `+ output` line diff (zero-loss mismatches). */
  diff?: string[];
};

export type SpecImportResult = {
  root: string;
  dryRun: boolean;
  /** Files actually written (empty under --dry-run). */
  created: SpecImportEntry[];
  /** Planned files under --dry-run (empty otherwise). */
  inventory: SpecImportEntry[];
};

export class SpecImportError extends Error {
  readonly failures: SpecImportFailure[];
  constructor(message: string, failures: SpecImportFailure[]) {
    super(message);
    this.name = "SpecImportError";
    this.failures = failures;
  }
}

function nextDocNumber(root: string): number {
  let max = 0;
  for (const dir of [join(root, "docs", "specs"), join(root, "docs", "plans")]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const match = name.match(/-(\d{3,})\.md$/);
      if (match) max = Math.max(max, Number.parseInt(match[1]!, 10));
    }
  }
  return max + 1;
}

export function runSpecImport(opts: SpecImportOptions): SpecImportResult {
  const adapter = opts.adapter ?? openspecAdapter;
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const corpusRoot = isAbsolute(opts.path) ? opts.path : resolve(opts.cwd, opts.path);
  const date = opts.today ?? new Date().toISOString().slice(0, 10);

  // Phase 1: discover, parse, map, assert — write nothing.
  const files = adapter.discover(corpusRoot);
  const entries: SpecImportEntry[] = [];
  const mappedDocs: Array<{ entry: SpecImportEntry; content: string }> = [];
  const failures: SpecImportFailure[] = [];

  const nextNumber = opts.startNumber ?? nextDocNumber(root);
  files.forEach((file, index) => {
    const nnn = String(nextNumber + index).padStart(3, "0");
    const entry: SpecImportEntry = {
      capability: file.capability,
      file: `docs/specs/spec-${file.capability}-${nnn}.md`,
      specId: `${file.capability}-${nnn}`,
      source: file.sourceRel,
    };
    entries.push(entry);

    if (!KEbabPattern.test(file.capability)) {
      failures.push({
        capability: file.capability,
        source: file.sourceRel,
        message: `capability directory '${file.capability}' is not kebab-case ASCII (^[a-z0-9]+(-[a-z0-9]+)*$)`,
      });
      return;
    }

    let raw: string;
    try {
      raw = readFileSync(file.absPath, "utf8");
    } catch (err) {
      failures.push({
        capability: file.capability,
        source: file.sourceRel,
        message: `cannot read ${file.sourceRel}: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    let parsed: ParsedSpec;
    let mapped: string;
    try {
      parsed = adapter.parse(raw, file);
      mapped = adapter.map(parsed, {
        capability: file.capability,
        specId: entry.specId,
        title: `${file.capability.replace(/-/g, " ")} (migrated from openspec)`,
        date,
        sourceRel: file.sourceRel,
      });
    } catch (err) {
      failures.push({
        capability: file.capability,
        source: file.sourceRel,
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // ZERO-LOSS: re-assemble from the generated output and compare, normalized.
    let reassembled: { purpose: string; requirements: string };
    try {
      reassembled = reassemble(mapped);
    } catch (err) {
      failures.push({
        capability: file.capability,
        source: file.sourceRel,
        message: `zero-loss assertion failed for ${file.sourceRel}: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
    const outputReassembled = `## Purpose\n\n${reassembled.purpose}\n\n## Requirements\n\n${reassembled.requirements}`;
    const assemble = adapter.assembleSource ?? defaultAssembleSource;
    const sourceNormalized = normalizeForZeroLoss(assemble(raw, parsed));
    const outputNormalized = normalizeForZeroLoss(outputReassembled);
    if (sourceNormalized !== outputNormalized) {
      failures.push({
        capability: file.capability,
        source: file.sourceRel,
        message: `zero-loss mismatch for ${file.sourceRel}: re-assembled content differs from the source body (normalized)`,
        diff: diffLines(sourceNormalized, outputNormalized),
      });
      return;
    }

    mappedDocs.push({ entry, content: mapped });
  });

  // Collision refusal BEFORE anything is written; nothing is ever overwritten.
  for (const entry of entries) {
    if (existsSync(join(root, entry.file))) {
      failures.push({
        capability: entry.capability,
        source: entry.source,
        message: `refusing to overwrite existing file ${entry.file} (collision; never overwrites)`,
      });
    }
  }

  if (failures.length > 0) {
    const summary = failures
      .map((f) => `${f.source}: ${f.message}${f.diff ? `\n${f.diff.join("\n")}` : ""}`)
      .join("\n\n");
    throw new SpecImportError(
      `spec import openspec failed with ${failures.length} file error(s); nothing was written:\n\n${summary}`,
      failures,
    );
  }

  if (opts.dryRun) {
    return { root, dryRun: true, created: [], inventory: entries };
  }

  // Phase 2: write everything (only reached when every file asserted clean).
  mkdirSync(join(root, "docs", "specs"), { recursive: true });
  for (const doc of mappedDocs) {
    writeFileAtomic(join(root, doc.entry.file), doc.content);
  }
  return { root, dryRun: false, created: mappedDocs.map((d) => d.entry), inventory: [] };
}
