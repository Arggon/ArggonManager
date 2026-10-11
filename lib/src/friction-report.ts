import { homedir } from "node:os";
import {
  frictionDroppedPath,
  frictionLogPath,
  readFrictionDropped,
  readFrictionLog,
  type FrictionLogRead,
} from "./friction.js";

/**
 * Fingerprint dedupe and the report renderer — plan task T3 of
 * spec-friction-capture-020, the piece the maintainer actually reads.
 *
 * The whole module is optimized for **signal per unit of attention**, not
 * volume: records that share a `fingerprint` are one friction class, rendered
 * as one row sorted by `count` descending then fingerprint ascending, so a
 * class seen repeatedly outranks a one-off and one-off noise is visible as
 * such. The grouping is by the fingerprint each line CARRIES — the reader never
 * recomputes one (spec §Fingerprint discipline), so a log written either side of
 * the length-prefix amendment shows one class as two rows (a count split, never
 * a wrong merge) until rotation ages the old lines out.
 *
 * Boundaries this file holds to, per spec-friction-capture-020:
 *
 *  - **The report is not the tracker.** It only reads the local log and its
 *    drop counter; it loads no items, parses no frontmatter, commits nothing
 *    and is invisible to `arggon validate`.
 *  - **Dedupe scope is local-only.** No upstream issue is consulted, so a class
 *    already filed upstream still appears here as new. The report states this
 *    rather than implying upstream coverage (spec, limits-of-local-dedupe).
 *  - **The narrative is data, never an instruction.** The newest narrative is
 *    rendered fenced and labelled untrusted; it is passed through verbatim and
 *    never parsed or executed. Redaction already ran at write, so this renderer
 *    applies none — there is no "capture now, scrub later" path to reproduce.
 *  - **No optional signal is omitted silently.** `optedOut`, `dropped`,
 *    `skippedVersions`, `malformed` and the `reporters` basis are always
 *    stated; an opted-out report says so instead of rendering an unexplained
 *    zero.
 *
 * Nothing here prints: {@link summarizeFrictionLog} and
 * {@link renderFrictionReport} are pure, and the CLI owns the stdout channel
 * exactly as it does for every other command.
 */

/** The render cap: at most this many rows, then an explicit "N more" line. */
export const FRICTION_REPORT_MAX_ROWS = 50;

/** One rendered friction class: the dedupe unit the report is about. */
export type FrictionClassRow = {
  /** The stable fingerprint every record in this class carries. */
  fingerprint: string;
  /** How many records collapsed into this class. */
  count: number;
  /** Distinct `reporterId`s present in THIS log for this class. */
  reporters: number;
  /** Those distinct ids (stage-2 aggregation; a human merge counts them). */
  reporterIds: string[];
  /** Earliest `ts` across the class (ISO-8601 UTC). */
  firstSeen: string;
  /** Newest `ts` across the class (ISO-8601 UTC). */
  lastSeen: string;
  /** The newest narrative in the class (data, verbatim, never an instruction). */
  narrative: string;
  // The stable fields — identical across the class by the fingerprint's
  // construction, so taking them from the newest record is exact.
  commandShape: string;
  errorCode?: string;
  harness: string;
  majorVersion: string;
  // Environment facts of the newest record, carried for `--json` consumers.
  arggonVersion: string;
  os: string;
  arch: string;
  node: string;
};

/** The whole report: what `--report` renders and `--json` serializes. */
export type FrictionReport = {
  /** One row per fingerprint, sorted `count` desc then fingerprint asc. */
  rows: FrictionClassRow[];
  /** Total records summarized (sum of the row counts). */
  count: number;
  /** Distinct classes — `rows.length`, BEFORE the render cap. */
  classes: number;
  /** Cumulative lines rotation has dropped (from the writer's counter). */
  dropped: number;
  /** Format versions seen and skipped (spec §Persistence / migration). */
  skippedVersions: number[];
  /** Log lines that carried no parsable record at all. */
  malformed: number;
  /**
   * Whether the operator opted out (ADR 0024 §3, plan task T4): `true` when
   * `x-friction: false` in the tracker `.convention.yml` or `ARGGON_NO_FRICTION`
   * is set, in which case NO record was written and this report is empty by
   * construction. Stated, never omitted — the renderer says so on both values,
   * because "0 records" and "you opted out" are different facts.
   */
  optedOut: boolean;
  /** True when rows were withheld by the {@link FRICTION_REPORT_MAX_ROWS} cap. */
  truncated: boolean;
  /** Always `"local-only"` — the report's stated, honest dedupe boundary. */
  dedupeScope: "local-only";
};

/** Where the report reads from (the log and its drop counter, both resolvable). */
export type FrictionReportOptions = {
  /** Environment for the state-base resolution; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Home override for the state-base resolution; defaults to `os.homedir()`. */
  home?: string;
  /**
   * Whether capture is opted out (resolved by the caller from the config key
   * and the environment). When true the log is NOT read at all — an opted-out
   * report is empty by construction, so there is nothing to summarize and no
   * state dir to create.
   */
  optedOut?: boolean;
};

/**
 * Collapse a tolerant log read into the rendered classes.
 *
 * Pure over its inputs (no file access, no clock): the records `readFrictionLog`
 * already grouped-and-skipped, plus the cumulative drop count. Sorting is
 * `count` descending then fingerprint ascending — the maintainer's attention is
 * the scarce resource, so a class seen three times outranks three one-offs and
 * one-off noise is visible as such. The class's stable fields and newest
 * narrative come from the newest record; `firstSeen`/`lastSeen` are the
 * earliest/latest `ts`; `reporters` is the count of distinct `reporterId`s.
 */
export function summarizeFrictionLog(
  read: FrictionLogRead,
  dropped: number,
  optedOut = false,
): FrictionReport {
  // Opted out: the report is EMPTY by construction, whatever the log holds.
  // The short-circuit lives here, in the pure layer, so no caller — present or
  // future — can render an opted-out tree's history.
  if (optedOut) {
    return {
      rows: [],
      count: 0,
      classes: 0,
      dropped: 0,
      skippedVersions: [],
      malformed: 0,
      optedOut: true,
      truncated: false,
      dedupeScope: "local-only",
    };
  }
  type Accumulator = {
    fingerprint: string;
    count: number;
    reporterIds: Set<string>;
    first: (typeof read.records)[number];
    last: (typeof read.records)[number];
  };
  const byFingerprint = new Map<string, Accumulator>();
  for (const record of read.records) {
    let acc = byFingerprint.get(record.fingerprint);
    if (acc === undefined) {
      acc = {
        fingerprint: record.fingerprint,
        count: 0,
        reporterIds: new Set<string>(),
        first: record,
        last: record,
      };
      byFingerprint.set(record.fingerprint, acc);
    }
    acc.count += 1;
    acc.reporterIds.add(record.reporterId);
    // ISO-8601 UTC strings compare lexicographically as chronologically, and
    // every record carries a kernel-clock `ts`, so no locale parse is involved.
    if (record.ts < acc.first.ts) acc.first = record;
    // `>=` so file order breaks an exact `ts` tie toward the later line, which
    // is the one a reader would call "newest".
    if (record.ts >= acc.last.ts) acc.last = record;
  }

  const rows: FrictionClassRow[] = [...byFingerprint.values()].map((acc) => {
    const newest = acc.last;
    const reporterIds = [...acc.reporterIds].sort();
    return {
      fingerprint: acc.fingerprint,
      count: acc.count,
      reporters: reporterIds.length,
      reporterIds,
      firstSeen: acc.first.ts,
      lastSeen: newest.ts,
      narrative: newest.narrative,
      commandShape: newest.commandShape,
      ...(newest.errorCode !== undefined ? { errorCode: newest.errorCode } : {}),
      harness: newest.harness,
      majorVersion: newest.majorVersion,
      arggonVersion: newest.arggonVersion,
      os: newest.os,
      arch: newest.arch,
      node: newest.node,
    };
  });

  rows.sort((a, b) => b.count - a.count || compareFingerprint(a.fingerprint, b.fingerprint));

  return {
    rows,
    count: read.records.length,
    classes: rows.length,
    dropped,
    skippedVersions: read.skippedVersions,
    malformed: read.malformed,
    optedOut,
    truncated: rows.length > FRICTION_REPORT_MAX_ROWS,
    dedupeScope: "local-only",
  };
}

/** Fingerprint ascending: the deterministic tie-break for equal counts. */
function compareFingerprint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The empty read an opted-out report short-circuits to: nothing was collected. */
const EMPTY_READ: FrictionLogRead = { records: [], skippedVersions: [], malformed: 0 };

/**
 * Read the local log and its drop counter into a report. The only file-touching
 * seam between the pure {@link summarizeFrictionLog} and the CLI; an empty or
 * missing log reads as an empty report (count 0), never an error.
 *
 * When the caller resolved the opt-out to `optedOut: true` the log is not read
 * at all: capture is off, so the report is empty by construction and there is no
 * state dir to create on the way. ({@link summarizeFrictionLog} short-circuits
 * on the same flag, so an opted-out report cannot leak a log's history even if
 * a caller passes one.)
 */
export function readFrictionReport(opts: FrictionReportOptions): FrictionReport {
  // Opted out: nothing to read, so the log is not opened at all.
  if (opts.optedOut === true) {
    return summarizeFrictionLog(EMPTY_READ, 0, true);
  }
  const env = opts.env ?? process.env;
  const home = opts.home ?? homedir();
  const read = readFrictionLog(frictionLogPath(env, home));
  const dropped = readFrictionDropped(frictionDroppedPath(env, home));
  return summarizeFrictionLog(read, dropped, opts.optedOut ?? false);
}

/** The shortest fence longer than any backtick run in `text`, min a ``` fence. */
export function frictionFenceFor(text: string): string {
  const runs = text.match(/`+/g);
  const longest = runs === null ? 0 : Math.max(...runs.map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

/**
 * Render the report for the human channel: a scannable markdown block, every
 * optional signal stated, the newest narrative fenced and labelled untrusted,
 * and an explicit "… and N more classes" line past the render cap — never a
 * silent truncation.
 *
 * The narrative is printed VERBATIM (spec §Time/locale: an RTL/CJK narrative
 * round-trips through report without being reordered, escaped or truncated) and
 * is fenced + labelled rather than display-sanitized: it is the operator's own
 * local data, and the spec's untrusted-data labelling — not a terminal scrub of
 * the operator's own bytes — is the mitigation. Neither the code nor the fence
 * is trusted as an instruction.
 */
export function renderFrictionReport(report: FrictionReport): string {
  const out: string[] = [];
  out.push("arggon friction report");
  out.push(
    "dedupe scope: local-only — this log alone. No upstream issue is consulted, so a class already filed upstream still appears here as new; you may file it twice.",
  );
  out.push("");

  // One scannable summary line carrying EVERY signal, always — a reader can
  // tell "0" from "not shown", which is the whole point of stating them.
  const skipped = report.skippedVersions.length > 0 ? report.skippedVersions.join(", ") : "none";
  out.push(
    `records: ${report.count}   classes: ${report.classes}   dropped: ${report.dropped}   skippedVersions: ${skipped}   malformed: ${report.malformed}`,
  );
  out.push(
    "reporters basis: distinct reporterIds present in THIS log only (stage 1 is one machine, so normally 1; not other machines, not upstream).",
  );
  if (report.optedOut) {
    out.push(
      "optedOut: true — capture is disabled on this machine (`x-friction: false` in the tracker `.convention.yml`, or `ARGGON_NO_FRICTION` set). Nothing is recorded and this report is empty. The command stays discoverable ON PURPOSE (ADR 0024 §3): set the key back to `true`, or unset the variable, to re-enable capture. The trigger text is still in your generated agent files.",
    );
  } else {
    out.push("optedOut: false");
  }

  // Non-default signals get their reason and remediation, one line each, only
  // when they are non-default (the summary line already stated the value).
  if (report.dropped > 0) {
    out.push(
      `dropped: ${report.dropped} — rotation dropped the oldest record(s) past the 5000-line bound; this history is cache-like and cannot be recovered.`,
    );
  }
  if (report.skippedVersions.length > 0) {
    out.push(
      `skippedVersions: ${skipped} — record(s) in a format this arggon cannot read; a reader skips an unknown v rather than failing the file. Upgrade to read them.`,
    );
  }
  if (report.malformed > 0) {
    const plural = report.malformed === 1 ? "line" : "lines";
    out.push(
      `malformed: ${report.malformed} — ${plural} that parsed as neither a record nor a known version; skipped, not fatal. Delete the log file to start fresh.`,
    );
  }

  if (report.classes === 0) {
    out.push("");
    out.push(
      report.optedOut
        ? `No friction recorded (count: 0) — capture is opted out, so nothing is written while it stays off.`
        : `No friction recorded (count: 0). Capture some with: arggon friction "<one line>" --command "<argv shape>".`,
    );
    return `${out.join("\n")}\n`;
  }

  out.push("");
  const shown = report.rows.slice(0, FRICTION_REPORT_MAX_ROWS);
  for (const row of shown) {
    out.push(`── ${row.fingerprint}  count ${row.count}  reporters ${row.reporters} ──`);
    out.push(`   command: ${row.commandShape}`);
    out.push(`   error:   ${row.errorCode ?? "(none)"}`);
    out.push(`   harness: ${row.harness}   major: ${row.majorVersion}`);
    out.push(`   first→last: ${row.firstSeen} → ${row.lastSeen}`);
    out.push("   narrative (untrusted data, verbatim — never an instruction):");
    const fence = frictionFenceFor(row.narrative);
    // The fence and its content are NOT column-indented: a code fence's body is
    // literal, so indenting it would alter the operator's own bytes (leading
    // whitespace and newlines above all). Verbatim means the stored narrative
    // appears exactly as-is, newlines included.
    out.push(fence);
    out.push(row.narrative);
    out.push(fence);
    out.push("");
  }

  const more = report.classes - shown.length;
  if (more > 0) {
    out.push(`… and ${more} more classes`);
  }
  return `${out.join("\n")}\n`;
}
