import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseConventionConfig, runPriorityMigrate } from "@arggondev/lib";

// bug-…/task-priority-field-schema: `arggon priority migrate` moves the legacy
// pN LABEL convention into the v4 `priority` field (highest priority = lowest
// number wins), strips every pN label, keeps non-priority labels, never
// clobbers an explicit field, never auto-commits, idempotent.

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** Minimal tracked tree: tasks/.convention.yml + hand-written item files. */
function makeRepo(): string {
  const dir = mkdtempSync("arggon-priority-migrate-");
  const tasks = join(dir, "tasks");
  mkdirSync(tasks, { recursive: true });
  writeFileSync(join(tasks, ".convention.yml"), "version: 3\n", "utf8");
  const item = (rel: string, frontmatter: string): void => {
    const abs = join(tasks, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, `---\n${frontmatter}---\n\n# item\n`, "utf8");
  };
  item(
    "launch/launch.md",
    'type: initiative\nstatus: todo\nid: launch\nlabels: [p1, growth]\ncreated: "2026-09-17"\nupdated: "2026-09-17"\n',
  );
  item(
    "launch/epic-a/epic-a.md",
    'type: epic\nstatus: todo\nid: epic-a\nparent: launch\nlabels: [p3, p1, viewer]\ncreated: "2026-09-17"\nupdated: "2026-09-17"\n',
  );
  item(
    "launch/epic-a/story-a/task-a/task-a.md",
    'type: task\nstatus: todo\nid: task-a\nparent: story-a\nlabels: [p2]\npriority: p0\ncreated: "2026-09-17"\nupdated: "2026-09-17"\n',
  );
  item(
    "launch/epic-a/story-a/story-a.md",
    'type: story\nstatus: todo\nid: story-a\nparent: epic-a\nlabels: []\ncreated: "2026-09-17"\nupdated: "2026-09-17"\n',
  );
  return dir;
}

function itemRaw(dir: string, rel: string): string {
  return readFileSync(join(dir, "tasks", rel), "utf8");
}

describe("arggon priority migrate (task-priority-field-schema)", () => {
  it("moves the highest-priority pN label into the field and strips every pN label", () => {
    const dir = makeRepo();
    const result = runPriorityMigrate({ cwd: dir });
    expect(result.changed).toBe(3);
    const epic = result.entries.find((e) => e.id === "epic-a")!;
    expect(epic.priority).toBe("p1"); // highest of [p3, p1]
    expect(epic.labelsRemoved).toEqual(["p1", "p3"]);
    expect(epic.prioritySource).toBe("label");
    const raw = itemRaw(dir, "launch/epic-a/epic-a.md");
    expect(raw).toContain("priority: p1");
    expect(raw).toContain("labels: [viewer]"); // non-priority labels ride along
    expect(raw).not.toMatch(/labels:.*p[0-9]/);
  });

  it("keeps an explicit field over stale labels and reports the conflict", () => {
    const dir = makeRepo();
    const result = runPriorityMigrate({ cwd: dir });
    const task = result.entries.find((e) => e.id === "task-a")!;
    expect(task.prioritySource).toBe("kept-explicit");
    expect(task.priority).toBe("p0");
    expect(task.conflictLabel).toBe("p2");
    const raw = itemRaw(dir, "launch/epic-a/story-a/task-a/task-a.md");
    expect(raw).toContain("priority: p0"); // deliberate value never clobbered
    expect(raw).not.toMatch(/labels:.*p[0-9]/);
  });

  it("is idempotent: a second run is a zero-change scan", () => {
    const dir = makeRepo();
    runPriorityMigrate({ cwd: dir });
    const second = runPriorityMigrate({ cwd: dir });
    expect(second.changed).toBe(0);
    expect(second.entries).toEqual([]);
    expect(second.scanned).toBeGreaterThan(0);
  });

  it("dry-run reports the plan and writes nothing", () => {
    const dir = makeRepo();
    const before = [
      itemRaw(dir, "launch/launch.md"),
      itemRaw(dir, "launch/epic-a/epic-a.md"),
      itemRaw(dir, "launch/epic-a/story-a/task-a/task-a.md"),
    ];
    const result = runPriorityMigrate({ cwd: dir, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.changed).toBe(3);
    expect(itemRaw(dir, "launch/launch.md")).toBe(before[0]!);
    expect(itemRaw(dir, "launch/epic-a/epic-a.md")).toBe(before[1]!);
    expect(itemRaw(dir, "launch/epic-a/story-a/task-a/task-a.md")).toBe(before[2]!);
  });

  it("items without pN labels never participate", () => {
    const dir = makeRepo();
    const result = runPriorityMigrate({ cwd: dir });
    expect(result.entries.find((e) => e.id === "story-a")).toBeUndefined();
    expect(itemRaw(dir, "launch/epic-a/story-a/story-a.md")).toContain("labels: []");
  });

  it("does not commit: the caller reviews and lands one explicit commit", () => {
    const dir = makeRepo();
    // No git repo here at all — the kernel must not care (no exec, no commit):
    // it writes bytes and reports; repo-level git state stays untouched.
    runPriorityMigrate({ cwd: dir });
    expect(existsSync(join(dir, ".git"))).toBe(false);
    expect(
      parseConventionConfig(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).version,
    ).toBe(3);
  });
});
