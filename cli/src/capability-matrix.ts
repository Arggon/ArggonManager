/**
 * Capability-matrix reader (spec-methodology-adapters-017 §S3, plan T3,
 * task-capability-matrix).
 *
 * `adapters/capability-matrix.json` is DATA: methodology invariant × agent →
 * the native mechanism used, the client package that carries it, and an
 * explicit `gap` flag with a note. This module only parses, bounds and
 * reports it — it holds **no rule logic**, and nothing here gates anything:
 * the kernel (`@arggondev/lib`) behind the arggon CLI stays the enforcement of
 * record on every row (ADR 0020), and a gap row is advisory in every surface.
 *
 * Posture mirrors the rest of `doctor`: pure reads, never throws, every list
 * explicitly capped, and a missing or malformed matrix is a normal report
 * (`present: false` + `error`) that still exits 0. The file is resolved from
 * the TREE first (`<root>/adapters/capability-matrix.json` — this repo's own
 * committed copy) and from the INSTALLED PACKAGE second, so an adopter tree
 * with no `adapters/` dir still reports the shipped matrix. A tree copy that
 * exists but does not parse is reported as an error instead of silently
 * falling back to the package copy: a corrupt tree file must stay visible.
 *
 * Schema conformance of the COMMITTED file is gated by test
 * (`cli/src/capability-matrix.test.ts`), not by this reader: doctor reports
 * whatever it finds, it does not validate the product.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sanitizeHumanText } from "@arggondev/lib";
import { packageRoot } from "./package-assets.js";

/** Matrix file location, relative to the tree root or the installed package root. */
export const MATRIX_PATH = "adapters/capability-matrix.json";

/** Matrix `schemaVersion` this reader understands. */
export const MATRIX_SCHEMA_VERSION = 1;

/**
 * Gap rows carried in the report (`gapRows`) and printed per line. Beyond the
 * cap the count stays honest in `gaps` and `truncated` says so — the report
 * never grows with the file.
 */
export const MAX_MATRIX_GAP_ROWS = 10;

/**
 * Byte ceiling for the matrix file. Read with `statSync` BEFORE the content is
 * loaded, so an accidentally grown data file can never be pulled into a
 * report: 16 KiB is ~2× the committed file and orders of magnitude above what
 * any bounded matrix needs.
 */
export const MAX_MATRIX_BYTES = 16_384;

/** One gap cell: invariant × agent, with the note that says what is missing. */
export type MatrixGapRow = {
  invariant: string;
  agent: string;
  mechanism: string;
  package: string;
  note: string;
};

/** Capability-matrix state as reported (never a verdict — report-only). */
export type CapabilityMatrix = {
  /** A readable matrix file was found. */
  present: boolean;
  /**
   * Posix path of the file that was read: tree-relative when the tree carries
   * its own copy, else the installed package's `adapters/capability-matrix.json`.
   */
  source: string | null;
  /** `schemaVersion` of the file, or null when absent/unreadable. */
  schemaVersion: number | null;
  /** Agent ids the matrix declares (sorted, capped). */
  agents: string[];
  /** Declared invariant count. */
  invariants: number;
  /** Row count that matched the shape. */
  rows: number;
  /** Gap rows in the FILE (not the capped detail list below). */
  gaps: number;
  /** Gap detail, capped at {@link MAX_MATRIX_GAP_ROWS}. */
  gapRows: MatrixGapRow[];
  /** A gap row was cut from `gapRows` (`gaps` still counts them all). */
  truncated: boolean;
  /** Rows dropped for not matching the shape — a hand-edited file, reported not repaired. */
  invalid: number;
  /** Why no matrix was read (absent, unreadable, oversized, malformed). */
  error: string | null;
};

/** Agent ids in a gap-free matrix still count against the cap. */
const MAX_MATRIX_AGENTS = 20;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Non-empty string field, else null. */
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function emptyMatrix(error: string | null, source: string | null): CapabilityMatrix {
  return {
    present: false,
    source,
    schemaVersion: null,
    agents: [],
    invariants: 0,
    rows: 0,
    gaps: 0,
    gapRows: [],
    truncated: false,
    invalid: 0,
    error,
  };
}

/**
 * Parse one matrix file's text. Tolerant by design: a malformed row is counted
 * (`invalid`) and dropped, a malformed document is an `error` — never a throw.
 */
export function parseCapabilityMatrix(text: string, source: string | null): CapabilityMatrix {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (err) {
    return emptyMatrix(`invalid JSON: ${err instanceof Error ? err.message : String(err)}`, source);
  }
  if (!isObject(parsed)) return emptyMatrix("matrix is not a JSON object", source);
  const schemaVersion =
    typeof parsed["schemaVersion"] === "number" ? parsed["schemaVersion"] : null;
  if (schemaVersion !== MATRIX_SCHEMA_VERSION) {
    return emptyMatrix(
      `unsupported matrix schemaVersion ${schemaVersion === null ? "missing" : schemaVersion} ` +
        `(expected ${MATRIX_SCHEMA_VERSION})`,
      source,
    );
  }

  const agents: string[] = [];
  const declared = parsed["agents"];
  if (Array.isArray(declared)) {
    for (const entry of declared) {
      const id = isObject(entry) ? str(entry["id"]) : str(entry);
      if (id !== null && !agents.includes(id)) agents.push(id);
      if (agents.length >= MAX_MATRIX_AGENTS) break;
    }
  }

  let invariants = 0;
  const declaredInvariants = parsed["invariants"];
  if (Array.isArray(declaredInvariants)) {
    for (const entry of declaredInvariants) {
      if (isObject(entry) && str(entry["id"]) !== null) invariants++;
    }
  }

  const declaredRows = parsed["rows"];
  if (!Array.isArray(declaredRows)) return emptyMatrix("matrix rows must be an array", source);

  let rows = 0;
  let invalid = 0;
  let gaps = 0;
  const gapRows: MatrixGapRow[] = [];
  let truncated = false;
  for (const entry of declaredRows) {
    if (!isObject(entry)) {
      invalid++;
      continue;
    }
    const invariant = str(entry["invariant"]);
    const agent = str(entry["agent"]);
    const mechanism = str(entry["mechanism"]);
    const pkg = str(entry["package"]);
    const gap = entry["gap"];
    const note = str(entry["note"]);
    if (invariant === null || agent === null || mechanism === null || pkg === null) {
      invalid++;
      continue;
    }
    if (typeof gap !== "boolean") {
      invalid++;
      continue;
    }
    // A gap row without a note is the one shape the schema test exists to
    // forbid in the committed file; here it is counted, not repaired.
    if (gap && note === null) {
      invalid++;
      continue;
    }
    rows++;
    if (!gap) continue;
    gaps++;
    if (gapRows.length < MAX_MATRIX_GAP_ROWS) {
      gapRows.push({ invariant, agent, mechanism, package: pkg, note: note as string });
    } else {
      truncated = true;
    }
  }

  return {
    present: true,
    source,
    schemaVersion,
    agents: agents.sort(),
    invariants,
    rows,
    gaps,
    gapRows,
    truncated,
    invalid,
    error: null,
  };
}

/** Options for {@link readCapabilityMatrix} (test seam; not part of the JSON payload). */
export type ReadCapabilityMatrixOptions = {
  /**
   * Tree root to probe for `<root>/adapters/capability-matrix.json`. Defaults
   * to the installed package root (the shipped matrix); doctor passes the tree
   * root (or the cwd on a non-initialized tree).
   */
  root?: string | null;
};

/**
 * Read the capability matrix: the tree's own committed copy first, then the
 * installed package's. Pure read, never throws, size-capped before the content
 * is loaded.
 */
export function readCapabilityMatrix(opts: ReadCapabilityMatrixOptions = {}): CapabilityMatrix {
  const treeRoot = opts.root ?? null;
  if (treeRoot !== null) {
    const abs = join(treeRoot, ...MATRIX_PATH.split("/"));
    const state = readMatrixFile(abs, MATRIX_PATH);
    if (state !== null) return state;
  }
  // Tree copy absent (or not a tree): the shipped matrix from the package.
  return (
    readMatrixFile(join(packageRoot(), ...MATRIX_PATH.split("/")), MATRIX_PATH) ??
    emptyMatrix(`not found (expected ${MATRIX_PATH} in the tree or the installed package)`, null)
  );
}

/** Read + parse one candidate path; null when absent/unreadable/oversized. */
function readMatrixFile(absPath: string, source: string): CapabilityMatrix | null {
  let size: number;
  try {
    const stat = statSync(absPath);
    if (!stat.isFile()) return null;
    size = stat.size;
  } catch {
    return null;
  }
  if (size > MAX_MATRIX_BYTES) {
    return emptyMatrix(`matrix file is ${size} B, over the ${MAX_MATRIX_BYTES} B ceiling`, source);
  }
  let text: string;
  try {
    text = readFileSync(absPath, "utf8");
  } catch (err) {
    return emptyMatrix(`unreadable: ${err instanceof Error ? err.message : String(err)}`, source);
  }
  return parseCapabilityMatrix(text, source);
}

/**
 * Bounded human lines for the matrix block. Untrusted values (a hand-edited
 * tree copy) are display-sanitized and capped exactly like every other doctor
 * value; the `--json` payload keeps them raw. Report-only wording is explicit:
 * a gap row is never presented as a failure.
 */
export function formatMatrixLines(matrix: CapabilityMatrix): string[] {
  if (!matrix.present) {
    const why = matrix.error === null ? `not found (expected ${MATRIX_PATH})` : matrix.error;
    return [`  matrix: ${sanitizeHumanText(why)} — report-only, never blocking`];
  }
  const source = sanitizeHumanText(matrix.source ?? MATRIX_PATH);
  const lines = [
    `  matrix: ${source} — ${matrix.invariants} invariant(s) x ${matrix.agents.length} agent(s) ` +
      `= ${matrix.rows} row(s), ${matrix.gaps} gap(s) (report-only, never blocking)`,
  ];
  for (const gap of matrix.gapRows) {
    lines.push(
      `  gap: ${sanitizeHumanText(gap.invariant)} x ${sanitizeHumanText(gap.agent)} — ` +
        `${sanitizeHumanText(gap.note)}`,
    );
  }
  if (matrix.truncated) {
    lines.push(
      `  note: ${matrix.gaps - matrix.gapRows.length} further gap row(s) not listed ` +
        `(cap ${MAX_MATRIX_GAP_ROWS}) — open ${matrix.source ?? MATRIX_PATH} for the rest`,
    );
  }
  if (matrix.invalid > 0) {
    lines.push(
      `  note: ${matrix.invalid} matrix row(s) did not match the schema and were not counted — ` +
        "report-only, nothing was repaired",
    );
  }
  return lines;
}
