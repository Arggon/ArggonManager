import { execFileSync } from "node:child_process";
import { relative, sep } from "node:path";
import { runBranch, type GitRunner } from "./branch.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { resolveCurrentLogin } from "./list.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { runUpdate } from "./update.js";

export type StartOptions = {
  cwd: string;
  id: string;
  assignee?: string;
  openPr?: boolean;
  now?: Date;
};

export type StartResult = {
  id: string;
  path: string;
  /** Repo root (parent of tasks/; also the git cwd). */
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
  /** The item, reloaded from disk. */
  item: WorkItem;
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
  };
}

/**
 * Start work on an item in one flow: claim (in_progress + assignee) →
 * working branch (pattern or recorded field) → commit the claim →
 * push → optional draft PR with the item id in the body.
 * Never --force: a taken claim fails clearly. Library returns data;
 * the CLI prints. Throws on dirty tree, unknown id, or git/gh errors.
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

  const claimed = runUpdate({
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
      body: `Work item: ${id}\n\nPath: ${rel}\n\nDraft opened by \`arggon start\`.`,
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
    item: branch.item,
  };
}
