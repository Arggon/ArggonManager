/**
 * `arggon spec` — validate and scaffold feature specs (docs/specs/) and
 * implementation plans (docs/plans/).
 *
 * Validation is a pure read: it never edits the documents it checks. Checks
 * are deliberately lenient about section naming (the existing specs are
 * Spanish: "Propósito" / "Synopsis" / "Aceptación" all count) but strict
 * about presence of frontmatter fields and acceptance criteria.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { readConventionVersion } from "./convention.js";
import { bundledTemplatesDir, findTasksDir, repoRootFromTasks } from "./paths.js";
import type { Issue } from "./types.js";

export type SpecValidateOptions = {
  cwd: string;
  /** Validate a single file (also outside docs/specs / docs/plans). */
  file?: string;
};

export type SpecValidateResult = {
  root: string;
  conventionVersion: number;
  /** Number of documents checked. */
  checked: number;
  errors: Issue[];
  warnings: Issue[];
};

export type SpecNewOptions = {
  cwd: string;
  slug: string;
  title?: string;
  /** Also scaffold the matching docs/plans/plan-<slug>-NNN.md. */
  plan?: boolean;
};

export type SpecNewResult = {
  root: string;
  /** Created files, posix, relative to the repo root. */
  files: string[];
};

const SPEC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DOC_STATUSES = new Set(["proposed", "implemented", "superseded"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type DocKind = "spec" | "plan";

function push(bucket: Issue[], path: string, message: string, code: string): void {
  bucket.push({ path, message, code });
}

function posixRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

/**
 * Lenient YAML-ish frontmatter reader for spec/plan documents. Only top-level
 * `key: value` lines are collected; nested structures (e.g. the `depends_on`
 * list in spec-sync-001.md) and unknown keys are ignored — spec documents are
 * prose, not work items, so we never enforce the item schema here.
 */
function parseDocFrontmatter(raw: string): Record<string, string> | null {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) return null;
  const rest = normalized.slice(normalized.indexOf("\n") + 1);
  const endMatch = rest.match(/\r?\n---\r?\n?/);
  if (!endMatch || endMatch.index === undefined) return null;
  const yaml = rest.slice(0, endMatch.index);
  const data: Record<string, string> = {};
  for (const line of yaml.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith(" ") || line.startsWith("-")) continue; // nested / list continuation
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    data[key] = value;
  }
  return data;
}

function stripScalar(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Lowercase, de-accent, drop section numbering ("1.") and trailing parentheticals. */
function normalizeHeading(text: string): string {
  const noAccents = text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return noAccents
    .toLowerCase()
    .replace(/^\s*\d+\s*[.)]\s*/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function isPurposeHeading(normalized: string): boolean {
  return (
    normalized.includes("purpose") ||
    normalized.includes("proposito") ||
    ["motivation", "background", "context", "objetivo"].includes(normalized)
  );
}

function isSynopsisHeading(normalized: string): boolean {
  return (
    normalized.includes("synopsis") ||
    normalized.includes("sinopsis") ||
    normalized === "design" ||
    normalized === "diseno" ||
    normalized.includes("model of data") ||
    normalized.includes("modelo de datos")
  );
}

function isAcceptanceHeading(normalized: string): boolean {
  return normalized.includes("acceptance") || normalized.includes("aceptacion");
}

/** Non-empty prose between the H1 title and the first H2 (an intro counts as purpose). */
function hasNonEmptyIntro(body: string): boolean {
  const lines = body.split(/\r?\n/);
  let afterH1 = false;
  for (const line of lines) {
    if (!afterH1) {
      if (/^#\s+\S/.test(line)) afterH1 = true;
      continue;
    }
    if (/^##\s/.test(line)) return false;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("<!--") || trimmed === "-->") continue;
    return true;
  }
  return false;
}

function checkSpecSections(rel: string, body: string, errors: Issue[]): void {
  const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => normalizeHeading(m[1]!));
  let sawPurpose = hasNonEmptyIntro(body);
  let sawSynopsis = false;
  let sawAcceptance = false;
  for (const heading of headings) {
    if (isPurposeHeading(heading)) sawPurpose = true;
    if (isSynopsisHeading(heading)) sawSynopsis = true;
    if (isAcceptanceHeading(heading)) sawAcceptance = true;
  }
  if (!sawPurpose) {
    push(errors, rel, "missing a Purpose section (or a non-empty intro)", "SPEC_MISSING_SECTION");
  }
  if (!sawSynopsis) {
    push(
      errors,
      rel,
      "missing a Synopsis/Design/'Model of data' section",
      "SPEC_MISSING_SECTION",
    );
  }
  if (!sawAcceptance) {
    push(errors, rel, "missing an Acceptance criteria section", "SPEC_MISSING_SECTION");
  }
}

type DocInfo = { kind: DocKind; rel: string; docId?: string };

function checkDoc(root: string, abs: string, kind: DocKind, errors: Issue[]): DocInfo {
  const rel = posixRel(root, abs);
  const prefix = kind === "spec" ? "SPEC" : "PLAN";
  let raw: string;
  try {
    raw = readFileSync(abs, "utf8");
  } catch (err) {
    push(
      errors,
      rel,
      `cannot read file: ${err instanceof Error ? err.message : String(err)}`,
      `${prefix}_READ_FAILED`,
    );
    return { kind, rel };
  }
  const data = parseDocFrontmatter(raw);
  if (data === null) {
    push(errors, rel, "missing YAML frontmatter (expected file to start with ---)", `${prefix}_MISSING_FRONTMATTER`);
    return { kind, rel };
  }

  const idKey = kind === "spec" ? "spec_id" : "plan_id";
  const required = [idKey, "title", "status", "created"] as const;
  for (const field of required) {
    const value = data[field];
    if (value === undefined || value.trim() === "" || value.trim() === "null") {
      push(errors, rel, `missing required frontmatter field '${field}'`, `${prefix}_MISSING_FIELD`);
    }
  }

  const docIdValue = data[idKey];
  if (docIdValue !== undefined) {
    const docId = stripScalar(docIdValue.trim());
    if (kind === "spec" && !SPEC_ID_PATTERN.test(docId)) {
      push(
        errors,
        rel,
        `spec_id ${JSON.stringify(docId)} must be kebab-case ASCII (^[a-z0-9]+(-[a-z0-9]+)*$)`,
        "SPEC_BAD_ID",
      );
    }
  }

  const statusValue = data.status;
  if (statusValue !== undefined && !DOC_STATUSES.has(stripScalar(statusValue.trim()))) {
    push(
      errors,
      rel,
      `status must be one of proposed | implemented | superseded (got ${JSON.stringify(statusValue.trim())})`,
      `${prefix}_BAD_STATUS`,
    );
  }

  const createdValue = data.created;
  if (createdValue !== undefined && !DATE_PATTERN.test(stripScalar(createdValue.trim()))) {
    push(
      errors,
      rel,
      `created must be YYYY-MM-DD (got ${JSON.stringify(createdValue.trim())})`,
      `${prefix}_BAD_DATE`,
    );
  }

  if (kind === "spec") {
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    checkSpecSections(rel, body, errors);
  } else {
    const specValue = data.spec;
    if (specValue === undefined || stripScalar(specValue.trim()) === "") {
      push(errors, rel, "missing required frontmatter field 'spec'", "PLAN_MISSING_FIELD");
    } else {
      const specPath = stripScalar(specValue.trim());
      if (!existsSync(resolve(root, specPath))) {
        push(
          errors,
          rel,
          `spec file '${specPath}' does not exist (relative to the repo root)`,
          "PLAN_SPEC_NOT_FOUND",
        );
      }
    }
  }

  const docId = data[idKey] === undefined ? undefined : stripScalar(data[idKey]!.trim());
  return { kind, rel, docId };
}

function listMarkdownDocs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => join(dir, name));
}

function checkUniqueness(infos: DocInfo[], errors: Issue[]): void {
  const byKey = new Map<string, DocInfo>();
  for (const info of infos) {
    if (!info.docId) continue;
    const key = `${info.kind}:${info.docId}`;
    const prev = byKey.get(key);
    if (prev) {
      push(
        errors,
        info.rel,
        `duplicate ${info.kind === "spec" ? "spec_id" : "plan_id"} '${info.docId}' (also ${prev.rel})`,
        info.kind === "spec" ? "SPEC_DUPLICATE_ID" : "PLAN_DUPLICATE_ID",
      );
      continue;
    }
    byKey.set(key, info);
  }
}

function resolveSingleFile(cwd: string, root: string, file: string): { abs: string; kind: DocKind } {
  const abs = isAbsolute(file) ? file : resolve(cwd, file);
  const base = basename(abs);
  const kind: DocKind =
    base.startsWith("plan-") || basename(dirname(abs)) === "plans" ? "plan" : "spec";
  return { abs, kind };
}

export function runSpecValidate(opts: SpecValidateOptions): SpecValidateResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const conventionVersion = readConventionVersion(root);
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  const infos: DocInfo[] = [];
  if (opts.file) {
    const { abs, kind } = resolveSingleFile(opts.cwd, root, opts.file);
    infos.push(checkDoc(root, abs, kind, errors));
  } else {
    for (const abs of listMarkdownDocs(join(root, "docs", "specs"))) {
      infos.push(checkDoc(root, abs, "spec", errors));
    }
    for (const abs of listMarkdownDocs(join(root, "docs", "plans"))) {
      infos.push(checkDoc(root, abs, "plan", errors));
    }
  }

  checkUniqueness(infos, errors);

  errors.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  warnings.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  return { root, conventionVersion, checked: infos.length, errors, warnings };
}

export function formatSpecValidateHuman(result: SpecValidateResult): string {
  const lines: string[] = [];
  for (const e of result.errors) {
    lines.push(`error ${e.path}: ${e.message} [${e.code}]`);
  }
  for (const w of result.warnings) {
    lines.push(`warning ${w.path}: ${w.message} [${w.code}]`);
  }
  if (result.errors.length === 0) {
    lines.push(
      `arggon spec: ok (${result.checked} doc(s), ${result.warnings.length} warning(s))`,
    );
  } else {
    lines.push(
      `arggon spec: failed with ${result.errors.length} error(s), ${result.warnings.length} warning(s)`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * `arggon spec analyze` — checklist-driven ambiguity scan + spec/plan/task
 * consistency report. Pure read: it NEVER edits the documents it scans, and
 * findings never fail the run (exit 0 with findings; non-zero only on a
 * structural failure such as an unreadable file, reusing SPEC_FAILED).
 */

export type SpecFindingSeverity = "info" | "warn";

export type SpecFinding = {
  /** Posix path, relative to the repo root. */
  file: string;
  /** Checklist kind, e.g. "vague-quantifier", "spec-orphaned". */
  kind: string;
  /** 1-based line number, when the finding is tied to one. */
  line?: number;
  severity: SpecFindingSeverity;
  message: string;
};

export type SpecAnalyzeOptions = {
  cwd: string;
  /** Scan a single spec file (also outside docs/specs) instead of the corpus. */
  spec?: string;
};

export type SpecAnalyzeResult = {
  root: string;
  conventionVersion: number;
  /** Number of spec documents scanned. */
  scanned: number;
  ambiguity: SpecFinding[];
  consistency: SpecFinding[];
};

/** Deliberately small, documented checklist; deterministic, no AI. */
const VAGUE_TERMS = [
  "fast",
  "scalable",
  "several",
  "quickly",
  "efficient",
  "robust",
  "flexible",
  "user-friendly",
] as const;

const VAGUE_PATTERN = new RegExp(`\\b(${VAGUE_TERMS.join("|")})\\b`, "i");
const TODO_PATTERN = /\b(TODO|TBD|FIXME)\b/;
const ERROR_PATH_PATTERN = /\b(error|errors|failure|fail|fails|failing)\b/i;
const CHECKBOX_PATTERN = /^\s*[-*]\s+\[[ xX]\]/;
const SPEC_ID_CITATION_PATTERN = /\bspec-[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}\b/g;

function finding(
  file: string,
  kind: string,
  severity: SpecFindingSeverity,
  message: string,
  line?: number,
): SpecFinding {
  return line === undefined ? { file, kind, severity, message } : { file, kind, line, severity, message };
}

function bodyWithoutFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function isTruthyFrontmatter(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const stripped = stripScalar(value.trim());
  return stripped === "" || stripped === "null" ? undefined : stripped;
}

/** Ambiguity checklist over one spec document's body. */
function ambiguityFindings(rel: string, raw: string): SpecFinding[] {
  const findings: SpecFinding[] = [];
  const body = bodyWithoutFrontmatter(raw);
  // Line numbers are reported against the full file: offset by the removed
  // frontmatter block ("---\\nk: v\\n---\\n" = 3 lines before the body).
  const fmBlock = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const offset = fmBlock ? fmBlock[0].split(/\r?\n/).length - 1 : 0;
  const lines = body.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const at = offset + i + 1;
    const vague = line.match(VAGUE_PATTERN);
    if (vague) {
      findings.push(
        finding(
          rel,
          "vague-quantifier",
          "warn",
          `vague term '${vague[1]}' — quantify or replace with a measurable term`,
          at,
        ),
      );
    }
    const todo = line.match(TODO_PATTERN);
    if (todo) {
      findings.push(finding(rel, "todo-marker", "warn", `unresolved ${todo[1]} marker`, at));
    }
  }

  const mentionsErrorPath = lines.some((l) => ERROR_PATH_PATTERN.test(l));
  if (!mentionsErrorPath) {
    findings.push(
      finding(rel, "no-error-path", "warn", "no error/failure path mentioned anywhere in the spec"),
    );
  }

  const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gm)];
  const acceptanceIdx = headings.findIndex((m) => isAcceptanceHeading(normalizeHeading(m[1]!)));
  if (acceptanceIdx === -1) {
    findings.push(finding(rel, "no-acceptance", "warn", "missing an Acceptance criteria section"));
  } else {
    const start = (headings[acceptanceIdx]!.index ?? 0) + headings[acceptanceIdx]![0].length;
    const next = headings[acceptanceIdx + 1]?.index ?? body.length;
    const section = body.slice(start, next);
    const hasChecklist = section.split(/\r?\n/).some((l) => CHECKBOX_PATTERN.test(l));
    if (!hasChecklist) {
      findings.push(
        finding(rel, "untestable-acceptance", "warn", "Acceptance section has no checklist items to verify"),
      );
    }
  }

  return findings;
}

function walkMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
    }
  };
  visit(dir);
  return out;
}

/**
 * Consistency across the corpus: implemented specs nobody cites (no task
 * body, no plan) and plans pointing at missing spec files.
 */
function consistencyFindings(root: string): SpecFinding[] {
  const findings: SpecFinding[] = [];

  type SpecEntry = { rel: string; specId?: string; status?: string };
  const specs: SpecEntry[] = [];
  for (const abs of listMarkdownDocs(join(root, "docs", "specs"))) {
    const rel = posixRel(root, abs);
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      continue; // structural read failures surface via the ambiguity pass
    }
    const data = parseDocFrontmatter(raw) ?? {};
    specs.push({ rel, specId: isTruthyFrontmatter(data.spec_id), status: isTruthyFrontmatter(data.status) });
  }

  const citedIds = new Set<string>();
  for (const abs of walkMarkdownFiles(join(root, "tasks"))) {
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    for (const match of raw.matchAll(SPEC_ID_CITATION_PATTERN)) citedIds.add(match[0]);
  }

  const planReferencedSpecIds = new Set<string>();
  for (const abs of listMarkdownDocs(join(root, "docs", "plans"))) {
    const rel = posixRel(root, abs);
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const data = parseDocFrontmatter(raw) ?? {};
    const specPath = isTruthyFrontmatter(data.spec);
    if (specPath === undefined) continue;
    if (!existsSync(resolve(root, specPath))) {
      findings.push(
        finding(rel, "plan-spec-missing", "warn", `spec file '${specPath}' does not exist (relative to the repo root)`),
      );
      continue;
    }
    // docs/specs/spec-<spec_id>.md -> <spec_id>
    const base = basename(specPath).replace(/\.md$/, "");
    if (base.startsWith("spec-")) planReferencedSpecIds.add(base.slice("spec-".length));
  }

  for (const spec of specs) {
    if (spec.specId === undefined || spec.status !== "implemented") continue;
    // Items cite either the bare spec_id ("sync-001") or the filename stem
    // ("spec-sync-001"); accept both forms.
    if (citedIds.has(spec.specId) || citedIds.has(`spec-${spec.specId}`)) continue;
    if (planReferencedSpecIds.has(spec.specId)) continue;
    findings.push(
      finding(
        spec.rel,
        "spec-orphaned",
        "warn",
        `spec '${spec.specId}' is marked implemented but no item under tasks/ and no plan cites it`,
      ),
    );
  }

  return findings;
}

export function runSpecAnalyze(opts: SpecAnalyzeOptions): SpecAnalyzeResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const conventionVersion = readConventionVersion(root);
  const ambiguity: SpecFinding[] = [];
  let scanned = 0;

  if (opts.spec) {
    const abs = isAbsolute(opts.spec) ? opts.spec : resolve(opts.cwd, opts.spec);
    const rel = posixRel(root, abs);
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch (err) {
      throw new Error(`cannot read ${rel}: ${err instanceof Error ? err.message : String(err)}`);
    }
    scanned = 1;
    ambiguity.push(...ambiguityFindings(rel, raw));
  } else {
    for (const abs of listMarkdownDocs(join(root, "docs", "specs"))) {
      let raw: string;
      try {
        raw = readFileSync(abs, "utf8");
      } catch (err) {
        throw new Error(
          `cannot read ${posixRel(root, abs)}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      scanned++;
      ambiguity.push(...ambiguityFindings(posixRel(root, abs), raw));
    }
  }

  const consistency = opts.spec ? [] : consistencyFindings(root);

  const byFile = (a: SpecFinding, b: SpecFinding): number =>
    a.file.localeCompare(b.file) || a.kind.localeCompare(b.kind) || (a.line ?? 0) - (b.line ?? 0);
  ambiguity.sort(byFile);
  consistency.sort(byFile);
  return { root, conventionVersion, scanned, ambiguity, consistency };
}

export function formatSpecAnalyzeHuman(result: SpecAnalyzeResult): string {
  const lines: string[] = [];
  for (const f of result.consistency) {
    lines.push(`${f.severity} ${f.file}: ${f.message} [${f.kind}]`);
  }
  for (const f of result.ambiguity) {
    const at = f.line === undefined ? "" : `${f.line}:`;
    lines.push(`${f.severity} ${f.file}:${at} ${f.message} [${f.kind}]`);
  }
  const total = result.ambiguity.length + result.consistency.length;
  if (total === 0) {
    lines.push(`arggon spec analyze: clean (${result.scanned} spec(s) scanned)`);
  } else {
    lines.push(
      `arggon spec analyze: ${total} finding(s) across ${result.scanned} spec(s) — report only, nothing was edited`,
    );
  }
  return `${lines.join("\n")}\n`;
}

const SPEC_TEMPLATE_FALLBACK = `---
spec_id: {{ID}}
title: {{TITLE}}
status: proposed
created: {{DATE}}
---

# Spec: {{TITLE}} ({{ID}})

## Purpose

<!-- Why this spec exists: the problem, the invariants (e.g. "never overwrites", "pure read"). -->

## Synopsis

\`\`\`bash
arggon <command> [flags]
\`\`\`

<!-- Flags, JSON shapes, and behavior in one glance. -->

## Acceptance

- [ ]
`;

const PLAN_TEMPLATE_FALLBACK = `---
plan_id: {{ID}}
title: Plan for {{TITLE}}
spec: docs/specs/spec-{{SLUG}}-{{NNN}}.md
status: proposed
created: {{DATE}}
---

# Plan: {{TITLE}} ({{ID}})

Derived from \`docs/specs/spec-{{SLUG}}-{{NNN}}.md\`. Each task carries a
verifiable acceptance criterion and links back to the spec.

## Tasks

### T1: <step>

- <what to build>
- **Acceptance:** <verifiable criterion>
`;

function renderTemplate(kind: "spec" | "plan", vars: Record<string, string>): string {
  const name = kind === "spec" ? "spec.md" : "plan.md";
  const bundled = join(bundledTemplatesDir(), name);
  let raw: string;
  try {
    raw = readFileSync(bundled, "utf8");
  } catch {
    raw = kind === "spec" ? SPEC_TEMPLATE_FALLBACK : PLAN_TEMPLATE_FALLBACK;
  }
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
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

export function runSpecNew(opts: SpecNewOptions): SpecNewResult {
  if (!SPEC_ID_PATTERN.test(opts.slug)) {
    throw new Error(
      `invalid slug ${JSON.stringify(opts.slug)} (must be kebab-case ASCII: ^[a-z0-9]+(-[a-z0-9]+)*$)`,
    );
  }
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const nnn = nextDocNumber(root);
  const padded = String(nnn).padStart(3, "0");
  const docId = `${opts.slug}-${padded}`;
  const date = new Date().toISOString().slice(0, 10);
  const title = opts.title && opts.title.trim() !== "" ? opts.title.trim() : opts.slug.replace(/-/g, " ");

  const specDir = join(root, "docs", "specs");
  const specPath = join(specDir, `spec-${opts.slug}-${padded}.md`);
  if (existsSync(specPath)) {
    throw new Error(`refusing to overwrite existing file ${posixRel(root, specPath)}`);
  }

  const vars: Record<string, string> = {
    SLUG: opts.slug,
    NNN: padded,
    ID: docId,
    TITLE: title,
    DATE: date,
  };

  const files: string[] = [];
  mkdirSync(specDir, { recursive: true });
  writeFileSync(specPath, renderTemplate("spec", vars), "utf8");
  files.push(posixRel(root, specPath));

  if (opts.plan) {
    const planDir = join(root, "docs", "plans");
    const planPath = join(planDir, `plan-${opts.slug}-${padded}.md`);
    if (existsSync(planPath)) {
      throw new Error(`refusing to overwrite existing file ${posixRel(root, planPath)}`);
    }
    mkdirSync(planDir, { recursive: true });
    writeFileSync(planPath, renderTemplate("plan", vars), "utf8");
    files.push(posixRel(root, planPath));
  }

  return { root, files };
}
