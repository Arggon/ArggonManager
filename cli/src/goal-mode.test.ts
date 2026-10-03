/**
 * ZCode goal-mode contract (spec methodology-adapters-017 §S5,
 * task-zcode-goal-mode): the objective + verification contract is DERIVED from
 * one claimed item's acceptance checklist, and the hard boundaries (one goal per
 * claimed item, one worktree per item) hold on the rendered output.
 *
 * Two properties carry this command, and both are asserted here:
 *
 *  1. **The goal never inverts the done gate.** `acceptanceComplete` (the
 *     kernel predicate a `done` flip is refused by) decides whether work
 *     remains; the row parser only supplies text. The PARITY CORPUS walks the
 *     shapes where the two line regexes historically disagreed (CRLF, `- [ ]x`
 *     with no space, `*` bullets, indentation, empty boxes, tabs) and asserts
 *     `goal.hasGoal === !acceptanceComplete(body)` for every one of them.
 *  2. **The refusals hold on real trees** (init + claim + a recorded
 *     `worktree_path`), not mocks, and every documented code is asserted —
 *     a refusal that is not asserted is a refusal that can rot.
 *
 * `bug-three-acceptance-parsers-diverging` owns unifying the parsers; until it
 * lands, this corpus is what keeps the adapter honest.
 */
import {
  mkdtempSync as _mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acceptanceComplete, runComment, runCreate, runShow, runUpdate } from "@arggondev/lib";
import { runInit } from "./init.js";
import { parseAcceptanceRows } from "./board.js";
import { normalizeEol } from "./docs.js";
import {
  GOAL_TEMPLATE_REL,
  MAX_GOAL_CONTRACT_BYTES,
  MAX_GOAL_PROSE_BYTES,
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
  const path = runShow({ cwd: dir, id }).path;
  const raw = readFileSync(path, "utf8");
  const sep = raw.indexOf(FRONTMATTER_END);
  if (sep < 0) throw new Error("goal-mode fixture: no frontmatter terminator");
  writeFileSync(path, raw.slice(0, sep + FRONTMATTER_END.length) + body, "utf8");
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
  opts?: { assignee?: string; status?: string; eol?: "\n" | "\r\n" },
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
  const body = `# Ship the goal contract\n\n## Context\n\nFixture.\n\n## Acceptance\n\n${acceptance}\n\n## Notes\n`;
  writeBody(dir, id, opts?.eol === "\r\n" ? body.replaceAll("\n", "\r\n") : body);
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

/**
 * The derivation as `runGoal` performs it, for the pure corpus matrix. It takes
 * the WHOLE item body (what the done gate reads) — passing a trimmed/filtered
 * body here would test a different question, which is exactly how the round-2
 * defect survived: the verdict was the right predicate on the wrong input.
 */
function deriveAsRun(body: string): ReturnType<typeof deriveGoal> {
  return deriveGoal(parseAcceptanceRows(normalizeEol(body)), !acceptanceComplete(body));
}

/** One `arggon comment` section, as `runComment` appends it. */
function comment(text: string, date = "2026-10-02"): string {
  return `\n### ${date} @someone\n${text}\n`;
}

// ---------------------------------------------------------------------------

describe("parity corpus: the goal never inverts the done gate", () => {
  const body = (checklist: string): string =>
    `# Item\n\n## Context\n\nx\n\n## Acceptance\n\n${checklist}\n\n## Notes\n`;

  const cases: Array<{
    name: string;
    checklist: string;
    gateUnchecked: boolean;
    renderable?: boolean;
    objective?: RegExp;
  }> = [
    {
      name: "no checklist at all",
      checklist: "(none)",
      gateUnchecked: false,
      objective: /DEFINE THE GOAL FIRST/,
    },
    {
      name: "one unchecked",
      checklist: "- [ ] a criterion",
      gateUnchecked: true,
      objective: /^a criterion$/,
    },
    { name: "all ticked", checklist: "- [x] a criterion", gateUnchecked: false },
    {
      name: "mixed",
      checklist: "- [x] done one\n- [ ] still open",
      gateUnchecked: true,
      objective: /still open/,
    },
    {
      name: "empty box is a placeholder, not a criterion",
      checklist: "- [ ]\n- [x] done",
      gateUnchecked: false,
      objective: /DEFINE THE GOAL FIRST/,
    },
    {
      name: "star bullet",
      checklist: "* [ ] star criterion",
      gateUnchecked: true,
      objective: /star criterion/,
    },
    {
      name: "indented criterion",
      checklist: "  - [ ] indented criterion",
      gateUnchecked: true,
      objective: /indented criterion/,
    },
    {
      name: "uppercase X",
      checklist: "- [X] done\n- [ ] open",
      gateUnchecked: true,
      objective: /open/,
    },
    {
      name: "tab after the box",
      checklist: "- [ ]\ttabbed criterion",
      gateUnchecked: true,
      objective: /tabbed criterion/,
    },
    // The two shapes that used to DIVERGE. `acceptanceComplete` counts both
    // (`[^\s]` needs no space after the box), the board row regex needs
    // `\s+` — so without the gate-authoritative verdict the goal used to claim
    // "nothing to do" while the done gate refused to close the item.
    {
      name: "no space after the box (row regex misses it)",
      checklist: "- [ ]x",
      gateUnchecked: true,
      objective: /READ THE ITEM BODY FIRST/,
      renderable: false,
    },
    {
      name: "one-space single char (both see it)",
      checklist: "- [ ] x",
      gateUnchecked: true,
      objective: /^x$/,
    },
    // The ONLY boxes live in an `arggon comment` section — a first-class shape
    // here (`create` has no `--body` flag; `bug-empty-template-checkbox` is the
    // stale empty box that shape leaves behind). The gate reads the whole body,
    // so a verdict taken on the prose alone (comments stripped) would invert.
    {
      name: "checklist filed as a comment (the round-2 input-layer inversion)",
      checklist: "- [ ]" + comment("- [ ] criterion filed in a comment"),
      gateUnchecked: true,
      objective: /criterion filed in a comment/,
    },
    {
      name: "checked-in-a-comment only (gate satisfied, nothing to loop on)",
      checklist: "- [ ]" + comment("- [x] shipped, filed in a comment"),
      gateUnchecked: false,
      objective: /DEFINE THE GOAL FIRST/,
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name}: hasGoal === !acceptanceComplete`, () => {
      const source = body(testCase.checklist);
      const gateUnchecked = !acceptanceComplete(source);
      expect(gateUnchecked, "corpus expectation for the done gate").toBe(testCase.gateUnchecked);
      const goal = deriveAsRun(source);
      expect(goal.hasGoal, "goal must agree with the gate").toBe(gateUnchecked);
      if (testCase.renderable !== undefined) {
        expect(goal.renderable).toBe(testCase.renderable);
      }
      // Text is only ever rendered for work the gate found — never the inverse.
      if (goal.renderable) expect(gateUnchecked).toBe(true);
      if (testCase.objective) expect(goal.objective).toMatch(testCase.objective);
      // The inverse must never be reported: a goal that claims work while the
      // gate is satisfied would send an agent after a criterion that does not
      // block `done`.
      if (!gateUnchecked) expect(goal.hasGoal).toBe(false);
    });
  }

  it("the comment-filed case bites: a comment-stripped input inverts the gate (round 2)", () => {
    const source = body(`- [ ]${comment("- [ ] criterion filed in a comment")}`);
    // The gate reads the whole body and refuses to close…
    expect(acceptanceComplete(source)).toBe(false);
    // …while the round-2 build took its verdict from the comment-stripped prose:
    const proseOnly = source.slice(0, source.indexOf("### 2026-"));
    const round2 = deriveGoal(
      parseAcceptanceRows(normalizeEol(proseOnly)),
      !acceptanceComplete(proseOnly),
    );
    expect(round2.hasGoal, "the defect this pins").toBe(false);
    // One canonical body for the predicate AND the text (what ships now):
    expect(deriveAsRun(source).hasGoal).toBe(true);
  });

  it("CRLF: gate and contract agree (the round-1 inversion)", () => {
    const lf = body("- [ ] crlf criterion\n- [x] done one");
    const crlf = lf.replaceAll("\n", "\r\n");
    // The frontmatter parser tolerates CRLF, the done gate reads it...
    expect(acceptanceComplete(crlf)).toBe(false);
    // ...and the raw row regex alone sees NOTHING (`.` never matches `\r`).
    expect(parseAcceptanceRows(crlf.split("\n").join("\r\n"))).toEqual([]);
    // Normalizing first (docs.ts `normalizeEol`) is what makes the rows usable.
    expect(parseAcceptanceRows(normalizeEol(crlf)).length).toBe(2);
    const goal = deriveAsRun(crlf);
    expect(goal.hasGoal).toBe(true);
    expect(goal.renderable).toBe(true);
    expect(goal.objective).toBe("crlf criterion");
  });

  it("stays bounded on a tampered oversized item (clipped lines, counted overflow)", () => {
    const huge = "x".repeat(200_000);
    const rows = Array.from({ length: 40 }, (_, i) => ({
      text: `${i}: ${huge}`,
      checked: false,
    }));
    const goal = deriveGoal(rows, true);
    expect(goal.verification).toHaveLength(8);
    expect(goal.verificationOmitted).toBe(32);
    expect(goal.truncated).toBe(true);
    for (const line of goal.verification) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(200);
    }
    expect(Buffer.byteLength(goal.objective, "utf8")).toBeLessThanOrEqual(240);
  });

  it("reports the no-goal and unrenderable shapes explicitly, never an empty goal", () => {
    const done = deriveGoal([{ text: "all ticked", checked: true }], false);
    expect(done.objective).toMatch(/DEFINE THE GOAL FIRST/);
    expect(done.verification[0]).toMatch(/cannot start until/);
    const unreadable = deriveGoal([], true);
    expect(unreadable.hasGoal).toBe(true);
    expect(unreadable.renderable).toBe(false);
    expect(unreadable.objective).toMatch(/READ THE ITEM BODY FIRST/);
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
    expect(result.goal.gateUnchecked).toBe(true);
    // Every slot is filled; none is left behind.
    expect(result.contract).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(result.contract).toContain("## Objective (exactly one)");
    expect(result.goal.template).toBe("adopter");
    expect(result.goal.identity).toBe("Arggon");
  });

  it("agrees with the done gate on a CRLF item, end to end", () => {
    const { dir, id } = treeWithTask("- [ ] crlf criterion\n- [x] done one", {
      assignee: "Arggon",
      eol: "\r\n",
    });
    const raw = readFileSync(runShow({ cwd: dir, id }).path, "utf8");
    expect(raw).toContain("\r\n");
    // The gate would refuse `done` on this item...
    expect(
      acceptanceComplete(raw.slice(raw.indexOf(FRONTMATTER_END) + FRONTMATTER_END.length)),
    ).toBe(false);
    // ...and the goal therefore offers work, with readable text.
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.hasGoal).toBe(true);
    expect(result.goal.renderable).toBe(true);
    expect(result.goal.objective).toBe("crlf criterion");
  });

  it("clips the prose read at its budget, and the clip cannot invert the gate", () => {
    const { dir, id } = treeWithTask("- [ ] beyond the budget", { assignee: "Arggon" });
    // Move the whole checklist past MAX_GOAL_PROSE_BYTES of filler: the read is
    // clipped, so no criterion row is parsed — and the contract must still say
    // "work remains" (the gate's verdict), never "define the goal first".
    const path = runShow({ cwd: dir, id }).path;
    const raw = readFileSync(path, "utf8");
    const sep = raw.indexOf(FRONTMATTER_END) + FRONTMATTER_END.length;
    const head = raw.slice(0, sep);
    const tail = raw.slice(sep);
    const unit = "filler line\n";
    const filler = unit.repeat(
      Math.ceil((MAX_GOAL_PROSE_BYTES * 1.2) / Buffer.byteLength(unit, "utf8")),
    );
    writeFileSync(path, `${head}\n${filler}\n${tail}`, "utf8");
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.gateUnchecked).toBe(true);
    expect(result.goal.hasGoal).toBe(true);
    expect(result.goal.renderable).toBe(false);
    expect(result.goal.objective).toMatch(/READ THE ITEM BODY FIRST/);
    // Round-1 finding 3: a clipped read must not read as "everything inlined".
    expect(result.goal.truncated).toBe(true);
    expect(Buffer.byteLength(result.contract, "utf8")).toBeLessThanOrEqual(MAX_GOAL_CONTRACT_BYTES);
  });

  it("marks the contract truncated when only the filler past the budget was cut", () => {
    const { dir, id } = treeWithTask("- [ ] first criterion", { assignee: "Arggon" });
    const path = runShow({ cwd: dir, id }).path;
    const raw = readFileSync(path, "utf8");
    const unit = "filler line\n";
    const filler = unit.repeat(
      Math.ceil((MAX_GOAL_PROSE_BYTES * 1.2) / Buffer.byteLength(unit, "utf8")),
    );
    // Criteria stay INSIDE the budget (the objective is still rendered) but the
    // read WAS clipped, so the contract must say so.
    writeFileSync(path, `${raw}\n${filler}`, "utf8");
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.objective).toBe("first criterion");
    expect(result.goal.renderable).toBe(true);
    expect(result.goal.truncated).toBe(true);
    expect(result.contract).toContain("Some checklist text was clipped or deferred");
  });

  it("names the no-worktree fallback the boundary states (repo root, not a sibling's)", () => {
    const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
    // No worktree_path recorded: rendering is allowed here and the scope is the
    // repo root — the boundary text must say exactly that.
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.worktree.recorded).toBe(false);
    expect(result.goal.worktree.path).toBe(result.root);
    expect(result.goal.boundaries.join("\n")).toMatch(
      /records no worktree at all[\s\S]*scoped to the repo root you are standing in/,
    );
  });

  it("clips a long criterion line and reports the contract as truncated", () => {
    const long = "y".repeat(4_000);
    const { dir, id } = treeWithTask(`- [ ] ${long}\n- [ ] short one`, {
      assignee: "Arggon",
    });
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.truncated).toBe(true);
    for (const line of result.goal.verification) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(200);
    }
    expect(result.goal.objective.endsWith("…")).toBe(true);
    expect(result.contract).toContain("Some checklist text was clipped or deferred");
  });

  it("agrees with the done gate when the checklist is filed as a comment, end to end", () => {
    // `arggon create` has no `--body` flag, so a checklist filed as an
    // `arggon comment` is a first-class shape (bug-empty-template-checkbox is
    // the stale empty box it leaves). The done gate reads the whole body; the
    // goal must read the same one, or the contract claims "nothing left" while
    // the gate refuses to close.
    const { dir, id } = treeWithTask("- [ ]", { assignee: "Arggon" });
    runComment({
      cwd: dir,
      id,
      text: "- [ ] criterion filed in a comment",
      author: "Arggon",
      now: NOW,
    });
    const item = runShow({ cwd: dir, id }).item;
    expect(acceptanceComplete(item.body), "gate: unchecked work remains").toBe(false);
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.gateUnchecked).toBe(true);
    expect(result.goal.hasGoal).toBe(true);
    expect(result.goal.objective).toBe("criterion filed in a comment");
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
    expect(contract).toContain("Claim holder: Arggon");
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

  it("falls back to the packaged template when the adopter copy is absent", () => {
    const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
    rmSync(join(dir, ...GOAL_TEMPLATE_REL.split("/")));
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.template).toBe("package");
    expect(result.contract).toContain("## Objective (exactly one)");
    expect(result.contract).toContain("one goal");
  });
});

describe("refusals: every documented code is asserted", () => {
  /** Each case: arrange a tree, return the invocation that must refuse. */
  const refusals: Array<{
    code: string;
    arrange: () => { dir: string; id: string; login?: string; templatesDir?: string };
  }> = [
    {
      code: "GOAL_UNCLAIMED",
      arrange: () => treeWithTask("- [ ] one goal"),
    },
    {
      code: "GOAL_ITEM_CLOSED",
      arrange: () => {
        const { dir, id } = treeWithTask("- [x] shipped", { assignee: "Arggon" });
        tickAcceptance(dir, id);
        runUpdate({ cwd: dir, id, status: "done", now: NOW });
        return { dir, id };
      },
    },
    {
      code: "GOAL_FOREIGN_CLAIM",
      arrange: () => treeWithTask("- [ ] one goal", { assignee: "Someone-else" }),
    },
    {
      // B2: an unresolvable identity must REFUSE, not render the goal anyway.
      code: "GOAL_IDENTITY_UNKNOWN",
      arrange: () => {
        const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
        return { dir, id, login: "" };
      },
    },
    {
      code: "GOAL_WORKTREE_MISMATCH",
      arrange: () => {
        const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
        writeWorktreePath(dir, id, mkdtempSync(join(tmpdir(), "arggon-goal-other-")));
        return { dir, id };
      },
    },
    {
      code: "GOAL_WORKTREE_MISSING",
      arrange: () => {
        const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
        const gone = mkdtempSync(join(tmpdir(), "arggon-goal-gone-"));
        writeWorktreePath(dir, id, gone);
        rmSync(gone, { recursive: true, force: true });
        return { dir, id };
      },
    },
    {
      code: "GOAL_TEMPLATE_UNAVAILABLE",
      arrange: () => {
        const { dir, id } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
        rmSync(join(dir, ...GOAL_TEMPLATE_REL.split("/")));
        // An empty templates dir removes the packaged fallback too.
        const empty = mkdtempSync(join(tmpdir(), "arggon-goal-templates-"));
        mkdirSync(join(empty, "docs/zcode/arggon/templates"), { recursive: true });
        return { dir, id, templatesDir: empty };
      },
    },
    {
      code: "GOAL_FAILED",
      arrange: () => {
        const { dir } = treeWithTask("- [ ] one goal", { assignee: "Arggon" });
        return { dir, id: "task-does-not-exist" };
      },
    },
  ];

  for (const refusal of refusals) {
    it(`refuses with ${refusal.code}`, () => {
      const { dir, id, login, templatesDir } = refusal.arrange();
      const outcome = goalOperation({ cwd: dir, id, login, templatesDir });
      expect(outcome.ok, refusal.code).toBe(false);
      expect(outcome.exitCode).toBe(1);
      const envelope = outcome.envelope as unknown as Record<string, unknown>;
      expect((envelope.error as { code?: string }).code).toBe(refusal.code);
      expect(envelope.goal).toBeUndefined();
      // A refusal envelope still reports the tree's real convention version
      // (not the 0 default a subdirectory cwd used to produce).
      expect(envelope.conventionVersion).toBe(5);
    });
  }

  it("reports the real convention version from a SUBDIRECTORY cwd", () => {
    const { dir, id } = treeWithTask("- [ ] one goal");
    const sub = join(dir, "cli", "src");
    mkdirSync(sub, { recursive: true });
    const outcome = goalOperation({ cwd: sub, id });
    expect(outcome.ok).toBe(false);
    expect((outcome.envelope as unknown as Record<string, unknown>).conventionVersion).toBe(5);
  });

  it("reports the closed item before the environment (no misleading remedy)", () => {
    const { dir, id } = treeWithTask("- [x] shipped", { assignee: "Arggon" });
    tickAcceptance(dir, id);
    runUpdate({ cwd: dir, id, status: "done", now: NOW });
    // Identity ALSO unresolvable: the intrinsic cause must still win.
    const outcome = goalOperation({ cwd: dir, id, login: "" });
    expect((outcome.envelope as unknown as Record<string, unknown>).error).toMatchObject({
      code: "GOAL_ITEM_CLOSED",
    });
  });

  it("still refuses an unclaimed item when the identity is also unknown", () => {
    const { dir, id } = treeWithTask("- [ ] one goal");
    const outcome = goalOperation({ cwd: dir, id, login: "" });
    expect((outcome.envelope as unknown as Record<string, unknown>).error).toMatchObject({
      code: "GOAL_IDENTITY_UNKNOWN",
    });
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
    expect(envelope.conventionVersion).toBe(5);
    const goal = envelope.goal as GoalContract & { contract: string };
    expect(goal.objective).toBe("one goal");
    expect(goal.verification).toEqual(["one goal", "two goals"]);
    expect(goal.boundaries.length).toBeGreaterThan(3);
    expect(goal.gateUnchecked).toBe(true);
    expect(goal.renderable).toBe(true);
    expect(goal.identity).toBe("Arggon");
    expect(Buffer.byteLength(goal.contract, "utf8")).toBeLessThanOrEqual(MAX_GOAL_CONTRACT_BYTES);
  });

  it("turns a fully ticked checklist into the define-the-goal-first shape", () => {
    const { dir, id } = treeWithTask("- [ ] one goal\n- [ ] two goals", { assignee: "Arggon" });
    tickAcceptance(dir, id);
    const result = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(result.goal.gateUnchecked).toBe(false);
    expect(result.goal.objective).toMatch(/DEFINE THE GOAL FIRST/);
    expect(result.goal.verificationOmitted).toBe(0);
  });
});
