/**
 * Direct kernel tests for the shared worktree dependency-preparation contract.
 * The CLI/native integration tests exercise the surrounding git flow; these
 * tests pin the filesystem receipt itself so both callers cannot drift on
 * missing installs, link farms, or a failed local workspace build.
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  freshWorktreeInstallRefusal,
  inspectDeclaredDependencies,
  inspectGateBinResolution,
  MAX_MISSING_DEPENDENCIES,
  MAX_GATE_BINS,
  MAX_PREP_STEPS,
  parseTrackedModifications,
  prepareWorktreeDependencies,
  prepareWorktreeEnv,
  readWorktreeClaimStamp,
  type WorktreeClaimReceipt,
  strictGateBinFailure,
  strictGateBinViolations,
  strictWorktreeWriteFailure,
  unlinkWorktreeEnv,
  worktreeCacheBase,
  worktreeForeignWriteWarning,
  worktreeTakeoverWarning,
  worktreeComposeProject,
  worktreeStateBase,
  WORKTREE_ENV_KEYS,
  detectWorktreeForeignWrites,
  MAX_CLAIM_TAKEOVERS,
  MAX_CLAIM_WRITE_NAMES,
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
      // The preparation log names the skip (bug-start-install-ordering): the
      // primary had no install to link, which is the eight-incident record's
      // "no install at all" flavor — never silent again.
      steps: [
        { step: "link", outcome: "primary-install-missing" },
        { step: "gate-bins", outcome: "all-worktree" },
      ],
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
      // The log names the path that ran: bare symlink (no workspace packages
      // to shadow), probe verdict all-worktree (empty report is vacuous).
      steps: [
        { step: "link", outcome: "symlink-created" },
        { step: "gate-bins", outcome: "all-worktree" },
      ],
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
      // The skip is named (bug-start-install-ordering): the worktree already
      // had an install — an attach re-run, or a PARTIAL install left by an
      // interrupted npm ci, reused as-is.
      steps: expect.arrayContaining([{ step: "link", outcome: "worktree-install-present" }]),
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
      // The incident-relevant ordering, visible (bug-start-install-ordering):
      // the farm was laid, then the workspace build ran and flipped.
      steps: [
        { step: "link", outcome: "farm-created" },
        { step: "build", outcome: "built", pkg: "@arggondev/lib" },
        { step: "gate-bins", outcome: "all-worktree" },
      ],
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
      // A failed build is a named decision, not a silent fallback
      // (bug-start-install-ordering).
      steps: expect.arrayContaining([
        { step: "build", outcome: "build-failed", pkg: "@arggondev/lib" },
      ]),
    });
    expect(existsSync(join(worktree, "lib", "dist", "index.js"))).toBe(false);
  });

  it("records a failed link when neither farm nor symlink can be created", () => {
    const { primary, worktree } = fixture();
    addWorkspacePackage(primary, worktree);
    // A read-only worktree directory refuses mkdir and symlink: the whole
    // best-effort chain degrades to `false` — and the outcome must say so
    // instead of leaving an absent install unexplained.
    chmodSync(worktree, 0o500);

    try {
      const receipt = prepareWorktreeDependencies(primary, worktree);
      expect(receipt.linkedNodeModules).toBe(false);
      // The primary HAS an install this run could not link: `unavailable`,
      // never a ready state (bug-start-worktree-node-modules).
      expect(receipt.install).toBe("unavailable");
      expect(receipt.ready).toBe(false);
      expect(receipt.steps).toContainEqual({ step: "link", outcome: "failed" });
    } finally {
      chmodSync(worktree, 0o755);
    }
  });

  it("caps the preparation log and flags the truncation", () => {
    const { primary, worktree } = fixture();
    mkdirSync(join(primary, "node_modules"), { recursive: true });
    // MAX_PREP_STEPS + 1 workspace packages: every build decision is recorded
    // until the cap, then `stepsTruncated` is set — the log stays bounded
    // without pretending it saw everything.
    for (let index = 0; index < MAX_PREP_STEPS; index++) {
      const name = `@scope/pkg-${index}`;
      for (const root of [primary, worktree]) {
        const pkg = join(root, `pkg-${index}`);
        mkdirSync(pkg, { recursive: true });
        writeFileSync(
          join(pkg, "package.json"),
          JSON.stringify({ name, version: "1.0.0", main: "dist/index.js" }),
        );
      }
      const scope = join(primary, "node_modules", "@scope");
      mkdirSync(scope, { recursive: true });
      symlinkSync(join(primary, `pkg-${index}`), join(scope, `pkg-${index}`), "dir");
    }

    const receipt = prepareWorktreeDependencies(primary, worktree, {
      runBuild: (pkgDir) => {
        mkdirSync(join(pkgDir, "dist"), { recursive: true });
        writeFileSync(join(pkgDir, "dist", "index.js"), "module.exports = 1;\n");
        return true;
      },
    });

    expect(receipt.steps.length).toBe(MAX_PREP_STEPS);
    expect(receipt.stepsTruncated).toBe(true);
  });
});

describe("freshWorktreeInstallRefusal (bug-start-install-ordering)", () => {
  it("names the offending bin, the preparation log, and the npm ci fix", () => {
    const refusal = freshWorktreeInstallRefusal(
      [{ name: "tsx", source: "missing" }],
      "/repo-worktree",
      [
        { step: "link", outcome: "primary-install-missing" },
        { step: "gate-bins", outcome: "foreign-resolution" },
      ],
    );
    expect(refusal).toContain("refusing the claim commit");
    expect(refusal).toContain("fresh worktree must leave a gate-usable install");
    expect(refusal).toContain("tsx: not resolvable from the worktree");
    expect(refusal).toContain(
      "Preparation ran: link:primary-install-missing, gate-bins:foreign-resolution",
    );
    expect(refusal).toContain("npm ci");
    expect(refusal).toContain("/repo-worktree");
    expect(refusal).toContain("re-run start --worktree to attach");
  });

  it("names a PATH-masked bin with its sibling source", () => {
    const refusal = freshWorktreeInstallRefusal(
      [{ name: "tsx", source: "path", path: "/sibling/node_modules/.bin/tsx" }],
      "/repo-worktree",
    );
    expect(refusal).toContain(
      "tsx: resolves only via PATH from /sibling/node_modules/.bin/tsx (outside the worktree)",
    );
  });

  it("is null when every reported bin resolves from the worktree", () => {
    expect(
      freshWorktreeInstallRefusal(
        [{ name: "tsx", source: "worktree", path: "/wt/node_modules/.bin/tsx" }],
        "/wt",
      ),
    ).toBeNull();
  });

  it("is null for an empty report (nothing declared exposes a bin)", () => {
    // The documented carve-out: a project with no dependency-needing gate may
    // still have no install and commit the claim.
    expect(freshWorktreeInstallRefusal([], "/wt")).toBeNull();
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
      steps: [
        { step: "link", outcome: "symlink-created" },
        { step: "gate-bins", outcome: "foreign-resolution" },
      ],
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

describe("strictGateBinFailure (task-start-gate-strict-mode)", () => {
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

  it("is null when every reported bin resolves from the worktree", () => {
    const { primary, worktree } = fixture();
    setManifest(worktree, { devDependencies: { tsx: "^1.0.0" } });
    addInstalledPackageWithBins(primary, "tsx", { tsx: "./cli.mjs" });
    const worktreeBin = join(worktree, "node_modules", ".bin");
    mkdirSync(worktreeBin, { recursive: true });
    writeFileSync(join(worktreeBin, "tsx"), "#!/bin/sh\n");
    const bins = inspectGateBinResolution(worktree, primary, noPath);
    expect(strictGateBinViolations(bins)).toEqual([]);
    expect(strictGateBinFailure(bins, worktree)).toBeNull();
  });

  it("is null for an empty report (nothing declared exposes a bin)", () => {
    expect(strictGateBinFailure([], join("sep", "worktree"))).toBeNull();
  });

  it("names a PATH-resolved bin, its observed source, and the npm ci remediation", () => {
    const { primary, worktree, parent } = siblingFixture();
    setManifest(worktree, { devDependencies: { tsx: "^1.0.0" } });
    addInstalledPackageWithBins(primary, "tsx", { tsx: "./cli.mjs" });
    const siblingBin = join(parent, "sibling", "node_modules", ".bin", "tsx");
    mkdirSync(dirname(siblingBin), { recursive: true });
    writeFileSync(siblingBin, "#!/bin/sh\n");
    const bins = inspectGateBinResolution(worktree, primary, { PATH: dirname(siblingBin) });
    const message = strictGateBinFailure(bins, worktree);
    expect(strictGateBinViolations(bins)).toEqual([
      { name: "tsx", source: "path", path: siblingBin },
    ]);
    expect(message).toContain("x-tracker.strict-gate-bins");
    expect(message).toContain("refusing the claim commit");
    expect(message).toContain("tsx: resolves only via PATH from");
    expect(message).toContain(siblingBin);
    expect(message).toContain("npm ci");
    expect(message).toContain(worktree);
  });

  it("covers the bin-missing-everywhere flavor with the same actionable shape", () => {
    const { primary, worktree } = fixture();
    setManifest(worktree, { devDependencies: { nativegate: "^1.0.0" } });
    addInstalledPackage(primary, "unrelated");
    const bins = inspectGateBinResolution(worktree, primary, noPath);
    expect(bins).toEqual([{ name: "nativegate", source: "missing" }]);
    const message = strictGateBinFailure(bins, worktree);
    expect(message).toContain("nativegate: not resolvable from the worktree");
    expect(message).toContain("npm ci");
  });

  it("names an external (parent-directory) resolution as outside the worktree", () => {
    const { primary, worktree, parent } = siblingFixture();
    setManifest(worktree, { devDependencies: { tsx: "^1.0.0" } });
    addInstalledPackageWithBins(primary, "tsx", { tsx: "./cli.mjs" });
    // An install in a directory ABOVE the worktree: the module walk finds it
    // before PATH would matter, and the source is outside the worktree.
    const externalBin = join(parent, "node_modules", ".bin", "tsx");
    mkdirSync(dirname(externalBin), { recursive: true });
    writeFileSync(externalBin, "#!/bin/sh\n");
    const bins = inspectGateBinResolution(worktree, primary, noPath);
    expect(strictGateBinViolations(bins)).toEqual([
      { name: "tsx", source: "external", path: externalBin },
    ]);
    const message = strictGateBinFailure(bins, worktree);
    expect(message).toContain("tsx: resolves from");
    expect(message).toContain(externalBin);
  });
});

describe("prepareWorktreeEnv (spec worktree-env-contract-016)", () => {
  const identity = { itemId: "task-env", branch: "feat/task-env" };

  /**
   * Hermetic per-OS bases: XDG overrides (honored on Linux) plus a fake home
   * (the macOS/Windows bases derive from it). The tests assert EXISTENCE at
   * the location the exported platform mapping resolves — never a hardcoded
   * path, so the suite stays portable across the three supported platforms.
   */
  function hermetic(parent: string): { env: NodeJS.ProcessEnv; home: string } {
    return {
      env: {
        XDG_STATE_HOME: join(parent, "xdg-state"),
        XDG_CACHE_HOME: join(parent, "xdg-cache"),
      },
      home: join(parent, "home"),
    };
  }

  /** The env receipt for a fixture worktree, with hermetic dir bases. */
  function runEnv(f: { primary: string; worktree: string }) {
    return prepareWorktreeEnv(f.primary, f.worktree, {
      identity,
      ...hermetic(dirname(f.worktree)),
    });
  }

  it("writes .arggon.env with exactly the six documented keys on a fresh start", () => {
    const f = siblingFixture();
    const hermeticEnv = hermetic(f.parent);
    const receipt = prepareWorktreeEnv(f.primary, f.worktree, { identity, ...hermeticEnv });
    expect(receipt.written).toBe(true);
    expect(receipt.keys).toEqual([...WORKTREE_ENV_KEYS]);
    const raw = readFileSync(receipt.path ?? "", "utf8");
    // UTF-8, LF, no quoting: `KEY=value` lines, trailing newline, six lines.
    const lines = raw.split("\n");
    expect(lines[lines.length - 1]).toBe("");
    expect(lines.slice(0, -1)).toEqual([
      `ARGON_ITEM=${identity.itemId}`,
      `ARGGON_WORKTREE_ID=worktree`,
      `ARGGON_WORKTREE_PATH=${f.worktree}`,
      `ARGGON_WORKTREE_BRANCH=${identity.branch}`,
      `ARGGON_STATE_DIR=${join(worktreeStateBase(hermeticEnv.env, hermeticEnv.home), "worktree")}`,
      `ARGGON_CACHE_DIR=${join(worktreeCacheBase(hermeticEnv.env, hermeticEnv.home), "worktree")}`,
    ]);
  });

  it("creates the per-OS state and cache dirs (existence, not location)", () => {
    const f = fixture();
    runEnv(f);
    const { env, home } = hermetic(dirname(f.worktree));
    const worktreeId = "worktree";
    for (const dir of [
      join(worktreeStateBase(env, home), worktreeId),
      join(worktreeCacheBase(env, home), worktreeId),
    ]) {
      expect(existsSync(dir)).toBe(true);
      expect(lstatSync(dir).isDirectory()).toBe(true);
    }
  });

  it("leaves an existing .arggon.env byte-identical on attach (never-overwrite)", () => {
    const f = fixture();
    const custom = "ARGON_ITEM=adopter-owned\nCUSTOM=yes\n";
    writeFileSync(join(f.worktree, ".arggon.env"), custom, "utf8");
    const receipt = runEnv(f);
    expect(readFileSync(join(f.worktree, ".arggon.env"), "utf8")).toBe(custom);
    expect(receipt.written).toBe(false);
    expect(receipt.path).toBe(join(f.worktree, ".arggon.env"));
    expect(receipt.warning).toContain("byte-identical");
    expect(receipt.keys).toBeUndefined();
  });

  it("seeds .env from the primary only when the worktree has none", () => {
    const f = fixture();
    writeFileSync(join(f.primary, ".env"), "SECRET=primary-only\n", "utf8");
    const receipt = runEnv(f);
    expect(receipt.seededDotenv).toBe(join(f.worktree, ".env"));
    expect(readFileSync(join(f.worktree, ".env"), "utf8")).toBe("SECRET=primary-only\n");
    // Attach with an adopter-modified .env: never overwritten.
    writeFileSync(join(f.worktree, ".env"), "SECRET=adopter\n", "utf8");
    const attach = runEnv(f);
    expect(attach.seededDotenv).toBeUndefined();
    expect(readFileSync(join(f.worktree, ".env"), "utf8")).toBe("SECRET=adopter\n");
    // A worktree .env without a primary counterpart is left alone, too.
    const bare = fixture();
    writeFileSync(join(bare.worktree, ".env"), "SECRET=worktree\n", "utf8");
    const bareReceipt = runEnv(bare);
    expect(bareReceipt.seededDotenv).toBeUndefined();
    expect(readFileSync(join(bare.worktree, ".env"), "utf8")).toBe("SECRET=worktree\n");
  });

  it("surfaces seed failures as a receipt warning on every path (review should-fix)", () => {
    const f = fixture();
    writeFileSync(join(f.primary, ".env"), "SECRET=1\n", "utf8");
    // A broken symlink at the seed target: existsSync() is false (so the seed
    // path runs) while COPYFILE_EXCL fails with EEXIST (the name is taken) —
    // a deterministic, root-proof seed failure.
    symlinkSync(join(f.primary, "no-such-file"), join(f.worktree, ".env"));
    const fresh = runEnv(f);
    // (a) the fresh write SUCCEEDS and the failure still surfaces.
    expect(fresh.written).toBe(true);
    expect(fresh.warning).toContain("could not seed .env");
    expect(existsSync(join(f.worktree, ".arggon.env"))).toBe(true);
    // (b) the attach path carries the seed warning AND the keep message.
    const attach = runEnv(f);
    expect(attach.written).toBe(false);
    expect(attach.warning).toContain("could not seed .env");
    expect(attach.warning).toContain("byte-identical");
  });

  it("reports the read-only gitignore probe against a real git repo", () => {
    const f = fixture();
    const git = (args: string[]) =>
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args], {
        cwd: f.worktree,
        encoding: "utf8",
      });
    expect(git(["init"]).status).toBe(0);
    // No ignore rule: the probe answers false.
    const unignored = runEnv(f);
    expect(unignored.gitignored).toBe(false);
    // `.arggon.env` in .gitignore: the probe answers true.
    writeFileSync(join(f.worktree, ".gitignore"), ".arggon.env\n", "utf8");
    const ignored = runEnv(f);
    expect(ignored.gitignored).toBe(true);
  });

  it("skips the whole path with written:false + reason when disabled", () => {
    const f = fixture();
    const receipt = prepareWorktreeEnv(f.primary, f.worktree, {
      identity,
      enabled: false,
      ...(hermetic(dirname(f.worktree)) as { env: NodeJS.ProcessEnv; home: string }),
    });
    expect(receipt).toEqual({
      written: false,
      warning: "disabled via x-worktree.env: false",
    });
    expect(existsSync(join(f.worktree, ".arggon.env"))).toBe(false);
  });

  it("degrades to written:false + warning when the state dirs cannot be created", () => {
    const f = fixture();
    // The fake home is a FILE: every base derived from it fails mkdir (ENOTDIR).
    const blockedHome = join(dirname(f.worktree), "blocked-home");
    writeFileSync(blockedHome, "not a directory\n", "utf8");
    const receipt = prepareWorktreeEnv(f.primary, f.worktree, {
      identity,
      env: {},
      home: blockedHome,
    });
    expect(receipt.written).toBe(false);
    expect(receipt.warning).toContain("could not create the per-worktree state/cache dirs");
    expect(existsSync(join(f.worktree, ".arggon.env"))).toBe(false);
  });

  it("rides prepareWorktreeDependencies additively and never blocks the claim path", () => {
    const f = fixture();
    writeFileSync(join(f.primary, ".env"), "SECRET=1\n", "utf8");
    const prepared = prepareWorktreeDependencies(f.primary, f.worktree, {
      env: {
        identity,
        ...(hermetic(dirname(f.worktree)) as { env: NodeJS.ProcessEnv; home: string }),
      },
    });
    expect(prepared.env?.written).toBe(true);
    expect(prepared.env?.keys).toEqual([...WORKTREE_ENV_KEYS]);
    // Legacy callers pass no env request: the receipt keeps its shape.
    const legacy = prepareWorktreeDependencies(f.primary, f.worktree);
    expect(legacy.env).toBeUndefined();
  });

  describe("unlinkWorktreeEnv (cleanup ownership, exploration 017 F8)", () => {
    it("removes the start-created contract file and nothing else", () => {
      const f = fixture();
      expect(unlinkWorktreeEnv(f.worktree)).toBe(false); // nothing there
      const receipt = runEnv(f);
      expect(receipt.written).toBe(true);
      writeFileSync(join(f.worktree, ".env"), "SECRET=work\n", "utf8");
      expect(unlinkWorktreeEnv(f.worktree)).toBe(true);
      expect(existsSync(join(f.worktree, ".arggon.env"))).toBe(false);
      // The seeded .env is adopter data: never touched by the reap.
      expect(readFileSync(join(f.worktree, ".env"), "utf8")).toBe("SECRET=work\n");
    });

    it("leaves adopter-customized files (comments, unknown keys, symlinks)", () => {
      const f = fixture();
      writeFileSync(
        join(f.worktree, ".arggon.env"),
        "# my overrides\nARGON_ITEM=task-env\n",
        "utf8",
      );
      expect(unlinkWorktreeEnv(f.worktree)).toBe(false);
      expect(existsSync(join(f.worktree, ".arggon.env"))).toBe(true);
      writeFileSync(join(f.worktree, ".arggon.env"), "MY_KEY=1\n", "utf8");
      expect(unlinkWorktreeEnv(f.worktree)).toBe(false);
      expect(existsSync(join(f.worktree, ".arggon.env"))).toBe(true);
      rmSync(join(f.worktree, ".arggon.env"));
      symlinkSync("/etc/hostname", join(f.worktree, ".arggon.env"));
      expect(unlinkWorktreeEnv(f.worktree)).toBe(false);
      expect(lstatSync(join(f.worktree, ".arggon.env")).isSymbolicLink()).toBe(true);
    });
  });
});

describe("claim stamp: single-writer detection (task-single-writer-worktree-enforcement)", () => {
  const NOW = new Date("2026-10-01T10:00:00Z");
  const NOW_ISO = "2026-10-01T10:00:00.000Z";
  const LATER = new Date("2026-10-01T11:00:00Z");

  /**
   * Like `fixture`, but the worktree carries a real `.git` directory so the
   * kernel's git-dir probe resolves and the stamp is actually written. The
   * porcelain probe stays injected: detection tests fake `git status` output
   * while the files it names are real, with mtimes set explicitly.
   */
  function stampedFixture(): { primary: string; worktree: string; gitDir: string } {
    const f = fixture();
    const gitDir = join(f.worktree, ".git");
    mkdirSync(gitDir, { recursive: true });
    return { primary: f.primary, worktree: f.worktree, gitDir };
  }

  /** Write a dirty-tracked line set with one real file per path. */
  function dirtyStatus(worktree: string, paths: string[], mtime: Date): () => string {
    for (const rel of paths) {
      const file = join(worktree, rel);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "content", "utf8");
      utimesSync(file, mtime, mtime);
    }
    return () => paths.map((rel) => ` M ${rel}`).join("\n");
  }

  it("stamps a claimed worktree and reads the rolling ownership record back", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_a",
        assignee: "smoke",
        itemId: "task-x",
        branch: "feat/x",
        surface: "native",
        now: NOW,
        gitDir: () => gitDir,
        status: () => "",
      },
    }).claim;
    expect(claim).toMatchObject({ stamped: true });
    expect(claim?.foreignWrites).toBeUndefined();
    expect(readWorktreeClaimStamp(worktree, { gitDir: () => gitDir })).toEqual({
      identity: "ses_a",
      item: "task-x",
      branch: "feat/x",
      claimedAt: NOW_ISO,
      assignee: "smoke",
      surface: "native",
    });
  });

  it("fires on a foreign attach whose tracked files are newer than the claim, and keeps the stamped owner (anti-unlock)", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = { gitDir: () => gitDir };
    prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_a",
        itemId: "task-x",
        branch: "feat/x",
        now: NOW,
        ...probes,
        status: () => "",
      },
    });
    const status = dirtyStatus(worktree, ["src/foreign.ts"], new Date(NOW.getTime() + 60_000));
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_b",
        itemId: "task-x",
        branch: "feat/x",
        now: LATER,
        ...probes,
        status,
      },
    }).claim;
    expect(claim?.foreignWrites).toEqual({
      owner: "ses_a",
      claimedAt: NOW_ISO,
      files: ["src/foreign.ts"],
      total: 1,
    });
    // The rolling record STOPS at a fired detection: the previous owner stays
    // stamped, so the refused attacher cannot make the next attach match its
    // own identity and claim silently over that window.
    expect(readWorktreeClaimStamp(worktree, probes)?.identity).toBe("ses_a");
  });

  it("stays silent when the attaching identity matches the stamp (the owner's own re-attach)", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = { gitDir: () => gitDir };
    prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_a",
        itemId: "task-x",
        branch: "feat/x",
        now: NOW,
        ...probes,
        status: () => "",
      },
    });
    const status = dirtyStatus(worktree, ["wip.ts"], new Date(NOW.getTime() + 60_000));
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_a",
        itemId: "task-x",
        branch: "feat/x",
        now: LATER,
        ...probes,
        status,
      },
    }).claim;
    expect(claim?.stamped).toBe(true);
    expect(claim?.foreignWrites).toBeUndefined();
  });

  it("stays silent when every tracked write predates the stamped claim", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = { gitDir: () => gitDir };
    prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_a",
        itemId: "task-x",
        branch: "feat/x",
        now: NOW,
        ...probes,
        status: () => "",
      },
    });
    const status = dirtyStatus(worktree, ["old.ts"], new Date(NOW.getTime() - 60_000));
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_b",
        itemId: "task-x",
        branch: "feat/x",
        now: LATER,
        ...probes,
        status,
      },
    }).claim;
    expect(claim?.foreignWrites).toBeUndefined();
  });

  it("stays silent without a prior stamp (pre-feature worktrees), then stamps", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = { gitDir: () => gitDir };
    const status = dirtyStatus(worktree, ["untracked-history.ts"], new Date());
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_b",
        itemId: "task-x",
        branch: "feat/x",
        now: NOW,
        ...probes,
        status,
      },
    }).claim;
    expect(claim?.stamped).toBe(true);
    expect(claim?.foreignWrites).toBeUndefined();
  });

  it("names at most MAX_CLAIM_WRITE_NAMES files while keeping the exact total", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = { gitDir: () => gitDir };
    prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_a",
        itemId: "task-x",
        branch: "feat/x",
        now: NOW,
        ...probes,
        status: () => "",
      },
    });
    const paths = Array.from({ length: MAX_CLAIM_WRITE_NAMES + 2 }, (_, i) => `f${i}.ts`);
    const status = dirtyStatus(worktree, paths, new Date(NOW.getTime() + 60_000));
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_b",
        itemId: "task-x",
        branch: "feat/x",
        now: LATER,
        ...probes,
        status,
      },
    }).claim;
    expect(claim?.foreignWrites?.files).toEqual(paths.slice(0, MAX_CLAIM_WRITE_NAMES));
    expect(claim?.foreignWrites?.total).toBe(MAX_CLAIM_WRITE_NAMES + 2);
  });

  it("degrades to unstamped with a receipt warning when the git dir is unavailable", () => {
    const { primary, worktree } = fixture();
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_a",
        itemId: "task-x",
        branch: "feat/x",
        now: NOW,
        gitDir: () => undefined,
        status: () => "",
      },
    }).claim;
    expect(claim).toEqual({
      stamped: false,
      warning: "could not write the claim stamp",
    });
  });

  it("keeps the legacy preparation receipt shape without deps.claim", () => {
    const { primary, worktree } = fixture();
    const preparation = prepareWorktreeDependencies(primary, worktree);
    expect(preparation.claim).toBeUndefined();
    expect(Object.keys(preparation)).not.toContain("claim");
  });

  it("parses tracked modifications out of porcelain output (untracked/ignored excluded, renames resolved)", () => {
    expect(
      parseTrackedModifications(
        [
          " M a.ts",
          "?? b.ts",
          "A  c.ts",
          "R  old-d.ts -> e.ts",
          "!! ignored",
          "",
          ' M "quoted f.ts"',
        ].join("\n"),
      ),
    ).toEqual(["a.ts", "c.ts", "e.ts", "quoted f.ts"]);
  });

  it("detects nothing when the probe does not answer or the stamp timestamp is unparsable", () => {
    expect(
      detectWorktreeForeignWrites(
        "/anywhere",
        { identity: "ses_a", item: "t", branch: "b", claimedAt: "not-a-date" },
        { status: () => " M a.ts\n" },
      ),
    ).toBeNull();
    const { worktree, gitDir } = stampedFixture();
    expect(
      detectWorktreeForeignWrites(
        worktree,
        { identity: "ses_a", item: "t", branch: "b", claimedAt: NOW_ISO },
        { status: () => undefined },
      ),
    ).toBeNull();
    expect(gitDir).toBeDefined();
  });

  it("renders the bounded warning and the strict refusal from one observation", () => {
    const report = {
      owner: "ses_a",
      claimedAt: NOW_ISO,
      files: ["a.ts", "b.ts"],
      total: 3,
    };
    const warning = worktreeForeignWriteWarning(report);
    expect(warning).toContain("ses_a");
    expect(warning).toContain(NOW_ISO);
    expect(warning).toContain("3 tracked files were modified after that claim");
    expect(warning).toContain("(and 1 more)");
    const refusal = strictWorktreeWriteFailure(report);
    expect(refusal).toContain("x-tracker.strict-worktree-writes is set");
    expect(refusal).toContain("refusing the claim");
    expect(refusal).toContain("a.ts, b.ts");
    expect(strictWorktreeWriteFailure({ ...report, files: [], total: 0 })).toBeNull();
  });

  it("keeps every live-owner refusal clause and names the take-over flag before the manual recovery", () => {
    const refusal =
      strictWorktreeWriteFailure({
        owner: "ses_a",
        claimedAt: NOW_ISO,
        files: ["a.ts"],
        total: 1,
      }) ?? "";
    // The live-owner path is unchanged: coordinate first, refresh by re-attach,
    // never re-stamp on a refusal.
    expect(refusal).toContain("coordinate with the stamped session");
    expect(refusal).toContain("have it re-attach to refresh the stamp");
    expect(refusal).toContain("never re-stamps the worktree");
    // The dead-owner path gains a designed hatch BEFORE the manual `rm`, the
    // manual recovery itself is still named (invariant from #568), and the
    // docs' literal phrase is restored.
    expect(refusal).toContain("--take-over-worktree");
    expect(refusal).toContain("confirm no live writer");
    expect(refusal).toContain(
      'rm "$(git -C <worktree> rev-parse --absolute-git-dir)/arggon-claim.json"',
    );
    expect(refusal.indexOf("--take-over-worktree")).toBeLessThan(refusal.indexOf('rm "$(git -C'));
  });

  it("puts every remedy BEFORE the named-file list, so the 2000-char human clip cannot cut them", () => {
    // Worst case the receipt can carry: the cap's 10 names, each long enough
    // that the list alone would blow the human line budget (review on
    // task-strict-attach-dead-owner-hatch).
    const files = Array.from(
      { length: MAX_CLAIM_WRITE_NAMES },
      (_, i) =>
        `src/very/deeply/nested/module/path/that/keeps/going/component-${i}-with-a-long-name.ts`,
    );
    const refusal =
      strictWorktreeWriteFailure({
        owner: "ses_a",
        claimedAt: NOW_ISO,
        files,
        total: 24,
      }) ?? "";
    // Remedies first: both must precede the FIRST named path, not merely the
    // last one.
    const firstFile = refusal.indexOf(files[0]!);
    expect(firstFile).toBeGreaterThan(0);
    expect(refusal.indexOf("--take-over-worktree")).toBeLessThan(firstFile);
    expect(refusal.indexOf("confirm no live writer")).toBeLessThan(firstFile);
    expect(refusal.indexOf('rm "$(git -C')).toBeLessThan(firstFile);
    // The evidence is still all there, last.
    expect(refusal).toContain("(and 14 more)");
    expect(refusal).toContain(`Files modified after that claim: ${files.join(", ")}`);
  });
});

describe("claim stamp: deliberate take-over of a dead owner (task-strict-attach-dead-owner-hatch)", () => {
  const NOW = new Date("2026-10-01T10:00:00Z");
  const NOW_ISO = "2026-10-01T10:00:00.000Z";
  const LATER = new Date("2026-10-01T11:00:00Z");
  const LATER_ISO = "2026-10-01T11:00:00.000Z";

  function stampedFixture(): { primary: string; worktree: string; gitDir: string } {
    const f = fixture();
    const gitDir = join(f.worktree, ".git");
    mkdirSync(gitDir, { recursive: true });
    return { primary: f.primary, worktree: f.worktree, gitDir };
  }

  /** Write a dirty-tracked line set with one real file per path. */
  function dirtyStatus(worktree: string, paths: string[], mtime: Date): () => string {
    for (const rel of paths) {
      const file = join(worktree, rel);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "content", "utf8");
      utimesSync(file, mtime, mtime);
    }
    return () => paths.map((rel) => ` M ${rel}`).join("\n");
  }

  /** Stamp the worktree as `ses_a` (the session that then dies). */
  function stampDeadOwner(
    primary: string,
    worktree: string,
    gitDir: string,
  ): { gitDir: () => string; stampPath: string } {
    prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_a",
        assignee: "smoke",
        itemId: "task-x",
        branch: "feat/x",
        surface: "native",
        now: NOW,
        gitDir: () => gitDir,
        status: () => "",
      },
    });
    return { gitDir: () => gitDir, stampPath: join(gitDir, "arggon-claim.json") };
  }

  it("re-stamps and records a dated take-over naming the replaced stamp, moving the evidence out of foreignWrites", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = stampDeadOwner(primary, worktree, gitDir);
    const status = dirtyStatus(worktree, ["src/wip.ts", "src/more.ts"], LATER);
    // The recovery: the stamped session is dead, its uncommitted work is in
    // the worktree, and the new session takes over DELIBERATELY.
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_b",
        assignee: "smoke",
        itemId: "task-x",
        branch: "feat/x",
        surface: "native",
        now: LATER,
        takeOver: true,
        ...probes,
        status,
      },
    }).claim;
    // The receipt names the replaced stamp and the evidence acted on...
    expect(claim?.takeOver).toEqual({
      at: LATER_ISO,
      by: "ses_b",
      replacedIdentity: "ses_a",
      replacedClaimedAt: NOW_ISO,
      replaced: {
        identity: "ses_a",
        item: "task-x",
        branch: "feat/x",
        claimedAt: NOW_ISO,
        assignee: "smoke",
        surface: "native",
      },
      files: ["src/wip.ts", "src/more.ts"],
      total: 2,
    });
    // ...and `foreignWrites` is absent, so the armed strict gate (which reads
    // exactly that field) treats the authorized take-over as resolved.
    expect(claim?.foreignWrites).toBeUndefined();
    expect(claim?.stamped).toBe(true);
    expect(claim?.warning).toBeUndefined();
    // The stamp now belongs to the new owner and carries the audit trail.
    expect(readWorktreeClaimStamp(worktree, probes)).toEqual({
      identity: "ses_b",
      item: "task-x",
      branch: "feat/x",
      claimedAt: LATER_ISO,
      assignee: "smoke",
      surface: "native",
      takeovers: [
        { at: LATER_ISO, by: "ses_b", replacedIdentity: "ses_a", replacedClaimedAt: NOW_ISO },
      ],
    });
  });

  it("keeps the anti-unlock refusal when the flag is absent (live owner)", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = stampDeadOwner(primary, worktree, gitDir);
    const status = dirtyStatus(worktree, ["src/wip.ts"], LATER);
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_b",
        itemId: "task-x",
        branch: "feat/x",
        now: LATER,
        ...probes,
        status,
      },
    }).claim;
    expect(claim?.takeOver).toBeUndefined();
    expect(claim?.foreignWrites).toMatchObject({ owner: "ses_a", total: 1 });
    expect(readWorktreeClaimStamp(worktree, probes)?.identity).toBe("ses_a");
  });

  it("is a no-op with nothing to take over from: the owner's own re-attach keeps the stamp shape", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = stampDeadOwner(primary, worktree, gitDir);
    // A detection that never fires: same identity (the live owner re-attaching).
    const claim = prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_a",
        assignee: "smoke",
        itemId: "task-x",
        branch: "feat/x",
        surface: "native",
        now: LATER,
        takeOver: true,
        ...probes,
        status: () => " M src/wip.ts\n",
      },
    }).claim;
    expect(claim).toEqual({ stamped: true });
    const stamp = readWorktreeClaimStamp(worktree, probes);
    expect(stamp).toEqual({
      identity: "ses_a",
      item: "task-x",
      branch: "feat/x",
      claimedAt: LATER_ISO,
      assignee: "smoke",
      surface: "native",
    });
    // Default identity (#533 discipline): no take-over, no chain key at all.
    expect(Object.keys(stamp ?? {})).not.toContain("takeovers");
  });

  it("leaves the default stamp byte-identical: a run without the flag writes no chain", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = stampDeadOwner(primary, worktree, gitDir);
    const dirty = dirtyStatus(worktree, ["src/wip.ts"], LATER);
    prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_b",
        itemId: "task-x",
        branch: "feat/x",
        now: LATER,
        ...probes,
        status: dirty,
      },
    });
    // The refusal left the previous stamp standing: unchanged bytes.
    expect(readFileSync(probes.stampPath, "utf8")).not.toContain("takeovers");
  });

  it("caps the persisted chain at MAX_CLAIM_TAKEOVERS, keeping the newest entries", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes: { gitDir: () => string } = { gitDir: () => gitDir };
    for (let round = 0; round < MAX_CLAIM_TAKEOVERS + 2; round++) {
      // Each round: a fresh dead owner stamps, then the next identity takes
      // over — so the chain grows one entry per round.
      const owner = `ses_dead_${round}`;
      const at = new Date(LATER.getTime() + round * 60_000);
      prepareWorktreeDependencies(primary, worktree, {
        claim: {
          identity: owner,
          itemId: "task-x",
          branch: "feat/x",
          now: at,
          ...probes,
          status: () => "",
        },
      });
      const status = dirtyStatus(worktree, ["src/wip.ts"], new Date(at.getTime() + 1_000));
      prepareWorktreeDependencies(primary, worktree, {
        claim: {
          identity: `ses_taker_${round}`,
          itemId: "task-x",
          branch: "feat/x",
          now: at,
          takeOver: true,
          ...probes,
          status,
        },
      });
    }
    const chain = readWorktreeClaimStamp(worktree, probes)?.takeovers ?? [];
    expect(chain).toHaveLength(MAX_CLAIM_TAKEOVERS);
    // Newest last, and the oldest rounds were dropped.
    expect(chain[0].replacedIdentity).toBe(`ses_dead_${2}`);
    expect(chain[chain.length - 1].replacedIdentity).toBe(`ses_dead_${MAX_CLAIM_TAKEOVERS + 1}`);
  });

  it("carries an existing chain forward on an ordinary re-stamp (the trail is the worktree's)", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = stampDeadOwner(primary, worktree, gitDir);
    const at = LATER;
    const status = dirtyStatus(worktree, ["src/wip.ts"], at);
    prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_b",
        itemId: "task-x",
        branch: "feat/x",
        now: at,
        takeOver: true,
        ...probes,
        status,
      },
    });
    // A later plain attach by the taker's own identity: no detection fires, so
    // no new entry — but the history of the take-over is not thrown away.
    prepareWorktreeDependencies(primary, worktree, {
      claim: {
        identity: "ses_b",
        itemId: "task-x",
        branch: "feat/x",
        now: new Date(at.getTime() + 60_000),
        ...probes,
        status,
      },
    });
    expect(readWorktreeClaimStamp(worktree, probes)?.takeovers).toEqual([
      { at: LATER_ISO, by: "ses_b", replacedIdentity: "ses_a", replacedClaimedAt: NOW_ISO },
    ]);
  });

  it("drops a malformed chain entry instead of the whole stamp (the gate must not silently disarm)", () => {
    const { worktree, gitDir } = stampedFixture();
    const stampPath = join(gitDir, "arggon-claim.json");
    writeFileSync(
      stampPath,
      `${JSON.stringify(
        {
          identity: "ses_a",
          item: "task-x",
          branch: "feat/x",
          claimedAt: NOW_ISO,
          takeovers: [
            "nonsense",
            { at: NOW_ISO, by: "ses_x" },
            { at: NOW_ISO, by: "ses_x", replacedIdentity: "ses_old", replacedClaimedAt: NOW_ISO },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    expect(readWorktreeClaimStamp(worktree, { gitDir: () => gitDir })).toEqual({
      identity: "ses_a",
      item: "task-x",
      branch: "feat/x",
      claimedAt: NOW_ISO,
      takeovers: [
        { at: NOW_ISO, by: "ses_x", replacedIdentity: "ses_old", replacedClaimedAt: NOW_ISO },
      ],
    });
  });

  it("reports an unrecorded take-over when the stamp cannot be written, and never throws", () => {
    const { primary, worktree, gitDir } = stampedFixture();
    const probes = stampDeadOwner(primary, worktree, gitDir);
    const status = dirtyStatus(worktree, ["src/wip.ts"], LATER);
    // A read-only git dir: the previous stamp is still READABLE (so the
    // detection fires) but the atomic write cannot land.
    chmodSync(gitDir, 0o500);
    let claim: WorktreeClaimReceipt | undefined;
    try {
      claim = prepareWorktreeDependencies(primary, worktree, {
        claim: {
          identity: "ses_b",
          itemId: "task-x",
          branch: "feat/x",
          now: LATER,
          takeOver: true,
          ...probes,
          status,
        },
      }).claim;
    } finally {
      chmodSync(gitDir, 0o755);
    }
    expect(claim).toMatchObject({
      stamped: false,
      warning: "could not write the claim stamp",
      takeOver: { by: "ses_b", replacedIdentity: "ses_a" },
    });
    // The previous stamp stands, so the next attach re-detects the evidence.
    expect(readWorktreeClaimStamp(worktree, probes)?.identity).toBe("ses_a");
  });

  it("renders the loud take-over sentence from one record", () => {
    const warning = worktreeTakeoverWarning({
      at: LATER_ISO,
      by: "ses_b",
      replacedIdentity: "ses_a",
      replacedClaimedAt: NOW_ISO,
      replaced: {
        identity: "ses_a",
        item: "task-x",
        branch: "feat/x",
        claimedAt: NOW_ISO,
      },
      files: ["a.ts", "b.ts"],
      total: 3,
    });
    expect(warning).toContain("took over the worktree from ses_a");
    expect(warning).toContain(LATER_ISO);
    expect(warning).toContain("as ses_b");
    expect(warning).toContain("3 tracked files were modified after that claim");
    expect(warning).toContain("a.ts, b.ts");
    expect(warning).toContain("(and 1 more)");
    expect(warning).toContain("presumed dead");
  });
});

describe("worktreeComposeProject (ADR 0019 layer 2, task-cleanup-declared-services)", () => {
  it("services: true names the project exactly the worktree id, lowercased", () => {
    expect(worktreeComposeProject("true", "MyRepo-task-123")).toBe("myrepo-task-123");
    expect(worktreeComposeProject("true", "arggonmanager-task-cleanup-declared-services")).toBe(
      "arggonmanager-task-cleanup-declared-services",
    );
  });

  it("a declared base follows the pattern doc naming: <base>-<repo>-<item-id>, lowercased", () => {
    expect(worktreeComposeProject("myapp", "MyRepo-task-123")).toBe("myapp-myrepo-task-123");
    expect(worktreeComposeProject("MyApp", "repo-task-9")).toBe("myapp-repo-task-9");
  });

  it("mixed case in the worktree id is lowercased with the base", () => {
    // Compose lowercases the whole project name ([a-z0-9_-], verified live on
    // Docker 29.7.2, 2026-10-01); the derivation pre-applies that so `down`
    // targets the same label `up` recorded.
    expect(worktreeComposeProject("Shop", "ArggonManager-task-7")).toBe(
      "shop-arggonmanager-task-7",
    );
  });
});
