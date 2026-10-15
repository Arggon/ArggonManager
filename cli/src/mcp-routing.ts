/**
 * MCP-session tracker-root routing
 * (bug-mcp-server-binds-session-cwd-tracker-root).
 *
 * `arggon mcp` binds ONE process to the directory it was launched from
 * (`runMcpServer({ cwd: process.cwd() })` in cli.ts), and before this module
 * every tool call passed that same cwd down. A maker session launched from the
 * primary checkout on a stale base branch therefore wrote item-scoped state
 * THERE: the incident behind this item (PR #713) landed a comment + handoff on
 * the primary's `main` while the claim rode an unmerged branch in the item's
 * worktree — two local-only commits duplicating the fix branch, a handoff that
 * recorded `branch: main`, and the dangerous half (`arggon_update --status
 * done` flipping an item in a tree the branch is not on) reachable through the
 * same door.
 *
 * The repair routes every item-addressed call through the item's own
 * `worktree_path` — the frontmatter the kernel already reads to know which
 * item the call means. `start --worktree` records the absolute worktree path
 * on the item's claim commit AND writes the worktree's `.arggon.env` (spec
 * worktree-env-contract-016), so the claim is discoverable from any tree that
 * carries the item's repo: read the launch copy's own `worktree_path`, and
 * when that copy is stale (the claim rides the branch, so the primary still
 * reads `todo` with no field) scan the repo's worktrees for the one that
 * claims the item — through the item copy's own `worktree_path` or the
 * worktree's `.arggon.env`. Writing where that field points is what makes one
 * MCP session usable across the lead's flows instead of duplicating content
 * onto a base branch.
 *
 * When the recorded tree cannot be written into — gone, or no longer a tracker
 * — a WRITE is refused with a named error instead of falling back to the
 * launching tree; that fallback is the defect. Reads never refuse (a stale
 * read is detectable, a wrong write is not): they answer from the launching
 * tree exactly as before.
 *
 * This is the MCP entry point of the coupling the native surface fixed
 * (bug-native-arggon-tools-resolve-tracker-root-to-session-cwd: per-call
 * session-directory resolution plus a declared-worktree guard, and
 * bug-native-guard-silent-without-worktree-declaration: the claim footprint
 * itself declares). Parity kept: item-scoped calls (update/comment/handoff/
 * show) route; pool-scoped calls (list/next/report/validate/priority/sync/
 * import_issues) and the worktree lifecycle tools (start/branch/cleanup,
 * which run the CLI and manage worktrees by design) are untouched. The CLI
 * itself is deliberately NOT routed: it resolves its own cwd, one tree per
 * invocation, which is the plain single-checkout flow.
 *
 * Out of scope, by design: an item claimed on a branch with NO worktree
 * (`start` without `--worktree`) records no `worktree_path`, so there is no
 * address to route through — that flow is the CLI's single-checkout model.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import {
  findTrackerLocation,
  itemsById,
  loadItems,
  softTryLoadItem,
  trackerAt,
  type TrackerLocation,
} from "@arggondev/lib";

/** The env-contract file `start --worktree` writes at a worktree root (spec 016). */
const WORKTREE_ENV_FILE = ".arggon.env";

/** Identity keys of that file the claim footprint is read from. */
const ENV_ITEM_KEY = "ARGON_ITEM";
const ENV_WORKTREE_PATH_KEY = "ARGGON_WORKTREE_PATH";

/** A `.arggon.env` larger than this is not the contract's file; ignored. */
const MAX_ENV_FILE_BYTES = 8_192;

/** Upper bound of worktree roots the claim-footprint scan reads. */
const MAX_WORKTREE_SCAN = 64;

/** Wall-clock budget for the `git worktree list` read. */
const GIT_TIMEOUT_MS = 5_000;

/**
 * The `error.code` for a refused item-scoped write. The same named code the
 * native surface raises for a write that bound to a checkout the caller's
 * worktree identity disagrees with (`opencode/plugins/arggon/index.ts`): one
 * code for the class on both surfaces, so an agent sees the same signal
 * whichever entry point refused it.
 */
export const TRACKER_ROOT_MISMATCH = "TRACKER_ROOT_MISMATCH";

/** One item-addressed call's resolved working directory. */
export type ItemCallRouting =
  /** No worktree claim is involved: the call runs against the launching cwd. */
  | { kind: "launch" }
  /** The item's claim lives in another tree: run the call against that root. */
  | { kind: "routed"; root: string; via: "item-worktree-path" | "claim-footprint" }
  /**
   * The item's own recorded `worktree_path` names a tree that cannot be
   * written into (gone, or no tracker there). A write refuses with a named
   * error rather than land in the launching tree — the defect this module
   * exists to stop. Degrades to `launch` for reads.
   */
  | { kind: "refuse"; recorded: string; resolvedRoot: string };

export type ItemCallRoutingOptions = {
  /** The MCP session's bound cwd (the directory the server was launched with). */
  cwd: string;
  /** The item id the call addresses; an absent/empty id is not item-scoped. */
  id: string;
  /** True for tracker writes (update/comment/handoff); reads never refuse. */
  mutating: boolean;
};

/**
 * Resolve the cwd ONE item-addressed MCP call must run against.
 *
 * Order, and why each step is where it is:
 *
 *   1. no tracker at the launch cwd, or no item id → launch: the kernel's own
 *      resolution (and its own error) stands, exactly as before.
 *   2. the launch copy of the item records a `worktree_path`:
 *        - it points at THIS checkout → launch: the caller is already in the
 *          claim tree (the happy path — a session launched inside the worktree).
 *        - it points at an existing tracker tree → route there: the item's own
 *          recorded claim address.
 *        - it points nowhere (or a non-tracker) → refuse a write / launch a
 *          read. The record is stale; the launching tree is not the claim tree.
 *   3. otherwise scan the launch checkout's worktrees for the claim: the
 *      launch copy is stale (claim rides the branch) or the item exists only
 *      on the branch. First match routes; nothing found → launch (the plain
 *      single-tree flow, unchanged).
 */
export function resolveItemCallCwd(opts: ItemCallRoutingOptions): ItemCallRouting {
  const id = opts.id.trim();
  if (id === "") return { kind: "launch" };
  let location: TrackerLocation;
  try {
    location = findTrackerLocation(opts.cwd);
  } catch {
    return { kind: "launch" };
  }
  const launchItem = itemsById(loadItems(location.dir)).get(id);
  if (launchItem !== undefined) {
    const recorded = launchItem.worktreePath;
    if (typeof recorded === "string" && recorded.trim() !== "") {
      const target = resolve(recorded);
      if (target === location.repoRoot) return { kind: "launch" };
      if (trackerAt(target) !== null) {
        return { kind: "routed", root: target, via: "item-worktree-path" };
      }
      return opts.mutating
        ? { kind: "refuse", recorded, resolvedRoot: location.repoRoot }
        : { kind: "launch" };
    }
  }
  const claim = findClaimWorktree({
    root: location.repoRoot,
    id,
    // The path the launch tree knows the item by — the same path the claim
    // branch carries unless the branch moved the file (reparent on branch).
    relPath:
      launchItem !== undefined
        ? relative(location.repoRoot, launchItem.filePath).split(sep).join("/")
        : undefined,
  });
  if (claim !== undefined) return { kind: "routed", root: claim, via: "claim-footprint" };
  return { kind: "launch" };
}

/**
 * The claim footprint of one item: a worktree of `root` whose own copy of the
 * item (or whose `.arggon.env`) declares the claim. The launch checkout
 * itself is never a candidate — it is the tree the call is judged against.
 *
 * Two signals, one small file read each, because the two failure modes are
 * different: `x-worktree.env: false` (and pre-spec-016 worktrees) leave no
 * env file, while a worktree whose item file moved under the branch needs the
 * walk. Both are best-effort: any read that fails simply skips that root.
 *
 * When the item is absent from the launch tree (created on the branch), each
 * candidate worktree's tracker is walked — the rare path, bounded by
 * {@link MAX_WORKTREE_SCAN} roots.
 */
function findClaimWorktree(opts: {
  root: string;
  id: string;
  relPath?: string;
}): string | undefined {
  for (const root of listWorktreeRoots(opts.root)) {
    const absolute = resolve(root);
    if (absolute === resolve(opts.root)) continue;
    // 1. the documented contract: the worktree's `.arggon.env` names the item.
    const identity = readWorktreeEnv(join(absolute, WORKTREE_ENV_FILE));
    if (identity?.item === opts.id) {
      const target =
        identity.worktreePath !== undefined ? resolve(identity.worktreePath) : absolute;
      if (trackerAt(target) !== null) return target;
    }
    // 2. the item's own `worktree_path`, read from the worktree's copy at the
    //    path the launch tree knows it by.
    if (opts.relPath !== undefined) {
      const copy = softTryLoadItem(join(absolute, opts.relPath));
      if (copy.kind === "item" && copy.item.id === opts.id) {
        const recorded = copy.item.worktreePath;
        if (typeof recorded === "string" && recorded.trim() !== "") {
          const target = resolve(recorded);
          if (trackerAt(target) !== null) return target;
        }
      }
      continue;
    }
    // 3. the item is unknown to the launch tree: walk the worktree's tracker.
    try {
      const location = findTrackerLocation(absolute);
      const item = itemsById(loadItems(location.dir)).get(opts.id);
      const recorded = item?.worktreePath;
      if (typeof recorded === "string" && recorded.trim() !== "") {
        const target = resolve(recorded);
        if (trackerAt(target) !== null) return target;
      }
    } catch {
      // Not a tracker tree (or unreadable): this root claims nothing readable.
    }
  }
  return undefined;
}

/**
 * Registered worktree roots of `git worktree list --porcelain` run at `root`,
 * in listing order, bounded to {@link MAX_WORKTREE_SCAN}. Total and silent: a
 * tree without git, a non-repo, or a failed listing yields no roots, which
 * degrades every routing decision to its pre-existing behavior.
 */
function listWorktreeRoots(root: string): string[] {
  let out: string;
  try {
    out = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: GIT_TIMEOUT_MS,
    });
  } catch {
    return [];
  }
  const paths: string[] = [];
  for (const line of out.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const path = line.slice("worktree ".length).trim();
    if (path !== "") paths.push(path);
    if (paths.length >= MAX_WORKTREE_SCAN) break;
  }
  return paths;
}

/** The subset of a `.arggon.env` identity the claim footprint reads. */
type WorktreeEnvIdentity = { item?: string; worktreePath?: string };

/**
 * Read one `.arggon.env` (spec worktree-env-contract-016: unquoted `KEY=value`
 * lines). Read-only and never fatal: a missing, unreadable or oversized file
 * yields undefined, and an adopter's extra key simply never matches — the two
 * documented keys are the only ones consulted.
 */
function readWorktreeEnv(file: string): WorktreeEnvIdentity | undefined {
  let body: string;
  try {
    body = readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  if (body.length > MAX_ENV_FILE_BYTES) return undefined;
  const identity: WorktreeEnvIdentity = {};
  for (const line of body.split("\n")) {
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key === "" || value === "") continue;
    if (key === ENV_ITEM_KEY) identity.item = value;
    else if (key === ENV_WORKTREE_PATH_KEY) identity.worktreePath = value;
  }
  return identity.item !== undefined || identity.worktreePath !== undefined ? identity : undefined;
}

/**
 * The named refusal for a write whose item records a worktree that cannot be
 * written into. It names both trees — the launching one and the recorded
 * claim tree — and the two remedies, because "which tree is wrong" is exactly
 * the question the incident's silence left unanswered. The code matches the
 * native surface's (`opencode/plugins/arggon/index.ts`): one named code for
 * the class on both surfaces.
 *
 * The CLI in the launching tree is named as a remedy on purpose: the CLI is
 * deliberately unrouted (one cwd, one tree, the single-checkout flow), so it
 * remains the escape hatch for a lifecycle write the MCP surface refuses.
 */
export function itemWorktreeRefusalMessage(opts: {
  command: string;
  id: string;
  recorded: string;
  resolvedRoot: string;
}): string {
  return (
    `${opts.command} resolves the tracker root to ${opts.resolvedRoot}, but item ${opts.id}'s ` +
    `recorded worktree_path is ${opts.recorded} and that tree is not available; refusing to ` +
    `write ${opts.command} into ${opts.resolvedRoot}, which is not the item's claim tree. ` +
    `Recreate the worktree at the recorded path, run the call from it, or run the ` +
    `\`arggon ${opts.command}\` CLI there directly (the CLI resolves its own cwd and is not ` +
    `routed through worktree_path).`
  );
}
