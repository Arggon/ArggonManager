import { mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acceptanceComplete,
  acceptanceGate,
  acceptanceRows,
  acceptanceUnchecked,
  findTasksDir,
  liveAcceptanceCriteria,
  liveAcceptanceUnchecked,
  itemsById,
  loadItems,
  parseFrontmatter,
  runComment,
  runCreate,
  runUpdate,
  updateOperation,
  type AcceptanceRow,
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
 * Since bug-empty-template-checkbox the create template scaffolds NO checkbox
 * under `## Acceptance` (an empty box is not a criterion), so the tests that
 * exercise the gate seed ONE REAL unchecked criterion explicitly — the gated
 * shape.
 */
const PRIMED_BODY =
  "## Context\n\nKeep the gate honest.\n\n## Acceptance\n\n- [ ] p95 under 100ms\n";

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
    body: PRIMED_BODY,
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

/** Replace an item's body wholesale (the frontmatter is kept). */
function setBody(dir: string, id: string, body: string): void {
  const filePath = itemOf(dir, id).filePath;
  const raw = readFileSync(filePath, "utf8");
  const end = raw.indexOf("\n---\n");
  if (end < 0) throw new Error(`setBody: no frontmatter terminator in ${filePath}`);
  writeFileSync(filePath, raw.slice(0, end + 5) + body, "utf8");
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

  it("gates a bug leaf identically, and a body with no live contract at all", () => {
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
    // Prose only, no `## Acceptance` section: there is no live contract, so the
    // gate refuses (bug-done-gate-counts-checkboxes-inside-comment-blocks). This
    // USED to be "no checklist -> nothing to gate"; the reason it changed is
    // stated in the ADR and in `## Acceptance` below.
    claim(dir, plain.id);
    expect(acceptanceGate(itemOf(dir, plain.id).body)).toEqual({
      gated: true,
      reason: "no-live-contract",
    });
    expect(() => runUpdate({ cwd: dir, id: plain.id, status: "done", now: NOW })).toThrow(
      /live '## Acceptance' section has no acceptance criteria/,
    );
    expect(itemOf(dir, plain.id).status).toBe("in_progress");
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

  it("does not gate containers (their contract is the acceptance-aware cascade)", () => {
    const { dir } = primedTask();
    // Containers are exempt from the done gate whatever their body carries.
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
    // Real acceptance contracts on the containers: ticking the STORY's
    // criterion lets the cascade complete it; the epic's stays unticked.
    setBody(dir, "story-login", "## Acceptance\n\n- [ ] login shipped\n");
    setBody(dir, "auth", "## Acceptance\n\n- [ ] auth epic rolled up\n");
    tickFirstBox(dir, "story-login");
    claim(dir, id);
    runUpdate({ cwd: dir, id, status: "done", waive: WAIVE_REASON, now: NOW });
    expect(itemOf(dir, "story-login").status).toBe("done");
    // The epic keeps an unticked REAL criterion: the cascade must skip it.
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

describe("done gate: placeholders are not criteria (bug-empty-template-checkbox)", () => {
  it("scaffolds `## Acceptance` with no checkbox, and a fresh scaffold is refused as having no contract", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-done-gate-scaffold-"));
    runInit({ dir, force: false });
    const story = seedChain(dir, "story-s");
    const task = runCreate({
      cwd: dir,
      type: "task",
      title: "Scaffolded",
      parent: story,
      id: "scaffolded",
      now: NOW,
    });
    // No checkbox is scaffolded at all: the acceptance contract starts empty.
    expect(itemOf(dir, task.id).body).toMatch(/## Acceptance/);
    expect(itemOf(dir, task.id).body).not.toMatch(/^- \[.\]/m);
    // The whole-body question still reads "nothing outstanding" — and the gate
    // still refuses, because there is nothing published to be outstanding ABOUT
    // (bug-done-gate-counts-checkboxes-inside-comment-blocks). An item that has
    // published no contract does not get a free pass to `done`.
    expect(acceptanceComplete(itemOf(dir, task.id).body)).toBe(true);
    expect(acceptanceGate(itemOf(dir, task.id).body)).toEqual({
      gated: true,
      reason: "no-live-contract",
    });
    claim(dir, task.id);
    expect(() => runUpdate({ cwd: dir, id: task.id, status: "done", now: NOW })).toThrow(
      /live '## Acceptance' section has no acceptance criteria/,
    );
    expect(itemOf(dir, task.id).status).toBe("in_progress");
    // The honest path: write the criteria where the gate reads them.
    setBody(
      dir,
      task.id,
      "## Context\n\nKeep the gate honest.\n\n## Acceptance\n\n- [x] a real criterion\n",
    );
    expect(acceptanceGate(itemOf(dir, task.id).body).gated).toBe(false);
    expect(() => runUpdate({ cwd: dir, id: task.id, status: "done", now: NOW })).not.toThrow();
    expect(itemOf(dir, task.id).status).toBe("done");
  });

  it("a legacy placeholder-only body is refused for a missing contract, never for the box; a real criterion still refuses on the box", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-done-gate-placeholder-"));
    runInit({ dir, force: false });
    const story = seedChain(dir, "story-s");
    // The pre-fix scaffold shape: a bare empty box under ## Acceptance.
    const stale = runCreate({
      cwd: dir,
      type: "task",
      title: "Stale placeholder",
      parent: story,
      id: "stale-placeholder",
      body: "## Acceptance\n\n- [ ] \n",
      now: NOW,
    });
    // The carve-out (bug-empty-template-checkbox) survives intact and is asserted
    // separately below: the bare box is a ROW and it is NOT a criterion, so it is
    // never an unmet box in the refusal set…
    expect(acceptanceComplete(itemOf(dir, stale.id).body)).toBe(true);
    expect(liveAcceptanceUnchecked(itemOf(dir, stale.id).body)).toEqual([]);
    // …which leaves the missing contract as the only possible reason.
    expect(acceptanceGate(itemOf(dir, stale.id).body)).toEqual({
      gated: true,
      reason: "no-live-contract",
    });
    claim(dir, stale.id);
    expect(() => runUpdate({ cwd: dir, id: stale.id, status: "done", now: NOW })).toThrow(
      /live '## Acceptance' section has no acceptance criteria/,
    );
    expect(() =>
      runUpdate({ cwd: dir, id: stale.id, status: "done", waive: WAIVE_REASON, now: NOW }),
    ).not.toThrow();
    expect(itemOf(dir, stale.id).status).toBe("done");
    // The gate stays strict for REAL criteria: box + text still refuses.
    const real = runCreate({
      cwd: dir,
      type: "bug",
      title: "Real criterion",
      parent: story,
      id: "real-criterion",
      body: "## Acceptance\n\n- [ ] \n- [ ] repro fixed\n",
      now: NOW,
    });
    expect(acceptanceComplete(itemOf(dir, real.id).body)).toBe(false);
    claim(dir, real.id);
    expect(() => runUpdate({ cwd: dir, id: real.id, status: "done", now: NOW })).toThrow(
      /unchecked boxes[\s\S]*--waive "<reason>"/,
    );
    expect(itemOf(dir, real.id).status).toBe("in_progress");
  });

  it("a checklist filed as a comment is history: ticking it does not open the flip", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-done-gate-comment-"));
    runInit({ dir, force: false });
    const story = seedChain(dir, "story-s");
    const task = runCreate({
      cwd: dir,
      type: "task",
      title: "Commented contract",
      parent: story,
      id: "commented-contract",
      now: NOW,
    });
    runComment({
      cwd: dir,
      id: task.id,
      text: "Acceptance:\n\n- [ ] schema documented\n- [ ] round-trip tested\n",
      author: "coordinator",
      commit: false,
      now: NOW,
    });
    // The commented criteria are REAL rows in the body, so the whole-body
    // question still refuses…
    expect(acceptanceComplete(itemOf(dir, task.id).body)).toBe(false);
    claim(dir, task.id);
    // The gate's refusal names the missing contract, not the comment's boxes: a
    // message claiming "unchecked boxes" would point the author at history.
    expect(() => runUpdate({ cwd: dir, id: task.id, status: "done", now: NOW })).toThrow(
      /has no acceptance criteria/,
    );
    // …and the gate's question is the live section, which publishes nothing.
    expect(acceptanceGate(itemOf(dir, task.id).body)).toEqual({
      gated: true,
      reason: "no-live-contract",
    });
    // THE TRAP, stated: ticking every box in the comment record — the naive fix's
    // false pass — still does not open the flip.
    tickAcceptanceBody(dir, task.id);
    expect(acceptanceComplete(itemOf(dir, task.id).body)).toBe(true);
    expect(acceptanceGate(itemOf(dir, task.id).body)).toEqual({
      gated: true,
      reason: "no-live-contract",
    });
    expect(() => runUpdate({ cwd: dir, id: task.id, status: "done", now: NOW })).toThrow(
      /has no acceptance criteria/,
    );
    expect(itemOf(dir, task.id).status).toBe("in_progress");
    // The honest path is transcription: the live body is the contract, and the
    // dated block is left exactly as it is (history is never edited).
    setBody(
      dir,
      task.id,
      "## Acceptance\n\n- [x] schema documented\n- [x] round-trip tested\n\n## Notes\n\n### 2026-09-29 @coordinator\n\nAcceptance:\n\n- [x] schema documented\n- [x] round-trip tested\n",
    );
    expect(acceptanceGate(itemOf(dir, task.id).body).gated).toBe(false);
    runUpdate({ cwd: dir, id: task.id, status: "done", now: NOW });
    const item = itemOf(dir, task.id);
    expect(item.status).toBe("done");
    expect(item.body).not.toContain("### Waiver");
  });
});

// ---------------------------------------------------------------------------
// The LIVE acceptance section — the defect and its trap
// (bug-done-gate-counts-checkboxes-inside-comment-blocks)
// ---------------------------------------------------------------------------

/** A claimed task whose live `## Acceptance` section holds `criteria`. */
function taskWith(criteria: string, opts?: { id?: string }): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-done-gate-live-"));
  runInit({ dir, force: false });
  const story = seedChain(dir, "story-s");
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Live section",
    parent: story,
    id: opts?.id ?? "live-section",
    body: `## Context\n\nFixture.\n\n## Acceptance\n\n${criteria}\n`,
    now: NOW,
  });
  claim(dir, task.id);
  return { dir, id: task.id };
}

/** A claimed task whose body is exactly what `arggon create` scaffolds. */
function scaffoldedTask(): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-done-gate-scaffold-"));
  runInit({ dir, force: false });
  const story = seedChain(dir, "story-s");
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Scaffolded",
    parent: story,
    id: "scaffolded",
    now: NOW,
  });
  claim(dir, task.id);
  return { dir, id: task.id };
}

/** Append one dated comment block, exactly as `arggon comment` writes it. */
function datedComment(
  dir: string,
  id: string,
  text: string,
  opts?: { date?: string; author?: string },
): void {
  runComment({
    cwd: dir,
    id,
    text,
    author: opts?.author ?? "worker",
    commit: false,
    now: new Date(`${opts?.date ?? "2026-09-28"}T12:00:00Z`),
  });
}

/** The rows of the WHOLE body, for the shape assertions below. */
function acceptanceRowsOf(body: string): AcceptanceRow[] {
  return acceptanceRows(body);
}

describe("done gate: the live ## Acceptance section is the contract", () => {
  it("flips when the live section is satisfied and only a dated comment holds unticked boxes", () => {
    // THE DEFECT. The live section is ticked; the comment record carries the
    // ORIGINAL criteria, unticked, because a dated block is history and is never
    // edited. The gate used to count those boxes and refuse forever.
    const { dir, id } = taskWith("- [x] p95 under 100ms\n- [x] load test recorded");
    datedComment(
      dir,
      id,
      "Original criteria, quoted verbatim:\n\n- [ ] p95 under 100ms\n- [ ] load test recorded",
    );
    const body = itemOf(dir, id).body;
    // Preconditions, so this test cannot pass for the wrong reason: the whole-body
    // question still refuses, and the comment rows are still rows.
    expect(acceptanceComplete(body)).toBe(false);
    expect(acceptanceUnchecked(body).map((row) => row.text)).toEqual([
      "p95 under 100ms",
      "load test recorded",
    ]);
    expect(acceptanceGate(body)).toEqual({ gated: false });
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).not.toThrow();
    const item = itemOf(dir, id);
    expect(item.status).toBe("done");
    expect(item.body).not.toContain("### Waiver");
    // The flip rewrites no history: the dated block is still there, unticked.
    expect(item.body).toContain("### 2026-09-28 @worker");
    expect(item.body).toContain("- [ ] load test recorded");
  });

  it("refuses an unticked criterion in the LIVE section, whatever the comment record says", () => {
    // The negative control: the scan still reads the live section, so this is not
    // a gate that was switched off. The comment is fully ticked here, so a gate
    // asking only "is anything unticked ANYWHERE" would pass this item.
    const { dir, id } = taskWith("- [ ] p95 under 100ms\n- [x] load test recorded");
    datedComment(dir, id, "- [x] both criteria met");
    const body = itemOf(dir, id).body;
    expect(acceptanceGate(body)).toEqual({ gated: true, reason: "unchecked-live-criteria" });
    // Exactly the live row is the refusal set — the comment's ticked boxes and the
    // already-ticked sibling are not in it.
    expect(liveAcceptanceUnchecked(body).map((row) => row.text)).toEqual(["p95 under 100ms"]);
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).toThrow(
      /live '## Acceptance' section still has unchecked boxes/,
    );
    expect(itemOf(dir, id).status).toBe("in_progress");
    // The same item flips the moment that ONE live box is ticked, with the
    // comment's history still in place: proof the refusal was that box alone.
    setBody(dir, id, "## Acceptance\n\n- [x] p95 under 100ms\n- [x] load test recorded\n");
    expect(acceptanceGate(itemOf(dir, id).body).gated).toBe(false);
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).not.toThrow();
    expect(itemOf(dir, id).status).toBe("done");
  });

  it("refuses a template-placeholder section even when every comment box is ticked", () => {
    // THE TRAP. Scoping alone would let this flip: no unticked box is left
    // anywhere, so a naive "count boxes in the live section" gate reads it as
    // complete — with no acceptance contract at all.
    const { dir, id } = taskWith("<!-- The real acceptance criteria; tick each box when met. -->");
    datedComment(dir, id, "- [x] schema documented\n- [x] round-trip tested");
    const body = itemOf(dir, id).body;
    expect(acceptanceUnchecked(body)).toEqual([]);
    expect(acceptanceComplete(body)).toBe(true);
    expect(acceptanceGate(body)).toEqual({ gated: true, reason: "no-live-contract" });
    expect(() => runUpdate({ cwd: dir, id, status: "done", now: NOW })).toThrow(
      /has no acceptance criteria[\s\S]*Record the real criteria in that section/,
    );
    expect(itemOf(dir, id).status).toBe("in_progress");
  });

  it("every no-criteria shape refuses as `no-live-contract` — the rule has no gap to slip through", () => {
    // "Cannot be satisfied by accident" is the property under test: the three
    // plausible spellings of "no criteria" (absent, empty, template placeholder)
    // plus the bare-box scaffold all reduce to ONE predicate, so there is no
    // fourth shape that flips.
    const shapes: Array<[string, string]> = [
      ["no ## Acceptance section at all", "# Title\n\nJust prose.\n"],
      ["empty section", "## Acceptance\n\n\n## Notes\n"],
      ["whitespace-only section", "## Acceptance\n\n   \t  \n\n## Notes\n"],
      ["template placeholder", "## Acceptance\n\n<!-- The real acceptance criteria. -->\n"],
      ["only bare scaffold boxes", "## Acceptance\n\n- [ ]\n- [ ]\n"],
    ];
    for (const [name, body] of shapes) {
      expect(acceptanceGate(body), name).toEqual({ gated: true, reason: "no-live-contract" });
      expect(liveAcceptanceCriteria(body), name).toEqual([]);
    }
    // And a renamed section is not the acceptance section: `## Acceptance mapping`
    // is prose that happens to start with the word, so it cannot answer for the
    // contract (which is why the heading match is exact).
    expect(acceptanceGate("## Acceptance mapping\n\n- [x] a\n")).toEqual({
      gated: true,
      reason: "no-live-contract",
    });
    // The live section ends at the next heading of rank 1 or 2 — a criterion filed
    // under `## Notes` prose is not in the contract either.
    expect(acceptanceGate("## Acceptance\n\n- [x] a\n\n## Notes\n\n- [ ] still open\n")).toEqual({
      gated: false,
    });
  });

  it("a bare `- [ ]` stays a scaffold row: never an unmet criterion, never a false pass", () => {
    // bug-empty-template-checkbox, preserved. A box with no text after it is a
    // placeholder (convention.md §Done gate), so it must not appear in the refusal
    // set — and a section carrying one alongside a real, ticked criterion must
    // still flip.
    const withReal = taskWith("- [ ]\n- [x] p95 under 100ms");
    const body = itemOf(withReal.dir, withReal.id).body;
    expect(acceptanceRowsOf(body)).toHaveLength(2);
    expect(liveAcceptanceCriteria(body)).toHaveLength(1);
    expect(liveAcceptanceUnchecked(body)).toEqual([]);
    expect(acceptanceGate(body)).toEqual({ gated: false });
    expect(() =>
      runUpdate({ cwd: withReal.dir, id: withReal.id, status: "done", now: NOW }),
    ).not.toThrow();
    expect(itemOf(withReal.dir, withReal.id).status).toBe("done");
    // On its own it is still a section with no criteria — refused for the missing
    // contract, never reported as an unchecked box.
    const bare = taskWith("- [ ]\n");
    expect(liveAcceptanceUnchecked(itemOf(bare.dir, bare.id).body)).toEqual([]);
    expect(acceptanceGate(itemOf(bare.dir, bare.id).body)).toEqual({
      gated: true,
      reason: "no-live-contract",
    });
    expect(() => runUpdate({ cwd: bare.dir, id: bare.id, status: "done", now: NOW })).toThrow(
      /has no acceptance criteria/,
    );
  });

  it("--waive remains the escape for BOTH refusals, and records its dated section", () => {
    const noContract = taskWith("<!-- The real acceptance criteria. -->");
    runUpdate({
      cwd: noContract.dir,
      id: noContract.id,
      status: "done",
      waive: WAIVE_REASON,
      now: NOW,
    });
    expect(itemOf(noContract.dir, noContract.id).body).toMatch(
      /### Waiver 2026-09-29\n\naccepted as-is by coordinator\n$/,
    );
    const unchecked = taskWith("- [ ] p95 under 100ms", { id: "live-unchecked" });
    runUpdate({
      cwd: unchecked.dir,
      id: unchecked.id,
      status: "done",
      waive: WAIVE_REASON,
      now: NOW,
    });
    expect(itemOf(unchecked.dir, unchecked.id).status).toBe("done");
    // …and the waiver never ticks anything: the record stays honest.
    expect(liveAcceptanceUnchecked(itemOf(unchecked.dir, unchecked.id).body)).toHaveLength(1);
  });

  it("a nested `### Acceptance` pasted into a comment is history, not a second contract", () => {
    // A reporter who pastes a whole item shape into a comment brings its own
    // `##`/`###` headings with it. Comment blocks run to the next dated heading,
    // so that content stays history — and a comment-supplied `## Acceptance`
    // cannot stand in for the missing live section either.
    const { dir, id } = taskWith("- [x] real criterion");
    datedComment(dir, id, "### Acceptance\n\n- [ ] criterion from the report\n");
    const body = itemOf(dir, id).body;
    expect(acceptanceGate(body)).toEqual({ gated: false });
    expect(liveAcceptanceUnchecked(body)).toEqual([]);

    const fresh = scaffoldedTask();
    setBody(
      fresh.dir,
      fresh.id,
      "## Context\n\nx\n\n## Notes\n\n### 2026-09-28 @worker\n\n## Acceptance\n\n- [x] from the comment\n",
    );
    expect(acceptanceGate(itemOf(fresh.dir, fresh.id).body)).toEqual({
      gated: true,
      reason: "no-live-contract",
    });
    expect(() => runUpdate({ cwd: fresh.dir, id: fresh.id, status: "done", now: NOW })).toThrow(
      /has no acceptance criteria/,
    );
  });

  it("CRLF and U+2028 bodies are read like LF: the section boundary is a LineTerminator set", () => {
    // The row parser splits on the whole ECMAScript LineTerminator set, and the
    // section extractor reuses that split — so a CRLF item's `## Acceptance`
    // heading is still recognised (no `\r` is left on the line) and a
    // U+2028-separated criterion after a ticked one is still read.
    const crlf =
      "# T\r\n\r\n## Acceptance\r\n\r\n- [x] a\r\n- [ ] b\r\n\r\n## Notes\r\n\r\n### 2026-09-28 @w\r\n\r\n- [ ] history\r\n";
    expect(acceptanceGate(crlf)).toEqual({ gated: true, reason: "unchecked-live-criteria" });
    expect(liveAcceptanceUnchecked(crlf).map((row) => row.text)).toEqual(["b"]);
    const u2028 = "## Acceptance\u2028\u2028- [x] a\u2028- [ ] b\n";
    expect(acceptanceGate(u2028)).toEqual({ gated: true, reason: "unchecked-live-criteria" });
    expect(liveAcceptanceUnchecked(u2028).map((row) => row.text)).toEqual(["b"]);
  });

  it("containers are still exempt: their contract is the acceptance-aware cascade", () => {
    const { dir } = taskWith("- [x] a criterion");
    runUpdate({ cwd: dir, id: "story-s", status: "in_progress", assignee: "worker", now: NOW });
    // No live criteria at all, and the flip still goes through: a container is
    // never gated here, so scoping and the missing-contract refusal stay on leaves.
    expect(acceptanceGate(itemOf(dir, "story-s").body).gated).toBe(true);
    expect(() => runUpdate({ cwd: dir, id: "story-s", status: "done", now: NOW })).not.toThrow();
    expect(itemOf(dir, "story-s").status).toBe("done");
  });
});

/** Tick every unchecked checkbox in ONE item's body (test-local, like test/acceptance.ts). */
function tickAcceptanceBody(dir: string, id: string): void {
  const filePath = itemOf(dir, id).filePath;
  writeFileSync(
    filePath,
    readFileSync(filePath, "utf8").replace(/^([ \t]*[-*] \[) (\])/gm, "$1x]"),
    "utf8",
  );
}
