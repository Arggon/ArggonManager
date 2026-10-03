import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import {
  LEGACY_TRACKER_DIR_NAME,
  TRACKER_DIR_NAME,
  findTasksDir,
  freshWorktreeInstallRefusal,
  inspectDeclaredDependencies,
  inspectGateBinResolution,
  itemsById,
  linkNodeModulesDetailed,
  linkedWorkspacePackages,
  loadItems,
  prepareWorktreeDependencies,
  readConventionConfig,
  repoRootFromTasks,
  resolveBranchName,
  resolveCurrentLogin,
  runUpdate,
  strictGateBinFailure,
  strictWorktreeWriteFailure,
  worktreeTakeoverWarning,
  unlinkNodeModulesLink,
  withItemLock,
  type GateBinResolution,
  type ManifestCoverage,
  type WorkItem,
  type WorktreeClaimReceipt,
  type WorktreeEnvReceipt,
  type WorktreePrepStep,
} from "@arggondev/lib";

/**
 * Worktree dependency-link helpers live in the kernel since W4
 * (task-native-permissions-worktrees) so the CLI and the native `cleanup` tool
 * share the ownership rule. Re-exported here for the CLI surface (and its
 * tests), which keeps importing them from `./start.js`.
 */
export {
  buildLocalWorkspaces,
  inspectDeclaredDependencies,
  linkNodeModules,
  linkedWorkspacePackages,
  unlinkNodeModulesLink,
  unlinkWorktreeClaimStamp,
  unlinkWorktreeEnv,
} from "@arggondev/lib";
import { runBranch, type GitRunner } from "./branch.js";

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
   * Deliberate take-over of a presumed-dead stamped owner
   * (task-strict-attach-dead-owner-hatch, `start --take-over-worktree`): on
   * an attach whose single-writer detection fired, record a dated take-over
   * naming the replaced stamp and re-stamp the worktree with this run's
   * identity. Default OFF and only meaningful with `worktree` (without a
   * worktree there is no stamp to take over — the flag is then rejected).
   */
  takeOverWorktree?: boolean;
  /**
   * Skip the `x-worktree.post-start` hook for this invocation
   * (task-start-post-hook). The hook only ever runs on new-worktree creation.
   */
  noHook?: boolean;
  /**
   * Shell for the `x-worktree.post-start` hook (task-post-start-env):
   * "inherit" (default) or "login" ($SHELL -lc). Per-invocation override —
   * wins over the `x-worktree.post-start-shell` config value.
   */
  postStartShell?: "inherit" | "login";
  now?: Date;
};

export type StartResult = {
  id: string;
  path: string;
  /** Repo root (parent of the tracker dir; also the git cwd). With --worktree this is the worktree root. */
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
   * True when `--worktree` prepared the worktree's install this run
   * (bug-start-worktree-node-modules): a fresh worktree has no dependencies, so
   * the documented pre-commit gate (`npm run arggon -- validate`) would fail
   * with ERR_MODULE_NOT_FOUND and the claim commit could never land. Best-effort:
   * false when the primary has no `node_modules`, the worktree already has an
   * install, the install could not be created, or the start ran without
   * `--worktree`.
   */
  linkedNodeModules: boolean;
  /**
   * Workspace packages the worktree's install still resolves into the **primary**
   * checkout (W6/PR-374 finding 2), e.g. `["@arggondev/lib"]` in this repo. Start
   * links the primary install as a per-worktree link farm, so a workspace
   * package the worktree owns is pointed at the worktree copy and built before
   * the claim-commit gate (`builtWorkspaces`); only packages that could not be
   * flipped land here (no local build output and no build script, a failed
   * build, or an install that could not be farmed). Reported so the requirement
   * is visible — build where the imports resolve, or give the worktree its own
   * install (`npm ci`, e.g. via `x-worktree.post-start: npm ci`).
   *
   * Describes the state the worktree is LEFT in: recomputed after a configured
   * `x-worktree.post-start` hook, so a hook that reifies a local install
   * reports `[]` (the pre-hook farm only ever existed for the claim-commit gate
   * window — PR #384 review F2). Empty when the worktree has no install,
   * resolves locally, or has no shadowed workspace package; set on attach runs
   * too (the install may predate this run).
   */
  linkedWorkspaces: string[];
  /**
   * Workspace packages start built in the worktree and pointed at the worktree
   * copy (task-start-worktree-lib-resolution), e.g. `["@arggondev/lib"]`. The
   * worktree's spawned CLI then loads the worktree's kernel instead of the
   * primary's build. Empty without a worktree, when every local copy is already
   * importable, or when no local copy could be built.
   */
  builtWorkspaces: string[];
  /**
   * Whether the worktree's install provides what the worktree's own
   * `package.json` declares (`dependencies` + `devDependencies`, presence only
   * — see `lib/src/worktree.ts` `ManifestCoverage`):
   * `"satisfied"` | `"stale"` | `"unknown"`. A linked install MIRRORS the
   * primary's entries, so a dependency declared after the primary's last
   * install is missing from the worktree too
   * (bug-worktree-readiness-misses-stale-primary-install); `"unknown"` means
   * nothing was compared (no install, an unreadable manifest, or no worktree —
   * it is never reported as satisfied). Informational only: start never fails
   * on it, and the remedy is the primary's re-install or a worktree-local one.
   */
  manifestCoverage: ManifestCoverage;
  /**
   * Declared dependency names the worktree's install does not provide (sorted,
   * capped at `MAX_MISSING_DEPENDENCIES`; `missingDependenciesTotal` is the
   * full count) — the actionable half of `manifestCoverage: "stale"`. Reported
   * for the state the worktree is LEFT in, re-read after a configured
   * `x-worktree.post-start` hook, so a hook that installs locally reports `[]`.
   */
  missingDependencies: string[];
  /** Full count behind `missingDependencies`; they differ only when the list is capped. */
  missingDependenciesTotal: number;
  /**
   * Which node_modules the project gate's binaries resolve from, relative to
   * the worktree (bug-start-worktree-npm-ci-claim): `"worktree"`, `"external"`
   * (a parent-directory install), `"path"` (a sibling checkout or global bin
   * on the invoking PATH — the silent-masking flavor), or `"missing"`. A gate
   * that passes via a foreign resolution used to leave the broken worktree
   * install invisible; this names the source. Empty without `--worktree` or
   * when the manifest declares no binary-exposing dependency.
   */
  gateBins: GateBinResolution[];
  /**
   * The bounded preparation log (bug-start-install-ordering), as reported by
   * the kernel receipt: which prep path ran (link farm created / reused /
   * skipped-and-why, per-workspace build decisions, the gate-bin verdict).
   * Empty without `--worktree`.
   */
  prepSteps: WorktreePrepStep[];
  /**
   * The worktree env contract receipt (spec worktree-env-contract-016):
   * `.arggon.env` written with the six identity keys, the `.env` seeded
   * copy-if-absent, the per-OS state/cache dirs created, and the read-only
   * gitignore probe. `written: false` with a `warning` covers the
   * `x-worktree.env: false` opt-out, a write failure, and the attach path
   * (an existing file left byte-identical) — the claim is never refused for
   * any of them. Without `--worktree` no env contract applies; the field
   * reports that.
   */
  env: WorktreeEnvReceipt;
  /**
   * The claim-stamp receipt (task-single-writer-worktree-enforcement): the
   * worktree's ownership stamp state plus any fired attach-time detection.
   * Present only with `--worktree` (the stamp is worktree-scoped); a fired
   * `foreignWrites` report is a WARNING by default — with
   * `x-tracker.strict-worktree-writes: true` it refuses the claim before any
   * item mutation instead. A deliberate `--take-over-worktree` moves that
   * evidence into `takeOver` (task-strict-attach-dead-owner-hatch), so exactly
   * one of `foreignWrites` / `takeOver` is ever present.
   */
  claim?: WorktreeClaimReceipt;
  /**
   * Outcome of re-linking the start-owned install after a
   * `x-worktree.post-start` hook that left the worktree without one
   * (bug-start-install-ordering): `"relinked"` when the install was re-created,
   * `"failed"` when the re-link could not (the worktree is left without an
   * install — reported, never silent). Present only when a hook ran, the
   * start-owned link was removed for it, and the hook left no `node_modules`.
   */
  postStartRelink?: "relinked" | "failed";
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
   * Human-readable failure report (`(hint: …) post-start failed: <cmd> → <stderr
   * tail>`); absent on success. Failure is never fatal to the start itself. The
   * hint LEADS — the human channel clips this line head-kept
   * (task-cli-start-remediation-tail-clipped-on-human-channel).
   */
  error?: string;
};

/** Git + gh operations, injectable for tests. Extends the branch runner. */
export interface StartGit extends GitRunner {
  /** Non-empty `git status --porcelain` output for one file ("" when clean). */
  fileStatus(cwd: string, file: string): string;
  /**
   * RAW `git status --porcelain` for the claim-stamp detection — UNTRIMMED, or
   * undefined when the probe did not answer.
   *
   * NOT `fileStatus` (review on task-strict-attach-dead-owner-hatch): porcelain
   * is POSITIONAL — the two leading status columns are the parser's input, so a
   * trimmed ` M src/a.ts` becomes `M src/a.ts` and every path is read one
   * character off (`EADME.md` in the probe that caught this), which silently
   * disarmed the CLI's single-writer detection against real git output. Absent
   * in an injected fake → the kernel runs its own real probe.
   */
  statusPorcelain?(cwd: string): string | undefined;
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

function gh(args: string[], cwd: string): string {
  try {
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
    // ORDERING is load-bearing (task-cli-start-remediation-tail-clipped-on-human-channel),
    // same contract `worktreeFailureMessage` documents: the human channel clips
    // a whole error line head-kept at MAX_HUMAN_ERROR_CHARS (2000) and gh's
    // stderr is unbounded, so the one actionable clause leads and the raw tool
    // text trails. Only the clause ORDER moved.
    throw new Error(
      `Check \`gh auth status\`. gh ${args.join(" ")} failed${stderr ? `: ${stderr}` : ` (${message})`}`,
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
    statusPorcelain(cwd: string): string | undefined {
      const result = spawnSync("git", ["status", "--porcelain"], {
        cwd,
        encoding: "utf8",
        timeout: 10_000,
      });
      if (result.error !== undefined || result.status !== 0) return undefined;
      // Returned RAW on purpose (see StartGit.statusPorcelain).
      return String(result.stdout ?? "");
    },
    commitFile(cwd: string, file: string, message: string): void {
      git(["add", "--", file], cwd);
      try {
        git(["commit", "-m", message], cwd);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        // Same head-kept clip contract as the gh wrapper above: the identity
        // hint is the only actionable clause, so it leads and git's unbounded
        // commit output trails.
        throw new Error(
          `If this is an identity error, set \`git config user.name\` / \`git config user.email\`. ${detail}`,
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
 * Actionable hint for every post-start failure report (task-post-start-env):
 * the hook inherits the invoking arggon process environment, so tools installed
 * outside that PATH (rustup's ~/.cargo/bin, mise/asdf shims) fail with
 * "command not found" even though they work in an interactive shell.
 *
 * ORDERING is load-bearing (task-cli-start-remediation-tail-clipped-on-human-channel),
 * same contract `worktreeFailureMessage` documents: the hint LEADS and the
 * hook's raw output trails, because this string is printed through
 * `sanitizeHumanError` (the human channel's head-kept MAX_HUMAN_ERROR_CHARS
 * clip) and a hook's stderr tail is unbounded.
 */
const POST_START_FAILURE_HINT =
  "(hint: hooks inherit the environment of the process that ran arggon — " +
  'use absolute paths, or set x-worktree.post-start-shell: "login")';

/**
 * Run the `x-worktree.post-start` bootstrap hook (task-start-post-hook) with
 * cwd = the freshly created worktree root. `shell` selects the invocation
 * (task-post-start-env): "inherit" (default) is `sh -c` with the invoking
 * environment; "login" runs `"$SHELL" -lc` so login profile files are sourced
 * and toolchains installed via rustup/mise/asdf land on PATH. Never throws —
 * a failure (non-zero exit, spawn error) is reported in the result so the
 * start itself still succeeds (the worktree exists and is claimed; the hook
 * is convenience, e.g. `npm ci`). Failure reports carry an actionable hint.
 */
export function runPostStart(
  command: string,
  cwd: string,
  shell: "inherit" | "login" = "inherit",
): PostStartResult {
  const failure = (detail: string): PostStartResult => ({
    command,
    ok: false,
    // Hint FIRST, hook output last — the human channel clips this whole line
    // head-kept at MAX_HUMAN_ERROR_CHARS and the stderr tail is unbounded
    // (task-cli-start-remediation-tail-clipped-on-human-channel).
    error: `${POST_START_FAILURE_HINT} post-start failed: ${command} → ${detail}`,
  });
  let result: ReturnType<typeof spawnSync>;
  try {
    result =
      shell === "login"
        ? spawnSync(process.env.SHELL || "/bin/sh", ["-lc", command], { cwd, encoding: "utf8" })
        : spawnSync("sh", ["-c", command], { cwd, encoding: "utf8" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(message);
  }
  if (result.error) {
    return failure(result.error.message);
  }
  if (result.status !== 0) {
    const tail = outputTail(String(result.stderr ?? "") || String(result.stdout ?? ""));
    return failure(tail || `exit code ${result.status ?? "unknown"}`);
  }
  return { command, ok: true };
}

/**
 * Clean-tree precondition, scoped (task-start-dirty-scope-adopt-hierarchy):
 * the start flow's claim commit stages ONLY the item file (tracker-commit
 * surgical staging), so unrelated untracked files can never land in it — git
 * does not commit untracked files unless they are added. Therefore:
 *  - untracked paths (`?? `) OUTSIDE the tracker dir do NOT block start
 *    (agent environment dirs like `.v2c/` are harmless);
 *  - untracked paths INSIDE the tracker dir still block (they would pollute
 *    the tracker and `arggon validate`);
 *  - modified or staged TRACKED paths always block (they could be swept into
 *    the claim commit's index state and branch checks).
 */
export type DirtyBlockers = {
  /** Modified/staged tracked porcelain lines (excluding the status code). */
  tracked: string[];
  /** Untracked paths under the tracker dir (or the tracker tree itself). */
  untrackedInTasks: string[];
};

/**
 * Classify `git status --porcelain` output into the two blocker groups.
 * `trackerDirNames` is the active tracker dir name (v5 `ArggonManager` by
 * default; both known names when no tracker context is available).
 */
export function dirtyBlockers(
  porcelain: string,
  trackerDirNames: string[] = [TRACKER_DIR_NAME, LEGACY_TRACKER_DIR_NAME],
): DirtyBlockers {
  const tracked: string[] = [];
  const untrackedInTasks: string[] = [];
  for (const line of porcelain.split("\n")) {
    if (line.trim().length === 0) continue;
    const code = line.slice(0, 2);
    const path = line.slice(3).trim().replace(/^"|"$/g, "");
    if (code === "??") {
      const normalized = path.replace(/\/+$/, "");
      if (
        trackerDirNames.some((name) => normalized === name || normalized.startsWith(`${name}/`))
      ) {
        untrackedInTasks.push(path);
      }
    } else if (code.trim().length > 0) {
      tracked.push(path);
    }
  }
  return { tracked, untrackedInTasks };
}

/**
 * Assert the tree is startable under the scoped clean-tree rule; throws an
 * actionable error listing exactly what blocks when it is not.
 */
export function assertStartableTree(
  porcelain: string,
  trackerDirNames: string[] = [TRACKER_DIR_NAME, LEGACY_TRACKER_DIR_NAME],
): void {
  const { tracked, untrackedInTasks } = dirtyBlockers(porcelain, trackerDirNames);
  if (tracked.length === 0 && untrackedInTasks.length === 0) return;
  const parts: string[] = [];
  if (untrackedInTasks.length > 0) {
    parts.push(
      `untracked files under ${trackerDirNames.join(" or ")}/ (they would pollute the tracker):\n  ` +
        untrackedInTasks.slice(0, 10).join("\n  "),
    );
  }
  if (tracked.length > 0) {
    parts.push(
      `modified/staged tracked files (they could collide with the claim commit):\n  ` +
        tracked.slice(0, 10).join("\n  "),
    );
  }
  throw new Error(
    `working tree has changes that block start (commit or stash first):\n${parts.join("\n")}`,
  );
}

/**
 * Start work on an item in one flow: claim (in_progress + assignee) →
 * working branch (pattern or recorded field) → commit the claim →
 * push → optional draft PR with the item id in the body.
 * Never --force: a taken claim fails clearly. Library returns data;
 * the CLI prints. Throws on a blocking dirty tree (scoped — see
 * `assertStartableTree`), unknown id, or git/gh errors.
 * With `worktree: true` the whole flow runs inside a linked git worktree
 * (`../<repo-name>-<id>`, recorded on the item as `worktree_path`).
 */
export function runStart(opts: StartOptions, deps: StartDeps = {}): StartResult {
  const id = opts.id.trim();
  if (!id) throw new Error("id is required");

  // The take-over flag is worktree-scoped (task-strict-attach-dead-owner-hatch):
  // without `--worktree` there is no claim stamp to take over, and a silently
  // ignored flag is how a recovery step gets believed to have happened.
  if (opts.takeOverWorktree === true && opts.worktree !== true) {
    throw new Error(
      "--take-over-worktree requires --worktree (it takes over a claimed worktree's ownership " +
        "stamp; a plain start writes no stamp)",
    );
  }

  const gitRunner = deps.git ?? defaultStartGit();
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  if (!gitRunner.isRepo(root)) {
    throw new Error(`not a git repository (${root}); arggon start needs git`);
  }

  // Scoped clean-tree check (task-start-dirty-scope-adopt-hierarchy): only
  // tracked modifications and untracked files under the ACTIVE tracker dir
  // block. Raw output (not trimmed): the leading X status column matters to
  // the parser.
  assertStartableTree(gitRunner.fileStatus(root, "."), [
    relative(root, tasksDir).split(sep).join("/"),
  ]);

  const item = itemsById(loadItems(tasksDir)).get(id);
  if (!item) {
    throw new Error(`id '${id}' not found under the tracker`);
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
      if (!fresh) throw new Error(`id '${id}' not found under the tracker`);
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
      linkedNodeModules: false,
      linkedWorkspaces: [],
      builtWorkspaces: [],
      // No worktree was prepared, so nothing was compared against a worktree
      // manifest: the field is only meaningful with `--worktree`.
      manifestCoverage: "unknown",
      missingDependencies: [],
      missingDependenciesTotal: 0,
      // No worktree was prepared, so no gate-bin resolution was observed; the
      // field is only meaningful with `--worktree`.
      gateBins: [],
      // Same: no preparation ran, so the log is empty.
      prepSteps: [],
      // The env contract is worktree-only: no `--worktree`, nothing applies.
      env: {
        written: false,
        warning: "no --worktree: the env contract is written only inside worktree checkouts",
      },
      item: branch.item,
    };
  });
}

/**
 * How many gate binaries the human readiness report NAMES.
 *
 * Bounded like every other list this repo prints for a human (`MAX_GATE_BINS`
 * = 8 on the kernel side, `MAX_CLAIM_WRITE_NAMES` = 10 for stamped files,
 * `assertStartableTree`'s `.slice(0, 10)`), but SMALLER on purpose: this list
 * is not the message's tail. It sits between two actionable clauses —
 * `worktreeRemediation`'s exact `npm ci` fix, and the `To discard it instead`
 * hint the caller appends after it — and each entry carries an absolute path
 * (~330 chars in a deep checkout), so the full list (~2600 chars at the
 * MAX_GATE_BINS cap) pushed the discard hint clean off the head-kept
 * `MAX_HUMAN_ERROR_CHARS` window
 * (task-cli-start-remediation-tail-clipped-on-human-channel). Two, not one,
 * because at three the discard hint's tail was still cut: the guarantee this
 * cap buys is that every ACTIONABLE clause survives the clip WHOLE, not merely
 * that its first words do. The remainder is COUNTED, never silently dropped;
 * `--json` consumers read the same message text, which is why the marker names
 * the count.
 */
export const MAX_HUMAN_GATE_BIN_NAMES = 2;

/**
 * Human sentence for a failure report, naming which node_modules the gate
 * binaries actually resolve from (bug-start-worktree-npm-ci-claim). The two
 * observed flavors of a cold-worktree claim-commit failure: no worktree
 * install at all (nothing resolves), and a resolution from OUTSIDE the
 * worktree — a parent-directory install, or a sibling checkout's `.bin` on
 * the invoking PATH — silently masking the broken worktree install. Null when
 * the observed resolution is unremarkable (every reported bin resolves from
 * the worktree, or nothing was probed and an install exists).
 */
function gateBinFailureReport(input: {
  hasInstall: boolean;
  gateBins: GateBinResolution[];
}): string | null {
  const broken = input.gateBins.filter((bin) => bin.source !== "worktree");
  if (broken.length === 0) {
    return input.hasInstall
      ? null
      : "Readiness: the worktree has no node_modules of its own (nothing resolved, so no gate binary could be probed).";
  }
  const shown = broken.slice(0, MAX_HUMAN_GATE_BIN_NAMES);
  const extra = broken.length - shown.length;
  const named = shown
    .map((bin) => {
      if (bin.source === "missing") return `${bin.name}: not resolvable from the worktree`;
      if (bin.source === "path") {
        return `${bin.name}: resolves only via PATH from ${bin.path} (outside the worktree)`;
      }
      return `${bin.name}: resolves from ${bin.path}, above the worktree`;
    })
    .join("; ");
  const more =
    extra > 0 ? `; and ${extra} more bin${extra === 1 ? "" : "s"} not resolving inside it` : "";
  return `Readiness: the gate binaries do not resolve inside the worktree — ${named}${more}.`;
}

/**
 * Step-specific remediation for a failure that kept the worktree. Returns the
 * complete "what to do next" sentence for the step: most steps are fixed and
 * retried by the attach re-run, but a failed push is NOT retried by attach
 * (attach only lands a pending claim commit — review F3), so the branch must be
 * pushed manually there.
 *
 * ORDERING is load-bearing (task-cli-start-remediation-tail-clipped-on-human-channel):
 * the `committing the claim` branch's EXACT fix leads and the readiness evidence
 * trails, for the same head-kept `MAX_HUMAN_ERROR_CHARS` contract every other
 * remedy on this channel keeps. It used to append the exact fix after the
 * readiness bin list, so at the reachable worst case (the full
 * `MAX_GATE_BINS` report, long absolute paths) the clip ate the only clause
 * that named the command to run. This branch is the MOST COMMON start failure
 * — the one that actually creates the worktree — so it is the worst place to
 * leave the class open.
 */
function worktreeRemediation(input: {
  step: string;
  id: string;
  branch: string;
  worktreePath?: string;
  readiness?: { hasInstall: boolean; gateBins: GateBinResolution[] };
}): string {
  const attach = `re-run \`arggon start ${input.id} --worktree\` — it attaches to the existing worktree`;
  if (input.step.startsWith("committing the claim")) {
    const observed =
      input.readiness === undefined ? "" : (gateBinFailureReport(input.readiness) ?? "");
    const installFix =
      input.readiness !== undefined && observed !== ""
        ? ` Exact fix for the observed resolution: run \`npm ci\` in ${input.worktreePath ?? "the worktree"}, then ${attach}.`
        : "";
    return (
      "The pre-commit gate (or the git commit itself) failed inside the worktree — fix the " +
      "reported cause there (install dependencies, or link the primary checkout's node_modules: " +
      "`ln -s <primary>/node_modules <worktree>/node_modules`; start does this itself when the " +
      // Both remedy clauses, then the evidence: the exact fix used to trail the
      // readiness list and the 2000-char head-clip ate it whole.
      `primary has one), then ${attach}.${installFix}${observed === "" ? "" : ` ${observed}`}`
    );
  }
  if (input.step.startsWith("pushing")) {
    return (
      "Fix remote access (`git fetch origin`, credentials), then push the kept branch manually: " +
      `\`git push -u origin ${input.branch}\` — a re-run of ` +
      `\`arggon start ${input.id} --worktree\` attaches to the worktree but does not retry the push.`
    );
  }
  if (input.step.startsWith("opening the draft PR")) {
    return `Check \`gh auth status\` (and the remote), then ${attach}.`;
  }
  if (input.step.startsWith("recording the claim")) {
    return (
      "Resolve the reported tracker error in the worktree (claim conflict or branch mismatch); " +
      `no claim commit was made. Then ${attach}.`
    );
  }
  return `Fix the reported cause in the worktree, then ${attach}.`;
}

/**
 * The human-channel lines for a deliberate single-writer take-over
 * (task-strict-attach-dead-owner-hatch): what was overridden, and — when the
 * stamp could not be written — that it was NOT recorded.
 *
 * The second line is load-bearing (review on task-strict-attach-dead-owner-hatch):
 * an unrecorded take-over persisted nothing, so the previous owner is still
 * stamped and the next attach re-refuses. Printing only "took over ..." would
 * read as a completed recovery that did not happen, so the degradation is named
 * right beside the note. Kept here (not inline in the CLI action) so the human
 * channel is unit-testable, and so `--json` stays byte-identical: `claim` is
 * forwarded verbatim either way.
 */
export function startTakeoverNotes(claim: WorktreeClaimReceipt | undefined): string[] {
  if (claim?.takeOver === undefined) return [];
  const notes = [`note: single-writer take-over — ${worktreeTakeoverWarning(claim.takeOver)}`];
  if (claim.stamped === false && claim.warning !== undefined) {
    notes.push(
      `warning: take-over NOT recorded — ${claim.warning}; the stamp still names the previous ` +
        "owner, so the next attach re-refuses",
    );
  }
  return notes;
}

/**
 * Failure report for a start that already created (or attached) the worktree.
 * The worktree is NEVER rolled back (bug-start-worktree-node-modules): the
 * diagnostic context survives, and the message names the failing step, the
 * kept path, the remediation, and the attach re-run.
 *
 * ORDERING is load-bearing (task-cli-start-remediation-tail-clipped-on-human-channel):
 * the actionable remediation — `worktreeRemediation` plus the discard hint —
 * comes BEFORE the kernel detail, because the human channel clips a whole
 * error line head-kept at `MAX_HUMAN_ERROR_CHARS` (2000) and the reachable
 * worst case is a kernel refusal carrying its evidence list (the full
 * `MAX_GATE_BINS` = 8 named bins, ~330 chars an entry; `strictWorktreeWriteFailure`'s
 * ten named dirty paths; `freshWorktreeInstallRefusal`'s bin list). With this
 * wrapper's own remedy last it was exactly what the clip ate — the operator got
 * the diagnosis and no way forward. Same contract the kernel refusals
 * themselves keep (`strictGateBinFailure`, #597) and the native seam composes
 * (#579/#595): remedies lead, evidence trails, on both channels. Only the clause
 * ORDER moved — every clause is verbatim, none added or dropped.
 */
export function worktreeFailureMessage(input: {
  id: string;
  branch: string;
  worktreePath: string;
  createBranch: boolean;
  step: string;
  err: unknown;
  readiness?: { hasInstall: boolean; gateBins: GateBinResolution[] };
}): string {
  const detail = input.err instanceof Error ? input.err.message : String(input.err);
  const discard = input.createBranch
    ? `git worktree remove --force ${input.worktreePath} && git branch -D ${input.branch}`
    : `git worktree remove --force ${input.worktreePath}`;
  return (
    `start failed while ${input.step}; the worktree was kept at ${input.worktreePath} ` +
    `(nothing was rolled back).\n` +
    `${worktreeRemediation({
      step: input.step,
      id: input.id,
      branch: input.branch,
      worktreePath: input.worktreePath,
      readiness: input.readiness,
    })} ` +
    `To discard it instead: \`${discard}\`.\n` +
    `${detail}`
  );
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
 * The worktree is prepared for the project gate first (the primary checkout's
 * install is linked in when the worktree lacks one —
 * bug-start-worktree-node-modules), as a link farm that points the workspace
 * packages the worktree owns at the worktree copy; those copies are built
 * before the claim commit so the gate resolves them worktree-locally
 * (task-start-worktree-lib-resolution). The install is removed before a
 * configured post-start hook runs (so `npm ci` cannot reify through it and
 * empty the primary install) and re-created only when the hook leaves no
 * `node_modules`. A failure after the worktree exists NEVER rolls it back: the
 * worktree and branch are kept, and the error names the failing step, the kept
 * path, the remediation, and the attach re-run.
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
  if (
    pathTaken &&
    !gitRunner
      .worktreeList(root)
      .map((p) => resolve(p))
      .includes(worktreePath)
  ) {
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

  // Name of the step in progress: a failure after the worktree exists keeps it
  // and reports exactly where the flow stopped (bug-start-worktree-node-modules).
  let step = "preparing the worktree";
  let linkedNodeModules = false;
  let linkedWorkspaces: string[] = [];
  let builtWorkspaces: string[] = [];
  let prepSteps: WorktreePrepStep[] = [];
  let manifestCoverage: ManifestCoverage = "unknown";
  let missingDependencies: string[] = [];
  let missingDependenciesTotal = 0;
  let gateBins: GateBinResolution[] = [];
  // Env contract (spec worktree-env-contract-016): best-effort, so the
  // defensive default below is only observable if preparation itself throws.
  let env: WorktreeEnvReceipt = {
    written: false,
    warning: "env preparation did not run",
  };
  try {
    // The kernel owns the dependency-preparation orchestration shared with the
    // native start surface. Git/domain lifecycle stays here in the CLI.
    // `x-worktree.env` opts out (spec worktree-env-contract-016): only an
    // explicit `false` disables, unset/true keep the documented default.
    const prepared = prepareWorktreeDependencies(root, worktreePath, {
      env: {
        identity: { itemId: id, branch: name },
        enabled: config.worktree.env !== false,
      },
      // Claim stamp (task-single-writer-worktree-enforcement): runs first in
      // the kernel prep, before any write of this run. Identity is the
      // resolved assignee — the CLI has no session id. The porcelain probe
      // rides the injected git runner so tests stay hermetic and a fake
      // runner answers consistently with the rest of the flow.
      claim: {
        identity: assignee,
        assignee,
        itemId: id,
        branch: name,
        surface: "cli",
        // Deliberate take-over (task-strict-attach-dead-owner-hatch): only
        // recorded when a detection FIRES, so passing the flag on a clean
        // attach is a no-op rather than a re-stamp.
        ...(opts.takeOverWorktree === true ? { takeOver: true } : {}),
        ...(opts.now !== undefined ? { now: opts.now } : {}),
        // RAW porcelain (never `fileStatus`, which trims — see
        // StartGit.statusPorcelain): the injected runner answers when it can
        // (tests fake the porcelain line), otherwise the kernel's own real
        // probe runs.
        ...(gitRunner.statusPorcelain !== undefined
          ? { status: (cwd: string) => gitRunner.statusPorcelain?.(cwd) }
          : {}),
      },
    });
    // Single-writer enforcement (task-single-writer-worktree-enforcement):
    // with `x-tracker.strict-worktree-writes: true` a fired attach-time
    // detection — the worktree stamped by a DIFFERENT session, with tracked
    // files modified after that claim — refuses the claim BEFORE any item
    // mutation, naming the stamped owner and the newer files. Unset (the
    // default) keeps the documented report-only behavior byte-identical: the
    // detection rides the receipt (`claim.foreignWrites`) and the claim
    // commit remains authoritative.
    //
    // A `--take-over-worktree` run (task-strict-attach-dead-owner-hatch) is
    // NOT here: the kernel reports the fired evidence as `claim.takeOver`
    // instead of `claim.foreignWrites`, so this gate — unchanged — treats the
    // authorized replacement of a presumed-dead stamp as resolved, and the
    // take-over rides the receipt loudly.
    if (config.tracker.strictWorktreeWrites === true && prepared.claim?.foreignWrites) {
      const refusal = strictWorktreeWriteFailure(prepared.claim.foreignWrites);
      if (refusal !== null) {
        step = "enforcing x-tracker.strict-worktree-writes";
        throw new Error(refusal);
      }
    }
    env = prepared.env ?? env;
    linkedNodeModules = prepared.linkedNodeModules;
    builtWorkspaces = prepared.builtWorkspaces;
    linkedWorkspaces = prepared.linkedWorkspaces;
    // The bounded preparation log (bug-start-install-ordering): which prep
    // path ran — link farm created / reused / skipped-and-why, per-workspace
    // build decisions, the gate-bin verdict — carried on the result so a
    // broken worktree can be correlated with the decision that produced it.
    prepSteps = prepared.steps;
    // A mirrored install is only as current as the primary's; the receipt names
    // what the worktree cannot resolve (bug-worktree-readiness-misses-stale-primary-install).
    manifestCoverage = prepared.manifestCoverage;
    missingDependencies = prepared.missingDependencies;
    missingDependenciesTotal = prepared.missingDependenciesTotal;
    // Which node_modules the gate binaries resolve from
    // (bug-start-worktree-npm-ci-claim): the claim-commit gate runs with this
    // resolution, so the receipt names it before the commit is attempted.
    gateBins = prepared.gateBins;
    // Opt-in strict gate (task-start-gate-strict-mode): with
    // `x-tracker.strict-gate-bins: true` the receipt's foreign resolution is
    // no longer report-only — the claim commit is REFUSED before any item
    // mutation, naming each offending bin, its observed source and the `npm
    // ci` fix. Unset (the default) keeps the documented honest-receipt
    // behavior byte-identical: readiness stays informational and the claim
    // commit remains authoritative.
    if (config.tracker.strictGateBins === true) {
      const refusal = strictGateBinFailure(gateBins, worktreePath);
      if (refusal !== null) {
        step = "enforcing x-tracker.strict-gate-bins";
        throw new Error(refusal);
      }
    }
    // Fresh-worktree install gate (bug-start-install-ordering): a start that
    // CREATED the worktree must leave a gate-usable install — or fail BEFORE
    // any claim commit with the named cause (the offending bins, the
    // preparation log, the `npm ci` fix). This closes the eight-incident
    // record's root defect: prep used to degrade silently (primary install
    // missing or mid-install, farm creation failing, a PATH-masked
    // resolution) and the claim commit then died at the gate with a bare
    // `tsx: command not found`. Attach re-runs keep the report-only receipt
    // (or the armed strict gate above), so the `npm ci` then attach remedy
    // stays possible.
    if (worktreeCreated) {
      const refusal = freshWorktreeInstallRefusal(gateBins, worktreePath, prepSteps);
      if (refusal !== null) {
        step = "enforcing the fresh-worktree install gate";
        throw new Error(refusal);
      }
    }
    // Resolution report (W6/PR-374 finding 2): recomputed at the end too, so a
    // post-start hook that reifies a local install is reflected in the returned
    // state (PR #384 review F2).
    step = "preparing the worktree";
    linkedWorkspaces = linkedWorkspacePackages(root, worktreePath);

    // All item writes and git steps run from the worktree from here on.
    step = "loading the item in the worktree";
    const wtTasksDir = findTasksDir(worktreePath);
    const existing = itemsById(loadItems(wtTasksDir)).get(id);
    if (!existing) throw new Error(`id '${id}' not found under the tracker`);
    if (existing.branch !== undefined && existing.branch !== null && existing.branch !== name) {
      throw new Error(
        `branch '${name}' already exists and does not match item '${id}' ('${existing.branch}'; ` +
          `set it with \`arggon update ${id} --branch <name>\` or pick another branch)`,
      );
    }

    step = "recording the claim";
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

    step = "reading back the claim";
    const itemInWorktree = itemsById(loadItems(wtTasksDir)).get(id);
    if (!itemInWorktree) throw new Error(`id '${id}' not found under the tracker`);

    step = "committing the claim (pre-commit gate)";
    let committed = false;
    if (gitRunner.fileStatus(worktreePath, itemInWorktree.filePath).trim()) {
      gitRunner.commitFile(worktreePath, itemInWorktree.filePath, `claim: ${id}`);
      committed = true;
    } else if (worktreeCreated) {
      // bug-start-install-ordering (incident 7): a FRESH worktree's item copy
      // is HEAD's — after the claim writes above it MUST be dirty. A clean
      // file means the mutation was lost (a concurrent writer or a clobbered
      // copy), and skipping the commit quietly was exactly how a start could
      // report success with no claim commit on the branch. Report or fail,
      // never skip silently.
      throw new Error(
        `the claim write left no change to ${itemInWorktree.filePath} in the fresh ` +
          `worktree — the claim commit cannot be skipped silently (lost or concurrent mutation)`,
      );
    }

    step = "pushing the branch";
    let pushed = false;
    if (committed || worktreeCreated) {
      gitRunner.pushBranch(worktreePath, name);
      pushed = true;
    }

    step = "opening the draft PR";
    let prUrl: string | null = null;
    if (opts.openPr && pushed) {
      const rel = relative(worktreePath, itemInWorktree.filePath).split(sep).join("/");
      prUrl = gitRunner.createDraftPr(worktreePath, {
        title: itemInWorktree.title ?? id,
        body: draftPrBody(id, rel, itemInWorktree, true),
      });
    }

    step = "reading back the item";
    const finalItem = itemsById(loadItems(wtTasksDir)).get(id);
    if (!finalItem) throw new Error(`id '${id}' not found under the tracker`);

    // Post-start bootstrap hook (task-start-post-hook): only on new-worktree
    // creation, never on attach re-runs. Failure is reported, not fatal — the
    // worktree exists and the claim stands.
    step = "running the post-start hook";
    let postStart: PostStartResult | undefined;
    let postStartRelink: "relinked" | "failed" | undefined;
    if (worktreeCreated && !opts.noHook) {
      const hookCommand = config.worktree.postStart;
      if (hookCommand) {
        // The hook owns the worktree's node_modules once it runs: npm's reify
        // step removes a symlinked node_modules and can empty the PRIMARY
        // checkout's install through it (review F1). The start-created link is
        // therefore removed before the hook sees the worktree, and re-created
        // after only when the hook left no install (a hook that does not
        // bootstrap, or one that failed).
        const hadLink = unlinkNodeModulesLink(root, worktreePath);
        // Flag wins over config (task-post-start-env); config unset = inherit.
        const shell = opts.postStartShell ?? config.worktree.postStartShell ?? "inherit";
        postStart = runPostStart(hookCommand, worktreePath, shell);
        if (hadLink && !existsSync(join(worktreePath, "node_modules"))) {
          // Named outcome (bug-start-install-ordering): a failed re-link used
          // to be swallowed — the worktree silently left with no install.
          postStartRelink = linkNodeModulesDetailed(root, worktreePath).linked
            ? "relinked"
            : "failed";
        }
      }
    }

    // The post-start hook owns the worktree's install once it runs: the
    // documented remediation for the linked install (`npm ci`) reifies a real
    // local one, which flips the resolution to the worktree's own copies.
    // Recompute, so the returned field describes the state the worktree is LEFT
    // in — the pre-hook value only ever described the claim-commit gate window
    // (PR #384 review F2).
    linkedWorkspaces = linkedWorkspacePackages(root, worktreePath);
    // Same rule for the gate binaries: a hook that reifies a local install
    // flips their resolution to the worktree, so the returned field describes
    // the state the worktree is LEFT in.
    gateBins = inspectGateBinResolution(worktreePath, root);
    // Same rule for the install's currency: a hook that reifies a local install
    // also stops it being stale, and one that did not leaves the names visible.
    const declared = inspectDeclaredDependencies(worktreePath);
    manifestCoverage = declared.coverage;
    missingDependencies = declared.missing;
    missingDependenciesTotal = declared.missingTotal;

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
      linkedNodeModules,
      linkedWorkspaces,
      builtWorkspaces,
      manifestCoverage,
      missingDependencies,
      missingDependenciesTotal,
      gateBins,
      prepSteps,
      env,
      ...(prepared.claim !== undefined ? { claim: prepared.claim } : {}),
      ...(postStartRelink !== undefined ? { postStartRelink } : {}),
      postStart,
      item: finalItem,
    };
  } catch (err) {
    // Never roll the worktree back (bug-start-worktree-node-modules): a deleted
    // worktree destroys the diagnostic context (hook output, partial claim) and
    // forces the manual pre-create + symlink dance. The worktree and branch are
    // kept; the error names the failing step, the path and the attach re-run.
    // The readiness snapshot is a FRESH read of the failed state, so the
    // report names the resolution the gate actually saw
    // (bug-start-worktree-npm-ci-claim).
    throw new Error(
      worktreeFailureMessage({
        id,
        branch: name,
        worktreePath,
        createBranch,
        step,
        err,
        readiness: {
          hasInstall: existsSync(join(worktreePath, "node_modules")),
          gateBins: inspectGateBinResolution(worktreePath, root),
        },
      }),
    );
  }
}
