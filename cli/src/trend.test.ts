/**
 * Integration tests for git-history trend mining (story-report-trend):
 * temp repos with real git and fixed GIT_AUTHOR_DATE/GIT_COMMITTER_DATE
 * (deterministic fixtures), plus parseLog/isoWeekKey unit tests.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatTrendMarkdown,
  formatTrendTable,
  isoWeekKey,
  parseLog,
  parseSince,
  runTrend,
} from "./trend.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function git(args: string[], cwd: string, date?: string): void {
  const r = spawnSync("git", args, {
    encoding: "utf8",
    cwd,
    env: date
      ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
      : { ...process.env },
  });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
}

function write(rel: string, content: string): (root: string) => void {
  return (repoRoot: string) => {
    const full = join(repoRoot, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  };
}

/** Minimal work-item file: frontmatter fields in order, tiny body. */
function item(fields: Record<string, string | string[]>): string {
  const lines = Object.entries(fields).map(([key, value]) =>
    Array.isArray(value) ? `${key}: [${value.join(", ")}]` : `${key}: ${value}`,
  );
  return `---\n${lines.join("\n")}\n---\n\n# body\n`;
}

const LAUNCH = item({
  type: "initiative",
  status: "todo",
  id: "launch",
  title: "Launch",
  labels: [],
  created: '"2026-08-31"',
});
const EPIC = item({
  type: "epic",
  status: "todo",
  id: "epic-a",
  parent: "launch",
  title: "Epic A",
  labels: [],
  created: '"2026-08-31"',
});
const STORY = (status: string) =>
  item({
    type: "story",
    status,
    id: "story-a",
    parent: "epic-a",
    title: "Story A",
    labels: [],
    created: '"2026-08-31"',
  });
const LEAF = (type: string, id: string, status: string) =>
  item({ type, status, id, parent: "story-a", labels: [], created: '"2026-08-31"' });

function gitInit(dir: string): void {
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
}

function commit(dir: string, message: string, date: string): void {
  git(["add", "tasks"], dir);
  git(["commit", "--quiet", "-m", message], dir, date);
}

/**
 * Golden fixture: fixed dates, several leaves with evolving frontmatter.
 * 2026-08-31 is the Monday of ISO week 36; 2026-09-07/09 fall in week 37.
 */
function initGoldenRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-trend-"));
  gitInit(dir);
  write("tasks/.convention.yml", "version: 0\n")(dir);
  write("tasks/launch/launch.md", LAUNCH)(dir);
  write("tasks/launch/epic-a/epic-a.md", EPIC)(dir);
  write("tasks/launch/epic-a/story-a/story-a.md", STORY("todo"))(dir);
  write("tasks/launch/epic-a/story-a/task-one.md", LEAF("task", "task-one", "todo"))(dir);
  write("tasks/launch/epic-a/story-a/task-two.md", LEAF("task", "task-two", "todo"))(dir);
  write("tasks/launch/epic-a/story-a/bug-one.md", LEAF("bug", "bug-one", "todo"))(dir);
  // Quoted scalar status (stringifyFrontmatter quotes values when needed).
  write(
    "tasks/launch/epic-a/story-a/task-quoted.md",
    item({ type: "task", status: '"todo"', id: "task-quoted", parent: "story-a", labels: [], created: '"2026-08-31"' }),
  )(dir);
  write("tasks/launch/epic-a/story-a/task-stuck.md", LEAF("task", "task-stuck", "todo"))(dir);
  commit(dir, "c1: create tree", "2026-08-31T10:00:00+00:00");

  write("tasks/launch/epic-a/story-a/task-one.md", LEAF("task", "task-one", "in_progress"))(dir);
  commit(dir, "c2: claim task-one", "2026-09-01T10:00:00+00:00");

  write("tasks/launch/epic-a/story-a/task-one.md", LEAF("task", "task-one", "done"))(dir);
  write("tasks/launch/epic-a/story-a/task-two.md", LEAF("task", "task-two", "in_progress"))(dir);
  commit(dir, "c3: task-one done, task-two claimed", "2026-09-07T12:00:00+00:00");

  write("tasks/launch/epic-a/story-a/task-two.md", LEAF("task", "task-two", "done"))(dir);
  write("tasks/launch/epic-a/story-a/bug-one.md", LEAF("bug", "bug-one", "in_progress"))(dir);
  write("tasks/launch/epic-a/story-a/task-stuck.md", LEAF("task", "task-stuck", "in_progress"))(dir);
  commit(dir, "c4: task-two done, bug-one claimed", "2026-09-09T12:00:00+00:00");

  write("tasks/launch/epic-a/story-a/bug-one.md", LEAF("bug", "bug-one", "cancelled"))(dir);
  write("tasks/launch/epic-a/story-a/story-a.md", STORY("done"))(dir);
  write(
    "tasks/launch/epic-a/story-a/task-quoted.md",
    item({ type: "task", status: '"done"', id: "task-quoted", parent: "story-a", labels: [], created: '"2026-08-31"' }),
  )(dir);
  commit(dir, "c5: bug cancelled, story done, quoted done", "2026-09-09T18:00:00+00:00");
  return dir;
}

describe("runTrend (golden temp repo)", () => {
  it("buckets leaf completions by ISO week and averages cycle time per type", () => {
    const dir = initGoldenRepo();
    expect(runTrend({ cwd: dir })).toEqual({
      weeks: [{ week: "2026-W37", completions: 4 }],
      cycleTime: [
        // bug-one: claim 12:00 -> cancel 18:00 same day = 0.25d -> 0.3
        { type: "bug", avgDays: 0.3, count: 1 },
        // task-one: 6d2h (6.0833), task-two: 2d -> avg 4.0417 -> 4.0
        { type: "task", avgDays: 4, count: 2 },
      ],
    });
  });

  it("counts open items as not-completed (task-stuck, story-a excluded)", () => {
    const dir = initGoldenRepo();
    const result = runTrend({ cwd: dir });
    // 4 leaves completed, not 5 (task-stuck is open) and not 6 (story done
    // does not count — completions are leaves only).
    expect(result.weeks).toEqual([{ week: "2026-W37", completions: 4 }]);
    expect(result.cycleTime.every((c) => c.count <= 2)).toBe(true);
  });

  it("filters the considered window with --since", () => {
    const dir = initGoldenRepo();
    // Window from 2026-09-08: c4/c5 only; task-two's claim (c3) is outside,
    // so it completes without a measurable cycle time. task-quoted completes
    // at c5 (never claimed — quoted todo -> quoted done).
    expect(runTrend({ cwd: dir, since: "2026-09-08" })).toEqual({
      weeks: [{ week: "2026-W37", completions: 3 }],
      cycleTime: [{ type: "bug", avgDays: 0.3, count: 1 }],
    });
    // Window after everything: nothing left.
    expect(runTrend({ cwd: dir, since: "2026-09-10" })).toEqual({
      weeks: [],
      cycleTime: [],
    });
  });

  it("merges history across a renamed file (git mv)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-trend-rename-"));
    gitInit(dir);
    write("tasks/.convention.yml", "version: 0\n")(dir);
    write("tasks/task-r.md", LEAF("task", "task-r", "todo"))(dir);
    commit(dir, "c1: create", "2026-09-01T09:00:00+00:00");

    write("tasks/task-r.md", LEAF("task", "task-r", "in_progress"))(dir);
    commit(dir, "c2: claim", "2026-09-02T09:00:00+00:00");

    git(["mv", "tasks/task-r.md", "tasks/task-renamed.md"], dir);
    git(["commit", "--quiet", "-m", "c3: rename"], dir, "2026-09-03T09:00:00+00:00");

    write("tasks/task-renamed.md", LEAF("task", "task-r", "done"))(dir);
    commit(dir, "c4: done", "2026-09-04T09:00:00+00:00");

    expect(runTrend({ cwd: dir })).toEqual({
      weeks: [{ week: "2026-W36", completions: 1 }],
      cycleTime: [{ type: "task", avgDays: 2, count: 1 }],
    });
  });

  it("fails with an actionable error on a non-git tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-trend-nogit-"));
    write("tasks/.convention.yml", "version: 0\n")(dir);
    expect(() => runTrend({ cwd: dir })).toThrow(/git log over tasks\/ failed/);
  });

  it("returns empty series when tasks/ has no commits yet", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-trend-empty-"));
    gitInit(dir);
    write("tasks/.convention.yml", "version: 0\n")(dir);
    expect(runTrend({ cwd: dir })).toEqual({ weeks: [], cycleTime: [] });
  });

  it("accepts an injectable git executor (canned log)", () => {
    const canned = [
      "\u001efresh\u001f2026-09-09T12:00:00+00:00",
      "diff --git a/tasks/t.md b/tasks/t.md",
      "--- a/tasks/t.md",
      "+++ b/tasks/t.md",
      "@@ -1,3 +1,3 @@",
      "-status: todo",
      "+status: done",
      "",
      "\u001eolder\u001f2026-09-08T08:00:00+00:00",
      "diff --git a/tasks/t.md b/tasks/t.md",
      "@@ -1,3 +1,3 @@",
      "-status: todo",
      "+status: in_progress",
      "",
      "",
    ].join("\n");
    const dir = mkdtempSync(join(tmpdir(), "arggon-trend-canned-"));
    write("tasks/.convention.yml", "version: 0\n")(dir);
    write("tasks/t.md", LEAF("task", "t", "done"))(dir);
    const result = runTrend({ cwd: dir, execGit: () => canned });
    expect(result).toEqual({
      weeks: [{ week: "2026-W37", completions: 1 }],
      cycleTime: [{ type: "task", avgDays: 1.2, count: 1 }],
    });
  });
});

describe("parseLog", () => {
  it("attributes +status/+type lines to the b-side path and skips - lines", () => {
    const out = [
      "\u001enew\u001f2026-09-09T12:00:00+00:00",
      "diff --git a/tasks/old.md b/tasks/new.md",
      "rename from tasks/old.md",
      "rename to tasks/new.md",
      "@@ -1,4 +1,4 @@",
      "-status: todo",
      "+status: done",
      "+type: task",
      "- [ ] body checklist line stays unparsed",
    ].join("\n");
    const parsed = parseLog(out);
    expect(parsed.renames.get("tasks/old.md")).toBe("tasks/new.md");
    expect(parsed.types.get("tasks/new.md")).toBe("task");
    // Newest commit first: seq 0 is the newest.
    expect(parsed.events).toEqual([
      { seq: 0, date: "2026-09-09T12:00:00+00:00", path: "tasks/new.md", status: "done" },
    ]);
  });

  it("strips quoted scalar values", () => {
    const out = [
      "\u001ec\u001f2026-09-09T12:00:00+00:00",
      "diff --git a/tasks/t.md b/tasks/t.md",
      "@@ -1,3 +1,3 @@",
      '+status: "done"',
    ].join("\n");
    expect(parseLog(out).events[0]?.status).toBe("done");
  });
});

describe("isoWeekKey", () => {
  it("computes ISO-8601 weeks including year boundaries", () => {
    expect(isoWeekKey(new Date("2026-08-31T00:00:00Z"))).toBe("2026-W36");
    expect(isoWeekKey(new Date("2026-09-07T12:00:00Z"))).toBe("2026-W37");
    expect(isoWeekKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2025-12-29T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2024-12-30T00:00:00Z"))).toBe("2025-W01");
  });
});

describe("parseSince", () => {
  it("accepts YYYY-MM-DD and rejects anything else", () => {
    expect(parseSince("2026-09-08")).toBe(Date.parse("2026-09-08T00:00:00Z"));
    expect(parseSince(undefined)).toBe(-Infinity);
    expect(() => parseSince("2026-9-8")).toThrow(/invalid --since/);
    expect(() => parseSince("2026-13-01")).toThrow(/invalid --since/);
  });
});

describe("trend formatters", () => {
  const trend = {
    weeks: [
      { week: "2026-W36", completions: 1 },
      { week: "2026-W37", completions: 4 },
    ],
    cycleTime: [
      { type: "bug" as const, avgDays: 0.3, count: 1 },
      { type: "task" as const, avgDays: 4, count: 2 },
    ],
  };

  it("formatTrendTable lists weeks and cycle time", () => {
    const out = formatTrendTable(trend);
    expect(out).toContain("2026-W36: 1");
    expect(out).toContain("2026-W37: 4");
    expect(out).toContain("bug: 0.3d (1 completed)");
    expect(out).toContain("task: 4.0d (2 completed)");
  });

  it("formatTrendMarkdown renders a Trend section", () => {
    const out = formatTrendMarkdown(trend);
    expect(out).toContain("## Trend");
    expect(out).toContain("- 2026-W37: 4");
    expect(out).toContain("- **task**: 4.0 days (2 completed)");
  });

  it("renders (none) for empty series", () => {
    const empty = { weeks: [], cycleTime: [] };
    expect(formatTrendTable(empty)).toContain("(none)");
    expect(formatTrendMarkdown(empty)).toContain("_None._");
  });
});

describe("report --trend CLI wiring", () => {
  function runCli(args: string[], cwd: string) {
    return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
  }

  it("adds the additive trend payload to the report JSON envelope", () => {
    const dir = initGoldenRepo();
    const r = runCli(["report", "--trend", "--json"], dir);
    expect(r.status).toBe(0);
    const body = JSON.parse(r.stdout) as {
      ok: boolean;
      command: string;
      groups: unknown[];
      trend: unknown;
    };
    expect(body.ok).toBe(true);
    expect(body.command).toBe("report");
    expect(body.groups).toHaveLength(1);
    expect(body.trend).toEqual({
      weeks: [{ week: "2026-W37", completions: 4 }],
      cycleTime: [
        { type: "bug", avgDays: 0.3, count: 1 },
        { type: "task", avgDays: 4, count: 2 },
      ],
    });
  });

  it("appends the trend block to the default table output", () => {
    const dir = initGoldenRepo();
    const r = runCli(["report", "--trend"], dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("epic: epic-a");
    expect(r.stdout).toContain("trend (from git history):");
    expect(r.stdout).toContain("2026-W37: 4");
  });

  it("fails with TREND_FAILED on a non-git tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-trend-cli-"));
    write("tasks/.convention.yml", "version: 0\n")(dir);
    const r = runCli(["report", "--trend", "--json"], dir);
    expect(r.status).toBe(1);
    const body = JSON.parse(r.stdout) as { ok: boolean; error?: { code?: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("TREND_FAILED");
  });

  it("rejects --since without --trend", () => {
    const dir = initGoldenRepo();
    const r = runCli(["report", "--since", "2026-09-01", "--json"], dir);
    expect(r.status).toBe(1);
    const body = JSON.parse(r.stdout) as { ok: boolean; error?: { code?: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("REPORT_FAILED");
  });
});
