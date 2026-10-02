/**
 * Capability matrix: schema contract + doctor report (task-capability-matrix,
 * spec-methodology-adapters-017 §S3, plan T3, ADR 0020).
 *
 * Three gates travel with the data:
 *   1. the COMMITTED `adapters/capability-matrix.json` matches its schema —
 *      one row per invariant × agent, no rule logic in the file, bounded size;
 *   2. its invariants MIRROR the carriers' `- **Invariants:**` header block,
 *      so the matrix cannot drift away from the methodology it declares;
 *   3. every gap row carries a non-empty note — a gap nobody explains is the
 *      failure mode the whole surface exists to prevent.
 *
 * Plus the reader's own robustness (never throws, drops malformed rows, caps
 * the gap list) and the doctor surface that prints it — bounded, sanitized and
 * report-only (a gap row is never a failure).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatMatrixLines,
  MATRIX_PATH,
  MATRIX_SCHEMA_VERSION,
  MAX_MATRIX_BYTES,
  MAX_MATRIX_GAP_ROWS,
  parseCapabilityMatrix,
  readCapabilityMatrix,
} from "./capability-matrix.js";
import { formatDoctorReport, runDoctor } from "./doctor.js";
import { packageRoot } from "./package-assets.js";
import { runCli } from "./test-spawn.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const matrixAbs = join(packageRoot(), ...MATRIX_PATH.split("/"));

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-matrix-"));
  tmpDirs.push(dir);
  return dir;
}

type Row = {
  invariant: string;
  agent: string;
  mechanism: string;
  package: string;
  gap: boolean;
  note: string | null;
};

function committed(): {
  schemaVersion: number;
  invariants: Array<{ id: string; statement: string }>;
  agents: Array<{ id: string }>;
  rows: Row[];
  raw: string;
} {
  const raw = readFileSync(matrixAbs, "utf8");
  const parsed = JSON.parse(raw) as {
    schemaVersion: number;
    invariants: Array<{ id: string; statement: string }>;
    agents: Array<{ id: string }>;
    rows: Row[];
  };
  return { ...parsed, raw };
}

/** Minimal single-row matrix, for the reader tests. */
function fixture(rows: unknown[], agents: unknown[] = [{ id: "claude" }]): string {
  return JSON.stringify({
    schemaVersion: MATRIX_SCHEMA_VERSION,
    invariants: rows.map((_, i) => ({ id: `i-${i}`, statement: "s" })),
    agents,
    rows,
  });
}

describe("capability matrix: committed file matches its schema", () => {
  it("declares the schema version the reader understands", () => {
    expect(committed().schemaVersion).toBe(MATRIX_SCHEMA_VERSION);
  });

  it("has exactly one row per invariant x agent, with no duplicates and no strays", () => {
    const { invariants, agents, rows } = committed();
    const keys = rows.map((row) => `${row.invariant}/${row.agent}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const invariant of invariants) {
      for (const agent of agents) {
        expect(keys).toContain(`${invariant.id}/${agent.id}`);
      }
    }
    expect(rows).toHaveLength(invariants.length * agents.length);
    for (const row of rows) {
      expect(invariants.map((i) => i.id)).toContain(row.invariant);
      expect(agents.map((a) => a.id)).toContain(row.agent);
    }
  });

  it("names the three supported agents (opencode, zcode, claude)", () => {
    expect(
      committed()
        .agents.map((a) => a.id)
        .sort(),
    ).toEqual(["claude", "opencode", "zcode"]);
  });

  it("carries a mechanism, a package and a gap flag on every row", () => {
    for (const row of committed().rows) {
      expect(row.mechanism.trim().length).toBeGreaterThan(0);
      expect(row.package.trim().length).toBeGreaterThan(0);
      expect(typeof row.gap).toBe("boolean");
      // No rule logic in a data file: a mechanism DECLARES a native feature
      // (client-namespaced, or the docs + CLI floor), it does not restate a
      // rule the kernel already owns.
      expect(row.mechanism.length).toBeLessThanOrEqual(400);
      expect(row.mechanism).toMatch(/^(opencode|zcode|claude|docs \+ CLI floor):/);
    }
  });

  it("carries a non-empty note on EVERY gap row (the gate the surface exists for)", () => {
    const rows = committed().rows;
    const gaps = rows.filter((row) => row.gap);
    expect(gaps.length).toBeGreaterThan(0);
    for (const row of gaps) {
      expect(typeof row.note, `gap row ${row.invariant}/${row.agent} has no note`).toBe("string");
      expect((row.note ?? "").trim().length).toBeGreaterThan(0);
      expect((row.note ?? "").length).toBeLessThanOrEqual(400);
    }
    // A non-gap row declares `note: null` — no orphan notes to keep in sync.
    for (const row of rows.filter((r) => !r.gap)) {
      expect(row.note).toBeNull();
    }
  });

  it("reports the gaps that are real: no shipped Claude Code adapter yet", () => {
    const rows = committed().rows;
    // ADR 0020: Claude Code "remains docs + CLAUDE.md" until the S6 follow-on
    // story lands, so every claude row is a gap and says what enforces it
    // meanwhile. A gap row for a shipped seam would be stale data, and this
    // report is only as trustworthy as its honesty.
    expect(rows.filter((row) => row.agent === "claude").every((row) => row.gap)).toBe(true);
    expect(rows.filter((row) => row.agent !== "claude").some((row) => row.gap)).toBe(false);
    expect(
      rows.filter((row) => row.package === "none").every((row) => row.agent === "claude"),
    ).toBe(true);
  });

  it("stays a bounded data file", () => {
    expect(Buffer.byteLength(committed().raw, "utf8")).toBeLessThanOrEqual(MAX_MATRIX_BYTES);
  });

  it("mirrors the carriers' Invariants header block (no methodology drift)", () => {
    const statements = committed().invariants.map((i) => i.statement);
    for (const carrier of [
      "ArggonManager/docs/agents.md",
      "ArggonManager/docs/engineering.md",
      "ArggonManager/docs/convention.md",
    ]) {
      const doc = readFileSync(join(repoRoot, carrier), "utf8");
      // The carriers quote the header block, so the bullet arrives as `> - **Invariants:** ...`.
      const line = /^> ?- \*\*Invariants:\*\* (.+)$/m.exec(doc)?.[1];
      expect(line, `${carrier} has no Invariants header block`).toBeDefined();
      const clauses = (line as string)
        .split(";")
        .map((clause) => clause.trim())
        .filter(Boolean);
      expect(clauses, `${carrier} invariants drifted from the matrix`).toEqual(statements);
    }
  });

  it("parses through the reader with nothing dropped", () => {
    const parsed = parseCapabilityMatrix(committed().raw, MATRIX_PATH);
    expect(parsed.present).toBe(true);
    expect(parsed.invalid).toBe(0);
    expect(parsed.error).toBeNull();
    expect(parsed.rows).toBe(committed().rows.length);
    expect(parsed.gaps).toBe(committed().rows.filter((row) => row.gap).length);
    expect(parsed.truncated).toBe(false);
  });
});

describe("capability matrix: reader posture (report-only, bounded, never throws)", () => {
  it("reads the tree copy ahead of the installed package copy", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "adapters"), { recursive: true });
    writeFileSync(
      join(dir, MATRIX_PATH),
      fixture([
        {
          invariant: "i-0",
          agent: "opencode",
          mechanism: "opencode:x",
          package: "opencode",
          gap: false,
          note: null,
        },
      ]),
      "utf8",
    );
    const matrix = readCapabilityMatrix({ root: dir });
    expect(matrix.present).toBe(true);
    expect(matrix.source).toBe(MATRIX_PATH);
    expect(matrix.rows).toBe(1);
    // No tree copy: the reader falls back to the installed package's copy (in
    // this repo that is the same committed file; in an adopter tree it is the
    // one a release ships - `adapters/` joins the pack allowlist with the
    // release, since `files` is a shipping field, ADR 0018).
    expect(readCapabilityMatrix({ root: tempDir() }).present).toBe(true);
  });

  it("reports a corrupt tree copy instead of silently falling back", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "adapters"), { recursive: true });
    writeFileSync(join(dir, MATRIX_PATH), "{not json", "utf8");
    const matrix = readCapabilityMatrix({ root: dir });
    expect(matrix.present).toBe(false);
    expect(matrix.error).toMatch(/invalid JSON/);
    expect(matrix.source).toBe(MATRIX_PATH);
  });

  it("counts a gap row without a note as invalid instead of reporting it", () => {
    const matrix = parseCapabilityMatrix(
      fixture([
        {
          invariant: "i-0",
          agent: "claude",
          mechanism: "docs + CLI floor: x",
          package: "none",
          gap: true,
        },
        {
          invariant: "i-1",
          agent: "claude",
          mechanism: "docs + CLI floor: y",
          package: "none",
          gap: true,
          note: "explained",
        },
        "not-a-row",
        { invariant: "i-2", agent: "claude", mechanism: "docs + CLI floor: z", package: "none" },
      ]),
      "fixture",
    );
    // gap-without-note, the non-object row, and the row with no `gap` flag.
    expect(matrix.invalid).toBe(3);
    expect(matrix.rows).toBe(1);
    expect(matrix.gaps).toBe(1);
  });

  it("caps the gap list while the count stays honest", () => {
    const rows = Array.from({ length: MAX_MATRIX_GAP_ROWS + 3 }, (_, i) => ({
      invariant: `i-${i}`,
      agent: "claude",
      mechanism: "docs + CLI floor: x",
      package: "none",
      gap: true,
      note: `note ${i}`,
    }));
    const matrix = parseCapabilityMatrix(fixture(rows), "fixture");
    expect(matrix.gapRows).toHaveLength(MAX_MATRIX_GAP_ROWS);
    expect(matrix.gaps).toBe(MAX_MATRIX_GAP_ROWS + 3);
    expect(matrix.truncated).toBe(true);
    const lines = formatMatrixLines(matrix);
    expect(lines.filter((line) => line.startsWith("  gap:"))).toHaveLength(MAX_MATRIX_GAP_ROWS);
    expect(lines.at(-1)).toContain("further gap row(s) not listed");
  });

  it("refuses an unsupported schema version, a non-object and missing rows", () => {
    expect(parseCapabilityMatrix('{"schemaVersion": 99}', "fixture").error).toMatch(
      /unsupported matrix schemaVersion 99/,
    );
    expect(parseCapabilityMatrix("[]", "fixture").error).toMatch(/not a JSON object/);
    expect(parseCapabilityMatrix('{"schemaVersion": 1}', "fixture").error).toMatch(
      /rows must be an array/,
    );
  });

  it("prints a report-only line when no matrix can be read", () => {
    const lines = formatMatrixLines(parseCapabilityMatrix("[]", "fixture"));
    expect(lines[0]).toContain("matrix: ");
    expect(lines[0]).toContain("report-only, never blocking");
  });
});

describe("doctor: matrix block is bounded and report-only", () => {
  it("exposes the matrix on an initialized report and in --json", () => {
    const result = runDoctor({ cwd: repoRoot });
    expect(result.matrix.present).toBe(true);
    expect(result.matrix.source).toBe(MATRIX_PATH);
    expect(result.matrix.gaps).toBeGreaterThan(0);
    expect(result.matrix.gapRows).toHaveLength(result.matrix.gaps);

    const report = formatDoctorReport(result);
    expect(report).toContain("matrix: adapters/capability-matrix.json");
    expect(report).toContain("gap(s) (report-only, never blocking)");
    for (const gap of result.matrix.gapRows) {
      expect(report).toContain(`gap: ${gap.invariant} x ${gap.agent} — `);
    }

    const proc = runCli(["doctor", "--json"], repoRoot);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { ok: boolean; matrix: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(body.matrix["present"]).toBe(true);
    expect(Array.isArray(body.matrix["gapRows"])).toBe(true);
  });

  it("never blocks on a gap: doctor and validate both still exit 0", () => {
    expect(runDoctor({ cwd: repoRoot }).matrix.gaps).toBeGreaterThan(0);
    // The gates that DO gate (validate, pre-commit, CI) are untouched by the
    // matrix: gap rows are advisory, never a transition or a CI failure.
    expect(runCli(["doctor", "--json"], repoRoot).status).toBe(0);
    expect(runCli(["validate", "--json"], repoRoot).status).toBe(0);
  });

  it("reports the shipped matrix on a non-initialized tree too", () => {
    const result = runDoctor({ cwd: tempDir() });
    expect(result.initialized).toBe(false);
    expect(result.matrix.present).toBe(true);
    expect(formatDoctorReport(result)).toContain("matrix:");
  });

  it("renders a hostile matrix note inert on the human line; JSON keeps it raw (F3)", () => {
    const ESC = "\u001b";
    const C1 = "\u0085";
    const LS = "\u2028";
    const PS = "\u2029";
    const hostile = `boom\nspoof: fake gap${ESC}[31m${C1}${LS}${PS}`;
    const matrix = parseCapabilityMatrix(
      fixture([
        {
          invariant: "i-0",
          agent: "claude",
          mechanism: "docs + CLI floor: x",
          package: "none",
          gap: true,
          note: hostile,
        },
      ]),
      "fixture",
    );
    const report = [...formatMatrixLines(matrix), "  doc: trailing"].join("\n");
    expect(report).not.toContain(ESC);
    expect(report).not.toContain(C1);
    expect(report).not.toContain(LS);
    expect(report).not.toContain(PS);
    expect(report).not.toContain("\nspoof");
    expect(report).toContain("boom\\nspoof");
    expect(report.split("\n").filter((line) => line.startsWith("  gap:"))).toHaveLength(1);
    expect(matrix.gapRows[0]?.note).toBe(hostile);
  });
});
