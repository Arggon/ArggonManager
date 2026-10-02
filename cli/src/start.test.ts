import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildLocalWorkspaces, pointWorkspaceAtLocal, runCreate, runUpdate } from "@arggondev/lib";
import { runInit } from "./init.js";
import {
  linkNodeModules,
  linkedWorkspacePackages,
  runStart,
  startTakeoverNotes,
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
    // Raw porcelain for the claim detection: untrimmed by contract (see
    // StartGit.statusPorcelain), and it mirrors whatever this fake's
    // `fileStatus` reports for the tree root so every fixture stays hermetic.
    statusPorcelain: (cwd) => overrides.fileStatus?.(cwd, ".") ?? "",
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

describe("start --worktree strict gate-bin gate (task-start-gate-strict-mode)", () => {
  /**
   * A primed task whose worktree (pre-created, since the git runner is faked)
   * declares a bin-bearing dependency that resolves NOWHERE — the
   * no-install-anywhere flavor (bug-start-worktree-npm-ci-claim incident 2):
   * the readiness receipt reports `{ name, source: "missing" }` and strict
   * mode must refuse the claim commit on it. `strict` appends the
   * `x-tracker.strict-gate-bins: true` flag to the tracker config; copying the
   * tracker into the worktree lets a default-mode run complete its claim.
   */
  function primedStrictTask(strict: boolean): {
    dir: string;
    id: string;
    worktreePath: string;
  } {
    const { dir, id } = primedTask();
    const manifest = {
      name: "fixture",
      private: true,
      devDependencies: { "native-gate-dep": "1.0.0" },
    };
    writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
    const configPath = join(dir, "ArggonManager", ".convention.yml");
    if (strict) {
      writeFileSync(
        configPath,
        readFileSync(configPath, "utf8") + "x-tracker:\n  strict-gate-bins: true\n",
      );
    }
    const worktreePath = resolve(dir, "..", `${basename(dir)}-${id}`);
    mkdirSync(worktreePath, { recursive: true });
    // The worktree's own manifest — what the gate-bin probe reads.
    writeFileSync(join(worktreePath, "package.json"), JSON.stringify(manifest));
    // A full tracker mirror, so a default-mode run can complete its claim.
    cpSync(join(dir, "ArggonManager"), join(worktreePath, "ArggonManager"), { recursive: true });
    return { dir, id, worktreePath };
  }

  it("refuses the claim commit when the flag is set and a gate bin resolves outside the worktree", () => {
    const { dir, id, worktreePath } = primedStrictTask(true);
    const git = fakeGit({ worktreeList: () => [worktreePath] });
    let message = "";
    try {
      runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain("x-tracker.strict-gate-bins is set");
    expect(message).toContain("refusing the claim commit");
    expect(message).toContain("native-gate-dep: not resolvable from the worktree");
    expect(message).toContain("npm ci");
    expect(message).toContain(worktreePath);
    // Hard fail BEFORE any item mutation: the worktree was prepared and kept,
    // but no claim commit was attempted.
    expect(git.calls.some((c) => c.op === "commit")).toBe(false);
    expect(message).toContain("the worktree was kept");
    expect(message).toContain(`arggon start ${id} --worktree`);
  });

  it("keeps the claim commit authoritative when the flag is unset (default, byte-identical)", () => {
    const { dir, id, worktreePath } = primedStrictTask(false);
    const git = fakeGit({ worktreeList: () => [worktreePath] });
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: NOW },
      { git },
    );
    // The SAME violating resolution is reported — but only reported.
    expect(result.gateBins).toEqual([{ name: "native-gate-dep", source: "missing" }]);
    expect(result.committed).toBe(true);
    expect(git.calls.some((c) => c.op === "commit")).toBe(true);
  });

  it("starts normally when the flag is set and every gate bin resolves from the worktree", () => {
    const { dir, id, worktreePath } = primedStrictTask(true);
    // A primary install providing the gate dep: start links it into the
    // worktree, so the bin resolves from the worktree and strict mode passes.
    const dep = join(dir, "node_modules", "native-gate-dep");
    mkdirSync(join(dep), { recursive: true });
    writeFileSync(
      join(dep, "package.json"),
      JSON.stringify({
        name: "native-gate-dep",
        version: "1.0.0",
        bin: { "native-gate-dep": "./index.js" },
      }),
    );
    const binDir = join(dir, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "native-gate-dep"), "#!/bin/sh\nexit 0\n");
    const git = fakeGit({ worktreeList: () => [worktreePath] });
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: NOW },
      { git },
    );
    expect(result.committed).toBe(true);
    expect(result.gateBins).toEqual([
      {
        name: "native-gate-dep",
        source: "worktree",
        path: join(worktreePath, "node_modules", ".bin", "native-gate-dep"),
      },
    ]);
  });
});

describe("start --worktree fresh-worktree install gate (bug-start-install-ordering)", () => {
  /**
   * A FRESH worktree (the git runner's `worktreeAdd` creates the directory, so
   * `worktreeCreated` is true): the manifest the gate-bin probe reads has to
   * exist by preparation time, and the tracker mirror lets a passing flow run
   * its claim writes. This is the shape every one of the eight incidents
   * started from — a start that created the worktree and handed it over.
   */
  function primedFreshTask(manifest: Record<string, unknown>): {
    dir: string;
    id: string;
    worktreePath: string;
    git: ReturnType<typeof fakeGit>;
  } {
    const { dir, id } = primedTask();
    writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
    const worktreePath = resolve(dir, "..", `${basename(dir)}-${id}`);
    const git = fakeGit({
      worktreeAdd: (_cwd, path) => {
        mkdirSync(path, { recursive: true });
        writeFileSync(join(path, "package.json"), JSON.stringify(manifest));
        cpSync(join(dir, "ArggonManager"), join(path, "ArggonManager"), { recursive: true });
      },
    });
    return { dir, id, worktreePath, git };
  }

  it("refuses a fresh worktree whose gate bin resolves nowhere, before any claim (flag unset)", () => {
    const { dir, id, worktreePath, git } = primedFreshTask({
      name: "fixture",
      private: true,
      devDependencies: { "native-gate-dep": "1.0.0" },
    });
    let message = "";
    try {
      runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    // The named cause, before any claim commit (the root fix for the
    // eight-incident "no install at all" flavor).
    expect(message).toContain("fresh worktree must leave a gate-usable install");
    expect(message).toContain("native-gate-dep: not resolvable from the worktree");
    expect(message).toContain("Preparation ran: link:primary-install-missing");
    expect(message).toContain("npm ci");
    expect(message).toContain(worktreePath);
    expect(message).toContain("the worktree was kept");
    expect(message).toContain(`arggon start ${id} --worktree`);
    // The claim never happened: no commit, and the primary copy stays todo.
    expect(git.calls.some((c) => c.op === "commit")).toBe(false);
    const itemFile = join(dir, "ArggonManager", "launch-mvp", "auth", "story-login", `${id}.md`);
    expect(readFileSync(itemFile, "utf8")).toContain("status: todo");
  });

  it("keeps the strict refusal byte-identical when the flag is armed on a fresh worktree", () => {
    const { dir, id } = primedTask();
    const manifest = {
      name: "fixture",
      private: true,
      devDependencies: { "native-gate-dep": "1.0.0" },
    };
    writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
    const configPath = join(dir, "ArggonManager", ".convention.yml");
    writeFileSync(
      configPath,
      readFileSync(configPath, "utf8") + "x-tracker:\n  strict-gate-bins: true\n",
    );
    const git = fakeGit({
      worktreeAdd: (_cwd, path) => {
        mkdirSync(path, { recursive: true });
        writeFileSync(join(path, "package.json"), JSON.stringify(manifest));
        cpSync(join(dir, "ArggonManager"), join(path, "ArggonManager"), { recursive: true });
      },
    });
    let message = "";
    try {
      runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    // The shipped strict gate keeps its exact message and consequence; the
    // fresh gate adds the default-on refusal only where the flag is silent.
    expect(message).toContain("x-tracker.strict-gate-bins is set");
    expect(message).toContain("native-gate-dep: not resolvable from the worktree");
    expect(git.calls.some((c) => c.op === "commit")).toBe(false);
  });

  it("commits the claim when nothing declared exposes a bin (documented carve-out)", () => {
    const { dir, id, worktreePath, git } = primedFreshTask({ name: "fixture", private: true });
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: NOW },
      { git },
    );
    expect(result.committed).toBe(true);
    expect(result.worktreeCreated).toBe(true);
    // An empty gate-bin report leaves `ready` unchanged: a project with no
    // dependency-needing gate may still have no install and commit the claim.
    expect(result.gateBins).toEqual([]);
    // The preparation log still names what ran (the instrumentation).
    expect(result.prepSteps).toEqual([
      { step: "link", outcome: "primary-install-missing" },
      { step: "gate-bins", outcome: "all-worktree" },
    ]);
    expect(worktreePath).toContain(id);
  });

  it("lands a fresh worktree whose stale install misses only bin-less dependencies (stale stays informational)", () => {
    const { dir, id, git } = primedFreshTask({
      name: "fixture",
      private: true,
      dependencies: { native: "1.0.0" },
      // Installed in the primary; the mirror provides it, and it exposes no
      // bin, so the gate-bin probe has nothing to report.
      devDependencies: { "plain-dep": "1.0.0" },
    });
    // The primary provides BOTH declared deps, so the mirror is satisfied —
    // and with no bins to probe the claim lands in the usable worktree.
    for (const name of ["native", "plain-dep"]) {
      const dep = join(dir, "node_modules", name);
      mkdirSync(dep, { recursive: true });
      writeFileSync(join(dep, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
    }
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: NOW },
      { git },
    );
    expect(result.committed).toBe(true);
    expect(result.gateBins).toEqual([]);
    expect(result.manifestCoverage).toBe("satisfied");
  });

  it("refuses to skip the claim commit silently on a fresh worktree (incident 7)", () => {
    const { dir, id } = primedTask();
    const git = fakeGit({
      // Nothing is dirty after the claim write — the lost-mutation shape that
      // let a start report success with no claim commit on the branch.
      fileStatus: () => "",
      worktreeAdd: (_cwd, path) => {
        mkdirSync(path, { recursive: true });
        cpSync(join(dir, "ArggonManager"), join(path, "ArggonManager"), { recursive: true });
      },
    });
    let message = "";
    try {
      runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain("cannot be skipped silently");
    expect(git.calls.some((c) => c.op === "commit")).toBe(false);
    expect(git.calls.some((c) => c.op === "push")).toBe(false);
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
    expect(lstatSync(join(primary, "node_modules", "@arggondev", "lib")).isSymbolicLink()).toBe(
      true,
    );

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

describe("start --worktree claim stamp: single-writer detection (task-single-writer-worktree-enforcement)", () => {
  const LATER = new Date("2026-09-10T12:00:00Z");
  const FOREIGN_SESSION = "ses_f0821d67";

  /**
   * A primed task plus the (not yet created) worktree path its start will
   * use. The faked `worktreeAdd` creates a REAL git repository, so the
   * kernel's git-dir probe resolves and the claim stamp is physically written
   * (`<worktree>/.git/arggon-claim.json`). The porcelain probe itself stays on
   * the injected runner: a test fakes `git status` output for the worktree
   * while the files it names are real, with mtimes set explicitly.
   */
  function primedWriterTask(strict: boolean): {
    dir: string;
    id: string;
    worktreePath: string;
    stampPath: string;
    createGit: StartGit & { calls: Call[] };
  } {
    const { dir, id } = primedTask();
    const worktreePath = resolve(dir, "..", `${basename(dir)}-${id}`);
    if (strict) {
      const configPath = join(dir, "ArggonManager", ".convention.yml");
      writeFileSync(
        configPath,
        readFileSync(configPath, "utf8") + "x-tracker:\n  strict-worktree-writes: true\n",
      );
    }
    const createGit = fakeGit({
      worktreeAdd: (_cwd, path) => {
        mkdirSync(path, { recursive: true });
        execFileSync("git", ["init", "-q", path]);
        cpSync(join(dir, "ArggonManager"), join(path, "ArggonManager"), { recursive: true });
      },
    });
    return {
      dir,
      id,
      worktreePath,
      stampPath: join(worktreePath, ".git", "arggon-claim.json"),
      createGit,
    };
  }

  /** Overwrite the stamp as a NATIVE session would have left it. */
  function stampAsForeignSession(
    stampPath: string,
    itemId: string,
    branch: string,
    claimedAt: Date,
  ): void {
    writeFileSync(
      stampPath,
      `${JSON.stringify(
        {
          identity: FOREIGN_SESSION,
          assignee: "arggon",
          item: itemId,
          branch,
          claimedAt: claimedAt.toISOString(),
          surface: "native",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  /** Write a tracked-style foreign file into the worktree, newer than `after`. */
  function foreignWrite(worktreePath: string, rel: string, after: Date): void {
    const file = join(worktreePath, rel);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "foreign work\n", "utf8");
    const when = new Date(after.getTime() + 60_000);
    utimesSync(file, when, when);
  }

  /** Fake git whose root reads clean but whose worktree reports `dirty`. */
  function writerGit(worktreePath: string, dirty: string[]): StartGit & { calls: Call[] } {
    return fakeGit({
      worktreeList: () => [worktreePath],
      fileStatus: (cwd, file) => {
        if (file !== ".") return ` M ${file}`;
        return cwd === worktreePath && dirty.length > 0
          ? dirty.map((rel) => ` M ${rel}`).join("\n")
          : "";
      },
    });
  }

  it("stamps the worktree at claim time; the receipt carries the claim state (default)", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(false);
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: NOW },
      { git: createGit },
    );
    expect(result.worktreeCreated).toBe(true);
    expect(result.claim).toEqual({ stamped: true });
    expect(JSON.parse(readFileSync(stampPath, "utf8"))).toMatchObject({
      identity: "arggon",
      assignee: "arggon",
      item: id,
      branch: "feat/task-rate-limit",
      claimedAt: NOW.toISOString(),
      surface: "cli",
    });
    expect(existsSync(stampPath)).toBe(true);
    expect(worktreePath).toContain(id);
  });

  it("keeps the single-writer flow byte-identical by default: same-identity attach, no warning, claim lands", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(false);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    // The owner's own fix-and-re-attach cycle: same identity, no foreign writes.
    const git = writerGit(worktreePath, []);
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: LATER },
      { git },
    );
    expect(result.worktreeCreated).toBe(false);
    // The claim stamp is refreshed — and NOTHING else about the flow changed:
    // no fired detection, no warning, the claim commit stays authoritative.
    expect(result.claim).toEqual({ stamped: true });
    expect(result.committed).toBe(true);
    expect(result.pushed).toBe(true);
    expect(result.gateBins).toEqual([]);
    expect(result.env?.written).toBe(false);
    expect(git.calls.some((c) => c.op === "commit")).toBe(true);
    expect(JSON.parse(readFileSync(stampPath, "utf8")).claimedAt).toBe(LATER.toISOString());
  });

  it("warns (named, bounded) when attaching a worktree a foreign session stamped over newer writes", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(false);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    // A native session stamped the worktree after the CLI claim (the
    // cross-surface shape), and its window saw tracked writes.
    stampAsForeignSession(stampPath, id, "feat/task-rate-limit", NOW);
    foreignWrite(worktreePath, "src/foreign.ts", NOW);
    const git = writerGit(worktreePath, ["src/foreign.ts"]);
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: LATER },
      { git },
    );
    // Report-only default: the detection rides the receipt, the claim lands.
    expect(result.claim?.foreignWrites).toEqual({
      owner: FOREIGN_SESSION,
      claimedAt: NOW.toISOString(),
      files: ["src/foreign.ts"],
      total: 1,
    });
    expect(result.committed).toBe(true);
    expect(git.calls.some((c) => c.op === "commit")).toBe(true);
  });

  it("stays silent when the foreign stamp window saw no newer tracked writes", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(false);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    stampAsForeignSession(stampPath, id, "feat/task-rate-limit", LATER);
    // An OLD file below the stamp: reported dirty but predates the claim.
    foreignWrite(worktreePath, "old.ts", new Date(NOW.getTime() - 86_400_000));
    const git = writerGit(worktreePath, ["old.ts"]);
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: LATER },
      { git },
    );
    expect(result.claim).toEqual({ stamped: true });
    expect(result.committed).toBe(true);
  });

  it("degrades to unstamped without blocking when the worktree has no git dir", () => {
    const { dir, id } = primedTask();
    const worktreePath = resolve(dir, "..", `${basename(dir)}-${id}`);
    mkdirSync(worktreePath, { recursive: true });
    cpSync(join(dir, "ArggonManager"), join(worktreePath, "ArggonManager"), { recursive: true });
    const git = fakeGit({ worktreeList: () => [worktreePath] });
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: NOW },
      { git },
    );
    expect(result.claim).toEqual({
      stamped: false,
      warning: "could not write the claim stamp",
    });
    expect(result.committed).toBe(true);
  });

  it("refuses the claim before any mutation under strict-worktree-writes when the stamp is foreign over newer writes", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(true);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    stampAsForeignSession(stampPath, id, "feat/task-rate-limit", NOW);
    foreignWrite(worktreePath, "src/foreign.ts", NOW);
    foreignWrite(worktreePath, "src/more.ts", NOW);
    const git = writerGit(worktreePath, ["src/foreign.ts", "src/more.ts"]);
    let message = "";
    try {
      runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: LATER }, { git });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain("x-tracker.strict-worktree-writes is set");
    expect(message).toContain("refusing the claim");
    expect(message).toContain(FOREIGN_SESSION);
    expect(message).toContain(NOW.toISOString());
    expect(message).toContain("src/foreign.ts, src/more.ts");
    expect(message).toContain(worktreePath);
    expect(message).toContain("coordinate with the stamped session");
    expect(message).toContain(`arggon start ${id} --worktree`);
    // Refused BEFORE the claim: no commit, no item mutation in the worktree.
    expect(git.calls.some((c) => c.op === "commit")).toBe(false);
    const itemFile = join(
      worktreePath,
      "ArggonManager",
      "launch-mvp",
      "auth",
      "story-login",
      `${id}.md`,
    );
    expect(readFileSync(itemFile, "utf8")).toContain(`assignee: arggon`);
  });

  it("keeps the stamped owner when a strict refusal fires, so a retry re-detects instead of silently claiming (no self-unlocking gate)", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(true);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    stampAsForeignSession(stampPath, id, "feat/task-rate-limit", NOW);
    foreignWrite(worktreePath, "src/foreign.ts", NOW);
    const git = writerGit(worktreePath, ["src/foreign.ts"]);
    const attempt = (): string => {
      try {
        runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: LATER }, { git });
        return "";
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    };
    // (1) A refused attach must NOT hand ownership to the refused caller...
    expect(attempt()).toContain("refusing the claim");
    expect(JSON.parse(readFileSync(stampPath, "utf8"))).toMatchObject({
      identity: FOREIGN_SESSION,
      claimedAt: NOW.toISOString(),
    });
    // (2) ...otherwise the retry would match its own stamp, skip detection and
    // claim silently over the stamped owner's uncommitted work.
    const retry = attempt();
    expect(retry).toContain("refusing the claim");
    expect(retry).toContain(FOREIGN_SESSION);
    expect(retry).toContain("src/foreign.ts");
    expect(git.calls.some((c) => c.op === "commit")).toBe(false);
  });

  it("commits normally under strict-worktree-writes when the stamp is the caller's own", () => {
    const { dir, id, worktreePath, createGit } = primedWriterTask(true);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    const git = writerGit(worktreePath, []);
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: LATER },
      { git },
    );
    // Strict mode never invents a violation: the owner's own re-attach commits.
    expect(result.claim).toEqual({ stamped: true });
    expect(result.committed).toBe(true);
  });

  it("leaves plain (non-worktree) start without the claim field", () => {
    const { dir, id } = primedTask();
    const git = fakeGit();
    const result = runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git });
    expect(result.claim).toBeUndefined();
  });

  it("reads RAW porcelain for the detection: a trimmed status line must not silently disarm the gate", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(true);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    stampAsForeignSession(stampPath, id, "feat/task-rate-limit", NOW);
    foreignWrite(worktreePath, "src/wip.ts", NOW);
    // A runner whose `fileStatus` TRIMS (the shape that made the CLI's
    // detection inert against real git: porcelain is positional, so ` M x`
    // becomes `M x` and every path is read one character off) while its
    // `statusPorcelain` answers raw. The claim MUST still see the write — the
    // detection reads the raw probe, never `fileStatus`.
    const git = fakeGit({
      worktreeList: () => [worktreePath],
      fileStatus: (cwd, file) => {
        if (file !== ".") return ` M ${file}`;
        return cwd === worktreePath ? "M src/wip.ts" : ""; // trimmed: " M src/wip.ts"
      },
      statusPorcelain: (cwd) => (cwd === worktreePath ? " M src/wip.ts\n" : ""),
    });
    let message = "";
    try {
      runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: LATER }, { git });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain("refusing the claim");
    expect(message).toContain("src/wip.ts");
    // Proof the raw probe (not the trimmed one) is what the gate consumed.
    expect(message).not.toContain("Eip.ts");
  });

  it("refuses --take-over-worktree without --worktree (a flag that cannot act is never ignored)", () => {
    const { dir, id } = primedTask();
    const git = fakeGit();
    expect(() =>
      runStart({ cwd: dir, id, assignee: "arggon", now: NOW, takeOverWorktree: true }, { git }),
    ).toThrow(/--take-over-worktree requires --worktree/);
    // The refusal is before any mutation: the item was never claimed.
    expect(git.calls.some((c) => c.op === "commit")).toBe(false);
  });

  it("recovers a dead owner under strict: the take-over records the replaced stamp and the claim lands", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(true);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    // The stamped session crashed mid-task: its stamp is there, and its
    // uncommitted work is dirtier than the claim.
    stampAsForeignSession(stampPath, id, "feat/task-rate-limit", NOW);
    foreignWrite(worktreePath, "src/wip.ts", NOW);
    const git = writerGit(worktreePath, ["src/wip.ts"]);

    // (1) The strict gate refuses the plain re-attach — the live-owner
    // consequence is unchanged, and the refusal names the hatch.
    let refusal = "";
    try {
      runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: LATER }, { git });
    } catch (err) {
      refusal = err instanceof Error ? err.message : String(err);
    }
    expect(refusal).toContain("x-tracker.strict-worktree-writes is set");
    expect(refusal).toContain("--take-over-worktree");
    expect(refusal).toContain(FOREIGN_SESSION);
    expect(git.calls.some((c) => c.op === "commit")).toBe(false);

    // (2) The deliberate take-over resolves it: the receipt names the replaced
    // stamp, the evidence, and when — and the claim commits.
    const result = runStart(
      {
        cwd: dir,
        id,
        assignee: "arggon",
        worktree: true,
        now: LATER,
        takeOverWorktree: true,
      },
      { git },
    );
    expect(result.claim?.takeOver).toEqual({
      at: LATER.toISOString(),
      by: "arggon",
      replacedIdentity: FOREIGN_SESSION,
      replacedClaimedAt: NOW.toISOString(),
      replaced: {
        identity: FOREIGN_SESSION,
        assignee: "arggon",
        item: id,
        branch: "feat/task-rate-limit",
        claimedAt: NOW.toISOString(),
        surface: "native",
      },
      files: ["src/wip.ts"],
      total: 1,
    });
    // The evidence is not lost: it moved out of the strict gate's field.
    expect(result.claim?.foreignWrites).toBeUndefined();
    expect(result.committed).toBe(true);
    expect(git.calls.some((c) => c.op === "commit")).toBe(true);
    // The persisted stamp belongs to the new owner and keeps the audit trail.
    expect(JSON.parse(readFileSync(stampPath, "utf8"))).toMatchObject({
      identity: "arggon",
      claimedAt: LATER.toISOString(),
      takeovers: [
        {
          at: LATER.toISOString(),
          by: "arggon",
          replacedIdentity: FOREIGN_SESSION,
          replacedClaimedAt: NOW.toISOString(),
        },
      ],
    });
  });

  it("prints that an UNRECORDED take-over was not recorded (the human channel must not read it as taken-over)", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(true);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    stampAsForeignSession(stampPath, id, "feat/task-rate-limit", NOW);
    foreignWrite(worktreePath, "src/wip.ts", NOW);
    const git = writerGit(worktreePath, ["src/wip.ts"]);
    // A read-only git dir: the stamp is still READABLE (the detection fires) but
    // the atomic write cannot land, so the take-over persists nothing. The git
    // runner is faked, so nothing else needs that directory.
    chmodSync(join(worktreePath, ".git"), 0o500);
    let result: ReturnType<typeof runStart>;
    try {
      result = runStart(
        { cwd: dir, id, assignee: "arggon", worktree: true, now: LATER, takeOverWorktree: true },
        { git },
      );
    } finally {
      chmodSync(join(worktreePath, ".git"), 0o755);
    }
    // The receipt is honest about it: the take-over is there, unrecorded.
    expect(result.claim?.takeOver?.replacedIdentity).toBe(FOREIGN_SESSION);
    expect(result.claim?.stamped).toBe(false);
    expect(result.claim?.warning).toBe("could not write the claim stamp");
    // ...and the human channel says so BESIDE the note (review finding 2):
    // "took over ..." alone would read as a completed recovery that did not
    // happen, while the next attach re-refuses.
    const notes = startTakeoverNotes(result.claim);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain("note: single-writer take-over — took over the worktree from");
    expect(notes[0]).toContain(FOREIGN_SESSION);
    expect(notes[1]).toContain("take-over NOT recorded");
    expect(notes[1]).toContain("could not write the claim stamp");
    expect(notes[1]).toContain("next attach re-refuses");
    // Nothing was persisted: the previous owner is still stamped.
    expect(JSON.parse(readFileSync(stampPath, "utf8")).identity).toBe(FOREIGN_SESSION);
  });

  it("prints only the note for a RECORDED take-over, and nothing without one", () => {
    expect(startTakeoverNotes(undefined)).toEqual([]);
    expect(startTakeoverNotes({ stamped: true })).toEqual([]);
    expect(
      startTakeoverNotes({
        stamped: true,
        takeOver: {
          at: LATER.toISOString(),
          by: "arggon",
          replacedIdentity: FOREIGN_SESSION,
          replacedClaimedAt: NOW.toISOString(),
          replaced: {
            identity: FOREIGN_SESSION,
            item: "task-x",
            branch: "feat/x",
            claimedAt: NOW.toISOString(),
          },
          files: ["src/wip.ts"],
          total: 1,
        },
      }),
    ).toEqual([
      `note: single-writer take-over — took over the worktree from ${FOREIGN_SESSION} ` +
        `(claimed ${NOW.toISOString()}) at ${LATER.toISOString()} as arggon: 1 tracked file was ` +
        "modified after that claim: src/wip.ts — the stamped session was presumed dead; confirm " +
        "that before writing here",
    ]);
  });

  it("is a no-op on a clean attach: no chain entry, no receipt change", () => {
    const { dir, id, worktreePath, stampPath, createGit } = primedWriterTask(true);
    runStart({ cwd: dir, id, assignee: "arggon", worktree: true, now: NOW }, { git: createGit });
    // Same-identity re-attach (the live owner): nothing to take over, so the
    // flag changes nothing about the default flow.
    const git = writerGit(worktreePath, []);
    const result = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: LATER, takeOverWorktree: true },
      { git },
    );
    expect(result.claim).toEqual({ stamped: true });
    expect(result.committed).toBe(true);
    expect(JSON.parse(readFileSync(stampPath, "utf8"))).toMatchObject({ identity: "arggon" });
    expect(readFileSync(stampPath, "utf8")).not.toContain("takeovers");
  });
});
