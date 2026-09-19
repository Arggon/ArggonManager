#!/usr/bin/env node
/**
 * postbuild: bake build provenance into `dist/build-info.json` and make the
 * compiled bin executable.
 *
 * Installed copies do not live in a git work tree (a global npm prefix, or a
 * consumer's `node_modules/`), so `arggon --version` cannot probe git there —
 * it reads this file instead (cli/src/build-info.ts). `prepare` runs the build
 * on install-from-clone, so the tarball/install records which checkout it came
 * from; side-by-side installs (e.g. `main` vs `opencode2`) stay
 * distinguishable.
 *
 * `tsc` emits `dist/cli.js` mode 0644; without the chmod, a manual symlink to
 * the bin fails with "Permission denied". npm's own bin-linking (`npm link`,
 * `npm install -g`) sets the bit, but a plain `ln -s <checkout>/dist/cli.js`
 * does not — so the build guarantees it.
 *
 * Failure-isolated: no git, no commits, or no work tree → the file still
 * records the version. Packaging never fails because git is unavailable.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  try {
    const out = execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    return out === "" ? undefined : out;
  } catch {
    return undefined;
  }
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const sha = git(["rev-parse", "--short", "HEAD"]);
const head = git(["rev-parse", "--abbrev-ref", "HEAD"]);
// Detached HEAD reports "HEAD" — a branch name only when we actually have one.
const branch = head === "HEAD" ? undefined : head;

const info = {
  version: typeof pkg.version === "string" ? pkg.version : "0.0.0",
  ...(sha ? { sha } : {}),
  ...(branch ? { branch } : {}),
  builtAt: new Date().toISOString(),
};

const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "build-info.json"), `${JSON.stringify(info, null, 2)}\n`);
chmodSync(join(dist, "cli.js"), 0o755);
