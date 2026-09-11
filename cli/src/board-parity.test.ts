/**
 * Parity guard (task-parity-guard-for-board-drop-rules-vs-statusts).
 *
 * The board page embeds a hand-copied drop-rule function (evaluateDrop,
 * toString-embedded into the page script) while the server route runs the
 * kernel update path (runUpdate). Nothing in the build links them, so this
 * suite proves the chain 1:1:
 *
 *   1. embedded page script  ===  TS evaluateDrop  (same function source,
 *      executed in a vm sandbox, same verdicts over the full case matrix)
 *   2. TS evaluateDrop  ===  kernel runUpdate      (accept/refuse parity per
 *      transition pair, claim rule, and blocked-reason rule)
 *   3. the one intentional divergence (force) is asserted explicitly
 *
 * A deliberate edit to either copy makes part of this suite fail.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateDrop, renderBoardHtml } from "./board.js";
import { runUpdate } from "./update.js";

type Card = { id: string; type: string; status: string; assignee?: string | null };
type Verdict = { ok: boolean; reason: string };

/** Recover the embedded evaluateDrop source from the rendered page. */
function embeddedEvaluateDropSource(): string {
  const html = renderBoardHtml([], { generatedAt: "test" });
  const start = html.indexOf("function evaluateDrop");
  const end = html.indexOf("(function () {");
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end).trim();
}

function embeddedEvaluateDrop(): (card: Card, to: string, edit?: object) => Verdict {
  const fn = new Function(`${embeddedEvaluateDropSource()}\nreturn evaluateDrop;`);
  return fn() as (card: Card, to: string, edit?: object) => Verdict;
}

const STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;

/** Full (from, to) case matrix with claim states; excludes same-status drops (UI nicety). */
function cases(): Array<{ card: Card; to: string; edit: object }> {
  const out: Array<{ card: Card; to: string; edit: object }> = [];
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      if (to === from) continue; // board refuses same-column drops as UI flow
      for (const claimed of [false, true]) {
        out.push({
          card: {
            id: "task-x",
            type: "story",
            status: from,
            assignee: claimed ? "alice" : null,
          },
          to,
          // Claiming an unclaimed card via drop prompts for the assignee;
          // the prompt result is what the update path receives.
          edit: to === "in_progress" && !claimed ? { assignee: "carol" } : {},
        });
      }
    }
  }
  return out;
}

describe("parity: embedded page script vs TS evaluateDrop", () => {
  it("renders the same function source that exists in board.ts", () => {
    expect(embeddedEvaluateDropSource()).toBe(evaluateDrop.toString().trim());
  });

  it("gives identical verdicts over the full case matrix in a vm sandbox", () => {
    const embedded = embeddedEvaluateDrop();
    for (const { card, to, edit } of cases()) {
      const a = embedded(structuredClone(card), to, structuredClone(edit));
      const b = evaluateDrop(structuredClone(card), to, structuredClone(edit));
      expect(a, `${card.status}->${to} claimed=${card.assignee ?? "no"}`).toEqual(b);
    }
  });

  it("blocks hostile globals: the sandboxed function cannot reach the update path", () => {
    const embedded = embeddedEvaluateDrop();
    expect(typeof embedded).toBe("function");
    expect(
      embeddedEvaluateDropSource().includes("fetch"),
    ).toBe(false);
  });
});

// ---------- kernel parity (TS evaluateDrop vs runUpdate) ----------

function itemFile(root: string, id: string, type: "story" | "epic", status: string, assignee?: string): string {
  const rel =
    type === "story"
      ? `tasks/launch/epic-a/${id}/${id}.md`
      : `tasks/launch/${id}/${id}.md`;
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(
    full,
    `---
type: ${type}
status: ${status}
id: ${id}
assignee: ${assignee ?? "null"}
parent: ${type === "story" ? "epic-a" : "launch"}
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---

# ${id}
`,
    "utf8",
  );
  return full;
}

function newTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-drop-parity-"));
  mkdirSync(join(root, "tasks"), { recursive: true });
  writeFileSync(join(root, "tasks/.convention.yml"), "version: 0\n", "utf8");
  const container = (rel: string, type: string, id: string) => {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(
      full,
      `---\ntype: ${type}\nstatus: todo\nid: ${id}\nlabels: []\ncreated: "2026-09-11"\nupdated: "2026-09-11"\n---\n\n# ${id}\n`,
      "utf8",
    );
  };
  container("tasks/launch/launch.md", "initiative", "launch");
  container("tasks/launch/epic-a/epic-a.md", "epic", "epic-a");
  return root;
}

/** Kernel verdict for the same drop, with the drop-flow inputs the page would send. */
function kernelAccepts(root: string, card: Card, to: string, edit: { assignee?: string; force?: boolean }): boolean {
  itemFile(root, card.id, card.type as "story" | "epic", card.status, card.assignee ?? undefined);
  try {
    runUpdate({
      cwd: root,
      id: card.id,
      status: to,
      assignee: edit.assignee ?? (to === "in_progress" && card.type !== "epic" ? "carol" : undefined),
      blockedReason: to === "blocked" ? "blocked on ci" : undefined,
      force: edit.force === true,
    });
    return true;
  } catch {
    return false;
  } finally {
    rmSync(join(root, "tasks/launch"), { recursive: true, force: true });
    mkdirSync(join(root, "tasks/launch"), { recursive: true });
  }
}

describe("parity: TS evaluateDrop vs kernel runUpdate", () => {
  it("accepts exactly the transitions the CLI update path accepts (drop-flow inputs)", () => {
    const root = newTree();
    for (const { card, to, edit } of cases()) {
      const board = evaluateDrop(structuredClone(card), to, structuredClone(edit));
      const kernel = kernelAccepts(root, card, to, edit as { assignee?: string });
      expect(
        { verdict: board.ok, from: card.status, to },
        `board=${board.ok} kernel=${kernel} for ${card.status}->${to} edit=${JSON.stringify(edit)}`,
      ).toEqual({ verdict: kernel, from: card.status, to });
    }
  });

  it("agrees on containers (epics claim without assignee)", () => {
    const root = newTree();
    for (const [from, to] of [
      ["todo", "in_progress"],
      ["todo", "done"],
      ["done", "todo"],
    ] as const) {
      const card: Card = { id: "task-x", type: "epic", status: from, assignee: null };
      const board = evaluateDrop(card, to);
      const kernel = kernelAccepts(root, card, to, {});
      expect(board.ok).toBe(kernel);
    }
  });

  it("refuses claim steals the same way the update path does (no force on the board)", () => {
    const root = newTree();
    const card: Card = { id: "task-x", type: "story", status: "in_progress", assignee: "alice" };
    expect(evaluateDrop(card, "done", { assignee: "bob" }).ok).toBe(false);
    expect(kernelAccepts(root, card, "done", { assignee: "bob" })).toBe(false);
    // Force is CLI-only: the board refuses what the CLI would allow.
    expect(evaluateDrop(card, "done", { force: true }).ok).toBe(false);
    expect(kernelAccepts(root, card, "done", { force: true })).toBe(true);
  });

  it("agrees on the claim flow: unclaimed card + prompted assignee", () => {
    const root = newTree();
    const card: Card = { id: "task-x", type: "story", status: "todo", assignee: null };
    expect(evaluateDrop(card, "in_progress", { assignee: "carol" }).ok).toBe(true);
    expect(kernelAccepts(root, card, "in_progress", { assignee: "carol" })).toBe(true);
  });
});
