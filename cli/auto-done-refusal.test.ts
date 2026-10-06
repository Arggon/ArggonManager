/**
 * auto-done refusal classifier (bug-done-gate-counts-checkboxes-inside-comment-
 * blocks, review finding 1).
 *
 * The defect this suite exists for: `.github/workflows/auto-done.yml` decided
 * whether a refused `update --status done` was the EXPECTED done-gate refusal
 * with `grep -q "unchecked boxes"`. ADR 0025 gave the gate a SECOND refusal
 * reason (`no-live-contract`, message: "the item's live '## Acceptance' section
 * has no acceptance criteria …"), which contains no such substring — so every
 * no-contract refusal fell into the `else` branch and annotated as "update
 * failed unexpectedly", the exact opposite of the truth. The suite was green
 * because NOTHING tested the classifier: the gate suites test the kernel's
 * decision, and the kernel's decision was never wrong. Only the workflow's
 * reading of it was.
 *
 * What is asserted, and why each shape:
 *
 *   1. **BOTH kernel refusal reasons classify `expected`.** The two envelopes
 *      are produced by running the REAL kernel (`updateOperation`) on real
 *      fixtures, not by pasting message strings into the test. A test that
 *      hardcodes the message it asserts on is the same brittleness one layer
 *      down: rewording the kernel would leave the test green and the workflow
 *      broken. These two are the regression's own two refusal shapes.
 *   2. **The pre-fix classifier is red on the new reason** — the premise of the
 *      finding, asserted as an executable probe (`unchecked boxes` is absent
 *      from the `no-live-contract` message). Without it, "the old grep was
 *      wrong" is a claim this suite merely repeats in prose.
 *   3. **Unrelated `UPDATE_FAILED` failures stay `unexpected`** — the negative
 *      control, and the reason the classifier is not just `code === UPDATE_
 *      FAILED`: an unknown id, an illegal transition and an agent `--waive`
 *      refusal all carry the same code. Without these, `expected` would pass
 *      vacuously for every failure.
 *   4. **The classifier keys on the code, not the prose** — reworded `unchecked
 *      boxes` prose under the right code still classifies `expected`, and a
 *      third refusal reason carrying the gate's shared prefix classifies
 *      `expected` without this file changing. That is the property that makes
 *      the NEXT reason safe; the finding is explicit that a per-message
 *      substring list guarantees to break again.
 *   5. **The workflow is wired to it** — both call sites invoke the classifier
 *      and neither still greps prose. The classifier being correct does not
 *      help while the workflow keeps its own inline match; this is the wiring
 *      that was silently wrong.
 *
 * Non-vacuity guards: the fixtures are asserted to actually be refused with the
 * expected reason BEFORE their envelope is classified, so a fixture that
 * stopped being refused cannot quietly turn an `expected` case into a
 * never-exercised one.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync as _mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate, runUpdate, updateOperation } from "@arggondev/lib";

import { runInit } from "./src/init.js";
import { classifyUpdateRefusal } from "./auto-done-refusal.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tmpFixtureDir(): string {
  const dir = _mkdtempSync(join(tmpdir(), "arggon-auto-done-refusal-"));
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-10-06T12:00:00Z");

/** Seed a tracker with one claimed task whose body is `body`. */
function claimedTaskWithBody(body: string): { dir: string; id: string } {
  const dir = tmpFixtureDir();
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", now: NOW });
  const story = runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", now: NOW });
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Rate limit",
    parent: story.id,
    body,
    now: NOW,
  });
  runUpdate({ cwd: dir, id: task.id, status: "in_progress", assignee: "worker", now: NOW });
  return { dir, id: task.id };
}

/**
 * The real `--json` failure envelope for a refused flip, produced by the kernel.
 * `expectRefused` keeps the suite non-vacuous: the fixture must be refused for
 * the named reason, or the classification below would prove nothing.
 */
function refusalEnvelope(
  body: string,
  expectRefused: "no-live-contract" | "unchecked-live-criteria",
): string {
  const { dir, id } = claimedTaskWithBody(body);
  const outcome = updateOperation({
    cwd: dir,
    id,
    status: "done",
    json: true,
  } as Parameters<typeof updateOperation>[0]);
  expect(outcome.ok, `fixture must be refused (${expectRefused})`).toBe(false);
  const envelope = outcome.envelope as { error?: { code?: string; message?: string } };
  expect(envelope.error?.code).toBe("UPDATE_FAILED");
  if (expectRefused === "no-live-contract") {
    expect(envelope.error?.message ?? "").toContain("no acceptance criteria");
  } else {
    expect(envelope.error?.message ?? "").toContain("unchecked boxes");
  }
  // The exact bytes the workflow captures: the envelope as one JSON line.
  return `${JSON.stringify(envelope)}\n`;
}

const NO_CONTRACT = refusalEnvelope(
  "## Context\n\nScaffolded, criteria never written.\n\n## Acceptance\n\n<!-- The real acceptance criteria; tick each box when met. -->\n",
  "no-live-contract",
);

const UNCHECKED_LIVE = refusalEnvelope(
  "## Context\n\nKeep the gate honest.\n\n## Acceptance\n\n- [ ] p95 under 100ms\n",
  "unchecked-live-criteria",
);

/** Envelope for a refusal whose message is arbitrary — the shape-only fixtures. */
function envelopeWith(message: string, code = "UPDATE_FAILED"): string {
  return `${JSON.stringify({ ok: false, schemaVersion: 1, command: "update", error: { message, code } })}\n`;
}

describe("auto-done refusal classifier: both done-gate reasons are EXPECTED", () => {
  it("classifies the no-live-contract refusal (ADR 0025's second reason) as expected", () => {
    // THE regression. Pre-fix this message matched no `unchecked boxes`
    // substring and the workflow annotated it as an unexpected failure.
    expect(classifyUpdateRefusal(NO_CONTRACT)).toBe("expected");
  });

  it("classifies the unchecked-live-criteria refusal as expected", () => {
    expect(classifyUpdateRefusal(UNCHECKED_LIVE)).toBe("expected");
  });

  it("the pre-fix `unchecked boxes` match is red on the no-live-contract reason (the finding's premise)", () => {
    const message = (JSON.parse(NO_CONTRACT) as { error: { message: string } }).error.message;
    expect(message.includes("unchecked boxes")).toBe(false);
    expect(message.includes("no acceptance criteria")).toBe(true);
  });

  it("reads the same verdict from a human-path (non-JSON) refusal as from the envelope", () => {
    // `arggon update` without --json prints `arggon update: <message>` on
    // stderr. The workflow always passes --json, so this is a robustness
    // property, asserted so a future edit to the caller cannot silently
    // downgrade the classification to "unexpected".
    const message = (JSON.parse(NO_CONTRACT) as { error: { message: string } }).error.message;
    expect(classifyUpdateRefusal(`arggon update: ${message}\n`)).toBe("unexpected");
  });
});

describe("auto-done refusal classifier: unrelated failures stay UNEXPECTED", () => {
  // The negative control. Every one of these is `UPDATE_FAILED`, so a
  // classifier that only checked the code would call all of them `expected`
  // and swallow real breakage.
  const unrelated: [string, string][] = [
    ["unknown id", "unknown id 'nope' (use `arggon list` to see the ids)"],
    ["illegal transition", "todo -> done is not a legal transition; claim the item first"],
    [
      "agent waiver refusal",
      "agents must not waive the done gate; --waive is a human-only escape hatch",
    ],
    [
      "refused steal",
      "steal is disabled in this repo (x-tracker.allow-steal: true in the tracker .convention.yml arms it)",
    ],
  ];
  for (const [label, message] of unrelated) {
    it(`an ${label} refusal is unexpected`, () => {
      expect(classifyUpdateRefusal(envelopeWith(message))).toBe("unexpected");
    });
  }

  it("a successful update envelope is unexpected (nothing was refused)", () => {
    const ok = `${JSON.stringify({ ok: true, schemaVersion: 1, command: "update", item: { id: "x" } })}\n`;
    expect(classifyUpdateRefusal(ok)).toBe("unexpected");
  });

  it("an empty or non-JSON capture is unexpected, never expected", () => {
    // Fail closed: an unreadable refusal must not be reported as recognised.
    expect(classifyUpdateRefusal("")).toBe("unexpected");
    expect(classifyUpdateRefusal("   \n")).toBe("unexpected");
    expect(classifyUpdateRefusal("arggon update: cannot find tracker\n")).toBe("unexpected");
    expect(classifyUpdateRefusal('{"ok": false, truncated\n')).toBe("unexpected");
    expect(classifyUpdateRefusal("{}")).toBe("unexpected");
  });
});

describe("auto-done refusal classifier: it keys on the code, not the prose", () => {
  it("a reworded unchecked-boxes message under UPDATE_FAILED still classifies expected", () => {
    // If the classifier matched the `unchecked boxes` substring, rewording the
    // kernel would silently reproduce this bug with a green suite.
    expect(
      classifyUpdateRefusal(
        envelopeWith("cannot mark 'task-x' done: the live checklist is not finished yet."),
      ),
    ).toBe("expected");
  });

  it("a THIRD refusal reason carrying the gate's shared prefix needs no change here", () => {
    // The property that makes the next reason safe: the gate's refusals share
    // `cannot mark '<id>' done:`, so a new one is classified correctly for free.
    expect(
      classifyUpdateRefusal(
        envelopeWith("cannot mark 'task-x' done: some future gate rule refused this."),
      ),
    ).toBe("expected");
  });

  it("a non-UPDATE_FAILED code carrying the gate's prose is unexpected", () => {
    // Guards the code half from being decorative.
    expect(
      classifyUpdateRefusal(
        envelopeWith("cannot mark 'task-x' done: the acceptance checklist …", "SOMETHING_ELSE"),
      ),
    ).toBe("unexpected");
  });
});

describe("auto-done workflow: wired to the classifier, both call sites", () => {
  const workflow = readFileSync(join(repoRoot, ".github", "workflows", "auto-done.yml"), "utf8");

  it("invokes the classifier in the main flip loop and in the redo loop", () => {
    const calls = workflow.match(/classify_refusal "\$out2?"/g) ?? [];
    // One per call site: the main loop ($out) and the redo ($out2). A single
    // call means the redo path kept its own inline match.
    expect(calls.length, `classifier call sites found: ${calls.join(", ")}`).toBe(2);
  });

  it("no longer greps a refusal message anywhere in the workflow", () => {
    // The pre-fix classifier itself, asserted absent. Scoped to non-comment
    // lines: the header comment NAMES the old grep on purpose (it is the history
    // a future reader needs), so a raw scan would fail on the very
    // documentation that explains the fix.
    const executable = workflow
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");
    expect(executable).not.toContain("unchecked boxes");
    expect(executable).not.toMatch(/grep[^\n]*cannot mark/);
  });

  it("defines the classifier once and both branches compare against `expected`", () => {
    expect(workflow.match(/classify_refusal\(\) \{/g) ?? []).toHaveLength(1);
    expect(workflow.match(/= "expected"/g) ?? []).toHaveLength(2);
  });

  it("the redo loop annotates a gate refusal as a gate refusal, not a failure", () => {
    expect(workflow).toContain("(redo): flip refused by the done gate");
  });

  it("the CLI helper is runnable as a script (the workflow invokes it by path)", () => {
    const proc = spawnSync(
      process.execPath,
      [join(repoRoot, "cli", "auto-done-refusal.mjs"), "--output", "-"],
      { input: NO_CONTRACT, encoding: "utf8" },
    );
    expect(proc.status).toBe(0);
    expect(proc.stdout.trim()).toBe("expected");
  });

  it("the helper prints `unexpected` for an unrelated failure too", () => {
    const proc = spawnSync(
      process.execPath,
      [join(repoRoot, "cli", "auto-done-refusal.mjs"), "--output", "-"],
      { input: envelopeWith("unknown id 'nope'"), encoding: "utf8" },
    );
    expect(proc.status).toBe(0);
    expect(proc.stdout.trim()).toBe("unexpected");
  });
});
