import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { canTransition, loadItems, runUpdate, STATUSES } from "@arggondev/lib";

import { evaluateDrop } from "./board.js";
import { tuiActionVerdict, tuiLegalMoves, type TuiActionItem } from "./tui.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtemp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/**
 * Three-way parity pin for the TUI action rules (task-tui-actions-parity,
 * spec-tui-actions-014): the TUI mirror (tuiActionVerdict) ≡ the served
 * board's mirror (evaluateDrop, force always false — the TUI cannot carry
 * one) ≡ the kernel transition table, with runUpdate's observable
 * accept/refuse on a real fixture as the fourth witness for the cases the
 * table cannot see (claim conflict, blocked reason).
 */

/** The status × claim-shape matrix every implementation must agree on. */
const ITEMS: TuiActionItem[] = STATUSES.flatMap((status) => [
  { id: "task-x", type: "task", status, assignee: null },
  { id: "task-x", type: "task", status, assignee: "mia" },
  { id: "epic-x", type: "epic", status, assignee: null },
  { id: "epic-x", type: "epic", status, assignee: "kim" },
]) as TuiActionItem[];

/** The edits the flows can construct (never force). */
const EDITS: Array<{ assignee?: string | null }> = [
  {},
  { assignee: null },
  { assignee: "mia" },
  { assignee: "kim" },
];

describe("tuiActionVerdict ≡ evaluateDrop ≡ kernel TRANSITIONS (task-tui-actions-parity)", () => {
  it("agrees for every status × target × claim shape", () => {
    for (const item of ITEMS) {
      for (const to of STATUSES) {
        for (const edit of EDITS) {
          const tui = tuiActionVerdict(item, to, edit);
          const board = evaluateDrop(item, to, { ...edit, force: false });
          const table = canTransition(item.status, to === item.status ? item.status : to);
          // Same verdict ...
          expect(
            [tui.ok, tui.reason],
            `${item.type}/${item.status}->${to}/${JSON.stringify(edit)}`,
          ).toEqual([board.ok, board.reason]);
          // ... and both mirror the kernel transition table for the
          // transition-shaped refusals (the claim rules are extra rules on
          // top: they can only refuse a table-legal move, never allow an
          // illegal one).
          if (!table) expect(tui.ok, `${item.status}->${to}`).toBe(false);
        }
      }
    }
  });

  it("refuses force on sight (the TUI never constructs one)", () => {
    // Same refusal DECISION as the board mirror; the wording names its own
    // surface (the TUI), so only the verdict is pinned here.
    const verdict = tuiActionVerdict(
      { id: "task-x", type: "task", status: "todo", assignee: null },
      "in_progress",
      { force: true },
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain("without force");
    expect(
      evaluateDrop({ id: "task-x", type: "task", status: "todo", assignee: null }, "in_progress", {
        force: true,
      }).ok,
    ).toBe(false);
  });

  it("the menu lists exactly the kernel-legal targets, current status excluded", () => {
    for (const status of STATUSES) {
      const item: TuiActionItem = { id: "task-x", type: "task", status, assignee: null };
      expect(tuiLegalMoves(item)).toEqual(
        STATUSES.filter((s) => s !== status && canTransition(status, s)),
      );
    }
  });
});

/**
 * Live witness: runUpdate's observable accept/refuse on a real fixture for
 * the cases the pure mirrors reason about. The kernel is the second gate —
 * these cases prove the gate actually stands behind the mirror.
 */
describe("runUpdate witness (task-tui-actions-parity)", () => {
  function fixture(items: Array<Record<string, string>>): string {
    const root = mkdtemp("arggon-tui-actions-");
    mkdirSync(join(root, "tasks/x"), { recursive: true });
    writeFileSync(join(root, "tasks/.convention.yml"), "version: 0\n", "utf8");
    for (const item of items) {
      const dir = join(root, "tasks/x");
      writeFileSync(
        join(dir, `${item.id}.md`),
        `---\n${Object.entries(item)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}\nlabels: []\ncreated: "2026-09-30"\nupdated: "2026-09-30"\n---\n\nbody\n`,
        "utf8",
      );
    }
    return root;
  }

  it("accepts the moves the verdicts allow and refuses the ones they refuse", () => {
    const root = fixture([
      {
        type: "task",
        status: "todo",
        id: "task-open",
        title: "Open",
      },
      {
        type: "task",
        status: "todo",
        id: "task-second",
        title: "Second",
      },
    ]);

    // todo -> in_progress (the claim): verdict allows, kernel accepts.
    expect(
      tuiActionVerdict(
        { id: "task-open", type: "task", status: "todo", assignee: null },
        "in_progress",
        { assignee: "mia" },
      ).ok,
    ).toBe(true);
    const claimed = runUpdate({
      cwd: root,
      id: "task-open",
      status: "in_progress",
      assignee: "mia",
    });
    expect(claimed.item.status).toBe("in_progress");
    expect(claimed.item.assignee).toBe("mia");

    // Claim conflict: the mirror refuses the table-legal-but-taken move (the
    // same-status rule names it first for to == status); the kernel refuses
    // the reassignment with its own claim-conflict wording. Both refuse.
    const conflict = tuiActionVerdict(
      { id: "task-open", type: "task", status: "in_progress", assignee: "mia" },
      "in_progress",
      { assignee: "kim" },
    );
    expect(conflict.ok).toBe(false);
    expect(conflict.reason).toContain("already in that column");
    expect(() =>
      runUpdate({ cwd: root, id: "task-open", status: "in_progress", assignee: "kim" }),
    ).toThrow(/claim conflict/);

    // in_progress -> blocked is table-legal for the mirrors (the reason
    // prompt is flow UI); the KERNEL refuses without a reason — the second
    // gate.
    runUpdate({ cwd: root, id: "task-second", status: "in_progress", assignee: "kim" });
    expect(
      tuiActionVerdict(
        { id: "task-second", type: "task", status: "in_progress", assignee: "kim" },
        "blocked",
        {},
      ).ok,
    ).toBe(true);
    expect(() => runUpdate({ cwd: root, id: "task-second", status: "blocked" })).toThrow(
      /--blocked-reason/,
    );
    const blocked = runUpdate({
      cwd: root,
      id: "task-second",
      status: "blocked",
      blockedReason: "waiting on credentials",
    });
    expect(blocked.item.status).toBe("blocked");
    expect(blocked.item.blockedReason).toBe("waiting on credentials"); // kernel field name

    // Illegal transition: mirrors and kernel refuse with the same shape.
    const illegal = tuiActionVerdict(
      { id: "task-second", type: "task", status: "blocked", assignee: "kim" },
      "done",
      {},
    );
    expect(illegal.ok).toBe(false);
    expect(illegal.reason).toContain("cannot transition blocked -> done");
    expect(() => runUpdate({ cwd: root, id: "task-second", status: "done" })).toThrow(
      /cannot transition status blocked -> done/,
    );
  });

  it("containers move without an assignee (the claim rule is claimable-only)", () => {
    const root = fixture([{ type: "epic", status: "todo", id: "epic-a", title: "Epic" }]);
    expect(
      tuiActionVerdict(
        { id: "epic-a", type: "epic", status: "todo", assignee: null },
        "in_progress",
        {},
      ).ok,
    ).toBe(true);
    const moved = runUpdate({ cwd: root, id: "epic-a", status: "in_progress" });
    expect(moved.item.status).toBe("in_progress");
    expect(moved.item.assignee ?? null).toBeNull();
  });

  it("a stale flow (the tree moved under the open menu) is refused by the kernel", () => {
    const root = fixture([{ type: "task", status: "todo", id: "task-gone", title: "Gone" }]);
    const verdict = tuiActionVerdict(
      { id: "task-gone", type: "task", status: "todo", assignee: null },
      "in_progress",
      { assignee: "mia" },
    );
    expect(verdict.ok).toBe(true);
    const real = loadItems(join(root, "tasks")).find((item) => item.id === "task-gone");
    expect(real).toBeDefined();
    // Another writer wins the race while the flow is open.
    runUpdate({ cwd: root, id: "task-gone", status: "cancelled" });
    // Applying the flow's menu choice now (todo -> in_progress) hits an item
    // whose status is cancelled: kernel refusal, which the loop surfaces as
    // footer text.
    expect(() =>
      runUpdate({ cwd: root, id: "task-gone", status: "in_progress", assignee: "mia" }),
    ).toThrow(/cannot transition status cancelled -> in_progress/);
  });
});
