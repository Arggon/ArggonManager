/**
 * Direct kernel tests for the shared worktree dependency-preparation contract.
 * The CLI/native integration tests exercise the surrounding git flow; these
 * tests pin the filesystem receipt itself so both callers cannot drift on
 * missing installs, link farms, or a failed local workspace build.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareWorktreeDependencies } from "./worktree.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): { primary: string; worktree: string } {
  const parent = mkdtempSync(join(tmpdir(), "arggon-worktree-kernel-"));
  roots.push(parent);
  const primary = join(parent, "primary");
  const worktree = join(parent, "worktree");
  mkdirSync(primary, { recursive: true });
  mkdirSync(worktree, { recursive: true });
  return { primary, worktree };
}

function addWorkspacePackage(primary: string, worktree: string): void {
  for (const root of [primary, worktree]) {
    const pkg = join(root, "lib");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({
        name: "@arggondev/lib",
        version: "1.0.0",
        main: "dist/index.js",
        scripts: { build: "ignored by the injected runner" },
      }),
    );
  }
  const scope = join(primary, "node_modules", "@arggondev");
  mkdirSync(scope, { recursive: true });
  symlinkSync(join(primary, "lib"), join(scope, "lib"), "dir");
}

describe("prepareWorktreeDependencies", () => {
  it("reports a missing install without claiming readiness", () => {
    const { primary, worktree } = fixture();

    expect(prepareWorktreeDependencies(primary, worktree)).toEqual({
      ready: false,
      install: "missing",
      linkedNodeModules: false,
      builtWorkspaces: [],
      linkedWorkspaces: [],
    });
  });

  it("links a primary install and reports it as ready for a plain worktree", () => {
    const { primary, worktree } = fixture();
    mkdirSync(join(primary, "node_modules"), { recursive: true });
    writeFileSync(join(primary, "node_modules", "gate-dep.js"), "module.exports = true;\n");

    const receipt = prepareWorktreeDependencies(primary, worktree);

    expect(receipt).toEqual({
      ready: true,
      install: "linked",
      linkedNodeModules: true,
      builtWorkspaces: [],
      linkedWorkspaces: [],
    });
    expect(lstatSync(join(worktree, "node_modules")).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(worktree, "node_modules", "gate-dep.js"), "utf8")).toContain("true");
  });

  it("reuses an existing worktree install instead of replacing it", () => {
    const { primary, worktree } = fixture();
    mkdirSync(join(primary, "node_modules"), { recursive: true });
    mkdirSync(join(worktree, "node_modules"), { recursive: true });
    writeFileSync(join(worktree, "node_modules", "local-marker"), "keep\n");

    const receipt = prepareWorktreeDependencies(primary, worktree);

    expect(receipt).toMatchObject({
      ready: true,
      install: "existing",
      linkedNodeModules: false,
    });
    expect(readFileSync(join(worktree, "node_modules", "local-marker"), "utf8")).toBe("keep\n");
  });

  it("builds and flips a worktree-owned workspace package", () => {
    const { primary, worktree } = fixture();
    addWorkspacePackage(primary, worktree);
    const calls: string[] = [];

    const receipt = prepareWorktreeDependencies(primary, worktree, {
      runBuild: (pkgDir) => {
        calls.push(pkgDir);
        mkdirSync(join(pkgDir, "dist"), { recursive: true });
        writeFileSync(join(pkgDir, "dist", "index.js"), "module.exports = 1;\n");
        return true;
      },
    });

    expect(calls).toEqual([join(worktree, "lib")]);
    expect(receipt).toEqual({
      ready: true,
      install: "linked",
      linkedNodeModules: true,
      builtWorkspaces: ["@arggondev/lib"],
      linkedWorkspaces: [],
    });
    expect(existsSync(join(worktree, "lib", "dist", "index.js"))).toBe(true);
    expect(lstatSync(join(worktree, "node_modules")).isSymbolicLink()).toBe(false);
  });

  it("keeps the primary workspace visible when its build fails", () => {
    const { primary, worktree } = fixture();
    addWorkspacePackage(primary, worktree);

    const receipt = prepareWorktreeDependencies(primary, worktree, {
      runBuild: () => false,
    });

    expect(receipt).toMatchObject({
      ready: false,
      install: "linked",
      linkedNodeModules: true,
      builtWorkspaces: [],
      linkedWorkspaces: ["@arggondev/lib"],
    });
    expect(existsSync(join(worktree, "lib", "dist", "index.js"))).toBe(false);
  });
});
