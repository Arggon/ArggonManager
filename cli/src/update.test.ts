import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

const NOW = new Date("2026-09-03T12:00:00Z");
const LATER = new Date("2026-09-04T12:00:00Z");

function primedTask(): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-update-"));
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
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Add rate limiting",
    parent: "story-login",
    id: "rate-limit",
    now: NOW,
  });
  return { dir, id: task.id };
}

function fm(path: string) {
  return parseFrontmatter(readFileSync(path, "utf8"));
}

describe("update", () => {
  it("updates only requested fields, touches updated, and prints nothing", () => {
    const { dir, id } = primedTask();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const result = runUpdate({
        cwd: dir,
        id,
        status: "in_progress",
        assignee: "arggon",
        now: LATER,
      });
      expect(log).not.toHaveBeenCalled();
      expect(result.changed).toEqual(expect.arrayContaining(["status", "assignee"]));
      const { data, body } = fm(result.path);
      expect(data).toMatchObject({
        type: "task",
        status: "in_progress",
        assignee: "arggon",
        title: "Add rate limiting",
        parent: "story-login",
        created: "2026-09-03",
        updated: "2026-09-04",
      });
      expect(body.length).toBeGreaterThan(0);
      expect(result.item.status).toBe("in_progress");
    } finally {
      log.mockRestore();
    }
  });

  it("fails clearly on unknown id", () => {
    const { dir } = primedTask();
    expect(() => runUpdate({ cwd: dir, id: "nope", status: "todo" })).toThrow(
      /id 'nope' not found/,
    );
  });

  it("enforces status transitions", () => {
    const { dir, id } = primedTask();
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).toThrow(
      /cannot transition status todo -> done/,
    );
    // todo -> blocked is not a valid edge (claim first).
    expect(() =>
      runUpdate({ cwd: dir, id, status: "blocked", blockedReason: "x", now: NOW }),
    ).toThrow(/cannot transition status todo -> blocked/);
  });

  it("requires assignee when claiming a leaf", () => {
    const { dir, id } = primedTask();
    expect(() => runUpdate({ cwd: dir, id, status: "in_progress", now: NOW })).toThrow(
      /requires --assignee/,
    );
  });

  it("requires blocked_reason when blocking and clears it when unblocking", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "arggon", now: NOW });
    expect(() => runUpdate({ cwd: dir, id, status: "blocked", now: NOW })).toThrow(
      /status blocked requires --blocked-reason/,
    );
    const blocked = runUpdate({
      cwd: dir,
      id,
      status: "blocked",
      blockedReason: "Waiting on repro",
      now: NOW,
    });
    expect(fm(blocked.path).data.blocked_reason).toBe("Waiting on repro");
    const unblocked = runUpdate({ cwd: dir, id, status: "in_progress", now: LATER });
    expect(fm(unblocked.path).data.blocked_reason).toBeUndefined();
    expect(unblocked.changed).toContain("blocked_reason");
  });

  it("unclaims by default (in_progress -> todo clears assignee)", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "arggon", now: NOW });
    const result = runUpdate({ cwd: dir, id, status: "todo", now: LATER });
    expect(fm(result.path).data.assignee).toBeUndefined();
    expect(result.changed).toEqual(expect.arrayContaining(["status", "assignee"]));
  });

  it("refuses to steal a claim", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "alice", now: NOW });
    expect(() => runUpdate({ cwd: dir, id, assignee: "bob", now: NOW })).toThrow(
      /claim conflict.*claimed by 'alice'/,
    );
  });

  it("supports --unassign and --labels replace", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "arggon", now: NOW });
    // Unassign while in_progress on a leaf violates the claim rule.
    expect(() => runUpdate({ cwd: dir, id, unassign: true, now: NOW })).toThrow(
      /requires --assignee/,
    );
    const result = runUpdate({ cwd: dir, id, status: "todo", labels: "a, b", now: LATER });
    expect(fm(result.path).data).toMatchObject({ labels: ["a", "b"] });
    expect(result.changed).toContain("labels");
  });

  it("updates title and rejects empty titles", () => {
    const { dir, id } = primedTask();
    const result = runUpdate({ cwd: dir, id, title: "Throttle logins", now: LATER });
    expect(fm(result.path).data.title).toBe("Throttle logins");
    expect(() => runUpdate({ cwd: dir, id, title: "  ", now: NOW })).toThrow(
      /title must not be empty/,
    );
  });

  it("errors when nothing is requested", () => {
    const { dir, id } = primedTask();
    expect(() => runUpdate({ cwd: dir, id, now: NOW })).toThrow(/nothing to update/);
  });
});
