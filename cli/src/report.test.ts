import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatReportMarkdown, formatReportTable, runReport } from "./report.js";

function write(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

function md(frontmatter: string, title: string): string {
  return `---\n${frontmatter}---\n\n# ${title}\n`;
}

const D = 'created: "2026-09-11"\n';

function makeTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-report-"));
  write(root, "tasks/.convention.yml", "version: 0\n");
  write(
    root,
    "tasks/launch/launch.md",
    md(`type: initiative\nstatus: todo\nid: launch\ntitle: Launch\nlabels: []\n${D}`, "Launch"),
  );
  write(
    root,
    "tasks/launch/epic-a/epic-a.md",
    md(
      `type: epic\nstatus: todo\nid: epic-a\nparent: launch\ntitle: Epic A\nlabels: []\n${D}`,
      "Epic A",
    ),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/story-a.md",
    md(
      `type: story\nstatus: in_progress\nid: story-a\nparent: epic-a\ntitle: Story A\nlabels: []\n${D}`,
      "Story A",
    ),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/task-one.md",
    md(`type: task\nstatus: todo\nid: task-one\nparent: story-a\nlabels: []\n${D}`, "One"),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/task-two.md",
    md(`type: task\nstatus: done\nid: task-two\nparent: story-a\nlabels: []\n${D}`, "Two"),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/bug-x.md",
    md(`type: bug\nstatus: cancelled\nid: bug-x\nparent: story-a\nlabels: []\n${D}`, "Ex"),
  );
  // Leafless story: explicit zeros.
  write(
    root,
    "tasks/launch/epic-a/story-b/story-b.md",
    md(
      `type: story\nstatus: todo\nid: story-b\nparent: epic-a\ntitle: Story B\nlabels: []\n${D}`,
      "Story B",
    ),
  );
  // Epic without stories: explicit empty group.
  write(
    root,
    "tasks/launch/epic-lonely/epic-lonely.md",
    md(
      `type: epic\nstatus: todo\nid: epic-lonely\nparent: launch\ntitle: Lonely\nlabels: []\n${D}`,
      "Lonely",
    ),
  );
  return root;
}

describe("runReport", () => {
  it("counts per status per story, grouped by epic", () => {
    const { groups } = runReport({ cwd: makeTree() });
    expect(groups.map((g) => g.epic.id)).toEqual(["epic-a", "epic-lonely"]);

    const [a, lonely] = groups;
    expect(a!.initiative).toEqual({ id: "launch", title: "Launch" });
    expect(a!.empty).toBe(false);
    expect(a!.containers.map((c) => c.id)).toEqual(["story-a", "story-b"]);

    const storyA = a!.containers[0]!;
    expect(storyA.counts).toMatchObject({ todo: 1, done: 1, cancelled: 1, total: 3 });
    expect(storyA.empty).toBe(false);
    expect(a!.containers[1]).toMatchObject({ id: "story-b", empty: true });
    expect(a!.containers[1]!.counts.total).toBe(0);
    expect(a!.totals).toMatchObject({ todo: 1, done: 1, cancelled: 1, total: 3 });

    expect(lonely).toMatchObject({ empty: true });
    expect(lonely!.containers).toEqual([]);
    expect(lonely!.totals.total).toBe(0);
  });

  it("throws outside a tasks/ tree", () => {
    const root = mkdtempSync(join(tmpdir(), "arggon-report-naked-"));
    expect(() => runReport({ cwd: root })).toThrow(/No tasks\/ convention/);
  });
});

describe("formatReportTable", () => {
  it("renders rows the --json payload mirrors exactly", () => {
    const { groups } = runReport({ cwd: makeTree() });
    const table = formatReportTable(groups);
    expect(table).toContain("epic: epic-a — Epic A [launch]");
    expect(table).toContain("story-a: todo=1 in_progress=0 blocked=0 done=1 cancelled=1 (total 3)");
    expect(table).toContain(
      "story-b: todo=0 in_progress=0 blocked=0 done=0 cancelled=0 (total 0) (empty — no leaves)",
    );
    expect(table).toContain("epic: epic-lonely — Lonely [launch]");
    expect(table).toContain("(empty — no stories)");
    // JSON mirrors the same rows: same group/story order and counts.
    const rows = groups.flatMap((g) => g.containers.map((c) => `${c.id}: ${c.counts.total}`));
    for (const row of ["story-a: 3", "story-b: 0"]) {
      expect(rows).toContain(row);
    }
  });

  it("names the empty report", () => {
    expect(formatReportTable([])).toContain("no epics");
  });
});

// ---------- markdown standup export (task-report-markdown) ----------

function makeBlockedTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-report-md-"));
  write(root, "tasks/.convention.yml", "version: 0\n");
  write(
    root,
    "tasks/launch/launch.md",
    md(`type: initiative\nstatus: todo\nid: launch\ntitle: Launch\nlabels: []\n${D}`, "Launch"),
  );
  write(
    root,
    "tasks/launch/epic-a/epic-a.md",
    md(`type: epic\nstatus: todo\nid: epic-a\nparent: launch\ntitle: Epic A\nlabels: []\n${D}`, "Epic A"),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/story-a.md",
    md(`type: story\nstatus: in_progress\nid: story-a\nparent: epic-a\ntitle: Story A\nlabels: []\n${D}`, "Story A"),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/task-one.md",
    md(`type: task\nstatus: done\nid: task-one\nparent: story-a\nlabels: []\n${D}`, "One"),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/bug-x.md",
    md(
      `type: bug\nstatus: blocked\nid: bug-x\nparent: story-a\nlabels: []\nblocked_reason: "Waiting on OAuth credentials"\n${D}`,
      "Ex",
    ),
  );
  return root;
}

describe("runReport blocked collection", () => {
  it("collects blocked leaves with reasons and their story/epic chain", () => {
    const root = makeBlockedTree();
    const result = runReport({ cwd: root });
    expect(result.blocked).toEqual([
      {
        id: "bug-x",
        type: "bug",
        title: "bug-x",
        storyId: "story-a",
        epicId: "epic-a",
        blockedReason: "Waiting on OAuth credentials",
      },
    ]);
  });

  it("never mutates frontmatter (report stays read-only)", () => {
    const root = makeBlockedTree();
    const bugPath = join(root, "tasks/launch/epic-a/story-a/bug-x.md");
    const before = readFileSync(bugPath, "utf8");
    runReport({ cwd: root });
    expect(readFileSync(bugPath, "utf8")).toBe(before);
  });
});

describe("formatReportMarkdown", () => {
  it("renders per-epic progress lines with (done+cancelled)/total completion", () => {
    const root = makeBlockedTree();
    const md = formatReportMarkdown(runReport({ cwd: root }), { date: "2026-09-12" });
    expect(md).toContain("# Progress report — 2026-09-12");
    expect(md).toContain("## epic-a — Epic A (launch)");
    // story-a: 1 done of 2 leaves, 0 in progress, 1 blocked.
    expect(md).toContain("- **story-a** — Story A: 1/2 complete (0 in progress, 1 blocked)");
    expect(md).toContain("- **totals**: 1/2 complete");
  });

  it("lists blocked items with reasons and their chain", () => {
    const root = makeBlockedTree();
    const md = formatReportMarkdown(runReport({ cwd: root }), { date: "2026-09-12" });
    expect(md).toContain("## Blocked");
    expect(md).toContain("- **bug-x** (story-a ← epic-a) — Waiting on OAuth credentials");
  });

  it("reports nothing blocked on a clean tree and marks empty epics", () => {
    const root = makeTree();
    const md = formatReportMarkdown(runReport({ cwd: root }), { date: "2026-09-12" });
    expect(md).toContain("_Nothing blocked._");
    expect(md).toContain("_Empty — no stories._");
    expect(md).toContain("- **story-b** — Story B: empty (no leaves)");
  });
});

describe("arggon report --format (CLI)", () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const cli = join(repoRoot, "cli/src/cli.ts");
  const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");

  function runCli(args: string[], cwd: string) {
    return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
  }

  it("--format markdown writes the standup markdown to stdout", () => {
    const dir = makeBlockedTree();
    const proc = runCli(["report", "--format", "markdown"], dir);
    expect(proc.status, proc.stderr).toBe(0);
    expect(proc.stdout).toContain("# Progress report — ");
    expect(proc.stdout).toContain("## Blocked");
    expect(proc.stdout).toContain("Waiting on OAuth credentials");
  });

  it("rejects unknown formats with REPORT_FAILED under --json", () => {
    const dir = makeBlockedTree();
    const proc = runCli(["--json", "report", "--format", "html"], dir);
    expect(proc.status).not.toBe(0);
    const envelope = JSON.parse(proc.stdout) as { ok: boolean; error: { message: string } };
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toMatch(/unknown --format 'html' \(supported: table, markdown\)/);
  });

  it("keeps the default table format unchanged", () => {
    const dir = makeTree();
    const proc = runCli(["report"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("epic: epic-a");
  });
});
