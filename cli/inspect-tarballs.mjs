#!/usr/bin/env node
/**
 * Extract-and-inspect both packed tarballs BEFORE any publish — the runbook §2
 * checks, scripted (spec-release-pipeline-015 AC A11). Runs in
 * `.github/workflows/release.yml` between `npm pack` and the first `npm
 * publish`; any failure fails the run before anything ships.
 *
 * Checks (contents, not file lists — the tarballs are extracted):
 *   - lib: `package.json` version matches, `dist/index.js` exists, and every
 *     VALUE export name parsed from `lib/src/index.ts` (the same commit's
 *     source of truth) is actually present in the shipped `dist/*.js` — a
 *     stale `lib/dist` ships stale kernel exports (runbook gotcha);
 *   - root: `package.json` version matches, `dist/cli.js` present, the runtime
 *     asset dirs `templates/`, `skills/`, `opencode/` ship, and ZERO
 *     test-helper leaks (`test-spawn` / `test-tmp` / `pack-fixtures` are
 *     excluded by `files`, and any `*.test.*` artifact is a packaging bug —
 *     the 2026-09-18 class).
 *
 * Usage: `node cli/inspect-tarballs.mjs <pack-dir> --version <V> [--repo-root <dir>]`
 * Expects `arggon-manager-<V>.tgz` and `arggondev-lib-<V>.tgz` in <pack-dir>
 * (the names `npm pack` produces). Exit 0 — all checks pass; exit 1 — one or
 * more checks failed (every failure is printed); exit 2 — usage/IO error.
 *
 * Offline-testable by design: the fixture tests synthesize tarballs with
 * `tar` (cli/inspect-tarballs.test.ts) — a pass fixture mirroring the
 * real layout plus deliberately broken ones per check.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LEAK_PATTERN = /(^|\/)(test-tmp|test-spawn|pack-fixtures)\.|\.(test|spec)\.[cm]?[jt]sx?$/;

/** Value-export names in `lib/src/index.ts` (type-only re-exports excluded). */
export function kernelExportNames(repoRoot) {
  const src = readFileSync(join(repoRoot, "lib", "src", "index.ts"), "utf8");
  const noComments = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const names = [];
  for (const block of noComments.matchAll(/export\s*\{([^}]*)\}/gs)) {
    for (let piece of block[1].split(",")) {
      piece = piece.trim();
      if (!piece) continue;
      const alias = piece.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/);
      names.push(alias ? alias[1] : piece.split(/\s/)[0]);
    }
  }
  return names;
}

function sh(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** Entry list + extracted `package/` tree for one tarball, in a temp dir. */
function extract(tarball, workDir, label) {
  const dir = mkdtempSync(join(workDir, `${label}-`));
  sh("tar", ["-xzf", tarball, "-C", dir]);
  const entries = sh("tar", ["-tzf", tarball]).split("\n").filter(Boolean);
  return { dir, entries };
}

/** Every `name=value` failure is collected; the run fails after all checks. */
function main() {
  const argv = process.argv.slice(2);
  const packDir = argv[0];
  const versionFlag = argv.indexOf("--version");
  const rootFlag = argv.indexOf("--repo-root");
  if (!packDir || versionFlag === -1 || !argv[versionFlag + 1]) {
    console.error("usage: node cli/inspect-tarballs.mjs <pack-dir> --version <V> [--repo-root <dir>]");
    process.exitCode = 2;
    return;
  }
  const version = argv[versionFlag + 1];
  const repoRoot = resolve(rootFlag !== -1 && argv[rootFlag + 1] ? argv[rootFlag + 1] : process.cwd());
  const libTgz = join(packDir, `arggondev-lib-${version}.tgz`);
  const rootTgz = join(packDir, `arggon-manager-${version}.tgz`);
  for (const tarball of [libTgz, rootTgz]) {
    try {
      readFileSync(tarball);
    } catch {
      console.error(`inspect-tarballs: expected packed tarball is missing: ${tarball}`);
      process.exitCode = 2;
      return;
    }
  }

  const workDir = mkdtempSync(join(tmpdir(), "arggon-inspect-"));
  const failures = [];
  const pass = (what) => console.log(`inspect-tarballs: ok - ${what}`);
  try {
    const lib = extract(libTgz, workDir, "lib");
    const root = extract(rootTgz, workDir, "root");

    // --- lib: version + kernel exports actually shipped -----------------------
    const libPkg = JSON.parse(readFileSync(join(lib.dir, "package", "package.json"), "utf8"));
    if (libPkg.version === version) pass(`lib package.json version is ${version}`);
    else failures.push(`lib tarball version ${libPkg.version} != expected ${version}`);

    const libDist = join(lib.dir, "package", "dist");
    if (readdirSyncSafe(join(libDist, "index.js")) !== null) pass("lib ships dist/index.js");
    else failures.push("lib tarball is missing dist/index.js (stale or absent build)");

    const distJs = collectFiles(libDist)
      .filter((f) => f.endsWith(".js"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const names = kernelExportNames(repoRoot);
    const missing = names.filter((name) => !new RegExp(`\\b${name}\\b`).test(distJs));
    if (names.length > 0 && missing.length === 0) {
      pass(`all ${names.length} kernel export symbols from lib/src/index.ts are present in dist/*.js`);
    } else if (names.length === 0) {
      failures.push("no value exports parsed from lib/src/index.ts — parser or source broken");
    } else {
      failures.push(`kernel exports missing from the shipped dist/*.js: ${missing.join(", ")}`);
    }

    // --- root: version + artifacts + zero test-helper leaks -------------------
    const rootPkg = JSON.parse(readFileSync(join(root.dir, "package", "package.json"), "utf8"));
    if (rootPkg.version === version) pass(`root package.json version is ${version}`);
    else failures.push(`root tarball version ${rootPkg.version} != expected ${version}`);

    for (const artifact of ["package/dist/cli.js"]) {
      if (readdirSyncSafe(join(root.dir, artifact)) !== null) pass(`root ships ${artifact}`);
      else failures.push(`root tarball is missing ${artifact}`);
    }
    for (const dir of ["templates", "skills", "opencode"]) {
      const shipped = collectFiles(join(root.dir, "package", dir));
      if (shipped.length > 0) pass(`root ships ${dir}/ (${shipped.length} files)`);
      else failures.push(`root tarball ships nothing under ${dir}/`);
    }
    const leaks = root.entries.filter((entry) => LEAK_PATTERN.test(entry));
    if (leaks.length === 0) pass("zero test-helper leaks in the root tarball");
    else failures.push(`test-helper leaks in the root tarball: ${leaks.join(", ")}`);
    const libLeaks = lib.entries.filter((entry) => LEAK_PATTERN.test(entry));
    if (libLeaks.length === 0) pass("zero test-helper leaks in the lib tarball");
    else failures.push(`test-helper leaks in the lib tarball: ${libLeaks.join(", ")}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`inspect-tarballs: FAIL - ${failure}`);
    console.error(`inspect-tarballs: ${failures.length} check(s) failed — refusing to publish`);
    process.exitCode = 1;
    return;
  }
  console.log("inspect-tarballs: all checks passed - safe to publish");
}

function readdirSyncSafe(path) {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

function collectFiles(dir) {
  const out = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = join(current, entry.name);
      if (entry.isDirectory()) walk(child);
      else out.push(child);
    }
  };
  walk(dir);
  return out;
}

// Direct-run guard: the test suite imports the pure parts above.
const invokedDirectly = (() => {
  try {
    return (
      process.argv[1] !== undefined &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
if (invokedDirectly) main();
