/**
 * Packaging contract (task-npm-packaging): what `npm pack` ships is pinned
 * here so a regression fails the suite.
 *
 * The pack runs in a temp copy of every TRACKED file — a stand-in for a fresh
 * clone: `dist/` is gitignored and `node_modules/` is linked in, so the copy
 * has NO build output. That makes this single test the gate for three
 * acceptance criteria at once:
 *
 *   1. the `files` allowlist (production dist without *.test.*, the runtime
 *      asset dirs templates/skills/opencode, README/LICENSE) — any path
 *      outside the allowlist, or any test artifact, fails;
 *   2. a fresh clone installs/builds without pre-build: `prepare` must produce
 *      dist/cli.js in the copy before the tarball is collected;
 *   3. the bin ships executable (`postbuild` chmod), or a manual symlink to it
 *      fails with "Permission denied" as observed on 2026-09-18.
 *
 * Baseline before the allowlist: 977 files / 8.4 MB, 225 test artifacts.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { removeFixtureTree } from "./test-tmp.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface PackedFile {
  path: string;
  size: number;
  mode: number;
}
interface PackResult {
  name: string;
  version: string;
  size: number;
  unpackedSize: number;
  files: PackedFile[];
}

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

function npm(args: string[], cwd: string) {
  // npm_execpath points at npm's own JS entry point when the suite runs under
  // `npm test` (and avoids npm.cmd resolution on Windows).
  const execpath = process.env.npm_execpath;
  const command = execpath ? process.execPath : "npm";
  const argv = execpath ? [execpath, ...args] : args;
  return spawnSync(command, argv, { cwd, encoding: "utf8" });
}

/** `npm pack --json` is keyed by package name; older npm returned an array. */
function parsePackResult(stdout: string): PackResult {
  const start = stdout.indexOf("{");
  const raw = JSON.parse(start >= 0 ? stdout.slice(start) : stdout) as unknown;
  const entry = Array.isArray(raw) ? raw[0] : Object.values(raw as Record<string, PackResult>)[0];
  if (!entry || typeof entry !== "object" || !Array.isArray(entry.files)) {
    throw new Error(`unexpected npm pack --json payload: ${stdout.slice(0, 200)}`);
  }
  return entry;
}

/**
 * Fresh-clone stand-in: the working tree's non-ignored file set (tracked +
 * untracked-but-uncommitted, so the test also works before the change is
 * committed) plus a node_modules symlink (the same trick `arggon start
 * --worktree` uses), so `prepare` can run tsc while `dist/` stays absent.
 * Ignored paths (`dist/`, generated bundles) never exist in a clone either.
 */
function freshCloneCopy(): string {
  const dir = _mkdtempSync(join(tmpdir(), "arggon-pack-"));
  tmpDirs.push(dir);
  const listed = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  );
  expect(listed.status, listed.stderr).toBe(0);
  for (const rel of listed.stdout.split("\0")) {
    if (rel === "") continue;
    // The worktree's node_modules is a symlink and (directory-only ignore
    // pattern) not ignored: it is linked in below instead of copied.
    if (rel === "node_modules" || rel.startsWith("node_modules/")) continue;
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(root, rel), dest);
  }
  symlinkSync(join(root, "node_modules"), join(dir, "node_modules"), "junction");
  return dir;
}

describe("npm pack contents", () => {
  it("pins prepare/postbuild as part of the install contract", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    // prepare builds on install-from-clone (fresh clone without pre-build).
    expect(pkg.scripts?.prepare).toMatch(/\bbuild\b/);
    // postbuild bakes the build identity and sets the bin's exec bit.
    expect(pkg.scripts?.postbuild).toBeTruthy();
  });

  it("ships the allowlist only, built from a fresh clone without pre-build", () => {
    const clone = freshCloneCopy();
    // The precondition that makes the prepare assertion meaningful.
    expect(existsSync(join(clone, "dist"))).toBe(false);

    const pack = npm(["pack", "--dry-run", "--json"], clone);
    expect(pack.status, `${pack.stdout.slice(0, 2000)}\n${pack.stderr}`).toBe(0);
    const result = parsePackResult(pack.stdout);

    // prepare ran the build in the clone: dist/cli.js exists there now.
    expect(existsSync(join(clone, "dist", "cli.js"))).toBe(true);
    const baked = JSON.parse(readFileSync(join(clone, "dist", "build-info.json"), "utf8")) as {
      version?: string;
    };
    expect(baked.version).toBe(result.version);

    const paths = result.files.map((f) => f.path);
    // 1. Nothing outside the allowlist: `files` is the whole contract.
    const allowedTopLevel = new Set([
      "dist",
      "templates",
      "skills",
      "opencode",
      "package.json",
      "README.md",
      "LICENSE",
    ]);
    expect(paths.filter((p) => !allowedTopLevel.has(p.split("/")[0]))).toEqual([]);
    // 2. No test artifact anywhere: neither compiled `*.test.*` sources nor the
    //    test-only `test-tmp` teardown helper (the 2026-09-18 bug bundled 225).
    expect(paths.filter((p) => /\.test\.|(^|\/)test-tmp\./.test(p))).toEqual([]);
    // 3. Runtime assets `arggon init` reads from the package + the bin.
    for (const required of [
      "dist/cli.js",
      "dist/build-info.json",
      "templates/task.md",
      "skills/arggon-cli/SKILL.md",
      "opencode/plugins/arggon/index.ts",
      "README.md",
      "LICENSE",
      "package.json",
    ]) {
      expect(paths, `tarball is missing ${required}`).toContain(required);
    }
    // 4. The bin ships executable (postbuild chmod).
    const bin = result.files.find((f) => f.path === "dist/cli.js");
    if (process.platform !== "win32") expect((bin?.mode ?? 0) & 0o111).not.toBe(0);
    // 5. Slim: generous bounds, well below the 977 files / 8.4 MB baseline.
    expect(result.files.length).toBeLessThan(400);
    expect(result.size).toBeLessThan(4 * 1024 * 1024);
  }, 120_000);
});
