/**
 * Integration tests for worktree-integrated claims (story-start-worktree):
 * `start --worktree` and `arggon cleanup`. Spawns real git inside temp repos
 * (sync-smoke pattern); only push/PR are stubbed so no remote is needed.
 */
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_ENVELOPE_DETAIL_CHARS, defaultCleanupGit, runCleanup } from "./cleanup.js";
import { parseFrontmatter, runCreate, runUpdate, runValidate } from "@arggondev/lib";

import { tickAllAcceptance } from "../../test/acceptance.js";

import { runInit } from "./init.js";
import { defaultStartGit, runStart } from "./start.js";
import { initFixtureRepo, removeFixtureTree } from "./test-tmp.js";
import { runCli } from "./test-spawn.js";

// bug-tmp-fixture-leak + bug-tracker-commit-enotempty-flake +
// bug-ci-enotempty-rmretry: track mkdtemp dirs (plus any `arggon start
// --worktree` sibling worktrees named `<basename>-task-*`) and remove them
// after each test through the shared helper (test-tmp.ts).
//
// The writer behind the ENOTEMPTY failures is git's detached
// `git maintenance run --auto --detach` child: `git commit`/`git merge` spawn
// it, it holds `.git/objects/maintenance.lock` for its whole run, and under CI
// load that run can outlive the ~2.75s rmSync retry window while teardown is
// removing the tree (CI run 35401030576). Fixture repos therefore come from
// initFixtureRepo (git init + maintenance.auto=false, read back at creation),
// and removeFixtureTree() re-reads the tree on retriable errors instead of
// trusting bare rmdir retries.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-09-11T12:00:00Z");

function git(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { encoding: "utf8", cwd });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
}

/** Git runner with real worktree support but no push/PR (no remote in temp repos). */
function localGit() {
  return {
    ...defaultStartGit(),
    pushBranch: () => {},
    createDraftPr: () => "https://github.com/o/r/pull/1",
  };
}

function commitAllIfDirty(dir: string, message: string): void {
  spawnSync("git", ["add", "-A"], { cwd: dir, stdio: "pipe" });
  const r = spawnSync("git", ["commit", "--quiet", "-m", message], { cwd: dir, stdio: "pipe" });
  // init/creates auto-commit now (tracker hygiene); "nothing to commit" is fine.
  if (r.status !== 0 && !/nothing to commit/.test(String(r.stderr) + String(r.stdout))) {
    throw new Error(`git commit failed: ${r.stderr}`);
  }
}

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-worktree-"));
  // bug-ci-enotempty-rmretry: no detached maintenance daemon in fixtures.
  initFixtureRepo(dir);
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "login", now: NOW });
  for (const id of ["task-alpha", "task-bravo", "task-charlie"]) {
    runCreate({ cwd: dir, type: "task", title: id, parent: "login", id, now: NOW });
  }
  // Done gate (task-done-gate-acceptance-waiver, ADR 0015): these suites flip
  // the leaves done for cleanup/worktree rules, so arrange satisfied contracts.
  tickAllAcceptance(dir);
  // init now also generates AND auto-commits the governing docs; this is a
  // tolerant no-op when everything is already committed (tracker hygiene).
  commitAllIfDirty(dir, "init tasks");
  return dir;
}

function worktreeCount(dir: string): number {
  return git(["worktree", "list", "--porcelain"], dir)
    .split("\n")
    .filter((line) => line.startsWith("worktree ")).length;
}

/** Tolerates exit 1: show-ref --quiet fails when the ref does not exist. */
function refExists(dir: string, ref: string): boolean {
  return spawnSync("git", ["show-ref", "--verify", "--quiet", ref], { cwd: dir }).status === 0;
}

/**
 * Configure `x-worktree.post-start` (task-start-post-hook) and commit it —
 * `start` refuses dirty trees, so the config edit must land before starting.
 */
function setPostStart(dir: string, command: string | null): void {
  if (command === null) return;
  appendFileSync(
    join(dir, "ArggonManager/.convention.yml"),
    `x-worktree:\n  post-start: "${command}"\n`,
  );
  git(["add", "ArggonManager/.convention.yml"], dir);
  git(["commit", "--quiet", "-m", "config: x-worktree.post-start"], dir);
}

/**
 * Configure `x-worktree.services` (ADR 0019 layer 2,
 * task-cleanup-declared-services) and commit it.
 */
function setServices(dir: string, value: string): void {
  appendFileSync(join(dir, "ArggonManager/.convention.yml"), `x-worktree:\n  services: ${value}\n`);
  git(["add", "ArggonManager/.convention.yml"], dir);
  git(["commit", "--quiet", "-m", "config: x-worktree.services"], dir);
}

/**
 * Recording ComposeDown stand-in (no daemon in CI). `fail` makes every call
 * throw: `"enoent"` like an absent docker CLI (the report-only signal), any
 * other message like a real `docker compose down` failure.
 */
function fakeCompose(fail?: "enoent" | string) {
  const calls: Array<{ project: string; cwd: string }> = [];
  const down = (project: string, cwd: string): void => {
    calls.push({ project, cwd });
    if (fail === "enoent") {
      const err = new Error("spawn docker ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    }
    if (fail !== undefined) throw new Error(fail);
  };
  return { calls, down };
}

/**
 * Create a minimal package under `<dir>/node_modules/<name>` so a project gate
 * can `require("<name>")` — the dependency stand-in for a real install
 * (bug-start-worktree-node-modules).
 */
function addFakeDependency(dir: string, name: string): void {
  const dep = join(dir, "node_modules", name);
  mkdirSync(dep, { recursive: true });
  writeFileSync(
    join(dep, "package.json"),
    JSON.stringify({ name, version: "1.0.0", main: "index.js" }),
  );
  writeFileSync(join(dep, "index.js"), "module.exports = true;\n");
}

/**
 * npm workspace link in the install — the repo's own `@arggondev/lib` shape:
 * `node_modules/<scope>/<name> -> ../../<target>` (a relative link to the
 * checkout's own package directory).
 */
function addWorkspaceLink(dir: string, scope: string, name: string, target: string): void {
  mkdirSync(join(dir, "node_modules", scope), { recursive: true });
  symlinkSync(`../../${target}`, join(dir, "node_modules", scope, name), "dir");
}

/**
 * The repo's own layout: a workspace package `lib/` committed in the primary
 * checkout plus its npm link in the install, so a fresh worktree carries the
 * package copy the linked install shadows.
 */
function addWorkspacePackage(dir: string): void {
  addWorkspaceLink(dir, "@arggondev", "lib", "lib");
  mkdirSync(join(dir, "lib"), { recursive: true });
  writeFileSync(join(dir, "lib", "package.json"), JSON.stringify({ name: "@arggondev/lib" }));
  git(["add", "lib"], dir);
  git(["commit", "--quiet", "-m", "workspace package"], dir);
}

/**
 * Install a repo-wide pre-commit hook (worktrees share the common .git/hooks)
 * and make it executable — the stand-in for the documented
 * `npm run arggon -- validate` gate.
 */
function setPreCommitHook(dir: string, script: string): void {
  const hooks = join(dir, ".git", "hooks");
  mkdirSync(hooks, { recursive: true });
  const hook = join(hooks, "pre-commit");
  writeFileSync(hook, script.endsWith("\n") ? script : `${script}\n`);
  chmodSync(hook, 0o755);
}

/** Run start --worktree and return the thrown message ("" when it succeeded). */
function startError(dir: string, id: string, assignee: string): string {
  try {
    runStart({ cwd: dir, id, assignee, worktree: true, now: NOW }, { git: localGit() });
    return "";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Declare dependencies in the repo's own manifest — committed, because `start`
 * refuses a dirty tree. The stand-in for a `package.json` whose install is
 * stale (bug-worktree-readiness-misses-stale-primary-install).
 */
function setManifest(dir: string, manifest: Record<string, unknown>): void {
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  git(["add", "package.json"], dir);
  git(["commit", "--quiet", "-m", "declare dependencies"], dir);
}

describe("start --worktree", () => {
  it("creates the worktree, records worktree_path, and commits the claim inside it", () => {
    const dir = initRepo();
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.worktreePath).toBe(expectedPath);
    expect(result.worktreeCreated).toBe(true);
    expect(result.created).toBe(true);
    expect(result.committed).toBe(true);
    expect(result.branch).toBe("feat/task-alpha");
    expect(existsSync(expectedPath)).toBe(true);

    // The item in the worktree carries branch + worktree_path; the claim is committed there.
    const wtFile = join(expectedPath, "ArggonManager/launch/auth/login/task-alpha.md");
    const data = parseFrontmatter(readFileSync(wtFile, "utf8")).data;
    expect(data.branch).toBe("feat/task-alpha");
    expect(data.worktree_path).toBe(expectedPath);
    expect(data.status).toBe("in_progress");
    expect(git(["log", "--format=%s"], expectedPath)).toContain(`claim: task-alpha`);
    expect(git(["symbolic-ref", "--short", "HEAD"], expectedPath)).toBe("feat/task-alpha");

    // The main checkout stays on main, clean, without the records.
    expect(git(["symbolic-ref", "--short", "HEAD"], dir)).toBe("main");
    expect(git(["status", "--porcelain"], dir)).toBe("");
    const rootData = parseFrontmatter(
      readFileSync(join(dir, "ArggonManager/launch/auth/login/task-alpha.md"), "utf8"),
    ).data;
    expect(rootData.status).toBe("todo");
    expect(rootData.worktree_path).toBeUndefined();

    // The additive key is forward-declared: validate stays silent.
    const validation = runValidate({ cwd: dir });
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
  });

  it("appends Closes #N to the worktree PR body for items with a linked issue", () => {
    const dir = initRepo();
    // runCreate auto-commits its own file now (task-auto-commit-tracker),
    // so the tree stays clean for start --worktree.
    runCreate({
      cwd: dir,
      type: "task",
      title: "Linked",
      parent: "login",
      id: "linked",
      issue: 9,
      now: NOW,
    });
    expect(git(["status", "--porcelain"], dir)).toBe("");

    const prBodies: string[] = [];
    const result = runStart(
      { cwd: dir, id: "task-linked", assignee: "arggon", worktree: true, openPr: true, now: NOW },
      {
        git: {
          ...localGit(),
          createDraftPr: (_cwd, input) => {
            prBodies.push(input.body);
            return "https://github.com/o/r/pull/2";
          },
        },
      },
    );

    expect(result.prUrl).toBe("https://github.com/o/r/pull/2");
    expect(prBodies).toEqual([
      "Work item: task-linked\n\nPath: ArggonManager/launch/auth/login/task-linked.md\n\n" +
        "Draft opened by `arggon start --worktree`.\n\nCloses #9",
    ]);
  });

  it("attaches on re-run instead of failing or duplicating the worktree", () => {
    const dir = initRepo();
    const first = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    const second = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    expect(second.worktreePath).toBe(first.worktreePath);
    expect(second.worktreeCreated).toBe(false);
    expect(second.committed).toBe(false);
    expect(second.pushed).toBe(false);
    expect(worktreeCount(dir)).toBe(2);
  });

  it("fails with an actionable error when the path exists but is not a worktree", () => {
    const dir = initRepo();
    const blocker = resolve(dirname(dir), `${basename(dir)}-task-alpha`);
    mkdirSync(blocker, { recursive: true });
    expect(() =>
      runStart(
        { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
        { git: localGit() },
      ),
    ).toThrow(/not a git worktree/);
    expect(worktreeCount(dir)).toBe(1);
  });

  it("keeps the worktree and says how to discard it when the claim is taken", () => {
    const dir = initRepo();
    // Claim the item on main first; the worktree copy still says todo, so the
    // claim conflict only surfaces once updates run inside the worktree.
    runUpdate({ cwd: dir, id: "task-alpha", status: "in_progress", assignee: "alice", now: NOW });
    git(["add", "ArggonManager"], dir);
    git(["commit", "--quiet", "-m", "claim task-alpha"], dir);
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const message = startError(dir, "task-alpha", "bob");

    expect(message).toMatch(/claim conflict/);
    expect(message).toContain(expectedPath);
    expect(message).toContain("attaches");
    // bug-start-worktree-node-modules: no rollback — worktree AND branch stay.
    expect(existsSync(expectedPath)).toBe(true);
    expect(worktreeCount(dir)).toBe(2);
    expect(refExists(dir, "refs/heads/feat/task-alpha")).toBe(true);
    // The main checkout is untouched and still on main.
    expect(git(["status", "--porcelain"], dir)).toBe("");
    expect(git(["symbolic-ref", "--short", "HEAD"], dir)).toBe("main");
  });
});

describe("start --worktree prepares the worktree and keeps it on failure (bug-start-worktree-node-modules)", () => {
  it("links the primary node_modules so a dependency gate can run, and reports it", () => {
    const dir = initRepo();
    addFakeDependency(dir, "fake-gate-dep");
    // The fixture stand-in for the documented `npm run arggon -- validate`
    // gate: it needs the project install, which only exists in the primary
    // checkout before the fix. The marker proves the gate really ran.
    setPreCommitHook(
      dir,
      "#!/bin/sh\nnode -e \"require('fake-gate-dep')\" || exit 1\ntouch .gate-ran\n",
    );
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.linkedNodeModules).toBe(true);
    expect(result.committed).toBe(true);
    // The worktree carries a symlink to the primary install, not a copy.
    const link = join(expectedPath, "node_modules");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe(join(dir, "node_modules"));
    // The gate ran inside the worktree — no hook bypass.
    expect(existsSync(join(expectedPath, ".gate-ran"))).toBe(true);
    // The claim commit landed; it stages only the item file, so the untracked
    // link (not ignored — `node_modules/` matches directories only) is absent.
    expect(git(["log", "--format=%s"], expectedPath)).toContain("claim: task-alpha");
    expect(git(["show", "--name-only", "--format=", "HEAD"], expectedPath).trim()).toBe(
      "ArggonManager/launch/auth/login/task-alpha.md",
    );
  });

  it("reports workspace packages the linked install resolves into the primary (PR #374 finding 2)", () => {
    const dir = initRepo();
    addWorkspacePackage(dir);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.linkedNodeModules).toBe(true);
    // Resolution goes into the primary checkout: the worktree's spawned CLI and
    // tests would run the primary's kernel build, not the worktree's own copy.
    expect(result.linkedWorkspaces).toEqual(["@arggondev/lib"]);
    // A worktree without its own copy has nothing to shadow: the fresh worktree
    // of a repo that does not track `lib/` stays silent.
    const plain = initRepo();
    addWorkspaceLink(plain, "@arggondev", "lib", "lib");
    const plainResult = runStart(
      { cwd: plain, id: "task-bravo", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    expect(plainResult.linkedWorkspaces).toEqual([]);
  });

  it("reports the post-hook resolution state (PR #384 review F2)", () => {
    const dir = initRepo();
    addWorkspacePackage(dir);
    // The remediation the docs recommend, run as the post-start hook: it
    // reifies a real local install whose workspace link points at the
    // worktree's own copy.
    setPostStart(
      dir,
      "mkdir -p node_modules/@arggondev && ln -s ../../lib node_modules/@arggondev/lib",
    );

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.postStart?.ok).toBe(true);
    // start linked the primary install for the claim-commit gate...
    expect(result.linkedNodeModules).toBe(true);
    // ...but the report describes the state the worktree is LEFT in: the hook
    // installed locally, so nothing resolves into the primary any more. The
    // pre-hook value would have claimed the opposite (PR #384 review F2).
    expect(result.linkedWorkspaces).toEqual([]);

    // A hook that leaves no install at all is re-linked by start, and the
    // report names the shadowed package again.
    const relaxed = initRepo();
    addWorkspacePackage(relaxed);
    setPostStart(relaxed, "true");
    const relinked = runStart(
      { cwd: relaxed, id: "task-bravo", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    expect(relinked.postStart?.ok).toBe(true);
    expect(relinked.linkedNodeModules).toBe(true);
    expect(relinked.linkedWorkspaces).toEqual(["@arggondev/lib"]);
  });

  it("refuses a fresh worktree whose stale mirrored install cannot provide a declared bin (bug-worktree-readiness-misses-stale-primary-install + bug-start-install-ordering)", () => {
    const dir = initRepo();
    addFakeDependency(dir, "fake-gate-dep");
    // The measured machine state, reproduced deterministically: a declared
    // devDependency the primary's install (and therefore every link farm
    // mirroring it) cannot resolve. Reported by name before this fix as
    // `ready: true` with the claim landing anyway (incident 3's "readiness
    // passed while the environment needed hand-install"); a start that
    // CREATED the worktree now refuses before any claim, naming it.
    setManifest(dir, {
      name: "fixture-repo",
      dependencies: { "fake-gate-dep": "^1.0.0" },
      devDependencies: { "@ast-grep/cli": "0.45.3" },
    });
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const message = startError(dir, "task-alpha", "arggon");

    // The named dependency (#517's observation) inside the refusal
    // (bug-start-install-ordering's consequence), with both remedies.
    expect(message).toContain("fresh worktree must leave a gate-usable install");
    expect(message).toContain("@ast-grep/cli: not resolvable from the worktree");
    expect(message).toContain("Preparation ran: link:symlink-created");
    expect(message).toContain("npm ci");
    expect(message).toContain("npm install");
    expect(message).toContain(expectedPath);
    expect(message).toMatch(/kept/);
    // The worktree was kept, prepared (the linked install is there) — and the
    // claim never happened: the item copy is untouched.
    expect(existsSync(join(expectedPath, "ArggonManager"))).toBe(true);
    expect(existsSync(join(expectedPath, "node_modules", "fake-gate-dep"))).toBe(true);
    const itemCopy = join(
      expectedPath,
      "ArggonManager",
      "launch",
      "auth",
      "login",
      "task-alpha.md",
    );
    expect(readFileSync(itemCopy, "utf8")).toContain("status: todo");
    expect(
      git(
        ["status", "--porcelain", "--", "ArggonManager/launch/auth/login/task-alpha.md"],
        expectedPath,
      ),
    ).toBe("");
  });

  it("refuses a cold fixture whose only remedy would be the post-claim hook, and reports satisfied once the remedy installs locally", () => {
    const dir = initRepo();
    setManifest(dir, { name: "fixture-repo", devDependencies: { "hook-dep": "1.0.0" } });
    // The hook runs AFTER the claim commit, so it cannot be the PRE-claim
    // remedy: with the declared dependency resolving nowhere at preparation
    // time, the fresh-worktree install gate refuses (bug-start-install-ordering).
    setPostStart(
      dir,
      "mkdir -p node_modules/hook-dep && echo '{}' > node_modules/hook-dep/package.json",
    );
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const message = startError(dir, "task-alpha", "arggon");

    expect(message).toContain("fresh worktree must leave a gate-usable install");
    expect(message).toContain("hook-dep: not resolvable from the worktree");
    expect(message).toContain("npm ci");
    expect(existsSync(expectedPath)).toBe(true);

    // The documented remedy — a worktree-local install (the `npm ci`
    // stand-in) — then the attach lands the claim, and the receipt describes
    // the state the worktree is LEFT in.
    mkdirSync(join(expectedPath, "node_modules", "hook-dep"), { recursive: true });
    writeFileSync(
      join(expectedPath, "node_modules", "hook-dep", "package.json"),
      JSON.stringify({ name: "hook-dep", version: "1.0.0" }),
    );
    const retry = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    expect(retry.worktreeCreated).toBe(false);
    expect(retry.committed).toBe(true);
    expect(retry.manifestCoverage).toBe("satisfied");
    expect(retry.missingDependencies).toEqual([]);
    expect(retry.missingDependenciesTotal).toBe(0);
    // Attach runs no hook (creation-only), so nothing re-linked either.
    expect(retry.postStart).toBeUndefined();
    expect(retry.postStartRelink).toBeUndefined();
  });

  it("keeps the worktree, reports the failing step + remediation, and a re-run attaches", () => {
    const dir = initRepo();
    setPreCommitHook(dir, '#!/bin/sh\necho "gate: deliberate failure" >&2\nexit 1\n');
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const message = startError(dir, "task-alpha", "arggon");

    // The gate's own output proves it ran (never --no-verify'd)...
    expect(message).toContain("gate: deliberate failure");
    expect(message).toContain("committing the claim");
    expect(message).toContain(expectedPath);
    expect(message).toContain("attaches");
    expect(message).toMatch(/kept/);
    // ...and nothing was rolled back: worktree, branch and the uncommitted
    // claim all survive for inspection.
    expect(existsSync(expectedPath)).toBe(true);
    expect(worktreeCount(dir)).toBe(2);
    expect(refExists(dir, "refs/heads/feat/task-alpha")).toBe(true);
    expect(
      git(
        ["status", "--porcelain", "--", "ArggonManager/launch/auth/login/task-alpha.md"],
        expectedPath,
      ),
    ).not.toBe("");

    // The remediation is real: fix the gate and re-run — it attaches and lands
    // the claim commit that previously failed.
    setPreCommitHook(dir, "#!/bin/sh\nexit 0\n");
    const retry = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    expect(retry.worktreeCreated).toBe(false);
    expect(retry.worktreePath).toBe(expectedPath);
    expect(retry.committed).toBe(true);
    expect(git(["log", "--format=%s"], expectedPath)).toContain("claim: task-alpha");
  });

  it("leaves repos without a pre-commit hook unaffected", () => {
    const dir = initRepo();
    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(existsSync(join(dir, ".git", "hooks", "pre-commit"))).toBe(false);
    expect(result.linkedNodeModules).toBe(false); // no primary node_modules to link
    expect(result.committed).toBe(true);
    expect(result.pushed).toBe(true);
    expect(existsSync(join(result.worktreePath!, "node_modules"))).toBe(false);
    expect(git(["log", "--format=%s"], result.worktreePath!)).toContain("claim: task-alpha");
  });

  it("links when attaching to an existing worktree that has no node_modules", () => {
    const dir = initRepo();
    addFakeDependency(dir, "fake-gate-dep");
    // The documented workaround shape: a manually pre-created worktree is
    // attached on the (re-)run and must still gain the link.
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);
    git(["worktree", "add", "--quiet", "-b", "feat/task-alpha", expectedPath], dir);
    runUpdate({
      cwd: dir,
      id: "task-alpha",
      status: "in_progress",
      assignee: "arggon",
      branch: "feat/task-alpha",
      worktreePath: expectedPath,
      now: NOW,
    });
    git(["add", "ArggonManager"], dir);
    git(["commit", "--quiet", "-m", "pre-created worktree"], dir);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.worktreeCreated).toBe(false);
    expect(result.linkedNodeModules).toBe(true);
    expect(lstatSync(join(expectedPath, "node_modules")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(expectedPath, "node_modules"))).toBe(join(dir, "node_modules"));
  });

  it("hides the link from a configured post-start hook so npm ci cannot empty the primary", () => {
    const dir = initRepo();
    addFakeDependency(dir, "fake-gate-dep");
    // The gate needs the primary install: it proves the link exists BEFORE the
    // hook and is only removed for the hook itself.
    setPreCommitHook(dir, "#!/bin/sh\nnode -e \"require('fake-gate-dep')\" || exit 1\n");
    // The hook records what node_modules is when it runs, then reifies over it
    // exactly like npm ci's clean step would (a shell glob through a symlink
    // deletes the PRIMARY's entries) and installs its own.
    setPostStart(
      dir,
      "ls -l node_modules > .hook-saw-node-modules 2>&1 || echo 'node_modules absent' > .hook-saw-node-modules; " +
        "rm -rf node_modules/*; mkdir -p node_modules/hook-dep",
    );
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.postStart?.ok).toBe(true);
    expect(result.committed).toBe(true);
    expect(result.linkedNodeModules).toBe(true); // the link ran the gate...
    // ...but the hook never saw a symlink pointing at the primary install.
    const saw = readFileSync(join(expectedPath, ".hook-saw-node-modules"), "utf8");
    expect(saw).not.toContain("->");
    expect(saw).not.toContain(join(dir, "node_modules"));
    // The primary install survived the reify, and the hook's real install stands.
    expect(existsSync(join(dir, "node_modules", "fake-gate-dep", "index.js"))).toBe(true);
    expect(lstatSync(join(expectedPath, "node_modules")).isSymbolicLink()).toBe(false);
    expect(existsSync(join(expectedPath, "node_modules", "hook-dep"))).toBe(true);
  });

  it("re-links after a post-start hook that leaves no node_modules", () => {
    const dir = initRepo();
    addFakeDependency(dir, "fake-gate-dep");
    // A hook that does not bootstrap: it sees no link, installs nothing, and
    // start restores the link afterwards so the worktree stays gate-ready.
    setPostStart(dir, "ls -l node_modules > .hook-saw-node-modules || true");
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.postStart?.ok).toBe(true);
    expect(result.linkedNodeModules).toBe(true);
    expect(readFileSync(join(expectedPath, ".hook-saw-node-modules"), "utf8")).not.toContain("->");
    expect(lstatSync(join(expectedPath, "node_modules")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(expectedPath, "node_modules"))).toBe(join(dir, "node_modules"));
  });

  it("writes the worktree env contract and never overwrites it on attach (spec worktree-env-contract-016)", () => {
    const dir = initRepo();
    writeFileSync(join(dir, ".env"), "SECRET=primary\n", "utf8");
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const created = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    // Fresh start: the six documented keys, the seeded .env, and the probe.
    expect(created.env.written).toBe(true);
    expect(created.env.keys).toEqual([
      "ARGON_ITEM",
      "ARGGON_WORKTREE_ID",
      "ARGGON_WORKTREE_PATH",
      "ARGGON_WORKTREE_BRANCH",
      "ARGGON_STATE_DIR",
      "ARGGON_CACHE_DIR",
    ]);
    expect(created.env.seededDotenv).toBe(join(expectedPath, ".env"));
    expect(created.env.gitignored).toBe(true); // init's generated .gitignore carries .arggon.env
    const envFile = join(expectedPath, ".arggon.env");
    const raw = readFileSync(envFile, "utf8");
    expect(raw).toContain(`ARGON_ITEM=task-alpha\n`);
    expect(raw).toContain(`ARGGON_WORKTREE_ID=${basename(dir)}-task-alpha\n`);
    expect(raw).toContain(`ARGGON_WORKTREE_BRANCH=feat/task-alpha\n`);
    // The claim commit staged only the item file: the env file is never
    // committed (the smoke's "contains only the item file" leg proves it
    // end-to-end; here the worktree status names the env file untracked).
    const status = spawnSync("git", ["status", "--porcelain"], {
      cwd: expectedPath,
      encoding: "utf8",
    });
    expect(status.stdout).not.toMatch(/^A\s+\.arggon\.env$/m);

    // Attach: byte-identical, seeded .env untouched, written:false + reason.
    writeFileSync(envFile, "ARGON_ITEM=adopter-owned\n", "utf8");
    writeFileSync(join(expectedPath, ".env"), "SECRET=adopter\n", "utf8");
    const attached = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    expect(readFileSync(envFile, "utf8")).toBe("ARGON_ITEM=adopter-owned\n");
    expect(readFileSync(join(expectedPath, ".env"), "utf8")).toBe("SECRET=adopter\n");
    expect(attached.env.written).toBe(false);
    expect(attached.env.path).toBe(envFile);
    expect(attached.env.warning).toContain("byte-identical");
  });

  it("honors x-worktree.env: false — no env file, written:false + reason", () => {
    const dir = initRepo();
    appendFileSync(join(dir, "ArggonManager/.convention.yml"), "x-worktree:\n  env: false\n");
    commitAllIfDirty(dir, "disable the env contract");
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.env).toEqual({
      written: false,
      warning: "disabled via x-worktree.env: false",
    });
    expect(existsSync(join(expectedPath, ".arggon.env"))).toBe(false);
    // The claim still landed: the opt-out never blocks the claim path.
    expect(result.committed).toBe(true);
  });

  it("tells the user to push manually when the push step fails, and attach does not retry it", () => {
    const dir = initRepo();
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);
    const failingGit = {
      ...localGit(),
      pushBranch: () => {
        throw new Error("remote rejected the push (no access)");
      },
    };

    let message = "";
    try {
      runStart(
        { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
        { git: failingGit },
      );
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }

    // F3: the remediation must not promise the attach re-run retries the push.
    expect(message).toContain("pushing the branch");
    expect(message).toContain("git push -u origin feat/task-alpha");
    expect(message).toContain("does not retry the push");
    // The kept worktree holds the committed claim, ready for that manual push.
    expect(existsSync(expectedPath)).toBe(true);
    expect(git(["log", "--format=%s"], expectedPath)).toContain("claim: task-alpha");

    // Pinned: an attach re-run succeeds without pushing.
    const retry = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    expect(retry.worktreeCreated).toBe(false);
    expect(retry.committed).toBe(false);
    expect(retry.pushed).toBe(false);
  });
});

describe("start --worktree post-start hook (x-worktree)", () => {
  it("runs the configured command inside the new worktree cwd", () => {
    const dir = initRepo();
    setPostStart(dir, "pwd > .post-start-cwd");

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);
    expect(result.postStart).toEqual({ command: "pwd > .post-start-cwd", ok: true });
    // The marker proves the hook ran with cwd = the worktree root.
    expect(readFileSync(join(expectedPath, ".post-start-cwd"), "utf8").trim()).toBe(expectedPath);
  });

  it("reports a failing hook but keeps the start successful", () => {
    const dir = initRepo();
    setPostStart(dir, "echo boom >&2; exit 3");

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    // The worktree exists and the claim stands; only the hook failed.
    expect(existsSync(result.worktreePath!)).toBe(true);
    expect(result.item.status).toBe("in_progress");
    expect(result.postStart).toMatchObject({
      command: "echo boom >&2; exit 3",
      ok: false,
    });
    expect(result.postStart?.error).toContain("post-start failed: echo boom >&2; exit 3");
    expect(result.postStart?.error).toContain("boom");
  });

  it("--no-hook skips the hook for that invocation", () => {
    const dir = initRepo();
    setPostStart(dir, "pwd > .post-start-cwd");

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, noHook: true, now: NOW },
      { git: localGit() },
    );

    expect(result.postStart).toBeUndefined();
    expect(existsSync(join(result.worktreePath!, ".post-start-cwd"))).toBe(false);
  });

  it("is a no-op without x-worktree.post-start config", () => {
    const dir = initRepo();

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.postStart).toBeUndefined();
  });

  it("does not re-run the hook when a re-run attaches to the worktree", () => {
    const dir = initRepo();
    setPostStart(dir, "echo run >> .post-start-count");

    const first = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    const second = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(first.postStart).toEqual({ command: "echo run >> .post-start-count", ok: true });
    expect(second.worktreeCreated).toBe(false);
    expect(second.postStart).toBeUndefined();
    expect(readFileSync(join(first.worktreePath!, ".post-start-count"), "utf8").trim()).toBe("run");
  });
});

describe("post-start shell variant (task-post-start-env)", () => {
  /**
   * A stand-in "$SHELL" that records its argv tail into `log` (no dependence
   * on the test machine's real shell or profile files) and then execs
   * /bin/sh, so `-lc` still behaves like a login shell invocation.
   */
  function fakeLoginShell(dir: string, log: string): string {
    const path = join(dir, "fakeshell");
    writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${log}"\nexec /bin/sh "$@"\n`);
    chmodSync(path, 0o755);
    return path;
  }

  /** withShell: run fn with SHELL pointed at `shell`, restoring afterwards. */
  function withShell<T>(shell: string | undefined, fn: () => T): T {
    const prev = process.env.SHELL;
    if (shell === undefined) delete process.env.SHELL;
    else process.env.SHELL = shell;
    try {
      return fn();
    } finally {
      if (prev === undefined) delete process.env.SHELL;
      else process.env.SHELL = prev;
    }
  }

  /** Configure post-start + post-start-shell and commit (tree must be clean). */
  function setPostStartWithShell(dir: string, command: string, shell: string | null): void {
    const shellLine = shell ? `\n  post-start-shell: "${shell}"` : "";
    appendFileSync(
      join(dir, "ArggonManager/.convention.yml"),
      `x-worktree:\n  post-start: "${command}"${shellLine}\n`,
    );
    git(["add", "ArggonManager/.convention.yml"], dir);
    git(["commit", "--quiet", "-m", "config: x-worktree.post-start-shell"], dir);
  }

  it("x-worktree.post-start-shell: login runs the hook via the login shell", () => {
    const dir = initRepo();
    const log = join(dir, "fakeshell.log");
    setPostStartWithShell(dir, "pwd > .post-start-cwd", "login");
    const fake = fakeLoginShell(dir, log);

    const result = withShell(fake, () =>
      runStart(
        { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
        { git: localGit() },
      ),
    );

    expect(result.postStart).toEqual({ command: "pwd > .post-start-cwd", ok: true });
    // The fake shell saw the -lc login invocation...
    expect(readFileSync(log, "utf8")).toContain("-lc");
    // ...and the hook still ran with cwd = the freshly created worktree root.
    expect(readFileSync(join(result.worktreePath!, ".post-start-cwd"), "utf8").trim()).toBe(
      result.worktreePath,
    );
  });

  it("defaults to the inheriting shell (no $SHELL -lc) when unset", () => {
    const dir = initRepo();
    const log = join(dir, "fakeshell.log");
    setPostStartWithShell(dir, "pwd > .post-start-cwd", null);

    const result = withShell(undefined, () =>
      runStart(
        { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
        { git: localGit() },
      ),
    );

    expect(result.postStart).toEqual({ command: "pwd > .post-start-cwd", ok: true });
    expect(existsSync(log)).toBe(false);
    expect(readFileSync(join(result.worktreePath!, ".post-start-cwd"), "utf8").trim()).toBe(
      result.worktreePath,
    );
  });

  it("the --post-start-shell start flag wins over the config value", () => {
    const dir = initRepo();
    const log = join(dir, "fakeshell.log");
    setPostStartWithShell(dir, "pwd > .post-start-cwd", null);
    const fake = fakeLoginShell(dir, log);

    // Flag "login" over inherit config: hook goes through the login shell.
    withShell(fake, () =>
      runStart(
        {
          cwd: dir,
          id: "task-alpha",
          assignee: "arggon",
          worktree: true,
          postStartShell: "login",
          now: NOW,
        },
        { git: localGit() },
      ),
    );
    expect(readFileSync(log, "utf8")).toContain("-lc");

    // Flag "inherit" over login config: hook bypasses $SHELL.
    const dir2 = initRepo();
    const log2 = join(dir2, "fakeshell.log");
    setPostStartWithShell(dir2, "pwd > .post-start-cwd", "login");
    const fake2 = fakeLoginShell(dir2, log2);
    const inherit = withShell(fake2, () =>
      runStart(
        {
          cwd: dir2,
          id: "task-alpha",
          assignee: "arggon",
          worktree: true,
          postStartShell: "inherit",
          now: NOW,
        },
        { git: localGit() },
      ),
    );
    expect(existsSync(log2)).toBe(false);
    expect(inherit.postStart).toEqual({ command: "pwd > .post-start-cwd", ok: true });
  });

  it("failure reports carry the PATH-inheritance hint", () => {
    const dir = initRepo();
    setPostStartWithShell(dir, "echo boom >&2; exit 3", null);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.postStart?.ok).toBe(false);
    expect(result.postStart?.error).toContain("post-start failed: echo boom >&2; exit 3");
    expect(result.postStart?.error).toContain("boom");
    expect(result.postStart?.error).toContain("hooks inherit the environment of the process");
    expect(result.postStart?.error).toContain('x-worktree.post-start-shell: "login"');
    // Failure is still non-fatal: the start itself succeeded.
    expect(result.worktreeCreated).toBe(true);
  });
});

/**
 * alpha: done + merged worktree; bravo: todo worktree; charlie: done + unmerged worktree.
 * (Module scope: shared by the cleanup describes, incl. the Compose-reap one.)
 */
function initCleanupRepo(): { dir: string; paths: Record<string, string> } {
  const dir = initRepo();
  const paths: Record<string, string> = {};

  // alpha: full merged cycle via start --worktree.
  const alpha = runStart(
    { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
    { git: localGit() },
  );
  paths["task-alpha"] = alpha.worktreePath!;
  runUpdate({ cwd: alpha.worktreePath!, id: "task-alpha", status: "done", now: NOW });
  git(["add", "ArggonManager"], alpha.worktreePath!);
  git(["commit", "--quiet", "-m", "close task-alpha"], alpha.worktreePath!);
  git(["merge", "--quiet", "feat/task-alpha"], dir);

  // bravo: worktree exists, item still todo on main.
  paths["task-bravo"] = resolve(dirname(dir), `${basename(dir)}-task-bravo`);
  git(["worktree", "add", "--quiet", "-b", "feat/task-bravo", paths["task-bravo"]], dir);
  runUpdate({ cwd: dir, id: "task-bravo", worktreePath: paths["task-bravo"], now: NOW });

  // charlie: done on main but its branch carries an unmerged commit.
  paths["task-charlie"] = resolve(dirname(dir), `${basename(dir)}-task-charlie`);
  git(["worktree", "add", "--quiet", "-b", "feat/task-charlie", paths["task-charlie"]], dir);
  const charlieNote = join(paths["task-charlie"], "unmerged.txt");
  spawnSync("touch", [charlieNote]);
  git(["add", "unmerged.txt"], paths["task-charlie"]);
  git(["commit", "--quiet", "-m", "wip"], paths["task-charlie"]);
  runUpdate({
    cwd: dir,
    id: "task-charlie",
    status: "in_progress",
    assignee: "arggon",
    branch: "feat/task-charlie",
    worktreePath: paths["task-charlie"],
    now: NOW,
  });
  runUpdate({ cwd: dir, id: "task-charlie", status: "done", now: NOW });

  // Commit the crafted main-copy records so the tree is clean.
  git(["add", "ArggonManager"], dir);
  git(["commit", "--quiet", "-m", "records"], dir);
  return { dir, paths };
}

describe("arggon cleanup", () => {
  it("lists only terminal items with merged branches (default mode removes nothing)", () => {
    const { dir, paths } = initCleanupRepo();

    const result = runCleanup({ cwd: dir, noGh: true });

    expect(result.base).toBe("main");
    expect(result.entries.map((e) => e.id)).toEqual(["task-alpha", "task-bravo", "task-charlie"]);
    const byId = new Map(result.entries.map((e) => [e.id, e]));
    expect(byId.get("task-alpha")).toMatchObject({ removable: true, branch: "feat/task-alpha" });
    expect(byId.get("task-bravo")?.removable).toBe(false);
    expect(byId.get("task-bravo")?.reason).toContain("todo");
    expect(byId.get("task-charlie")?.removable).toBe(false);
    expect(byId.get("task-charlie")?.reason).toContain("not fully merged");
    expect(result.pruned).toEqual([]);
    // Nothing was touched in list mode.
    for (const path of Object.values(paths)) {
      expect(existsSync(path)).toBe(true);
    }
    expect(worktreeCount(dir)).toBe(4);
  });

  it("--prune removes merged worktrees and deletes their branches, skipping the rest", () => {
    const { dir, paths } = initCleanupRepo();

    const result = runCleanup({ cwd: dir, prune: true, noGh: true });

    expect(result.failures).toEqual([]);
    expect(result.pruned.map((a) => a.action)).toEqual([
      `removed worktree ${paths["task-alpha"]}`,
      "deleted branch feat/task-alpha",
      "cleared worktree_path",
    ]);
    expect(existsSync(paths["task-alpha"])).toBe(false);
    expect(refExists(dir, "refs/heads/feat/task-alpha")).toBe(false);
    // The record is cleared on the item.
    const raw = readFileSync(join(dir, "ArggonManager/launch/auth/login/task-alpha.md"), "utf8");
    expect(parseFrontmatter(raw).data.worktree_path).toBeUndefined();
    // Skipped entries survive untouched.
    expect(existsSync(paths["task-bravo"])).toBe(true);
    expect(existsSync(paths["task-charlie"])).toBe(true);
    expect(refExists(dir, "refs/heads/feat/task-charlie")).toBe(true);
  });

  it("prunes a worktree whose start-created node_modules link is untracked (review F2)", () => {
    const dir = initRepo();
    addFakeDependency(dir, "fake-gate-dep");
    const alpha = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    const wt = alpha.worktreePath!;
    // The link is untracked and NOT ignored (`node_modules/` matches dirs only),
    // so plain `git worktree remove` refuses the worktree without the fix.
    expect(git(["status", "--porcelain"], wt)).toContain("?? node_modules");
    runUpdate({ cwd: wt, id: "task-alpha", status: "done", now: NOW });
    git(["add", "ArggonManager"], wt);
    git(["commit", "--quiet", "-m", "close task-alpha"], wt);
    git(["merge", "--quiet", "feat/task-alpha"], dir);

    const result = runCleanup({ cwd: dir, prune: true, noGh: true });

    expect(result.failures).toEqual([]);
    expect(result.pruned.map((a) => a.action)).toEqual([
      `removed worktree ${wt}`,
      "deleted branch feat/task-alpha",
      "cleared worktree_path",
    ]);
    expect(existsSync(wt)).toBe(false);
    // Only the worktree's link was removed: the primary install is untouched.
    expect(existsSync(join(dir, "node_modules", "fake-gate-dep", "index.js"))).toBe(true);
  });

  it("prunes a main-checkout link when run from a linked worktree (review R3)", () => {
    const dir = initRepo();
    addFakeDependency(dir, "fake-gate-dep");
    // task-alpha's worktree was created by a start run from the MAIN checkout,
    // so its link points at dir/node_modules.
    const alpha = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    const wt = alpha.worktreePath!;
    expect(readlinkSync(join(wt, "node_modules"))).toBe(join(dir, "node_modules"));
    runUpdate({ cwd: wt, id: "task-alpha", status: "done", now: NOW });
    git(["add", "ArggonManager"], wt);
    git(["commit", "--quiet", "-m", "close task-alpha"], wt);
    git(["merge", "--quiet", "feat/task-alpha"], dir);

    // Nested case: cleanup runs inside a LINKED worktree of the same repo (no
    // node_modules of its own), so its root is not the checkout the link points
    // at — exactly the program repro.
    const session = resolve(dirname(dir), `${basename(dir)}-task-session`);
    git(["worktree", "add", "--quiet", "-b", "feat/session", session], dir);
    expect(existsSync(join(session, "node_modules"))).toBe(false);

    const result = runCleanup({ cwd: session, prune: true, noGh: true });

    expect(result.failures).toEqual([]);
    expect(result.pruned.map((a) => a.action)).toEqual([
      `removed worktree ${wt}`,
      "deleted branch feat/task-alpha",
      "cleared worktree_path",
    ]);
    expect(existsSync(wt)).toBe(false);
    // Only the worktree's link was removed: the main install is untouched.
    expect(existsSync(join(dir, "node_modules", "fake-gate-dep", "index.js"))).toBe(true);
  });

  it("emits the standard --json envelope via the CLI", () => {
    const { dir } = initCleanupRepo();
    const r = runCli(["cleanup", "--json", "--no-gh"], dir);
    expect(r.status).toBe(0);
    const envelope = JSON.parse(r.stdout) as {
      ok: boolean;
      command: string;
      schemaVersion: number;
      base: string;
      candidates: Array<{ id: string; removable: boolean }>;
      pruned: unknown[];
    };
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe("cleanup");
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.base).toBe("main");
    expect(envelope.candidates).toHaveLength(3);
    expect(envelope.candidates.filter((c) => c.removable).map((c) => c.id)).toEqual(["task-alpha"]);
    expect(envelope.pruned).toEqual([]);
  });

  it("fails with a git-repository error outside a repo", () => {
    const bare = mkdtempSync(join(tmpdir(), "arggon-worktree-nogit-"));
    runInit({ dir: bare, force: false });
    expect(() => runCleanup({ cwd: bare })).toThrow(/not a git repository/);
  });

  /**
   * Repo with a bare remote and a task-alpha worktree whose pushed tip is C1.
   * With `amend: true` the local tip is rewritten past C1 (simulated lost
   * push): origin/feat/task-alpha then holds a commit that never reaches main
   * even after the branch is merged locally.
   */
  function initRemoteCleanupRepo(amend: boolean): { dir: string; paths: Record<string, string> } {
    const dir = initRepo();
    const remote = mkdtempSync(join(tmpdir(), "arggon-remote-"));
    // bug-ci-enotempty-rmretry: the bare remote opts out too — receive-pack
    // spawns the same detached maintenance daemon on push (trace2-verified).
    initFixtureRepo(remote, { bare: true });
    git(["remote", "add", "origin", remote], dir);

    const alpha = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    const wt = alpha.worktreePath!;
    spawnSync("touch", [join(wt, "alpha.txt")]);
    git(["add", "alpha.txt"], wt);
    git(["commit", "--quiet", "-m", "work"], wt);
    git(["push", "--quiet", "origin", "feat/task-alpha"], dir);
    if (amend) {
      // The final push is lost: the local tip is rewritten past the pushed one.
      spawnSync("touch", [join(wt, "lost.txt")]);
      git(["add", "lost.txt"], wt);
      git(["commit", "--quiet", "--amend", "--no-edit"], wt);
    }
    runUpdate({ cwd: wt, id: "task-alpha", status: "done", now: NOW });
    git(["add", "ArggonManager"], wt);
    git(["commit", "--quiet", "-m", "close task-alpha"], wt);
    // Fast-forward main so the closed record and the branch commits land.
    git(["merge", "--quiet", "--ff-only", "feat/task-alpha"], dir);
    return { dir, paths: { "task-alpha": wt } };
  }

  it("skips candidates whose remote branch is not merged into base (lost push)", () => {
    const { dir, paths } = initRemoteCleanupRepo(true);

    const result = runCleanup({ cwd: dir, prune: true });

    const entry = result.entries.find((e) => e.id === "task-alpha")!;
    expect(entry.removable).toBe(false);
    expect(entry.reason).toBe(
      "remote branch divergent or behind (origin/feat/task-alpha) — push or delete the remote branch first",
    );
    expect(result.pruned).toEqual([]);
    expect(result.failures).toEqual([]);
    // Nothing was touched: worktree and branch survive, the record stays.
    expect(existsSync(paths["task-alpha"])).toBe(true);
    expect(refExists(dir, "refs/heads/feat/task-alpha")).toBe(true);
    const raw = readFileSync(join(dir, "ArggonManager/launch/auth/login/task-alpha.md"), "utf8");
    expect(parseFrontmatter(raw).data.worktree_path).toBe(paths["task-alpha"]);
  });

  it("prunes normally when the remote branch is merged into base", () => {
    const { dir, paths } = initRemoteCleanupRepo(false);

    const result = runCleanup({ cwd: dir, prune: true });

    expect(result.failures).toEqual([]);
    const entry = result.entries.find((e) => e.id === "task-alpha")!;
    expect(entry.removable).toBe(true);
    expect(result.pruned.map((a) => a.action)).toEqual([
      `removed worktree ${paths["task-alpha"]}`,
      "deleted branch feat/task-alpha",
      "cleared worktree_path",
    ]);
    expect(existsSync(paths["task-alpha"])).toBe(false);
    expect(refExists(dir, "refs/heads/feat/task-alpha")).toBe(false);
  });

  it("clears the record and reports leftoverBranch when branch -d fails after removal", () => {
    const { dir, paths } = initCleanupRepo();
    const fakeGit = {
      ...defaultCleanupGit(),
      deleteBranch: () => {
        throw new Error("refusing to delete branch");
      },
    };

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { git: fakeGit });

    // The run stays green and continues, but the failure is visible on BOTH
    // surfaces with the SAME message: `pruned` (structured) AND `failures`
    // (bug-cli-cleanup-branch-delete-missing-failure).
    expect(result.failures).toEqual(["task-alpha: refusing to delete branch"]);
    expect(existsSync(paths["task-alpha"])).toBe(false);
    const raw = readFileSync(join(dir, "ArggonManager/launch/auth/login/task-alpha.md"), "utf8");
    expect(parseFrontmatter(raw).data.worktree_path).toBeUndefined();
    const failed = result.pruned.find((a) => a.action === "failed")!;
    expect(failed).toMatchObject({ id: "task-alpha", leftoverBranch: "feat/task-alpha" });
    expect(failed.error).toBe("refusing to delete branch");
  });

  it("bounds a branch-delete failure on BOTH surfaces (over-long stderr, control chars)", () => {
    const { dir } = initCleanupRepo();
    const fakeGit = {
      ...defaultCleanupGit(),
      deleteBranch: () => {
        throw new Error(`boom\r${"x".repeat(900)}\ttail`);
      },
    };

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { git: fakeGit });

    const failed = result.pruned.find((a) => a.action === "failed")!;
    expect(failed).toMatchObject({ id: "task-alpha", leftoverBranch: "feat/task-alpha" });
    // Control characters are stripped and the clip is MAX_ENVELOPE_DETAIL_CHARS
    // characters including the elision mark — the native MAX_NATIVE_DETAIL_CHARS
    // shape.
    expect(failed.error).toBeDefined();
    expect(failed.error).not.toMatch(/[\u0000-\u001f\u007f]/);
    expect(failed.error).toHaveLength(MAX_ENVELOPE_DETAIL_CHARS);
    expect(failed.error!.endsWith("…")).toBe(true);
    // Same bounded message on both surfaces.
    expect(result.failures).toEqual([`task-alpha: ${failed.error}`]);
  });

  it("bounds a non-Error branch-delete throw on BOTH surfaces", () => {
    const { dir } = initCleanupRepo();
    const fakeGit = {
      ...defaultCleanupGit(),
      deleteBranch: () => {
        throw "raw\r\nthrow"; // deliberate non-Error throw
      },
    };

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { git: fakeGit });

    // Each control character becomes ONE space (\r\n -> two spaces), exactly
    // like the native boundedNativeText replacement.
    expect(result.failures).toEqual(["task-alpha: raw  throw"]);
    expect(result.pruned.find((a) => a.action === "failed")!.error).toBe("raw  throw");
  });

  it("bounds an outer per-candidate failure on BOTH surfaces (over-long removal stderr)", () => {
    const { dir, paths } = initCleanupRepo();
    const fakeGit = {
      ...defaultCleanupGit(),
      removeWorktree: () => {
        throw new Error(`git worktree remove exploded\r\n${"e".repeat(1200)}`);
      },
    };

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { git: fakeGit });

    const failed = result.pruned.find((a) => a.action === "failed")!;
    expect(failed).toMatchObject({ id: "task-alpha", action: "failed" });
    expect(failed.error).toHaveLength(MAX_ENVELOPE_DETAIL_CHARS);
    expect(failed.error).not.toMatch(/[\u0000-\u001f\u007f]/);
    expect(result.failures).toEqual([`task-alpha: ${failed.error}`]);
    // A failed removal keeps the record (the worktree is still there).
    const raw = readFileSync(join(dir, "ArggonManager/launch/auth/login/task-alpha.md"), "utf8");
    expect(parseFrontmatter(raw).data.worktree_path).toBe(paths["task-alpha"]);
  });

  it("reports the remote-safety skip in the --json payload", () => {
    const { dir } = initRemoteCleanupRepo(true);

    const r = runCli(["cleanup", "--json", "--prune"], dir);
    expect(r.status).toBe(0);
    const envelope = JSON.parse(r.stdout) as {
      ok: boolean;
      candidates: Array<{ id: string; removable: boolean; reason: string | null }>;
      pruned: Array<{ id: string; action: string }>;
      failures: string[];
    };
    expect(envelope.ok).toBe(true);
    const alpha = envelope.candidates.find((c) => c.id === "task-alpha")!;
    expect(alpha.removable).toBe(false);
    expect(alpha.reason).toContain("remote branch divergent or behind (origin/feat/task-alpha)");
    expect(envelope.pruned).toEqual([]);
    expect(envelope.failures).toEqual([]);
  });

  it("reports a real branch-delete failure in BOTH pruned and failures in the --json payload", () => {
    const { dir, paths } = initCleanupRepo();
    // Force a REAL `git branch -d` refusal: detach the candidate worktree from
    // its branch, then check the branch out in a second worktree — cleanup
    // removes the candidate fine, but the branch stays checked out elsewhere
    // and `git branch -d` refuses ("used by worktree").
    git(["checkout", "--quiet", "--detach", "HEAD"], paths["task-alpha"]);
    const holder = resolve(dirname(dir), `${basename(dir)}-task-holder`);
    git(["worktree", "add", "--quiet", holder, "feat/task-alpha"], dir);

    const r = runCli(["cleanup", "--prune", "--json"], dir);
    // Per-item prune failures never abort the run and do NOT raise
    // CLEANUP_FAILED, and the exit code stays 0 even with non-empty
    // failures (task-cleanup-json-exit-code, docs/json-output.md §cleanup):
    // --json consumers gate on the payload; the exitCode=1 human-path rule
    // sits behind the json early-return in cli.ts.
    expect(r.status).toBe(0);
    const envelope = JSON.parse(r.stdout) as {
      ok: boolean;
      pruned: Array<{ id: string; action: string; error?: string; leftoverBranch?: string }>;
      failures: string[];
    };
    expect(envelope.ok).toBe(true);
    const failed = envelope.pruned.find((a) => a.action === "failed")!;
    expect(failed).toMatchObject({ id: "task-alpha", leftoverBranch: "feat/task-alpha" });
    expect(failed.error).toContain("used by worktree");
    // Same message on both surfaces (bug-cli-cleanup-branch-delete-missing-failure).
    expect(envelope.failures).toEqual([`task-alpha: ${failed.error}`]);
    // The worktree is gone, so the record is still cleared.
    const raw = readFileSync(join(dir, "ArggonManager/launch/auth/login/task-alpha.md"), "utf8");
    expect(parseFrontmatter(raw).data.worktree_path).toBeUndefined();
  });

  it("exits 1 on the human path when a prune failure occurred (unchanged human contract)", () => {
    const { dir, paths } = initCleanupRepo();
    // Same forced refusal as the --json test above: detach the candidate
    // worktree from its branch, then check the branch out in a second
    // worktree — cleanup removes the candidate fine, but `git branch -d`
    // refuses ("used by worktree").
    git(["checkout", "--quiet", "--detach", "HEAD"], paths["task-alpha"]);
    const holder = resolve(dirname(dir), `${basename(dir)}-task-holder`);
    git(["worktree", "add", "--quiet", holder, "feat/task-alpha"], dir);

    const r = runCli(["cleanup", "--prune"], dir);
    // Deliberate divergence from the --json path (exit 0 with failures[] in
    // the payload — task-cleanup-json-exit-code): text output has no
    // structured failure channel, so the human path sets exit 1.
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("failed:    task-alpha");
    expect(r.stderr).toContain("used by worktree");
    expect(r.stderr).toContain("(leftover branch: feat/task-alpha)");
    expect(r.stdout).toContain("arggon cleanup:");
  });

  /** Fake gh executor returning a merged PR list (task-cleanup-squash-merge). */
  function fakeGh(
    result: unknown,
    calls: string[][] = [],
  ): (file: string, args: string[]) => string {
    return (file, args) => {
      calls.push([file, ...args]);
      if (result === undefined) throw new Error("gh exploded");
      return JSON.stringify(result);
    };
  }

  // task-charlie is done with an UNMERGED branch — exactly the squash-merge
  // shape: git ancestry can never prove it was integrated.

  it("prunes a squash-merged branch via the gh fallback, annotated with the PR", () => {
    const { dir, paths } = initCleanupRepo();
    const calls: string[][] = [];

    const result = runCleanup(
      { cwd: dir, prune: true },
      {
        gh: fakeGh(
          [{ number: 12, url: "https://github.com/o/r/pull/12", mergedAt: "2026-09-13T00:00:00Z" }],
          calls,
        ),
      },
    );

    const entry = result.entries.find((e) => e.id === "task-charlie")!;
    expect(entry.removable).toBe(true);
    expect(entry.via).toBe("squash-merged PR #12");
    expect(result.failures).toEqual([]);
    expect(result.pruned.filter((a) => a.id === "task-charlie")).toEqual([
      {
        id: "task-charlie",
        action: `removed worktree ${paths["task-charlie"]}`,
        via: "squash-merged PR #12",
      },
      {
        id: "task-charlie",
        action: "deleted branch feat/task-charlie",
        via: "squash-merged PR #12",
      },
      { id: "task-charlie", action: "cleared worktree_path" },
    ]);
    expect(existsSync(paths["task-charlie"])).toBe(false);
    expect(refExists(dir, "refs/heads/feat/task-charlie")).toBe(false);
    const raw = readFileSync(join(dir, "ArggonManager/launch/auth/login/task-charlie.md"), "utf8");
    expect(parseFrontmatter(raw).data.worktree_path).toBeUndefined();
    // The gh query targets the branch with the merged-PR contract.
    expect(calls).toHaveLength(1);
    expect(calls[0].slice(0, 2)).toEqual(["gh", "pr"]);
    expect(calls[0]).toContain("--state");
    expect(calls[0][calls[0].indexOf("--state") + 1]).toBe("merged");
    expect(calls[0][calls[0].indexOf("--head") + 1]).toBe("feat/task-charlie");
  });

  it("skips when ancestry fails and gh finds no merged PR", () => {
    const { dir, paths } = initCleanupRepo();

    const result = runCleanup({ cwd: dir, prune: true }, { gh: fakeGh([]) });

    const entry = result.entries.find((e) => e.id === "task-charlie")!;
    expect(entry.removable).toBe(false);
    expect(entry.reason).toBe("branch not merged and no merged PR found");
    expect(result.pruned.filter((a) => a.id === "task-charlie")).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(existsSync(paths["task-charlie"])).toBe(true);
    expect(refExists(dir, "refs/heads/feat/task-charlie")).toBe(true);
  });

  it("skips (never crashes) when gh is unavailable", () => {
    const { dir, paths } = initCleanupRepo();

    const result = runCleanup({ cwd: dir, prune: true }, { gh: fakeGh(undefined) });

    const entry = result.entries.find((e) => e.id === "task-charlie")!;
    expect(entry.removable).toBe(false);
    expect(entry.reason).toBe(
      "ancestry check failed and gh is unavailable to check for squash-merged PRs",
    );
    expect(result.pruned.filter((a) => a.id === "task-charlie")).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(existsSync(paths["task-charlie"])).toBe(true);
  });

  it("--no-gh skips the gh fallback entirely (ancestry-only)", () => {
    const { dir } = initCleanupRepo();
    const calls: string[][] = [];

    const result = runCleanup(
      { cwd: dir, noGh: true },
      { gh: fakeGh([{ number: 12, url: "u", mergedAt: null }], calls) },
    );

    const entry = result.entries.find((e) => e.id === "task-charlie")!;
    expect(entry.removable).toBe(false);
    expect(entry.reason).toBe("branch 'feat/task-charlie' is not fully merged into 'main'");
    expect(calls).toEqual([]);
    expect(result.pruned).toEqual([]);
  });

  /**
   * Real `gh` shim on PATH that logs every invocation and answers `gh pr list`
   * with one merged PR (the squash-merge shape). The CLI spawn path resolves
   * gh through PATH, so this is the only way to prove the flag reached the
   * classifier (bug-cleanup-no-gh-ignored: commander names `--no-gh` `gh`,
   * and reading `opts.noGh` made the flag a silent no-op).
   */
  function fakeGhOnPath(): { bin: string; calls: () => string[] } {
    const bin = mkdtempSync(join(tmpdir(), "arggon-cleanup-gh-"));
    const log = join(bin, "gh-calls.log");
    const ghPath = join(bin, "gh");
    writeFileSync(
      ghPath,
      `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\n` +
        `echo '[{"number":12,"url":"https://github.com/o/r/pull/12","mergedAt":"2026-09-13T00:00:00Z"}]'\n`,
      "utf8",
    );
    chmodSync(ghPath, 0o755);
    return {
      bin,
      calls: () =>
        existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : [],
    };
  }

  it("--no-gh skips the gh fallback through the CLI; the default keeps it", () => {
    const { dir } = initCleanupRepo();
    const { bin, calls } = fakeGhOnPath();
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` };

    // Default: task-charlie (done + unmerged branch) is proven integrated by
    // the merged-PR fallback, so the shim is invoked exactly once.
    const fallback = runCli(["cleanup", "--json"], dir, { env });
    expect(fallback.status, fallback.stderr).toBe(0);
    const withGh = JSON.parse(fallback.stdout) as {
      candidates: Array<{ id: string; removable: boolean; via?: string }>;
    };
    expect(withGh.candidates.find((c) => c.id === "task-charlie")).toMatchObject({
      removable: true,
      via: "squash-merged PR #12",
    });
    expect(calls()).toHaveLength(1);
    expect(calls()[0]).toContain("--head feat/task-charlie");

    // --no-gh: ancestry-only. The second run must not spawn gh at all, and
    // charlie falls back to the plain ancestry skip.
    const offline = runCli(["cleanup", "--json", "--no-gh"], dir, { env });
    expect(offline.status, offline.stderr).toBe(0);
    const noGh = JSON.parse(offline.stdout) as {
      candidates: Array<{ id: string; removable: boolean; reason: string | null }>;
    };
    expect(noGh.candidates.find((c) => c.id === "task-charlie")).toMatchObject({
      removable: false,
      reason: "branch 'feat/task-charlie' is not fully merged into 'main'",
    });
    // Still one call in total: the --no-gh run never reached gh.
    expect(calls()).toHaveLength(1);
  });
});

describe("start --worktree flips workspace packages to the worktree copy (task-start-worktree-lib-resolution)", () => {
  /** A built copy of the workspace package: its declared entry file. */
  function writeEntry(dir: string): void {
    mkdirSync(join(dir, "lib", "dist"), { recursive: true });
    writeFileSync(join(dir, "lib", "dist", "index.js"), "module.exports = 1;\n");
  }

  /**
   * The repo's own shape with a real build: `lib/` committed with a `build`
   * script that produces the declared entry, plus the npm workspace link in the
   * primary install. `built` also writes the primary's build output (gitignored,
   * so a fresh worktree does not carry it), which is what a gate that falls back
   * to the primary's copy resolves.
   */
  function addBuildableWorkspacePackage(
    dir: string,
    opts: { build?: string | null; built?: boolean } = {},
  ): void {
    addWorkspaceLink(dir, "@arggondev", "lib", "lib");
    mkdirSync(join(dir, "lib"), { recursive: true });
    const manifest: Record<string, unknown> = {
      name: "@arggondev/lib",
      version: "1.0.0",
      main: "dist/index.js",
    };
    if (opts.build !== null) {
      manifest.scripts = {
        build: opts.build ?? "mkdir -p dist && echo module.exports = 1 > dist/index.js",
      };
    }
    writeFileSync(join(dir, "lib", "package.json"), JSON.stringify(manifest));
    writeFileSync(join(dir, ".gitignore"), "node_modules/\ndist/\n");
    if (opts.built) writeEntry(dir);
    git(["add", "lib", ".gitignore"], dir);
    git(["commit", "--quiet", "-m", "workspace package"], dir);
  }

  /**
   * The documented gate stand-in: it records where the CLI resolves
   * `@arggondev/lib` from the worktree, and fails the commit when it cannot
   * resolve at all.
   */
  function setResolutionGate(dir: string): void {
    setPreCommitHook(
      dir,
      "#!/bin/sh\n" +
        "node -e \"require('fs').writeFileSync('.gate-resolution', require.resolve('@arggondev/lib'))\" || exit 1\n",
    );
  }

  it("resolves the workspace package to the worktree copy and runs the gate against it", () => {
    const dir = initRepo();
    addBuildableWorkspacePackage(dir);
    setResolutionGate(dir);
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.linkedNodeModules).toBe(true);
    expect(result.builtWorkspaces).toEqual(["@arggondev/lib"]);
    expect(result.linkedWorkspaces).toEqual([]);
    expect(result.committed).toBe(true);
    // The gate ran BEFORE the claim commit and loaded the worktree's own build:
    // this is the flip, not a documented limitation.
    expect(readFileSync(join(expectedPath, ".gate-resolution"), "utf8")).toBe(
      join(expectedPath, "lib", "dist", "index.js"),
    );
    // The install is a link farm (a real directory, ignored by the repo's
    // node_modules/ pattern) whose workspace entry points at the worktree copy.
    expect(lstatSync(join(expectedPath, "node_modules")).isSymbolicLink()).toBe(false);
    expect(readlinkSync(join(expectedPath, "node_modules", "@arggondev", "lib"))).toBe(
      join(expectedPath, "lib"),
    );
    expect(git(["status", "--porcelain"], expectedPath)).not.toContain("node_modules");
    // The claim commit still stages only the item file.
    expect(git(["show", "--name-only", "--format=", "HEAD"], expectedPath).trim()).toBe(
      "ArggonManager/launch/auth/login/task-alpha.md",
    );
  });

  it("keeps the primary's copy and reports it when the worktree copy cannot be built", () => {
    const dir = initRepo();
    addBuildableWorkspacePackage(dir, { build: null, built: true });
    setResolutionGate(dir);
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.builtWorkspaces).toEqual([]);
    // The unbuilt copy has no build script to run: it stays on the primary's
    // copy, and the report keeps the requirement visible.
    expect(result.linkedWorkspaces).toEqual(["@arggondev/lib"]);
    expect(result.committed).toBe(true);
    expect(readFileSync(join(expectedPath, ".gate-resolution"), "utf8")).toBe(
      join(dir, "lib", "dist", "index.js"),
    );
  });

  it("falls back to the primary's copy when the local build fails, and the claim still lands", () => {
    const dir = initRepo();
    addBuildableWorkspacePackage(dir, { build: "exit 1", built: true });
    setResolutionGate(dir);
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.builtWorkspaces).toEqual([]);
    expect(result.linkedWorkspaces).toEqual(["@arggondev/lib"]);
    expect(result.committed).toBe(true);
    expect(readFileSync(join(expectedPath, ".gate-resolution"), "utf8")).toBe(
      join(dir, "lib", "dist", "index.js"),
    );
  });

  it("never flips a failed build that still emitted the declared entry (PR #388 finding 1)", () => {
    const dir = initRepo();
    // `tsc` without `noEmitOnError` writes the entry and still exits non-zero:
    // the exit is honored, so the partial entry is never flipped and the gate
    // falls back to the primary's copy, visibly reported.
    addBuildableWorkspacePackage(dir, {
      build: "mkdir -p dist && echo module.exports = 1 > dist/index.js && exit 1",
      built: true,
    });
    setResolutionGate(dir);
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.builtWorkspaces).toEqual([]);
    expect(result.linkedWorkspaces).toEqual(["@arggondev/lib"]);
    expect(result.committed).toBe(true);
    expect(readFileSync(join(expectedPath, ".gate-resolution"), "utf8")).toBe(
      join(dir, "lib", "dist", "index.js"),
    );
  });

  it("skips the local build on attach when the install resolves the primary copy (PR #388 finding 3)", () => {
    const dir = initRepo();
    addBuildableWorkspacePackage(dir, { built: true });
    setResolutionGate(dir);
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);
    // A previous install start did not create: the documented manual shape, a
    // bare symlink to the primary install. The worktree's workspace copy has no
    // build output, but there is no farm to flip, so a build would only cost.
    git(["worktree", "add", "--quiet", "-b", "feat/task-alpha", expectedPath], dir);
    symlinkSync(join(dir, "node_modules"), join(expectedPath, "node_modules"), "dir");
    runUpdate({
      cwd: dir,
      id: "task-alpha",
      status: "in_progress",
      assignee: "arggon",
      branch: "feat/task-alpha",
      worktreePath: expectedPath,
      now: NOW,
    });
    git(["add", "ArggonManager"], dir);
    git(["commit", "--quiet", "-m", "pre-created worktree"], dir);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.worktreeCreated).toBe(false);
    expect(result.linkedNodeModules).toBe(false);
    expect(result.builtWorkspaces).toEqual([]);
    // The build was skipped, not run and discarded: no local build output
    // appeared and the install keeps resolving the primary's copy.
    expect(existsSync(join(expectedPath, "lib", "dist", "index.js"))).toBe(false);
    expect(result.linkedWorkspaces).toEqual(["@arggondev/lib"]);
    expect(result.committed).toBe(true);
    expect(readFileSync(join(expectedPath, ".gate-resolution"), "utf8")).toBe(
      join(dir, "lib", "dist", "index.js"),
    );
  });

  it("cleanup --prune removes a farm worktree without following its entries", () => {
    const dir = initRepo();
    addBuildableWorkspacePackage(dir);
    addFakeDependency(dir, "fake-gate-dep");
    const started = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    const wt = started.worktreePath!;
    expect(started.builtWorkspaces).toEqual(["@arggondev/lib"]);

    // Close the item on its branch and merge it, so cleanup can prune.
    runUpdate({ cwd: wt, id: "task-alpha", status: "done", now: NOW });
    git(["add", "ArggonManager"], wt);
    git(["commit", "--quiet", "-m", "close task-alpha"], wt);
    git(["merge", "--quiet", "feat/task-alpha"], dir);

    const cleanup = runCleanup({ cwd: dir, prune: true, noGh: true });

    expect(cleanup.failures).toEqual([]);
    expect(existsSync(wt)).toBe(false);
    // Removing the farm never followed its entries into the primary install.
    expect(existsSync(join(dir, "node_modules", "fake-gate-dep", "index.js"))).toBe(true);
    expect(existsSync(join(dir, "lib", "package.json"))).toBe(true);
  });
});

describe("arggon cleanup reaps declared Compose projects (ADR 0019 layer 2, task-cleanup-declared-services)", () => {
  /** The cleanup fixture plus a committed `x-worktree.services` declaration. */
  function initComposeRepo(services: string): { dir: string; paths: Record<string, string> } {
    const { dir, paths } = initCleanupRepo();
    setServices(dir, services);
    return { dir, paths };
  }

  it("never invokes Docker when the repo declares nothing (report-only path)", () => {
    const { dir } = initCleanupRepo();
    const compose = fakeCompose();

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { compose: compose.down });

    // Not a single docker invocation, and no compose report at all.
    expect(compose.calls).toEqual([]);
    expect(result.compose).toBeUndefined();
    expect(result.failures).toEqual([]);
    expect(result.pruned.length).toBeGreaterThan(0);
  });

  it("reaps `<repo>-<item-id>` for services: true, before removing the worktree", () => {
    const { dir, paths } = initComposeRepo("true");
    const compose = fakeCompose();
    let worktreeExistedAtReap: boolean | null = null;
    const down = (project: string, cwd: string): void => {
      compose.down(project, cwd);
      worktreeExistedAtReap = existsSync(paths["task-alpha"]);
    };

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { compose: down });

    const project = basename(paths["task-alpha"]).toLowerCase();
    expect(compose.calls).toEqual([{ project, cwd: dir }]);
    // The stack dies with the worktree: reap FIRST, removal after.
    expect(worktreeExistedAtReap).toBe(true);
    expect(result.compose).toEqual({ declared: "true" });
    expect(result.failures).toEqual([]);
    expect(result.pruned.map((a) => a.action)).toEqual([
      `reaped compose project ${project}`,
      `removed worktree ${paths["task-alpha"]}`,
      "deleted branch feat/task-alpha",
      "cleared worktree_path",
    ]);
  });

  it("derives `<base>-<repo>-<item-id>` from a declared base name, lowercased", () => {
    const { dir, paths } = initComposeRepo("MyApp");
    const compose = fakeCompose();

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { compose: compose.down });

    // The adopter pattern's `name: "MyApp${WORKTREE_SUFFIX:-}"` with
    // WORKTREE_SUFFIX="-<repo>-<item-id>"; Compose lowercases project names,
    // so the whole derivation is lowercased (the fixture id has uppercase hex).
    const project = `myapp-${basename(paths["task-alpha"])}`.toLowerCase();
    expect(compose.calls).toEqual([{ project, cwd: dir }]);
    expect(result.compose).toEqual({ declared: "MyApp" });
    expect(result.failures).toEqual([]);
  });

  it("never reaps an adopter-run project the convention does not declare", () => {
    const { dir, paths } = initComposeRepo("myapp");
    const compose = fakeCompose();

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { compose: compose.down });

    // Exactly one call, exactly the declared derivation: the primary
    // checkout's own `myapp` project (no worktree suffix), any other base's
    // per-worktree project, and the skipped worktrees (bravo/charlie) are
    // never passed to Docker.
    expect(compose.calls).toEqual([
      { project: `myapp-${basename(paths["task-alpha"])}`.toLowerCase(), cwd: dir },
    ]);
    expect(result.failures).toEqual([]);
  });

  it("absent docker CLI (ENOENT) degrades to report-only and still prunes", () => {
    const { dir, paths } = initComposeRepo("true");
    const compose = fakeCompose("enoent");

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { compose: compose.down });

    // The absence is reported once, never as a failure, and the prune
    // completes (the worktree removal does not wait for Docker).
    expect(compose.calls).toEqual([
      { project: basename(paths["task-alpha"]).toLowerCase(), cwd: dir },
    ]);
    expect(result.compose).toEqual({ declared: "true", dockerUnavailable: true });
    expect(result.failures).toEqual([]);
    expect(result.pruned.map((a) => a.action)).toEqual([
      `removed worktree ${paths["task-alpha"]}`,
      "deleted branch feat/task-alpha",
      "cleared worktree_path",
    ]);
    expect(existsSync(paths["task-alpha"])).toBe(false);
  });

  it("reports a reap failure on BOTH surfaces and never wedges the removal", () => {
    const { dir, paths } = initComposeRepo("true");
    const compose = fakeCompose("Cannot connect to the Docker daemon");

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { compose: compose.down });

    expect(result.failures).toEqual(["task-alpha: Cannot connect to the Docker daemon"]);
    const failed = result.pruned.find((a) => a.action === "failed");
    expect(failed).toMatchObject({
      id: "task-alpha",
      error: "Cannot connect to the Docker daemon",
    });
    // Non-fatal: the worktree, its branch and its record are still reaped.
    expect(result.pruned.map((a) => a.action)).toContain(`removed worktree ${paths["task-alpha"]}`);
    expect(result.pruned.map((a) => a.action)).toContain("deleted branch feat/task-alpha");
    expect(existsSync(paths["task-alpha"])).toBe(false);
  });

  it("reaps the residue of an already-removed worktree; an already-gone project is a no-op", () => {
    const { dir, paths } = initComposeRepo("true");
    // The worktree directory is gone but the record (and possibly the Compose
    // project) remain — exactly the F8 residue class. The teardown command on
    // an already-gone project exits 0 with only a "No resource found to
    // remove" warning (verified live: Docker 29.7.2 / Compose 5.5.1,
    // 2026-10-01), so the executor succeeding here IS that no-op.
    git(["worktree", "remove", "--force", paths["task-alpha"]], dir);
    const compose = fakeCompose();

    const result = runCleanup({ cwd: dir, prune: true, noGh: true }, { compose: compose.down });

    expect(compose.calls).toEqual([
      { project: basename(paths["task-alpha"]).toLowerCase(), cwd: dir },
    ]);
    expect(result.failures).toEqual([]);
    expect(result.pruned.map((a) => a.action)).toEqual([
      `reaped compose project ${basename(paths["task-alpha"]).toLowerCase()}`,
      "deleted branch feat/task-alpha",
      "cleared worktree_path",
    ]);
  });

  it("emits the additive compose report through the CLI --json envelope", () => {
    const { dir } = initCleanupRepo();
    const r = runCli(["cleanup", "--json", "--no-gh"], dir);
    expect(r.status).toBe(0);
    const envelope = JSON.parse(r.stdout) as { compose?: unknown };
    // No declaration: the field is absent entirely (additive within schemaVersion: 1).
    expect("compose" in envelope).toBe(false);
  });

  it("the human run reports the docker-absent degradation and still prunes (no daemon needed)", () => {
    const { dir, paths } = initComposeRepo("true");
    // A PATH with git but no docker: the spawned CLI hits the real ENOENT.
    const bin = mkdtempSync(join(tmpdir(), "arggon-nodocker-bin-"));
    const gitReal = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
    symlinkSync(gitReal, join(bin, "git"));

    const r = runCli(["cleanup", "--prune", "--no-gh"], dir, {
      env: { ...process.env, PATH: bin },
    });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("docker not found — nothing reaped");
    expect(r.stdout).toContain(`removed worktree ${paths["task-alpha"]}`);
  });
});

/**
 * The unclaim release contract (bug-unclaim-leaves-worktree-record-without-reaper).
 *
 * `update --status todo` clears the assignee but NOT the claim's worktree: the
 * footprint (worktree, branch, `.arggon.env`, `arggon-claim.json`) outlives the
 * claim, and `update` is frontmatter-only. So the contract is split — `update`
 * REPORTS the footprint and names the release path, and `cleanup --release <id>`
 * (the worktree domain, one shared rule with the native `cleanup({ release })`)
 * is what reaps it, refusing a worktree another live session holds.
 *
 * WHERE a claim's records live is load-bearing for the tests: `start --worktree`
 * writes them in the WORKTREE copy (the claim commit rides the feature branch),
 * so an unclaimed-claim release normally runs from inside that worktree. Two
 * shapes are therefore exercised: merged-to-main (the record in the primary, so
 * it is CLEARED) and still-unmerged (the record inside the worktree, so it is
 * DISPOSED with it).
 */
describe("claim release — unclaim leaves nothing (bug-unclaim-leaves-worktree-record-without-reaper)", () => {
  /** The stamp's path inside a worktree's git dir (never the work tree). */
  function stampPath(worktreePath: string): string {
    return join(git(["rev-parse", "--absolute-git-dir"], worktreePath), "arggon-claim.json");
  }

  /** A tracked write inside the claimed worktree, newer than the stamp. */
  function foreignWrite(worktreePath: string, id = "task-alpha"): void {
    const file = join(worktreePath, `ArggonManager/launch/auth/login/${id}.md`);
    writeFileSync(file, `${readFileSync(file, "utf8")}\n<!-- a live writer -->\n`, "utf8");
    const when = new Date(Date.now() + 60_000);
    utimesSync(file, when, when);
  }

  function itemData(dir: string, id: string, cwd = dir): Record<string, unknown> {
    const raw = readFileSync(join(cwd, "ArggonManager/launch/auth/login", `${id}.md`), "utf8");
    return parseFrontmatter(raw).data as Record<string, unknown>;
  }

  /** Claim with a worktree, then merge the claim branch so main carries the records. */
  function claimedAndMerged(dir: string, id = "task-alpha"): string {
    const started = runStart(
      { cwd: dir, id, assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    const wt = started.worktreePath!;
    git(["merge", "--quiet", `--ff-only`, `feat/${id}`], dir);
    return wt;
  }

  it("claim → unclaim → release leaves nothing behind (worktree, record, branch, env, stamp)", () => {
    const dir = initRepo();
    const wt = claimedAndMerged(dir);
    // Resolved while the worktree exists: the stamp lives in ITS git dir.
    const stamp = stampPath(wt);
    expect(existsSync(stamp)).toBe(true);
    expect(existsSync(join(wt, ".arggon.env"))).toBe(true);
    expect(itemData(dir, "task-alpha")).toMatchObject({
      status: "in_progress",
      assignee: "arggon",
      worktree_path: wt,
    });

    // The unclaim: assignee + branch go, the worktree record STAYS. The
    // footprint is reported on this very call, naming the release path.
    const unclaimed = runUpdate({ cwd: dir, id: "task-alpha", status: "todo", now: NOW });
    expect(unclaimed.claimFootprint).toMatchObject({
      worktreePath: resolve(wt),
      release: {
        cli: "arggon cleanup --release task-alpha",
        native: 'tools.arggon.cleanup({ release: "task-alpha" })',
      },
    });
    expect(itemData(dir, "task-alpha")).toMatchObject({ status: "todo", worktree_path: wt });
    expect(itemData(dir, "task-alpha").assignee).toBeUndefined();
    // Before the release: `cleanup` still SEES the worktree and skips it,
    // because the item is `todo`, not done/cancelled — nothing reaps it, which
    // is the bug this contract closes.
    const listed = runCleanup({ cwd: dir, noGh: true });
    expect(listed.entries[0]).toMatchObject({ id: "task-alpha", removable: false });
    expect(listed.entries[0]?.reason).toContain("todo");

    // The release: the inverse of start.
    const released = runCleanup({
      cwd: dir,
      release: "task-alpha",
      releaseIdentity: "arggon",
    });

    expect(released.failures).toEqual([]);
    expect(released.release?.entry).toMatchObject({
      id: "task-alpha",
      releasable: true,
      // The branch comes from the WORKTREE: the unclaim cleared the item field.
      branch: "feat/task-alpha",
    });
    expect(released.release?.actions.map((action) => action.action)).toEqual([
      "reaped arggon-claim.json stamp",
      `removed worktree ${wt}`,
      "deleted branch feat/task-alpha",
      "cleared worktree_path",
    ]);
    // Nothing is left: no worktree, no record, no branch, no stamp, no env file.
    expect(existsSync(wt)).toBe(false);
    expect(worktreeCount(dir)).toBe(1);
    expect(refExists(dir, "refs/heads/feat/task-alpha")).toBe(false);
    expect(existsSync(stamp)).toBe(false);
    expect(existsSync(join(wt, ".arggon.env"))).toBe(false);
    expect(itemData(dir, "task-alpha").worktree_path).toBeUndefined();
    // A distinct action family: never mixed into `pruned`, never a survey.
    expect(released.pruned).toEqual([]);
    expect(released.entries).toEqual([]);
    // The cleared record rides one tracker commit (`released`, not `pruned`).
    expect(released.commit?.message).toBe("chore(tasks): released task-alpha");
  });

  it("releases from inside the worktree when the record still lives there (claim never merged)", () => {
    const dir = initRepo();
    const started = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    const wt = started.worktreePath!;
    // The claim records live in the worktree copy (the claim commit rides the
    // feature branch), so that is where an unclaim reads them — and where the
    // release runs, from the claiming session.
    const unclaimed = runUpdate({ cwd: wt, id: "task-alpha", status: "todo", now: NOW });
    expect(unclaimed.claimFootprint).toMatchObject({ worktreePath: resolve(wt) });
    // `arggon update` auto-commits its own item write (tracker hygiene), so the
    // worktree is clean when the release removes it — git refuses a dirty one.
    commitAllIfDirty(wt, "unclaim task-alpha");
    // The primary checkout never saw the claim, so it has nothing to release.
    expect(runCleanup({ cwd: dir, release: "task-alpha" }).release?.entry.reason).toContain(
      "no worktree recorded",
    );

    const released = runCleanup({ cwd: wt, release: "task-alpha", releaseIdentity: "arggon" });

    expect(released.failures).toEqual([]);
    expect(released.release?.entry.branch).toBe("feat/task-alpha");
    expect(released.release?.actions.map((action) => action.action)).toEqual([
      "reaped arggon-claim.json stamp",
      `removed worktree ${wt}`,
      "deleted branch feat/task-alpha",
      "disposed worktree_path record with the worktree",
    ]);
    // The whole copy went with the worktree: worktree, stamp, env, branch.
    expect(existsSync(wt)).toBe(false);
    expect(refExists(dir, "refs/heads/feat/task-alpha")).toBe(false);
    expect(worktreeCount(dir)).toBe(1);
    // The envelope still reports the convention version it read before the
    // removal took its own working directory away.
    expect(released.conventionVersion).toBe(5);
    // Nothing was written outside the removed copy, so no tracker commit.
    expect(released.commit).toBeUndefined();
  });

  it("a plain unclaim of a never-worktree item is unchanged (no footprint, no release)", () => {
    const dir = initRepo();
    const claimed = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", now: NOW },
      { git: localGit() },
    );
    expect(claimed.worktreePath).toBeNull();

    const unclaimed = runUpdate({ cwd: dir, id: "task-alpha", status: "todo", now: NOW });

    // No worktree → no footprint receipt, nothing to name, same `changed` list
    // this item always produced on an unclaim.
    expect(unclaimed.claimFootprint).toBeUndefined();
    expect(unclaimed.changed).toEqual(["status", "assignee", "branch", "claimed_at"]);
    expect(itemData(dir, "task-alpha").status).toBe("todo");
    expect(itemData(dir, "task-alpha").branch).toBeUndefined();
    expect(itemData(dir, "task-alpha").worktree_path).toBeUndefined();
    // And releasing it is an explicit, reported refusal — never a silent no-op.
    const released = runCleanup({ cwd: dir, release: "task-alpha" });
    expect(released.release?.entry.releasable).toBe(false);
    expect(released.release?.entry.reason).toContain("no worktree recorded");
    expect(released.failures[0]).toContain("task-alpha: ");
  });

  it("refuses to release a worktree another session holds (a live writer is never robbed)", () => {
    const dir = initRepo();
    const wt = claimedAndMerged(dir);
    // The stamped session ("arggon") unclaims; a DIFFERENT identity tries to
    // release, and the worktree moved since the stamp (the F12 signature).
    runUpdate({ cwd: dir, id: "task-alpha", status: "todo", now: NOW });
    foreignWrite(wt);

    const refused = runCleanup({ cwd: dir, release: "task-alpha", releaseIdentity: "other" });

    expect(refused.release?.entry.releasable).toBe(false);
    expect(refused.release?.entry.reason).toContain("refusing to release the worktree");
    expect(refused.release?.entry.reason).toContain("arggon");
    expect(refused.release?.entry.foreignWrites).toMatchObject({ owner: "arggon", total: 1 });
    // A refusal leaves the whole footprint intact and is reported on BOTH
    // surfaces (the action list and the flat failures).
    expect(refused.release?.actions).toEqual([
      { id: "task-alpha", action: "failed", error: refused.release?.entry.reason },
    ]);
    expect(refused.failures).toHaveLength(1);
    expect(existsSync(wt)).toBe(true);
    expect(refExists(dir, "refs/heads/feat/task-alpha")).toBe(true);
    expect(itemData(dir, "task-alpha").worktree_path).toBe(wt);
    expect(existsSync(stampPath(wt))).toBe(true);

    // The audited hatch for a presumed-DEAD owner releases it anyway (the same
    // one `start --take-over-worktree` has), and reports the replaced stamp.
    const taken = runCleanup({
      cwd: dir,
      release: "task-alpha",
      releaseIdentity: "other",
      releaseTakeOverWorktree: true,
    });
    expect(taken.failures).toEqual([]);
    expect(taken.release?.entry.takeOver).toMatchObject({ replacedIdentity: "arggon" });
    expect(existsSync(wt)).toBe(false);
    expect(itemData(dir, "task-alpha").worktree_path).toBeUndefined();
  });

  it("refuses a release under a LIVE claim, and refuses --release together with --prune", () => {
    const dir = initRepo();
    const wt = claimedAndMerged(dir);

    // Still claimed: the premise (an ABANDONED claim) does not hold yet.
    const refused = runCleanup({ cwd: dir, release: "task-alpha", releaseIdentity: "arggon" });
    expect(refused.release?.entry.reason).toContain("still claimed by arggon");
    expect(existsSync(wt)).toBe(true);

    // Two reapers, one run: refused outright rather than racing for one worktree.
    expect(() => runCleanup({ cwd: dir, prune: true, release: "task-alpha", noGh: true })).toThrow(
      /either --release <id> or --prune/,
    );
  });

  it("the human CLI run names the release and its refusal (never a silent no-op)", () => {
    const dir = initRepo();
    const wt = claimedAndMerged(dir);
    runUpdate({ cwd: dir, id: "task-alpha", status: "todo", now: NOW });

    const json = runCli(["cleanup", "--release", "task-alpha", "--json"], dir);
    // --json keeps the exit code at 0 (the payload is the contract); the human
    // path below is what exits non-zero on a refusal.
    expect(json.status).toBe(0);
    const envelope = JSON.parse(json.stdout) as {
      release?: { releasable: boolean; branch: string | null };
      released?: Array<{ action: string }>;
      pruned?: unknown;
      commit?: { message: string };
    };
    expect(envelope.release).toMatchObject({ releasable: true, branch: "feat/task-alpha" });
    expect(envelope.released?.map((action) => action.action)).toContain(`removed worktree ${wt}`);
    expect(envelope.pruned).toEqual([]);
    expect(envelope.commit?.message).toBe("chore(tasks): released task-alpha");
    expect(existsSync(wt)).toBe(false);

    // A second claim: unclaimed, then refused in the HUMAN path (exit 1) with
    // the stamped owner named.
    const bravo = claimedAndMerged(dir, "task-bravo");
    runUpdate({ cwd: dir, id: "task-bravo", status: "todo", now: NOW });
    foreignWrite(bravo, "task-bravo");
    const human = runCli(["cleanup", "--release", "task-bravo"], dir);
    expect(human.status).not.toBe(0);
    expect(human.stdout + human.stderr).toContain("REFUSED to release task-bravo");
    expect(existsSync(bravo)).toBe(true);
  });

  it("the unclaim itself names the release path in the human CLI output", () => {
    const dir = initRepo();
    claimedAndMerged(dir);

    const unclaimed = runCli(["update", "task-alpha", "--status", "todo"], dir);

    expect(unclaimed.stdout).toContain("claim dropped");
    expect(unclaimed.stdout).toContain("arggon cleanup --release task-alpha");
  });
});
