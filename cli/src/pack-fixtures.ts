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
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
} from "node:fs";
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
 * Build outputs a checkout-pinned pack must ship: the two directories
 * {@link freshCloneCopy} leaves out (both gitignored).
 */
const BUILD_OUTPUT_DIRS = ["lib/dist", "dist"] as const;

/**
 * Fresh-clone stand-in: the working tree's non-ignored file set (tracked +
 * untracked-but-uncommitted, so tests also work before the change is committed)
 * plus a `node_modules` symlink (the same trick `arggon start --worktree` uses),
 * so lifecycle scripts can run while `dist/` stays absent — an ignored path
 * never exists in a clone either. `into` must already exist and be empty.
 *
 * `withBuild` seeds the clone with the checkout's OWN build output, for the lane
 * that packs the checked-out bytes without rebuilding them under the suite
 * (`cli/src/headless-ci.test.ts`). It is a copy, never a link: a link would put
 * the shared artifact back in play, which is the whole point of the copy.
 */
export function freshCloneCopy(root: string, into: string, withBuild = false): void {
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
  if (withBuild) copyBuildOutput(root, into);
}

/**
 * Copy this checkout's built output into the clone, so a pack of the clone ships
 * the bytes `npm run build` produced — the byte-exactness the packed-install gate
 * is there to prove. A missing build output is not an error here: the caller
 * owns the build-before-pack precondition and asserts it with a message naming
 * `npm run build`.
 *
 * The copy is made WRITABLE, and that is load-bearing rather than tidy:
 * `cpSync`/`copyFile` preserves the source mode, and during a suite run the
 * source is the frozen read-only build output (test/kernel-artifacts.ts). Copying
 * the modes verbatim handed the clone a read-only `lib/dist`, and npm 10's
 * `prepare` then died inside it with `TS5033 … EACCES` (bug-test-suite-lib-dist-rebuild-race).
 * The clone is the private root: its own build must be free to write there.
 */
function copyBuildOutput(root: string, into: string): void {
  for (const rel of BUILD_OUTPUT_DIRS) {
    const from = join(root, rel);
    if (!existsSync(from)) continue;
    const to = join(into, rel);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
    makeWritable(to);
  }
}

/**
 * Owner write (+ traverse, for directories) on every entry under `path`.
 *
 * Two things this gets right that a first attempt did not (both caught by
 * running it against a frozen source rather than by reading it):
 *
 *  - the guard tests the WRITE bit, `0o200`. `0o400` is owner *read*, which a
 *    `0444` file already has, so that version skipped every file it was meant to
 *    fix and handed the clone a read-only `lib/dist`;
 *  - the recursion is unconditional. `cpSync` gives the copied directory default
 *    modes and the copied files the source's, so the tree is half-writable and
 *    only the files need the fix.
 *
 * Symlinks are left alone (never chmod through one).
 */
function makeWritable(path: string): void {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) return;
  if (!(stats.mode & 0o200)) chmodSync(path, stats.mode | (stats.isDirectory() ? 0o700 : 0o200));
  if (!stats.isDirectory()) return;
  for (const entry of readdirSync(path)) makeWritable(join(path, entry));
}
