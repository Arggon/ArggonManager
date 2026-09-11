/**
 * End-to-end smoke test for `arggon sync` (issue #52).
 *
 * Spawns the real CLI (tsx) inside a temp git repo with a fake `gh` on PATH
 * whose `pr list` output is swapped between runs via bin/prs.json. Covers the
 * acceptance criteria: --check is the CI-safe default and exits non-zero when
 * sync is needed, --write fills only empty branch fields, ambiguous matches
 * are reported and never guessed, and --json stays one parseable object with
 * the process exit code mirroring exit_code.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

type Pr = { number: number; title: string; headRefName: string; url: string };

function pr(number: number, headRefName: string): Pr {
  return {
    number,
    headRefName,
    title: `PR ${number}`,
    url: `https://github.com/o/r/pull/${number}`,
  };
}

function runCli(args: string[], cwd: string, env: Record<string, string>) {
  return spawnSync(process.execPath, [tsx, cli, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env, ...env },
  });
}

/**
 * Temp git work tree + task hierarchy + a fake gh reading bin/prs.json.
 * Items: story1 with task-fill (no branch), task-set (branch feat/task-set),
 * bug-fixme (no branch), task-ambig (no branch).
 */
function initSyncTree(): { dir: string; env: Record<string, string>; setPrs: (prs: Pr[]) => void; setGhFails: (fail: boolean) => void } {
  const outer = mkdtempSync(join(tmpdir(), "arggon-sync-smoke-"));
  const dir = join(outer, "work");
  mkdirSync(dir, { recursive: true });
  expect(spawnSync("git", ["init", "--quiet"], { cwd: dir, encoding: "utf8" }).status).toBe(0);
  expect(
    spawnSync("git", ["remote", "add", "origin", "https://github.com/o/r.git"], {
      cwd: dir,
      encoding: "utf8",
    }).status,
  ).toBe(0);

  const bin = join(outer, "bin");
  mkdirSync(bin, { recursive: true });
  const ghPath = join(bin, "gh");
  const prsPath = join(bin, "prs.json");
  const ghOk = '#!/bin/sh\ncat "$(dirname "$0")/prs.json"\n';
  const ghFail = '#!/bin/sh\necho "auth required" >&2\nexit 1\n';
  const setGh = (fail: boolean): void => {
    writeFileSync(ghPath, fail ? ghFail : ghOk, "utf8");
    chmodSync(ghPath, 0o755);
  };
  setGh(false);
  writeFileSync(prsPath, "[]", "utf8");
  const pathEnv = { PATH: `${bin}:${process.env.PATH ?? ""}` };

  const run = (args: string[]): void => {
    const r = runCli(args, dir, pathEnv);
    expect(r.status).toBe(0);
  };
  run(["init", dir]);
  run(["create", "initiative", "Launch", "--id", "init1"]);
  run(["create", "epic", "Auth", "--id", "epic1", "--parent", "init1"]);
  run(["create", "story", "Login", "--id", "story1", "--parent", "epic1"]);
  run(["create", "task", "Fill me", "--id", "fill", "--parent", "story1"]);
  run(["create", "task", "Pinned", "--id", "set", "--parent", "story1"]);
  run(["create", "task", "Ambiguous", "--id", "ambig", "--parent", "story1"]);
  run(["create", "bug", "Crash", "--id", "fixme", "--parent", "story1"]);
  run(["update", "task-set", "--branch", "feat/task-set"]);

  return {
    dir,
    env: pathEnv,
    setPrs: (prs: Pr[]) => writeFileSync(prsPath, `${JSON.stringify(prs)}\n`, "utf8"),
    setGhFails: (fail: boolean) => setGh(fail),
  };
}

/** Path of <id>.md under tasks/ (leaves sit directly in their story's directory). */
function itemPath(dir: string, id: string): string {
  return join(dir, "tasks", "init1", "epic1", "story1", `${id}.md`);
}

function frontmatter(dir: string, id: string): Record<string, unknown> {
  return parseFrontmatter(readFileSync(itemPath(dir, id), "utf8")).data as Record<string, unknown>;
}

describe("sync smoke (spawned CLI, fake gh)", () => {
  it("--check is the default, exits non-zero when a fill is available, then --write -> --check goes green", () => {
    const t = initSyncTree();

    // Only the pinned task's PR is open: nothing to fill, gate is green.
    t.setPrs([pr(47, "feat/task-set")]);
    let r = runCli(["sync"], t.dir, t.env);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("arggon sync (check): in sync");
    expect(r.stdout).toContain("matched:   task-set");

    // PRs for the branchless leaves appear: check (the default mode) must
    // flag them without touching the files.
    t.setPrs([pr(46, "feat/task-fill"), pr(47, "feat/task-set"), pr(48, "fix/bug-fixme")]);
    const beforeFill = readFileSync(itemPath(t.dir, "task-fill"), "utf8");
    const beforeSet = readFileSync(itemPath(t.dir, "task-set"), "utf8");

    r = runCli(["sync"], t.dir, t.env);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("arggon sync (check): sync needed");
    expect(r.stdout).toContain("fillable:  task-fill <- feat/task-fill (#46)");
    expect(r.stdout).toContain("fillable:  bug-fixme <- fix/bug-fixme (#48)");
    expect(r.stdout).toContain("next: arggon sync --write");
    // Default mode is CI-safe: no writes happened.
    expect(readFileSync(itemPath(t.dir, "task-fill"), "utf8")).toBe(beforeFill);

    r = runCli(["sync", "--check"], t.dir, t.env);
    expect(r.status).toBe(1);

    // --write fills only the empty fields.
    r = runCli(["sync", "--write"], t.dir, t.env);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("filled:    task-fill -> feat/task-fill");
    expect(r.stdout).toContain("filled:    bug-fixme -> fix/bug-fixme");
    expect(frontmatter(t.dir, "task-fill").branch).toBe("feat/task-fill");
    expect(frontmatter(t.dir, "bug-fixme").branch).toBe("fix/bug-fixme");
    // Pre-set branch and the rest of the human data are byte-identical.
    expect(readFileSync(itemPath(t.dir, "task-set"), "utf8")).toBe(beforeSet);
    expect(frontmatter(t.dir, "task-fill").status).toBe("todo");
    expect(frontmatter(t.dir, "task-fill").title).toBe("Fill me");

    // The CI gate loop converges: nothing left to sync.
    r = runCli(["sync", "--check"], t.dir, t.env);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("arggon sync (check): in sync");
  }, 120_000);

  it("reports ambiguous matches and never guesses, in both modes", () => {
    const t = initSyncTree();
    const before = readFileSync(itemPath(t.dir, "task-ambig"), "utf8");

    t.setPrs([pr(50, "feat/task-ambig"), pr(51, "feat/task-ambig")]);

    let r = runCli(["sync", "--check"], t.dir, t.env);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("ambiguous: task-ambig (PRs 50, 51)");
    expect(readFileSync(itemPath(t.dir, "task-ambig"), "utf8")).toBe(before);

    r = runCli(["sync", "--write"], t.dir, t.env);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("ambiguous: task-ambig");
    expect(readFileSync(itemPath(t.dir, "task-ambig"), "utf8")).toBe(before);
  }, 120_000);

  it("emits exactly one JSON object whose exit_code mirrors the process exit", () => {
    const t = initSyncTree();

    t.setPrs([pr(46, "feat/task-fill"), pr(47, "feat/task-set")]);
    let r = runCli(["sync", "--json"], t.dir, t.env);
    expect(r.status).toBe(1);
    const check = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(check.ok).toBe(true);
    expect(check.command).toBe("sync");
    expect(check.mode).toBe("check");
    expect(check.pending).toEqual(["task-fill"]);
    expect(check.suggestions).toEqual([{ id: "task-fill", branch: "feat/task-fill", pr: 46 }]);
    expect(check.exit_code).toBe(1);

    r = runCli(["--json", "sync", "--write"], t.dir, t.env);
    expect(r.status).toBe(0);
    const write = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(write.ok).toBe(true);
    expect(write.mode).toBe("write");
    expect(write.filled).toEqual({ "task-fill": "feat/task-fill" });
    expect(write.exit_code).toBe(0);

    // gh is down: one ok:false envelope, SYNC_FAILED, non-zero exit, no
    // second JSON object on stdout.
    t.setGhFails(true);
    r = runCli(["sync", "--json"], t.dir, t.env);
    expect(r.status).toBe(1);
    const failed = JSON.parse(r.stdout) as {
      ok: boolean;
      error?: { code?: string };
    };
    expect(failed.ok).toBe(false);
    expect(failed.error?.code).toBe("SYNC_FAILED");
  }, 120_000);

  it("rejects --check together with --write", () => {
    const t = initSyncTree();
    const r = runCli(["sync", "--check", "--write"], t.dir, t.env);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("either --check or --write");
  }, 120_000);
});
