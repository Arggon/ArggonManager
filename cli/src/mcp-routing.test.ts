/**
 * Unit tests for the MCP item-scoped cwd routing
 * (bug-mcp-server-binds-session-cwd-tracker-root): the routing primitive the
 * `arggon mcp` item-addressed tools use, pinned against real git worktrees.
 * The end-to-end surface behavior (stdio JSON-RPC → which tree the comment
 * lands in) is pinned in mcp-server.test.ts.
 */
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate, runUpdate } from "@arggondev/lib";
import { runInit } from "./init.js";
import { resolveItemCallCwd, TRACKER_ROOT_MISMATCH } from "./mcp-routing.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

const ITEM_REL = "ArggonManager/inc/area/story-topic/task-thing.md";

function git(cwd: string, args: string[]): void {
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * The claim as `start --worktree` writes it: the kernel's claim update plus
 * the additive `worktree_path` record start appends to the item file.
 */
function recordClaim(cwd: string, worktreePath: string, id = "task-thing"): void {
  runUpdate({
    cwd,
    id,
    status: "in_progress",
    assignee: "arggon-maker",
    branch: "feat/task-thing",
  });
  const file = join(cwd, "ArggonManager/inc/area/story-topic", `${id}.md`);
  const body = readFileSync(file, "utf8");
  if (!/^worktree_path:/m.test(body)) {
    writeFileSync(
      file,
      body.replace(/^branch: .*$/m, `branch: feat/task-thing\nworktree_path: ${worktreePath}`),
      "utf8",
    );
  }
}

/**
 * A primary git checkout with a tracker and one unclaimed task, plus (with
 * `worktree: true`) the claim worktree `start --worktree` would have created —
 * the exact shape of the PR #713 incident: the primary stays on its base
 * branch while the claim rides the worktree's branch.
 */
function seedRepo(opts: { worktree?: boolean } = {}): { primary: string; worktree: string } {
  const primary = mkdtempSync(join(tmpdir(), "arggon-mcp-routing-"));
  git(primary, ["init", "-q"]);
  git(primary, ["config", "user.name", "test"]);
  git(primary, ["config", "user.email", "test@example.com"]);
  git(primary, ["commit", "-q", "--allow-empty", "-m", "seed"]);
  runInit({ dir: primary, force: false });
  runCreate({ cwd: primary, type: "initiative", title: "Inc" });
  runCreate({ cwd: primary, type: "epic", title: "Area", parent: "inc" });
  runCreate({ cwd: primary, type: "story", title: "Topic", parent: "area", id: "story-topic" });
  runCreate({
    cwd: primary,
    type: "task",
    title: "Do the thing",
    parent: "story-topic",
    id: "task-thing",
  });
  git(primary, ["add", "-A"]);
  // The tracker's own auto-commits may already have committed the seed; the
  // marker commit only has to exist.
  git(primary, ["commit", "-q", "--allow-empty", "-m", "seed tracker"]);

  const worktree = `${primary}-task-thing`;
  if (opts.worktree !== true) return { primary, worktree: "" };
  git(primary, ["worktree", "add", "-q", worktree, "-b", "feat/task-thing"]);
  recordClaim(worktree, worktree);
  writeFileSync(
    join(worktree, ".arggon.env"),
    [
      "ARGON_ITEM=task-thing",
      `ARGGON_WORKTREE_ID=${join(primary, "..")}`,
      `ARGGON_WORKTREE_PATH=${worktree}`,
      "ARGGON_WORKTREE_BRANCH=feat/task-thing",
      "",
    ].join("\n"),
    "utf8",
  );
  git(worktree, ["add", "-A"]);
  git(worktree, ["commit", "-q", "--allow-empty", "-m", "claim: task-thing"]);
  return { primary, worktree };
}

describe("resolveItemCallCwd (bug-mcp-server-binds-session-cwd-tracker-root)", () => {
  it("routes through the launch copy's own worktree_path", () => {
    const { primary, worktree } = seedRepo({ worktree: true });
    // Make the launch copy CURRENT: the claim is visible here too (a session
    // launched inside the claim tree, or a primary that pulled the branch).
    recordClaim(primary, worktree);
    expect(resolveItemCallCwd({ cwd: primary, id: "task-thing", mutating: true })).toEqual({
      kind: "routed",
      root: worktree,
      via: "item-worktree-path",
    });
  });

  it("routes through the claim footprint when the launch copy is stale (the incident)", () => {
    const { primary, worktree } = seedRepo({ worktree: true });
    // The primary's copy reads `todo` with no worktree_path — exactly the
    // stale base branch the PR #713 session was launched from.
    expect(readFileSync(join(primary, ITEM_REL), "utf8")).toContain("status: todo");
    expect(resolveItemCallCwd({ cwd: primary, id: "task-thing", mutating: true })).toEqual({
      kind: "routed",
      root: worktree,
      via: "claim-footprint",
    });
    // Reads route the same way: an item-scoped call speaks to the item's own tree.
    expect(resolveItemCallCwd({ cwd: primary, id: "task-thing", mutating: false })).toEqual({
      kind: "routed",
      root: worktree,
      via: "claim-footprint",
    });
  });

  it("routes through the item copy's worktree_path when the worktree has no .arggon.env", () => {
    const { primary, worktree } = seedRepo({ worktree: true });
    rmSync(join(worktree, ".arggon.env"));
    git(worktree, ["add", "-A"]);
    git(worktree, ["commit", "-q", "--allow-empty", "-m", "drop env contract"]);
    expect(resolveItemCallCwd({ cwd: primary, id: "task-thing", mutating: true })).toEqual({
      kind: "routed",
      root: worktree,
      via: "claim-footprint",
    });
  });

  it("launches unchanged when the claim is in the calling tree itself", () => {
    const { worktree } = seedRepo({ worktree: true });
    // A session launched INSIDE the claim worktree: the copy claims this very
    // tree, so there is nothing to route.
    expect(resolveItemCallCwd({ cwd: worktree, id: "task-thing", mutating: true })).toEqual({
      kind: "launch",
    });
    // …and an item with no claim anywhere (the story) is the ordinary
    // single-tree flow, even in the worktree.
    expect(resolveItemCallCwd({ cwd: worktree, id: "story-topic", mutating: true })).toEqual({
      kind: "launch",
    });
  });

  it("launches for an item with no worktree claim anywhere", () => {
    const { primary } = seedRepo();
    expect(resolveItemCallCwd({ cwd: primary, id: "task-thing", mutating: true })).toEqual({
      kind: "launch",
    });
  });

  it("refuses a write named when the recorded worktree is gone (reads still answer)", () => {
    const { primary, worktree } = seedRepo({ worktree: true });
    recordClaim(primary, `${worktree}-gone`);
    const refused = resolveItemCallCwd({ cwd: primary, id: "task-thing", mutating: true });
    expect(refused).toMatchObject({
      kind: "refuse",
      recorded: `${worktree}-gone`,
      resolvedRoot: primary,
    });
    // A read never refuses: a stale read is detectable, a wrong write is not.
    expect(resolveItemCallCwd({ cwd: primary, id: "task-thing", mutating: false })).toEqual({
      kind: "launch",
    });
  });

  it("routes an item that exists only on the claim branch", () => {
    const { primary, worktree } = seedRepo({ worktree: true });
    // Created AND claimed on the branch: the launch copy has no such item
    // file at all, so the discovery is the per-worktree tracker walk.
    runCreate({
      cwd: worktree,
      type: "task",
      title: "Branch-only follow-up",
      parent: "story-topic",
      id: "task-branch-only",
    });
    recordClaim(worktree, worktree, "task-branch-only");
    git(worktree, ["add", "-A"]);
    git(worktree, ["commit", "-q", "--allow-empty", "-m", "branch-only item"]);
    const routing = resolveItemCallCwd({ cwd: primary, id: "task-branch-only", mutating: true });
    // The worktree's `.arggon.env` names task-thing, so the env signal misses
    // — the walk is what finds this claim tree.
    expect(routing).toMatchObject({ kind: "routed", root: worktree });
  });

  it("launches when the tree is not a git repo (git failure degrades silently)", () => {
    const plain = mkdtempSync(join(tmpdir(), "arggon-mcp-routing-plain-"));
    runInit({ dir: plain, force: false });
    runCreate({ cwd: plain, type: "initiative", title: "Inc" });
    runCreate({ cwd: plain, type: "epic", title: "Area", parent: "inc" });
    runCreate({ cwd: plain, type: "story", title: "Topic", parent: "area", id: "story-topic" });
    runCreate({
      cwd: plain,
      type: "task",
      title: "Plain",
      parent: "story-topic",
      id: "task-plain",
    });
    expect(resolveItemCallCwd({ cwd: plain, id: "task-plain", mutating: true })).toEqual({
      kind: "launch",
    });
  });

  it("launches without a tracker and for an absent/unknown id (the kernel's own errors stand)", () => {
    const { primary } = seedRepo({ worktree: true });
    expect(resolveItemCallCwd({ cwd: primary, id: "", mutating: true })).toEqual({
      kind: "launch",
    });
    expect(resolveItemCallCwd({ cwd: primary, id: "task-nope", mutating: true })).toEqual({
      kind: "launch",
    });
    const outside = mkdtempSync(join(tmpdir(), "arggon-mcp-routing-none-"));
    mkdirSync(outside, { recursive: true });
    expect(resolveItemCallCwd({ cwd: outside, id: "task-thing", mutating: true })).toEqual({
      kind: "launch",
    });
  });

  it("exports the native surface's named code for the class", () => {
    expect(TRACKER_ROOT_MISMATCH).toBe("TRACKER_ROOT_MISMATCH");
  });
});
