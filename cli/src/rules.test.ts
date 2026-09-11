import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { assertUpdateRules } from "./rules.js";
import { runUpdate } from "./update.js";

const NOW = new Date("2026-09-11T12:00:00Z");

function primedTask(): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-rules-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login", now: NOW });
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

function completedTask(): { dir: string; id: string } {
  const { dir, id } = primedTask();
  runUpdate({ cwd: dir, id, status: "in_progress", assignee: "Arggon", now: NOW });
  runUpdate({ cwd: dir, id, status: "done", now: NOW });
  return { dir, id };
}

describe("assertUpdateRules", () => {
  it("allows legal transitions and keeps the CLI transition error text", () => {
    expect(() =>
      assertUpdateRules(
        { id: "x", type: "task", currentStatus: "todo", requestedStatus: "in_progress" },
        "human",
      ),
    ).not.toThrow();
    expect(() =>
      assertUpdateRules(
        { id: "x", type: "task", currentStatus: "todo", requestedStatus: "done" },
        "human",
      ),
    ).toThrow(/cannot transition status todo -> done \(allowed: in_progress, cancelled\)/);
  });

  it("keeps the CLI claim-conflict error text for humans without force", () => {
    expect(() =>
      assertUpdateRules(
        {
          id: "x",
          type: "task",
          currentStatus: "in_progress",
          currentAssignee: "alice",
          requestedAssignee: "bob",
        },
        "human",
      ),
    ).toThrow(/claim conflict: 'x' is claimed by 'alice'.*--force/);
  });

  it("rejects agent callers that force-steal a claim", () => {
    expect(() =>
      assertUpdateRules(
        {
          id: "x",
          type: "task",
          currentStatus: "in_progress",
          currentAssignee: "alice",
          requestedAssignee: "agent-x",
          force: true,
        },
        "agent",
      ),
    ).toThrow(/agents must not steal a claim; --force is a human-only escape hatch/);
  });

  it("rejects agent callers reopening done or cancelled items", () => {
    for (const from of ["done", "cancelled"] as const) {
      expect(() =>
        assertUpdateRules(
          { id: "task-x", type: "task", currentStatus: from, requestedStatus: "todo" },
          "agent",
        ),
      ).toThrow(new RegExp(`agents must not reopen ${from} items.*ask a human to reopen 'task-x'`));
    }
  });

  it("lets human callers reopen done items (playbook allows humans)", () => {
    expect(() =>
      assertUpdateRules(
        { id: "task-x", type: "task", currentStatus: "done", requestedStatus: "todo" },
        "human",
      ),
    ).not.toThrow();
  });
});

describe("runUpdate agent rules (MCP entry point)", () => {
  it("blocks reopen of a done item through runUpdate with agent: true", () => {
    const { dir, id } = completedTask();
    expect(() => runUpdate({ cwd: dir, id, status: "todo", agent: true, now: NOW })).toThrow(
      /agents must not reopen done items/,
    );
  });

  it("blocks claim steal through runUpdate with agent: true even with force", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "alice", now: NOW });
    expect(() =>
      runUpdate({ cwd: dir, id, assignee: "agent-x", force: true, agent: true, now: NOW }),
    ).toThrow(/agents must not steal a claim/);
  });

  it("still lets agents do legal work: claim and complete", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "agent-x", agent: true, now: NOW });
    runUpdate({ cwd: dir, id, status: "done", agent: true, now: NOW });
    expect(() => runUpdate({ cwd: dir, id, status: "todo", agent: true, now: NOW })).toThrow(
      /agents must not reopen done items/,
    );
  });

  it("human callers keep the old semantics (reopen and force-steal work)", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "alice", now: NOW });
    runUpdate({ cwd: dir, id, status: "done", now: NOW });
    runUpdate({ cwd: dir, id, status: "todo", now: NOW });
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "bob", force: true, now: NOW });
    expect(() => runUpdate({ cwd: dir, id, status: "todo", now: NOW })).not.toThrow();
  });
});
