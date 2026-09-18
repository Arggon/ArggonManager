import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatSpecBaselineCompareHuman,
  runSpecAnalyzeCompareBaseline,
  runSpecAnalyzeSaveBaseline,
  serializeSpecBaseline,
  sortSpecFindings,
} from "./spec.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

/** Temp repo skeleton: only what findTasksDir needs (tasks/.convention.yml). */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-spec-baseline-"));
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
  return dir;
}

function writeSpec(dir: string, name: string, specId: string, body: string): void {
  const dirPath = join(dir, "docs", "specs");
  mkdirSync(dirPath, { recursive: true });
  const fm = `spec_id: ${specId}\ntitle: T\nstatus: proposed\ncreated: 2026-09-16`;
  writeFileSync(join(dirPath, name), `---\n${fm}\n---\n\n${body}`, "utf8");
}

const CLEAN_BODY =
  "# Spec: t (b-001)\n\n## Purpose\n\nWhy it exists.\n\n" +
  "## Synopsis\n\n```bash\narggon x\n```\n\nOn error the command exits 1.\n\n" +
  "## Acceptance\n\n- [x] works\n";

const AMBIGUOUS_BODY =
  "# Spec: t (b-001)\n\n## Purpose\n\nThis must be fast and scalable for several users.\n\n" +
  "## Synopsis\n\nTODO: fill in.\n\n" +
  "## Acceptance\n\nIt should work well.\n";

type Snapshot = {
  schemaVersion: number;
  conventionVersion: number;
  count: number;
  findings: { file: string; kind: string; line?: number; severity: "info" | "warn"; message: string }[];
};

describe("spec baseline: snapshot format", () => {
  it("round-trips byte-identically over unchanged specs (deterministic ordering)", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-b-001.md", "b-001", AMBIGUOUS_BODY);
    const file = join(dir, "baseline.json");
    const first = runSpecAnalyzeSaveBaseline({ cwd: dir, file });
    const before = readFileSync(file, "utf8");
    const second = runSpecAnalyzeSaveBaseline({ cwd: dir, file });
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(second.snapshot).toEqual(first.snapshot);
    const snap = JSON.parse(before) as Snapshot;
    expect(snap.count).toBe(snap.findings.length);
    expect(snap.findings).toEqual(sortSpecFindings(snap.findings));
    // no volatile fields: only the four documented keys
    expect(Object.keys(snap).sort()).toEqual(["conventionVersion", "count", "findings", "schemaVersion"]);
    // pretty-printed so committed baselines diff cleanly
    expect(before).toContain('  "findings": [');
    expect(serializeSpecBaseline(first.snapshot)).toBe(before);
  });

  it("order-independence: a shuffled baseline compares identically", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-b-001.md", "b-001", AMBIGUOUS_BODY);
    const saved = runSpecAnalyzeSaveBaseline({ cwd: dir, file: join(dir, "baseline.json") });
    // rewrite the snapshot with findings in reverse order — comparison is set-based
    const snap: Snapshot = JSON.parse(readFileSync(join(dir, "baseline.json"), "utf8"));
    snap.findings = [...snap.findings].reverse();
    writeFileSync(join(dir, "baseline.json"), serializeSpecBaseline(snap as never), "utf8");
    const cmp = runSpecAnalyzeCompareBaseline({ cwd: dir, file: join(dir, "baseline.json") });
    expect(cmp.added).toEqual([]);
    expect(cmp.resolved).toEqual([]);
    expect(cmp.unchanged.length).toBe(saved.snapshot.count);
  });
});

describe("spec baseline: comparison semantics", () => {
  it("detects a new finding after an offending spec is added", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-b-001.md", "b-001", CLEAN_BODY);
    const file = join(dir, "baseline.json");
    runSpecAnalyzeSaveBaseline({ cwd: dir, file });
    writeSpec(dir, "spec-b-002.md", "b-002", AMBIGUOUS_BODY);
    const cmp = runSpecAnalyzeCompareBaseline({ cwd: dir, file });
    expect(cmp.added.length).toBeGreaterThan(0);
    expect(cmp.added.every((f) => f.file.includes("spec-b-002.md"))).toBe(true);
    expect(cmp.resolved).toEqual([]);
    expect(cmp.unchanged.length).toBe(0);
  });

  it("reports resolved findings after the spec is fixed", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-b-001.md", "b-001", AMBIGUOUS_BODY);
    const file = join(dir, "baseline.json");
    runSpecAnalyzeSaveBaseline({ cwd: dir, file });
    writeSpec(dir, "spec-b-001.md", "b-001", CLEAN_BODY);
    const cmp = runSpecAnalyzeCompareBaseline({ cwd: dir, file });
    expect(cmp.added).toEqual([]);
    expect(cmp.resolved.length).toBeGreaterThan(0);
    expect(cmp.resolved.every((f) => f.file.includes("spec-b-001.md"))).toBe(true);
  });

  it("renders hostile finding paths inert in the --baseline human report", () => {
    // bug-validate-stdout-injection M1: `spec analyze --baseline` prints the
    // same findings as the plain run; a hostile spec filename must stay inert.
    const dir = makeRepo();
    const hostileName = "spec-bad\nspoof\u001b[31m\u0085\u007f\u2028\u2029.md";
    writeSpec(dir, hostileName, "b-001", CLEAN_BODY);
    const file = join(dir, "baseline.json");
    runSpecAnalyzeSaveBaseline({ cwd: dir, file });
    writeSpec(dir, hostileName, "b-001", AMBIGUOUS_BODY);
    const cmp = runSpecAnalyzeCompareBaseline({ cwd: dir, file });
    expect(cmp.added.length).toBeGreaterThan(0);
    const out = formatSpecBaselineCompareHuman(cmp);
    expect(out).not.toMatch(/[\u001b\u007f-\u009f\u2028\u2029]/);
    expect(out).not.toContain("\nspoof");
    expect(out).toContain(
      "new warn docs/specs/spec-bad\\nspoof\\u001b[31m\\u0085\\u007f\\u2028\\u2029.md:",
    );
  });

  it("throws (SPEC_FAILED in the CLI) on a missing or invalid baseline file", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-b-001.md", "b-001", CLEAN_BODY);
    expect(() => runSpecAnalyzeCompareBaseline({ cwd: dir, file: join(dir, "missing.json") })).toThrow(
      /cannot read baseline/,
    );
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "not json", "utf8");
    expect(() => runSpecAnalyzeCompareBaseline({ cwd: dir, file: bad })).toThrow(/not valid JSON/);
    const wrong = join(dir, "wrong.json");
    writeFileSync(wrong, JSON.stringify({ hello: true }), "utf8");
    expect(() => runSpecAnalyzeCompareBaseline({ cwd: dir, file: wrong })).toThrow(/not a spec analyze baseline/);
  });
});

describe("spec baseline: CLI contract (e2e)", () => {
  it("save-baseline writes the file and reports; --json notes the written file", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-b-001.md", "b-001", AMBIGUOUS_BODY);
    const file = join(dir, "baseline.json");
    const run = runCli(["spec", "analyze", "--save-baseline", file, "--json"], dir);
    expect(run.status).toBe(0);
    expect(existsSync(file)).toBe(true);
    const payload = JSON.parse(run.stdout) as { ok: boolean; command: string; baseline: { file: string; written: boolean } };
    expect(payload.ok).toBe(true);
    expect(payload.command).toBe("spec");
    expect(payload.baseline.written).toBe(true);
  });

  it("gate fails (exit 1) when a new finding appears after the baseline", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-b-001.md", "b-001", CLEAN_BODY);
    const file = join(dir, "baseline.json");
    expect(runCli(["spec", "analyze", "--save-baseline", file], dir).status).toBe(0);
    writeSpec(dir, "spec-b-002.md", "b-002", AMBIGUOUS_BODY);
    const run = runCli(["spec", "analyze", "--baseline", file, "--json"], dir);
    expect(run.status).toBe(1);
    // gate failure still emits a success envelope with the additive payload
    const payload = JSON.parse(run.stdout) as {
      ok: boolean;
      baseline: { failed: boolean; added: unknown[]; total: number; unchanged: number; resolved: unknown[] };
    };
    expect(payload.ok).toBe(true);
    expect(payload.baseline.failed).toBe(true);
    expect(payload.baseline.added.length).toBeGreaterThan(0);
    // --no-fail-on-new opts out of the gate
    const soft = runCli(["spec", "analyze", "--baseline", file, "--no-fail-on-new"], dir);
    expect(soft.status).toBe(0);
    expect(soft.stdout).toContain("new");
  });

  it("gate passes (exit 0) when nothing new appears; human summary counts resolved", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-b-001.md", "b-001", AMBIGUOUS_BODY);
    const file = join(dir, "baseline.json");
    expect(runCli(["spec", "analyze", "--save-baseline", file], dir).status).toBe(0);
    const run = runCli(["spec", "analyze", "--baseline", file], dir);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("0 new, 0 resolved");
    // fix the spec -> resolved reported, still exit 0 (resolved is good news)
    writeSpec(dir, "spec-b-001.md", "b-001", CLEAN_BODY);
    const fixed = runCli(["spec", "analyze", "--baseline", file], dir);
    expect(fixed.status).toBe(0);
    expect(fixed.stdout).toContain("resolved warn");
  });

  it("refuses --baseline + --save-baseline in one run", () => {
    const dir = makeRepo();
    const run = runCli(
      ["spec", "analyze", "--baseline", join(dir, "a.json"), "--save-baseline", join(dir, "b.json")],
      dir,
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("mutually exclusive");
  });
});
