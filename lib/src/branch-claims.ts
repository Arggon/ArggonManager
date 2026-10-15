import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { relative, sep } from "node:path";
import { parseFrontmatter, type Frontmatter } from "./frontmatter.js";
import { isItemType } from "./ids.js";
import type { WorkItem } from "./items.js";
import { isClaimable, isClaimed, isStatus } from "./status.js";
import {
  branchReferencesItem,
  type BranchClaim,
  type BranchClaimError,
  type BranchClaimsResult,
  type PRInfo,
} from "./sync-types.js";

/**
 * Branch-resident claim reader (bug-claim-pool-computed-from-main-misses-
 * branch-claims).
 *
 * A claim made through `start` commits the item's frontmatter on the item's
 * BRANCH, so until that branch merges the primary checkout's copy still reads
 * `todo`/unassigned and `list`/`next` ranked from it cannot see the claim.
 * This reader reads the item file from the branch copies themselves and
 * reports every claim the tree does not show.
 *
 * Discovery, for each locally-unclaimed claimable item (the pool's candidate
 * set):
 *   - its recorded `branch`;
 *   - every local (`refs/heads`) or fetched origin (`refs/remotes/origin`)
 *     ref whose name references the item id (`branchReferencesItem`);
 *   - every open-PR head branch referencing the item id — a PR branch that is
 *     not fetched locally cannot be read, and is reported as an ERROR (claim
 *     state unknown), never silently treated as unclaimed.
 *
 * Reads are LOCAL GIT ONLY (`git show <ref>:<path>`); no network. Report-only:
 * the caller never gates on the result.
 */

/** Signature for git executors (tests inject a fake; production uses the real binary). */
export type BranchClaimsGitExecutor = (
  file: string,
  args: string[],
  options?: ExecFileSyncOptions,
) => string;

const defaultExecGit: BranchClaimsGitExecutor = (file, args, options) =>
  execFileSync(file, args, options) as string;

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["done", "cancelled"]);

/** First line of an error, bounded — enough to name the git refusal, not the whole dump. */
function shortReason(err: unknown): string {
  const stderr =
    err !== null && typeof err === "object" && "stderr" in err
      ? String((err as { stderr?: unknown }).stderr ?? "")
      : "";
  const message = stderr.trim() || (err instanceof Error ? err.message : String(err));
  return message.split("\n")[0]!.trim().slice(0, 240);
}

type Refs = {
  /** Branch names under `refs/heads/`. */
  local: Set<string>;
  /** Branch names under `refs/remotes/origin/` (origin only). */
  remote: Set<string>;
};

/**
 * The refs this read can consult, or null when the tree has no git repository
 * (or git is unavailable): there are no branches to reconcile, so the scan is
 * a no-op rather than a pile of errors.
 */
function listRefs(root: string, execGit: BranchClaimsGitExecutor): Refs | null {
  let out: string;
  try {
    out = execGit(
      "git",
      ["-C", root, "for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes/origin"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 10_000,
      },
    );
  } catch {
    return null;
  }
  const local = new Set<string>();
  const remote = new Set<string>();
  for (const raw of out.split("\n")) {
    const ref = raw.trim();
    if (ref.startsWith("refs/heads/")) local.add(ref.slice("refs/heads/".length));
    else if (ref.startsWith("refs/remotes/origin/")) {
      const name = ref.slice("refs/remotes/origin/".length);
      if (name !== "HEAD") remote.add(name);
    }
  }
  return { local, remote };
}

/** `git show <ref>:<path>`, as content or a bounded reason. */
function showFile(
  root: string,
  ref: string,
  path: string,
  execGit: BranchClaimsGitExecutor,
): { ok: true; content: string } | { ok: false; reason: string } {
  try {
    const content = execGit("git", ["-C", root, "show", `${ref}:${path}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { ok: true, content };
  } catch (err) {
    return { ok: false, reason: shortReason(err) };
  }
}

/** Frontmatter of a branch copy, or null when the file has no readable block. */
function readFrontmatter(content: string): Frontmatter | null {
  try {
    return parseFrontmatter(content).data;
  } catch {
    return null;
  }
}

export type BranchClaimsOptions = {
  /** Repo root (parent of the tracker dir). */
  root: string;
  /** All loaded items of the tree this run read. */
  items: WorkItem[];
  /** Open PRs (from the same `gh pr list` read sync already performs). */
  prs: PRInfo[];
  /** Executor override for hermetic tests; defaults to the real git binary. */
  execGit?: BranchClaimsGitExecutor;
};

/**
 * Read branch-resident claims for one tracker tree. Never throws: an
 * unreadable branch becomes a `branchClaimErrors` entry (claim state unknown),
 * and a tree without git returns empty arrays (no branches to reconcile).
 */
export function findBranchClaims(opts: BranchClaimsOptions): BranchClaimsResult {
  const execGit = opts.execGit ?? defaultExecGit;
  const refs = listRefs(opts.root, execGit);
  if (refs === null) return { claims: [], errors: [] };

  const prByBranch = new Map(opts.prs.map((pr) => [pr.headRefName, pr.number]));
  const claims: BranchClaim[] = [];
  const errors: BranchClaimError[] = [];

  // The pool's candidate set: claimable items this tree does not already show
  // as claimed (a visible local claim needs no branch read). Terminal items
  // are excluded — their branch claims are history, not held work.
  const candidates = opts.items.filter(
    (item) =>
      isClaimable(item.type) &&
      !isClaimed(item.type, item.status, item.assignee) &&
      !TERMINAL_STATUSES.has(item.status),
  );

  for (const item of candidates) {
    const path = relative(opts.root, item.filePath).split(sep).join("/");
    const names = new Set<string>();
    if (item.branch) names.add(item.branch);
    for (const name of refs.local) {
      if (branchReferencesItem(name, item.id)) names.add(name);
    }
    for (const name of refs.remote) {
      if (branchReferencesItem(name, item.id)) names.add(name);
    }
    for (const pr of opts.prs) {
      if (branchReferencesItem(pr.headRefName, item.id)) names.add(pr.headRefName);
    }

    for (const branch of [...names].sort()) {
      const pr = prByBranch.get(branch) ?? null;
      // Prefer the local checkout's copy; a fetched origin ref is the fallback.
      const ref = refs.local.has(branch)
        ? `refs/heads/${branch}`
        : refs.remote.has(branch)
          ? `refs/remotes/origin/${branch}`
          : null;
      if (ref === null) {
        errors.push({
          id: item.id,
          branch,
          pr,
          reason: "branch not available locally (fetch it to read its copy)",
        });
        continue;
      }
      const read = showFile(opts.root, ref, path, execGit);
      if (!read.ok) {
        errors.push({ id: item.id, branch, pr, reason: read.reason });
        continue;
      }
      const data = readFrontmatter(read.content);
      if (data === null) {
        errors.push({
          id: item.id,
          branch,
          pr,
          reason: "item file on the branch has no readable frontmatter",
        });
        continue;
      }
      // A path that exists on the branch but carries a different item id is
      // not this item's copy (renamed/moved history) — nothing to report. A
      // copy with NO id cannot be classified, so it is reported as unreadable
      // rather than silently treated as unclaimed.
      if (data.id !== item.id) {
        if (typeof data.id === "string" && data.id.length > 0) continue;
        errors.push({
          id: item.id,
          branch,
          pr,
          reason: "item file on the branch has no item id in frontmatter",
        });
        continue;
      }
      const { type, status, assignee } = data;
      if (
        typeof type !== "string" ||
        !isItemType(type) ||
        typeof status !== "string" ||
        !isStatus(status)
      ) {
        errors.push({
          id: item.id,
          branch,
          pr,
          reason: "item file on the branch has no readable frontmatter",
        });
        continue;
      }
      const assigneeName = typeof assignee === "string" && assignee.length > 0 ? assignee : null;
      if (!isClaimed(type, status, assigneeName)) continue;
      claims.push({
        id: item.id,
        branch,
        pr,
        assignee: assigneeName!,
        claimed_at: typeof data.claimed_at === "string" ? data.claimed_at : null,
        local: { status: item.status, assignee: item.assignee ?? null },
      });
    }
  }

  const byIdThenBranch = (a: { id: string; branch: string }, b: { id: string; branch: string }) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : a.branch < b.branch ? -1 : a.branch > b.branch ? 1 : 0;
  claims.sort(byIdThenBranch);
  errors.sort(byIdThenBranch);
  return { claims, errors };
}
