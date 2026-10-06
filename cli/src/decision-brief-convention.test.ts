/**
 * The `decide:`/`decided:` decision-brief convention, read report-only
 * (ADR 0026, spec `ArggonManager/docs/specs/spec-owner-decision-brief-021.md`
 * AC 1–8).
 *
 * Five things are proved here, each a claim the spec or its item makes:
 *
 * 1. **The parser.** The bounded header grammar (`decide:` must not match
 *    `decides:`, `decided:` must not match `decidedly:`), heading shape, and
 *    first-header-only-per-comment rule, mirroring `verdict.test.ts`.
 * 2. **Attribution.** The parsed event carries its author — new data relative to
 *    the verdict parser — which is what makes `self-decided` computable from the
 *    item's own `assignee`.
 * 3. **The additive `show` surface**, and `report --json`/`sync --json`
 *    byte-identical (AC 7).
 * 4. **The armed `spec analyze` finding.** Its scope is deliberately WIDER than
 *    the acceptance detector it mirrors: any item type, any status, while the
 *    state is `open` (AC 4) — including a leaf and a non-terminal item.
 * 5. **Never a gate** (AC 6): the done gate and the cascade reach the same
 *    verdict with and without brief/answer comments.
 */
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyDecisionBrief,
  findTasksDir,
  itemsById,
  itemsWithUnansweredBrief,
  loadItems,
  parseDecisionBriefs,
  parseFrontmatter,
  runComment,
  runCreate,
  runSync,
  runUpdate,
  type WorkItem,
} from "@arggondev/lib";

import { satisfyAcceptance } from "../../test/acceptance.js";

import { runInit } from "./init.js";
import { productAcceptanceArmed, runSpecAnalyze } from "./spec.js";
import { runCli } from "./test-spawn.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: BufferEncoding }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-10-04T12:00:00Z");

/** One `arggon comment` section, exactly as the command writes it. */
const comment = (date: string, lines: string[], author = "gonzalo"): string =>
  `\n### ${date} @${author}\n${lines.join("\n")}\n`;

// ---------------------------------------------------------------------------
// 1. The parser — AC 1
// ---------------------------------------------------------------------------

describe("decision-brief parser (ADR 0026, spec owner-decision-brief-021 AC 1)", () => {
  it("parses a brief, then an answer, in comment order", () => {
    const body = [
      comment("2026-10-06", ["decide: second supplier for the same part", "- the question: …"]),
      comment("2026-10-14", ["decided: option B (the second wave)", "- we are short of ways"]),
    ].join("\n");
    expect(parseDecisionBriefs(body)).toEqual([
      {
        kind: "brief",
        date: "2026-10-06",
        order: 0,
        author: "gonzalo",
        text: "second supplier for the same part",
      },
      {
        kind: "answer",
        date: "2026-10-14",
        order: 1,
        author: "gonzalo",
        text: "option B (the second wave)",
      },
    ]);
    expect(classifyDecisionBrief(body)).toBe("decided");
  });

  it("is bounded: `decide:` must not match `decides:`, `decided:` must not match `decidedly:`", () => {
    const body = [
      comment("2026-10-04", ["decides: nothing at all"]),
      comment("2026-10-04", ["decidedly: not an answer"]),
    ].join("\n");
    expect(parseDecisionBriefs(body)).toEqual([]);
    expect(classifyDecisionBrief(body)).toBe("none");
  });

  it("is bounded: a mention mid-sentence is not a header", () => {
    const body = comment("2026-10-04", [
      "the decide: header is written by the lead",
      "- quoted evidence: decided: option B",
    ]);
    expect(parseDecisionBriefs(body)).toEqual([]);
    expect(classifyDecisionBrief(body)).toBe("none");
  });

  it("only the first header-looking line of a comment counts", () => {
    // A quoted brief inside an evidence list cannot impersonate the header.
    const body = comment("2026-10-04", [
      "decided: other",
      "- evidence quote: decide: a quoted brief",
    ]);
    const events = parseDecisionBriefs(body);
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("answer");
    expect(events[0]!.text).toBe("other");
  });

  it("ignores lines outside dated comments, and handoff headings never match", () => {
    const body = [
      "decide: top-level prose",
      "#### Notes",
      "decided: option A",
      "### handoff 2026-10-04 @ses_abc — next: merge",
      "decide: inside a handoff",
    ].join("\n");
    expect(parseDecisionBriefs(body)).toEqual([]);
    expect(classifyDecisionBrief(body)).toBe("none");
  });

  it("breaks same-date ties by append order (body position)", () => {
    const body = [
      comment("2026-10-04", ["decided: option A"]),
      comment("2026-10-04", ["decide: a later question"]),
    ].join("\n");
    // The brief is the later comment on the same date, so it is open again.
    expect(classifyDecisionBrief(body)).toBe("open");
  });

  it("a later `decided:` supersedes an earlier one, and the brief is never rewritten", () => {
    const body = [
      comment("2026-10-06", ["decide: the question"], "lead"),
      comment("2026-10-07", ["decided: option A"], "gonzalo"),
      comment("2026-10-09", ["decided: option B"], "gonzalo"),
    ].join("\n");
    expect(classifyDecisionBrief(body)).toBe("decided");
    // Nothing here mutates; a superseded answer stays in the body verbatim.
    expect(body).toContain("decided: option A");
  });

  it("`decided: other` is an ordinary answer, not an escalation", () => {
    const body = [
      comment("2026-10-06", ["decide: the question"], "lead"),
      comment("2026-10-07", ["decided: other", "- none of these fit what we need"]),
    ].join("\n");
    expect(parseDecisionBriefs(body)[1]!.text).toBe("other");
    expect(classifyDecisionBrief(body, "gonzalo")).toBe("self-decided");
  });

  it("an answer with no brief is `none` (there was no question to answer)", () => {
    const body = comment("2026-10-04", ["decided: option B"]);
    expect(classifyDecisionBrief(body)).toBe("none");
  });

  it("a plain comment recording a one-option decision is not a brief (routing-rule boundary)", () => {
    // The routing rule: a question with one real option is decided by the lead
    // and recorded as a plain comment — no `decide:` header, so no answer state.
    const body = comment(
      "2026-10-04",
      ["Decided to keep one supplier; recorded as a plain note."],
      "lead",
    );
    expect(classifyDecisionBrief(body)).toBe("none");
  });

  it("a brief with no answer is `open`", () => {
    const body = comment("2026-10-06", ["decide: the question"], "lead");
    expect(classifyDecisionBrief(body)).toBe("open");
  });
});

// ---------------------------------------------------------------------------
// 2. The four states, and attribution — AC 2
// ---------------------------------------------------------------------------

describe("decision-brief states and attribution (AC 2)", () => {
  it("reports the four states", () => {
    expect(classifyDecisionBrief("# t\n\nNothing.\n")).toBe("none");
    expect(classifyDecisionBrief(comment("2026-10-06", ["decide: q"], "lead"))).toBe("open");
    expect(
      classifyDecisionBrief(
        [
          comment("2026-10-06", ["decide: q"], "lead"),
          comment("2026-10-07", ["decided: option A"], "gonzalo"),
        ].join("\n"),
        "ana",
      ),
    ).toBe("decided");
    expect(
      classifyDecisionBrief(
        [
          comment("2026-10-06", ["decide: q"], "lead"),
          comment("2026-10-07", ["decided: option A"], "ana"),
        ].join("\n"),
        "ana",
      ),
    ).toBe("self-decided");
  });

  it("folds case, because a login is a case-insensitive identifier", () => {
    const body = [
      comment("2026-10-06", ["decide: q"], "lead"),
      comment("2026-10-07", ["decided: option A"], "Ana"),
    ].join("\n");
    expect(classifyDecisionBrief(body, "ana")).toBe("self-decided");
  });

  it("an unassigned item can never read as self-decided", () => {
    const body = [
      comment("2026-10-06", ["decide: q"], "lead"),
      comment("2026-10-07", ["decided: option A"], "gonzalo"),
    ].join("\n");
    expect(classifyDecisionBrief(body, null)).toBe("decided");
    expect(classifyDecisionBrief(body, undefined)).toBe("decided");
    expect(classifyDecisionBrief(body, "")).toBe("decided");
  });

  it("only the LATEST answer can be self-decided", () => {
    const body = [
      comment("2026-10-06", ["decide: q"], "lead"),
      comment("2026-10-07", ["decided: option A"], "ana"),
      comment("2026-10-09", ["decided: option B"], "gonzalo"),
    ].join("\n");
    expect(classifyDecisionBrief(body, "ana")).toBe("decided");
  });
});

// ---------------------------------------------------------------------------
// 3. Additive surfaces — AC 3, AC 7
// ---------------------------------------------------------------------------

/** A full tree: initiative > epic > two stories, one with a leaf, plus docs. */
function seeded(dir: string): { story: string; leaf: string } {
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: "story-login",
    now: NOW,
  });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Billing",
    parent: "auth",
    id: "story-billing",
    now: NOW,
  });
  const leaf = runCreate({
    cwd: dir,
    type: "task",
    title: "Rate limit",
    parent: "story-login",
    id: "rate-limit",
    now: NOW,
  });
  runUpdate({ cwd: dir, id: leaf.id, status: "in_progress", assignee: "ana", now: NOW });
  satisfyAcceptance(dir, leaf.id);
  return { story: "story-login", leaf: leaf.id };
}

function arm(dir: string, value = "true"): void {
  const path = join(dir, "ArggonManager/.convention.yml");
  writeFileSync(
    path,
    `${readFileSync(path, "utf8")}\nx-tracker:\n  product-acceptance: ${value}\n`,
    "utf8",
  );
}

function itemOf(dir: string, id: string): WorkItem {
  return itemsById(loadItems(findTasksDir(dir))).get(id)!;
}

/** One spec document, so `spec analyze` scans something (it is corpus mode). */
function writeSpec(dir: string): string {
  const dirPath = join(dir, "ArggonManager", "docs", "specs");
  mkdirSync(dirPath, { recursive: true });
  const path = join(dirPath, "spec-decision-brief-fixture-099.md");
  writeFileSync(
    path,
    `---
spec_id: decision-brief-fixture-099
title: Fixture
status: proposed
created: 2026-10-04
---

# Spec: Fixture (099)

## Purpose

So the corpus scan has one document.

## Synopsis

\`\`\`bash
arggon x
\`\`\`

On error the command exits 1.

## Acceptance

- [x] it works
`,
    "utf8",
  );
  return path;
}

describe("show carries the additive decision_brief field (AC 3)", () => {
  it("reports each of the four states, read from the canonical body", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-show-"));
    seeded(dir);
    const json = (): { decision_brief: string } =>
      JSON.parse(runCli(["show", "story-login", "--json"], dir).stdout) as {
        decision_brief: string;
      };

    expect(json().decision_brief).toBe("none");

    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: add a second supplier?",
      author: "lead",
      now: NOW,
      commit: false,
    });
    expect(json().decision_brief).toBe("open");

    runComment({
      cwd: dir,
      id: "story-login",
      text: "decided: option B",
      author: "gonzalo",
      now: new Date("2026-10-06T12:00:00Z"),
      commit: false,
    });
    expect(json().decision_brief).toBe("decided");
  });

  it("reports self-decided when the answer is by the item's own assignee", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-self-"));
    seeded(dir);
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "ana", now: NOW });
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decided: option A",
      author: "ana",
      now: new Date("2026-10-06T12:00:00Z"),
      commit: false,
    });
    const payload = JSON.parse(runCli(["show", "story-login", "--json"], dir).stdout) as {
      decision_brief: string;
    };
    expect(payload.decision_brief).toBe("self-decided");
  });

  it("reads the canonical body, so a comment-only brief beyond the tail is seen", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-comment-only-"));
    seeded(dir);
    for (let i = 0; i < 5; i += 1) {
      runComment({
        cwd: dir,
        id: "story-login",
        text: `chatter ${i}`,
        author: "ana",
        now: new Date(NOW.getTime() + i * 1000),
        commit: false,
      });
    }
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: new Date(NOW.getTime() + 9000),
      commit: false,
    });
    const proc = runCli(["show", "story-login", "--json"], dir);
    const payload = JSON.parse(proc.stdout) as { decision_brief: string; comments: unknown[] };
    expect(payload.decision_brief).toBe("open");
    // Default tail is 3 comments: the brief is NOT among the bounded tail.
    expect(payload.comments).toHaveLength(3);
  });

  it("the human show view gains no field line", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-human-"));
    seeded(dir);
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });
    expect(runCli(["show", "story-login"], dir).stdout).not.toMatch(/^\s*decision_brief: /m);
  });

  it("is ungated: reports all four states whether or not the finding is armed", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-ungated-"));
    seeded(dir);
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });
    const read = (): string =>
      (
        JSON.parse(runCli(["show", "story-login", "--json"], dir).stdout) as {
          decision_brief: string;
        }
      ).decision_brief;
    expect(read()).toBe("open");
    arm(dir, "false");
    expect(read()).toBe("open");
    arm(dir, "true");
    expect(read()).toBe("open");
  });
});

describe("report and sync stay byte-identical (AC 7)", () => {
  it("report carries no decision_brief (it aggregates per container)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-report-"));
    seeded(dir);
    arm(dir);
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });
    const payload = JSON.parse(runCli(["report", "--json"], dir).stdout) as {
      groups: { containers: Record<string, unknown>[] }[];
    };
    const container = payload.groups
      .flatMap((g) => g.containers)
      .find((c) => c.id === "story-login");
    expect(container).toHaveProperty("acceptance");
    expect(container).not.toHaveProperty("decision_brief");
  });

  it("sync carries no decision_brief field, and a brief comment is invisible to it", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-sync-"));
    const { leaf } = seeded(dir);
    arm(dir);
    setField(dir, leaf, { branch: "feat/rate-limit" });
    runComment({
      cwd: dir,
      id: leaf,
      text: "decide: should this stay?",
      author: "lead",
      now: NOW,
      commit: false,
    });
    appendComment(dir, leaf, "verdict: approve");

    const execGh = vi.fn((cmd: string, args: string[]) => {
      if (cmd === "gh" && args[0] === "pr" && args[1] === "list") {
        return JSON.stringify([
          { number: 7, title: "PR", headRefName: "feat/rate-limit", url: "https://x/pull/7" },
        ]);
      }
      throw new Error(`unexpected command: ${cmd} ${args.join(" ")}`);
    });
    const result = runSync(
      { check: true, cwd: dir, repo: "test/test" },
      execGh as unknown as typeof execFileSync,
    );

    expect(result.exit_code).toBe(0);
    expect(Object.keys(result).sort()).toEqual([
      "ambiguous",
      "command",
      "errors",
      "exit_code",
      "filled",
      "matched",
      "mode",
      "pending",
      "suggestions",
      "unmatched",
      "verdicts",
    ]);
    expect(result.verdicts).toEqual({ [leaf]: "approved" });
  });
});

// ---------------------------------------------------------------------------
// 4. The armed `spec analyze` finding — AC 4, AC 5
// ---------------------------------------------------------------------------

describe("spec analyze: UNANSWERED-DECISION-BRIEF", () => {
  it("is silent unless the project armed x-tracker.product-acceptance", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-unarmed-"));
    seeded(dir);
    writeSpec(dir);
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });

    expect(runSpecAnalyze({ cwd: dir }).unansweredDecisionBrief).toEqual([]);
    arm(dir, "false");
    expect(runSpecAnalyze({ cwd: dir }).unansweredDecisionBrief).toEqual([]);
    arm(dir, "true");
    const fired = runSpecAnalyze({ cwd: dir }).unansweredDecisionBrief;
    expect(fired).toHaveLength(1);
    expect(fired[0]!.kind).toBe("UNANSWERED-DECISION-BRIEF");
    expect(fired[0]!.severity).toBe("warn");
    expect(fired[0]!.file).toContain("story-login");
    expect(fired[0]!.message).toContain("story-login");
    expect(fired[0]!.message).toContain("decided:");
    // No line number: the file is the item's own path.
    expect(fired[0]!.line).toBeUndefined();
    // Report-only: the run still succeeds and the item is untouched.
    const proc = runCli(["spec", "analyze", "--json"], dir);
    expect(proc.status).toBe(0);
  });

  it("fires on ANY item type and ANY status while open (deliberately wider than acceptance)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-scope-"));
    const { story, leaf } = seeded(dir);
    arm(dir);
    writeSpec(dir);
    // A LEAF (task) that is NOT terminal, and a STORY container that is not
    // terminal: both carry an open brief, both must fire. Copying the
    // acceptance detector's story-only/terminal-only scope would silence both.
    runComment({
      cwd: dir,
      id: leaf,
      text: "decide: hard-to-reverse call on the leaf",
      author: "lead",
      now: NOW,
      commit: false,
    });
    runComment({
      cwd: dir,
      id: story,
      text: "decide: a container-level call",
      author: "lead",
      now: NOW,
      commit: false,
    });
    expect(itemOf(dir, leaf).status).toBe("in_progress");
    expect(itemOf(dir, story).status).toBe("todo");

    const files = runSpecAnalyze({ cwd: dir })
      .unansweredDecisionBrief.map((f) => f.file.split("/").pop())
      .sort();
    expect(files).toEqual(["story-login.md", "task-rate-limit.md"]);
  });

  it("a leaf in `todo` fires too (any status while open)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-leaf-todo-"));
    const { story } = seeded(dir);
    arm(dir);
    writeSpec(dir);
    const todoLeaf = runCreate({
      cwd: dir,
      type: "task",
      title: "Pending",
      parent: story,
      id: "pending",
      now: NOW,
    });
    runComment({
      cwd: dir,
      id: todoLeaf.id,
      text: "decide: an open question",
      author: "lead",
      now: NOW,
      commit: false,
    });
    expect(itemOf(dir, todoLeaf.id).status).toBe("todo");
    const ids = runSpecAnalyze({ cwd: dir }).unansweredDecisionBrief.map((f) =>
      f.file.split("/").pop(),
    );
    expect(ids).toContain("task-pending.md");
  });

  it("never fires on decided or self-decided, and a later `decided:` clears it", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-clears-"));
    seeded(dir);
    arm(dir);
    writeSpec(dir);
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });
    expect(runSpecAnalyze({ cwd: dir }).unansweredDecisionBrief).toHaveLength(1);

    runComment({
      cwd: dir,
      id: "story-login",
      text: "decided: other",
      author: "gonzalo",
      now: new Date("2026-10-06T12:00:00Z"),
      commit: false,
    });
    expect(runSpecAnalyze({ cwd: dir }).unansweredDecisionBrief).toEqual([]);

    // A self-answer is not a finding either: the question was asked and answered.
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q2",
      author: "lead",
      now: new Date("2026-10-07T12:00:00Z"),
      commit: false,
    });
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decided: option A",
      author: "ana",
      now: new Date("2026-10-08T12:00:00Z"),
      commit: false,
    });
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "ana", now: NOW });
    expect(runSpecAnalyze({ cwd: dir }).unansweredDecisionBrief).toEqual([]);
  });

  it("is empty in --spec single-file mode (corpus-only, like the other buckets)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-single-"));
    seeded(dir);
    arm(dir);
    const specPath = writeSpec(dir);
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });
    expect(runSpecAnalyze({ cwd: dir, spec: specPath }).unansweredDecisionBrief).toEqual([]);
  });

  it("degrades to unarmed (never fails the scan) on a malformed convention file", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-badconfig-"));
    seeded(dir);
    writeSpec(dir);
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });
    writeFileSync(
      join(dir, "ArggonManager/.convention.yml"),
      "version: 5\nx-tracker:\n  product-acceptance: maybe\n",
      "utf8",
    );
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.unansweredDecisionBrief).toEqual([]);
    expect(runCli(["validate", "--json"], dir).stdout).toContain("INVALID_BRANCH_PATTERN");
  });

  it("reuses the existing arming: no new x-tracker key is required", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-existing-arm-"));
    seeded(dir);
    arm(dir);
    expect(productAcceptanceArmed(dir)).toBe(true);
    writeSpec(dir);
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });
    expect(runSpecAnalyze({ cwd: dir }).unansweredDecisionBrief).toHaveLength(1);
  });

  it("the message is deterministic (no clock, no counts) so a baseline fingerprints stably", () => {
    const message = (): string => {
      const dir = mkdtempSync(join(tmpdir(), "arggon-brief-deterministic-"));
      seeded(dir);
      arm(dir);
      writeSpec(dir);
      runComment({
        cwd: dir,
        id: "story-login",
        text: "decide: q",
        author: "lead",
        now: NOW,
        commit: false,
      });
      return runSpecAnalyze({ cwd: dir }).unansweredDecisionBrief[0]!.message;
    };
    expect(message()).toBe(message());
  });
});

// ---------------------------------------------------------------------------
// 5. Never a gate anywhere, and idempotence — AC 6, AC 8
// ---------------------------------------------------------------------------

describe("report-only: the done gate and the cascade never read the brief (AC 6)", () => {
  /** Seed a task whose checklist is satisfied, under a fresh container. */
  function gatedTree(dir: string): { leaf: string } {
    runInit({ dir, force: false });
    runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
    runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
    runCreate({
      cwd: dir,
      type: "story",
      title: "Login",
      parent: "auth",
      id: "story-login",
      now: NOW,
    });
    const leaf = runCreate({
      cwd: dir,
      type: "task",
      title: "Rate limit",
      parent: "story-login",
      id: "rate-limit",
      body: "## Context\n\nShip it.\n\n## Acceptance\n\n- [x] p95 under 100ms\n",
      now: NOW,
    });
    return { leaf: leaf.id };
  }

  it("the cascade completes the same containers with and without brief/answer comments", () => {
    const verdict = (withBrief: boolean): string[] => {
      const dir = mkdtempSync(join(tmpdir(), "arggon-brief-nogate-"));
      const { leaf } = gatedTree(dir);
      if (withBrief) {
        runComment({
          cwd: dir,
          id: "story-login",
          text: "decide: ship it?",
          author: "lead",
          now: NOW,
          commit: false,
        });
        runComment({
          cwd: dir,
          id: "story-login",
          text: "decided: option A",
          author: "gonzalo",
          now: new Date("2026-10-05T12:00:00Z"),
          commit: false,
        });
      }
      runUpdate({ cwd: dir, id: leaf, status: "in_progress", assignee: "ana", now: NOW });
      const result = runUpdate({ cwd: dir, id: leaf, status: "done", now: NOW });
      return [
        ...result.changed,
        ...result.autoCompleted,
        ...result.cascadeSkipped.map((entry) => `${entry.id}:${entry.reason}`),
      ].sort();
    };

    const without = verdict(false);
    const with_ = verdict(true);
    expect(with_).toEqual(without);
    expect(without).toContain("story-login");
    expect(without).toContain("auth");
  });

  it("the done gate refuses on the same body whatever the brief says", () => {
    const refusal = (withBrief: boolean): string => {
      const dir = mkdtempSync(join(tmpdir(), "arggon-brief-nogate-leaf-"));
      runInit({ dir, force: false });
      runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
      runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
      runCreate({
        cwd: dir,
        type: "story",
        title: "Login",
        parent: "auth",
        id: "story-login",
        now: NOW,
      });
      const leaf = runCreate({
        cwd: dir,
        type: "task",
        title: "Rate limit",
        parent: "story-login",
        id: "rate-limit",
        body: "## Acceptance\n\n- [ ] p95 under 100ms\n",
        now: NOW,
      });
      if (withBrief) {
        // A brief and an answer on the LEAF — emphatically not a waiver.
        runComment({
          cwd: dir,
          id: leaf.id,
          text: "decide: waive this?",
          author: "lead",
          now: NOW,
          commit: false,
        });
        runComment({
          cwd: dir,
          id: leaf.id,
          text: "decided: option A",
          author: "gonzalo",
          now: new Date("2026-10-05T12:00:00Z"),
          commit: false,
        });
      }
      runUpdate({ cwd: dir, id: leaf.id, status: "in_progress", assignee: "ana", now: NOW });
      try {
        runUpdate({ cwd: dir, id: leaf.id, status: "done", now: NOW });
        return "flipped";
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    };

    expect(refusal(true)).toMatch(/unchecked boxes[\s\S]*--waive "<reason>"/);
    expect(refusal(false)).toBe(refusal(true));
  });
});

describe("idempotence and forward-only (AC 8)", () => {
  it("re-running spec analyze and show never mutates the item body", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-idempotent-"));
    seeded(dir);
    arm(dir);
    writeSpec(dir);
    runComment({
      cwd: dir,
      id: "story-login",
      text: "decide: q",
      author: "lead",
      now: NOW,
      commit: false,
    });
    const before = readFileSync(itemOf(dir, "story-login").filePath, "utf8");
    runSpecAnalyze({ cwd: dir });
    runSpecAnalyze({ cwd: dir });
    runCli(["show", "story-login", "--json"], dir);
    const after = readFileSync(itemOf(dir, "story-login").filePath, "utf8");
    expect(after).toBe(before);
  });

  it("itemsWithUnansweredBrief returns open items sorted by id, and nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-brief-selector-"));
    const { story, leaf } = seeded(dir);
    runComment({
      cwd: dir,
      id: leaf,
      text: "decide: leaf question",
      author: "lead",
      now: NOW,
      commit: false,
    });
    runComment({
      cwd: dir,
      id: story,
      text: "decide: container question",
      author: "lead",
      now: NOW,
      commit: false,
    });
    expect(itemsWithUnansweredBrief(loadItems(findTasksDir(dir))).map((g) => g.item.id)).toEqual(
      [leaf, story].sort(),
    );
  });
});

/** Rewrite an item's frontmatter with the given field overrides. */
function setField(dir: string, id: string, overrides: Record<string, unknown>): void {
  const path = itemOf(dir, id).filePath;
  const parsed = parseFrontmatter(readFileSync(path, "utf8"));
  const data = { ...parsed.data, ...overrides } as Record<string, unknown>;
  const lines = Object.entries(data).map(([key, value]) => {
    if (value === null || value === undefined) return `${key}: null`;
    if (Array.isArray(value)) return `${key}: ${JSON.stringify(value)}`;
    return `${key}: ${typeof value === "string" ? JSON.stringify(value) : String(value)}`;
  });
  writeFileSync(path, `---\n${lines.join("\n")}\n---\n\n${parsed.body}`, "utf8");
}

/** Append a dated comment section exactly as `arggon comment` writes it. */
function appendComment(dir: string, id: string, line: string, date = "2026-10-04"): void {
  const path = itemOf(dir, id).filePath;
  const raw = readFileSync(path, "utf8");
  const base = raw.endsWith("\n") ? raw : `${raw}\n`;
  writeFileSync(path, `${base}\n### ${date} @Reviewer\n${line}\n`, "utf8");
}
