import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  aggregateReport,
  completedOf,
  findTasksDir,
  formatReportMarkdown,
  formatReportRisk,
  formatReportTable,
  loadItems,
  MAX_HYGIENE_OFFENDERS,
  MAX_HYGIENE_OPEN_CONTAINERS,
  MAX_RISK_LEAVES,
  priorityCounts,
  runReport,
} from "@arggondev/lib";
import { runCli } from "./test-spawn.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

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
    expect(() => runReport({ cwd: root })).toThrow(/No ArggonManager\/ convention/);
  });
});

describe("aggregateReport / completedOf / priorityCounts (task-board-progress-header)", () => {
  it("aggregateReport is runReport's aggregation over already-loaded items", () => {
    const root = makeTree();
    const viaRun = runReport({ cwd: root });
    const viaPure = aggregateReport(loadItems(findTasksDir(root)));
    expect(viaPure.groups).toEqual(viaRun.groups);
    expect(viaPure.blocked).toEqual(viaRun.blocked);
  });

  it("completedOf is the report's done+cancelled completion rule", () => {
    expect(completedOf({ todo: 1, in_progress: 2, blocked: 0, done: 3, cancelled: 1 })).toBe(4);
    expect(completedOf({ todo: 0, in_progress: 0, blocked: 0, done: 0, cancelled: 0 })).toBe(0);
  });

  it("priorityCounts buckets by exact token; unset and invalid land in none", () => {
    expect(
      priorityCounts([
        { priority: "p0" },
        { priority: "p0" },
        { priority: "p2" },
        { priority: "p3" },
        { priority: null },
        { priority: undefined },
        { priority: "urgent" },
      ]),
    ).toEqual({ p0: 2, p1: 0, p2: 1, p3: 1, none: 3 });
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
    expect(envelope.error.message).toMatch(
      /unknown --format 'html' \(supported: table, markdown\)/,
    );
  });

  it("keeps the default table format unchanged", () => {
    const dir = makeTree();
    const proc = runCli(["report"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("epic: epic-a");
  });
});

// ---------- container hygiene (task-container-hygiene-check) ----------

/**
 * The fixture matrix for the report-only hygiene guard:
 *
 * - `epic-flagged` (done) holds an open story → FLAGGED, with the offender
 *   listed and the open story named;
 * - `epic-leaves-only` (done) holds a done story whose only open work is a
 *   bug/task leaf → NOT flagged (the documented follow-up pattern);
 * - `epic-open` (in_progress) holds an open story → NOT flagged (not terminal);
 * - `epic-cancelled` (cancelled) holds an open story → FLAGGED (cancelled is
 *   terminal too);
 * - `init-closed` (done) holds a done epic holding an open story → flagged at
 *   BOTH levels: every terminal container on the open item's ancestor chain,
 *   at any depth.
 */
function makeHygieneTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-report-hygiene-"));
  write(root, "tasks/.convention.yml", "version: 0\n");
  write(
    root,
    "tasks/init/init.md",
    md(`type: initiative\nstatus: in_progress\nid: init\ntitle: Init\nlabels: []\n${D}`, "Init"),
  );
  write(
    root,
    "tasks/init/epic-flagged/epic-flagged.md",
    md(
      `type: epic\nstatus: done\nid: epic-flagged\nparent: init\ntitle: Flagged\nlabels: []\n${D}`,
      "Flagged",
    ),
  );
  write(
    root,
    "tasks/init/epic-flagged/story-open/story-open.md",
    md(
      `type: story\nstatus: todo\nid: story-open\nparent: epic-flagged\ntitle: Open\nlabels: []\n${D}`,
      "Open",
    ),
  );
  write(
    root,
    "tasks/init/epic-flagged/story-open/task-under.md",
    md(`type: task\nstatus: todo\nid: task-under\nparent: story-open\nlabels: []\n${D}`, "Under"),
  );
  write(
    root,
    "tasks/init/epic-leaves-only/epic-leaves-only.md",
    md(
      `type: epic\nstatus: done\nid: epic-leaves-only\nparent: init\ntitle: Leaves\nlabels: []\n${D}`,
      "Leaves",
    ),
  );
  write(
    root,
    "tasks/init/epic-leaves-only/story-closed/story-closed.md",
    md(
      `type: story\nstatus: done\nid: story-closed\nparent: epic-leaves-only\ntitle: Closed\nlabels: []\n${D}`,
      "Closed",
    ),
  );
  write(
    root,
    "tasks/init/epic-leaves-only/story-closed/bug-followup.md",
    md(
      `type: bug\nstatus: todo\nid: bug-followup\nparent: story-closed\nlabels: []\n${D}`,
      "Follow-up",
    ),
  );
  write(
    root,
    "tasks/init/epic-open/epic-open.md",
    md(
      `type: epic\nstatus: in_progress\nid: epic-open\nparent: init\ntitle: Open epic\nlabels: []\n${D}`,
      "Open epic",
    ),
  );
  write(
    root,
    "tasks/init/epic-open/story-under-open/story-under-open.md",
    md(
      `type: story\nstatus: todo\nid: story-under-open\nparent: epic-open\ntitle: Under open\nlabels: []\n${D}`,
      "Under open",
    ),
  );
  write(
    root,
    "tasks/init/epic-cancelled/epic-cancelled.md",
    md(
      `type: epic\nstatus: cancelled\nid: epic-cancelled\nparent: init\ntitle: Cancelled\nlabels: []\n${D}`,
      "Cancelled",
    ),
  );
  write(
    root,
    "tasks/init/epic-cancelled/story-cancelled-open/story-cancelled-open.md",
    md(
      `type: story\nstatus: in_progress\nid: story-cancelled-open\nparent: epic-cancelled\ntitle: Cancelled open\nlabels: []\nassignee: alice\n${D}`,
      "Cancelled open",
    ),
  );
  write(
    root,
    "tasks/init-closed/init-closed.md",
    md(
      `type: initiative\nstatus: done\nid: init-closed\ntitle: Init closed\nlabels: []\n${D}`,
      "Init closed",
    ),
  );
  write(
    root,
    "tasks/init-closed/epic-ok/epic-ok.md",
    md(
      `type: epic\nstatus: done\nid: epic-ok\nparent: init-closed\ntitle: OK\nlabels: []\n${D}`,
      "OK",
    ),
  );
  write(
    root,
    "tasks/init-closed/epic-ok/story-deep-open/story-deep-open.md",
    md(
      `type: story\nstatus: todo\nid: story-deep-open\nparent: epic-ok\ntitle: Deep open\nlabels: []\n${D}`,
      "Deep open",
    ),
  );
  return root;
}

describe("container hygiene (task-container-hygiene-check)", () => {
  it("flags terminal containers holding an open story, at any depth", () => {
    const { hygiene } = runReport({ cwd: makeHygieneTree() });
    // 12 containers: init, 4 epics, 6 stories under init, init-closed + epic-ok + story-deep-open.
    expect(hygiene.checked).toBe(12);
    expect(hygiene.offendersTotal).toBe(4);
    expect(hygiene.offenders).toEqual([
      {
        id: "epic-cancelled",
        type: "epic",
        status: "cancelled",
        openContainers: [{ id: "story-cancelled-open", type: "story", status: "in_progress" }],
        openContainersTotal: 1,
      },
      {
        id: "epic-flagged",
        type: "epic",
        status: "done",
        openContainers: [{ id: "story-open", type: "story", status: "todo" }],
        openContainersTotal: 1,
      },
      {
        id: "epic-ok",
        type: "epic",
        status: "done",
        openContainers: [{ id: "story-deep-open", type: "story", status: "todo" }],
        openContainersTotal: 1,
      },
      {
        id: "init-closed",
        type: "initiative",
        status: "done",
        openContainers: [{ id: "story-deep-open", type: "story", status: "todo" }],
        openContainersTotal: 1,
      },
    ]);
  });

  it("never flags open containers or leaves-only follow-ups", () => {
    const { hygiene } = runReport({ cwd: makeHygieneTree() });
    const ids = hygiene.offenders.map((o) => o.id);
    // Open container holding an open story: it is not terminal, so not an offender.
    expect(ids).not.toContain("init");
    expect(ids).not.toContain("epic-open");
    // Closed containers whose only open work is leaves: the documented follow-up pattern.
    expect(ids).not.toContain("epic-leaves-only");
    expect(ids).not.toContain("story-closed");
    // An open story is never an offender itself.
    expect(ids).not.toContain("story-open");
    expect(ids).not.toContain("story-deep-open");
  });

  it("reports clean on a tree with no terminal container holding an open container", () => {
    const { hygiene } = runReport({ cwd: makeTree() });
    expect(hygiene.checked).toBe(5);
    expect(hygiene.offendersTotal).toBe(0);
    expect(hygiene.offenders).toEqual([]);
  });

  it("pins human and --json to the same offenders (bounded, same order)", () => {
    const dir = makeHygieneTree();
    const human = runCli(["report"], dir);
    expect(human.status, human.stderr).toBe(0);
    expect(human.stdout).toContain("hygiene: 4 offenders (12 containers checked)");
    expect(human.stdout).toContain("epic-flagged (done) — open containers: story-open (todo)");
    // The hygiene block itself never names the non-offenders (they still appear
    // in the groups table above — this assertion is scoped to the block).
    const hygieneBlock = human.stdout.slice(human.stdout.indexOf("hygiene:"));
    expect(hygieneBlock).not.toContain("epic-leaves-only");
    expect(hygieneBlock).not.toContain("epic-open");

    const boxed = runCli(["--json", "report"], dir);
    expect(boxed.status, boxed.stderr).toBe(0);
    const body = JSON.parse(boxed.stdout) as {
      hygiene: { checked: number; offenders: Array<{ id: string }>; offendersTotal: number };
    };
    expect(body.hygiene.checked).toBe(12);
    expect(body.hygiene.offendersTotal).toBe(4);
    // Parity: the offender lines of the human output, in order, are the JSON offenders.
    const humanIds = human.stdout
      .split("\n")
      .filter((line) => line.startsWith("  ") && line.includes(" — open containers: "))
      .map((line) => line.trim().split(" ")[0]!);
    expect(humanIds).toEqual(body.hygiene.offenders.map((o) => o.id));
  });

  it("carries the same section in the standup markdown", () => {
    const md = formatReportMarkdown(runReport({ cwd: makeHygieneTree() }), { date: "2026-10-15" });
    expect(md).toContain("## Hygiene");
    expect(md).toContain("- 4 offenders (12 containers checked)");
    expect(md).toContain("- **epic-flagged** (done) — open containers: story-open (todo)");
  });
});

/**
 * A tree with 12 offenders (each a done epic holding one open story) and one
 * offender holding 7 open stories — the caps' fixture.
 */
function makeCrowdedHygieneTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-report-hygiene-caps-"));
  write(root, "tasks/.convention.yml", "version: 0\n");
  write(
    root,
    "tasks/init/init.md",
    md(`type: initiative\nstatus: todo\nid: init\ntitle: Init\nlabels: []\n${D}`, "Init"),
  );
  for (let i = 1; i <= 12; i++) {
    const epic = `epic-${String(i).padStart(2, "0")}`;
    write(
      root,
      `tasks/init/${epic}/${epic}.md`,
      md(`type: epic\nstatus: done\nid: ${epic}\nparent: init\ntitle: E\nlabels: []\n${D}`, "E"),
    );
    const stories = i === 1 ? 7 : 1;
    for (let s = 1; s <= stories; s++) {
      const story = `${epic}-story-${s}`;
      write(
        root,
        `tasks/init/${epic}/${story}/${story}.md`,
        md(
          `type: story\nstatus: todo\nid: ${story}\nparent: ${epic}\ntitle: S\nlabels: []\n${D}`,
          "S",
        ),
      );
    }
  }
  return root;
}

describe("container hygiene caps", () => {
  it("bounds offenders and open containers with explicit totals and markers", () => {
    const { hygiene } = runReport({ cwd: makeCrowdedHygieneTree() });
    // 1 initiative + 12 epics + 18 stories (7 + 11).
    expect(hygiene.checked).toBe(31);
    expect(hygiene.offendersTotal).toBe(12);
    expect(hygiene.offenders).toHaveLength(MAX_HYGIENE_OFFENDERS);
    const first = hygiene.offenders[0]!;
    expect(first.id).toBe("epic-01");
    expect(first.openContainersTotal).toBe(7);
    expect(first.openContainers).toHaveLength(MAX_HYGIENE_OPEN_CONTAINERS);
    expect(first.openContainers.map((c) => c.id)).toEqual([
      "epic-01-story-1",
      "epic-01-story-2",
      "epic-01-story-3",
      "epic-01-story-4",
      "epic-01-story-5",
    ]);

    const human = runCli(["report"], makeCrowdedHygieneTree());
    expect(human.status, human.stderr).toBe(0);
    expect(human.stdout).toContain("hygiene: 12 offenders (31 containers checked)");
    expect(human.stdout).toContain("(+2 more)");
    expect(human.stdout).toContain("… and 2 more");
  });
});

// ---------- risk triage audit (issue #871) ----------

/** An `accept:` comment in the kernel's convention shape. */
function acceptanceComment(author: string, value = "approve"): string {
  return `\n### 2026-10-05 @${author}\naccept: ${value}\n- checked against the spec\n`;
}

/**
 * The risk-audit fixture: a routine leaf, a risk-labeled leaf that is not
 * (routine T0), a risk leaf with a human acceptance (cleared), a terminal risk
 * leaf (excluded), a self-accepted risk leaf (a gap), and a multi-trigger leaf.
 */
function makeRiskTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-report-risk-"));
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
  const leaf = (id: string, frontmatter: string, title: string): void => {
    write(root, `tasks/launch/epic-a/story-a/${id}.md`, md(frontmatter, title));
  };
  // Routine T0 leaf: no risk label, never examined.
  leaf(
    "task-routine",
    `type: task\nstatus: todo\nid: task-routine\nparent: story-a\nlabels: [security]\n${D}`,
    "Routine",
  );
  // A risk-triggered leaf with no acceptance: a gap.
  leaf(
    "task-security-gap",
    `type: task\nstatus: todo\nid: task-security-gap\nparent: story-a\nlabels: [risk-security]\n${D}`,
    "Security gap",
  );
  // A risk-triggered leaf a human accepted: cleared.
  write(
    root,
    "tasks/launch/epic-a/story-a/task-security-accepted.md",
    `${md(
      `type: task\nstatus: in_progress\nid: task-security-accepted\nparent: story-a\nlabels: [risk-security]\n${D}`,
      "Security accepted",
    )}${acceptanceComment("gonzalo")}`,
  );
  // A terminal risk-triggered leaf: excluded from the gap list, still checked.
  leaf(
    "task-destructive-done",
    `type: task\nstatus: done\nid: task-destructive-done\nparent: story-a\nlabels: [risk-destructive]\n${D}`,
    "Done destructive",
  );
  // A risk leaf whose only acceptance is from its own assignee: a gap.
  write(
    root,
    "tasks/launch/epic-a/story-a/bug-self-accepted.md",
    `${md(
      `type: bug\nstatus: blocked\nid: bug-self-accepted\nparent: story-a\nassignee: arggon-superagent\nblocked_reason: waiting\nlabels: [risk-supply-chain, risk-safety-critical]\n${D}`,
      "Self accepted",
    )}${acceptanceComment("arggon-superagent")}`,
  );
  // A multi-trigger leaf: every risk label is carried into the audit row.
  leaf(
    "task-multi-trigger",
    `type: task\nstatus: in_progress\nid: task-multi-trigger\nparent: story-a\nlabels: [risk-compatibility, risk-security, security]\n${D}`,
    "Multi trigger",
  );
  return root;
}

describe("risk triage audit (issue #871)", () => {
  it("escalates risk-triggered leaves out of routine T0", () => {
    const { risk } = runReport({ cwd: makeRiskTree() });
    // 5 risk-labeled leaves (routine `security` is NOT one); 3 have no accepted record.
    expect(risk.checked).toBe(5);
    expect(risk.leavesTotal).toBe(3);
    expect(risk.leaves.map((l) => l.id)).toEqual([
      "bug-self-accepted",
      "task-multi-trigger",
      "task-security-gap",
    ]);

    const byId = new Map(risk.leaves.map((l) => [l.id, l]));
    expect(byId.get("task-security-gap")).toMatchObject({
      type: "task",
      title: "task-security-gap",
      status: "todo",
      labels: ["risk-security"],
      acceptance: "none",
      storyId: "story-a",
      epicId: "epic-a",
    });
    expect(byId.get("bug-self-accepted")).toMatchObject({
      type: "bug",
      status: "blocked",
      labels: ["risk-supply-chain", "risk-safety-critical"],
      acceptance: "self-accepted",
    });
    expect(byId.get("task-multi-trigger")!.labels).toEqual(["risk-compatibility", "risk-security"]);
    // Accepted and terminal leaves are not gaps.
    expect(byId.has("task-security-accepted")).toBe(false);
    expect(byId.has("task-destructive-done")).toBe(false);
    expect(byId.has("task-routine")).toBe(false);
  });

  it("surfaces the audit in the JSON payload, human table and markdown standup", () => {
    const root = makeRiskTree();
    const json = runCli(["--json", "report"], root);
    expect(json.status, json.stderr).toBe(0);
    const body = JSON.parse(json.stdout) as {
      risk: { checked: number; leavesTotal: number; leaves: Array<{ id: string }> };
    };
    expect(body.risk.checked).toBe(5);
    expect(body.risk.leavesTotal).toBe(3);
    expect(body.risk.leaves.map((l) => l.id)).toEqual([
      "bug-self-accepted",
      "task-multi-trigger",
      "task-security-gap",
    ]);

    const human = runCli(["report"], root);
    expect(human.status, human.stderr).toBe(0);
    expect(human.stdout).toContain(
      "risk: 3 open risk-triggered leaves without human acceptance (5 risk-labeled leaves checked)",
    );
    expect(human.stdout).toContain(
      "task-security-gap (task, todo) — risk-security; acceptance: none — story-a ← epic-a",
    );

    const markdown = formatReportMarkdown(runReport({ cwd: root }), { date: "2026-10-15" });
    expect(markdown).toContain("## Risk");
    expect(markdown).toContain(
      "- 3 open risk-triggered leaves without human acceptance (5 risk-labeled leaves checked)",
    );
    expect(markdown).toContain(
      "**task-security-gap** (task, todo) — risk-security; acceptance: none",
    );
  });

  it("reports clean when no leaf carries a risk label", () => {
    const { risk } = runReport({ cwd: makeTree() });
    expect(risk).toEqual({ checked: 0, leaves: [], leavesTotal: 0 });
    expect(formatReportRisk(risk)).toContain("risk: clean");
    const human = runCli(["report"], makeTree());
    expect(human.status, human.stderr).toBe(0);
    expect(human.stdout).toContain(
      "risk: clean — no open risk-triggered leaf needs review escalation",
    );
  });

  it("bounds the gap list with explicit totals and an overflow marker", () => {
    const root = mkdtempSync(join(tmpdir(), "arggon-report-risk-caps-"));
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
    for (let i = 1; i <= MAX_RISK_LEAVES + 2; i++) {
      const id = `task-risk-${String(i).padStart(2, "0")}`;
      write(
        root,
        `tasks/launch/epic-a/story-a/${id}.md`,
        md(
          `type: task\nstatus: todo\nid: ${id}\nparent: story-a\nlabels: [risk-security]\n${D}`,
          "Risk",
        ),
      );
    }

    const { risk } = runReport({ cwd: root });
    expect(risk.checked).toBe(MAX_RISK_LEAVES + 2);
    expect(risk.leavesTotal).toBe(MAX_RISK_LEAVES + 2);
    expect(risk.leaves).toHaveLength(MAX_RISK_LEAVES);

    const human = runCli(["report"], root);
    expect(human.status, human.stderr).toBe(0);
    expect(human.stdout).toContain("… and 2 more");

    const markdown = formatReportMarkdown(runReport({ cwd: root }), { date: "2026-10-15" });
    expect(markdown).toContain("- … and 2 more");
  });
});

describe("risk triage read surfaces (issue #871)", () => {
  it("keeps the triage queryable in list and visible in show", () => {
    const root = makeRiskTree();

    const listing = runCli(["--json", "list", "--filter", "label:risk-security"], root);
    expect(listing.status, listing.stderr).toBe(0);
    const ids = (JSON.parse(listing.stdout) as { items: Array<{ id: string }> }).items.map(
      (item) => item.id,
    );
    expect([...ids].sort()).toEqual([
      "task-multi-trigger",
      "task-security-accepted",
      "task-security-gap",
    ]);
    expect(ids).not.toContain("task-routine");

    const shown = runCli(["show", "task-security-gap"], root);
    expect(shown.status, shown.stderr).toBe(0);
    expect(shown.stdout).toContain("labels: risk-security");
  });
});
