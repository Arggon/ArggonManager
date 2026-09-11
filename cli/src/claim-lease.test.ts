import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toContractWorkItem } from "./contract.js";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { parseOlderThan, runList } from "./list.js";
import { runStart, type StartGit } from "./start.js";
import { runUpdate } from "./update.js";

const NOW = new Date("2026-09-03T12:00:00Z");
const NOW_ISO = "2026-09-03T12:00:00.000Z";
const LATER = new Date("2026-09-10T12:00:00Z");
const LATER_ISO = "2026-09-10T12:00:00.000Z";
const DAY = 86_400_000;

function primedTree(taskCount = 1): { dir: string; ids: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-lease-"));
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
  const ids: string[] = [];
  for (let i = 0; i < taskCount; i++) {
    const task = runCreate({
      cwd: dir,
      type: "task",
      title: `Task ${i}`,
      parent: "story-login",
      now: NOW,
    });
    ids.push(task.id);
  }
  return { dir, ids };
}

function fm(path: string) {
  return parseFrontmatter(readFileSync(path, "utf8"));
}

function fakeGit(): StartGit {
  return {
    isRepo: () => true,
    branchExists: () => false,
    checkoutNew: () => undefined,
    checkoutExisting: () => undefined,
    fileStatus: (_cwd, file) => (file === "." ? "" : ` M ${file}`),
    commitFile: () => undefined,
    pushBranch: () => undefined,
    createDraftPr: () => "https://github.com/o/r/pull/1",
  };
}

describe("claimed_at lifecycle", () => {
  it("sets claimed_at when an update claims an item", () => {
    const { dir, ids } = primedTree();
    const result = runUpdate({
      cwd: dir,
      id: ids[0]!,
      status: "in_progress",
      assignee: "alice",
      now: NOW,
    });
    expect(result.changed).toContain("claimed_at");
    expect(result.item.claimedAt).toBe(NOW_ISO);
    const { data } = fm(result.path);
    expect(data.claimed_at).toBe(NOW_ISO);
  });

  it("sets claimed_at via start", () => {
    const { dir, ids } = primedTree();
    const result = runStart(
      { cwd: dir, id: ids[0]!, assignee: "alice", now: NOW },
      { git: fakeGit() },
    );
    expect(result.item.claimedAt).toBe(NOW_ISO);
    const { data } = fm(result.path);
    expect(data.claimed_at).toBe(NOW_ISO);
  });

  it("keeps the original lease while the same claim continues", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    const result = runUpdate({ cwd: dir, id: ids[0]!, labels: "security", now: LATER });
    expect(result.changed).not.toContain("claimed_at");
    expect(result.item.claimedAt).toBe(NOW_ISO);
  });

  it("clears claimed_at on unclaim (in_progress -> todo)", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    const result = runUpdate({ cwd: dir, id: ids[0]!, status: "todo", now: LATER });
    expect(result.changed).toContain("claimed_at");
    expect(result.item.claimedAt).toBeNull();
    const { data } = fm(result.path);
    expect("claimed_at" in data).toBe(false);
  });

  it("clears claimed_at when the claim closes as done", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    const result = runUpdate({ cwd: dir, id: ids[0]!, status: "done", now: LATER });
    expect(result.item.claimedAt).toBeNull();
    const { data } = fm(result.path);
    expect("claimed_at" in data).toBe(false);
  });

  it("clears claimed_at on blocked and sets a fresh lease on re-claim", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    const blocked = runUpdate({
      cwd: dir,
      id: ids[0]!,
      status: "blocked",
      blockedReason: "waiting on creds",
      now: LATER,
    });
    expect(blocked.item.claimedAt).toBeNull();
    const reclaimed = runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", now: LATER });
    expect(reclaimed.item.claimedAt).toBe(LATER_ISO);
  });

  it("refreshes the lease when the claimant changes (--force reassignment)", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    const result = runUpdate({
      cwd: dir,
      id: ids[0]!,
      assignee: "bob",
      force: true,
      now: LATER,
    });
    expect(result.item.claimedAt).toBe(LATER_ISO);
  });

  it("exposes claimed_at on the JSON contract WorkItem", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    const list = runList({ cwd: dir, now: NOW });
    const contract = toContractWorkItem(
      list.items.find((i) => i.id === ids[0])!,
      list.root,
    );
    expect(contract.claimed_at).toBe(NOW_ISO);
  });
});

describe("stale detection (list --stale --older-than)", () => {
  it("matches claimed items past the threshold and excludes fresh ones", () => {
    const { dir, ids } = primedTree(2);
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    runUpdate({ cwd: dir, id: ids[1]!, status: "in_progress", assignee: "bob", now: LATER });

    const stale = runList({ cwd: dir, stale: true, olderThan: "7d", now: new Date(LATER.getTime() + DAY) });
    expect(stale.items.map((i) => i.id)).toEqual([ids[0]]);

    const fresh = runList({ cwd: dir, stale: true, olderThan: "7d", now: LATER });
    expect(fresh.items).toEqual([]);
  });

  it("counts claims without claimed_at (pre-feature) as stale", () => {
    const { dir, ids } = primedTree(1);
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    const list = runList({ cwd: dir, status: "in_progress" });
    const stripped = readFileSync(list.items[0]!.filePath, "utf8").replace(/^claimed_at:.*\n/m, "");
    writeFileSync(list.items[0]!.filePath, stripped);

    const stale = runList({ cwd: dir, stale: true, olderThan: "1m", now: NOW });
    expect(stale.items.map((i) => i.id)).toEqual([ids[0]]);
  });

  it("composes with other list filters", () => {
    const { dir, ids } = primedTree(2);
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    runUpdate({ cwd: dir, id: ids[1]!, status: "in_progress", assignee: "bob", now: NOW });

    const stale = runList({
      cwd: dir,
      stale: true,
      olderThan: "1d",
      assignee: "bob",
      now: new Date(NOW.getTime() + 2 * DAY),
    });
    expect(stale.items.map((i) => i.id)).toEqual([ids[1]]);
  });

  it("excludes unclaimed and non-claimed items", () => {
    const { dir, ids } = primedTree(1);
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    runUpdate({ cwd: dir, id: ids[0]!, status: "done", now: LATER });
    const stale = runList({ cwd: dir, stale: true, olderThan: "1m", now: new Date(LATER.getTime() + DAY) });
    expect(stale.items).toEqual([]);
  });

  it("rejects invalid durations with an actionable error", () => {
    expect(() => parseOlderThan("7w")).toThrow(/invalid --older-than duration/);
    expect(() => parseOlderThan("soon")).toThrow(/expected <number><d|h|m>/);
    expect(parseOlderThan("7d")).toBe(7 * DAY);
    expect(parseOlderThan("12h")).toBe(12 * 3_600_000);
    expect(parseOlderThan("30m")).toBe(30 * 60_000);
  });

  it("requires --older-than with --stale and vice versa", () => {
    const { dir } = primedTree();
    expect(() => runList({ cwd: dir, stale: true })).toThrow(/--stale requires --older-than/);
    expect(() => runList({ cwd: dir, olderThan: "7d" })).toThrow(/--older-than requires --stale/);
  });
});

describe("supervised steal (update --steal --reason)", () => {
  it("takes over a claim: reassigns, refreshes the lease, and records the reason in the body", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    const result = runUpdate({
      cwd: dir,
      id: ids[0]!,
      steal: true,
      reason: "alice left the team; taking over",
      assignee: "bob",
      now: LATER,
    });
    expect(result.changed).toEqual(expect.arrayContaining(["assignee", "claimed_at"]));
    expect(result.item.assignee).toBe("bob");
    expect(result.item.status).toBe("in_progress");
    expect(result.item.claimedAt).toBe(LATER_ISO);
    const { data, body } = fm(result.path);
    expect(data.assignee).toBe("bob");
    expect(body).toContain("> stolen 2026-09-10 by bob: alice left the team; taking over\n");
  });

  it("requires a non-empty reason", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    expect(() =>
      runUpdate({ cwd: dir, id: ids[0]!, steal: true, assignee: "bob", now: LATER }),
    ).toThrow(/--steal requires a non-empty --reason/);
    expect(() =>
      runUpdate({ cwd: dir, id: ids[0]!, steal: true, reason: "   ", assignee: "bob", now: LATER }),
    ).toThrow(/--steal requires a non-empty --reason/);
  });

  it("requires an item that is currently claimed", () => {
    const { dir, ids } = primedTree();
    expect(() =>
      runUpdate({ cwd: dir, id: ids[0]!, steal: true, reason: "x", assignee: "bob", now: LATER }),
    ).toThrow(/is not currently claimed/);
  });

  it("requires the caller to become the assignee", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    expect(() =>
      runUpdate({ cwd: dir, id: ids[0]!, steal: true, reason: "x", now: LATER }),
    ).toThrow(/--steal requires --assignee/);
  });

  it("refuses agent callers (playbook rule, like --force)", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    expect(() =>
      runUpdate({
        cwd: dir,
        id: ids[0]!,
        steal: true,
        reason: "x",
        assignee: "bob",
        agent: true,
        now: LATER,
      }),
    ).toThrow(/agents must not steal a claim; --steal is a human-only supervised/);
  });

  it("is mutually exclusive with --force", () => {
    const { dir, ids } = primedTree();
    expect(() =>
      runUpdate({
        cwd: dir,
        id: ids[0]!,
        steal: true,
        force: true,
        reason: "x",
        assignee: "bob",
        now: LATER,
      }),
    ).toThrow(/--steal and --force are mutually exclusive/);
  });

  it("bypasses the claim conflict without --force", () => {
    const { dir, ids } = primedTree();
    runUpdate({ cwd: dir, id: ids[0]!, status: "in_progress", assignee: "alice", now: NOW });
    const result = runUpdate({
      cwd: dir,
      id: ids[0]!,
      steal: true,
      reason: "stale claim, agent gone",
      assignee: "carol",
      now: LATER,
    });
    expect(result.item.assignee).toBe("carol");
  });
});
