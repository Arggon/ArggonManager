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
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseFrontmatter, runCreate } from "@arggondev/lib";

import { runInit } from "./init.js";
import { spawnNodeCli } from "./test-spawn.js";
import { removeFixtureTree } from "./test-tmp.js";

const NOW = new Date("2026-09-13T12:00:00Z");
const TIMEOUT_MS = 120_000;

// bug-tmp-fixture-leak: track mkdtemp dirs (plus `arggon start --worktree`
// sibling worktrees named `<basename>-task-*`) and remove them once the
// spawned CLI children have finished (afterEach runs after the test's awaits).
// Teardown goes through the shared retrying helper (test-tmp.ts) so a
// still-settling child/fs entry can never trip ENOTEMPTY.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});
function trackedMkdtemp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

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
  const dir = trackedMkdtemp(`arggon-race-${prefix}-`);
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "login", now: NOW });
  runCreate({
    cwd: dir,
    type: "task",
    title: "Race target",
    parent: "login",
    id: "task-race",
    now: NOW,
  });
  commitAllIfDirty(dir, "init tasks");
  // Bare remote so the real pushBranch step works without gh.
  const remote = trackedMkdtemp(`arggon-race-${prefix}-remote-`);
  git(["init", "--bare", "--quiet"], remote);
  git(["remote", "add", "origin", remote], dir);
  git(["push", "--quiet", "-u", "origin", "main"], dir);
  return dir;
}

type StartJson =
  | {
      ok: true;
      item: { id: string; assignee: string | null };
      created: boolean;
      worktreePath: string | null;
    }
  | { ok: false; error: { code: string; message: string } };

/** Spawn N `start --worktree --json` processes at once and collect their JSON. */
function startConcurrently(dir: string, id: string, assignees: string[]): Promise<StartJson[]> {
  const children = assignees.map((assignee) =>
    spawnNodeCli(["start", id, "--assignee", assignee, "--worktree", "--json"], {
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
            const parsed = trimmed
              ? (JSON.parse(trimmed.split("\n").pop() ?? trimmed) as StartJson)
              : null;
            resolvePromise(
              parsed ?? { ok: false, error: { code: "NO_JSON", message: err || "no output" } },
            );
          });
        }),
    ),
  );
}

function itemData(repoDir: string, id: string): Record<string, unknown> {
  const file = join(repoDir, "ArggonManager/launch/auth/login", `${id}.md`);
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
        removeFixtureTree(dir);
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
        removeFixtureTree(dir);
      }
    },
    TIMEOUT_MS,
  );
});

/**
 * Real-CLI single-writer detection and the dead-owner take-over
 * (task-strict-attach-dead-owner-hatch; review smoke probe).
 *
 * Everything here drives the REAL `arggon` binary over REAL git — which is the
 * point: the #568 unit tests inject a fake porcelain probe, and the fake was
 * faithful while the production probe was NOT. `StartGit.fileStatus` trims, and
 * porcelain is positional (` M x` → `M x`, path read one character off), so the
 * CLI's detection never fired against real git output and the strict gate was
 * inert in production. This file is the regression that pins the raw probe.
 */
describe("real CLI: single-writer detection + dead-owner take-over", () => {
  const FOREIGN_SESSION = "ses_deadbeef";

  /** Run the real CLI, resolving with its parsed `--json` envelope. */
  function runStartCli(
    dir: string,
    args: string[],
  ): Promise<Record<string, unknown> & { ok: boolean }> {
    return new Promise((resolvePromise) => {
      const child = spawnNodeCli([...args, "--json"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (chunk: string) => (out += chunk));
      child.stderr.on("data", (chunk: string) => (err += chunk));
      child.on("close", () => {
        const trimmed = out.trim();
        const parsed = trimmed ? (JSON.parse(trimmed.split("\n").pop() ?? trimmed) as never) : null;
        resolvePromise(
          (parsed ?? {
            ok: false,
            error: { code: "NO_JSON", message: err || "no output" },
          }) as never,
        );
      });
    });
  }

  type ClaimEnvelope = {
    ok: boolean;
    worktreePath?: string;
    claim?: {
      stamped: boolean;
      foreignWrites?: { owner: string; files: string[]; total: number };
      takeOver?: { by: string; replacedIdentity: string; replaced: { identity: string } };
    };
    error?: { code: string; message: string };
  };

  it(
    "strict gate refuses a foreign stamp over newer tracked writes, then --take-over-worktree recovers it (real git)",
    async () => {
      const dir = initRepoWithRemote("single-writer");
      try {
        // Arm the strict single-writer gate and commit it: start refuses a dirty tree.
        appendFileSync(
          join(dir, "ArggonManager", ".convention.yml"),
          "x-tracker:\n  strict-worktree-writes: true\n",
        );
        commitAllIfDirty(dir, "arm the strict worktree-write gate");

        // 1. The owner claims the worktree.
        const first = (await runStartCli(dir, [
          "start",
          "task-race",
          "--assignee",
          "arggon",
          "--worktree",
        ])) as ClaimEnvelope;
        expect(first.ok).toBe(true);
        const worktreePath = first.worktreePath ?? "";
        expect(worktreePath).not.toBe("");
        const stampPath = join(
          git(["rev-parse", "--absolute-git-dir"], worktreePath),
          "arggon-claim.json",
        );

        // 2. A NATIVE session stamps the worktree and DIES mid-task: its stamp
        //    stays, and the tracked file it was editing stays newer than that
        //    stamp (the uncommitted collision window the gate observes).
        writeFileSync(
          stampPath,
          `${JSON.stringify(
            {
              identity: FOREIGN_SESSION,
              assignee: "arggon",
              item: "task-race",
              branch: "feat/task-race",
              claimedAt: "2026-09-13T12:00:00.000Z",
              surface: "native",
            },
            null,
            2,
          )}\n`,
          "utf8",
        );
        writeFileSync(join(worktreePath, "README.md"), "half-done\n", "utf8");
        commitAllIfDirty(worktreePath, "owner: commit the work in progress");
        appendFileSync(join(worktreePath, "README.md"), "// one more line\n");
        // Raw, on purpose: the leading status column is what the detection parses
        // (the `git` helper above trims — the very defect this file pins).
        expect(
          spawnSync("git", ["status", "--porcelain"], { cwd: worktreePath, encoding: "utf8" })
            .stdout,
        ).toBe(" M README.md\n");

        // 3. The plain re-attach is REFUSED, naming the designed hatch. This is
        //    the leg that could not fire before the raw-porcelain fix.
        const refused = (await runStartCli(dir, [
          "start",
          "task-race",
          "--assignee",
          "arggon",
          "--worktree",
        ])) as ClaimEnvelope;
        expect(refused.ok).toBe(false);
        expect(refused.error?.code).toBe("START_FAILED");
        const message = refused.error?.message ?? "";
        expect(message).toContain("x-tracker.strict-worktree-writes is set");
        expect(message).toContain("--take-over-worktree");
        expect(message).toContain("confirm no live writer");
        expect(message).toContain(FOREIGN_SESSION);
        expect(message).toContain("README.md");
        // Refused BEFORE the claim: the dead owner's stamp still stands.
        expect(JSON.parse(readFileSync(stampPath, "utf8")).identity).toBe(FOREIGN_SESSION);

        // 4. The deliberate take-over recovers it, and the audit trail persists.
        const taken = (await runStartCli(dir, [
          "start",
          "task-race",
          "--assignee",
          "arggon",
          "--worktree",
          "--take-over-worktree",
        ])) as ClaimEnvelope;
        expect(taken.ok).toBe(true);
        expect(taken.claim?.takeOver?.replacedIdentity).toBe(FOREIGN_SESSION);
        expect(taken.claim?.takeOver?.by).toBe("arggon");
        expect(taken.claim?.takeOver?.replaced.identity).toBe(FOREIGN_SESSION);
        // The armed strict gate saw no violation: exactly one of the two fields.
        expect(taken.claim?.foreignWrites).toBeUndefined();
        const stamp = JSON.parse(readFileSync(stampPath, "utf8")) as {
          identity: string;
          takeovers?: { by: string; replacedIdentity: string }[];
        };
        expect(stamp.identity).toBe("arggon");
        expect(stamp.takeovers).toEqual([
          expect.objectContaining({ by: "arggon", replacedIdentity: FOREIGN_SESSION }),
        ]);
      } finally {
        removeFixtureTree(dir);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "the take-over flag without --worktree fails fast (START_FAILED)",
    async () => {
      const dir = initRepoWithRemote("takeover-guard");
      try {
        const refused = (await runStartCli(dir, [
          "start",
          "task-race",
          "--assignee",
          "arggon",
          "--take-over-worktree",
        ])) as ClaimEnvelope;
        expect(refused.ok).toBe(false);
        expect(refused.error?.code).toBe("START_FAILED");
        expect(refused.error?.message).toContain("--take-over-worktree requires --worktree");
      } finally {
        removeFixtureTree(dir);
      }
    },
    TIMEOUT_MS,
  );
});
