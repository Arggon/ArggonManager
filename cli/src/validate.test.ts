import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runValidate } from "./validate.js";

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

const fixtures = join(process.cwd(), "fixtures");
const invalidRoot = join(fixtures, "tasks-invalid");

function invalidCases(): string[] {
  return readdirSync(invalidRoot).filter((name) => {
    if (name === "README.md") return false;
    return statSync(join(invalidRoot, name)).isDirectory();
  });
}

describe("validate", () => {
  it("passes the minimal valid fixture", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-valid/minimal") });
    expect(result.errors).toEqual([]);
  });

  it("passes the sample launch-mvp tree", () => {
    const result = runValidate({ cwd: process.cwd() });
    expect(result.errors).toEqual([]);
  });

  it("passes fixtures/tasks-valid golden tree", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-valid") });
    expect(result.errors).toEqual([]);
  });

  it.each(invalidCases())("rejects invalid fixture %s", (name) => {
    const result = runValidate({ cwd: join(invalidRoot, name) });
    expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
  });

  it("reports missing parent with PARENT_MISSING", () => {
    const result = runValidate({ cwd: join(invalidRoot, "parent-missing") });
    expect(result.errors.some((e) => e.code === "PARENT_MISSING")).toBe(true);
  });

  it("reports unknown status with UNKNOWN_STATUS", () => {
    const result = runValidate({ cwd: join(invalidRoot, "bad-status") });
    expect(result.errors.some((e) => e.code === "UNKNOWN_STATUS")).toBe(true);
  });

  it("reports broken yaml with file path", () => {
    const result = runValidate({ cwd: join(invalidRoot, "broken-yaml") });
    expect(result.errors.some((e) => e.code === "BROKEN_YAML")).toBe(true);
    expect(result.errors.find((e) => e.code === "BROKEN_YAML")?.path).toContain("y.md");
  });

  it("reports missing container index", () => {
    const result = runValidate({ cwd: join(invalidRoot, "missing-index") });
    expect(result.errors.some((e) => e.code === "MISSING_INDEX")).toBe(true);
  });

  it("reports invalid branch with INVALID_BRANCH", () => {
    const result = runValidate({ cwd: join(invalidRoot, "invalid-branch") });
    expect(result.errors.some((e) => e.code === "INVALID_BRANCH")).toBe(true);
  });

  it("reports bad branch_patterns with INVALID_BRANCH_PATTERN", () => {
    const result = runValidate({ cwd: join(invalidRoot, "invalid-branch-patterns") });
    expect(result.errors.some((e) => e.code === "INVALID_BRANCH_PATTERN")).toBe(true);
  });
});

// bug-validate-stdout-injection M1: the human report interpolates
// repo-controlled paths/messages (hostile filename, frontmatter values), so
// each line is display-sanitized on stdout; exit codes and --json are untouched.
describe("validate human output sanitization (bug-validate-stdout-injection)", () => {
  const HOSTILE = "bad\nspoof: fake item\u001b[31m\u0085\u007f\u2028\u2029.md";

  /** Minimal tracker with one item whose FILE NAME carries the hostile bytes. */
  function hostileRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), "arggon-validate-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
    writeFileSync(
      join(dir, "tasks", HOSTILE),
      "---\ntype: task\nid: task-bad\nstatus: bogus\n---\nbody\n",
      "utf8",
    );
    return dir;
  }

  it("renders a hostile item filename inert on stdout (exit code unchanged)", () => {
    const dir = hostileRepo();
    const proc = runCli(["validate"], dir);
    expect(proc.status).toBe(1);
    // One inert physical line per issue: no raw ESC/DEL/C1/LS/PS and no
    // forged column-0 line from the embedded newline.
    expect(proc.stdout).not.toContain("\u001b");
    expect(proc.stdout).not.toContain("\u0085");
    expect(proc.stdout).not.toContain("\u007f");
    expect(proc.stdout).not.toContain("\u2028");
    expect(proc.stdout).not.toContain("\u2029");
    expect(proc.stdout).not.toContain("\nspoof");
    expect(proc.stdout).toContain(
      "error tasks/bad\\nspoof: fake item\\u001b[31m\\u0085\\u007f\\u2028\\u2029.md: unknown status 'bogus' [UNKNOWN_STATUS]",
    );
    expect(proc.stderr).toBe("");
  });

  it("--json keeps the raw hostile path, stays valid, exit code unchanged", () => {
    const dir = hostileRepo();
    const proc = runCli(["validate", "--json"], dir);
    expect(proc.status).toBe(1);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      errors: { path: string; code: string }[];
      error: { code: string };
    };
    expect(body.ok).toBe(false);
    expect(body.errors.some((e) => e.path.includes(HOSTILE))).toBe(true);
    expect(body.error.code).toBe("VALIDATE_FAILED");
  });

  it("leaves ordinary (non-hostile) error lines byte-identical", () => {
    const proc = runCli(["validate"], join(invalidRoot, "bad-status"));
    expect(proc.status).toBe(1);
    expect(proc.stdout).toBe(
      "error tasks/x/x.md: unknown status 'shipping' [UNKNOWN_STATUS]\n" +
        "warning tasks: tracker uses the legacy tasks/ layout — run `arggon migrate --layout` to move it to ArggonManager/ (docs included) [LEGACY_LAYOUT]\n" +
        "arggon validate: failed with 1 error(s), 1 warning(s)\n",
    );
  });
});
