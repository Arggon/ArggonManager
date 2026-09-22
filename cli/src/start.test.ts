import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildLocalWorkspaces, pointWorkspaceAtLocal, runCreate, runUpdate } from "@arggondev/lib";
import { runInit } from "./init.js";
import {
  linkNodeModules,
  linkedWorkspacePackages,
  runStart,
  unlinkNodeModulesLink,
  type StartGit,
} from "./start.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-09-03T12:00:00Z");

type Call = { op: string; arg?: string; body?: string };

function primedTask(): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-start-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp", now: NOW });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: "story-login",
    now: NOW,
  });
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Add rate limiting",
    parent: "story-login",
    id: "rate-limit",
    now: NOW,
  });
  return { dir, id: task.id };
}

function fakeGit(overrides: Partial<StartGit> = {}): StartGit & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    isRepo: () => true,
    branchExists: () => false,
    checkoutNew: (_cwd, name) => {
      calls.push({ op: "checkoutNew", arg: name });
    },
    checkoutExisting: (_cwd, name) => {
      calls.push({ op: "checkoutExisting", arg: name });
    },
    // Tree root reads clean; the claimed item file reads dirty after the claim write.
    fileStatus: (_cwd, file) => (file === "." ? "" : ` M ${file}`),
    commitFile: (_cwd, _file, message) => {
      calls.push({ op: "commit", arg: message });
    },
    pushBranch: (_cwd, branch) => {
      calls.push({ op: "push", arg: branch });
    },
    createDraftPr: (_cwd, input) => {
      calls.push({ op: "pr", arg: input.title, body: input.body });
      return "https://github.com/o/r/pull/1";
    },
    worktreeList: () => {
      calls.push({ op: "worktreeList" });
      return [];
    },
    worktreeAdd: (_cwd, path, opts) => {
      calls.push({ op: "worktreeAdd", arg: `${path} ${opts.branch}` });
    },
    ...overrides,
  };
}

describe("start", () => {
  it("claims, branches, commits, pushes, and opens a draft PR in order", () => {
    const { dir, id } = primedTask();
    const git = fakeGit();
    const result = runStart({ cwd: dir, id, assignee: "arggon", openPr: true, now: NOW }, { git });
    expect(result.branch).toBe("feat/task-rate-limit");
    expect(result.created).toBe(true);
    expect(result.committed).toBe(true);
    expect(result.pushed).toBe(true);
    expect(result.prUrl).toBe("https://github.com/o/r/pull/1");
    // No --worktree: the additive link field is present and false (never linked).
    expect(result.linkedNodeModules).toBe(false);
    expect(result.item).toMatchObject({
      status: "in_progress",
      assignee: "arggon",
      branch: "feat/task-rate-limit",
    });
    expect(git.calls.map((c) => c.op)).toEqual(["checkoutNew", "commit", "push", "pr"]);
    expect(git.calls[1]?.arg).toBe(`claim: ${id}`);
  });

  it("pushes without a PR by default", () => {
    const { dir, id } = primedTask();
    const git = fakeGit();
    const result = runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git });
    expect(result.pushed).toBe(true);
    expect(result.prUrl).toBeNull();
    expect(git.calls.some((c) => c.op === "pr")).toBe(false);
  });

  it("refuses a taken claim without touching git", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "alice", now: NOW });
    const git = fakeGit();
    expect(() => runStart({ cwd: dir, id, assignee: "bob", now: NOW }, { git })).toThrow(
      /claim conflict/,
    );
    expect(git.calls).toEqual([]);
  });

  it("refuses untracked files inside the tracker dir without touching anything", () => {
    const { dir, id } = primedTask();
    writeFileSync(join(dir, "ArggonManager/scratch.txt"), "x");
    const git = fakeGit({ fileStatus: () => "?? ArggonManager/scratch.txt\n" });
    expect(() => runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git })).toThrow(
      /working tree has changes that block start[\s\S]*ArggonManager\/scratch\.txt/,
    );
    expect(git.calls).toEqual([]);
    expect(readFileSync(join(dir, "ArggonManager/scratch.txt"), "utf8")).toBe("x");
  });

  it("refuses modified tracked files", () => {
    const { dir, id } = primedTask();
    const git = fakeGit({ fileStatus: (_c, f) => (f === "." ? " M src/app.ts\n" : ` M ${f}`) });
    expect(() => runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git })).toThrow(
      /working tree has changes that block start[\s\S]*src\/app\.ts/,
    );
    expect(git.calls).toEqual([]);
  });

  it("ignores untracked files outside the tracker dir (scoped clean-tree check)", () => {
    const { dir, id } = primedTask();
    mkdirSync(join(dir, ".v2c"), { recursive: true });
    writeFileSync(join(dir, ".v2c", "state.json"), "{}");
    const git = fakeGit({
      fileStatus: (_c, f) => (f === "." ? "?? .v2c/\n?? notes.txt\n" : ` M ${f}`),
    });
    const result = runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git });
    expect(result.committed).toBe(true);
    expect(git.calls.map((c) => c.op)).toContain("commit");
  });

  it("fails clearly on existing-branch mismatch and unknown id", () => {
    const { dir, id } = primedTask();
    expect(() =>
      runStart(
        { cwd: dir, id, assignee: "arggon", now: NOW },
        { git: fakeGit({ branchExists: () => true }) },
      ),
    ).toThrow(/already exists and does not match/);
    expect(() =>
      runStart({ cwd: dir, id: "nope", assignee: "arggon", now: NOW }, { git: fakeGit() }),
    ).toThrow(/id 'nope' not found/);
  });

  it("attaches to the recorded branch and skips empty commits", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, branch: "feat/custom", now: NOW });
    const git = fakeGit({ branchExists: () => true, fileStatus: () => "" });
    const result = runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git });
    expect(result.branch).toBe("feat/custom");
    expect(result.created).toBe(false);
    expect(git.calls.map((c) => c.op)).toContain("checkoutExisting");
    expect(git.calls.map((c) => c.op)).not.toContain("commit");
    expect(result.pushed).toBe(false);
    expect(result.prUrl).toBeNull();
  });

  it("resolves the default assignee and requires one", () => {
    const { dir, id } = primedTask();
    const git = fakeGit({ resolveMe: () => "me-user" });
    const result = runStart({ cwd: dir, id, now: NOW }, { git });
    expect(result.item.assignee).toBe("me-user");
    expect(() =>
      runStart({ cwd: dir, id, now: NOW }, { git: fakeGit({ resolveMe: () => undefined }) }),
    ).toThrow(/could not resolve assignee/);
  });
});

describe("start --open-pr closes the linked GitHub issue (task-closes-issue-linking)", () => {
  it("appends Closes #N when the item carries an issue number", () => {
    const { dir } = primedTask();
    const item = runCreate({
      cwd: dir,
      type: "task",
      title: "Imported fix",
      parent: "story-login",
      id: "imported-fix",
      issue: 12,
      now: NOW,
    });
    const git = fakeGit();
    const result = runStart(
      { cwd: dir, id: item.id, assignee: "arggon", openPr: true, now: NOW },
      { git },
    );
    expect(result.prUrl).not.toBeNull();
    const pr = git.calls.find((c) => c.op === "pr");
    expect(pr?.body).toBe(
      `Work item: ${item.id}\n\nPath: ArggonManager/launch-mvp/auth/story-login/${item.id}.md\n\n` +
        "Draft opened by `arggon start`.\n\nCloses #12",
    );
  });

  it("leaves the body unchanged for items without a linked issue", () => {
    const { dir, id } = primedTask();
    const git = fakeGit();
    runStart({ cwd: dir, id, assignee: "arggon", openPr: true, now: NOW }, { git });
    const pr = git.calls.find((c) => c.op === "pr");
    expect(pr?.body).toBe(
      `Work item: ${id}\n\nPath: ArggonManager/launch-mvp/auth/story-login/${id}.md\n\n` +
        "Draft opened by `arggon start`.",
    );
    expect(pr?.body).not.toContain("Closes");
  });
});

describe("linkNodeModules (bug-start-worktree-node-modules)", () => {
  it("links only when the primary has node_modules and the worktree lacks one", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-link-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-link-wt-"));
    mkdirSync(join(primary, "node_modules"), { recursive: true });

    expect(linkNodeModules(primary, wt)).toBe(true);
    const link = join(wt, "node_modules");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    // Idempotent: a second call never re-links or fails.
    expect(linkNodeModules(primary, wt)).toBe(false);

    // Primary without node_modules: no-op.
    const barePrimary = mkdtempSync(join(tmpdir(), "arggon-link-bare-"));
    const bareWt = mkdtempSync(join(tmpdir(), "arggon-link-barewt-"));
    expect(linkNodeModules(barePrimary, bareWt)).toBe(false);
    expect(existsSync(join(bareWt, "node_modules"))).toBe(false);

    // Worktree with its own install: never replaced by a link.
    const ownWt = mkdtempSync(join(tmpdir(), "arggon-link-own-"));
    mkdirSync(join(ownWt, "node_modules"), { recursive: true });
    expect(linkNodeModules(primary, ownWt)).toBe(false);
    expect(lstatSync(join(ownWt, "node_modules")).isSymbolicLink()).toBe(false);
  });
});

describe("unlinkNodeModulesLink (review F1/F2)", () => {
  it("removes only a symlink pointing at the primary install, never its target", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-unlink-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-unlink-wt-"));
    mkdirSync(join(primary, "node_modules"), { recursive: true });
    writeFileSync(join(primary, "node_modules", "keep.txt"), "keep");

    // A real install is never touched.
    const ownWt = mkdtempSync(join(tmpdir(), "arggon-unlink-own-"));
    mkdirSync(join(ownWt, "node_modules"), { recursive: true });
    expect(unlinkNodeModulesLink(primary, ownWt)).toBe(false);
    expect(existsSync(join(ownWt, "node_modules"))).toBe(true);

    // A symlink to somewhere else is never touched.
    const otherWt = mkdtempSync(join(tmpdir(), "arggon-unlink-other-"));
    symlinkSync(primary, join(otherWt, "node_modules"), "dir");
    expect(unlinkNodeModulesLink(primary, otherWt)).toBe(false);
    expect(existsSync(join(otherWt, "node_modules"))).toBe(true);

    // The start-created link is removed and the primary install survives.
    expect(linkNodeModules(primary, wt)).toBe(true);
    expect(unlinkNodeModulesLink(primary, wt)).toBe(true);
    expect(existsSync(join(wt, "node_modules"))).toBe(false);
    expect(readFileSync(join(primary, "node_modules", "keep.txt"), "utf8")).toBe("keep");
    // Idempotent: nothing left to remove.
    expect(unlinkNodeModulesLink(primary, wt)).toBe(false);
  });

  it("resolves a relative link target against the link's directory (review R1)", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-unlink-rel-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-unlink-rel-wt-"));
    mkdirSync(join(primary, "node_modules"), { recursive: true });
    writeFileSync(join(primary, "node_modules", "keep.txt"), "keep");

    // A hand-made relative link (`ln -s ../<primary>/node_modules`): readlink
    // returns a relative path, so it must be resolved against the link's own
    // directory. Resolving against process.cwd() only matches when the command
    // happens to run from the primary directory.
    const rawTarget = relative(wt, join(primary, "node_modules"));
    expect(rawTarget.startsWith("/")).toBe(false);
    symlinkSync(rawTarget, join(wt, "node_modules"), "dir");
    expect(readlinkSync(join(wt, "node_modules"))).toBe(rawTarget);

    expect(unlinkNodeModulesLink(primary, wt)).toBe(true);
    expect(existsSync(join(wt, "node_modules"))).toBe(false);
    // Removing the link never followed it: the primary install survived.
    expect(readFileSync(join(primary, "node_modules", "keep.txt"), "utf8")).toBe("keep");

    // A relative link resolving somewhere else is still untouched.
    const other = mkdtempSync(join(tmpdir(), "arggon-unlink-rel-other-"));
    mkdirSync(join(other, "node_modules"), { recursive: true });
    const foreignWt = mkdtempSync(join(tmpdir(), "arggon-unlink-rel-foreign-"));
    symlinkSync(
      relative(foreignWt, join(other, "node_modules")),
      join(foreignWt, "node_modules"),
      "dir",
    );
    expect(unlinkNodeModulesLink(primary, foreignWt)).toBe(false);
    expect(lstatSync(join(foreignWt, "node_modules")).isSymbolicLink()).toBe(true);
    expect(existsSync(join(other, "node_modules"))).toBe(true);
  });
});

describe("linkedWorkspacePackages (W6/PR-374 review finding 2)", () => {
  it("reports workspace packages the linked install resolves into the primary", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-linked-ws-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-linked-ws-wt-"));
    // The repo's shape: a scoped workspace link in the primary install...
    mkdirSync(join(primary, "node_modules", "@arggondev"), { recursive: true });
    mkdirSync(join(primary, "lib"), { recursive: true });
    symlinkSync("../../lib", join(primary, "node_modules", "@arggondev", "lib"), "dir");
    // ...and the worktree's own copy of the same package.
    mkdirSync(join(wt, "lib"), { recursive: true });

    // The exact start shape: the whole primary install linked into the worktree.
    expect(linkNodeModules(primary, wt)).toBe(true);
    expect(linkedWorkspacePackages(primary, wt)).toEqual(["@arggondev/lib"]);
  });

  it("stays silent once the worktree install resolves locally (npm ci shape)", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-linked-local-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-linked-local-wt-"));
    mkdirSync(join(primary, "node_modules", "@arggondev"), { recursive: true });
    mkdirSync(join(primary, "lib"), { recursive: true });
    symlinkSync("../../lib", join(primary, "node_modules", "@arggondev", "lib"), "dir");
    // npm reified the worktree's own workspace link to the worktree's copy.
    mkdirSync(join(wt, "node_modules", "@arggondev"), { recursive: true });
    mkdirSync(join(wt, "lib"), { recursive: true });
    symlinkSync("../../lib", join(wt, "node_modules", "@arggondev", "lib"), "dir");

    expect(linkedWorkspacePackages(primary, wt)).toEqual([]);
  });

  it("only reports links whose target also exists in the worktree, and only workspace ones", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-linked-scope-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-linked-scope-wt-"));
    const nm = join(primary, "node_modules");
    mkdirSync(nm, { recursive: true });
    // A workspace package with no worktree copy: nothing is shadowed.
    mkdirSync(join(primary, "packages", "only-here"), { recursive: true });
    symlinkSync("../packages/only-here", join(nm, "only-here"), "dir");
    // An unscoped workspace link whose copy DOES exist in the worktree.
    mkdirSync(join(primary, "packages", "ws"), { recursive: true });
    symlinkSync("../packages/ws", join(nm, "ws"), "dir");
    mkdirSync(join(wt, "packages", "ws"), { recursive: true });
    // An install-internal relative link: not a workspace copy.
    mkdirSync(join(nm, "real-dep"), { recursive: true });
    symlinkSync("./real-dep", join(nm, "alias"), "dir");
    // An ordinary dependency (real directory) is never a link.
    mkdirSync(join(nm, "typescript"), { recursive: true });

    linkNodeModules(primary, wt);
    expect(linkedWorkspacePackages(primary, wt)).toEqual(["ws"]);

    // No install to inspect: silent, never throwing.
    const bareWt = mkdtempSync(join(tmpdir(), "arggon-linked-bare-"));
    expect(linkedWorkspacePackages(primary, bareWt)).toEqual([]);
    expect(linkedWorkspacePackages(join(primary, "missing"), wt)).toEqual([]);
  });
});

/**
 * The worktree resolution flip (task-start-worktree-lib-resolution): the
 * install is a link farm whose workspace entries point at the worktree copy
 * once that copy is importable, pre-built before the claim-commit gate.
 */
describe("worktree link farm (task-start-worktree-lib-resolution)", () => {
  /** The repo's own workspace shape: `lib/` + `node_modules/@arggondev/lib -> ../../lib`. */
  function addWorkspacePair(primary: string, wt: string, manifest: Record<string, unknown>): void {
    for (const root of [primary, wt]) {
      mkdirSync(join(root, "lib"), { recursive: true });
      writeFileSync(join(root, "lib", "package.json"), JSON.stringify(manifest));
    }
    mkdirSync(join(primary, "node_modules", "@arggondev"), { recursive: true });
    const link = join(primary, "node_modules", "@arggondev", "lib");
    if (!existsSync(link)) symlinkSync("../../lib", link, "dir");
  }

  /** An ordinary primary dependency, to prove non-workspace entries still link. */
  function addDependency(primary: string, name: string): void {
    const dep = join(primary, "node_modules", name);
    mkdirSync(dep, { recursive: true });
    writeFileSync(join(dep, "index.js"), "module.exports = true;\n");
  }

  function writeEntry(root: string): void {
    writePackageEntry(join(root, "lib"));
  }

  /** The declared entry file of a package copy (`dist/index.js`). */
  function writePackageEntry(pkgDir: string): void {
    mkdirSync(join(pkgDir, "dist"), { recursive: true });
    writeFileSync(join(pkgDir, "dist", "index.js"), "module.exports = 'local';\n");
  }

  it("flips a local copy that is already importable and links the rest from the primary", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-farm-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-farm-wt-"));
    addWorkspacePair(primary, wt, { name: "@arggondev/lib", main: "dist/index.js" });
    addDependency(primary, "commander");
    writeEntry(wt); // the worktree copy is built already

    expect(linkNodeModules(primary, wt)).toBe(true);

    const farm = join(wt, "node_modules");
    // A real directory (a `node_modules/` ignore pattern matches it, so git
    // stays clean) whose workspace entry points at the worktree copy.
    expect(lstatSync(farm).isSymbolicLink()).toBe(false);
    expect(readlinkSync(join(farm, "@arggondev", "lib"))).toBe(join(wt, "lib"));
    // Ordinary dependencies still resolve to the primary install.
    expect(existsSync(join(farm, "commander", "index.js"))).toBe(true);
    // Nothing is left resolving into the primary.
    expect(linkedWorkspacePackages(primary, wt)).toEqual([]);
  });

  it("keeps the primary's copy while the local copy has no build output", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-farm-empty-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-farm-empty-wt-"));
    addWorkspacePair(primary, wt, { name: "@arggondev/lib", main: "dist/index.js" });

    expect(linkNodeModules(primary, wt)).toBe(true);
    // Never a dangling package: the entry points at the primary's own copy (not
    // at the install's own symlink, so the shadowing stays detectable).
    expect(readlinkSync(join(wt, "node_modules", "@arggondev", "lib"))).toBe(join(primary, "lib"));
    expect(linkedWorkspacePackages(primary, wt)).toEqual(["@arggondev/lib"]);
  });

  it("builds a local copy and flips the entry, and reports what it could not build", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-build-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-build-wt-"));
    addWorkspacePair(primary, wt, {
      name: "@arggondev/lib",
      main: "dist/index.js",
      scripts: { build: "tsc -p tsconfig.json" },
    });
    expect(linkNodeModules(primary, wt)).toBe(true);
    expect(linkedWorkspacePackages(primary, wt)).toEqual(["@arggondev/lib"]);

    const built = buildLocalWorkspaces(primary, wt, {
      runBuild: (pkgDir) => {
        writePackageEntry(pkgDir);
        return true;
      },
    });

    expect(built).toEqual(["@arggondev/lib"]);
    expect(readlinkSync(join(wt, "node_modules", "@arggondev", "lib"))).toBe(join(wt, "lib"));
    expect(linkedWorkspacePackages(primary, wt)).toEqual([]);

    // A failing build (or one that does not produce the declared entry) leaves
    // the primary's copy in place and reports the package.
    const failing = mkdtempSync(join(tmpdir(), "arggon-build-fail-wt-"));
    addWorkspacePair(primary, failing, {
      name: "@arggondev/lib",
      main: "dist/index.js",
      scripts: { build: "tsc -p tsconfig.json" },
    });
    linkNodeModules(primary, failing);
    const failed = buildLocalWorkspaces(primary, failing, {
      runBuild: () => {
        throw new Error("tsc failed");
      },
    });
    expect(failed).toEqual([]);
    expect(linkedWorkspacePackages(primary, failing)).toEqual(["@arggondev/lib"]);

    // No build script at all: nothing to run, the primary's copy stands.
    const scriptless = mkdtempSync(join(tmpdir(), "arggon-build-none-wt-"));
    addWorkspacePair(primary, scriptless, { name: "@arggondev/lib", main: "dist/index.js" });
    linkNodeModules(primary, scriptless);
    expect(buildLocalWorkspaces(primary, scriptless)).toEqual([]);
    expect(linkedWorkspacePackages(primary, scriptless)).toEqual(["@arggondev/lib"]);
  });

  it("does not flip when the build fails but still emits the declared entry", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-build-emit-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-build-emit-wt-"));
    addWorkspacePair(primary, wt, {
      name: "@arggondev/lib",
      main: "dist/index.js",
      scripts: { build: "tsc -p tsconfig.json" },
    });
    linkNodeModules(primary, wt);

    // `tsc` without `noEmitOnError` writes the entry and exits non-zero: the
    // exit is honored, so the partial entry is never flipped and the primary's
    // copy stands (reported through `linkedWorkspacePackages`).
    const built = buildLocalWorkspaces(primary, wt, {
      runBuild: (pkgDir) => {
        writePackageEntry(pkgDir);
        return false;
      },
    });

    expect(built).toEqual([]);
    expect(readlinkSync(join(wt, "node_modules", "@arggondev", "lib"))).toBe(join(primary, "lib"));
    expect(linkedWorkspacePackages(primary, wt)).toEqual(["@arggondev/lib"]);
  });

  it("skips the build when a previous install resolves the primary's copy", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-skip-build-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-skip-build-wt-"));
    addWorkspacePair(primary, wt, {
      name: "@arggondev/lib",
      main: "dist/index.js",
      scripts: { build: "tsc -p tsconfig.json" },
    });
    // An install start did not create (an attach to a worktree prepared by an
    // older flow): a bare symlink to the primary install, so `@arggondev/lib`
    // keeps resolving the primary's copy. There is no farm to flip, and the
    // ~2s build would change nothing (PR #388 finding 3).
    symlinkSync(join(primary, "node_modules"), join(wt, "node_modules"), "dir");

    const calls: string[] = [];
    const built = buildLocalWorkspaces(primary, wt, {
      runBuild: (pkgDir) => {
        calls.push(pkgDir);
        writePackageEntry(pkgDir);
        return true;
      },
    });

    expect(calls).toEqual([]);
    expect(built).toEqual([]);
    expect(linkedWorkspacePackages(primary, wt)).toEqual(["@arggondev/lib"]);
  });

  it("still builds when the install already resolves the worktree copy (npm ci)", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-reified-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-reified-wt-"));
    addWorkspacePair(primary, wt, {
      name: "@arggondev/lib",
      main: "dist/index.js",
      scripts: { build: "tsc -p tsconfig.json" },
    });
    // The npm-reified shape (`npm ci` in the worktree): the workspace link
    // already points at the worktree copy, so the declared entry is exactly
    // what the gate needs — the build runs even though there is no farm.
    mkdirSync(join(wt, "node_modules", "@arggondev"), { recursive: true });
    symlinkSync("../../lib", join(wt, "node_modules", "@arggondev", "lib"), "dir");

    const built = buildLocalWorkspaces(primary, wt, {
      runBuild: (pkgDir) => {
        writePackageEntry(pkgDir);
        return true;
      },
    });

    expect(built).toEqual([]); // nothing to flip: the link already resolves locally
    expect(existsSync(join(wt, "lib", "dist", "index.js"))).toBe(true);
    expect(linkedWorkspacePackages(primary, wt)).toEqual([]);
  });

  it("unlinks a farm without following its entries into the primary install", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-farm-unlink-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-farm-unlink-wt-"));
    addWorkspacePair(primary, wt, { name: "@arggondev/lib", main: "dist/index.js" });
    addDependency(primary, "commander");
    writeEntry(wt);
    writeEntry(primary); // the primary checkout is built (the worktree's is not)
    expect(linkNodeModules(primary, wt)).toBe(true);

    expect(unlinkNodeModulesLink(primary, wt)).toBe(true);
    expect(existsSync(join(wt, "node_modules"))).toBe(false);
    // The farm's entries were unlinked, never followed.
    expect(existsSync(join(primary, "node_modules", "commander", "index.js"))).toBe(true);
    expect(existsSync(join(primary, "lib", "dist", "index.js"))).toBe(true);
    expect(lstatSync(join(primary, "node_modules", "@arggondev", "lib")).isSymbolicLink()).toBe(true);

    // A foreign directory carrying someone else's marker is never ours.
    const foreign = mkdtempSync(join(tmpdir(), "arggon-farm-foreign-"));
    mkdirSync(join(foreign, "node_modules"), { recursive: true });
    writeFileSync(join(foreign, "node_modules", ".arggon-link-farm"), "/somewhere/else\n");
    writeFileSync(join(foreign, "node_modules", "keep.txt"), "keep");
    expect(unlinkNodeModulesLink(primary, foreign)).toBe(false);
    expect(existsSync(join(foreign, "node_modules", "keep.txt"))).toBe(true);
  });

  it("never rewrites an install it did not create", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-point-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-point-wt-"));
    addWorkspacePair(primary, wt, { name: "@arggondev/lib", main: "dist/index.js" });
    // The npm-reified shape (what `npm ci` in the worktree gives): a real
    // install whose workspace link already points at the worktree copy.
    mkdirSync(join(wt, "node_modules", "@arggondev"), { recursive: true });
    symlinkSync("../../lib", join(wt, "node_modules", "@arggondev", "lib"), "dir");

    expect(pointWorkspaceAtLocal(primary, wt, "@arggondev/lib")).toBe(false);
    expect(readlinkSync(join(wt, "node_modules", "@arggondev", "lib"))).toBe("../../lib");

    // And without an install there is nothing to point.
    const bare = mkdtempSync(join(tmpdir(), "arggon-point-bare-"));
    expect(pointWorkspaceAtLocal(primary, bare, "@arggondev/lib")).toBe(false);
  });
});
