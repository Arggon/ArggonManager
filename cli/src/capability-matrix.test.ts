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
import { MAX_HUMAN_VALUE_CHARS } from "@arggondev/lib";
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
      // The human renderer clips every value at MAX_HUMAN_VALUE_CHARS before
      // escaping, so a longer note would reach `doctor` as a silently truncated
      // line — a lie in a data file. The bound IS the renderer's cap, not a
      // round number that drifts from it.
      expect(
        (row.note ?? "").length,
        `gap row ${row.invariant}/${row.agent} is clipped when rendered`,
      ).toBeLessThanOrEqual(MAX_HUMAN_VALUE_CHARS);
    }
    // A non-gap row declares `note: null` — no orphan notes to keep in sync.
    for (const row of rows.filter((r) => !r.gap)) {
      expect(row.note).toBeNull();
    }
  });

  it("credits the surfaces an init'd tree actually gives Claude Code", () => {
    const claude = committed().rows.filter((row) => row.agent === "claude");
    const byInvariant = new Map(claude.map((row) => [row.invariant, row]));
    // `.mcp.json` is an init-generated destination (DOC_PATH_MAP["mcp-json"],
    // cli/src/docs.ts) that docs/agents.md says exists to "serve other clients
    // (e.g. Claude Code)", and it registers the same `arggon mcp` server the
    // zcode bundle registers in its manifest. So the invariants that surface
    // delivers are NOT gaps here — claiming they were (round-1 F1) overstated
    // the missing coverage.
    for (const invariant of ["same-rules", "state-in-git", "claim-integrity"]) {
      const row = byInvariant.get(invariant);
      expect(row, `claude row for ${invariant} disappeared`).toBeDefined();
      expect(row?.gap, `${invariant} is delivered through .mcp-json -> arggon mcp`).toBe(false);
      expect(row?.mechanism).toContain("arggon mcp");
      expect(row?.package).toBe("claude-code");
    }
    // What Claude Code genuinely lacks is client-native and agent-scoped: a
    // hook gate and a session context hook. No `.claude/` config or hook
    // template ships anywhere in `templates/`, so these stay gaps.
    for (const invariant of ["discipline-enforceable", "docs-travel-with-code"]) {
      expect(byInvariant.get(invariant)?.gap, `${invariant} has no client-native mechanism`).toBe(
        true,
      );
    }
  });

  it("never claims a gap on a surface `arggon init` ships to every client", () => {
    // The false-absence lint (round-1 F1): a gap note must name something the
    // agent's CLIENT cannot do, never a surface every tree already has. A note
    // that says the `arggon mcp` server / the generated playbook / the skill /
    // the pre-commit gate is missing is factually wrong — init writes all of
    // them into every scaffolded tree — and it is indistinguishable from a real
    // gap once it is printed.
    const shippedToEveryTree = [
      "arggon mcp",
      "arggon-cli",
      ".mcp.json",
      "AGENTS.md",
      "CLAUDE.md",
      "pre-commit",
    ];
    // Only the GAP CLAUSE is linted: a note's job is to name what the client
    // cannot do, and everything after a contrastive connective ("..., so the
    // kernel, pre-commit and CI carry it alone") is the enforcement story, not
    // a claim of absence. Linting the whole note would flag the honest
    // "what still enforces it" half as a false absence.
    const gapClause = (note: string): string =>
      note.split(/,?\s+(?:so|therefore|meanwhile|but)\s+/)[0] ?? note;
    for (const row of committed().rows.filter((r) => r.gap)) {
      const head = gapClause(row.note ?? "");
      for (const surface of shippedToEveryTree) {
        const claimedMissing = new RegExp(`no [^.:;]*\\b${surface}`, "i").test(head);
        expect(
          claimedMissing,
          `gap note ${row.invariant}/${row.agent} claims "${surface}" is missing, but init ships it to every tree`,
        ).toBe(false);
      }
    }
  });

  it("makes every gap about a client-native capability, not the shared floor", () => {
    // The converse guard, so a gap cannot be reworded into vagueness: a gap
    // must name what the CLIENT cannot do — a hook gate, a permission DSL, a
    // session context hook, or a bundled agent/command/skill set.
    const clientNative = ["hook", "permission", "session context", "bundle"];
    for (const row of committed().rows.filter((r) => r.gap)) {
      const note = (row.note ?? "").toLowerCase();
      expect(
        clientNative.some((capability) => note.includes(capability)),
        `gap note ${row.invariant}/${row.agent} names no client-native capability`,
      ).toBe(true);
    }
  });

  it("gives every non-gap row a client-scoped mechanism (no floor-only 'not a gap')", () => {
    // The converse of the lint above: a non-gap row must name the client seam
    // that delivers the invariant. A row that only says "docs + CLI floor"
    // while claiming `gap: false` is the shape that hides a gap.
    for (const row of committed().rows.filter((r) => !r.gap)) {
      expect(
        row.mechanism,
        `${row.invariant}/${row.agent} claims delivery without naming a client mechanism`,
      ).toMatch(/^(opencode|zcode|claude):/);
      expect(row.package).toBe(row.agent === "claude" ? "claude-code" : row.agent);
    }
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
  it("reads the matrix the examined tree commits", () => {
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
    // A tree with no matrix is a normal report, NOT a package fallback: the
    // block must depend only on the examined tree, or `doctor --json` would
    // differ between the packed bin and the checkout CLI on the same tree
    // (headless-ci.test.ts pins those envelopes byte-identical).
    const absent = readCapabilityMatrix({ root: tempDir() });
    expect(absent.present).toBe(false);
    expect(absent.source).toBeNull();
    expect(absent.error).toMatch(
      /not found \(expected adapters\/capability-matrix.json in this tree\)/,
    );
  });

  it("reports a corrupt tree copy instead of hiding it", () => {
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

  it("reports the matrix block on a non-initialized tree, absent there", () => {
    const result = runDoctor({ cwd: tempDir() });
    expect(result.initialized).toBe(false);
    expect(result.matrix.present).toBe(false);
    // Still a report line, still exit 0: a tree without a matrix is a normal
    // state, not a doctor failure.
    const report = formatDoctorReport(result);
    expect(report).toContain("matrix: ");
    expect(report).toContain("report-only, never blocking");
  });

  it("keeps the block byte-identical between a packed bin and the checkout CLI", () => {
    // The regression this pins: with a package-root fallback the block reported
    // the repo's own matrix to the checkout CLI and nothing to the packed bin on
    // the SAME adopter tree, which broke the headless pack-parity gate. Reading
    // the tree only makes the two agree by construction (headless-ci.test.ts is
    // the end-to-end proof; this is the unit-level pin).
    const dir = tempDir();
    const fromThisTree = runDoctor({ cwd: dir }).matrix;
    expect(fromThisTree.present).toBe(false);
    expect(readCapabilityMatrix({ root: dir })).toEqual(fromThisTree);
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
