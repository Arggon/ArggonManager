/**
 * Concurrency test for the comment read-modify-write (bug-comment-race-no-lock):
 * spawn REAL concurrent `arggon comment --json` processes (the lab repro) on the
 * SAME item and assert BOTH comments land in the body. runComment does a
 * read-modify-write of the item file; without withItemLock (the lock family from
 * bug-claim-race-no-lock / PR #134) last-full-file-write-wins silently drops one
 * comment while both processes exit ok.
 *
 * The CLI runs from source via tsx, like cli.test.ts / claim-race.test.ts.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";

const NOW = new Date("2026-09-14T12:00:00Z");
const TIMEOUT_MS = 120_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cliEntry = resolve(repoRoot, "cli/src/cli.ts");
const tsxLoader = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

function git(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { encoding: "utf8", cwd });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
}

/** Fresh GIT repo with the standard scaffold committed (comment auto-commits). */
function initRepo(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `arggon-comment-race-${prefix}-`));
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "login", now: NOW });
  runCreate({ cwd: dir, type: "task", title: "Race target", parent: "login", id: "task-race", now: NOW });
  git(["add", "-A"], dir);
  git(["commit", "--quiet", "-m", "init tasks"], dir);
  return dir;
}

type CommentJson = { ok: true; item: { id: string } } | { ok: false; error: { code: string; message: string } };

/** Spawn N `comment --json` processes at once on the same item and collect their JSON. */
function commentConcurrently(dir: string, id: string, texts: string[]): Promise<CommentJson[]> {
  const children = texts.map((text) =>
    spawn(process.execPath, [tsxLoader, cliEntry, "comment", id, text, "--author", "agent", "--json"], {
      cwd: dir,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  return Promise.all(
    children.map(
      (child) =>
        new Promise<CommentJson>((resolvePromise) => {
          let out = "";
          let err = "";
          child.stdout.on("data", (chunk: string) => (out += chunk));
          child.stderr.on("data", (chunk: string) => (err += chunk));
          child.on("close", () => {
            const trimmed = out.trim();
            const parsed = trimmed ? (JSON.parse(trimmed.split("\n").pop() ?? trimmed) as CommentJson) : null;
            resolvePromise(parsed ?? { ok: false, error: { code: "NO_JSON", message: err || "no output" } });
          });
        }),
    ),
  );
}

describe("concurrent comments on one item (bug-comment-race-no-lock)", () => {
  it(
    "N=4 concurrent comments on the SAME item: every comment lands in the body",
    async () => {
      const dir = initRepo("same-item");
      try {
        const texts = ["alpha note", "bravo note", "charlie note", "delta note"];
        const results = await commentConcurrently(dir, "task-race", texts);

        // Every process reports ok (or a clean, reported lock failure — under a
        // loaded CI runner a contender can legitimately exceed the 10s lock
        // deadline while the holder is descheduled; that is the actionable
        // error path, never a crash or a silent loss). A clean lock failure is
        // retried sequentially below, so EVERY comment must still land.
        const failedTexts: string[] = [];
        results.forEach((r, i) => {
          if (!r.ok) {
            expect(r.error.code).toBe("COMMENT_FAILED");
            expect(r.error.message).toMatch(/failed to acquire lock/);
            failedTexts.push(texts[i]);
          }
        });

        const file = join(dir, "tasks/launch/auth/login/task-race.md");

        // A cleanly reported lock timeout is retried sequentially, like a real
        // caller would: the error is actionable and the comment still lands.
        for (const text of failedTexts) {
          const retry = spawnSync(
            process.execPath,
            [tsxLoader, cliEntry, "comment", "task-race", text, "--author", "agent", "--json"],
            { encoding: "utf8", cwd: dir },
          );
          expect(retry.status, retry.stderr).toBe(0);
        }

        const body = readFileSync(file, "utf8");
        for (const text of texts) {
          // Exactly once: concurrent writes must serialize, not duplicate.
          expect(body.split(text).length - 1).toBe(1);
        }

        // Tree still structurally sound after the contention.
        const validate = spawnSync(process.execPath, [tsxLoader, cliEntry, "validate", "--json"], {
          encoding: "utf8",
          cwd: dir,
        });
        expect(JSON.parse(validate.stdout.trim().split("\n").pop() ?? "{}")).toMatchObject({ ok: true });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );
});
