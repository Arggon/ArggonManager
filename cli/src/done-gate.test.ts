import { mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acceptanceComplete,
  findTasksDir,
  itemsById,
  loadItems,
  parseFrontmatter,
  runCreate,
  runUpdate,
  updateOperation,
  type WorkItem,
} from "@arggondev/lib";

import { runInit } from "./init.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-09-29T12:00:00Z");
const WAIVE_REASON = "accepted as-is by coordinator";

/** Seed a full chain under `dir` and return the story id. */
function seedChain(dir: string, storyId: string): string {
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: storyId, now: NOW });
  return storyId;
}

/**
 * Seeded tree for the done gate (task-done-gate-acceptance-waiver, ADR 0015).
 * `arggon create` fills the template body, which carries ONE unchecked
 * acceptance checkbox — exactly the gated shape.
 */
function primedTask(): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-done-gate-"));
  runInit({ dir, force: false });
  const story = seedChain(dir, "story-login");
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Add rate limiting",
    parent: story,
    id: "rate-limit",
    now: NOW,
  });
  return { dir, id: task.id };
}

function claim(dir: string, id: string): void {
  runUpdate({ cwd: dir, id, status: "in_progress", assignee: "worker", now: NOW });
}

function itemOf(dir: string, id: string): WorkItem {
  return itemsById(loadItems(findTasksDir(dir))).get(id)!;
}

function tickFirstBox(dir: string, id: string): void {
  const filePath = itemOf(dir, id).filePath;
  writeFileSync(filePath, readFileSync(filePath, "utf8").replace("- [ ]", "- [x]"), "utf8");
}

describe("done gate: refusal (task-done-gate-acceptance-waiver)", () => {
  it("refuses in_progress -> done on an unchecked checklist, naming --waive", () => {
    const { dir, id } = primedTask();
    claim(dir, id);
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).toThrow(
      /unchecked boxes[\s\S]*--waive "<reason>"/,
    );
    // The refusal leaves the claim untouched: still in_progress, nothing recorded.
    expect(itemOf(dir, id).status).toBe("in_progress");
    expect(acceptanceComplete(itemOf(dir, id).body)).toBe(false);
    expect(itemOf(dir, id).body).not.toContain("### Waiver");
  });

  it("gates blocked -> done the same way (the transition table still refuses first)", () => {
    const { dir, id } = primedTask();
    claim(dir, id);
    runUpdate({
      cwd: dir,
      id,
      status: "blocked",
      blockedReason: "waiting on credentials",
      now: NOW,
    });
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).toThrow(
      /cannot transition status blocked -> done/,
    );
    // The waiver is not a transition-table bypass either.
    expect(() =>
      runUpdate({ cwd: dir, id, status: "done", waive: WAIVE_REASON, now: NOW }),
    ).toThrow(/cannot transition status blocked -> done/);
  });

  it("gates todo -> done the same way (claim first)", () => {
    const { dir, id } = primedTask();
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).toThrow(
      /cannot transition status todo -> done/,
    );
  });

  it("refuses an empty or whitespace --waive reason", () => {
    const { dir, id } = primedTask();
    claim(dir, id);
    expect(() => runUpdate({ cwd: dir, id, status: "done", waive: "", now: NOW })).toThrow(
      /--waive requires a non-empty reason/,
    );
    expect(() => runUpdate({ cwd: dir, id, status: "done", waive: "   ", now: NOW })).toThrow(
      /--waive requires a non-empty reason/,
    );
    expect(itemOf(dir, id).status).toBe("in_progress");
  });

  it("refuses --waive when there is nothing to waive (no flip, container, complete checklist)", () => {
    const { dir, id } = primedTask();
    // No --status done at all: the flag has no other meaning.
    expect(() =>
      runUpdate({ cwd: dir, id, title: "Rename", waive: WAIVE_REASON, now: NOW }),
    ).toThrow(/--waive is only valid with --status done/);
    // A container flip is not gated — and not waivable.
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "worker", now: NOW });
    expect(() =>
      runUpdate({ cwd: dir, id: "story-login", status: "done", waive: WAIVE_REASON, now: NOW }),
    ).toThrow(/--waive is only valid with --status done/);
    // A complete checklist needs no waiver.
    claim(dir, id);
    tickFirstBox(dir, id);
    expect(() =>
      runUpdate({ cwd: dir, id, status: "done", waive: WAIVE_REASON, now: NOW }),
    ).toThrow(/--waive is only valid with --status done/);
  });

  it("refuses agent callers (the MCP/native layer) even with a reason", () => {
    const { dir, id } = primedTask();
    claim(dir, id);
    expect(() =>
      runUpdate({ cwd: dir, id, status: "done", waive: WAIVE_REASON, agent: true, now: NOW }),
    ).toThrow(/agents must not waive the done gate/);
    expect(itemOf(dir, id).status).toBe("in_progress");
  });
});

describe("done gate: waiver records and flips (task-done-gate-acceptance-waiver)", () => {
  it("waive with a reason flips to done and records the dated Notes-style section", () => {
    const { dir, id } = primedTask();
    claim(dir, id);
    runUpdate({ cwd: dir, id, status: "done", waive: WAIVE_REASON, now: NOW });
    const item = itemOf(dir, id);
    expect(item.status).toBe("done");
    // Notes-style: dated heading, blank line, reason; the file still parses.
    expect(item.body).toMatch(/### Waiver 2026-09-29\n\naccepted as-is by coordinator\n$/);
    expect(() => parseFrontmatter(readFileSync(itemOf(dir, id).filePath, "utf8"))).not.toThrow();
  });

  it("keeps the checklist honest: a waived body still has its unchecked boxes", () => {
    const { dir, id } = primedTask();
    claim(dir, id);
    runUpdate({ cwd: dir, id, status: "done", waive: WAIVE_REASON, now: NOW });
    // The waiver records the rationale; it never silently ticks anything.
    expect(acceptanceComplete(itemOf(dir, id).body)).toBe(false);
  });
});

describe("done gate: paths that stay open (task-done-gate-acceptance-waiver)", () => {
  it("flips a fully-ticked checklist without the flag (and records no waiver)", () => {
    const { dir, id } = primedTask();
    claim(dir, id);
    tickFirstBox(dir, id);
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).not.toThrow();
    expect(itemOf(dir, id).status).toBe("done");
    expect(itemOf(dir, id).body).not.toContain("### Waiver");
  });

  it("gates a bug leaf identically, and a body with no checklist not at all", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-done-gate-bug-"));
    runInit({ dir, force: false });
    const story = seedChain(dir, "story-s");
    const plain = runCreate({
      cwd: dir,
      type: "bug",
      title: "B",
      parent: story,
      id: "plain",
      body: "No checklist here.\n",
      now: NOW,
    });
    // No checklist -> no acceptance contract -> no gate.
    claim(dir, plain.id);
    expect(() => runUpdate({ cwd: dir, id: plain.id, status: "done", now: NOW })).not.toThrow();
    // But an unchecked box on the SAME bug type is gated identically.
    const boxed = runCreate({
      cwd: dir,
      type: "bug",
      title: "B2",
      parent: story,
      id: "boxed",
      body: "## Acceptance\n\n- [ ] not done yet\n",
      now: NOW,
    });
    claim(dir, boxed.id);
    expect(() => runUpdate({ cwd: dir, id: boxed.id, status: "done", now: NOW })).toThrow(
      /unchecked boxes[\s\S]*--waive "<reason>"/,
    );
  });

  it("does not gate containers (story/epic/initiative keep the cascade contract)", () => {
    const { dir } = primedTask();
    // story-login carries the template's unchecked box; containers are not gated.
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "worker", now: NOW });
    expect(() =>
      runUpdate({ cwd: dir, id: "story-login", status: "done", now: NOW }),
    ).not.toThrow();
  });

  it("treats an already-done item as a no-op (no flip, no gate)", () => {
    const { dir, id } = primedTask();
    claim(dir, id);
    runUpdate({ cwd: dir, id, status: "done", waive: WAIVE_REASON, now: NOW });
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).not.toThrow();
  });

  it("a waived flip still cascades through the unchanged acceptance-aware rule", () => {
    const { dir, id } = primedTask();
    // Ticking the STORY's box lets the cascade complete it; the task waives.
    tickFirstBox(dir, "story-login");
    claim(dir, id);
    runUpdate({ cwd: dir, id, status: "done", waive: WAIVE_REASON, now: NOW });
    expect(itemOf(dir, "story-login").status).toBe("done");
    // The epic/initiative keep their own template boxes: the cascade must skip.
    expect(itemOf(dir, "auth").status).not.toBe("done");
  });
});

describe("done gate: envelope (task-done-gate-acceptance-waiver)", () => {
  it("surfaces the refusal as the documented UPDATE_FAILED envelope", () => {
    const { dir, id } = primedTask();
    claim(dir, id);
    const outcome = updateOperation({ cwd: dir, id, status: "done" });
    expect(outcome.ok).toBe(false);
    const envelope = outcome.envelope as { error?: { code?: string; message?: string } };
    expect(envelope.error?.code).toBe("UPDATE_FAILED");
    expect(envelope.error?.message).toMatch(/--waive "<reason>"/);
  });
});
