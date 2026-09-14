import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { readConventionConfig, resolveBranchName } from "./convention.js";
import { runBranch, type GitRunner } from "./branch.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { resolveCurrentLogin } from "./list.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { withItemLock } from "./lock.js";
import { runUpdate } from "./update.js";

export type StartOptions = {
  cwd: string;
  id: string;
  assignee?: string;
  openPr?: boolean;
  /**
   * Worktree isolation (story-start-worktree): create (or attach to) a git
   * worktree at `../<repo-name>-<id>`, record it in the item's additive
   * `worktree_path` field, and run the claim commit / push / PR steps from
   * inside the worktree. The main checkout never leaves its current branch.
   */
  worktree?: boolean;
  /**
   * Skip the `x-worktree.post-start` hook for this invocation
   * (task-start-post-hook). The hook only ever runs on new-worktree creation.
   */
  noHook?: boolean;
  now?: Date;
};

export type StartResult = {
  id: string;
  path: string;
  /** Repo root (parent of tasks/; also the git cwd). With --worktree this is the worktree root. */
  root: string;
  branch: string;
  /** True when `git checkout -b` ran; false when attaching to the recorded branch. */
  created: boolean;
  /** True when the claim commit was created this run. */
  committed: boolean;
  /** True when the branch was pushed this run. */
  pushed: boolean;
  /** Draft PR URL (null unless --open-pr published one). */
  prUrl: string | null;
  /** Absolute worktree path with --worktree; null without it. */
  worktreePath: string | null;
  /** True when the worktree was created this run; false on attach or without --worktree. */
  worktreeCreated: boolean;
  /**
   * `x-worktree.post-start` outcome (task-start-post-hook): set only when a
   * new worktree was created, a hook is configured, and `--no-hook` was not
   * passed. Absent otherwise (no config = no-op).
   */
  postStart?: PostStartResult;
  /** The item, reloaded from disk. */
  item: WorkItem;
};

/** Outcome of the `x-worktree.post-start` bootstrap hook (task-start-post-hook). */
export type PostStartResult = {
  /** The configured shell command. */
  command: string;
  /** False when the command exited non-zero or could not be spawned. */
  ok: boolean;
  /**
   * Human-readable failure report (`post-start failed: <cmd> → <stderr tail>`);
   * absent on success. Failure is never fatal to the start itself.
   */
  error?: string;
};

/** Git + gh operations, injectable for tests. Extends the branch runner. */
export interface StartGit extends GitRunner {
  /** Non-empty `git status --porcelain` output for one file ("" when clean). */
  fileStatus(cwd: string, file: string): string;
  commitFile(cwd: string, file: string, message: string): void;
  pushBranch(cwd: string, branch: string): void;
  /** Create a draft PR; returns its URL. */
  createDraftPr(cwd: string, input: { title: string; body: string }): string;
  /** Current login for the default assignee (injectable; defaults to @me resolution). */
  resolveMe?(): string | undefined;
  /** Absolute paths of every worktree registered with this repo. */
  worktreeList(cwd: string): string[];
  /**
   * Add a linked worktree at `path`. With `createBranch` the branch is created
   * from HEAD in the same step (`git worktree add -b <branch> <path>`); the
   * existing branch is checked out otherwise.
   */
  worktreeAdd(cwd: string, path: string, opts: { branch: string; createBranch: boolean }): void;
}

export type StartDeps = {
  git?: StartGit;
};

function git(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const stderr =
      err !== null && typeof err === "object" && "stderr" in err ? String(err.stderr).trim() : "";
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`git ${args.join(" ")} failed${stderr ? `: ${stderr}` : ` (${message})`}`);
  }
}

function gh(args: string[], cwd: string): string {  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const stderr =
      err !== null && typeof err === "object" && "stderr" in err ? String(err.stderr).trim() : "";
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err.code === "ENOENT" || err.code === -2)
    ) {
      throw new Error(`gh not found (install gh and run \`gh auth login\` for draft PRs)`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `gh ${args.join(" ")} failed${stderr ? `: ${stderr}` : ` (${message})`} (check \`gh auth status\`)`,
    );
  }
}

export function defaultStartGit(): StartGit {
  return {
    isRepo(cwd: string): boolean {
      try {
        execFileSync("git", ["rev-parse", "--git-dir"], {
          encoding: "utf8",
          cwd,
          stdio: ["ignore", "pipe", "ignore"],
        });
        return true;
      } catch {
        return false;
      }
    },
    branchExists(cwd: string, name: string): boolean {
      try {
        execFileSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${name}`], {
          encoding: "utf8",
          cwd,
          stdio: ["ignore", "ignore", "ignore"],
        });
        return true;
      } catch {
        return false;
      }
    },
    checkoutNew(cwd: string, name: string): void {
      git(["checkout", "-b", name], cwd);
    },
    checkoutExisting(cwd: string, name: string): void {
      git(["checkout", name], cwd);
    },
    fileStatus(cwd: string, file: string): string {
      return git(["status", "--porcelain", "--", file], cwd);
    },
    commitFile(cwd: string, file: string, message: string): void {
      git(["add", "--", file], cwd);
      try {
        git(["commit", "-m", message], cwd);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
          `${detail} (if this is an identity error, set \`git config user.name\` / \`git config user.email\`)`,
        );
      }
    },
    pushBranch(cwd: string, branch: string): void {
      git(["push", "-u", "origin", branch], cwd);
    },
    createDraftPr(cwd: string, input: { title: string; body: string }): string {
      const out = gh(
        ["pr", "create", "--draft", "--title", input.title, "--body", input.body],
        cwd,
      );
      const url = out.split("\n").pop()?.trim() ?? "";
      if (!url) throw new Error(`gh pr create returned no URL (check \`gh auth status\`)`);
      return url;
    },
    worktreeList(cwd: string): string[] {
      const out = git(["worktree", "list", "--porcelain"], cwd);
      return out
        .split("\n")
        .filter((line) => line.startsWith("worktree "))
        .map((line) => line.slice("worktree ".length).trim())
        .filter((path) => path.length > 0);
    },
    worktreeAdd(cwd: string, path: string, opts: { branch: string; createBranch: boolean }): void {
      git(
        [
          "worktree",
          "add",
          ...(opts.createBranch ? ["-b", opts.branch] : []),
          path,
          ...(opts.createBranch ? [] : [opts.branch]),
        ],
        cwd,
      );
    },
  };
}

/**
 * Draft PR body for a started item (task-closes-issue-linking): when the item
 * carries an imported GitHub issue number (`issue` frontmatter), the body
 * ends with `Closes #N` so GitHub closes the issue when the PR merges.
 * Items without a linked issue are unchanged.
 */
export function draftPrBody(
  id: string,
  relPath: string,
  item: Pick<WorkItem, "issue">,
  worktree: boolean,
): string {
  const base =
    `Work item: ${id}\n\nPath: ${relPath}\n\n` +
    `Draft opened by \`arggon start${worktree ? " --worktree" : ""}\`.`;
  return item.issue != null ? `${base}\n\nCloses #${item.issue}` : base;
}

/** Last non-empty lines of a stream, for the failure report tail. */
function outputTail(output: string): string {
  const lines = output
    .trimEnd()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  return lines.slice(-3).join("\n");
}

/**
 * Run the `x-worktree.post-start` bootstrap hook (task-start-post-hook):
 * `sh -c <command>` with cwd = the freshly created worktree root. Never
 * throws — a failure (non-zero exit, spawn error) is reported in the result
 * so the start itself still succeeds (the worktree exists and is claimed;
 * the hook is convenience, e.g. `npm ci`).
 */
export function runPostStart(command: string, cwd: string): PostStartResult {
  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync("sh", ["-c", command], { cwd, encoding: "utf8" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { command, ok: false, error: `post-start failed: ${command} → ${message}` };
  }
  if (result.error) {
    return {
      command,
      ok: false,
      error: `post-start failed: ${command} → ${result.error.message}`,
    };
  }
  if (result.status !== 0) {
    const tail = outputTail(String(result.stderr ?? "") || String(result.stdout ?? ""));
    const detail = tail || `exit code ${result.status ?? "unknown"}`;
    return { command, ok: false, error: `post-start failed: ${command} → ${detail}` };
  }
  return { command, ok: true };
}

/**
 * Start work on an item in one flow: claim (in_progress + assignee) →
 * working branch (pattern or recorded field) → commit the claim →
 * push → optional draft PR with the item id in the body.
 * Never --force: a taken claim fails clearly. Library returns data;
 * the CLI prints. Throws on dirty tree, unknown id, or git/gh errors.
 * With `worktree: true` the whole flow runs inside a linked git worktree
 * (`../<repo-name>-<id>`, recorded on the item as `worktree_path`).
 */
export function runStart(opts: StartOptions, deps: StartDeps = {}): StartResult {
  const id = opts.id.trim();
  if (!id) throw new Error("id is required");

  const gitRunner = deps.git ?? defaultStartGit();
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  if (!gitRunner.isRepo(root)) {
    throw new Error(`not a git repository (${root}); arggon start needs git`);
  }

  const dirty = gitRunner.fileStatus(root, ".").trim();
  if (dirty) {
    const preview = dirty.split("\n").slice(0, 10).join("\n");
    throw new Error(`working tree is dirty (commit or stash first):\n${preview}`);
  }

  const item = itemsById(loadItems(tasksDir)).get(id);
  if (!item) {
    throw new Error(`id '${id}' not found under tasks/`);
  }

  const providedResolveMe = deps.git?.resolveMe;
  const assignee =
    opts.assignee ?? (providedResolveMe ? providedResolveMe() : resolveCurrentLogin()) ?? null;
  if (!assignee) {
    throw new Error(
      "could not resolve assignee (pass --assignee or set GITHUB_USER / GITHUB_ACTOR)",
    );
  }

  if (opts.worktree) {
    // Hold the ROOT item's lock across the whole worktree flow (claim checks,
    // worktree add, item writes in the worktree copy): concurrent starts on
    // the same item serialize here, so exactly one creates the worktree and
    // the rest either attach (same assignee) or fail with the claim conflict
    // (different assignee) — never interleaved double-ok (bug-claim-race-no-lock).
    return withItemLock(item.filePath, () => {
      // Re-read under the lock: the claim state may have changed while we waited.
      const fresh = itemsById(loadItems(tasksDir)).get(id);
      if (!fresh) throw new Error(`id '${id}' not found under tasks/`);
      return startInWorktree({ id, item: fresh, assignee, root, gitRunner, opts });
    });
  }

  // Same lock for the plain flow: claim update → branch → commit → push must
  // not interleave with another process's claim on the same item.
  return withItemLock(item.filePath, () => {
    runUpdate({
      cwd: opts.cwd,
      id,
      status: "in_progress",
      assignee,
      now: opts.now,
    });
    const branch = runBranch({ cwd: opts.cwd, id, now: opts.now }, { git: gitRunner });

  let committed = false;
  if (gitRunner.fileStatus(root, branch.path).trim()) {
    gitRunner.commitFile(root, branch.path, `claim: ${id}`);
    committed = true;
  }

  let pushed = false;
  if (committed || branch.created) {
    gitRunner.pushBranch(root, branch.branch);
    pushed = true;
  }

  let prUrl: string | null = null;
  if (opts.openPr && pushed) {
    const rel = relative(root, branch.path).split(sep).join("/");
    prUrl = gitRunner.createDraftPr(root, {
      title: branch.item.title ?? id,
      body: draftPrBody(id, rel, branch.item, false),
    });
  }

    return {
      id,
      path: branch.path,
      root,
      branch: branch.branch,
      created: branch.created,
      committed,
      pushed,
      prUrl,
      worktreePath: null,
      worktreeCreated: false,
      item: branch.item,
    };
  });
}

type WorktreeStartInput = {
  id: string;
  item: WorkItem;
  assignee: string;
  root: string;
  gitRunner: StartGit;
  opts: StartOptions;
};

/**
 * Worktree-isolated start (story-start-worktree): resolve the branch name and
 * worktree path, create or attach the worktree, then run claim, branch record,
 * `worktree_path` record, claim commit, push, and the optional draft PR from
 * INSIDE the worktree. The main checkout stays on its current branch and clean.
 * A freshly created worktree is rolled back (best effort) if a later step fails,
 * so a taken claim leaves the repo as it was.
 */
function startInWorktree(input: WorktreeStartInput): StartResult {
  const { id, item, assignee, root, gitRunner, opts } = input;

  const config = readConventionConfig(root);
  const pattern = config.branchPatterns[item.type];
  const name = item.branch ?? resolveBranchName(pattern, item);
  // The branch/worktree_path records live on the feature branch (the main
  // checkout's copy only gains them when the PR merges), so a stale root copy
  // with no recorded branch must tolerate an already-created branch; ownership
  // is verified against the worktree copy below instead.
  if (gitRunner.branchExists(root, name) && item.branch != null && item.branch !== name) {
    throw new Error(
      `branch '${name}' already exists and does not match item '${id}' ('${item.branch}'; ` +
        `set it with \`arggon update ${id} --branch <name>\` or pick another branch)`,
    );
  }

  const defaultPath = resolve(root, "..", `${basename(root)}-${id}`);
  const worktreePath = item.worktreePath ? resolve(item.worktreePath) : defaultPath;
  const pathTaken = existsSync(worktreePath);
  if (pathTaken && !gitRunner.worktreeList(root).map((p) => resolve(p)).includes(worktreePath)) {
    throw new Error(
      `${worktreePath} already exists and is not a git worktree of this repo ` +
        `(\`arggon start --worktree\` only attaches to registered worktrees; move or remove the path first)`,
    );
  }

  const createBranch = !gitRunner.branchExists(root, name);
  let worktreeCreated = false;
  if (!pathTaken) {
    gitRunner.worktreeAdd(root, worktreePath, { branch: name, createBranch });
    worktreeCreated = true;
  }

  try {
    // All item writes and git steps run from the worktree from here on.
    const wtTasksDir = findTasksDir(worktreePath);
    const existing = itemsById(loadItems(wtTasksDir)).get(id);
    if (!existing) throw new Error(`id '${id}' not found under tasks/`);
    if (existing.branch !== undefined && existing.branch !== null && existing.branch !== name) {
      throw new Error(
        `branch '${name}' already exists and does not match item '${id}' ('${existing.branch}'; ` +
          `set it with \`arggon update ${id} --branch <name>\` or pick another branch)`,
      );
    }

    const update = (patch: {
      status?: string;
      assignee?: string;
      branch?: string;
      worktreePath?: string;
    }): void => {
      runUpdate({ cwd: worktreePath, id, now: opts.now, ...patch });
    };
    update({ status: "in_progress", assignee });
    if (existing.branch !== name) update({ branch: name });
    update({ worktreePath });

    const itemInWorktree = itemsById(loadItems(wtTasksDir)).get(id);
    if (!itemInWorktree) throw new Error(`id '${id}' not found under tasks/`);

    let committed = false;
    if (gitRunner.fileStatus(worktreePath, itemInWorktree.filePath).trim()) {
      gitRunner.commitFile(worktreePath, itemInWorktree.filePath, `claim: ${id}`);
      committed = true;
    }

    let pushed = false;
    if (committed || worktreeCreated) {
      gitRunner.pushBranch(worktreePath, name);
      pushed = true;
    }

    let prUrl: string | null = null;
    if (opts.openPr && pushed) {
      const rel = relative(worktreePath, itemInWorktree.filePath).split(sep).join("/");
      prUrl = gitRunner.createDraftPr(worktreePath, {
        title: itemInWorktree.title ?? id,
        body: draftPrBody(id, rel, itemInWorktree, true),
      });
    }

    const finalItem = itemsById(loadItems(wtTasksDir)).get(id);
    if (!finalItem) throw new Error(`id '${id}' not found under tasks/`);

    // Post-start bootstrap hook (task-start-post-hook): only on new-worktree
    // creation, never on attach re-runs. Failure is reported, not fatal — the
    // worktree exists and the claim stands — so it must not trigger rollback.
    let postStart: PostStartResult | undefined;
    if (worktreeCreated && !opts.noHook) {
      const hookCommand = config.worktree.postStart;
      if (hookCommand) postStart = runPostStart(hookCommand, worktreePath);
    }

    return {
      id,
      path: itemInWorktree.filePath,
      root: worktreePath,
      branch: name,
      created: createBranch,
      committed,
      pushed,
      prUrl,
      worktreePath,
      worktreeCreated,
      postStart,
      item: finalItem,
    };
  } catch (err) {
    if (worktreeCreated) {
      // Best-effort rollback: the worktree (and branch, when we created it)
      // did not exist before this call, so a failed start leaves no debris.
      try {
        git(["worktree", "remove", "--force", worktreePath], root);
        if (createBranch) git(["branch", "-D", name], root);
      } catch {
        // Rollback is advisory; surface the original error either way.
      }
    }
    throw err;
  }
}
