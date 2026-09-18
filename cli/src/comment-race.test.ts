/**
 * Concurrency test for the comment read-modify-write (bug-comment-race-no-lock):
 * spawn REAL concurrent `arggon comment --json` processes (the lab repro) on the
 * SAME item and assert BOTH comments land in the body. runComment does a
 * read-modify-write of the item file; without withItemLock (the lock family from
 * bug-claim-race-no-lock / PR #134) last-full-file-write-wins silently drops one
 * comment while both processes exit ok.
 *
 * Also the torn-read regression for bug-comment-torn-read: tight-loop reader
 * children hammer the item file while the comments race, and every observation
 * must carry the complete frontmatter. Before the fix the in-place
 * `writeFileSync` (open+truncate, then write) let readers observe an empty or
 * partial file, and the initial loadItems could skip the file entirely
 * (COMMENT_FAILED "not found under tasks/"). The pre-fix harness (widened body,
 * same shape as below) observed 100+ torn reads per run; with the atomic write
 * (temp file + rename) it observes zero.
 *
 * The CLI runs from source via tsx, like cli.test.ts / claim-race.test.ts.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function commitAllIfDirty(dir: string, message: string): void {
  spawnSync("git", ["add", "-A"], { cwd: dir, stdio: "pipe" });
  const r = spawnSync("git", ["commit", "--quiet", "-m", message], { cwd: dir, stdio: "pipe" });
  // init/creates auto-commit now (tracker hygiene); "nothing to commit" is fine.
  if (r.status !== 0 && !/nothing to commit/.test(String(r.stderr) + String(r.stdout))) {
    throw new Error(`git commit failed: ${r.stderr}`);
  }
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
  commitAllIfDirty(dir, "init tasks");
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

type ReaderStats = { reads: number; torn: number; samples: string[] };

/**
 * Spawn N tight-loop reader children on the item file. A read is TORN when it
 * is shorter than the baseline captured before the race, does not start with
 * `---`, or has no closing frontmatter fence — i.e. the reader observed the
 * item without its complete frontmatter. Readers spin until `stopFile` exists
 * (the parent creates it after every comment child has exited), so they cover
 * the whole contested window, and each reports `{reads, torn, samples}`.
 */
function startReaders(target: string, stopFile: string, baseLen: number, n: number): Array<Promise<ReaderStats>> {
  const script = `
    const fs = require("node:fs");
    const [target, stop, baseLenRaw] = process.argv.slice(1);
    const baseLen = Number(baseLenRaw);
    let reads = 0, torn = 0; const samples = [];
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline && !fs.existsSync(stop)) {
      let s;
      try { s = fs.readFileSync(target, "utf8"); }
      catch (e) { torn++; if (samples.length < 3) samples.push("ERR " + e.code); continue; }
      reads++;
      if (s.length < baseLen || !s.startsWith("---") || !s.includes("\\n---\\n")) {
        torn++;
        if (samples.length < 3) samples.push("len=" + s.length + " head=" + JSON.stringify(s.slice(0, 24)));
      }
    }
    console.log(JSON.stringify({ reads, torn, samples }));
  `;
  return Array.from({ length: n }, () =>
    new Promise<ReaderStats>((resolvePromise) => {
      const child = spawn(process.execPath, ["-e", script, target, stopFile, String(baseLen)], {
        stdio: ["ignore", "pipe", "inherit"],
      });
      let out = "";
      child.stdout.on("data", (chunk: string) => (out += chunk));
      child.on("close", () => {
        resolvePromise(
          out.trim() ? (JSON.parse(out.trim()) as ReaderStats) : { reads: 0, torn: 0, samples: [] },
        );
      });
    }),
  );
}

describe("concurrent comments on one item (bug-comment-race-no-lock)", () => {
  it(
    "N=4 concurrent comments on the SAME item: every comment lands in the body",
    async () => {
      const dir = initRepo("same-item");
      try {
        const file = join(dir, "tasks/launch/auth/login/task-race.md");
        // Widen the body so a truncate->write window is actually observable:
        // the pre-fix bug wrote this ~1.5MB file in place (truncate, then
        // write), and the readers below observed 0-length and partial files
        // every run. Atomic rename makes the window unobservable.
        writeFileSync(
          file,
          `${readFileSync(file, "utf8")}filler\n${"x".repeat(1_500_000)}\n`,
          "utf8",
        );
        const baseLen = Buffer.byteLength(readFileSync(file, "utf8"));

        const stopFile = join(dir, "STOP");
        const readers = startReaders(file, stopFile, baseLen, 3);

        const texts = ["alpha note", "bravo note", "charlie note", "delta note"];
        const results = await commentConcurrently(dir, "task-race", texts);
        writeFileSync(stopFile, "");
        const readerStats = await Promise.all(readers);

        // Every process reports ok, or a clean, reported lock failure — under a
        // loaded CI runner a contender can legitimately exceed the 10s lock
        // deadline while the holder is descheduled; that is the actionable
        // error path, never a crash or a silent loss. A clean lock failure is
        // retried sequentially below, so EVERY comment must still land.
        //
        // bug-comment-torn-read: the transient "not found under tasks/" retry
        // that used to live here is GONE. It papered over the pre-fix in-place
        // writeFileSync (open+truncate) race, where a contender scanned the
        // item inside the truncate window and saw an empty file. The write is
        // atomic now and the locate step retries transient misses bounded, so
        // a not-found through this path is a real failure and must fail.
        const failedTexts: string[] = [];
        results.forEach((r, i) => {
          if (!r.ok) {
            expect(r.error.code).toBe("COMMENT_FAILED");
            expect(r.error.message).toMatch(/failed to acquire lock/);
            failedTexts.push(texts[i]);
          }
        });

        // Torn-read regression (bug-comment-torn-read): every reader actually
        // ran, and none ever observed the item without its complete frontmatter
        // (empty file, missing fences, or shorter than the pre-race baseline).
        expect(readerStats.every((r) => r.reads > 0)).toBe(true);
        const torn = readerStats.reduce((sum, r) => sum + r.torn, 0);
        expect(torn, JSON.stringify(readerStats)).toBe(0);

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
        // bug-tracker-commit-enotempty-flake: the four CLI children are
        // awaited on "close" above, so teardown is already sequenced after
        // them; the retry window only covers a still-settling fs entry under
        // CI load (rmdir -> ENOTEMPTY is never suppressed by `force`). The
        // mkdtemp name is unique per call, so concurrent runs can never
        // collide on this fixture.
        rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
      }
    },
    TIMEOUT_MS,
  );
});
