import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  claimCommitFaults,
  installDrift,
  installFingerprint,
  isInside,
  NATIVE_RECEIPT_LIMITS,
  receiptOverBudget,
} from "./native-start-cold-smoke.js";

// Unit tests for the harness's pure predicates — the same split as
// smoke/tui-board-smoke.test.ts: the cold-start run itself needs git, a
// disposable fixture and a real pre-commit gate (it is driven by
// `npm run smoke:native-start-cold`), while what decides each check is the
// logic pinned here. An empty array means "the observation held".

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A temp checkout whose `node_modules` carries the named entries. */
function installFixture(entries: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-cold-smoke-unit-"));
  tmpDirs.push(dir);
  mkdirSync(join(dir, "node_modules"));
  for (const entry of entries) {
    const path = join(dir, "node_modules", entry);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "package.json"), `{ "name": "${entry}" }\n`, "utf8");
  }
  return dir;
}

describe("native-start-cold-smoke: isInside", () => {
  it("accepts the root itself and anything under it", () => {
    expect(isInside("/a/repo", "/a/repo")).toBe(true);
    expect(isInside("/a/repo", "/a/repo/lib/dist/index.js")).toBe(true);
    expect(isInside("/a/repo/", "/a/repo/node_modules")).toBe(true);
  });

  it("rejects a sibling, a parent and a same-prefixed sibling directory", () => {
    // The trap the runtime check exists for: `/a/repo-primary` must not read as
    // inside `/a/repo`, which is how a stale primary build would sneak in.
    expect(isInside("/a/repo", "/a/repo-primary/lib/dist/index.js")).toBe(false);
    expect(isInside("/a/repo", "/a/repo-other")).toBe(false);
    expect(isInside("/a/repo/lib", "/a/repo")).toBe(false);
  });

  it("resolves relative paths before comparing", () => {
    expect(isInside("smoke", "smoke/native-start-cold-smoke.ts")).toBe(true);
  });
});

describe("native-start-cold-smoke: installFingerprint / installDrift", () => {
  it("reports no drift for an untouched install", () => {
    const dir = installFixture(["native-gate-dep", "commander"]);
    expect(installDrift(installFingerprint(dir), installFingerprint(dir))).toEqual([]);
  });

  it("reports the emptied-install signature (count, entry set and clock)", () => {
    const before = installFingerprint(installFixture(["native-gate-dep", "commander"]));
    rmSync(join(before.path, "commander"), { recursive: true, force: true });
    // Pin the directory clock before comparing. Whether the kernel re-stamps a
    // directory mtime on an unlink depends on the tick the removal landed in, so
    // leaving it to chance made this assertion machine-speed dependent (it
    // passed locally and failed on the CI runner). The count and the entry-set
    // digest are the load-bearing "was it emptied?" signals; the mtime adds the
    // reification case where the same names come back re-linked.
    const pinned = new Date(1_000_000_000_000);
    utimesSync(before.path, pinned, pinned);
    const after = installFingerprint(before.path.replace(/\/node_modules$/, ""));
    expect(installDrift(before, after)).toEqual([
      "entry count 2 -> 1",
      expect.stringContaining("entry set changed"),
      `mtime ${before.mtimeMs} -> ${pinned.getTime()}`,
    ]);
  });

  it("reports a reified install (same entries, new mtime) as drift", () => {
    const dir = installFixture(["native-gate-dep"]);
    const before = installFingerprint(dir);
    const later = new Date(before.mtimeMs + 60_000);
    utimesSync(join(dir, "node_modules"), later, later);
    expect(installDrift(before, installFingerprint(dir))).toEqual([
      `mtime ${before.mtimeMs} -> ${later.getTime()}`,
    ]);
  });

  it("compares by content, and never by clock, across two different installs", () => {
    const one = installFixture(["native-gate-dep"]);
    const other = installFixture(["native-gate-dep"]);
    const [a, b] = [installFingerprint(one), installFingerprint(other)];
    expect(a.names).toBe(b.names);
    // An mtime belongs to one directory: two identical installs created moments
    // apart are not drift, however far apart their clocks read.
    expect(installDrift(a, b)).toEqual([]);
    mkdirSync(join(other, "node_modules", "commander"), { recursive: true });
    expect(installDrift(a, installFingerprint(other))).toEqual([
      "entry count 1 -> 2",
      expect.stringContaining("entry set changed"),
    ]);
  });

  it("fingerprints the directory, not the whole tree", () => {
    const dir = installFixture(["native-gate-dep"]);
    writeFileSync(join(dir, "node_modules", "native-gate-dep", "index.js"), "x\n", "utf8");
    const before = installFingerprint(dir);
    writeFileSync(join(dir, "node_modules", "native-gate-dep", "index.js"), "y\n", "utf8");
    // A file's content change inside a package is npm's business, not a start
    // decision; the smoke asserts install SHAPE, and says so.
    expect(installDrift(before, installFingerprint(dir))).toEqual([]);
    expect(readdirSync(before.path).sort()).toEqual(
      [".", "native-gate-dep"].filter((e) => e !== "."),
    );
  });
});

describe("native-start-cold-smoke: claimCommitFaults", () => {
  const item = "ArggonManager/native-start/worktree/cold-start/task-cold-start-smoke.md";

  it("accepts a claim commit with exactly the item file", () => {
    expect(claimCommitFaults([item], item)).toEqual([]);
  });

  it("names every non-item path the claim commit swept in", () => {
    expect(claimCommitFaults([item, "node_modules", ".native-gate-ran"], item)).toEqual([
      "stages 2 non-item path(s): node_modules, .native-gate-ran",
    ]);
  });

  it("reports a claim commit that never staged the item file", () => {
    expect(claimCommitFaults([], item)).toEqual([`does not stage the item file ${item}`]);
    expect(claimCommitFaults(["a.txt"], item)).toEqual([
      "stages 1 non-item path(s): a.txt",
      `does not stage the item file ${item}`,
    ]);
  });
});

describe("native-start-cold-smoke: receiptOverBudget", () => {
  it("accepts the readiness receipt the native start path returns", () => {
    expect(
      receiptOverBudget({
        ready: true,
        install: "linked",
        linkedNodeModules: true,
        builtWorkspaces: ["@arggondev/lib"],
        linkedWorkspaces: [],
      }),
    ).toEqual([]);
  });

  it("accepts a claim-commit receipt and reports an over-long value", () => {
    expect(receiptOverBudget({ hash: "abc1234", message: "chore(tasks): claimed task-x" })).toEqual(
      [],
    );
    const over = receiptOverBudget({
      skipped: "x".repeat(NATIVE_RECEIPT_LIMITS.maxValueChars + 1),
    });
    expect(over).toEqual([
      `skipped is ${NATIVE_RECEIPT_LIMITS.maxValueChars + 1} chars (max ${NATIVE_RECEIPT_LIMITS.maxValueChars})`,
    ]);
  });

  it("caps the number of reported names and the length of each", () => {
    const names = Array.from({ length: NATIVE_RECEIPT_LIMITS.maxNames + 1 }, (_, i) => `pkg-${i}`);
    expect(receiptOverBudget({ linkedWorkspaces: names })).toEqual([
      `linkedWorkspaces carries ${NATIVE_RECEIPT_LIMITS.maxNames + 1} names (max ${NATIVE_RECEIPT_LIMITS.maxNames})`,
    ]);
    expect(
      receiptOverBudget({ linkedWorkspaces: ["n".repeat(NATIVE_RECEIPT_LIMITS.maxNameChars + 1)] }),
    ).toEqual([
      `linkedWorkspaces[0] is ${NATIVE_RECEIPT_LIMITS.maxNameChars + 1} chars (max ${NATIVE_RECEIPT_LIMITS.maxNameChars})`,
    ]);
  });

  it("caps the whole receipt, so many bounded fields still cannot grow without limit", () => {
    const receipt = {
      linkedWorkspaces: Array.from(
        { length: NATIVE_RECEIPT_LIMITS.maxNames },
        (_, i) => `a-rather-long-workspace-name-${i}`,
      ),
    };
    const over = receiptOverBudget(receipt);
    expect(over).toHaveLength(1);
    expect(over[0]).toContain(`bytes (max ${NATIVE_RECEIPT_LIMITS.maxBytes})`);
  });
});
