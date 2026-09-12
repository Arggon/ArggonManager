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
