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
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectDeclaredDependencies,
  inspectGateBinResolution,
  MAX_MISSING_DEPENDENCIES,
  MAX_GATE_BINS,
  prepareWorktreeDependencies,
} from "./worktree.js";

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

/** Like `fixture`, but the returned `parent` carries no install of its own. */
function siblingFixture(): { primary: string; worktree: string; parent: string } {
  const parent = mkdtempSync(join(tmpdir(), "arggon-worktree-kernel-"));
  roots.push(parent);
  const primary = join(parent, "primary");
  const worktree = join(parent, "worktree");
  mkdirSync(primary, { recursive: true });
  mkdirSync(worktree, { recursive: true });
  return { primary, worktree, parent };
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

/** One installed package directory in the primary's `node_modules`. */
function addInstalledPackage(primary: string, name: string, version = "1.0.0"): void {
  const dir = join(primary, "node_modules", ...name.split("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version, main: "index.js" }));
}

/** The worktree's own manifest — what the preparation receipt checks against. */
function setManifest(dir: string, manifest: Record<string, unknown>): void {
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
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
      // A manifest-less worktree declares nothing, so nothing can be missing;
      // `ready` is false because there is no install at all.
      manifestCoverage: "satisfied",
      missingDependencies: [],
      missingDependenciesTotal: 0,
      // Nothing is declared, so the gate-bin probe has nothing to report.
      gateBins: [],
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
      // A worktree with no manifest of its own declares nothing, so nothing can
      // be missing: ready stays true for the project-gate-only case.
      manifestCoverage: "satisfied",
      missingDependencies: [],
      missingDependenciesTotal: 0,
      // Nothing declared, so no gate bin is probed and ready is unaffected.
      gateBins: [],
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
      manifestCoverage: "satisfied",
      missingDependencies: [],
      missingDependenciesTotal: 0,
      gateBins: [],
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

/**
 * A linked install MIRRORS the primary's entries, so it is only as current as
 * that install: a dependency declared after the primary's last install is
 * missing from every worktree until the primary is re-installed
 * (bug-worktree-readiness-misses-stale-primary-install). The receipt must name
 * it instead of reporting the mirrored install as ready — deterministically,
 * with no real package manager involved.
 */
describe("prepareWorktreeDependencies reports a stale mirrored install", () => {
  it("names the declared dependency the linked install does not provide", () => {
    const { primary, worktree } = fixture();
    addInstalledPackage(primary, "gate-dep");
    setManifest(worktree, {
      name: "worktree-fixture",
      dependencies: { "gate-dep": "^1.0.0" },
      devDependencies: { "@ast-grep/cli": "0.45.3" },
    });

    const receipt = prepareWorktreeDependencies(primary, worktree);

    expect(receipt).toEqual({
      // The install is there and linked — the linked-install signal is unchanged.
      install: "linked",
      linkedNodeModules: true,
      builtWorkspaces: [],
      linkedWorkspaces: [],
      // …and readiness is NOT silently claimed for it.
      ready: false,
      manifestCoverage: "stale",
      missingDependencies: ["@ast-grep/cli"],
      missingDependenciesTotal: 1,
      // The gate-bin probe (bug-start-worktree-npm-ci-claim): gate-dep is
      // installed but exposes no bin, so it is not probed; the uninstalled
      // @ast-grep/cli is probed under its own name (npm's string-bin
      // convention) and reports missing.
      gateBins: [{ name: "@ast-grep/cli", source: "missing" }],
    });
  });

  it("is satisfied when the install provides every declared dependency", () => {
    const { primary, worktree } = fixture();
    addInstalledPackage(primary, "gate-dep");
    addInstalledPackage(primary, "@ast-grep/cli");
    setManifest(worktree, {
      dependencies: { "gate-dep": "^1.0.0" },
      devDependencies: { "@ast-grep/cli": "0.45.3" },
    });

    expect(prepareWorktreeDependencies(primary, worktree)).toMatchObject({
      ready: true,
      manifestCoverage: "satisfied",
      missingDependencies: [],
      missingDependenciesTotal: 0,
    });
  });

  it("caps the named list but keeps the full count", () => {
    const { primary, worktree } = fixture();
    mkdirSync(join(primary, "node_modules"), { recursive: true });
    const declared: Record<string, string> = {};
    for (let i = 0; i < MAX_MISSING_DEPENDENCIES + 3; i += 1) {
      declared[`absent-dep-${i}`] = "1.0.0";
    }
    setManifest(worktree, { devDependencies: declared });

    const receipt = prepareWorktreeDependencies(primary, worktree);

    expect(receipt.manifestCoverage).toBe("stale");
    expect(receipt.ready).toBe(false);
    expect(receipt.missingDependencies).toHaveLength(MAX_MISSING_DEPENDENCIES);
    expect(receipt.missingDependencies).toEqual(
      [...Object.keys(declared)].sort().slice(0, MAX_MISSING_DEPENDENCIES),
    );
    expect(receipt.missingDependenciesTotal).toBe(MAX_MISSING_DEPENDENCIES + 3);
  });

  it("checks presence, not versions, and never fails on an absent optionalDependency", () => {
    const { primary, worktree } = fixture();
    addInstalledPackage(primary, "gate-dep", "1.0.0");
    setManifest(worktree, {
      // Installed 1.0.0 against `^9.9.9`: the check is presence, not range
      // satisfaction, and says so rather than pretending to verify versions.
      dependencies: { "gate-dep": "^9.9.9" },
      // Absent on purpose: an optionalDependency that is not installed is
      // exactly what that field allows.
      optionalDependencies: { "never-installed": "1.0.0" },
    });

    expect(prepareWorktreeDependencies(primary, worktree)).toMatchObject({
      ready: true,
      manifestCoverage: "satisfied",
      missingDependencies: [],
    });
  });

  it("reports unknown (never satisfied) when the manifest cannot be read", () => {
    const { primary, worktree } = fixture();
    mkdirSync(join(primary, "node_modules"), { recursive: true });
    writeFileSync(join(worktree, "package.json"), "{ not json");

    const receipt = prepareWorktreeDependencies(primary, worktree);

    expect(receipt.install).toBe("linked");
    expect(receipt.manifestCoverage).toBe("unknown");
    expect(receipt.ready).toBe(false);
  });

  it("reads a BOM-ed manifest npm also accepts, and still rejects what npm rejects", () => {
    // npm's parser (json-parse-even-better-errors) strips a UTF-8 BOM, so a
    // BOM-ed package.json installs fine there: withholding readiness for it
    // would report a stale install that does not exist. Comments/trailing
    // commas are EJSONPARSE in npm, so they stay `unknown` — the check tracks
    // npm's tolerance instead of inventing its own.
    const { primary, worktree } = fixture();
    addInstalledPackage(primary, "gate-dep");
    writeFileSync(
      join(worktree, "package.json"),
      `\uFEFF${JSON.stringify({ dependencies: { "gate-dep": "^1.0.0" } })}`,
    );

    expect(prepareWorktreeDependencies(primary, worktree)).toMatchObject({
      ready: true,
      manifestCoverage: "satisfied",
      missingDependencies: [],
    });

    writeFileSync(
      join(worktree, "package.json"),
      `{ // npm rejects this with EJSONPARSE\n"dependencies": { "gate-dep": "^1.0.0" }, }`,
    );
    expect(prepareWorktreeDependencies(primary, worktree)).toMatchObject({
      manifestCoverage: "unknown",
      ready: false,
    });
  });
});

describe("inspectDeclaredDependencies", () => {
  it("resolves a dependency through a parent install, the way a bare specifier would", () => {
    const { primary, worktree } = fixture();
    // `fixture()` roots both trees under one parent, so this is the parent
    // `node_modules` Node itself would consult from the worktree.
    const parentDep = join(dirname(primary), "node_modules", "parent-dep");
    mkdirSync(parentDep, { recursive: true });
    writeFileSync(
      join(parentDep, "package.json"),
      JSON.stringify({ name: "parent-dep", version: "1.0.0" }),
    );
    setManifest(worktree, { dependencies: { "parent-dep": "1.0.0" } });

    expect(inspectDeclaredDependencies(worktree)).toEqual({
      coverage: "satisfied",
      missing: [],
      missingTotal: 0,
    });
  });

  it("is satisfied for a directory that declares nothing, unknown for one with no install", () => {
    const { worktree } = fixture();
    expect(inspectDeclaredDependencies(worktree)).toEqual({
      coverage: "satisfied",
      missing: [],
      missingTotal: 0,
    });

    setManifest(worktree, { devDependencies: { "any-dep": "1.0.0" } });
    expect(inspectDeclaredDependencies(worktree)).toEqual({
      coverage: "unknown",
      missing: [],
      missingTotal: 0,
    });
  });
});

/**
 * Which node_modules the project gate's binaries resolve from
 * (bug-start-worktree-npm-ci-claim). A fresh worktree with no install used to
 * fail its claim commit with a bare `tsx: command not found`, and a sibling
 * checkout's `.bin` on the invoking PATH could run the gate against a foreign
 * install while the worktree resolved nothing. The probe reports the source of
 * each gate bin so readiness can name both flavors. Every test passes an
 * explicit env: the runner's own PATH must never decide an assertion.
 */
describe("inspectGateBinResolution", () => {
  /** An empty env: no PATH, so a `path` source is only ever an injected one. */
  const noPath: NodeJS.ProcessEnv = {};

  function addInstalledPackageWithBins(
    primary: string,
    name: string,
    bins: Record<string, string> | string,
  ): void {
    addInstalledPackage(primary, name);
    const dir = join(primary, "node_modules", ...name.split("/"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0", bin: bins }));
  }

  it("reports a bin present in the worktree's own install as worktree", () => {
    const { primary, worktree } = fixture();
    setManifest(worktree, { devDependencies: { tsx: "^1.0.0" } });
    addInstalledPackageWithBins(primary, "tsx", { tsx: "./cli.mjs" });
    const worktreeBin = join(worktree, "node_modules", ".bin");
    mkdirSync(worktreeBin, { recursive: true });
    writeFileSync(join(worktreeBin, "tsx"), "#!/bin/sh\n");

    expect(inspectGateBinResolution(worktree, primary, noPath)).toEqual([
      { name: "tsx", source: "worktree", path: join(worktreeBin, "tsx") },
    ]);
  });

  it("reports a bin found on an injected PATH as the masking flavor, with its source", () => {
    const { primary, worktree, parent } = siblingFixture();
    setManifest(worktree, { devDependencies: { "gate-dep": "^1.0.0" } });
    // The dep is installed in the primary WITH a bin field (so the gate can
    // legitimately invoke it), but the worktree resolves nothing itself.
    addInstalledPackageWithBins(primary, "gate-dep", { "gate-dep": "./cli.js" });
    const siblingBinDir = join(parent, "sibling", "node_modules", ".bin");
    mkdirSync(siblingBinDir, { recursive: true });
    writeFileSync(join(siblingBinDir, "gate-dep"), "#!/bin/sh\n");

    const env: NodeJS.ProcessEnv = { PATH: siblingBinDir };
    expect(inspectGateBinResolution(worktree, primary, env)).toEqual([
      { name: "gate-dep", source: "path", path: join(siblingBinDir, "gate-dep") },
    ]);
  });

  it("reports missing when nothing resolves anywhere", () => {
    const { primary, worktree } = fixture();
    setManifest(worktree, { devDependencies: { "gate-dep": "^1.0.0" } });

    // gate-dep is not installed anywhere, so its own name is probed (npm's
    // string-bin convention) and nothing resolves: source "missing", no path.
    expect(inspectGateBinResolution(worktree, primary, noPath)).toEqual([
      { name: "gate-dep", source: "missing" },
    ]);
  });

  it("reports a bin from an install above the worktree as external", () => {
    const { primary, worktree, parent } = siblingFixture();
    setManifest(worktree, { devDependencies: { "gate-dep": "^1.0.0" } });
    // No worktree or primary install; the parent carries the bin.
    const parentBinDir = join(parent, "node_modules", ".bin");
    mkdirSync(parentBinDir, { recursive: true });
    writeFileSync(join(parentBinDir, "gate-dep"), "#!/bin/sh\n");

    expect(inspectGateBinResolution(worktree, primary, noPath)).toEqual([
      { name: "gate-dep", source: "external", path: join(parentBinDir, "gate-dep") },
    ]);
  });

  it("prefers the worktree's own resolution over PATH and parent installs", () => {
    const { primary, worktree, parent } = siblingFixture();
    setManifest(worktree, { devDependencies: { "gate-dep": "^1.0.0" } });
    addInstalledPackageWithBins(primary, "gate-dep", { "gate-dep": "./cli.js" });
    const worktreeBin = join(worktree, "node_modules", ".bin");
    mkdirSync(worktreeBin, { recursive: true });
    writeFileSync(join(worktreeBin, "gate-dep"), "#!/bin/sh\n");
    const siblingBinDir = join(parent, "sibling", "node_modules", ".bin");
    mkdirSync(siblingBinDir, { recursive: true });
    writeFileSync(join(siblingBinDir, "gate-dep"), "#!/bin/sh\n");

    const env: NodeJS.ProcessEnv = { PATH: siblingBinDir };
    const bins = inspectGateBinResolution(worktree, primary, env);
    expect(bins).toHaveLength(1);
    expect(bins[0].source).toBe("worktree");
  });

  it("uses the real bin names of an installed package, not a guessed one", () => {
    const { primary, worktree } = fixture();
    setManifest(worktree, { devDependencies: { typescript: "^5.0.0" } });
    // typescript's bins are tsc/tsserver — the package name itself is no bin.
    addInstalledPackageWithBins(primary, "typescript", { tsc: "./bin/tsc" });
    const worktreeBin = join(worktree, "node_modules", ".bin");
    mkdirSync(worktreeBin, { recursive: true });
    writeFileSync(join(worktreeBin, "tsc"), "#!/bin/sh\n");

    expect(inspectGateBinResolution(worktree, primary, noPath)).toEqual([
      { name: "tsc", source: "worktree", path: join(worktreeBin, "tsc") },
    ]);
  });

  it("skips installed packages that expose no bin and caps the report", () => {
    const { primary, worktree } = fixture();
    const devDependencies: Record<string, string> = {};
    for (let index = 0; index < MAX_GATE_BINS + 2; index += 1) {
      const name = `binned-dep-${index}`;
      devDependencies[name] = "1.0.0";
      addInstalledPackageWithBins(primary, name, { [name]: "./cli.js" });
    }
    // An installed, bin-less dependency must not be probed under a guess.
    devDependencies["plain-dep"] = "1.0.0";
    addInstalledPackage(primary, "plain-dep");
    setManifest(worktree, { devDependencies });

    const bins = inspectGateBinResolution(worktree, primary, noPath);
    expect(bins).toHaveLength(MAX_GATE_BINS);
    expect(bins.map((bin) => bin.name)).toEqual(
      Array.from({ length: MAX_GATE_BINS }, (_, index) => `binned-dep-${index}`),
    );
    expect(bins.every((bin) => bin.source === "missing")).toBe(true);
  });

  it("reports nothing when the manifest declares nothing", () => {
    const { primary, worktree } = fixture();
    expect(inspectGateBinResolution(worktree, primary, noPath)).toEqual([]);
  });
});
