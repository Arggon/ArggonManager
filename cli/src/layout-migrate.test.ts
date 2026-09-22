/**
 * `arggon migrate --layout` (ADR 0012, convention v5): legacy `tasks/` trees
 * move to the `ArggonManager/` root with the product docs under
 * `ArggonManager/docs/`. The migration is convergent and idempotent, keeps
 * file bytes intact, rewrites only the machine-written `x-generated`
 * destination keys (and the `version:` line), and never auto-commits.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLayoutMigrate } from "./layout-migrate.js";
import { findTrackerLocation, runValidate, trackerAt } from "@arggondev/lib";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

const TASK_MD = `---
type: task
status: todo
id: task-one
parent: story-one
created: "2026-09-18"
updated: "2026-09-18"
---

# One
`;

const STORY_MD = `---
type: story
status: todo
id: story-one
parent: epic-one
created: "2026-09-18"
updated: "2026-09-18"
---

# Story
`;

const EPIC_MD = `---
type: epic
status: todo
id: epic-one
parent: init-one
created: "2026-09-18"
updated: "2026-09-18"
---

# Epic
`;

const INIT_MD = `---
type: initiative
status: todo
id: init-one
created: "2026-09-18"
updated: "2026-09-18"
---

# Initiative
`;

/** Legacy tree: tasks/ tracker (v3) + root docs/ with a generated tracking.md. */
function legacyTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-migrate-"));
  const tree = join(dir, "tasks", "init-one", "epic-one", "story-one");
  mkdirSync(tree, { recursive: true });
  writeFileSync(join(dir, "tasks/init-one/init-one.md"), INIT_MD, "utf8");
  writeFileSync(join(dir, "tasks/init-one/epic-one/epic-one.md"), EPIC_MD, "utf8");
  writeFileSync(join(dir, "tasks/init-one/epic-one/story-one/story-one.md"), STORY_MD, "utf8");
  writeFileSync(join(tree, "task-one.md"), TASK_MD, "utf8");
  writeFileSync(
    join(dir, "tasks/.convention.yml"),
    [
      "version: 3",
      "branch_patterns:",
      '  initiative: "feat/{id}"',
      '  epic: "feat/{id}"',
      '  story: "feat/{id}"',
      '  task: "feat/{id}"',
      '  bug: "fix/{id}"',
      "",
      "x-generated:",
      '  projectName: "acme"',
      "  docs/tracking.md:",
      '    template: "docs/tracking.md"',
      '    checksum: "sha256:aaa"',
      '    arggonVersion: "0.3.0"',
      '    generatedAt: "2026-09-18T00:00:00.000Z"',
      "",
    ].join("\n"),
    "utf8",
  );
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs/tracking.md"), "tracking bytes\n", "utf8");
  writeFileSync(join(dir, "docs/notes.md"), "adopter notes\n", "utf8");
  return dir;
}

describe("runLayoutMigrate", () => {
  it("moves tasks/ and docs/, bumps the version, and rewrites x-generated keys", () => {
    const dir = legacyTree();
    const result = runLayoutMigrate({ cwd: dir });

    expect(result.changed).toBe(true);
    expect(result.alreadyMigrated).toBe(false);
    expect(result.trackerMove).toEqual({
      from: join(dir, "tasks"),
      to: join(dir, "ArggonManager"),
    });
    expect(result.docsMove).toEqual({
      from: join(dir, "docs"),
      to: join(dir, "ArggonManager", "docs"),
    });
    expect(result.versionBump).toEqual({ from: 3, to: 5 });
    expect(result.rewrittenGeneratedPaths).toEqual([
      { from: "docs/tracking.md", to: "ArggonManager/docs/tracking.md" },
    ]);

    // Tracker and docs moved; bytes intact (provenance-safe).
    expect(existsSync(join(dir, "tasks"))).toBe(false);
    expect(existsSync(join(dir, "docs"))).toBe(false);
    expect(readFileSync(join(dir, "ArggonManager/docs/tracking.md"), "utf8")).toBe(
      "tracking bytes\n",
    );
    expect(readFileSync(join(dir, "ArggonManager/docs/notes.md"), "utf8")).toBe("adopter notes\n");
    expect(readFileSync(join(dir, "ArggonManager/init-one/init-one.md"), "utf8")).toBe(INIT_MD);
    const yml = readFileSync(join(dir, "ArggonManager/.convention.yml"), "utf8");
    expect(yml).toContain("version: 5");
    expect(yml).toContain("ArggonManager/docs/tracking.md:");
    expect(yml).not.toContain("\n  docs/tracking.md:");
    expect(yml).toContain('projectName: "acme"');

    // Detection follows the moved tree; validate reports the v5 layout.
    const loc = findTrackerLocation(dir);
    expect(loc.layout).toBe("arggon-manager");
    const validation = runValidate({ cwd: dir });
    expect(validation.errors).toEqual([]);
    expect(validation.layout).toBe("arggon-manager");
    expect(validation.warnings.map((w) => w.code)).not.toContain("LEGACY_LAYOUT");
  });

  it("is idempotent: a second run changes nothing and keeps the bytes", () => {
    const dir = legacyTree();
    runLayoutMigrate({ cwd: dir });
    const before = readFileSync(join(dir, "ArggonManager/.convention.yml"), "utf8");

    const second = runLayoutMigrate({ cwd: dir });
    expect(second.alreadyMigrated).toBe(true);
    expect(second.changed).toBe(false);
    expect(second.trackerMove).toBeNull();
    expect(second.docsMove).toBeNull();
    expect(second.versionBump).toBeNull();
    expect(second.rewrittenGeneratedPaths).toEqual([]);
    expect(readFileSync(join(dir, "ArggonManager/.convention.yml"), "utf8")).toBe(before);
  });

  it("--dry-run plans every action and writes NOTHING", () => {
    const dir = legacyTree();
    const before = readFileSync(join(dir, "tasks/.convention.yml"), "utf8");

    const result = runLayoutMigrate({ cwd: dir, dryRun: true });
    expect(result.changed).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(existsSync(join(dir, "tasks"))).toBe(true);
    expect(existsSync(join(dir, "ArggonManager"))).toBe(false);
    expect(existsSync(join(dir, "docs"))).toBe(true);
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toBe(before);
  });

  it("converges when the tracker already moved but docs/ is still at the root", () => {
    const dir = legacyTree();
    // The `git mv tasks ArggonManager` half of a manual migration.
    runLayoutMigrate({ cwd: dir });
    // Recreate the pre-docs-move shape: docs back at the root.
    renameSync(join(dir, "ArggonManager", "docs"), join(dir, "docs"));

    const result = runLayoutMigrate({ cwd: dir });
    expect(result.trackerMove).toBeNull();
    expect(result.docsMove).toEqual({
      from: join(dir, "docs"),
      to: join(dir, "ArggonManager", "docs"),
    });
    expect(result.alreadyMigrated).toBe(false);
    expect(existsSync(join(dir, "ArggonManager/docs/tracking.md"))).toBe(true);
  });

  it("moves the tracker even when no docs/ dir exists", () => {
    const dir = legacyTree();
    rmSync(join(dir, "docs"), { recursive: true, force: true });
    const result = runLayoutMigrate({ cwd: dir });
    expect(result.docsMove).toBeNull();
    expect(result.trackerMove).not.toBeNull();
    expect(trackerAt(dir)?.layout).toBe("arggon-manager");
  });

  it("refuses to guess when both roots carry a tracker", () => {
    const dir = legacyTree();
    mkdirSync(join(dir, "ArggonManager"), { recursive: true });
    writeFileSync(join(dir, "ArggonManager/.convention.yml"), "version: 5\n", "utf8");
    expect(() => runLayoutMigrate({ cwd: dir })).toThrow(/refusing to guess/);
  });

  it("refuses when the destination tracker dir already exists", () => {
    const dir = legacyTree();
    mkdirSync(join(dir, "ArggonManager"), { recursive: true });
    expect(() => runLayoutMigrate({ cwd: dir })).toThrow(/already exists/);
  });

  it("refuses to merge two docs trees silently", () => {
    const dir = legacyTree();
    // Move only the tracker (manual half-migration) so both docs dirs exist.
    runLayoutMigrate({ cwd: dir });
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/extra.md"), "x\n", "utf8");
    expect(() => runLayoutMigrate({ cwd: dir })).toThrow(
      /refusing to\s+merge|reconcile the two docs trees/,
    );
  });

  it("throws a clear error when no tracker exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-migrate-none-"));
    expect(() => runLayoutMigrate({ cwd: dir })).toThrow(/No ArggonManager\/ convention found/);
  });
});
