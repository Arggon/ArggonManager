import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync as _mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  readConventionConfig,
  updateGeneratedSection,
  type GeneratedEntry,
} from "./convention.js";
import { runDoctor, formatDoctorReport } from "./doctor.js";
import { runAdoptAck } from "./adopt.js";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";

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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(repoRoot, "cli/src/cli.ts");
const tsx = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "arggon-doctor-"));
}

describe("doctor: non-initialized repos", () => {
  it("reports initialized: false with zeroed counts and no crash", () => {
    const dir = tempDir();
    const result = runDoctor({ cwd: dir });
    expect(result.initialized).toBe(false);
    expect(result.root).toBeNull();
    expect(result.conventionVersion).toBe(0);
    expect(result.docs).toEqual({ managed: 0, untouched: 0, modified: 0, acknowledged: 0, acknowledgedDrifted: 0, stale: 0, missing: 0 });
    expect(result.tracker).toEqual({ items: 0, todo: 0 });
    expect(formatDoctorReport(result)).toContain("not initialized");
  });

  it("works via the CLI with --json on a non-initialized dir (exit 0)", () => {
    const dir = tempDir();
    const proc = runCli(["doctor", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      command: string;
      initialized: boolean;
      docs: Record<string, number>;
      tracker: Record<string, number>;
    };
    expect(body.ok).toBe(true);
    expect(body.command).toBe("doctor");
    expect(body.initialized).toBe(false);
    expect(body.docs.managed).toBe(0);
    expect(body.tracker.items).toBe(0);
  });
});

describe("doctor: initialized repos (task-doctor-command)", () => {
  it("counts managed/untouched docs from x-generated after a fresh init", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const result = runDoctor({ cwd: dir });
    expect(result.initialized).toBe(true);
    expect(result.root).toBe(dir);
    expect(result.conventionVersion).toBe(3);
    expect(result.docs).toEqual({ managed: 17, untouched: 17, modified: 0, acknowledged: 0, acknowledgedDrifted: 0, stale: 0, missing: 0 });
    expect(result.tracker).toEqual({ items: 0, todo: 0 });
  });

  it("counts an adopter-edited doc as modified", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    writeFileSync(join(dir, "AGENTS.md"), "MY EDIT\n", "utf8");
    const result = runDoctor({ cwd: dir });
    expect(result.docs.modified).toBe(1);
    expect(result.docs.untouched).toBe(16);
    expect(result.docs.managed).toBe(17);
    expect(formatDoctorReport(result)).toContain("1 modified");
    expect(formatDoctorReport(result)).toContain("--backup");
  });

  it("counts a backed-up-and-regenerated doc as untouched again", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    writeFileSync(join(dir, "AGENTS.md"), "MY EDIT\n", "utf8");
    runInit({ dir, force: false, full: true, backup: true });
    expect(existsSync(join(dir, "backup"))).toBe(true);
    const result = runDoctor({ cwd: dir });
    expect(result.docs).toEqual({ managed: 17, untouched: 17, modified: 0, acknowledged: 0, acknowledgedDrifted: 0, stale: 0, missing: 0 });
  });

  it("counts a deleted managed doc as missing", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    unlinkSync(join(dir, "SUPPORT.md"));
    const result = runDoctor({ cwd: dir });
    expect(result.docs.missing).toBe(1);
    expect(result.docs.untouched).toBe(16);
  });

  it("counts state entries whose template no longer exists as stale", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const yml = join(dir, "tasks/.convention.yml");
    const stale: GeneratedEntry = {
      template: "docs/gone.md",
      checksum: "sha256:deadbeef",
      arggonVersion: "0.0.0",
      generatedAt: "2026-09-12T00:00:00.000Z",
    };
    writeFileSync(
      yml,
      updateGeneratedSection(readFileSync(yml, "utf8"), {
        ...readConventionConfig(dir).generated,
        "docs/legacy.md": stale,
      }),
      "utf8",
    );
    // The orphaned file still exists on disk — only its template is gone.
    writeFileSync(join(dir, "docs/legacy.md"), "old generated content\n", "utf8");
    const result = runDoctor({ cwd: dir });
    expect(result.docs.managed).toBe(18);
    expect(result.docs.stale).toBe(1);
    expect(result.docs.untouched).toBe(17);
  });

  it("counts acked docs in the acknowledged bucket (sanctioned-diverged, not modified)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    writeFileSync(join(dir, "AGENTS.md"), "SWEEP: sanctioned content\n", "utf8");
    writeFileSync(join(dir, "CONTRIBUTING.md"), "SWEEP: setup\n", "utf8");
    expect(runDoctor({ cwd: dir }).docs.modified).toBe(2);
    runAdoptAck({ cwd: dir });
    const result = runDoctor({ cwd: dir });
    expect(result.docs).toEqual({
      managed: 17,
      untouched: 0,
      modified: 0,
      acknowledged: 17,
      acknowledgedDrifted: 0,
      stale: 0,
      missing: 0,
    });
    const report = formatDoctorReport(result);
    expect(report).toContain("17 acknowledged");
    expect(report).toContain("0 modified");
  });

  it("reports hand edits after ack in the informational acknowledgedDrifted bucket (bug-ack-drift-promise)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    runAdoptAck({ cwd: dir });
    writeFileSync(join(dir, "AGENTS.md"), "LATE HAND EDIT\n", "utf8");
    const result = runDoctor({ cwd: dir });
    expect(result.docs).toEqual({
      managed: 17,
      untouched: 0,
      modified: 0,
      acknowledged: 16,
      acknowledgedDrifted: 1,
      stale: 0,
      missing: 0,
    });
    const report = formatDoctorReport(result);
    expect(report).toContain("1 acknowledgedDrifted");
    expect(report).toContain("drifted from the acked baseline");
  });

  it("reports tracker counts via loadItems", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    runCreate({ cwd: dir, type: "initiative", title: "Doctor check" });
    const result = runDoctor({ cwd: dir });
    expect(result.tracker.items).toBe(1);
    expect(result.tracker.todo).toBe(1);
  });

  it("exposes the initialized payload via the CLI --json (exit 0, report-only)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    writeFileSync(join(dir, "CONTRIBUTING.md"), "ADOPTER EDIT\n", "utf8");
    const proc = runCli(["doctor", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      schemaVersion: number;
      conventionVersion: number;
      command: string;
      initialized: boolean;
      root: string;
      docs: { managed: number; untouched: number; modified: number; stale: number; missing: number };
      tracker: { items: number; todo: number };
    };
    expect(body.ok).toBe(true);
    expect(body.schemaVersion).toBe(1);
    expect(body.conventionVersion).toBe(3);
    expect(body.command).toBe("doctor");
    expect(body.initialized).toBe(true);
    expect(body.root).toBe(dir);
    expect(body.docs).toEqual({ managed: 17, untouched: 16, modified: 1, acknowledged: 0, acknowledgedDrifted: 0, stale: 0, missing: 0 });
    expect(body.tracker).toEqual({ items: 0, todo: 0 });
  });

  it("never writes anything (report-only)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const before = readFileSync(join(dir, "tasks/.convention.yml"), "utf8");
    runDoctor({ cwd: dir });
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toBe(before);
  });
});
