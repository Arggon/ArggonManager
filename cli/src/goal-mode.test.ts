/**
 * ZCode goal-mode contract (spec methodology-adapters-017 §S5,
 * task-zcode-goal-mode): the objective + verification contract is DERIVED from
 * one claimed item's acceptance checklist, and the hard boundaries (one goal per
 * claimed item, one worktree per item) hold on the rendered output.
 *
 * The refusals are asserted against real trees (init + claim + a recorded
 * worktree path), not mocks: the whole point of the boundaries is that they
 * fire in the shape an agent actually hits them.
 */
import { mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate, runShow, runUpdate } from "@arggondev/lib";
import { runInit } from "./init.js";
import {
  GOAL_TEMPLATE_REL,
  MAX_GOAL_CONTRACT_BYTES,
  MAX_GOAL_TEMPLATE_BYTES,
  deriveGoal,
  goalOperation,
  runGoal,
  type GoalContract,
} from "./goal-mode.js";
import { tickAcceptance } from "../../test/acceptance.js";

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

const NOW = new Date("2026-10-02T12:00:00Z");
const FRONTMATTER_END = "\n---\n";

/** Replace everything after the frontmatter terminator (body is fixture text). */
function writeBody(dir: string, id: string, body: string): void {
  const raw = readFileSync(runShow({ cwd: dir, id }).path, "utf8");
  const sep = raw.indexOf(FRONTMATTER_END);
  if (sep < 0) throw new Error("goal-mode fixture: no frontmatter terminator");
  writeFileSync(
    runShow({ cwd: dir, id }).path,
    raw.slice(0, sep + FRONTMATTER_END.length) + body,
    "utf8",
  );
}

/** Stamp `worktree_path` into the item's frontmatter (fixture-only edit). */
function writeWorktreePath(dir: string, id: string, worktreePath: string): void {
  const path = runShow({ cwd: dir, id }).path;
  const raw = readFileSync(path, "utf8");
  const sep = raw.indexOf(FRONTMATTER_END);
  const front = raw.slice(0, sep);
  const replaced = /worktree_path:.*$/m.test(front)
    ? front.replace(/worktree_path:.*$/m, `worktree_path: ${worktreePath}`)
    : `${front}\nworktree_path: ${worktreePath}`;
  writeFileSync(path, `${replaced}${raw.slice(sep)}`, "utf8");
}

/** A primed tree with one task carrying the given acceptance rows. */
function treeWithTask(
  acceptance: string,
  opts?: { assignee?: string; status?: string },
): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-goal-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Platform", parent: "launch", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Seam", parent: "platform", id: "story-seam" });
  const { id } = runCreate({
    cwd: dir,
    type: "task",
    title: "Ship the goal contract",
    parent: "story-seam",
    id: "goal-contract",
  });
  writeBody(
    dir,
    id,
    `# Ship the goal contract\n\n## Context\n\nFixture.\n\n## Acceptance\n\n${acceptance}\n\n## Notes\n`,
  );
  if (opts?.assignee !== undefined || opts?.status !== undefined) {
    runUpdate({
      cwd: dir,
      id,
      status: opts?.status ?? "in_progress",
      assignee: opts?.assignee ?? "Arggon",
      now: NOW,
    });
  }
  return { dir, id };
}

describe("deriveGoal (pure derivation from the acceptance checklist)", () => {
  const rows = [
    { text: "template generation test", checked: false },
    { text: "goal contract parses the checklist", checked: false },
    { text: "documented: one goal per claimed item", checked: false },
    { text: "already done", checked: true },
  ];

  it("takes ONE goal from the first unchecked box and verifies against them all", () => {
    const goal = deriveGoal(rows);
    expect(goal.objective).toBe("template generation test");
    expect(goal.verification).toEqual([
      "template generation test",
      "goal contract parses the checklist",
      "documented: one goal per claimed item",
    ]);
    expect(goal.checklist).toEqual({ total: 4, unchecked: 3, checked: 1 });
    expect(goal.truncated).toBe(false);
  });

  it("skips empty boxes (scaffold placeholders are not criteria)", () => {
    const goal = deriveGoal([
      { text: "", checked: false },
      { text: "  ", checked: false },
      { text: "a real criterion", checked: false },
    ]);
    expect(goal.objective).toBe("a real criterion");
    expect(goal.checklist.unchecked).toBe(1);
  });

  it("yields an explicit define-the-goal-first shape, never an empty goal", () => {
    for (const candidate of [
      [],
      [{ text: "", checked: false }],
      [{ text: "all ticked", checked: true }],
    ]) {
      const goal = deriveGoal(candidate);
      expect(goal.objective).toMatch(/DEFINE THE GOAL FIRST/);
      expect(goal.objective.length).toBeGreaterThan(40);
      expect(goal.verification[0]).toMatch(/cannot start until/);
    }
  });

  it("stays bounded on a tampered oversized item (clipped lines, counted overflow)", () => {
    const huge = "x".repeat(200_000);
    const goal = deriveGoal(
      Array.from({ length: 40 }, (_, i) => ({ text: `${i}: ${huge}`, checked: false })),
    );
    expect(goal.verification).toHaveLength(8);
    expect(goal.verificationOmitted).toBe(32);
    expect(goal.truncated).toBe(true);
    for (const line of goal.verification) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(200);
    }
    expect(Buffer.byteLength(goal.objective, "utf8")).toBeLessThanOrEqual(240);
  });
});

describe("runGoal (rendered contract from a real item)", () => {
  it("fills the generated template's slots from the item's checklist", () => {
    const { dir, id } = treeWithTask(
      "- [ ] template generation test\n- [ ] goal contract parses the checklist\n- [x] already done",
      { assignee: "Arggon" },
    );
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.objective).toBe("template generation test");
    expect(result.goal.verification).toEqual([
      "template generation test",
      "goal contract parses the checklist",
    ]);
    // Every slot is filled; none is left behind.
    expect(result.contract).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(result.contract).toContain("## Objective (exactly one)");
    expect(result.goal.template).toBe("adopter");
    expect(result.goal.identity).toBe("Arggon");
  });

  it("states the one-item / one-worktree boundaries in the rendered contract", () => {
    const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
    const { contract, goal } = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(goal.boundaries.join("\n")).toMatch(/One goal, one CLAIMED item/);
    expect(goal.boundaries.join("\n")).toMatch(/One worktree per item/);
    expect(goal.boundaries.join("\n")).toMatch(/Never another item's worktree/);
    expect(contract).toContain("## Boundaries (hard)");
    expect(contract).toContain("## Refusals (stop and report");
    expect(contract).toContain("The kernel is the enforcement of record");
    // The reviewer backstop is named, not routed around.
    expect(contract).toContain("reviewer dispatch in flight is read-only");
  });

  it("keeps the boundaries when the adopter's template copy is stripped down", () => {
    const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
    writeFileSync(
      join(dir, ...GOAL_TEMPLATE_REL.split("/")),
      "---\ndescription: mine\n---\ndo {{GOAL_OBJECTIVE}}\n",
      "utf8",
    );
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.contract).toContain("One goal, one CLAIMED item");
    expect(result.contract).toContain("Never another item's worktree");
  });

  it("bounds a tampered oversized template copy, boundaries included", () => {
    const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
    writeFileSync(
      join(dir, ...GOAL_TEMPLATE_REL.split("/")),
      `${"#".repeat(MAX_GOAL_TEMPLATE_BYTES * 2)}\n{{GOAL_OBJECTIVE}}`,
      "utf8",
    );
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(Buffer.byteLength(result.contract, "utf8")).toBeLessThanOrEqual(MAX_GOAL_CONTRACT_BYTES);
    // The cap shrinks adopter prose, never the appended hard rules.
    expect(result.contract).toContain("## Boundaries (hard)");
    expect(result.contract).toContain("Never another item's worktree");
    expect(result.contract.endsWith("not from the template file.\n")).toBe(true);
  });

  it("refuses an unclaimed item, a foreign claim, and a closed item", () => {
    const unclaimed = treeWithTask("- [ ] one goal");
    expect(() => runGoal({ cwd: unclaimed.dir, id: unclaimed.id, login: "Arggon" })).toThrow(
      /no claim/,
    );
    const foreign = treeWithTask("- [ ] one goal", { assignee: "Someone-else" });
    expect(() => runGoal({ cwd: foreign.dir, id: foreign.id, login: "Arggon" })).toThrow(
      /claimed by 'Someone-else'/,
    );
    const done = treeWithTask("- [x] shipped", { assignee: "Arggon" });
    tickAcceptance(done.dir, done.id);
    runUpdate({ cwd: done.dir, id: done.id, status: "done", now: NOW });
    expect(() => runGoal({ cwd: done.dir, id: done.id, login: "Arggon" })).toThrow(
      /never reopened/,
    );
  });

  it("refuses to run outside the item's worktree, and when it no longer exists", () => {
    const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
    const other = mkdtempSync(join(tmpdir(), "arggon-goal-other-"));
    writeWorktreePath(dir, id, other);
    expect(() => runGoal({ cwd: dir, id, login: "Arggon" })).toThrow(/never spans worktrees/);
    rmSync(other, { recursive: true, force: true });
    expect(() => runGoal({ cwd: dir, id, login: "Arggon" })).toThrow(/no longer exists/);
  });

  it("falls back to the packaged template when the adopter copy is absent", () => {
    const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
    rmSync(join(dir, ...GOAL_TEMPLATE_REL.split("/")));
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.template).toBe("package");
    expect(result.contract).toContain("## Objective (exactly one)");
    expect(result.contract).toContain("one goal");
  });

  it("reports an unresolved caller identity instead of pretending to know it", () => {
    const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
    const result = runGoal({ cwd: dir, id, login: "" });
    expect(result.goal.identity).toBeNull();
    expect(result.contract).toContain("could not be resolved");
  });
});

describe("goalOperation (json envelope)", () => {
  it("emits the documented success shape with bounded fields", () => {
    const { dir, id } = treeWithTask("- [ ] one goal\n- [ ] two goals", { assignee: "Arggon" });
    const outcome = goalOperation({ cwd: dir, id, login: "Arggon" });
    expect(outcome.ok).toBe(true);
    expect(outcome.exitCode).toBe(0);
    const envelope = outcome.envelope as unknown as Record<string, unknown>;
    expect(envelope.command).toBe("goal");
    expect(envelope.schemaVersion).toBe(1);
    const goal = envelope.goal as GoalContract & { contract: string };
    expect(goal.objective).toBe("one goal");
    expect(goal.verification).toEqual(["one goal", "two goals"]);
    expect(goal.boundaries.length).toBeGreaterThan(3);
    expect(Buffer.byteLength(goal.contract, "utf8")).toBeLessThanOrEqual(MAX_GOAL_CONTRACT_BYTES);
  });

  it("emits ok:false with the refusal code and exit 1", () => {
    const { dir, id } = treeWithTask("- [ ] one goal");
    const outcome = goalOperation({ cwd: dir, id, login: "Arggon" });
    expect(outcome.ok).toBe(false);
    expect(outcome.exitCode).toBe(1);
    const envelope = outcome.envelope as unknown as Record<string, unknown>;
    expect((envelope.error as { code?: string }).code).toBe("GOAL_UNCLAIMED");
    expect(envelope.goal).toBeUndefined();
  });

  it("turns a fully ticked checklist into the define-the-goal-first shape", () => {
    const { dir, id } = treeWithTask("- [ ] one goal\n- [ ] two goals", { assignee: "Arggon" });
    tickAcceptance(dir, id);
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.objective).toMatch(/DEFINE THE GOAL FIRST/);
    expect(result.goal.verificationOmitted).toBe(0);
  });
});
