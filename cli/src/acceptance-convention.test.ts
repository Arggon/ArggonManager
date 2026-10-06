/**
 * The `accept:` product-acceptance convention, read report-only
 * (ADR 0021 §4, spec `ArggonManager/docs/specs/spec-promotion-policy-018.md`).
 *
 * Four things are proved here, and each one is a claim the spec makes:
 *
 * 1. **The parser is the verdict parser.** Every boundary `verdict.test.ts`
 *    pins is re-pinned here for the `accept:` vocabulary, plus the
 *    accept-specific near misses (`acceptance`, `approved`, `approvals`) that
 *    the spec calls out by name.
 * 2. **Attribution.** The parsed comment carries its author, which is what
 *    makes `self-accepted` a first-class state rather than a footnote.
 * 3. **Additive surfaces.** `report --json` carries the state per container and
 *    `show --json` carries it per item; the human table is untouched.
 * 4. **Report-only.** AC 8: the done gate and the cascade reach the SAME
 *    verdict with and without acceptance comments on the item, and the only
 *    armed-elsewhere surface (`spec analyze`) never fails the run.
 *
 * The opt-in follows the `allow-steal` precedent exactly (docs/convention.md
 * §Tracker hygiene): absent/`false` is silent, a non-boolean value is a parse
 * error, unknown nested keys stay ignored.
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
  ACCEPTANCE_CONTAINER_TYPES,
  classifyAcceptance,
  containersMissingAcceptance,
  findTasksDir,
  itemsById,
  loadItems,
  parseAcceptances,
  parseConventionConfig,
  parseFrontmatter,
  runComment,
  runCreate,
  runReport,
  runSync,
  runUpdate,
  type AcceptanceState,
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
// 1. The parser — the verdict grammar, on the accept vocabulary
// ---------------------------------------------------------------------------

describe("acceptance classifier (ADR 0021 §4)", () => {
  it("an approve comment classifies accepted", () => {
    const body = [
      "# ship the container",
      "",
      "## Acceptance",
      "- [x] done",
      comment("2026-10-04", ["accept: approve", "- the promised scope shipped; no scope creep"]),
    ].join("\n");
    expect(classifyAcceptance(body)).toBe("accepted");
  });

  it("changes-requested after approve classifies changes-noted", () => {
    const body = [
      comment("2026-10-03", ["accept: approve"]),
      comment("2026-10-04", ["accept: changes-requested (release notes missing)"]),
    ].join("\n");
    expect(classifyAcceptance(body)).toBe("changes-noted");
  });

  it("a later approve supersedes an earlier changes-requested", () => {
    const body = [
      comment("2026-10-03", ["accept: changes-requested"]),
      comment("2026-10-04", ["accept: approve"]),
    ].join("\n");
    expect(classifyAcceptance(body)).toBe("accepted");
  });

  it("prose comments with no header line classify none", () => {
    const body = [
      comment("2026-10-03", ["looks good to me, nice work"]),
      comment("2026-10-04", ["the accept: approve was discussed offline"]), // mention, not a header
    ].join("\n");
    expect(classifyAcceptance(body)).toBe("none");
    expect(parseAcceptances(body)).toEqual([]);
  });

  it("a body with no comments classifies none", () => {
    expect(classifyAcceptance("# t\n\n## Context\n\nNothing.\n")).toBe("none");
    expect(classifyAcceptance("")).toBe("none");
  });

  it("orders by comment date, not body position", () => {
    const body = [
      comment("2026-10-04", ["accept: approve"]),
      comment("2026-10-03", ["accept: changes-requested"]),
    ].join("\n");
    expect(classifyAcceptance(body)).toBe("accepted");
  });

  it("same-date comments order by comment position in the body", () => {
    const body = [
      comment("2026-10-04", ["accept: changes-requested"]),
      comment("2026-10-04", ["accept: approve"]),
    ].join("\n");
    expect(classifyAcceptance(body)).toBe("accepted");
  });

  it("is case-insensitive on the token and the value", () => {
    expect(classifyAcceptance(comment("2026-10-04", ["Accept: APPROVE"]))).toBe("accepted");
    expect(classifyAcceptance(comment("2026-10-04", ["ACCEPT: Changes-Requested"]))).toBe(
      "changes-noted",
    );
    expect(classifyAcceptance(comment("2026-10-04", ["accept:approve"]))).toBe("accepted");
  });

  it("captures the optional scope and the author without affecting classification", () => {
    const parsed = parseAcceptances(
      [
        comment("2026-10-03", ["accept: changes-requested (release notes missing)"], "ana"),
        comment("2026-10-04", ["accept: approve"], "gonzalo"),
      ].join("\n"),
    );
    expect(parsed).toEqual([
      {
        date: "2026-10-03",
        order: 0,
        author: "ana",
        value: "changes-requested",
        scope: "(release notes missing)",
      },
      { date: "2026-10-04", order: 1, author: "gonzalo", value: "approve", scope: null },
    ]);
  });

  it("ignores acceptance-looking lines outside dated comments", () => {
    // Top-level prose and undated headings are not comments; handoff headings
    // (`### handoff <date> @<author> — …`) never match, by construction.
    const body = [
      "accept: approve",
      "#### Notes",
      "accept: changes-requested",
      "### handoff 2026-10-04 @ses_abc — next: merge",
      "accept: approve",
    ].join("\n");
    expect(classifyAcceptance(body)).toBe("none");
  });

  it("only the first acceptance line of a comment counts (the header line)", () => {
    const body = comment("2026-10-04", [
      "accept: changes-requested",
      "- evidence quote: accept: approve",
    ]);
    expect(classifyAcceptance(body)).toBe("changes-noted");
  });

  it("does not match near-miss tokens (the accept vocabulary of the spec)", () => {
    // `accepted` must not match `acceptance`, `approve` must not match
    // `approved` or `approvals` — the boundedness rule of `verdict.ts`.
    const body = [
      comment("2026-10-04", ["accept: approved", "accept: approvals", "accept: acceptance"]),
      comment("2026-10-04", ["accepted: approve", "acceptance: approve"]),
    ].join("\n");
    expect(classifyAcceptance(body)).toBe("none");
    expect(parseAcceptances(body)).toEqual([]);
  });

  it("still matches the bounded forms: value at end of line, space or paren", () => {
    expect(classifyAcceptance(comment("2026-10-04", ["accept: approve"]))).toBe("accepted");
    expect(classifyAcceptance(comment("2026-10-04", ["accept: approve  "]))).toBe("accepted");
    expect(classifyAcceptance(comment("2026-10-04", ["accept: approve (scope)"]))).toBe("accepted");
  });
});

// ---------------------------------------------------------------------------
// 2. Attribution — `self-accepted`
// ---------------------------------------------------------------------------

describe("acceptance attribution", () => {
  const approved = comment("2026-10-04", ["accept: approve"]);

  it("reports an approve by the item's own assignee as self-accepted", () => {
    expect(classifyAcceptance(approved, "gonzalo")).toBe("self-accepted");
  });

  it("folds case, because a login is a case-insensitive identifier", () => {
    expect(
      classifyAcceptance(comment("2026-10-04", ["accept: approve"], "Gonzalo"), "gonzalo"),
    ).toBe("self-accepted");
  });

  it("reports an approve by anyone else as accepted", () => {
    expect(classifyAcceptance(approved, "ana")).toBe("accepted");
    expect(classifyAcceptance(approved, null)).toBe("accepted");
    expect(classifyAcceptance(approved, undefined)).toBe("accepted");
    expect(classifyAcceptance(approved, "")).toBe("accepted");
  });

  it("only the LATEST approval can be self-accepted", () => {
    const body = [
      comment("2026-10-03", ["accept: approve"], "gonzalo"),
      comment("2026-10-04", ["accept: changes-requested"], "gonzalo"),
    ].join("\n");
    expect(classifyAcceptance(body, "gonzalo")).toBe("changes-noted");
  });

  it("a changes-requested is never an approval, whoever wrote it", () => {
    const body = comment("2026-10-04", ["accept: changes-requested"], "gonzalo");
    expect(classifyAcceptance(body, "gonzalo")).toBe("changes-noted");
  });
});

// ---------------------------------------------------------------------------
// 3. Additive surfaces
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
  // Done gate (task-done-gate-acceptance-waiver, ADR 0015; scoped by
  // bug-done-gate-counts-checkboxes-inside-comment-blocks): these fixtures close
  // the leaf for other rules, so give it a satisfied live `## Acceptance`
  // contract — the shared arrange helper publishes one when the section has none
  // (which is what `create` scaffolds) and ticks any it finds.
  satisfyAcceptance(dir, leaf.id);
  // A leaf id gains the `task-` prefix, so the caller uses the returned id.
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
  const specs = join(dir, "ArggonManager", "docs", "specs");
  mkdirSync(specs, { recursive: true });
  const path = join(specs, "spec-smoke-001.md");
  writeFileSync(
    path,
    [
      "---",
      "spec_id: smoke-001",
      "title: Smoke",
      "status: proposed",
      "created: 2026-10-04",
      "---",
      "",
      "# Spec: Smoke (smoke-001)",
      "",
      "## Purpose",
      "",
      "Give the analyze corpus one document.",
      "",
      "## Synopsis",
      "",
      "```bash",
      "arggon validate",
      "```",
      "",
      "On failure it exits 1.",
      "",
      "## Acceptance",
      "",
      "- [x] the corpus is not empty",
      "",
    ].join("\n"),
    "utf8",
  );
  return path;
}

describe("report --json carries the container acceptance", () => {
  it("classifies every container and leaves the human table untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-report-"));
    seeded(dir);

    const containersOf = (): Map<string, AcceptanceState> =>
      new Map(
        runReport({ cwd: dir })
          .groups.flatMap((group) => group.containers)
          .map((container) => [container.id, container.acceptance]),
      );

    expect(containersOf()).toEqual(
      new Map([
        ["story-login", "none"],
        ["story-billing", "none"],
      ]),
    );

    runComment({
      cwd: dir,
      id: "story-login",
      text: "accept: approve\n- the promised scope shipped",
      author: "gonzalo",
      now: NOW,
      commit: false,
    });
    expect(containersOf().get("story-login")).toBe("accepted");

    runComment({
      cwd: dir,
      id: "story-login",
      text: "accept: changes-requested\n- one more round",
      author: "gonzalo",
      now: new Date("2026-10-05T12:00:00Z"),
      commit: false,
    });
    expect(containersOf().get("story-login")).toBe("changes-noted");

    // The text surface is byte-identical to the pre-change table: no marker,
    // no column, nothing a project that never adopted the convention can see.
    const table = runCli(["report"], dir);
    expect(table.status).toBe(0);
    expect(table.stdout).toContain(
      "story-login: todo=0 in_progress=1 blocked=0 done=0 cancelled=0 (total 1)",
    );
    expect(table.stdout).not.toContain("accept");
  });

  it("reports self-accepted on the container whose assignee signed it off", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-self-"));
    seeded(dir);
    runUpdate({
      cwd: dir,
      id: "story-login",
      status: "in_progress",
      assignee: "ana",
      now: NOW,
    });
    runComment({
      cwd: dir,
      id: "story-login",
      text: "accept: approve",
      author: "ana",
      now: NOW,
      commit: false,
    });
    const container = runReport({ cwd: dir })
      .groups.flatMap((group) => group.containers)
      .find((entry) => entry.id === "story-login");
    expect(container?.acceptance).toBe("self-accepted");
  });
});

describe("show --json carries the item acceptance", () => {
  it("answers on every view, --meta included, and never gates the read", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-show-"));
    seeded(dir);

    const read = (args: string[]): { acceptance?: unknown; item: { id: string } } => {
      const proc = runCli(["show", ...args, "--json"], dir);
      expect(proc.status, proc.stderr).toBe(0);
      return JSON.parse(proc.stdout) as { acceptance?: unknown; item: { id: string } };
    };

    expect(read(["story-login"]).acceptance).toBe("none");
    expect(read(["story-login", "--meta"]).acceptance).toBe("none");
    expect(read(["story-login", "--body"]).acceptance).toBe("none");

    runComment({
      cwd: dir,
      id: "story-login",
      text: "accept: approve\n- shipped as promised",
      author: "gonzalo",
      now: NOW,
      commit: false,
    });
    expect(read(["story-login"]).acceptance).toBe("accepted");
    expect(read(["story-login", "--meta"]).acceptance).toBe("accepted");
    // The human view gained NO field line: the acceptance text visible above is
    // the item's own comment body, printed verbatim as always.
    expect(runCli(["show", "story-login"], dir).stdout).not.toMatch(/^\s+acceptance: /m);
  });

  it("reads the item's canonical body, so a comment-only acceptance is seen", () => {
    // The acceptance lives in a COMMENT, which the compact view's bounded tail
    // would hide from a reader that parsed `prose`. The field is a
    // classification over the whole body, so it cannot be clipped away.
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-comment-only-"));
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
      text: "accept: approve",
      author: "gonzalo",
      now: new Date(NOW.getTime() + 9000),
      commit: false,
    });
    const proc = runCli(["show", "story-login", "--json"], dir);
    const payload = JSON.parse(proc.stdout) as { acceptance: string; comments: unknown[] };
    expect(payload.acceptance).toBe("accepted");
    // Default tail is 3 comments: the acceptance is NOT among the bounded tail.
    expect(payload.comments).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 4. The armed `spec analyze` finding
// ---------------------------------------------------------------------------

describe("spec analyze: MISSING-PRODUCT-ACCEPTANCE", () => {
  it("is silent unless the project armed x-tracker.product-acceptance", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-unarmed-"));
    const { leaf } = seeded(dir);
    writeSpec(dir);
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "ana", now: NOW });
    runUpdate({ cwd: dir, id: leaf, status: "done", now: NOW });

    // Unarmed: nothing, even with a terminal container and no acceptance.
    expect(runSpecAnalyze({ cwd: dir }).productAcceptance).toEqual([]);
    // Armed with `false`: still nothing (the allow-steal precedent).
    arm(dir, "false");
    expect(runSpecAnalyze({ cwd: dir }).productAcceptance).toEqual([]);
    // Armed with `true`: the finding fires.
    arm(dir, "true");
    const fired = runSpecAnalyze({ cwd: dir }).productAcceptance;
    expect(fired).toHaveLength(1);
    expect(fired[0]!.kind).toBe("MISSING-PRODUCT-ACCEPTANCE");
    expect(fired[0]!.severity).toBe("warn");
    expect(fired[0]!.file).toContain("story-login");
    expect(fired[0]!.message).toContain("story-login reached done");
    expect(fired[0]!.message).toContain("accept: approve");
    // Report-only: the run still succeeds and the item is untouched.
    const proc = runCli(["spec", "analyze", "--json"], dir);
    expect(proc.status).toBe(0);
    expect(itemOf(dir, "story-login").status).toBe("done");
  });

  it("never fires on a leaf, on an open container, or on an accepted one", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-scope-"));
    const { leaf } = seeded(dir);
    arm(dir);
    writeSpec(dir);
    // The container's own checklist keeps it OPEN when its leaf closes (the
    // acceptance-aware cascade skips a container whose criteria are unmet), so
    // this assertion is about an open container, not about the cascade.
    setBody(dir, "story-login", "## Acceptance\n\n- [ ] awaiting sign-off\n");
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "ana", now: NOW });
    runUpdate({ cwd: dir, id: leaf, status: "done", now: NOW });
    expect(itemOf(dir, "story-login").status).toBe("in_progress");
    expect(runSpecAnalyze({ cwd: dir }).productAcceptance).toEqual([]);

    // The container closes: now it is reported.
    runUpdate({ cwd: dir, id: "story-login", status: "done", now: NOW });
    const fired = runSpecAnalyze({ cwd: dir }).productAcceptance;
    expect(fired.map((f) => f.file.split("/").pop())).toEqual(["story-login.md"]);

    // A leaf with no acceptance of its own is never a finding.
    expect(fired.some((f) => f.file.includes("rate-limit"))).toBe(false);

    // A late acceptance clears it on the next run (idempotent, forward-only).
    runComment({
      cwd: dir,
      id: "story-login",
      text: "accept: approve\n- accepted after the fix",
      author: "gonzalo",
      now: new Date("2026-10-06T12:00:00Z"),
      commit: false,
    });
    expect(runSpecAnalyze({ cwd: dir }).productAcceptance).toEqual([]);
  });

  it("counts self-accepted and changes-noted as gaps, and names the recorded state", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-gapstates-"));
    const { leaf } = seeded(dir);
    arm(dir);
    writeSpec(dir);
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "ana", now: NOW });
    runUpdate({ cwd: dir, id: leaf, status: "done", now: NOW });
    runUpdate({ cwd: dir, id: "story-login", status: "done", now: NOW });
    runUpdate({ cwd: dir, id: "story-billing", status: "cancelled", now: NOW });

    runComment({
      cwd: dir,
      id: "story-login",
      text: "accept: approve",
      author: "ana", // the container's own assignee
      now: NOW,
      commit: false,
    });
    runComment({
      cwd: dir,
      id: "story-billing",
      text: "accept: changes-requested",
      author: "gonzalo",
      now: NOW,
      commit: false,
    });

    const fired = runSpecAnalyze({ cwd: dir }).productAcceptance;
    const byId = new Map(fired.map((f) => [f.file, f.message]));
    expect(fired).toHaveLength(2);
    expect([...byId.values()].some((m) => m.includes("self-accepted"))).toBe(true);
    expect([...byId.values()].some((m) => m.includes("changes-noted"))).toBe(true);
    // A cancelled container is terminal too, and named with its status.
    expect([...byId.values()].some((m) => m.includes("story-billing reached cancelled"))).toBe(
      true,
    );
  });

  it("is empty in --spec single-file mode (corpus-only, like the other buckets)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-single-"));
    const { leaf } = seeded(dir);
    arm(dir);
    const specPath = writeSpec(dir);
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "ana", now: NOW });
    runUpdate({ cwd: dir, id: leaf, status: "done", now: NOW });
    runUpdate({ cwd: dir, id: "story-login", status: "done", now: NOW });
    const single = runSpecAnalyze({ cwd: dir, spec: specPath });
    expect(single.productAcceptance).toEqual([]);
  });

  it("degrades to unarmed (never fails the scan) on a malformed convention file", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-badconfig-"));
    const { leaf } = seeded(dir);
    writeSpec(dir);
    writeFileSync(
      join(dir, "ArggonManager/.convention.yml"),
      "version: 5\nx-tracker:\n  product-acceptance: maybe\n",
      "utf8",
    );
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "ana", now: NOW });
    runUpdate({ cwd: dir, id: leaf, status: "done", now: NOW });
    runUpdate({ cwd: dir, id: "story-login", status: "done", now: NOW });
    // The scan completes, reports nothing, and the config error stays where it
    // belongs: `arggon validate` owns malformed `.convention.yml` files.
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.productAcceptance).toEqual([]);
    expect(runCli(["validate", "--json"], dir).stdout).toContain("INVALID_BRANCH_PATTERN");
  });
});

describe("x-tracker.reap-acked-orphans parsing (allow-steal precedent)", () => {
  it("defaults to null when absent, and reads true/false", () => {
    // Default-refused, like `allow-steal`: the flag only ever widens what a
    // repo has explicitly chosen to allow (task-adapter-orphan-reaping).
    expect(parseConventionConfig("version: 5\n").tracker.reapAckedOrphans).toBeNull();
    expect(
      parseConventionConfig("version: 5\nx-tracker:\n  auto-commit: false\n").tracker
        .reapAckedOrphans,
    ).toBeNull();
    expect(
      parseConventionConfig("x-tracker:\n  reap-acked-orphans: true\n").tracker.reapAckedOrphans,
    ).toBe(true);
    expect(
      parseConventionConfig("x-tracker:\n  reap-acked-orphans: false\n").tracker.reapAckedOrphans,
    ).toBe(false);
  });

  it("is a parse error on a non-boolean value", () => {
    expect(() => parseConventionConfig("x-tracker:\n  reap-acked-orphans: maybe\n")).toThrow(
      /'reap-acked-orphans' must be a boolean/,
    );
    expect(() => parseConventionConfig("x-tracker:\n  reap-acked-orphans: 1\n")).toThrow(
      /'reap-acked-orphans' must be a boolean/,
    );
  });

  it("ignores an unknown nested key (forward compat)", () => {
    expect(
      parseConventionConfig("x-tracker:\n  reap-acked-orphans-typo: true\n").tracker
        .reapAckedOrphans,
    ).toBeNull();
  });
});

describe("x-tracker.product-acceptance parsing (allow-steal precedent)", () => {
  it("defaults to null when absent, and reads true/false", () => {
    expect(parseConventionConfig("version: 5\n").tracker.productAcceptance).toBeNull();
    expect(
      parseConventionConfig("version: 5\nx-tracker:\n  auto-commit: false\n").tracker
        .productAcceptance,
    ).toBeNull();
    expect(
      parseConventionConfig("x-tracker:\n  product-acceptance: true\n").tracker.productAcceptance,
    ).toBe(true);
    expect(
      parseConventionConfig("x-tracker:\n  product-acceptance: false\n").tracker.productAcceptance,
    ).toBe(false);
  });

  it("is a parse error on a non-boolean value", () => {
    expect(() => parseConventionConfig("x-tracker:\n  product-acceptance: maybe\n")).toThrow(
      /'product-acceptance' must be a boolean/,
    );
  });

  it("ignores an unknown nested key (forward compat)", () => {
    expect(
      parseConventionConfig("x-tracker:\n  product-acceptance-typo: true\n").tracker
        .productAcceptance,
    ).toBeNull();
  });

  it("reads the arming flag from the tree, and never throws on a broken config", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-armed-"));
    seeded(dir);
    expect(productAcceptanceArmed(dir)).toBe(false);
    arm(dir, "false");
    expect(productAcceptanceArmed(dir)).toBe(false);
    arm(dir, "true");
    expect(productAcceptanceArmed(dir)).toBe(true);
    writeFileSync(
      join(dir, "ArggonManager/.convention.yml"),
      "version: 5\nx-tracker:\n  product-acceptance: maybe\n",
      "utf8",
    );
    expect(productAcceptanceArmed(dir)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. AC 8 — no gate anywhere
// ---------------------------------------------------------------------------

describe("report-only: the done gate and the cascade never read the acceptance", () => {
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

  it("the cascade completes the same containers with and without an accept: comment", () => {
    const verdict = (withAcceptance: boolean): string[] => {
      const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-nogate-"));
      const { leaf } = gatedTree(dir);
      if (withAcceptance) {
        runComment({
          cwd: dir,
          id: "story-login",
          text: "accept: approve\n- shipped as promised",
          author: "gonzalo",
          now: NOW,
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

  it("the done gate refuses on the same body whatever the acceptance says", () => {
    const refusal = (withAcceptance: boolean): string => {
      const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-nogate-leaf-"));
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
      // A product acceptance on the LEAF — the wrong place for one, and
      // emphatically not a waiver.
      runComment({
        cwd: dir,
        id: leaf.id,
        text: "accept: approve",
        author: "gonzalo",
        now: NOW,
        commit: false,
      });
      runUpdate({ cwd: dir, id: leaf.id, status: "in_progress", assignee: "ana", now: NOW });
      try {
        runUpdate({ cwd: dir, id: leaf.id, status: "done", now: NOW });
        return "flipped";
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      } finally {
        if (!withAcceptance) {
          // Same tree, minus the comment: the refusal must be byte-identical.
          expect(itemOf(dir, leaf.id).status).toBe("in_progress");
        }
      }
    };

    expect(refusal(true)).toMatch(/unchecked boxes[\s\S]*--waive "<reason>"/);
    expect(refusal(false)).toBe(refusal(true));
  });
});

// ---------------------------------------------------------------------------
// 6. The kernel selector, and `sync` staying byte-identical
// ---------------------------------------------------------------------------

describe("containersMissingAcceptance", () => {
  it("scopes the convention to story containers and returns them sorted by id", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-selector-"));
    const { leaf } = seeded(dir);
    runUpdate({ cwd: dir, id: "story-login", status: "in_progress", assignee: "ana", now: NOW });
    runUpdate({ cwd: dir, id: leaf, status: "done", now: NOW });
    runUpdate({ cwd: dir, id: "story-login", status: "done", now: NOW });
    runUpdate({ cwd: dir, id: "story-billing", status: "cancelled", now: NOW });
    // The epic/initiative levels are out of scope by construction, even though
    // the cascade completed them.
    runUpdate({ cwd: dir, id: "auth", status: "done", now: NOW });

    expect([...ACCEPTANCE_CONTAINER_TYPES]).toEqual(["story"]);
    const gaps = containersMissingAcceptance(loadItems(findTasksDir(dir)));
    expect(gaps.map((gap) => `${gap.item.id}:${gap.state}`)).toEqual([
      "story-billing:none",
      "story-login:none",
    ]);
    // An accepted container drops out; the epic never entered.
    runComment({
      cwd: dir,
      id: "story-billing",
      text: "accept: approve",
      author: "gonzalo",
      now: new Date("2026-10-07T12:00:00Z"),
      commit: false,
    });
    expect(
      containersMissingAcceptance(loadItems(findTasksDir(dir))).map((gap) => gap.item.id),
    ).toEqual(["story-login"]);
  });
});

/**
 * `sync` is NOT a surface for this convention, and this is the regression guard
 * for that decision (spec promotion-policy-018, the dated amendment to ADR 0021
 * §4): `sync` classifies only the items it reconciles with an OPEN PR, and a
 * container never carries one — so a container's acceptance could never appear
 * there. `report` and `show` are the surfaces that can.
 */
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

/** Replace an item's body wholesale (the frontmatter is kept). */
function setBody(dir: string, id: string, body: string): void {
  const path = itemOf(dir, id).filePath;
  const raw = readFileSync(path, "utf8");
  const end = raw.indexOf("\n---\n");
  if (end < 0) throw new Error(`setBody: no frontmatter terminator in ${path}`);
  writeFileSync(path, `${raw.slice(0, end + 5)}\n${body}`, "utf8");
}

describe("sync stays byte-identical", () => {
  it("carries no acceptance field, and its verdicts ignore an accept: comment", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-acceptance-sync-"));
    const { leaf } = seeded(dir);
    arm(dir);
    // The leaf reconciles with an open PR and carries BOTH headers.
    setField(dir, leaf, { branch: "feat/rate-limit" });
    runComment({
      cwd: dir,
      id: leaf,
      text: "accept: approve\n- and a product acceptance that has no business here",
      author: "gonzalo",
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
    // The review verdict is still classified; the product acceptance is invisible.
    expect(result.verdicts).toEqual({ [leaf]: "approved" });
  });
});
