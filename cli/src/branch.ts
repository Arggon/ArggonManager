import { execFileSync } from "node:child_process";
import { readConventionConfig, resolveBranchName } from "./convention.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { runUpdate } from "./update.js";

export type BranchOptions = {
  cwd: string;
  id: string;
  now?: Date;
};

export type BranchResult = {
  id: string;
  path: string;
  /** Repo root (parent of tasks/; also the git cwd). */
  root: string;
  branch: string;
  /** True when `git checkout -b` ran; false when attaching to the recorded branch. */
  created: boolean;
  /** The item, reloaded from disk (branch field persisted). */
  item: WorkItem;
};

/** Git operations, injectable for tests. */
export type GitRunner = {
  isRepo(cwd: string): boolean;
  branchExists(cwd: string, name: string): boolean;
  checkoutNew(cwd: string, name: string): void;
  checkoutExisting(cwd: string, name: string): void;
};

export type BranchDeps = {
  git?: GitRunner;
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

export function defaultGitRunner(): GitRunner {
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
  };
}

/**
 * Resolve the working branch for an item and check it out with git.
 * Uses the recorded `branch` field when set (attach), else generates it
 * from `branch_patterns` and persists it. Fails clearly when the branch
 * already exists without matching the recorded field. Library returns
 * data; the CLI prints. Throws on unknown id, bad config, or git errors.
 */
export function runBranch(opts: BranchOptions, deps: BranchDeps = {}): BranchResult {
  const id = opts.id.trim();
  if (!id) throw new Error("id is required");

  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const config = readConventionConfig(root);
  const item = itemsById(loadItems(tasksDir)).get(id);
  if (!item) {
    throw new Error(`id '${id}' not found under tasks/`);
  }

  const pattern = config.branchPatterns[item.type];
  const name = item.branch ?? resolveBranchName(pattern, item);
  const gitRunner = deps.git ?? defaultGitRunner();
  if (!gitRunner.isRepo(root)) {
    throw new Error(`not a git repository (${root}); arggon branch needs git to checkout`);
  }

  if (gitRunner.branchExists(root, name)) {
    if (item.branch === name) {
      gitRunner.checkoutExisting(root, name);
      return { id, path: item.filePath, root, branch: name, created: false, item };
    }
    const recorded = item.branch ? `'${item.branch}'` : "no branch recorded";
    throw new Error(
      `branch '${name}' already exists and does not match item '${id}' (${recorded}; ` +
        `set it with \`arggon update ${id} --branch <name>\` or pick another branch)`,
    );
  }

  gitRunner.checkoutNew(root, name);
  if (item.branch === name) {
    const reloaded = itemsById(loadItems(tasksDir)).get(id);
    if (!reloaded) throw new Error(`id '${id}' not found under tasks/`);
    return { id, path: item.filePath, root, branch: name, created: true, item: reloaded };
  }
  const updated = runUpdate({ cwd: opts.cwd, id, branch: name, now: opts.now });
  return { ...updated, branch: name, created: true };
}
