/**
 * Build identification for `arggon --version` (task-npm-packaging): the semver
 * prefix is always preserved, a git identity is appended when one can be
 * determined (live work tree, else the build's baked `dist/build-info.json`),
 * and every failure path degrades to the bare version instead of failing the
 * command.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync as _mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { arggonVersion } from "./docs.js";
import {
  buildVersion,
  formatBuildVersion,
  probeGitBuildInfo,
  readBakedBuildInfo,
} from "./build-info.js";
import { initFixtureRepo, removeFixtureTree } from "./test-tmp.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");
const cliEntry = resolve(root, "cli/src/cli.ts");

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});
function tempDir(prefix: string): string {
  const dir = _mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** A fixture repo with one commit, for the live-probe paths. */
function committedRepo(prefix: string): string {
  const dir = tempDir(prefix);
  initFixtureRepo(dir);
  writeFileSync(join(dir, "file.txt"), "x\n");
  execFileSync("git", ["add", "file.txt"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init", "--quiet"], { cwd: dir, stdio: "ignore" });
  return dir;
}

function writeBaked(rootDir: string, info: Record<string, string>): void {
  mkdirSync(join(rootDir, "dist"), { recursive: true });
  writeFileSync(join(rootDir, "dist", "build-info.json"), JSON.stringify(info));
}

describe("formatBuildVersion", () => {
  it("renders the bare semver prefix when no identity is known", () => {
    expect(formatBuildVersion("0.3.0", undefined)).toBe("0.3.0");
    expect(formatBuildVersion("0.3.0", {})).toBe("0.3.0");
  });

  it("appends sha and branch inside parentheses", () => {
    expect(formatBuildVersion("0.3.0", { sha: "abc1234", branch: "opencode2" })).toBe(
      "0.3.0 (abc1234, opencode2)",
    );
  });

  it("renders partial identities without empty slots", () => {
    expect(formatBuildVersion("0.3.0", { sha: "abc1234" })).toBe("0.3.0 (abc1234)");
    expect(formatBuildVersion("0.3.0", { branch: "opencode2" })).toBe("0.3.0 (opencode2)");
  });
});

describe("probeGitBuildInfo", () => {
  it("reports the sha and branch of a work-tree top level", () => {
    const repo = committedRepo("arggon-buildinfo-git-");
    const info = probeGitBuildInfo(repo);
    expect(info?.sha).toMatch(/^[0-9a-f]{7,}$/);
    expect(info?.branch).toBe("main");
  });

  it("refuses a subdirectory: a consumer repo's git is not the build's identity", () => {
    const repo = committedRepo("arggon-buildinfo-nested-");
    const nested = join(repo, "node_modules", "arggon-manager");
    mkdirSync(nested, { recursive: true });
    expect(probeGitBuildInfo(nested)).toBeUndefined();
  });

  it("returns undefined outside a git work tree", () => {
    expect(probeGitBuildInfo(tempDir("arggon-buildinfo-nogit-"))).toBeUndefined();
  });
});

describe("readBakedBuildInfo", () => {
  it("reads sha and branch from dist/build-info.json", () => {
    const dir = tempDir("arggon-buildinfo-baked-");
    writeBaked(dir, { version: "0.3.0", sha: "abc1234", branch: "opencode2" });
    expect(readBakedBuildInfo(dir)).toEqual({ sha: "abc1234", branch: "opencode2" });
  });

  it("ignores missing, corrupt and identity-less files", () => {
    const dir = tempDir("arggon-buildinfo-empty-");
    expect(readBakedBuildInfo(dir)).toBeUndefined();
    writeBaked(dir, { version: "0.3.0" });
    expect(readBakedBuildInfo(dir)).toBeUndefined();
    writeFileSync(join(dir, "dist", "build-info.json"), "{ not json");
    expect(readBakedBuildInfo(dir)).toBeUndefined();
  });
});

describe("buildVersion", () => {
  it("prefers the live work tree identity over baked metadata", () => {
    const repo = committedRepo("arggon-buildinfo-live-");
    writeBaked(repo, { version: "0.3.0", sha: "deadbeef", branch: "baked-branch" });

    const live = probeGitBuildInfo(repo);
    expect(live?.sha).toBeDefined();
    const version = buildVersion(repo);
    expect(version).toBe(`${arggonVersion()} (${live?.sha}, main)`);
    expect(version).not.toContain("deadbeef");
  });

  it("falls back to baked metadata when the root is not a work tree", () => {
    const dir = tempDir("arggon-buildinfo-fallback-");
    writeBaked(dir, { version: "0.3.0", sha: "abc1234", branch: "opencode2" });
    expect(buildVersion(dir)).toBe(`${arggonVersion()} (abc1234, opencode2)`);
  });

  it("falls back to the bare version with no source at all", () => {
    expect(buildVersion(tempDir("arggon-buildinfo-none-"))).toBe(arggonVersion());
  });
});

describe("arggon --version", () => {
  it("prints the semver prefix plus the checkout identity", () => {
    const proc = spawnSync(process.execPath, [tsx, cliEntry, "--version"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(proc.status, proc.stderr).toBe(0);
    const printed = proc.stdout.trim();
    expect(printed.startsWith(arggonVersion())).toBe(true);
    // Same composition the CLI performs at startup (packageRoot() is `root`
    // for a tsx run from the checkout): pins the wiring, not just the format.
    expect(printed).toBe(buildVersion(root));
    expect(printed).toContain("(");
  });
});
