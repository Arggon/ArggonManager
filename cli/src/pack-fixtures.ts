/**
 * Shared packaging-test primitives (W6 `task-native-headless-ci`).
 *
 * `cli/src/pack-contents.test.ts` (tarball allowlist + `prepare` from a clean
 * clone) and `cli/src/headless-ci.test.ts` (packed install, headless CI recipe,
 * envelope parity) both need to stand up a fresh-clone copy, run npm against it
 * and read `npm pack --json` payloads. They live here so the two packaging
 * gates cannot drift apart.
 *
 * Test-only module: `package.json` excludes `dist/pack-fixtures.*` from the
 * tarball (the `test-tmp.ts` precedent), and pack-contents.test.ts asserts no
 * such artifact ships.
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { cpSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

export interface PackedFile {
  path: string;
  size: number;
  mode: number;
}

export interface PackResult {
  /** Tarball file name inside the pack destination (`arggondev-lib-0.3.0.tgz`). */
  filename: string;
  name: string;
  version: string;
  size: number;
  unpackedSize: number;
  files: PackedFile[];
}

/**
 * npm (or the npm running the suite) invoked with an explicit cwd.
 * `npm_execpath` points at npm's own JS entry point when the suite runs under
 * `npm test`, which also avoids `npm.cmd` resolution on Windows.
 */
export function npm(args: string[], cwd: string, timeout = 180_000): SpawnSyncReturns<string> {
  const execpath = process.env.npm_execpath;
  const command = execpath ? process.execPath : "npm";
  const argv = execpath ? [execpath, ...args] : args;
  return spawnSync(command, argv, { cwd, encoding: "utf8", timeout });
}

/**
 * `npm pack --json` shape differs by npm major: npm >= 12 prints one object
 * keyed by package name, npm 10 prints a single-element array. Lifecycle
 * script output (`prepare` banners) can precede the payload on stdout, so
 * parse from the FIRST `[`/`{` — anchoring on `{` alone would truncate npm
 * 10's array to `{...}]` (the JSON syntax error that went red in CI on npm
 * 10.9.4). Unit fixtures pin both shapes in pack-contents.test.ts.
 */
export function parsePackResult(stdout: string): PackResult {
  const payload = /[\[{]/.exec(stdout);
  if (!payload) {
    throw new Error(`no JSON payload in npm pack --json output: ${stdout.slice(0, 200)}`);
  }
  const raw = JSON.parse(stdout.slice(payload.index)) as unknown;
  const entry = Array.isArray(raw) ? raw[0] : Object.values(raw as Record<string, PackResult>)[0];
  if (!entry || typeof entry !== "object" || !Array.isArray(entry.files)) {
    throw new Error(`unexpected npm pack --json payload: ${stdout.slice(0, 200)}`);
  }
  return entry;
}

/**
 * Fresh-clone stand-in: the working tree's non-ignored file set (tracked +
 * untracked-but-uncommitted, so tests also work before the change is committed)
 * plus a `node_modules` symlink (the same trick `arggon start --worktree` uses),
 * so lifecycle scripts can run while `dist/` stays absent — an ignored path
 * never exists in a clone either. `into` must already exist and be empty.
 */
export function freshCloneCopy(root: string, into: string): void {
  const listed = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  );
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed in ${root}: ${listed.stderr}`);
  }
  for (const rel of listed.stdout.split("\0")) {
    if (rel === "") continue;
    // The worktree's node_modules is a symlink and (directory-only ignore
    // pattern) not ignored: it is linked in below instead of copied.
    if (rel === "node_modules" || rel.startsWith("node_modules/")) continue;
    const dest = join(into, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(root, rel), dest);
  }
  symlinkSync(join(root, "node_modules"), join(into, "node_modules"), "junction");
}
