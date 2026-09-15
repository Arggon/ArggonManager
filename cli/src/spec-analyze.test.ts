import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runSpecAnalyze } from "./spec.js";

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
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const repoRoot = process.cwd();

/** Temp repo skeleton: only what findTasksDir needs (tasks/.convention.yml). */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-spec-analyze-"));
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
  return dir;
}

function writeSpec(dir: string, name: string, frontmatter: Record<string, string>, body: string): void {
  const dirPath = join(dir, "docs", "specs");
  mkdirSync(dirPath, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  writeFileSync(join(dirPath, name), `---\n${fm}\n---\n\n${body}`, "utf8");
}

function writePlan(dir: string, name: string, frontmatter: Record<string, string>): void {
  const dirPath = join(dir, "docs", "plans");
  mkdirSync(dirPath, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  writeFileSync(join(dirPath, name), `---\n${fm}\n---\n\n# Plan: t\n\n## Tasks\n`, "utf8");
}

const fm = (overrides: Record<string, string> = {}): Record<string, string> => ({
  spec_id: "analyzed-001",
  title: "Analyzed",
  status: "proposed",
  created: "2026-09-15",
  ...overrides,
});

const CLEAN_BODY =
  "# Spec: t (analyzed-001)\n\n## Purpose\n\nWhy it exists.\n\n" +
  "## Synopsis\n\n```bash\narggon x\n```\n\nOn error the command exits 1.\n\n" +
  "## Acceptance\n\n- [x] works\n";

const AMBIGUOUS_BODY =
  "# Spec: t (analyzed-001)\n\n## Purpose\n\nThis must be fast and scalable for several users.\n\n" +
  "## Synopsis\n\nTODO: fill in.\n\n" +
  "## Acceptance\n\nIt should work well.\n";

describe("spec analyze: ambiguity scan", () => {
  it("hits every checklist kind on a crafted ambiguous fixture", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-vague-001.md", fm({ spec_id: "vague-001" }), AMBIGUOUS_BODY);
    const result = runSpecAnalyze({ cwd: dir });
    const kinds = result.ambiguity.map((f) => f.kind).sort();
    expect(kinds).toEqual(["no-error-path", "todo-marker", "untestable-acceptance", "vague-quantifier"]);
    const vague = result.ambiguity.find((f) => f.kind === "vague-quantifier");
    expect(vague?.severity).toBe("warn");
    const fileLine = readFileSync(join(dir, "docs", "specs", "spec-vague-001.md"), "utf8")
      .split(/\r?\n/)
      .findIndex((l) => /\bfast\b/i.test(l)) + 1;
    expect(vague?.line).toBe(fileLine); // frontmatter offset applied
    expect(vague?.message).toContain("fast");
  });

  it("scans a complete, concrete spec clean", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-clean-001.md", fm({ spec_id: "clean-001" }), CLEAN_BODY);
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.ambiguity).toEqual([]);
    expect(result.consistency).toEqual([]);
    expect(result.scanned).toBe(1);
  });

  it("reports a missing Acceptance section with no-acceptance", () => {
    const dir = makeRepo();
    writeSpec(
      dir,
      "spec-noacc-001.md",
      fm({ spec_id: "noacc-001" }),
      "# Spec: t\n\n## Purpose\n\nwhy\n\n## Synopsis\n\nOn failure: exit 1.\n",
    );
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.ambiguity.map((f) => f.kind)).toContain("no-acceptance");
  });

  it("accepts Spanish section names (Aceptación) for the acceptance checks", () => {
    const dir = makeRepo();
    writeSpec(
      dir,
      "spec-es-001.md",
      fm({ spec_id: "es-001" }),
      "# Spec: t\n\n## Propósito\n\npor qué\n\n## Sinopsis\n\nEn caso de error, exit 1.\n\n## Aceptación\n\n- [ ] ok\n",
    );
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.ambiguity).toEqual([]);
  });

  it("scans a single file with --spec and skips the consistency pass", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-single-001.md", fm({ spec_id: "single-001" }), AMBIGUOUS_BODY);
    const result = runSpecAnalyze({ cwd: dir, spec: join(dir, "docs", "specs", "spec-single-001.md") });
    expect(result.scanned).toBe(1);
    expect(result.ambiguity.length).toBeGreaterThan(0);
    expect(result.consistency).toEqual([]);
  });

  it("throws (SPEC_FAILED in the CLI) on an unreadable file", () => {
    const dir = makeRepo();
    expect(() => runSpecAnalyze({ cwd: dir, spec: join(dir, "missing.md") })).toThrow(/cannot read/);
  });

  it("never writes: the scanned file is byte-identical after the run", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-frozen-001.md", fm({ spec_id: "frozen-001" }), AMBIGUOUS_BODY);
    const path = join(dir, "docs", "specs", "spec-frozen-001.md");
    const before = readFileSync(path, "utf8");
    runSpecAnalyze({ cwd: dir });
    expect(readFileSync(path, "utf8")).toBe(before);
  });
});

describe("spec analyze: consistency", () => {
  it("reports an implemented spec that no task cites and no plan references", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-orphan-001.md", fm({ spec_id: "orphan-001", status: "implemented" }), CLEAN_BODY);
    writeSpec(dir, "spec-cited-001.md", fm({ spec_id: "cited-001", status: "implemented" }), CLEAN_BODY);
    writeSpec(dir, "spec-planned-001.md", fm({ spec_id: "planned-001", status: "implemented" }), CLEAN_BODY);
    writePlan(dir, "plan-ok-001.md", {
      plan_id: "ok-001",
      title: "Ok",
      spec: "docs/specs/spec-planned-001.md",
      status: "implemented",
      created: "2026-09-15",
    });
    // a task body citing cited-001
    const storyDir = join(dir, "tasks", "some-story");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(join(storyDir, "task-x.md"), "Implements spec-cited-001 fully.\n", "utf8");

    const result = runSpecAnalyze({ cwd: dir });
    const orphaned = result.consistency.filter((f) => f.kind === "spec-orphaned");
    expect(orphaned.length).toBe(1);
    expect(orphaned[0]!.file).toContain("spec-orphan-001.md");
    expect(orphaned[0]!.message).toContain("orphan-001");
  });

  it("proposed specs are never reported as orphaned", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-fresh-001.md", fm({ spec_id: "fresh-001", status: "proposed" }), CLEAN_BODY);
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.consistency).toEqual([]);
  });

  it("reports a plan whose spec: frontmatter points at a missing file", () => {
    const dir = makeRepo();
    writePlan(dir, "plan-broken-001.md", {
      plan_id: "broken-001",
      title: "Broken",
      spec: "docs/specs/spec-missing-001.md",
      status: "proposed",
      created: "2026-09-15",
    });
    const result = runSpecAnalyze({ cwd: dir });
    const hit = result.consistency.find((f) => f.kind === "plan-spec-missing");
    expect(hit).toBeDefined();
    expect(hit!.file).toContain("plan-broken-001.md");
    expect(hit!.message).toContain("spec-missing-001.md");
  });

  it("passes clean on this repo's real corpus (finding counts are informational)", () => {
    const result = runSpecAnalyze({ cwd: repoRoot });
    expect(result.scanned).toBeGreaterThanOrEqual(4);
    expect(result.consistency.every((f) => f.severity === "warn" || f.severity === "info")).toBe(true);
  });
});

describe("spec analyze: CLI contract", () => {
  it("--json emits the v1 envelope with findings arrays and exits 0 despite findings", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-vague-001.md", fm({ spec_id: "vague-001" }), AMBIGUOUS_BODY);
    const run = runCli(["spec", "analyze", "--json"], dir);
    expect(run.status).toBe(0);
    const payload = JSON.parse(run.stdout) as {
      ok: boolean;
      schemaVersion: number;
      conventionVersion: number;
      command: string;
      scanned: number;
      findings: { ambiguity: unknown[]; consistency: unknown[] };
    };
    expect(payload.ok).toBe(true);
    expect(payload.command).toBe("spec");
    expect(payload.scanned).toBe(1);
    expect(payload.findings.ambiguity.length).toBeGreaterThan(0);
    const first = payload.findings.ambiguity[0] as Record<string, unknown>;
    expect(first).toMatchObject({ file: "docs/specs/spec-vague-001.md", severity: "warn" });
    expect(first).toHaveProperty("kind");
    expect(first).toHaveProperty("message");
  });

  it("exits 1 with SPEC_FAILED on an unreadable file (--json)", () => {
    const dir = makeRepo();
    const run = runCli(["spec", "analyze", "--json", "--spec", join(dir, "missing.md")], dir);
    expect(run.status).toBe(1);
    const payload = JSON.parse(run.stdout) as { ok: boolean; error?: { code?: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("SPEC_FAILED");
  });

  it("human output is a report and exits 0 even with findings", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-vague-001.md", fm({ spec_id: "vague-001" }), AMBIGUOUS_BODY);
    const run = runCli(["spec", "analyze"], dir);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("[vague-quantifier]");
    expect(run.stdout).toContain("report only, nothing was edited");
  });
});
