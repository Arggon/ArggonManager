import { spawnSync, execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  readConventionConfig,
  updateGeneratedSection,
  type GeneratedEntry,
} from "./convention.js";
import { GENERATED_DOC_COUNT, OPENCODE_CONFIG_CANDIDATES } from "./docs.js";
import {
  formatDoctorReport,
  MAX_HUMAN_VALUE_CHARS,
  MAX_OPENCODE_NAMES,
  MAX_OPENCODE_V1_KEYS_PER_FILE,
  OPENCODE_MCP_HINT,
  runDoctor,
} from "./doctor.js";
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
    expect(result.docs).toEqual({ managed: 0, untouched: 0, modified: 0, acknowledged: 0, acknowledgedDrifted: 0, stale: 0, missing: 0, outdated: 0, outdatedDocs: [] });
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
    expect(result.conventionVersion).toBe(4);
    expect(result.docs).toEqual({ managed: GENERATED_DOC_COUNT, untouched: GENERATED_DOC_COUNT, modified: 0, acknowledged: 0, acknowledgedDrifted: 0, stale: 0, missing: 0, outdated: 0, outdatedDocs: [] });
    expect(result.tracker).toEqual({ items: 0, todo: 0 });
  });

  it("counts an adopter-edited doc as modified", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    writeFileSync(join(dir, "AGENTS.md"), "MY EDIT\n", "utf8");
    const result = runDoctor({ cwd: dir });
    expect(result.docs.modified).toBe(1);
    expect(result.docs.untouched).toBe(GENERATED_DOC_COUNT - 1);
    expect(result.docs.managed).toBe(GENERATED_DOC_COUNT);
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
    expect(result.docs).toEqual({ managed: GENERATED_DOC_COUNT, untouched: GENERATED_DOC_COUNT, modified: 0, acknowledged: 0, acknowledgedDrifted: 0, stale: 0, missing: 0, outdated: 0, outdatedDocs: [] });
  });

  it("counts a deleted managed doc as missing", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    unlinkSync(join(dir, "SUPPORT.md"));
    const result = runDoctor({ cwd: dir });
    expect(result.docs.missing).toBe(1);
    expect(result.docs.untouched).toBe(GENERATED_DOC_COUNT - 1);
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
    expect(result.docs.managed).toBe(GENERATED_DOC_COUNT + 1); // current + 1 stale legacy entry
    expect(result.docs.stale).toBe(1);
    expect(result.docs.untouched).toBe(GENERATED_DOC_COUNT);
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
      managed: GENERATED_DOC_COUNT,
      untouched: 0,
      modified: 0,
      acknowledged: GENERATED_DOC_COUNT,
      acknowledgedDrifted: 0,
      stale: 0,
      // The sweep edits differ from the CURRENT template render, so the two
      // sweep docs count as outdated too (task-doctor-outdated-bucket):
      // upstream moved regardless of the acked local state.
      outdated: 2,
      outdatedDocs: ["AGENTS.md", "CONTRIBUTING.md"],
      missing: 0,
    });
    const report = formatDoctorReport(result);
    expect(report).toContain(` acknowledged`);
    expect(report).toContain("0 modified");
  });

  it("reports hand edits after ack in the informational acknowledgedDrifted bucket (bug-ack-drift-promise)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    runAdoptAck({ cwd: dir });
    writeFileSync(join(dir, "AGENTS.md"), "LATE HAND EDIT\n", "utf8");
    const result = runDoctor({ cwd: dir });
    expect(result.docs).toEqual({
      managed: GENERATED_DOC_COUNT,
      untouched: 0,
      modified: 0,
      acknowledged: GENERATED_DOC_COUNT - 1,
      acknowledgedDrifted: 1,
      stale: 0,
      // The late hand edit also differs from the CURRENT template render
      // (task-doctor-outdated-bucket) — orthogonal to acknowledgedDrifted.
      outdated: 1,
      outdatedDocs: ["AGENTS.md"],
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

  it("renders a hostile root path inert on the human line; JSON keeps it raw (F2)", () => {
    // A directory name can legally carry ESC, newline, NEL (C1) and U+2028:
    // the report root is interpolated into the human header line.
    const dir = mkdtempSync(join(tmpdir(), "arggon-doctor-evil\u001b\nspoof\u0085\u2028-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 4\n", "utf8");
    const result = runDoctor({ cwd: dir });
    // JSON payload keeps the raw path.
    expect(result.root).toBe(dir);
    const report = formatDoctorReport(result);
    // Human output: the path renders escaped in place, one header line.
    expect(report).not.toContain("\u001b");
    expect(report).not.toContain("\nspoof");
    expect(report).not.toContain("\u0085");
    expect(report).not.toContain("\u2028");
    expect(report).toContain(`at ${join(tmpdir(), "arggon-doctor-evil\\u001b\\nspoof\\u0085\\u2028-")}`);
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
    expect(body.conventionVersion).toBe(4);
    expect(body.command).toBe("doctor");
    expect(body.initialized).toBe(true);
    expect(body.root).toBe(dir);
    expect(body.docs).toEqual({ managed: GENERATED_DOC_COUNT, untouched: GENERATED_DOC_COUNT - 1, modified: 1, acknowledged: 0, acknowledgedDrifted: 0, stale: 0, missing: 0, outdated: 1, outdatedDocs: ["CONTRIBUTING.md"] });
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

describe("doctor: git section (bug-init-git-doctor-blindspot)", () => {
  it("reports { isRepo: false, dirty: null, remote: null } on a non-git tree", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const result = runDoctor({ cwd: dir });
    expect(result.git).toEqual({ isRepo: false, dirty: null, remote: null });
    expect(formatDoctorReport(result)).toContain("not a git repository");
  });

  it("reports isRepo: true with dirty/remote fields on a git tree", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    // No remote configured, generated docs untracked → dirty, remote null.
    const result = runDoctor({ cwd: dir });
    expect(result.git.isRepo).toBe(true);
    expect(result.git.dirty).toBe(true);
    expect(result.git.remote).toBeNull();
    expect(formatDoctorReport(result)).toContain("repo, dirty, no remote");
  });

  it("reports the origin remote url when one is configured", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["remote", "add", "origin", "git@github.com:example/example.git"], { cwd: dir });
    const result = runDoctor({ cwd: dir });
    expect(result.git.remote).toBe("git@github.com:example/example.git");
  });

  it("renders a hostile remote URL as one inert human line; JSON keeps it raw (F2)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    // Review repro (bug-doctor-human-output-injection): a remote carrying a
    // newline fabricates a column-0 `spoof:` line and an ESC reaches the
    // terminal raw.
    const hostile = "https://example.com/evil\nspoof: fake hint.git\u001b[31m";
    execFileSync("git", ["remote", "add", "origin", hostile], { cwd: dir });
    const result = runDoctor({ cwd: dir });
    // JSON payload keeps the raw value, byte for byte.
    expect(result.git.remote).toBe(hostile);
    const report = formatDoctorReport(result);
    // Human output: no raw ESC, no fabricated line; the remote is escaped
    // in place on the single `git:` line (`\n`/`\u001b` as literal text).
    expect(report).not.toContain("\u001b");
    expect(report).not.toContain("\nspoof");
    expect(report).toContain(
      "git: repo, dirty, remote https://example.com/evil\\nspoof: fake hint.git\\u001b[31m",
    );
    expect(report.split("\n").filter((line) => line.startsWith("  git:"))).toHaveLength(1);
    // CLI --json round trip: the raw remote survives unchanged.
    const proc = runCli(["doctor", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { git: { remote: string } };
    expect(body.git.remote).toBe(hostile);
  });

  it("caps a long remote URL on the human line; JSON keeps it whole (F3, bounded length)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    const longRemote = `https://example.com/${"r".repeat(MAX_HUMAN_VALUE_CHARS * 3)}`;
    execFileSync("git", ["remote", "add", "origin", longRemote], { cwd: dir });
    const result = runDoctor({ cwd: dir });
    expect(result.git.remote).toBe(longRemote);
    const report = formatDoctorReport(result);
    expect(report).toContain(`remote ${longRemote.slice(0, MAX_HUMAN_VALUE_CHARS)}…`);
    expect(report).not.toContain(longRemote);
  });

  it("reports a clean tree as dirty: false after committing everything", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["add", "--", "."], { cwd: dir });
    execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"], { cwd: dir });
    const result = runDoctor({ cwd: dir });
    expect(result.git).toEqual({ isRepo: true, dirty: false, remote: null });
  });

  it("exposes the git section via the CLI --json on a non-git dir (exit 0)", () => {
    const dir = tempDir();
    const proc = runCli(["doctor", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      git: { isRepo: boolean; dirty: boolean | null; remote: string | null };
    };
    expect(body.ok).toBe(true);
    expect(body.git).toEqual({ isRepo: false, dirty: null, remote: null });
  });
});

describe("doctor: human output sanitization (F1/F3)", () => {
  it("renders an ordinary root and remote byte-identical (positive F3 case)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    const remote = "git@github.com:example/example.git";
    execFileSync("git", ["remote", "add", "origin", remote], { cwd: dir });
    const result = runDoctor({ cwd: dir });
    const report = formatDoctorReport(result);
    // Ordinary ASCII values pass through untouched: no escaping artifacts.
    expect(report).toContain(`at ${dir}`);
    expect(report).toContain(`remote ${remote}`);
    expect(report.split("\n").find((line) => line.startsWith("  git:"))).toBe(
      `  git: repo, dirty, remote ${remote}`,
    );
  });

  it("renders a hostile budgetError inert on the human line; JSON keeps it raw (F3)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const result = runDoctor({ cwd: dir });
    const hostile = "boom\nspoof: fake budget\u001b[31m\u0085\u007f\u2028\u2029";
    result.budgetError = hostile;
    const report = formatDoctorReport(result);
    expect(report).not.toContain("\u001b");
    expect(report).not.toContain("\nspoof");
    expect(report).not.toContain("\u0085");
    expect(report).not.toContain("\u007f");
    expect(report).not.toContain("\u2028");
    expect(report).not.toContain("\u2029");
    expect(report).toContain(
      "budget: measurement failed: boom\\nspoof: fake budget\\u001b[31m\\u0085\\u007f\\u2028\\u2029",
    );
    // --json envelope: the raw message survives byte for byte.
    expect(result.budgetError).toBe(hostile);
  });

  it("sanitizes a hostile item file name on the doctor stderr failure line; JSON error keeps it raw (F1, bug-cli-error-output-injection)", () => {
    // Review repro: an item file named `bad\nspoof: fake item<ESC>[31m.md`
    // with an unknown status makes runDoctor throw; the message embeds the
    // repo-controlled file path.
    const dir = tempDir();
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 4\n", "utf8");
    const hostileName = "bad\nspoof: fake item\u001b[31m\u0085\u007f\u2028\u2029.md";
    writeFileSync(
      join(dir, "tasks", hostileName),
      "---\ntype: task\nid: task-bad\nstatus: bogus\n---\nbody\n",
      "utf8",
    );
    const proc = runCli(["doctor"], dir);
    expect(proc.status).toBe(1);
    expect(proc.stdout).toBe("");
    // One inert line: no raw ESC/DEL/C1/LS/PS and no forged column-0 line.
    expect(proc.stderr).not.toContain("\u001b");
    expect(proc.stderr).not.toContain("\u0085");
    expect(proc.stderr).not.toContain("\u007f");
    expect(proc.stderr).not.toContain("\u2028");
    expect(proc.stderr).not.toContain("\u2029");
    expect(proc.stderr).not.toContain("\nspoof");
    expect(proc.stderr.split("\n").filter(Boolean)).toHaveLength(1);
    expect(proc.stderr).toContain(
      "bad\\nspoof: fake item\\u001b[31m\\u0085\\u007f\\u2028\\u2029.md: unknown status 'bogus'",
    );
    // --json error envelope: raw message, valid JSON, unchanged contract.
    const jproc = runCli(["doctor", "--json"], dir);
    expect(jproc.status).toBe(1);
    const body = JSON.parse(jproc.stdout) as {
      ok: boolean;
      error: { message: string; code: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DOCTOR_FAILED");
    expect(body.error.message).toContain(hostileName);
    expect(body.error.message).toContain("unknown status 'bogus'");
    expect(jproc.stdout).not.toContain("\u001b"); // JSON.stringify escapes it
  });
});

describe("doctor: outdated bucket (task-doctor-outdated-bucket)", () => {
  /**
   * Mutable fixture copy of the bundled templates dir: doctor re-renders from
   * the CURRENT templates, so tests simulate upstream movement by editing the
   * copy and pointing runDoctor's injectable templatesRoot at it. Init keeps
   * using the real bundle, exactly as an adopter would experience it.
   */
  function fixtureTemplates(): string {
    const root = mkdtempSync(join(tmpdir(), "arggon-templates-"));
    // Mirror the package layout: templates/ plus the sibling skills/ the
    // bundled skill template is resolved from (<templatesDir>/../skills/...).
    cpSync(resolve(repoRoot, "templates"), join(root, "templates"), { recursive: true });
    cpSync(resolve(repoRoot, "skills"), join(root, "skills"), { recursive: true });
    return join(root, "templates");
  }

  it("fresh init reports zero outdated against the pristine bundle", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const result = runDoctor({ cwd: dir, templatesRoot: fixtureTemplates() });
    expect(result.docs.outdated).toBe(0);
    expect(result.docs.outdatedDocs).toEqual([]);
    expect(formatDoctorReport(result)).not.toContain("newer templates");
  });

  it("counts docs whose template render moved upstream as outdated", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const templates = fixtureTemplates();
    writeFileSync(join(templates, "docs/AGENTS.md"), "UPSTREAM IMPROVEMENT\n", "utf8");
    const result = runDoctor({ cwd: dir, templatesRoot: templates });
    expect(result.docs.outdated).toBe(1);
    expect(result.docs.outdatedDocs).toEqual(["AGENTS.md"]);
    expect(result.docs.untouched).toBe(GENERATED_DOC_COUNT);
    expect(formatDoctorReport(result)).toContain("1 doc(s) have newer templates");
    expect(formatDoctorReport(result)).toContain("init --dry-run");
  });

  it("stops reporting outdated once the template matches the bundle again", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const templates = fixtureTemplates();
    writeFileSync(join(templates, "docs/AGENTS.md"), "UPSTREAM IMPROVEMENT\n", "utf8");
    expect(runDoctor({ cwd: dir, templatesRoot: templates }).docs.outdated).toBe(1);
    writeFileSync(
      join(templates, "docs/AGENTS.md"),
      readFileSync(resolve(repoRoot, "templates/docs/AGENTS.md"), "utf8"),
      "utf8",
    );
    const result = runDoctor({ cwd: dir, templatesRoot: templates });
    expect(result.docs.outdated).toBe(0);
    expect(result.docs.outdatedDocs).toEqual([]);
  });

  it("flags acked docs as outdated too (upstream moved regardless of local state)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    writeFileSync(join(dir, "AGENTS.md"), "SANCTIONED BASELINE\n", "utf8");
    runAdoptAck({ cwd: dir });
    const templates = fixtureTemplates();
    writeFileSync(join(templates, "docs/AGENTS.md"), "UPSTREAM IMPROVEMENT\n", "utf8");
    const result = runDoctor({ cwd: dir, templatesRoot: templates });
    expect(result.docs.acknowledged).toBe(GENERATED_DOC_COUNT);
    expect(result.docs.modified).toBe(0);
    expect(result.docs.outdated).toBe(1);
    expect(result.docs.outdatedDocs).toEqual(["AGENTS.md"]);
  });

  it("modified docs can be outdated at the same time (orthogonal buckets)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    writeFileSync(join(dir, "AGENTS.md"), "ADOPTER EDIT\n", "utf8");
    const templates = fixtureTemplates();
    writeFileSync(join(templates, "docs/AGENTS.md"), "UPSTREAM IMPROVEMENT\n", "utf8");
    const result = runDoctor({ cwd: dir, templatesRoot: templates });
    expect(result.docs.modified).toBe(1);
    expect(result.docs.outdated).toBe(1);
  });

  it("never throws when a template file is absent (stale keeps its meaning, not outdated)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const templates = fixtureTemplates();
    rmSync(join(templates, "docs/AGENTS.md"));
    const result = runDoctor({ cwd: dir, templatesRoot: templates });
    expect(result.docs.stale).toBe(1);
    expect(result.docs.outdated).toBe(0);
    expect(result.docs.outdatedDocs).toEqual([]);
  });

  it("exposes the outdated fields via the CLI --json (additive, exit 0)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const templates = fixtureTemplates();
    writeFileSync(join(templates, "docs/AGENTS.md"), "UPSTREAM IMPROVEMENT\n", "utf8");
    // CLI runs against the real bundle — assert the additive fields exist and
    // the exit-0 report-only contract holds.
    const proc = runCli(["doctor", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      docs: { outdated: number; outdatedDocs: string[] };
    };
    expect(body.ok).toBe(true);
    expect(body.docs.outdated).toBe(0);
    expect(body.docs.outdatedDocs).toEqual([]);
  });

  it("never writes anything while re-rendering (report-only)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const templates = fixtureTemplates();
    writeFileSync(join(templates, "docs/AGENTS.md"), "UPSTREAM IMPROVEMENT\n", "utf8");
    const before = readFileSync(join(dir, "tasks/.convention.yml"), "utf8");
    const agentsBefore = readFileSync(join(dir, "AGENTS.md"), "utf8");
    runDoctor({ cwd: dir, templatesRoot: templates });
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toBe(before);
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(agentsBefore);
  });
});

describe("doctor: OpenCode integration (task-opencode-v2-doctor)", () => {
  /**
   * The generated seam config, JSONC with a `//` comment and a trailing comma
   * (the shape an adopter's hand-edited copy can have). Parsing it is what
   * makes `mcp.servers.arggon` reportable — plain JSON.parse would fail.
   */
  const SEAM_CONFIG = [
    "{",
    "  // OpenCode V2 project configuration, generated by `arggon init`.",
    '  "$schema": "https://opencode.ai/config.json",',
    '  "mcp": { "servers": { "arggon": { "type": "local", "command": ["arggon", "mcp"], }, }, },',
    '  "formatter": true,',
    "}",
  ].join("\n");

  /**
   * Plant the generated seam artifacts (config + agents + commands) on a bare
   * tree for tests that need a provenance-free fixture: with no `x-generated`
   * entries the doctor report carries no doc hints, and SEAM_CONFIG exercises
   * doctor's tolerant JSONC parse (comments + trailing commas).
   */
  function plantSeam(dir: string): void {
    rmSync(join(dir, ".opencode"), { recursive: true, force: true });
    writeFileSync(join(dir, "opencode.jsonc"), SEAM_CONFIG, "utf8");
    mkdirSync(join(dir, ".opencode", "agents"), { recursive: true });
    mkdirSync(join(dir, ".opencode", "commands"), { recursive: true });
    for (const name of ["arggon-coordinator", "arggon-worker", "arggon-reviewer"]) {
      writeFileSync(join(dir, ".opencode", "agents", `${name}.md`), "---\n---\n", "utf8");
    }
    for (const name of ["arggon-next", "arggon-start", "arggon-done", "arggon-handoff"]) {
      writeFileSync(join(dir, ".opencode", "commands", `${name}.md`), "---\n---\n", "utf8");
    }
  }

  /**
   * Bare initialized tree: `tasks/.convention.yml` only — no generated docs,
   * no seam artifacts, no MCP registration. Post-#322 a fresh `init` always
   * wires the MCP server (native `opencode.jsonc` + `.mcp.json`), so tests
   * that need "nothing wired" must build the tree explicitly instead of
   * assuming a fresh init leaves it empty.
   */
  function bareTree(dir: string): void {
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 4\n", "utf8");
  }

  /** Adopter-owned config: drop any generated seam config first so `configs` is exact. */
  function writeAdopterConfig(dir: string, config: unknown, name = "opencode.json"): void {
    rmSync(join(dir, "opencode.jsonc"), { force: true });
    writeFileSync(join(dir, name), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  it("reports a clean seam (no adopter config, artifacts present, native registration, no hints)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const result = runDoctor({ cwd: dir });
    // Post-opencode-seam init generates the seam itself: opencode.jsonc is the
    // only config, V2-shaped, and registers the arggon MCP server natively.
    expect(result.opencode.configs).toEqual(["opencode.jsonc"]);
    expect(result.opencode.v1).toEqual({ findings: [], truncated: false });
    expect(result.opencode.artifacts).toEqual({
      config: true,
      agents: ["arggon-coordinator", "arggon-reviewer", "arggon-worker"],
      commands: ["arggon-adr", "arggon-done", "arggon-explore", "arggon-handoff", "arggon-next", "arggon-playbook", "arggon-review", "arggon-spec", "arggon-start", "arggon-status"],
      skills: ["arggon-cli", "arggon-upgrade"],
      truncated: false,
    });
    // init also writes the project-scoped `.mcp.json`; the native config wins.
    expect(result.opencode.mcp).toEqual({ native: true, mcpJson: true, hint: null });
    const report = formatDoctorReport(result);
    expect(report).toContain("opencode: config opencode.jsonc");
    expect(report).toContain("seam 14 artifact(s)"); // 1 config + 3 agents + 10 commands
    expect(report).toContain("2 bundled skill(s)");
    expect(report).toContain("MCP native");
    // Genuinely clean: every generated doc is untouched, so no hint line at all
    // (a fresh init must not trip its own "newer templates"/"--backup" hints).
    expect(report).not.toContain("hint:");
  });

  it("reads a hand-edited JSONC seam config (comments + trailing commas) without false hints", () => {
    const dir = tempDir();
    bareTree(dir);
    plantSeam(dir);
    const result = runDoctor({ cwd: dir });
    // The planted SEAM_CONFIG is JSONC with a `//` comment and trailing commas:
    // plain JSON.parse would reject it, so detecting native registration proves
    // the tolerant parse — and the provenance-free fixture stays hint-free.
    expect(result.opencode.configs).toEqual(["opencode.jsonc"]);
    expect(result.opencode.v1).toEqual({ findings: [], truncated: false });
    expect(result.opencode.artifacts).toEqual({
      config: true,
      agents: ["arggon-coordinator", "arggon-reviewer", "arggon-worker"],
      commands: ["arggon-done", "arggon-handoff", "arggon-next", "arggon-start"],
      skills: [],
      truncated: false,
    });
    expect(result.opencode.mcp).toEqual({ native: true, mcpJson: false, hint: null });
    const report = formatDoctorReport(result);
    expect(report).toContain("MCP native");
    expect(report).not.toContain("hint:");
  });

  it("parses a block comment (/* */) outside strings (MINOR-2)", () => {
    const dir = tempDir();
    bareTree(dir);
    writeFileSync(
      join(dir, "opencode.json"),
      '{\n  "formatter": true, /* one-line */\n' +
        '  /* multi-line\n     block comment */ "mcp": { "servers": { "arggon": {} } }\n}\n',
      "utf8",
    );
    const result = runDoctor({ cwd: dir });
    // The `mcp.servers.arggon` AFTER the block comments is read: a stripper
    // that dropped or corrupted block comments would yield no findings and no
    // native registration.
    expect(result.opencode.v1).toEqual({ findings: [], truncated: false });
    expect(result.opencode.mcp.native).toBe(true);
  });

  it("parses // and /* */ markers inside string values, not as comments (MINOR-2)", () => {
    const dir = tempDir();
    bareTree(dir);
    writeFileSync(
      join(dir, "opencode.json"),
      '{\n  "$schema": "https://opencode.ai/config.json",\n' +
        '  "formatter": "value /* not a comment */ // still literal",\n' +
        '  "enabled": true\n}\n',
      "utf8",
    );
    const result = runDoctor({ cwd: dir });
    // The V1-shaped `enabled` AFTER the marker-bearing string is found: a
    // string-unaware stripper would corrupt the JSON and return no findings.
    expect(result.opencode.v1).toEqual({
      findings: [{ file: "opencode.json", keys: ["enabled"] }],
      truncated: false,
    });
  });

  it("detects V1-shaped keys and emits the migration hint", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    writeAdopterConfig(dir, {
      mcp: { arggon: { type: "local", command: ["arggon", "mcp"] } },
      enabled: true,
      autoupdate: true,
      permission: { edit: "ask" },
      tools: { write: false },
      maxSteps: 20,
    });
    const result = runDoctor({ cwd: dir });
    expect(result.opencode.configs).toEqual(["opencode.json"]);
    expect(result.opencode.v1).toEqual({
      findings: [
        {
          file: "opencode.json",
          keys: ["autoupdate", "enabled", "maxSteps", "mcp.arggon", "permission", "tools"],
        },
      ],
      truncated: false,
    });
    // V1-shaped `mcp.arggon` is not native V2 registration, so the `.mcp.json`
    // fallback (written by init) still triggers the actionable hint.
    expect(result.opencode.mcp).toEqual({ native: false, mcpJson: true, hint: OPENCODE_MCP_HINT });
    const report = formatDoctorReport(result);
    expect(report).toContain("hint: V1-shaped OpenCode config opencode.json");
    expect(report).toContain("V2 does not read .mcp.json");
  });

  it("does not flag the documented V2-valid mcp.timeout key (MINOR-2)", () => {
    const dir = tempDir();
    bareTree(dir);
    writeAdopterConfig(dir, { mcp: { timeout: 30 } });
    const result = runDoctor({ cwd: dir });
    // `mcp.timeout` is a documented V2 child (docs/json-output.md) — flagging
    // it would be a false positive. No seam and no `.mcp.json` on this tree, so
    // the only possible hint source is the V1 findings list.
    expect(result.opencode.v1).toEqual({ findings: [], truncated: false });
    expect(formatDoctorReport(result)).not.toContain("hint:");
  });

  it("sanitizes ANSI escapes and newlines in untrusted config keys for human output (MINOR-1)", () => {
    const dir = tempDir();
    bareTree(dir);
    // An `mcp.<name>` key copied verbatim from an adopter config: the ESC
    // sequence could recolor/spoof the terminal and the newline could
    // fabricate a whole extra `hint:` line.
    const hostileName = "evil\u001b[31m\nspoof: fake hint";
    const rawKey = `mcp.${hostileName}`;
    writeAdopterConfig(dir, { enabled: true, mcp: { [hostileName]: { type: "local" } } });
    const result = runDoctor({ cwd: dir });
    // JSON payload keeps the raw key — one finding, sorted.
    expect(result.opencode.v1).toEqual({
      findings: [{ file: "opencode.json", keys: ["enabled", rawKey] }],
      truncated: false,
    });
    const report = formatDoctorReport(result);
    // Human output: no raw ESC and no fabricated line; the key is JSON-escaped
    // (`\u001b`, `\n`) while the ordinary key still renders bare.
    expect(report).not.toContain("\u001b");
    expect(report).not.toContain("\nspoof");
    expect(report).toContain('opencode.json (enabled, "mcp.evil\\u001b[31m\\nspoof: fake hint")');
    // JSON output unchanged: the raw key survives the CLI JSON round trip.
    const proc = runCli(["doctor", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      opencode: { v1: { findings: Array<{ file: string; keys: string[] }> } };
    };
    expect(body.opencode.v1.findings).toEqual([
      { file: "opencode.json", keys: ["enabled", rawKey] },
    ]);
  });

  it("escapes DEL/C1 and U+2028/29 in untrusted keys for human output; JSON keeps them raw (F3)", () => {
    const dir = tempDir();
    bareTree(dir);
    // \u009b/\u009d are the 8-bit CSI/OSC introducers, \u0085 is NEL (a line
    // break on some terminals), \u007f is DEL, and \u2028/29 are the Unicode
    // line/paragraph separators — JSON.stringify leaves all of them raw.
    const hostileName = "csi\u009bosc\u009dnel\u0085del\u007fls\u2028ps\u2029end";
    const rawKey = `mcp.${hostileName}`;
    writeAdopterConfig(dir, { enabled: true, mcp: { [hostileName]: { type: "local" } } });
    const result = runDoctor({ cwd: dir });
    expect(result.opencode.v1).toEqual({
      findings: [{ file: "opencode.json", keys: ["enabled", rawKey] }],
      truncated: false,
    });
    const report = formatDoctorReport(result);
    for (const ch of ["\u007f", "\u0085", "\u009b", "\u009d", "\u2028", "\u2029"]) {
      expect(report).not.toContain(ch);
    }
    expect(report).toContain('"mcp.csi\\u009bosc\\u009dnel\\u0085del\\u007fls\\u2028ps\\u2029end"');
    // JSON direction: the CLI --json payload keeps the raw key bytes.
    const proc = runCli(["doctor", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      opencode: { v1: { findings: Array<{ keys: string[] }> } };
    };
    expect(body.opencode.v1.findings[0]!.keys).toEqual(["enabled", rawKey]);
  });

  it("caps a long untrusted key on the human line; JSON keeps it whole (F3, bounded length)", () => {
    const dir = tempDir();
    bareTree(dir);
    const longName = "k".repeat(MAX_HUMAN_VALUE_CHARS * 3);
    const rawKey = `mcp.${longName}`;
    writeAdopterConfig(dir, { enabled: true, mcp: { [longName]: {} } });
    const result = runDoctor({ cwd: dir });
    expect(result.opencode.v1).toEqual({
      findings: [{ file: "opencode.json", keys: ["enabled", rawKey] }],
      truncated: false,
    });
    const report = formatDoctorReport(result);
    expect(report).toContain(`"${rawKey.slice(0, MAX_HUMAN_VALUE_CHARS)}…"`);
    expect(report).not.toContain(rawKey);
  });

  it("adopter config with native mcp.servers.arggon registration: no hint", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    writeAdopterConfig(dir, {
      mcp: { servers: { arggon: { type: "local", command: ["arggon", "mcp"] } } },
      formatter: true,
    });
    const result = runDoctor({ cwd: dir });
    expect(result.opencode.configs).toEqual(["opencode.json"]);
    expect(result.opencode.v1).toEqual({ findings: [], truncated: false });
    expect(result.opencode.mcp).toEqual({ native: true, mcpJson: true, hint: null });
    const report = formatDoctorReport(result);
    expect(report).toContain("MCP native");
    expect(report).not.toContain("hint:");
  });

  it("reports only in .mcp.json with the exact stanza hint", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    writeAdopterConfig(dir, { formatter: true }); // adopter config without any MCP server
    const result = runDoctor({ cwd: dir });
    expect(result.opencode.mcp).toEqual({ native: false, mcpJson: true, hint: OPENCODE_MCP_HINT });
    expect(result.opencode.mcp.hint).toContain('"mcp": {"servers": {"arggon"');
    const report = formatDoctorReport(result);
    expect(report).toContain("MCP only in .mcp.json");
    expect(report).toContain("mcp.servers");
  });

  it("emits no hint when nothing is wired at all (report-only, no nagging)", () => {
    const dir = tempDir();
    // A fresh init can no longer be used here: post-#322 it always wires the
    // MCP server (native opencode.jsonc + .mcp.json). A bare initialized tree
    // makes "nothing wired" genuinely the on-disk state.
    bareTree(dir);
    const result = runDoctor({ cwd: dir });
    expect(result.initialized).toBe(true);
    expect(result.opencode.configs).toEqual([]);
    expect(result.opencode.artifacts).toEqual({ config: false, agents: [], commands: [], skills: [], truncated: false });
    expect(result.opencode.mcp).toEqual({ native: false, mcpJson: false, hint: null });
    const report = formatDoctorReport(result);
    expect(report).toContain("MCP not registered");
    expect(report).not.toContain("hint:");
  });

  it("caps artifact lists and V1 findings (bounded output)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    mkdirSync(join(dir, ".opencode", "agents"), { recursive: true });
    for (let i = 0; i < MAX_OPENCODE_NAMES + 3; i++) {
      writeFileSync(join(dir, ".opencode", "agents", `agent-${String(i).padStart(3, "0")}.md`), "", "utf8");
    }
    const manyServers: Record<string, unknown> = {};
    for (let i = 0; i < MAX_OPENCODE_V1_KEYS_PER_FILE + 4; i++) {
      manyServers[`server-${String(i).padStart(3, "0")}`] = { type: "local", command: ["x"] };
    }
    writeAdopterConfig(dir, { mcp: manyServers });
    const result = runDoctor({ cwd: dir });
    expect(result.opencode.artifacts.agents).toHaveLength(MAX_OPENCODE_NAMES);
    expect(result.opencode.artifacts.truncated).toBe(true);
    expect(result.opencode.v1.findings).toHaveLength(1);
    expect(result.opencode.v1.findings[0]!.keys).toHaveLength(MAX_OPENCODE_V1_KEYS_PER_FILE);
    expect(result.opencode.v1.truncated).toBe(true);
  });

  it("lists an unparseable config but takes no findings from it (defensive parse, no throw)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    rmSync(join(dir, "opencode.jsonc"), { force: true });
    writeFileSync(join(dir, "opencode.json"), "{ not json", "utf8");
    const result = runDoctor({ cwd: dir });
    expect(result.opencode.configs).toEqual(["opencode.json"]);
    expect(result.opencode.v1).toEqual({ findings: [], truncated: false });
    expect(result.opencode.mcp.native).toBe(false);
  });

  it("detects `.opencode/` configs and reports all present files in candidate order", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    writeAdopterConfig(dir, {}, "opencode.json");
    mkdirSync(join(dir, ".opencode"), { recursive: true });
    writeFileSync(
      join(dir, ".opencode", "opencode.json"),
      JSON.stringify({ mcp: { servers: { arggon: { type: "local", command: ["arggon", "mcp"] } } } }),
      "utf8",
    );
    const result = runDoctor({ cwd: dir });
    expect(result.opencode.configs).toEqual(["opencode.json", ".opencode/opencode.json"]);
    expect(result.opencode.mcp.native).toBe(true);
  });

  it("scans exactly the shared OPENCODE_CONFIG_CANDIDATES list from docs.ts (MINOR-3 parity)", () => {
    const dir = tempDir();
    bareTree(dir);
    for (const rel of OPENCODE_CONFIG_CANDIDATES) {
      const abs = join(dir, ...rel.split("/"));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, "{}\n", "utf8");
    }
    const result = runDoctor({ cwd: dir });
    // Doctor reports ALL present files in the shared candidate order; the pin
    // fails if doctor ever re-hardcodes a divergent list.
    expect(result.opencode.configs).toEqual([...OPENCODE_CONFIG_CANDIDATES]);
    expect(result.opencode.v1).toEqual({ findings: [], truncated: false });
  });

  it("probes the cwd on non-initialized trees (block still additive)", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "opencode.json"), JSON.stringify({ mcp: { legacy: {} }, tools: {} }), "utf8");
    const result = runDoctor({ cwd: dir });
    expect(result.initialized).toBe(false);
    expect(result.opencode.configs).toEqual(["opencode.json"]);
    expect(result.opencode.v1.findings).toEqual([{ file: "opencode.json", keys: ["mcp.legacy", "tools"] }]);
    const report = formatDoctorReport(result);
    expect(report).toContain("not initialized");
    expect(report).toContain("opencode: config opencode.json");
  });

  it("exposes the additive block via the CLI --json (exit 0)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    writeAdopterConfig(dir, { formatter: true });
    const proc = runCli(["doctor", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      initialized: boolean;
      git: { isRepo: boolean };
      opencode: {
        configs: string[];
        v1: { findings: unknown[]; truncated: boolean };
        artifacts: { config: boolean; agents: string[]; commands: string[]; skills: string[]; truncated: boolean };
        mcp: { native: boolean; mcpJson: boolean; hint: string | null };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.initialized).toBe(true);
    // Existing fields are untouched; `opencode` rides alongside them.
    expect(body.git.isRepo).toBe(false);
    expect(body.opencode.configs).toEqual(["opencode.json"]);
    expect(body.opencode.v1.findings).toEqual([]);
    expect(body.opencode.mcp.native).toBe(false);
    expect(body.opencode.mcp.mcpJson).toBe(true);
    expect(body.opencode.mcp.hint).toContain("mcp.servers");
  });
});
