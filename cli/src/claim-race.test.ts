/**
 * Concurrency tests for the claim check-and-set (bug-claim-race-no-lock):
 * spawn REAL concurrent `arggon start --worktree --json` processes (the suizo
 * repro) on the same fresh item and assert single-winner semantics.
 * Same assignee: exactly one created, the rest attach — never two processes
 * writing one worktree. Different assignees: exactly one winner, the losers
 * get the claim-conflict START_FAILED — never last-write-wins.
 *
 * Temp repos get a bare remote so the real push step succeeds (no gh, no
 * --open-pr). The CLI runs from source via tsx, like cli.test.ts.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";

const NOW = new Date("2026-09-13T12:00:00Z");
const TIMEOUT_MS = 120_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cliEntry = resolve(repoRoot, "cli/src/cli.ts");
const tsxLoader = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

function git(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { encoding: "utf8", cwd });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
}

/** Fresh repo with the standard scaffold, a clean tree, and a bare remote. */
function commitAllIfDirty(dir: string, message: string): void {
  spawnSync("git", ["add", "-A"], { cwd: dir, stdio: "pipe" });
  const r = spawnSync("git", ["commit", "--quiet", "-m", message], { cwd: dir, stdio: "pipe" });
  // init/creates auto-commit now (tracker hygiene); "nothing to commit" is fine.
  if (r.status !== 0 && !/nothing to commit/.test(String(r.stderr) + String(r.stdout))) {
    throw new Error(`git commit failed: ${r.stderr}`);
  }
}

function initRepoWithRemote(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `arggon-race-${prefix}-`));
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "login", now: NOW });
  runCreate({ cwd: dir, type: "task", title: "Race target", parent: "login", id: "task-race", now: NOW });
  commitAllIfDirty(dir, "init tasks");
  // Bare remote so the real pushBranch step works without gh.
  const remote = mkdtempSync(join(tmpdir(), `arggon-race-${prefix}-remote-`));
  git(["init", "--bare", "--quiet"], remote);
  git(["remote", "add", "origin", remote], dir);
  git(["push", "--quiet", "-u", "origin", "main"], dir);
  return dir;
}

type StartJson =
  | { ok: true; item: { id: string; assignee: string | null }; created: boolean; worktreePath: string | null }
  | { ok: false; error: { code: string; message: string } };

/** Spawn N `start --worktree --json` processes at once and collect their JSON. */
function startConcurrently(dir: string, id: string, assignees: string[]): Promise<StartJson[]> {
  const children = assignees.map((assignee) =>
    spawn(process.execPath, [tsxLoader, cliEntry, "start", id, "--assignee", assignee, "--worktree", "--json"], {
      cwd: dir,
      env: { ...process.env, GITHUB_USER: assignee },
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  return Promise.all(
    children.map(
      (child) =>
        new Promise<StartJson>((resolvePromise) => {
          let out = "";
          let err = "";
          child.stdout.on("data", (chunk: string) => (out += chunk));
          child.stderr.on("data", (chunk: string) => (err += chunk));
          child.on("close", () => {
            const trimmed = out.trim();
            const parsed = trimmed ? (JSON.parse(trimmed.split("\n").pop() ?? trimmed) as StartJson) : null;
            resolvePromise(
              parsed ?? { ok: false, error: { code: "NO_JSON", message: err || "no output" } },
            );
          });
        }),
    ),
  );
}

function itemData(repoDir: string, id: string): Record<string, unknown> {
  const file = join(repoDir, "tasks/launch/auth/login", `${id}.md`);
  return parseFrontmatter(readFileSync(file, "utf8")).data as Record<string, unknown>;
}

describe("concurrent claim starts (bug-claim-race-no-lock)", () => {
  it(
    "same assignee, N=5: exactly one created, the rest attach; final item claimed once",
    async () => {
      const dir = initRepoWithRemote("same");
      try {
        const results = await startConcurrently(dir, "task-race", [
          "arggon",
          "arggon",
          "arggon",
          "arggon",
          "arggon",
        ]);

        const ok = results.filter((r): r is Extract<StartJson, { ok: true }> => r.ok);
        const failed = results.filter((r) => !r.ok);
        // Exactly one winner creates; the rest attach (same assignee) or fail
        // deterministically — but never two created:true.
        expect(ok.filter((r) => r.created)).toHaveLength(1);
        for (const r of ok.filter((r) => !r.created)) {
          expect(r.worktreePath).toBeTruthy();
          expect(r.item.assignee).toBe("arggon");
        }

        // The item ends claimed exactly once (the claim lives on the
        // worktree branch; the root copy only gains it when the PR merges).
        const wtPath = resolve(dirname(dir), `${basename(dir)}-task-race`);
        const data = itemData(wtPath, "task-race");
        expect(data.status).toBe("in_progress");
        expect(data.assignee).toBe("arggon");

        // Exactly one worktree exists on disk and is registered.
        expect(existsSync(wtPath)).toBe(true);
        const registered = git(["worktree", "list", "--porcelain"], dir)
          .split("\n")
          .filter((line) => line.startsWith("worktree "))
          .map((line) => line.slice("worktree ".length));
        expect(registered.filter((p) => p === wtPath)).toHaveLength(1);
        // Failures, if any, are lock timeouts or claim conflicts — never
        // silent corruption.
        for (const r of failed) {
          expect(
            r.error.code === "START_FAILED" || /failed to acquire lock/.test(r.error.message),
          ).toBe(true);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  it(
    "alternating assignees, N=5: exactly one winner, losers get claim-conflict START_FAILED",
    async () => {
      const dir = initRepoWithRemote("alt");
      try {
        const assignees = ["alice", "bob", "alice", "bob", "alice"];
        const results = await startConcurrently(dir, "task-race", assignees);

        const ok = results.filter((r): r is Extract<StartJson, { ok: true }> => r.ok);
        const failed = results.filter((r) => !r.ok);

        // Exactly one create wins; a same-assignee re-run may attach (ok,
        // created:false) but every ok shares ONE assignee — no silent replace.
        expect(ok.filter((r) => r.created)).toHaveLength(1);
        const claimants = [...new Set(ok.map((r) => r.item.assignee))];
        expect(claimants).toHaveLength(1);

        // A different-assignee contender failed with the claim conflict —
        // never last-write-wins, never both-ok with two assignees.
        expect(failed.length).toBeGreaterThanOrEqual(1);
        for (const r of failed) {
          expect(r.error.code).toBe("START_FAILED");
        }

        // The surviving claim belongs to the winner — never overwritten.
        const wtPath = resolve(dirname(dir), `${basename(dir)}-task-race`);
        const data = itemData(wtPath, "task-race");
        expect(data.status).toBe("in_progress");
        expect(data.assignee).toBe(claimants[0]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );
});
