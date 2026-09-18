/**
 * Integration tests for worktree-integrated claims (story-start-worktree):
 * `start --worktree` and `arggon cleanup`. Spawns real git inside temp repos
 * (sync-smoke pattern); only push/PR are stubbed so no remote is needed.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync as _mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { defaultCleanupGit, runCleanup } from "./cleanup.js";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { defaultStartGit, runStart } from "./start.js";
import { runUpdate } from "./update.js";
import { runValidate } from "./validate.js";

// bug-tmp-fixture-leak + bug-tracker-commit-enotempty-flake: track mkdtemp
// dirs (plus any `arggon start --worktree` sibling worktrees named
// `<basename>-task-*`) and remove them after each test.
//
// Every git command in this file returns synchronously, but `git commit` also
// forks a detached `git maintenance run --auto --detach` child, and on a
// loaded CI runner the kernel can still surface entries while rmdir runs.
// Recursive rmSync (readdir -> unlink -> rmdir) fails ENOTEMPTY if an entry
// appears in that window; `force` only swallows ENOENT, and Node retries
// ENOTEMPTY only when maxRetries > 0. The retry window makes the teardown
// deterministic without weakening anything the tests assert.
const RM_RETRY = { recursive: true, force: true, maxRetries: 10, retryDelay: 50 } as const;
const tmpDirs: string[] = [];
function removeFixtureTree(dir: string): void {
  rmSync(dir, RM_RETRY);
  try {
    const base = basename(dir);
    for (const entry of readdirSync(dirname(dir))) {
      if (entry.startsWith(`${base}-task`)) rmSync(join(dirname(dir), entry), RM_RETRY);
    }
  } catch {
    // parent already gone
  }
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-09-11T12:00:00Z");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function git(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { encoding: "utf8", cwd });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
}

/** Git runner with real worktree support but no push/PR (no remote in temp repos). */
function localGit() {
  return { ...defaultStartGit(), pushBranch: () => {}, createDraftPr: () => "https://github.com/o/r/pull/1" };
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
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "login", now: NOW });
  for (const id of ["task-alpha", "task-bravo", "task-charlie"]) {
    runCreate({ cwd: dir, type: "task", title: id, parent: "login", id, now: NOW });
  }
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
  appendFileSync(join(dir, "tasks/.convention.yml"), `x-worktree:\n  post-start: "${command}"\n`);
  git(["add", "tasks/.convention.yml"], dir);
  git(["commit", "--quiet", "-m", "config: x-worktree.post-start"], dir);
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
    const wtFile = join(expectedPath, "tasks/launch/auth/login/task-alpha.md");
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
      readFileSync(join(dir, "tasks/launch/auth/login/task-alpha.md"), "utf8"),
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
    runCreate({ cwd: dir, type: "task", title: "Linked", parent: "login", id: "linked", issue: 9, now: NOW });
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
      "Work item: task-linked\n\nPath: tasks/launch/auth/login/task-linked.md\n\n" +
        "Draft opened by `arggon start --worktree`.\n\nCloses #9",
    ]);
  });

  it("attaches on re-run instead of failing or duplicating the worktree", () => {    const dir = initRepo();
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
      runStart({ cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW }, { git: localGit() }),
    ).toThrow(/not a git worktree/);
    expect(worktreeCount(dir)).toBe(1);
  });

  it("keeps the worktree and says how to discard it when the claim is taken", () => {
    const dir = initRepo();
    // Claim the item on main first; the worktree copy still says todo, so the
    // claim conflict only surfaces once updates run inside the worktree.
    runUpdate({ cwd: dir, id: "task-alpha", status: "in_progress", assignee: "alice", now: NOW });
    git(["add", "tasks"], dir);
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
      '#!/bin/sh\nnode -e "require(\'fake-gate-dep\')" || exit 1\ntouch .gate-ran\n',
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
      "tasks/launch/auth/login/task-alpha.md",
    );
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
      git(["status", "--porcelain", "--", "tasks/launch/auth/login/task-alpha.md"], expectedPath),
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
    git(["add", "tasks"], dir);
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
    setPreCommitHook(dir, '#!/bin/sh\nnode -e "require(\'fake-gate-dep\')" || exit 1\n');
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
    writeFileSync(
      path,
      `#!/bin/sh\nprintf '%s\\n' "$*" >> "${log}"\nexec /bin/sh "$@"\n`,
    );
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
      join(dir, "tasks/.convention.yml"),
      `x-worktree:\n  post-start: "${command}"${shellLine}\n`,
    );
    git(["add", "tasks/.convention.yml"], dir);
    git(["commit", "--quiet", "-m", "config: x-worktree.post-start-shell"], dir);
  }

  it("x-worktree.post-start-shell: login runs the hook via the login shell", () => {
    const dir = initRepo();
    const log = join(dir, "fakeshell.log");
    setPostStartWithShell(dir, "pwd > .post-start-cwd", "login");
    const fake = fakeLoginShell(dir, log);

    const result = withShell(fake, () =>
      runStart({ cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW }, { git: localGit() }),
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
      runStart({ cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW }, { git: localGit() }),
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
        { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, postStartShell: "login", now: NOW },
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
        { cwd: dir2, id: "task-alpha", assignee: "arggon", worktree: true, postStartShell: "inherit", now: NOW },
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

describe("arggon cleanup", () => {
  /** alpha: done + merged worktree; bravo: todo worktree; charlie: done + unmerged worktree. */
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
    git(["add", "tasks"], alpha.worktreePath!);
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
    git(["add", "tasks"], dir);
    git(["commit", "--quiet", "-m", "records"], dir);
    return { dir, paths };
  }

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
    const raw = readFileSync(join(dir, "tasks/launch/auth/login/task-alpha.md"), "utf8");
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
    git(["add", "tasks"], wt);
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

  it("emits the standard --json envelope via the CLI", () => {
    const { dir } = initCleanupRepo();
    const r = spawnSync(process.execPath, [tsx, cli, "cleanup", "--json", "--no-gh"], {
      encoding: "utf8",
      cwd: dir,
    });
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
    expect(envelope.candidates.filter((c) => c.removable).map((c) => c.id)).toEqual([
      "task-alpha",
    ]);
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
    git(["-c", "init.defaultBranch=main", "init", "--bare", "--quiet"], remote);
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
    git(["add", "tasks"], wt);
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
    const raw = readFileSync(join(dir, "tasks/launch/auth/login/task-alpha.md"), "utf8");
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

    // Per-candidate failure: the run stays green and continues.
    expect(result.failures).toEqual([]);
    expect(existsSync(paths["task-alpha"])).toBe(false);
    const raw = readFileSync(join(dir, "tasks/launch/auth/login/task-alpha.md"), "utf8");
    expect(parseFrontmatter(raw).data.worktree_path).toBeUndefined();
    const failed = result.pruned.find((a) => a.action === "failed")!;
    expect(failed).toMatchObject({ id: "task-alpha", leftoverBranch: "feat/task-alpha" });
    expect(failed.error).toContain("refusing to delete branch");
  });

  it("reports the remote-safety skip in the --json payload", () => {
    const { dir } = initRemoteCleanupRepo(true);

    const r = spawnSync(process.execPath, [tsx, cli, "cleanup", "--json", "--prune"], {
      encoding: "utf8",
      cwd: dir,
    });
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

  /** Fake gh executor returning a merged PR list (task-cleanup-squash-merge). */
  function fakeGh(result: unknown, calls: string[][] = []): (file: string, args: string[]) => string {
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

    const result = runCleanup({ cwd: dir, prune: true }, { gh: fakeGh([{ number: 12, url: "https://github.com/o/r/pull/12", mergedAt: "2026-09-13T00:00:00Z" }], calls) });

    const entry = result.entries.find((e) => e.id === "task-charlie")!;
    expect(entry.removable).toBe(true);
    expect(entry.via).toBe("squash-merged PR #12");
    expect(result.failures).toEqual([]);
    expect(result.pruned.filter((a) => a.id === "task-charlie")).toEqual([
      { id: "task-charlie", action: `removed worktree ${paths["task-charlie"]}`, via: "squash-merged PR #12" },
      { id: "task-charlie", action: "deleted branch feat/task-charlie", via: "squash-merged PR #12" },
      { id: "task-charlie", action: "cleared worktree_path" },
    ]);
    expect(existsSync(paths["task-charlie"])).toBe(false);
    expect(refExists(dir, "refs/heads/feat/task-charlie")).toBe(false);
    const raw = readFileSync(join(dir, "tasks/launch/auth/login/task-charlie.md"), "utf8");
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

    const result = runCleanup({ cwd: dir, noGh: true }, { gh: fakeGh([{ number: 12, url: "u", mergedAt: null }], calls) });

    const entry = result.entries.find((e) => e.id === "task-charlie")!;
    expect(entry.removable).toBe(false);
    expect(entry.reason).toBe("branch 'feat/task-charlie' is not fully merged into 'main'");
    expect(calls).toEqual([]);
    expect(result.pruned).toEqual([]);
  });
});
