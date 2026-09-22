/**
 * Kernel library surface (W1 `task-native-kernel-lib`, repackaged as
 * `@arggondev/lib` by W1b/ADR 0013): the package entry is the one path the
 * machine surfaces (CLI today; MCP adapter; native tools in W2/W3) consume,
 * and the operations return the documented `--json` envelopes with the CLI's
 * exit-code semantics.
 *
 * The clean-build import and the CLI byte parity of those envelopes are pinned
 * in lib-build.test.ts; this file drives the entry in process (vitest resolves
 * `@arggondev/lib` to the source entry, so no build is required). The entry's
 * re-export-by-identity contract is pinned where the modules live
 * (`lib/src/index.test.ts` — comparing the entry against itself here could
 * never fail; W6/PR-374 review finding 3).
 */
import { mkdtempSync as _mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate } from "@arggondev/lib";
import { runInit } from "./init.js";
import * as lib from "@arggondev/lib";
import { removeFixtureTree } from "./test-tmp.js";

/**
 * The kernel entrypoints the tools need, by category (ADR 0011 §4 / plan
 * native-first-011 W1): items, rules, paths, `--json` envelopes, operations.
 * Adding names is fine; removing one of these breaks machine surfaces.
 */
const REQUIRED_EXPORTS = [
  // items + contract
  "loadItems",
  "itemsById",
  "tryLoadItem",
  "softTryLoadItem",
  "walkTasksTree",
  "acceptanceComplete",
  "parseFrontmatter",
  "stringifyFrontmatter",
  "toContractWorkItem",
  // rules (rules.ts is the single source; primitives it builds on)
  "assertUpdateRules",
  "canTransition",
  "isClaimed",
  "isClaimable",
  "unclaim",
  "assertClaimAndBlocked",
  "assertParentEdge",
  "expectedParentType",
  "itemId",
  "slugify",
  "assertLabels",
  "assertBranchName",
  // paths
  "TRACKER_DIR_NAME",
  "LEGACY_TRACKER_DIR_NAME",
  "CONVENTION_FILE_NAME",
  "trackerAt",
  "findTrackerLocation",
  "findTasksDir",
  "repoRootFromTasks",
  "newItemPath",
  "readConventionVersion",
  // envelopes
  "JSON_SCHEMA_VERSION",
  "successEnvelope",
  "failEnvelope",
  "compactWorkItem",
  "commitPayload",
  // operations (one per command the tool namespace exposes)
  "listOperation",
  "createOperation",
  "updateOperation",
  "showOperation",
  "nextOperation",
  "reportOperation",
  "validateOperation",
  "commentOperation",
  "handoffOperation",
  "priorityOperation",
  "syncOperation",
  "importIssuesOperation",
] as const;

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});
function mkdtemp(prefix: string): string {
  const dir = _mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** Minimal initialized tree: initiative → epic → story + one leaf task. */
function seedTree(): string {
  const dir = mkdtemp("arggon-lib-");
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP" });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp" });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login" });
  runCreate({
    cwd: dir,
    type: "task",
    title: "Add rate limiting",
    parent: "story-login",
    id: "rate-limit",
  });
  return dir;
}

/** Unwrap a success outcome (fails the test when the operation errored). */
function success<P extends lib.EnvelopePayload>(
  outcome: lib.CommandOutcome<P>,
): lib.KernelSuccessEnvelope<P> {
  expect(outcome.ok, JSON.stringify(outcome.envelope)).toBe(true);
  if (!outcome.ok) throw new Error("expected a success outcome");
  return outcome.envelope;
}

/**
 * Unwrap a failure outcome (fails the test when the operation succeeded).
 * `outcome.error` is present for thrown kernel failures; pure reads that report
 * problems (validate) return the failure envelope without a thrown error.
 */
function failure<P extends lib.EnvelopePayload>(
  outcome: lib.CommandOutcome<P>,
): lib.KernelFailureEnvelope<P> {
  expect(outcome.ok, JSON.stringify(outcome.envelope)).toBe(false);
  expect(outcome.exitCode).toBe(1);
  if (outcome.ok) throw new Error("expected a failure outcome");
  return outcome.envelope;
}

describe("kernel library entry", () => {
  it("exposes the kernel entrypoints the machine surfaces need", () => {
    for (const name of REQUIRED_EXPORTS) {
      expect(lib[name as keyof typeof lib], `missing library export '${name}'`).toBeDefined();
    }
    expect(typeof lib.listOperation).toBe("function");
    expect(typeof lib.assertUpdateRules).toBe("function");
    expect(typeof lib.toContractWorkItem).toBe("function");
    expect(typeof lib.successEnvelope).toBe("function");
  });
});

describe("operations", () => {
  it("list returns the documented success envelope", () => {
    const dir = seedTree();
    const outcome = lib.listOperation({ cwd: dir, type: "task" });
    const envelope = success(outcome);
    expect(outcome.exitCode).toBe(0);
    expect(envelope).toMatchObject({
      ok: true,
      schemaVersion: lib.JSON_SCHEMA_VERSION,
      command: "list",
      conventionVersion: 5,
    });
    const items = envelope.items as Array<{ id: string; blocked_reason?: unknown }>;
    expect(items.map((item) => item.id)).toEqual(["task-rate-limit"]);
    // Compact ADR 0006 default: null optional fields are omitted.
    expect(items[0]).not.toHaveProperty("blocked_reason");

    const full = success(lib.listOperation({ cwd: dir, type: "task", full: true }));
    const fullItems = full.items as Array<{ id: string; blocked_reason: unknown }>;
    expect(fullItems[0]!.blocked_reason).toBeNull();
  });

  it("show/next/report/validate return their envelope shapes in process", () => {
    const dir = seedTree();

    const shown = success(lib.showOperation({ cwd: dir, id: "story-login" }));
    expect(shown.command).toBe("show");
    // show.path is the absolute item path (documented contract).
    expect(shown.path).toBe(
      resolve(dir, "ArggonManager/launch-mvp/auth/story-login/story-login.md"),
    );
    expect(shown.comments).toEqual([]);

    const next = success(lib.nextOperation({ cwd: dir }));
    const suggestion = next.suggestion as { item: { id: string } } | null;
    expect(suggestion?.item.id).toBe("task-rate-limit");

    const report = success(lib.reportOperation({ cwd: dir }));
    expect(report.command).toBe("report");
    expect(Array.isArray(report.groups)).toBe(true);
    expect(report).not.toHaveProperty("trend");

    const validated = success(lib.validateOperation({ cwd: dir }));
    expect(validated).toMatchObject({ command: "validate", ok: true, layout: "arggon-manager" });
    expect(validated.errors).toEqual([]);
  });

  it("a kernel failure comes back as the documented ok:false envelope", () => {
    const dir = seedTree();
    const outcome = lib.showOperation({ cwd: dir, id: "nope" });
    const envelope = failure(outcome);
    if (outcome.ok) throw new Error("expected a failure outcome");
    expect(outcome.error).toBeInstanceOf(Error);
    expect(envelope).toMatchObject({
      ok: false,
      command: "show",
      schemaVersion: lib.JSON_SCHEMA_VERSION,
      error: { code: "SHOW_FAILED" },
    });
  });

  it("a tracker-less cwd fails list with LIST_FAILED (no throw escapes)", () => {
    const outcome = lib.listOperation({ cwd: mkdtemp("arggon-lib-empty-") });
    const envelope = failure(outcome);
    expect(envelope.error.code).toBe("LIST_FAILED");
    expect(envelope.error.message).toContain("arggon init");
  });

  it("validate flips to ok:false and exitCode 1 when the tree has errors", () => {
    const dir = seedTree();
    const itemPath = resolve(dir, "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md");
    writeFileSync(
      itemPath,
      readFileSync(itemPath, "utf8").replace("status: todo", "status: blocked"),
    );
    const outcome = lib.validateOperation({ cwd: dir });
    const envelope = failure(outcome);
    expect(envelope).toMatchObject({ command: "validate", ok: false });
    expect(envelope.errors).not.toEqual([]);
    expect(envelope.error).toMatchObject({ code: "VALIDATE_FAILED" });
  });

  it("update runs the shared rules (agent callers cannot reopen done items)", () => {
    const dir = seedTree();
    success(
      lib.updateOperation({
        cwd: dir,
        id: "task-rate-limit",
        status: "in_progress",
        assignee: "someone",
        agent: true,
      }),
    );
    success(lib.updateOperation({ cwd: dir, id: "task-rate-limit", status: "done", agent: true }));
    // Reopening a done item is refused by rules.ts regardless of the surface.
    const reopen = failure(
      lib.updateOperation({ cwd: dir, id: "task-rate-limit", status: "todo", agent: true }),
    );
    expect(reopen.error.code).toBe("UPDATE_FAILED");
    expect(reopen.error.message).toContain("must not reopen");
  });
});
