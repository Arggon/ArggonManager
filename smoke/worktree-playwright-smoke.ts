/**
 * Deterministic regression leg for bug-worktree-link-farm-breaks-playwright-runner:
 * the Playwright lane must start from a disposable worktree whose node_modules
 * is a start-style LINK FARM (the layout every review worktree has).
 *
 * What it proves: with `preserveSymlinks` pinned in playwright.config.ts, the
 * runner loads, the config parses and the specs register from the farm layout —
 * the exact surface the original failure ("Playwright Test did not expect
 * test.describe() to be called here") broke. What it does NOT claim: a full
 * browser run (that is the ui-smoke CI job's business) and a reproduction of
 * the original failure, which stopped reproducing on current node/npm/playwright
 * (evidence on the item) — this leg guards the lane's runnability so a future
 * toolchain drift that reintroduces dual-instance resolution fails loudly here.
 *
 * Model-free, offline (no browsers launched: `--list` only), needs `npm run
 * build` for the kernel import? No: the kernel is imported from source via the
 * same tsx runner the CLI uses, so no build is required.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { linkNodeModules } from "../lib/src/worktree.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

// 1. Disposable worktree of THIS repo (tracked files only; no node_modules).
const base = mkdtempSync(join(tmpdir(), "arggon-wt-playwright-"));
const wt = join(base, "wt");
const branch = `smoke/wt-playwright-${process.pid}`;
const add = spawnSync(
  "git",
  ["worktree", "add", "--detach", wt, "HEAD"],
  { cwd: root, encoding: "utf8" },
);
check("git worktree add", add.status === 0, add.stderr.slice(0, 200));
try {
  // 2. Mirror the primary install the way `start --worktree` does.
  const linked = linkNodeModules(root, wt);
  check("link farm created", linked === true);

  // 3. The lane starts from the farm: config parses, specs register.
  const list = spawnSync("npx", ["playwright", "test", "--list", "--grep", "@smoke"], {
    cwd: wt,
    encoding: "utf8",
    timeout: 180_000,
  });
  check(
    "playwright --list from a link-farm worktree",
    list.status === 0 && /Total: \d+ tests/.test(list.stdout),
    list.status === 0 ? list.stdout.match(/Total: \d+ tests/)?.[0] : list.stderr.slice(0, 300),
  );
  check(
    "no dual-instance registry error",
    !/did not expect test\.describe\(\)/.test(list.stderr + list.stdout),
  );
} finally {
  rmSync(wt, { recursive: true, force: true });
  spawnSync("git", ["worktree", "prune"], { cwd: root });
  spawnSync("git", ["branch", "-D", branch], { cwd: root });
  rmSync(base, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
