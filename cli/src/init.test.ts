import { existsSync, mkdirSync, mkdtempSync as _mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
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

const TIER1_DOCS = [
  ".agents/skills/arggon-cli/SKILL.md",
  ".editorconfig",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/copilot-instructions.md",
  ".mcp.json",
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/tracking.md",
];

const TIER2_DOCS = [
  "ARCHITECTURE.md",
  "CHANGELOG.md",
  "SUPPORT.md",
  "docs/convention.md",
  "docs/deploy.md",
  "docs/engineering.md",
  "docs/runbooks/README.md",
];

describe("init", () => {
  it("scaffolds tasks/.convention.yml and templates", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false });
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toContain("version: 3");
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toContain("branch_patterns:");
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toContain('bug: "fix/{id}"');
    expect(existsSync(join(dir, "templates/task.md"))).toBe(true);
    expect(existsSync(join(dir, "templates/initiative.md"))).toBe(true);
    expect(result.alreadyInitialized).toBe(false);
    expect(result.created).toContain("tasks/.convention.yml");
    expect(result.restored).toEqual([]);
  });

  it("generates the tier-1 doc set by default", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false });
    for (const doc of TIER1_DOCS) {
      expect(existsSync(join(dir, ...doc.split("/")))).toBe(true);
      expect(result.created).toContain(doc);
    }
    for (const doc of TIER2_DOCS) {
      expect(existsSync(join(dir, ...doc.split("/")))).toBe(false);
      expect(result.created).not.toContain(doc);
    }
    expect(result.skipped).toEqual([]);
  });

  it("generates the tier-2 doc set only with full", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false, full: true });
    for (const doc of [...TIER1_DOCS, ...TIER2_DOCS]) {
      expect(existsSync(join(dir, ...doc.split("/")))).toBe(true);
      expect(result.created).toContain(doc);
    }
  });

  it("is idempotent without --force when already initialized", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    runInit({ dir, force: false });
    runInit({ dir, force: false });
    expect(existsSync(join(dir, "tasks/.convention.yml"))).toBe(true);
  });

  it("second run regenerates every untouched doc (updated[]) and creates nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    runInit({ dir, force: false, full: true });
    const second = runInit({ dir, force: false, full: true });
    expect(second.created).toEqual([]);
    expect(second.modified).toEqual([]);
    expect(second.skipped).toEqual([]);
    expect(second.updated).toEqual([...TIER1_DOCS, ...TIER2_DOCS].sort());
  });

  it("restores missing templates when already initialized", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    runInit({ dir, force: false });
    unlinkSync(join(dir, "templates/task.md"));
    const result = runInit({ dir, force: false });
    expect(existsSync(join(dir, "templates/task.md"))).toBe(true);
    expect(result.alreadyInitialized).toBe(true);
    expect(result.restored).toContain("templates/task.md");
  });

  it("generates missing docs on an already-initialized tree (restore-on-rerun)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 3\n", "utf8");
    const result = runInit({ dir, force: false });
    expect(result.alreadyInitialized).toBe(true);
    expect(result.created).toEqual(TIER1_DOCS);
    expect(result.skipped).toEqual([]);
  });

  it("never overwrites existing docs, even with --force", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    writeFileSync(join(dir, "AGENTS.md"), "CUSTOM ADOPTER CONTENT", "utf8");
    const result = runInit({ dir, force: true, full: true });
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe("CUSTOM ADOPTER CONTENT");
    expect(result.created).not.toContain("AGENTS.md");
    expect(result.skipped).toContain("AGENTS.md");
  });

  it("errors when tasks/ exists without convention unless --force", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks/note.txt"), "x");
    expect(() => runInit({ dir, force: false })).toThrow(/--force/);
  });

  // bug-init-leaves-docs-untracked-start-blocks-on-clean-tree: init must
  // auto-commit the docs it generates so `start`'s clean-tree precondition
  // never blocks tool-generated state.
  it("auto-commits generated docs: fresh init leaves a clean git tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    gitInit(dir);
    const result = runInit({ dir, force: false });
    expect(result.commit?.committed).toBe(true);
    expect(result.commit?.message).toMatch(/^chore\(tasks\): generated init docs \(\d+ files\)$/);
    // start's clean-tree gate: nothing untracked, nothing modified.
    const status = git(dir, ["status", "--porcelain"]);
    expect(status).toBe("");
    // HEAD carries the generated docs, the tasks/ tree AND the provenance state.
    const tracked = git(dir, ["ls-files"]);
    for (const doc of [...TIER1_DOCS, "tasks/.convention.yml", "templates/task.md"]) {
      expect(tracked).toContain(doc);
    }
  });

  it("stays ok in a non-git directory (commit skipped, not a failure)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false });
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
    expect(result.commit?.committed).toBe(false);
    expect(result.commit?.skipReason).toMatch(/not a git repository|git not found/);
  });

  it("re-run with nothing regenerated leaves HEAD untouched (quiet no-op)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    gitInit(dir);
    const now = new Date("2026-09-14T12:00:00Z");
    runInit({ dir, force: false, now });
    const headBefore = git(dir, ["rev-parse", "HEAD"]);
    const second = runInit({ dir, force: false, now });
    // Same generation timestamp → identical bytes → "nothing to commit" skip,
    // never a noisy empty commit nor a dirty tree.
    expect(second.commit?.committed).toBe(false);
    expect(second.commit?.skipReason).toBe("nothing to commit");
    expect(git(dir, ["rev-parse", "HEAD"])).toBe(headBefore);
    expect(git(dir, ["status", "--porcelain"])).toBe("");
  });

  // bug-init-git-doctor-blindspot: a non-git tree yields a half-functional
  // tracker (no branch/worktree/push/PR, no pre-commit validate hook) — init
  // must say so instead of reporting all-healthy.
  it("warns when the target tree is not a git repository", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false });
    expect(result.warning).toMatch(
      /not a git repository — branch\/worktree\/push\/PR flows and the pre-commit validate hook will be unavailable/,
    );
  });

  it("carries the warning in the --json envelope and on stderr (human output only there)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const proc = spawnSync(process.execPath, [tsx, cli, "init", "--json", dir], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(proc.status).toBe(0);
    // Human-facing warning rides stderr even in --json mode? No: the JSON
    // envelope carries the additive `warning` field; stderr stays quiet there.
    expect(proc.stderr).not.toMatch(/warning/);
    const body = JSON.parse(proc.stdout) as { ok: boolean; warning?: string };
    expect(body.ok).toBe(true);
    expect(body.warning).toMatch(/not a git repository/);
  });

  it("does not warn on a git tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    gitInit(dir);
    const result = runInit({ dir, force: false });
    expect(result.warning).toBeUndefined();
  });
});

/** Minimal git repo with a committer identity so auto-commits can land. */function gitInit(dir: string): void {
  execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir, stdio: "pipe" });
}

function git(dir: string, args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
}
