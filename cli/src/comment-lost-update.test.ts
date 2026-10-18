/**
 * Reproducer for bug-native-comment-lost-update:
 * two concurrent `arggon comment` calls to the SAME item; both bodies must
 * survive on disk AND in git.
 *
 * Native-path analysis: `runComment` serializes same-item writers with
 * `withItemLock(item.filePath)` (bug-comment-race-no-lock) and writes
 * atomically with `writeFileAtomic` (bug-comment-torn-read). Every other
 * item-file writer (`runUpdate`, `start` via `runUpdate`) takes the same
 * item lock, so a concurrent writer can never observe a stale body and
 * overwrite a comment. This test locks in that guarantee: two foreground
 * comments fired at once must both land exactly once.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCreate } from "@arggondev/lib";
import { runInit } from "./init.js";
import { runCli, spawnNodeCli } from "./test-spawn.js";
import { removeFixtureTree } from "./test-tmp.js";

const NOW = new Date("2026-09-14T12:00:00Z");
const TIMEOUT_MS = 120_000;

/** ~4 KiB bodies, matching the item's observed ~4 KB lost body. */
const BODY_A = `A-body\n${"alpha".repeat(800)}\n`;
const BODY_B = `B-body\n${"bravo".repeat(800)}\n`;

function git(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { encoding: "utf8", cwd });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function commitAllIfDirty(dir: string, message: string): void {
  spawnSync("git", ["add", "-A"], { cwd: dir, stdio: "pipe" });
  const r = spawnSync("git", ["commit", "--quiet", "-m", message], { cwd: dir, stdio: "pipe" });
  if (r.status !== 0 && !/nothing to commit/.test(String(r.stderr) + String(r.stdout))) {
    throw new Error(`git commit failed: ${r.stderr}`);
  }
}

function initRepo(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `arggon-lost-update-${prefix}-`));
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  runInit({ dir, force: false });
  const container = "## Context\n\nSeed.\n\n## Acceptance\n\nSeed.\n";
  const leaf = "## Context\n\nSeed.\n\n## Acceptance\n\n- [x] seed\n";
  runCreate({
    cwd: dir,
    type: "initiative",
    title: "Launch",
    id: "launch",
    now: NOW,
    body: container,
  });
  runCreate({
    cwd: dir,
    type: "epic",
    title: "Auth",
    parent: "launch",
    id: "auth",
    now: NOW,
    body: container,
  });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: "story-login",
    now: NOW,
    body: container,
  });
  runCreate({
    cwd: dir,
    type: "task",
    title: "Race target",
    parent: "story-login",
    id: "task-race",
    now: NOW,
    body: leaf,
  });
  commitAllIfDirty(dir, "init tasks");
  return dir;
}

type CommentJson =
  { ok: true; item: { id: string } } | { ok: false; error: { code: string; message: string } };

/** Fire two `comment --json` processes at once on the same item. */
function commentConcurrently(dir: string, id: string, texts: string[]): Promise<CommentJson[]> {
  const children = texts.map((text) =>
    spawnNodeCli(["comment", id, text, "--author", "agent", "--json"], {
      cwd: dir,
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
            const parsed = trimmed
              ? (JSON.parse(trimmed.split("\n").pop() ?? trimmed) as CommentJson)
              : null;
            resolvePromise(
              parsed ?? { ok: false, error: { code: "NO_JSON", message: err || "no output" } },
            );
          });
        }),
    ),
  );
}

describe("concurrent comments on one item (bug-native-comment-lost-update)", () => {
  it(
    "two concurrent ~4 KiB comments both survive on disk and in git",
    async () => {
      const dir = initRepo("same-item");
      try {
        const file = join(dir, "ArggonManager/launch/auth/story-login/task-race.md");
        const texts = [BODY_A, BODY_B];

        const results = await commentConcurrently(dir, "task-race", texts);

        // Both report ok (a cleanly-reported lock failure is retried below, but
        // with the item lock both should complete without contention loss).
        for (const r of results) {
          expect(r.ok, JSON.stringify(r)).toBe(true);
        }

        const body = readFileSync(file, "utf8");
        // Exactly once each on disk: concurrent writes serialize, not interleave or drop.
        for (const text of texts) {
          expect(body.split(text).length - 1).toBe(1);
        }

        // Both bodies reach git objects (neither is absent from history).
        for (const text of texts) {
          const fragment = text.split("\n")[0]; // "A-body" / "B-body"
          const log = git(["log", "--all", "-S", fragment, "--", file], dir);
          expect(log.length > 0).toBe(true);
        }

        // Tree still structurally sound after the contention.
        const validate = runCli(["validate", "--json"], dir);
        expect(JSON.parse(validate.stdout.trim().split("\n").pop() ?? "{}")).toMatchObject({
          ok: true,
        });
      } finally {
        removeFixtureTree(dir);
      }
    },
    TIMEOUT_MS,
  );
});
