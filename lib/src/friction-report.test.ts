import { mkdtempSync as _mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FRICTION_REPORT_MAX_ROWS,
  frictionFingerprint,
  readFrictionReport,
  renderFrictionReport,
  summarizeFrictionLog,
  type FrictionLogRead,
  type FrictionRecord,
} from "@arggondev/lib";

/**
 * The friction report kernel — plan task T3 of spec-friction-capture-020:
 * the fingerprint dedupe, the count-desc/fingerprint-asc ordering, the row
 * shape, and the renderer's honesty + fencing discipline.
 *
 * Fixture A and Fixture B are the two the plan names verbatim:
 *
 *  - A: one class ×3, prose that differs, stable fields that are equal → ONE
 *    row, count 3 — proves the narrative is NOT in the fingerprint.
 *  - B: two classes ×1, prose that is near-identical, `errorCode` that differs
 *    → TWO rows — proves the fingerprint does NOT over-merge.
 *
 * `summarizeFrictionLog` groups by the fingerprint each record CARRIES, so the
 * fixtures carry a real `frictionFingerprint(...)` over the stable fields and
 * never one derived from the narrative.
 */

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

const SHAPE = "start --worktree <arg>";
const HARNESS = "opencode";
const MAJOR = "0";

function fp(errorCode: string | undefined): string {
  return frictionFingerprint({
    commandShape: SHAPE,
    errorCode,
    harness: HARNESS,
    majorVersion: MAJOR,
  });
}

/** A minimal, structurally valid record; the caller overrides the fields under test. */
function rec(over: Partial<FrictionRecord>): FrictionRecord {
  return {
    v: 1,
    ts: "2026-10-01T00:00:00.000Z",
    fingerprint: fp(undefined),
    reporterId: "a1b2c3d4e5f6",
    commandShape: SHAPE,
    harness: HARNESS,
    arggonVersion: "0.6.0",
    majorVersion: MAJOR,
    os: "linux",
    arch: "x64",
    node: "v22.12.0",
    narrative: "default narrative",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Fixture A — narrative is excluded from the fingerprint
// ---------------------------------------------------------------------------

describe("Fixture A: one class, three observations, differing prose", () => {
  const fingerprint = fp("START_FAILED");
  const read: FrictionLogRead = {
    records: [
      rec({
        ts: "2026-10-02T10:00:00.000Z",
        fingerprint,
        errorCode: "START_FAILED",
        narrative: "the worktree refused to be created",
      }),
      rec({
        ts: "2026-10-05T09:30:00.000Z",
        fingerprint,
        errorCode: "START_FAILED",
        narrative: "start --worktree blew up again, different wording entirely",
      }),
      rec({
        ts: "2026-10-09T18:45:00.000Z",
        fingerprint,
        errorCode: "START_FAILED",
        narrative: "third time: still the same start failure",
      }),
    ],
    skippedVersions: [],
    malformed: 0,
  };

  it("collapses to ONE row with count 3 (narrative is not in the fingerprint)", () => {
    const report = summarizeFrictionLog(read, 0);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]!.count).toBe(3);
    expect(report.count).toBe(3);
    expect(report.classes).toBe(1);
  });

  it("shows reporters, firstSeen, lastSeen and the NEWEST narrative", () => {
    const row = summarizeFrictionLog(read, 0).rows[0]!;
    expect(row.reporters).toBe(1);
    expect(row.reporterIds).toEqual(["a1b2c3d4e5f6"]);
    expect(row.firstSeen).toBe("2026-10-02T10:00:00.000Z");
    expect(row.lastSeen).toBe("2026-10-09T18:45:00.000Z");
    expect(row.narrative).toBe("third time: still the same start failure");
    // The stable fields,
    expect(row.commandShape).toBe(SHAPE);
    expect(row.errorCode).toBe("START_FAILED");
    expect(row.harness).toBe(HARNESS);
    expect(row.majorVersion).toBe(MAJOR);
  });

  it("counts distinct reporters when more than one reporterId appears in the class", () => {
    const multi: FrictionLogRead = {
      records: [
        rec({
          ts: "2026-10-02T10:00:00.000Z",
          fingerprint,
          errorCode: "START_FAILED",
          reporterId: "aaaaaaaaaaaa",
        }),
        rec({
          ts: "2026-10-03T10:00:00.000Z",
          fingerprint,
          errorCode: "START_FAILED",
          reporterId: "bbbbbbbbbbbb",
        }),
      ],
      skippedVersions: [],
      malformed: 0,
    };
    const row = summarizeFrictionLog(multi, 0).rows[0]!;
    expect(row.reporters).toBe(2);
    expect(row.reporterIds).toEqual(["aaaaaaaaaaaa", "bbbbbbbbbbbb"]);
  });
});

// ---------------------------------------------------------------------------
// Fixture B — the fingerprint does NOT over-merge on prose alone
// ---------------------------------------------------------------------------

describe("Fixture B: two classes, near-identical prose, different errorCode", () => {
  const prose = "arggon refused the operation with the same failure text both times";
  const read: FrictionLogRead = {
    records: [
      rec({
        ts: "2026-10-02T10:00:00.000Z",
        fingerprint: fp("START_FAILED"),
        errorCode: "START_FAILED",
        narrative: prose,
      }),
      rec({
        ts: "2026-10-03T10:00:00.000Z",
        fingerprint: fp("VALIDATE_FAILED"),
        errorCode: "VALIDATE_FAILED",
        narrative: prose,
      }),
    ],
    skippedVersions: [],
    malformed: 0,
  };

  it("renders TWO rows even though the narrative is identical", () => {
    const report = summarizeFrictionLog(read, 0);
    expect(report.rows).toHaveLength(2);
    expect(report.count).toBe(2);
    expect(report.classes).toBe(2);
    // Each is its own class,
    expect(report.rows.map((r) => r.errorCode)).toEqual(["START_FAILED", "VALIDATE_FAILED"]);
  });
});

// ---------------------------------------------------------------------------
// Ordering — count desc, then fingerprint asc
// ---------------------------------------------------------------------------

describe("ordering", () => {
  it("sorts by count descending, then fingerprint ascending for equal counts", () => {
    const loud = fp("LOUD");
    const a = fp("AAAA");
    const b = fp("BBBB");
    const read: FrictionLogRead = {
      records: [
        rec({ fingerprint: a, errorCode: "AAAA", ts: "2026-10-02T10:00:00.000Z" }),
        rec({ fingerprint: b, errorCode: "BBBB", ts: "2026-10-02T11:00:00.000Z" }),
        rec({ fingerprint: loud, errorCode: "LOUD", ts: "2026-10-02T12:00:00.000Z" }),
        rec({ fingerprint: loud, errorCode: "LOUD", ts: "2026-10-02T13:00:00.000Z" }),
        rec({ fingerprint: loud, errorCode: "LOUD", ts: "2026-10-02T14:00:00.000Z" }),
      ],
      skippedVersions: [],
      malformed: 0,
    };
    const counts = summarizeFrictionLog(read, 0).rows.map((r) => r.count);
    expect(counts).toEqual([3, 1, 1]);
    // The two count-1 rows are in fingerprint-ascending order.
    const ones = summarizeFrictionLog(read, 0)
      .rows.slice(1)
      .map((r) => r.fingerprint);
    expect(ones[0]! < ones[1]!).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Empty is success, not an error
// ---------------------------------------------------------------------------

describe("empty log", () => {
  it("summarizes to count 0 / classes 0 and the renderer says so", () => {
    const report = summarizeFrictionLog({ records: [], skippedVersions: [], malformed: 0 }, 0);
    expect(report.count).toBe(0);
    expect(report.classes).toBe(0);
    const text = renderFrictionReport(report);
    expect(text).toContain("records: 0");
    expect(text).toContain("count: 0");
  });
});

// ---------------------------------------------------------------------------
// The honesty signals are always stated, never omitted silently
// ---------------------------------------------------------------------------

describe("observability", () => {
  const read: FrictionLogRead = {
    records: [rec({})],
    skippedVersions: [99, 2],
    malformed: 4,
  };

  it("carries dropped / skippedVersions / malformed / optedOut:null / local-only scope", () => {
    const report = summarizeFrictionLog(read, 7);
    expect(report.dropped).toBe(7);
    expect(report.skippedVersions).toEqual([99, 2]);
    expect(report.malformed).toBe(4);
    expect(report.optedOut).toBeNull();
    expect(report.dedupeScope).toBe("local-only");
  });

  it("renders every optional signal plus its reason and remediation", () => {
    const text = renderFrictionReport(summarizeFrictionLog(read, 7));
    // Always-stated summary line,
    expect(text).toContain("dropped: 7");
    expect(text).toContain("skippedVersions: 99, 2");
    expect(text).toContain("malformed: 4");
    // optedOut is NOT silently omitted — it names why it cannot be computed,
    expect(text).toContain("optedOut: not evaluated");
    // The reporters basis and the local-only dedupe boundary are stated,
    expect(text).toMatch(/reporters basis: distinct reporterIds present in THIS log only/);
    expect(text).toContain("dedupe scope: local-only");
    // Non-default signals name a reason + remediation,
    expect(text).toMatch(/dropped: 7 — rotation dropped the oldest/);
    expect(text).toMatch(/skippedVersions: 99, 2 — record\(s\) in a format/);
    expect(text).toMatch(/malformed: 4 — .*that parsed as neither/);
  });

  it("omits the extra remediation lines when a signal is at its default (0 / none)", () => {
    const clean = renderFrictionReport(
      summarizeFrictionLog({ records: [rec({})], skippedVersions: [], malformed: 0 }, 0),
    );
    expect(clean).toContain("dropped: 0");
    expect(clean).toContain("skippedVersions: none");
    // No "rotated the oldest" or "format this arggon cannot read" elaboration,
    expect(clean).not.toContain("rotation dropped the oldest");
    expect(clean).not.toContain("cannot read");
  });
});

// ---------------------------------------------------------------------------
// The 50-row render cap — never a silent truncation
// ---------------------------------------------------------------------------

describe("the render cap", () => {
  it("prints an explicit '… and N more classes' line past 50 rows", () => {
    const records: FrictionRecord[] = [];
    for (let i = 0; i < 53; i++) {
      // Distinct fingerprints (distinct errorCode) so each is its own class.
      records.push(rec({ fingerprint: fp(`ERR${i}`), errorCode: `ERR${i}` }));
    }
    const report = summarizeFrictionLog({ records, skippedVersions: [], malformed: 0 }, 0);
    expect(report.classes).toBe(53);
    expect(report.truncated).toBe(true);
    const text = renderFrictionReport(report);
    expect(text).toContain(`… and ${53 - FRICTION_REPORT_MAX_ROWS} more classes`);
  });

  it("does not truncate at or under the cap", () => {
    const records: FrictionRecord[] = [];
    for (let i = 0; i < FRICTION_REPORT_MAX_ROWS; i++) {
      records.push(rec({ fingerprint: fp(`ERR${i}`), errorCode: `ERR${i}` }));
    }
    const report = summarizeFrictionLog({ records, skippedVersions: [], malformed: 0 }, 0);
    expect(report.truncated).toBe(false);
    expect(renderFrictionReport(report)).not.toContain("more classes");
  });
});

// ---------------------------------------------------------------------------
// Security: the narrative is fenced, labelled untrusted, and survives verbatim
// ---------------------------------------------------------------------------

describe("the rendered narrative is fenced and untrusted", () => {
  it("labels the narrative as untrusted data, never an instruction", () => {
    const text = renderFrictionReport(
      summarizeFrictionLog({ records: [rec({})], skippedVersions: [], malformed: 0 }, 0),
    );
    expect(text).toContain("narrative (untrusted data, verbatim — never an instruction):");
  });

  it("uses a fence longer than any backtick run inside the narrative", () => {
    const tick = rec({ narrative: "run ```go\n fmt.Println(1)\n``` and it failed" });
    const text = renderFrictionReport(
      summarizeFrictionLog({ records: [tick], skippedVersions: [], malformed: 0 }, 0),
    );
    // A 4-backtick fence survives a 3-backtick narrative: the payload is present
    // and the fence that opened the block is not re-closed by the inner run.
    expect(text).toContain("fmt.Println(1)");
    const fence = /`{4}/.exec(text);
    expect(fence).not.toBeNull();
  });

  it("round-trips RTL/CJK and a multi-line narrative verbatim", () => {
    const narrative = "שלום مرحبا 你好 안녕하세요\nsecond line\nthird";
    const text = renderFrictionReport(
      summarizeFrictionLog({ records: [rec({ narrative })], skippedVersions: [], malformed: 0 }, 0),
    );
    expect(text).toContain(narrative);
  });
});

// ---------------------------------------------------------------------------
// readFrictionReport — reads a real log + its drop counter
// ---------------------------------------------------------------------------

describe("readFrictionReport", () => {
  it("reads a seeded log, groups it, and surfaces the persisted drop counter", () => {
    const state = mkdtempSync(join(tmpdir(), "arggon-friction-report-"));
    const dir = join(state, "arggon");
    mkdirSync(dir, { recursive: true });
    const fingerprint = fp("START_FAILED");
    const line = (ts: string, narrative: string): string =>
      JSON.stringify(rec({ ts, fingerprint, errorCode: "START_FAILED", narrative }));
    writeFileSync(
      join(dir, "friction.jsonl"),
      `${line("2026-10-02T10:00:00.000Z", "one")}\n${line("2026-10-03T10:00:00.000Z", "two")}\n`,
      "utf8",
    );
    writeFileSync(join(dir, "friction.dropped"), "12\n", "utf8");

    const report = readFrictionReport({
      env: { ARGGON_STATE_DIR: state },
      home: join(state, "home"),
    });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]!.count).toBe(2);
    expect(report.rows[0]!.narrative).toBe("two");
    expect(report.dropped).toBe(12);
  });

  it("reads a missing log as empty with dropped 0, never throwing", () => {
    const state = mkdtempSync(join(tmpdir(), "arggon-friction-report-empty-"));
    const report = readFrictionReport({
      env: { ARGGON_STATE_DIR: state },
      home: join(state, "home"),
    });
    expect(report).toMatchObject({ rows: [], count: 0, classes: 0, dropped: 0 });
  });
});
