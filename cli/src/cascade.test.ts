/**
 * Automatic container completion tests (task-container-auto-done).
 *
 * When an update reaches a terminal state (done/cancelled) and every
 * sibling under a parent is terminal too, ancestor containers complete as
 * `done`, cascading up to the initiative. `--no-cascade` / cascade:false
 * opts out.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadItems } from "./items.js";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

const NOW = new Date("2026-09-11T12:00:00Z");

function chainTree(): { dir: string; tasks: string[]; bug: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-cascade-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "epic-a", now: NOW });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "epic-a",
    id: "story-a",
    now: NOW,
  });
  const t1 = runCreate({
    cwd: dir,
    type: "task",
    title: "One",
    parent: "story-a",
    id: "task-one",
    now: NOW,
  });
  const t2 = runCreate({
    cwd: dir,
    type: "task",
    title: "Two",
    parent: "story-a",
    id: "task-two",
    now: NOW,
  });
  const bug = runCreate({
    cwd: dir,
    type: "bug",
    title: "Bug",
    parent: "story-a",
    id: "bug-x",
    now: NOW,
  });
  return { dir, tasks: [t1.id, t2.id], bug: bug.id };
}

function claimAndDone(dir: string, id: string): void {
  runUpdate({ cwd: dir, id, status: "in_progress", assignee: "worker", now: NOW });
  runUpdate({ cwd: dir, id, status: "done", now: NOW });
}

function statusOf(dir: string, id: string): string {
  return loadItems(join(dir, "tasks")).find((i) => i.id === id)!.status;
}

describe("automatic container completion", () => {
  it("cascades up the whole chain when the last descendant closes", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    // story-a still open (bug-x todo): closing bug-x completes everything.
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(result.autoCompleted).toEqual(["story-a", "epic-a", "launch"]);
    expect(statusOf(dir, "story-a")).toBe("done");
    expect(statusOf(dir, "epic-a")).toBe("done");
    expect(statusOf(dir, "launch")).toBe("done");
  });

  it("does not flip containers while an open descendant remains", () => {
    const { dir, tasks } = chainTree();
    const result = runUpdate({
      cwd: dir,
      id: tasks[0],
      status: "in_progress",
      assignee: "worker",
      now: NOW,
    });
    runUpdate({ cwd: dir, id: tasks[0], status: "done", now: NOW });
    expect(result.autoCompleted).toEqual([]);
    expect(statusOf(dir, "story-a")).toBe("todo");
    expect(statusOf(dir, "launch")).toBe("todo");
  });

  it("counts cancelled as closed and completes the parent as done", () => {
    const { dir, tasks, bug } = chainTree();
    runUpdate({ cwd: dir, id: tasks[0], status: "cancelled", now: NOW });
    runUpdate({ cwd: dir, id: tasks[1], status: "cancelled", now: NOW });
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(result.autoCompleted).toEqual(["story-a", "epic-a", "launch"]);
  });

  it("completes a story stuck in todo directly (unattended exception)", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    claimAndDone(dir, bug);
    // story-a was never claimed (todo): the cascade completed it directly.
    expect(statusOf(dir, "story-a")).toBe("done");
    expect(statusOf(dir, "epic-a")).toBe("done");
  });

  it("cascade:false leaves ancestors untouched", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", cascade: false, now: NOW });
    expect(result.autoCompleted).toEqual([]);
    expect(statusOf(dir, "story-a")).toBe("todo");
    expect(statusOf(dir, "launch")).toBe("todo");
  });

  it("skips already-terminal containers but keeps completing their ancestors", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    // Complete story-a manually, out of order, while bug-x is still open.
    runUpdate({ cwd: dir, id: "story-a", status: "in_progress", assignee: "alice", now: NOW });
    runUpdate({ cwd: dir, id: "story-a", status: "done", now: NOW });
    runUpdate({ cwd: dir, id: "epic-a", status: "in_progress", now: NOW });
    // bug-x closes last: story-a is already done (skipped), epic-a and launch complete.
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(result.autoCompleted).toEqual(["epic-a", "launch"]);
    expect(statusOf(dir, "story-a")).toBe("done");
    expect(statusOf(dir, "epic-a")).toBe("done");
    expect(statusOf(dir, "launch")).toBe("done");
  });

  it("writes the auto-completed status into the container frontmatter", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    const fm = parseFrontmatter(
      readFileSync(join(dir, "tasks/launch/epic-a/story-a/story-a.md"), "utf8"),
    );
    expect(fm.data.status).toBe("done");
    expect(fm.data.updated).toBe("2026-09-11");
  });
});
