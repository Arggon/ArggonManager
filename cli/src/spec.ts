/**
 * `arggon spec` — validate and scaffold feature specs (docs/specs/) and
 * implementation plans (docs/plans/).
 *
 * Validation is a pure read: it never edits the documents it checks. Checks
 * are deliberately lenient about section naming (the existing specs are
 * Spanish: "Propósito" / "Synopsis" / "Aceptación" all count) but strict
 * about presence of frontmatter fields and acceptance criteria.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  TRACKER_DIR_NAME,
  acceptanceRows,
  docsDirForRoot,
  findTasksDir,
  readConventionVersion,
  repoRootFromTasks,
  sanitizeHumanError,
  writeFileAtomic,
  type Issue,
} from "@arggondev/lib";
import { bundledTemplatesDir } from "./package-assets.js";

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
    push(errors, rel, "missing a Synopsis/Design/'Model of data' section", "SPEC_MISSING_SECTION");
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
    push(
      errors,
      rel,
      "missing YAML frontmatter (expected file to start with ---)",
      `${prefix}_MISSING_FRONTMATTER`,
    );
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

/**
 * Document-number collisions (bug-spec-analyze-does-not-detect-duplicate-doc-numbers).
 *
 * {@link checkUniqueness} keys on the id INSIDE each file, so two documents
 * with different slugs but the SAME number (`0020-alpha.md` +
 * `0020-beta.md`, `spec-deps-001.md` + `spec-sync-001.md`) are invisible to
 * it: the ids differ, so nothing fires and git merges both in silently. The
 * shared thing is the numeric stem in the FILENAME, which only a
 * WHOLE-DIRECTORY scan can see — so this check cannot live in the per-file
 * pass.
 *
 * Report-only, on both surfaces, with one shared message:
 * `spec analyze` emits a `duplicate-doc-number` consistency finding (exit 0
 * with findings, like every other analyze finding) and `spec validate` emits a
 * `DOC_NUMBER_COLLISION` warning (warnings never fail the run). A blocking gate
 * is deliberately NOT taken here — exploration-014 C2's rule is report-only
 * first, and a gate on a corpus with pre-existing collisions would fire on
 * every commit until the tree is renumbered (open work, not a detection bug).
 */

export type DocNumberDir = "adr" | "explorations" | "specs" | "plans";

/**
 * Filename convention per directory, and the number it carries. The slug is
 * matched greedily so a slug that itself contains digits
 * (`spec-phase-2-006.md`) can never be read as the number: the number is the
 * LAST `-NNN` before `.md`, and `adr/README.md` matches nothing. `spec new`
 * derives its number from the same table ({@link nextDocNumber}), so the
 * scaffolder and the detector cannot drift apart.
 */
const DOC_NUMBER_SOURCES: readonly { dir: DocNumberDir; label: string; pattern: RegExp }[] = [
  { dir: "adr", label: "ADR", pattern: /^(\d{3,})(?:-[^/]*)?\.md$/ },
  { dir: "explorations", label: "exploration", pattern: /^exploration-[a-z0-9-]+-(\d{3,})\.md$/ },
  { dir: "specs", label: "spec", pattern: /^spec-[a-z0-9-]+-(\d{3,})\.md$/ },
  { dir: "plans", label: "plan", pattern: /^plan-[a-z0-9-]+-(\d{3,})\.md$/ },
];

/** Analyze finding kind / `spec validate` issue code for the same rule. */
export const DOC_NUMBER_COLLISION_KIND = "duplicate-doc-number";
export const DOC_NUMBER_COLLISION_CODE = "DOC_NUMBER_COLLISION";

/** The number a filename carries in its documented directory, as an integer. */
export function docNumberFromFileName(dir: DocNumberDir, fileName: string): number | undefined {
  const match = docNumberMatch(dir, fileName);
  return match?.number;
}

/** As {@link docNumberFromFileName}, plus the digits as written in the name. */
function docNumberMatch(
  dir: DocNumberDir,
  fileName: string,
): { number: number; stem: string } | undefined {
  const source = DOC_NUMBER_SOURCES.find((candidate) => candidate.dir === dir);
  if (source === undefined) return undefined;
  const match = source.pattern.exec(fileName);
  if (match === null) return undefined;
  const stem = match[1]!;
  return { number: Number.parseInt(stem, 10), stem };
}

export type DocNumberCollision = {
  dir: DocNumberDir;
  /** Human label for the directory ("ADR", "exploration", "spec", "plan"). */
  label: string;
  /** The shared number as an integer — `0001` and `001` are the same number. */
  number: number;
  /** The digits as written in the first colliding filename. */
  stem: string;
  /** Posix paths relative to the repo root, sorted, two or more. */
  files: string[];
};

/** Every number used by two or more files in the same docs directory. */
export function docNumberCollisions(root: string): DocNumberCollision[] {
  const docsDir = docsDirForRoot(root);
  const collisions: DocNumberCollision[] = [];
  for (const { dir, label } of DOC_NUMBER_SOURCES) {
    const byNumber = new Map<number, { stem: string; files: string[] }>();
    // listMarkdownDocs sorts by name, so `files` and `stem` are deterministic.
    for (const abs of listMarkdownDocs(join(docsDir, dir))) {
      const hit = docNumberMatch(dir, basename(abs));
      if (hit === undefined) continue;
      const bucket = byNumber.get(hit.number);
      if (bucket === undefined)
        byNumber.set(hit.number, { stem: hit.stem, files: [posixRel(root, abs)] });
      else bucket.files.push(posixRel(root, abs));
    }
    for (const [number, bucket] of [...byNumber.entries()].sort((a, b) => a[0] - b[0])) {
      if (bucket.files.length < 2) continue;
      collisions.push({ dir, label, number, stem: bucket.stem, files: bucket.files });
    }
  }
  return collisions;
}

/** One sentence naming the number and EVERY file that shares it. */
function docNumberCollisionMessage(collision: DocNumberCollision): string {
  return `${collision.label} number ${collision.stem} is shared by ${collision.files.length} documents (${collision.files.join(", ")}) — each number belongs to one document; rename all but one to the next FREE number`;
}

function resolveSingleFile(
  cwd: string,
  root: string,
  file: string,
): { abs: string; kind: DocKind } {
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
    for (const abs of listMarkdownDocs(join(docsDirForRoot(root), "specs"))) {
      infos.push(checkDoc(root, abs, "spec", errors));
    }
    for (const abs of listMarkdownDocs(join(docsDirForRoot(root), "plans"))) {
      infos.push(checkDoc(root, abs, "plan", errors));
    }
  }

  checkUniqueness(infos, errors);

  // Corpus mode only: a number collision is a property of the whole directory,
  // so a single `--file` cannot decide it.
  if (opts.file === undefined) {
    for (const collision of docNumberCollisions(root)) {
      push(
        warnings,
        collision.files[0]!,
        docNumberCollisionMessage(collision),
        DOC_NUMBER_COLLISION_CODE,
      );
    }
  }

  errors.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  warnings.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  return { root, conventionVersion, checked: infos.length, errors, warnings };
}

/**
 * Human report for `arggon spec validate` (bug-validate-stdout-injection M1):
 * same display policy as `formatValidateHuman` — path and message are
 * repo-controlled, each is sanitized at this boundary, the `[CODE]` stays
 * visible, and `--json` keeps the raw values.
 */
export function formatSpecValidateHuman(result: SpecValidateResult): string {
  const lines: string[] = [];
  for (const e of result.errors) {
    lines.push(`error ${sanitizeHumanError(e.path)}: ${sanitizeHumanError(e.message)} [${e.code}]`);
  }
  for (const w of result.warnings) {
    lines.push(
      `warning ${sanitizeHumanError(w.path)}: ${sanitizeHumanError(w.message)} [${w.code}]`,
    );
  }
  if (result.errors.length === 0) {
    lines.push(`arggon spec: ok (${result.checked} doc(s), ${result.warnings.length} warning(s))`);
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
  /**
   * Decision-pipeline gap findings (spec-analyze-decision-gaps-013): pending
   * explorations, stale Proposed ADRs, spec/plan status drift. Corpus mode
   * only (empty with `--spec <path>`).
   */
  decisions: SpecFinding[];
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
/**
 * Acceptance rows of a SPEC section — the kernel's, not a local regex.
 *
 * `arggon spec audit` asks whether an Acceptance section carries anything
 * testable. That is the same "what is an acceptance row" question the DONE GATE
 * asks, so it defers to the kernel rather than carrying a sixth grammar
 * (bug-three-acceptance-parsers-diverging; the guard is the
 * `acceptance-rows-use-kernel` structural rule). This finding is ADVISORY — it
 * never gates a status flip — so deferring here changes no refusal.
 */
const hasAcceptanceRows = (section: string): boolean => acceptanceRows(section).length > 0;
const SPEC_ID_CITATION_PATTERN = /\bspec-[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}\b/g;

function finding(
  file: string,
  kind: string,
  severity: SpecFindingSeverity,
  message: string,
  line?: number,
): SpecFinding {
  return line === undefined
    ? { file, kind, severity, message }
    : { file, kind, line, severity, message };
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
    if (!hasAcceptanceRows(section)) {
      findings.push(
        finding(
          rel,
          "untestable-acceptance",
          "warn",
          "Acceptance section has no checklist items to verify",
        ),
      );
    }
  }

  return findings;
}

function walkMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
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
 * body, no plan), plans pointing at missing spec files, and two documents
 * sharing one number (a whole-directory property the per-file
 * `spec_id`/`plan_id` check cannot see — see
 * {@link docNumberCollisions}).
 */
function consistencyFindings(root: string): SpecFinding[] {
  const findings: SpecFinding[] = [];

  type SpecEntry = { rel: string; specId?: string; status?: string };
  const specs: SpecEntry[] = [];
  for (const abs of listMarkdownDocs(join(docsDirForRoot(root), "specs"))) {
    const rel = posixRel(root, abs);
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      continue; // structural read failures surface via the ambiguity pass
    }
    const data = parseDocFrontmatter(raw) ?? {};
    specs.push({
      rel,
      specId: isTruthyFrontmatter(data.spec_id),
      status: isTruthyFrontmatter(data.status),
    });
  }

  const citedIds = new Set<string>();
  for (const abs of walkMarkdownFiles(findTasksDir(root))) {
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    for (const match of raw.matchAll(SPEC_ID_CITATION_PATTERN)) citedIds.add(match[0]);
  }

  const planReferencedSpecIds = new Set<string>();
  for (const abs of listMarkdownDocs(join(docsDirForRoot(root), "plans"))) {
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
        finding(
          rel,
          "plan-spec-missing",
          "warn",
          `spec file '${specPath}' does not exist (relative to the repo root)`,
        ),
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
        `spec '${spec.specId}' is marked implemented but no tracker item and no plan cites it`,
      ),
    );
  }

  for (const collision of docNumberCollisions(root)) {
    findings.push(
      finding(
        collision.files[0]!,
        DOC_NUMBER_COLLISION_KIND,
        "warn",
        docNumberCollisionMessage(collision),
      ),
    );
  }

  return findings;
}

/**
 * Decision-pipeline gap findings (spec-analyze-decision-gaps-013, from
 * exploration-014 C3): the explore → ADR → spec/plan pipeline leaks —
 * explorations stay on a placeholder Decision for weeks, ADRs sit in
 * `Proposed` indefinitely, and plans ship while their spec is still
 * `proposed`. Three report-only kinds in the additive `decisions` bucket:
 *
 * - `DECISION-PENDING-EXPLORATION` — exploration whose Decision section
 *   records no ADR after {@link DECISION_PENDING_DAYS} days.
 * - `STALE-PROPOSED-ADR` — ADR whose `- Status:` line starts with `Proposed`
 *   and whose `- Date:` is older than {@link STALE_PROPOSED_DAYS} days.
 * - `SPEC-STATUS-DRIFT` — spec with `status: proposed` whose linked plan
 *   (`spec:` resolving to the spec file) is `status: implemented`.
 *
 * Same contract as the rest of analyze: pure read, exit 0 with findings.
 * Age is whole days from the document date to today UTC; a finding fires
 * only when `ageDays > threshold`, and unparseable/missing dates are skipped
 * (analyze never guesses — structural validators own format errors).
 */

/** A decision left pending longer than a week is a pipeline leak. */
export const DECISION_PENDING_DAYS = 7;

/** A Proposed ADR older than two weeks is either accepted or rejected. */
export const STALE_PROPOSED_DAYS = 14;

/** Whole days from a YYYY-MM-DD date to today (UTC); null when unparseable. */
export function ageDaysFromTodayUtc(date: string | undefined): number | null {
  if (date === undefined) return null;
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const then = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(then)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - then) / 86_400_000);
}

export type AdrStatusInfo = {
  /** Trimmed Status value from the first `- Status:` list line, when present. */
  status?: string;
  /** 1-based full-file line number of that Status line. */
  statusLine?: number;
  /** Trimmed Date value from the first `- Date:` list line, when present. */
  date?: string;
};

/**
 * Parse an ADR's header list lines (`- Status: Proposed`, `- Date: YYYY-MM-DD`,
 * list-item form, case-insensitive; first occurrence wins). Frontmatter and
 * prose are deliberately ignored — the documented ADR format carries these as
 * list items.
 */
export function parseAdrStatusAndDate(raw: string): AdrStatusInfo {
  const info: AdrStatusInfo = {};
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const statusMatch = line.match(/^\s*[-*]\s+Status\s*:\s*(.+?)\s*$/i);
    if (statusMatch && info.status === undefined) {
      info.status = statusMatch[1];
      info.statusLine = i + 1;
      continue;
    }
    const dateMatch = line.match(/^\s*[-*]\s+Date\s*:\s*(\S+)\s*$/i);
    if (dateMatch && info.date === undefined) info.date = dateMatch[1];
  }
  return info;
}

export type DecisionSection = {
  /** 1-based full-file line of the Decision heading, when present. */
  headingLine?: number;
  /** Section text (heading excluded), HTML comments stripped. */
  text?: string;
};

/**
 * The Decision section of an exploration: the first `##` heading whose
 * normalized text starts with "decision" (covers "Decision" and
 * "Decision gate") through the next `##` heading or EOF. HTML comments are
 * stripped from the section text so template placeholders
 * (`<!-- ADR placeholder: … -->`) can never count as a recorded decision.
 */
export function parseDecisionSection(raw: string): DecisionSection {
  const lines = raw.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i]!.match(/^##\s+(.+?)\s*$/);
    if (heading && normalizeHeading(heading[1]!).startsWith("decision")) {
      start = i;
      break;
    }
  }
  if (start === -1) return {};
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  const text = lines
    .slice(start + 1, end)
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, "");
  return { headingLine: start + 1, text };
}

/**
 * Whether a Decision section text records an ADR: any `adr/<name>.md` path —
 * markdown link target or bare text (`- ADR: docs/adr/0007-x.md`) — whose
 * filename is numbered (`NNNN-…`) and not the `0000-<slug>` template
 * placeholder. Comments are already stripped by {@link parseDecisionSection}.
 */
export function decisionSectionHasAdrRef(sectionText: string): boolean {
  for (const match of sectionText.matchAll(/adr\/([A-Za-z0-9._<>-]+\.md)/g)) {
    const name = match[1]!;
    if (/^\d{3,}-/.test(name) && !name.startsWith("0000-") && !name.includes("<")) return true;
  }
  return false;
}

/**
 * Whether a Decision section records an explicit "no ADR needed" decision
 * (task-exploration-decision-records): a line starting with the exact token
 * `No ADR required` followed by an em dash, colon or hyphen separator and a
 * non-empty rationale (`No ADR required — bug-fix, no cross-cutting
 * decision`). The rationale is mandatory — a bare token or a missing reason
 * still counts as a pending decision, so the marker cannot be used to
 * silence the scanner without saying why. Like ADR links, this counts as a
 * recorded decision for {@link decisionFindings}. Comments are already
 * stripped by {@link parseDecisionSection}.
 */
export function decisionSectionHasNoAdrMarker(sectionText: string): boolean {
  return sectionText
    .split(/\r?\n/)
    .some((line) => /^(?:[-*]\s+)?No ADR required\s*[—:-]\s*\S/.test(line.trim()));
}

/** Corpus pass over explorations/, adr/ and the spec↔plan pairs. */
function decisionFindings(root: string): SpecFinding[] {
  const findings: SpecFinding[] = [];
  const docsDir = docsDirForRoot(root);

  for (const abs of listMarkdownDocs(join(docsDir, "explorations"))) {
    const rel = posixRel(root, abs);
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      continue; // structural read failures surface elsewhere; never crash the report
    }
    const data = parseDocFrontmatter(raw) ?? {};
    const age = ageDaysFromTodayUtc(isTruthyFrontmatter(data.created));
    if (age === null || age <= DECISION_PENDING_DAYS) continue;
    const section = parseDecisionSection(raw);
    if (
      section.text !== undefined &&
      (decisionSectionHasAdrRef(section.text) || decisionSectionHasNoAdrMarker(section.text))
    )
      continue;
    findings.push(
      finding(
        rel,
        "DECISION-PENDING-EXPLORATION",
        "warn",
        section.text === undefined
          ? `no Decision section — no decision recorded after ${age} day(s) (threshold ${DECISION_PENDING_DAYS})`
          : `Decision section records no decision after ${age} day(s) (threshold ${DECISION_PENDING_DAYS}) — link docs/adr/<NNNN>-<slug>.md, record "No ADR required — <reason>", or supersede the exploration`,
        section.headingLine,
      ),
    );
  }

  for (const abs of listMarkdownDocs(join(docsDir, "adr"))) {
    const rel = posixRel(root, abs);
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const info = parseAdrStatusAndDate(raw);
    if (info.status === undefined || !/^proposed\b/i.test(info.status)) continue;
    const age = ageDaysFromTodayUtc(info.date);
    if (age === null || age <= STALE_PROPOSED_DAYS) continue;
    findings.push(
      finding(
        rel,
        "STALE-PROPOSED-ADR",
        "warn",
        `ADR has been Proposed for ${age} day(s) (threshold ${STALE_PROPOSED_DAYS}) — accept, reject, or supersede it`,
        info.statusLine,
      ),
    );
  }

  type DriftSpec = { rel: string; abs: string; specId?: string; status?: string };
  const specs: DriftSpec[] = [];
  for (const abs of listMarkdownDocs(join(docsDir, "specs"))) {
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const data = parseDocFrontmatter(raw) ?? {};
    specs.push({
      rel: posixRel(root, abs),
      abs,
      specId: isTruthyFrontmatter(data.spec_id),
      status: isTruthyFrontmatter(data.status),
    });
  }
  type DriftPlan = { rel: string; specAbs?: string; status?: string };
  const plans: DriftPlan[] = [];
  for (const abs of listMarkdownDocs(join(docsDir, "plans"))) {
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const data = parseDocFrontmatter(raw) ?? {};
    const specPath = isTruthyFrontmatter(data.spec);
    plans.push({
      rel: posixRel(root, abs),
      specAbs: specPath === undefined ? undefined : resolve(root, specPath),
      status: isTruthyFrontmatter(data.status),
    });
  }
  for (const spec of specs) {
    if (spec.specId === undefined || spec.status !== "proposed") continue;
    for (const plan of plans) {
      if (plan.status !== "implemented" || plan.specAbs !== spec.abs) continue;
      findings.push(
        finding(
          spec.rel,
          "SPEC-STATUS-DRIFT",
          "warn",
          `spec '${spec.specId}' is proposed but plan '${plan.rel}' is implemented — the plan shipped without the spec status moving`,
        ),
      );
    }
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
    for (const abs of listMarkdownDocs(join(docsDirForRoot(root), "specs"))) {
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
  const decisions = opts.spec ? [] : decisionFindings(root);

  const byFile = (a: SpecFinding, b: SpecFinding): number =>
    a.file.localeCompare(b.file) || a.kind.localeCompare(b.kind) || (a.line ?? 0) - (b.line ?? 0);
  ambiguity.sort(byFile);
  consistency.sort(byFile);
  decisions.sort(byFile);
  return { root, conventionVersion, scanned, ambiguity, consistency, decisions };
}

/**
 * Human report for `arggon spec analyze` (bug-validate-stdout-injection M1,
 * same policy as `formatSpecValidateHuman`): finding `file` and `message` can
 * embed repo-controlled bytes (hostile spec filename, frontmatter value), so
 * both are sanitized per line; severity/kind are static enums. `--json`
 * findings keep the raw values.
 */
export function formatSpecAnalyzeHuman(result: SpecAnalyzeResult): string {
  const lines: string[] = [];
  for (const f of result.consistency) {
    lines.push(
      `${f.severity} ${sanitizeHumanError(f.file)}: ${sanitizeHumanError(f.message)} [${f.kind}]`,
    );
  }
  for (const f of result.decisions) {
    const at = f.line === undefined ? "" : `${f.line}:`;
    lines.push(
      `${f.severity} ${sanitizeHumanError(f.file)}:${at} ${sanitizeHumanError(f.message)} [${f.kind}]`,
    );
  }
  for (const f of result.ambiguity) {
    const at = f.line === undefined ? "" : `${f.line}:`;
    lines.push(
      `${f.severity} ${sanitizeHumanError(f.file)}:${at} ${sanitizeHumanError(f.message)} [${f.kind}]`,
    );
  }
  const total = result.ambiguity.length + result.consistency.length + result.decisions.length;
  if (total === 0) {
    lines.push(`arggon spec analyze: clean (${result.scanned} spec(s) scanned)`);
  } else {
    lines.push(
      `arggon spec analyze: ${total} finding(s) across ${result.scanned} spec(s) — report only, nothing was edited`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Persisted findings baselines for `spec analyze` (--save-baseline /
 * --baseline): the "no NEW findings vs previous wave" gate, mechanical instead
 * of manual JSON diffing.
 *
 * Snapshot format (stable, committable — NO timestamps or volatile fields):
 * `{ schemaVersion, conventionVersion, count, findings }` with `findings`
 * sorted deterministically (file, kind, line null-safe, severity, message), so
 * a re-run over unchanged specs is byte-identical and committed baselines
 * diff cleanly.
 *
 * Exit-code policy: a `--baseline` run with >= 1 NEW finding exits 1 (the
 * wave gate); zero new findings exits 0; `--no-fail-on-new` is report-only.
 * Without `--baseline` behavior is unchanged (exit 0 with findings; only a
 * structural failure exits 1). With `--json`, a failing gate still emits a
 * success envelope (`ok: true`) carrying the additive `baseline` payload —
 * the exit code carries the gate.
 */

export const SPEC_BASELINE_SCHEMA_VERSION = 1;

/** Deterministic ordering: file, kind, line (null-safe), severity, message. */
export function sortSpecFindings(findings: SpecFinding[]): SpecFinding[] {
  const sorted = [...findings];
  sorted.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.kind.localeCompare(b.kind) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.severity.localeCompare(b.severity) ||
      a.message.localeCompare(b.message),
  );
  return sorted;
}

/** Comparison identity: the WHOLE finding (all five fields must match). */
function findingKey(f: SpecFinding): string {
  return JSON.stringify([f.file, f.kind, f.line ?? null, f.severity, f.message]);
}

export type SpecBaselineSnapshot = {
  schemaVersion: number;
  conventionVersion: number;
  count: number;
  findings: SpecFinding[];
};

/** Byte-stable serialization (pretty-printed so committed baselines diff cleanly). */
export function serializeSpecBaseline(snapshot: SpecBaselineSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

function snapshotFromResult(result: SpecAnalyzeResult): SpecBaselineSnapshot {
  const findings = sortSpecFindings([
    ...result.ambiguity,
    ...result.consistency,
    ...result.decisions,
  ]);
  return {
    schemaVersion: SPEC_BASELINE_SCHEMA_VERSION,
    conventionVersion: result.conventionVersion,
    count: findings.length,
    findings,
  };
}

/**
 * Structural check for one finding read back from a committed snapshot
 * (defensive, one bounded pass): the file is a repo artifact, so an entry may
 * be anything. Only the presence and type of the four string fields is
 * checked — `line` is deliberately left to the display-time guard in
 * `formatSpecBaselineCompareHuman`, which renders it only when it is a number,
 * so a hostile value cannot reach the terminal either way.
 */
function isBaselineFinding(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.file === "string" &&
    typeof f.kind === "string" &&
    typeof f.severity === "string" &&
    typeof f.message === "string"
  );
}

function readBaselineSnapshot(file: string): SpecBaselineSnapshot {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (err) {
    throw new Error(
      `cannot read baseline ${file}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `baseline ${file} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const snap = data as Partial<SpecBaselineSnapshot> | null;
  if (
    snap === null ||
    typeof snap !== "object" ||
    !Array.isArray(snap.findings) ||
    typeof snap.count !== "number"
  ) {
    throw new Error(`baseline ${file} is not a spec analyze baseline snapshot`);
  }
  if (!snap.findings.every(isBaselineFinding)) {
    throw new Error(
      `baseline ${file} has a malformed finding (expected string file/kind/severity/message)`,
    );
  }
  return snap as SpecBaselineSnapshot;
}

export type SpecBaselineSaveOptions = {
  cwd: string;
  spec?: string;
  /** Where to write the snapshot JSON. */
  file: string;
};

export type SpecBaselineSaveResult = {
  result: SpecAnalyzeResult;
  /** Absolute path the snapshot was written to. */
  file: string;
  snapshot: SpecBaselineSnapshot;
};

/** `spec analyze --save-baseline <file>`: scan, then write the snapshot. */
export function runSpecAnalyzeSaveBaseline(opts: SpecBaselineSaveOptions): SpecBaselineSaveResult {
  const result = runSpecAnalyze({ cwd: opts.cwd, spec: opts.spec });
  const abs = isAbsolute(opts.file) ? opts.file : resolve(opts.cwd, opts.file);
  const snapshot = snapshotFromResult(result);
  writeFileAtomic(abs, serializeSpecBaseline(snapshot));
  return { result, file: abs, snapshot };
}

export type SpecBaselineComparison = {
  result: SpecAnalyzeResult;
  /** Absolute path of the baseline the current run was compared against. */
  file: string;
  /** Findings in the current run. */
  total: number;
  /** Current findings that also exist in the baseline (matched on all fields). */
  unchanged: SpecFinding[];
  /** In current, not in baseline. */
  added: SpecFinding[];
  /** In baseline, not in current. */
  resolved: SpecFinding[];
};

/** `spec analyze --baseline <file>`: scan, then compare against the snapshot. */
export function runSpecAnalyzeCompareBaseline(
  opts: SpecBaselineSaveOptions,
): SpecBaselineComparison {
  const baseline = readBaselineSnapshot(opts.file);
  const result = runSpecAnalyze({ cwd: opts.cwd, spec: opts.spec });
  const baselineKeys = new Set(baseline.findings.map(findingKey));
  const current = [...result.ambiguity, ...result.consistency, ...result.decisions];
  const currentKeySet = new Set(current.map(findingKey));
  const unchanged: SpecFinding[] = [];
  const added: SpecFinding[] = [];
  for (const f of current) {
    (baselineKeys.has(findingKey(f)) ? unchanged : added).push(f);
  }
  const resolved = baseline.findings.filter((f) => !currentKeySet.has(findingKey(f)));
  return {
    result,
    file: isAbsolute(opts.file) ? opts.file : resolve(opts.cwd, opts.file),
    total: current.length,
    unchanged: sortSpecFindings(unchanged),
    added: sortSpecFindings(added),
    resolved: sortSpecFindings(resolved),
  };
}

export function formatSpecBaselineSaveHuman(r: SpecBaselineSaveResult): string {
  const total = r.result.ambiguity.length + r.result.consistency.length + r.result.decisions.length;
  return `arggon spec analyze: baseline written to ${sanitizeHumanError(r.file)} (${total} finding(s) across ${r.result.scanned} spec(s))\n`;
}

/**
 * Human report for `spec analyze --baseline` (bug-validate-stdout-injection
 * F1 follow-up): unlike `added` (current-scan findings, static severity/kind),
 * `resolved` findings are read back from a committed snapshot, so ALL their
 * fields are untrusted. Every dynamic field is sanitized at this boundary and
 * `line` is rendered only when it is a number — a hostile string line is
 * dropped instead of interpolated. `--json` keeps the raw snapshot values.
 *
 * The baseline snapshot PATH is operator argv (`--baseline`), but it is
 * sanitized too (task-success-stdout-sanitize): a path can be pasted from repo
 * data by automation, and path-like values are sanitized consistently across
 * the success-path channel, with the composite-diagnostic cap (absolute paths
 * are not bounded by the 200-char report cap). Ordinary paths render
 * byte-identical.
 */
export function formatSpecBaselineCompareHuman(c: SpecBaselineComparison): string {
  const lines: string[] = [];
  for (const f of c.added) {
    const at = typeof f.line === "number" ? `${f.line}:` : "";
    lines.push(
      `new ${sanitizeHumanError(f.severity)} ${sanitizeHumanError(f.file)}:${at} ` +
        `${sanitizeHumanError(f.message)} [${sanitizeHumanError(f.kind)}]`,
    );
  }
  for (const f of c.resolved) {
    const at = typeof f.line === "number" ? `${f.line}:` : "";
    lines.push(
      `resolved ${sanitizeHumanError(f.severity)} ${sanitizeHumanError(f.file)}:${at} ` +
        `${sanitizeHumanError(f.message)} [${sanitizeHumanError(f.kind)}]`,
    );
  }
  lines.push(
    `arggon spec analyze vs baseline ${sanitizeHumanError(c.file)}: ${c.added.length} new, ${c.resolved.length} resolved, ` +
      `${c.unchanged.length} unchanged, ${c.total} total`,
  );
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
spec: ArggonManager/docs/specs/spec-{{SLUG}}-{{NNN}}.md
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

/**
 * The next FREE spec/plan number: one above the highest number in use across
 * both directories, read through the documented filename convention
 * ({@link DOC_NUMBER_SOURCES}) rather than a loose trailing-digits guess, so
 * the scaffolder and the collision detector agree on what a number is.
 */
function nextDocNumber(root: string): number {
  let max = 0;
  const docsDir = docsDirForRoot(root);
  for (const dir of ["specs", "plans"] as const) {
    for (const abs of listMarkdownDocs(join(docsDir, dir))) {
      const number = docNumberFromFileName(dir, basename(abs));
      if (number !== undefined) max = Math.max(max, number);
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
  const title =
    opts.title && opts.title.trim() !== "" ? opts.title.trim() : opts.slug.replace(/-/g, " ");

  const specDir = join(docsDirForRoot(root), "specs");
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
  // Layout-aware spec pointers (ADR 0012): the templates carry the canonical
  // `ArggonManager/docs/...` paths; legacy trees keep their `<root>/docs/...`
  // form so the scaffolded plan's `spec:` pointer resolves under validate.
  const docsRel = relative(root, docsDirForRoot(root)).split(sep).join("/");
  const renderForTree = (kind: "spec" | "plan"): string => {
    const rendered = renderTemplate(kind, vars);
    return docsRel === `${TRACKER_DIR_NAME}/docs`
      ? rendered
      : rendered.replaceAll(`${TRACKER_DIR_NAME}/docs`, docsRel);
  };
  mkdirSync(specDir, { recursive: true });
  writeFileAtomic(specPath, renderForTree("spec"));
  files.push(posixRel(root, specPath));

  if (opts.plan) {
    const planDir = join(docsDirForRoot(root), "plans");
    const planPath = join(planDir, `plan-${opts.slug}-${padded}.md`);
    if (existsSync(planPath)) {
      throw new Error(`refusing to overwrite existing file ${posixRel(root, planPath)}`);
    }
    mkdirSync(planDir, { recursive: true });
    writeFileAtomic(planPath, renderForTree("plan"));
    files.push(posixRel(root, planPath));
  }

  return { root, files };
}
