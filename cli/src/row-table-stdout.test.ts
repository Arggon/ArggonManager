import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { updateGeneratedSection } from "./convention.js";
import { arggonVersion, checksumOf } from "./docs.js";
import { formatListTable, runList } from "./list.js";
import { renderShowText, runShow } from "./show.js";
import { RM_RETRY } from "./test-tmp.js";
import { initialTuiState, renderTui } from "./tui.js";
import type { WorkItem } from "./types.js";

/**
 * task-row-table-stdout-sanitize: the row/table human channels (`list`,
 * `show`, `report`, `playbook status`, `spec audit`, `board --tui`, `adopt` /
 * `adopt --ack`) interpolate repo-controlled values (frontmatter fields,
 * filename-derived ids, spec titles, `x-generated` keys). A hostile value must
 * render inert on the human path while `--json` keeps the raw bytes and
 * ordinary values stay byte-identical.
 *
 * These tests drive the real CLI (spawn + tsx) for the line-oriented channels
 * so they assert actual stdout bytes, and call the pure TUI renderer directly
 * (the interactive loop needs a TTY). Each hostile assertion is a
 * discrimination check: it requires the escaped text to be PRESENT, so a
 * formatter that dropped the value instead of escaping it fails, and it
 * forbids raw unsafe code points, so an unsanitized formatter fails too.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

function runGit(args: string[], cwd: string) {
  return spawnSync("git", args, { encoding: "utf8", cwd });
}

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after the file,
// with the bounded ENOTEMPTY retry window (spawned children settle late).
const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, RM_RETRY);
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}
function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Raw code points that must never reach the terminal through a dynamic value. */
const UNSAFE = /[\u001b\u007f-\u009f\u2028\u2029]/;
/**
 * Hostile bytes that fit a filename and an unquoted YAML scalar: the item
 * frontmatter is line-oriented, so the repro carries ESC/C1/DEL/LS/PS rather
 * than a real newline (a real newline would become a separate frontmatter
 * line). The bytes avoid the frontmatter writer's quote-trigger set
 * (`: # { } [ ] , & * ? ! ' "`) so they survive write -> reload unchanged.
 */
const HOSTILE = "badfake\u2028item\u2029 \u001b31m\u0085\u007f";
/** Escaped rendering of {@link HOSTILE} as it must appear on stdout. */
const HOSTILE_ESCAPED = "badfake\\u2028item\\u2029 \\u001b31m\\u0085\\u007f";

/**
 * Line-oriented variant for values that must survive a single regex line
 * match (spec requirement titles: `.` excludes U+2028/29, so a title carrying
 * them is not captured verbatim). ESC/C1/DEL are still hostile bytes.
 */
const HOSTILE_INLINE = "badfake \u001b31m\u0085\u007f";
const HOSTILE_INLINE_ESCAPED = "badfake \\u001b31m\\u0085\\u007f";

/**
 * Shared hostile tree for the line-oriented read channels: a git-backed
 * tracker with an ordinary hierarchy plus
 *  - a task whose filename/title/assignee/branch carry HOSTILE bytes,
 *  - an epic with a hostile title and a blocked leaf with a hostile reason,
 *  - a playbook with hostile id/version frontmatter,
 *  - two sizeable spec docs with a hostile shared requirement title (one of
 *    them with a hostile filename path).
 * All channels read disjoint slices, so one tree keeps the spawn count down.
 */
let sharedTree: string | null = null;
function hostileTree(): string {
  if (sharedTree !== null) return sharedTree;
  const dir = tempDir("arggon-row-table-");
  expect(runGit(["init"], dir).status).toBe(0);
  expect(runGit(["config", "user.email", "t@t"], dir).status).toBe(0);
  expect(runGit(["config", "user.name", "t"], dir).status).toBe(0);
  expect(runCli(["init", dir], dir).status).toBe(0);
  expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
  expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
  expect(
    runCli(["create", "story", "Login", "--parent", "auth", "--id", "story-login"], dir).status,
  ).toBe(0);

  // Hostile item: filename carries the bytes (so `show`'s path line is
  // exercised) while the ordinary frontmatter id is the lookup key —
  // loadItems does not require stem == id.
  writeFileSync(
    join(dir, "tasks", "launch-mvp", "auth", "story-login", `task-${HOSTILE}.md`),
    "---\n" +
      "type: task\n" +
      "status: todo\n" +
      "id: task-evil\n" +
      `title: Fake title ${HOSTILE}\n` +
      `assignee: alice${HOSTILE}\n` +
      `branch: feat/${HOSTILE}\n` +
      "parent: story-login\n" +
      "created: 2026-09-18\n" +
      "updated: 2026-09-18\n" +
      "---\n\nbody\n",
    "utf8",
  );

  // Report fixture: hostile epic title (table + markdown) and a blocked leaf
  // with a hostile blocked_reason (markdown blocked section).
  writeFileSync(
    join(dir, "tasks", "launch-mvp", "auth", "auth.md"),
    "---\n" +
      "type: epic\n" +
      "status: in_progress\n" +
      "id: auth\n" +
      "parent: launch-mvp\n" +
      `title: Epic Auth ${HOSTILE}\n` +
      "labels: []\n" +
      "created: 2026-09-18\n" +
      "updated: 2026-09-18\n" +
      "---\n\nbody\n",
    "utf8",
  );
  writeFileSync(
    join(dir, "tasks", "launch-mvp", "auth", "story-login", "bug-blocked.md"),
    "---\n" +
      "type: bug\n" +
      "status: blocked\n" +
      "id: bug-blocked\n" +
      "parent: story-login\n" +
      `title: Blocked bug\n` +
      `blocked_reason: Waiting on OAuth ${HOSTILE}\n` +
      "labels: []\n" +
      "created: 2026-09-18\n" +
      "updated: 2026-09-18\n" +
      "---\n\nbody\n",
    "utf8",
  );

  // Playbook fixture: id/version from frontmatter.
  mkdirSync(join(dir, "docs", "playbooks"), { recursive: true });
  writeFileSync(
    join(dir, "docs", "playbooks", "weird.md"),
    "---\n" +
      `playbook_id: tech${HOSTILE}\n` +
      `version: v1${HOSTILE}\n` +
      "researched: 2020-01-01\n" +
      "status: current\n" +
      "---\n\nbody\n",
    "utf8",
  );

  // Spec-audit fixture: identical docs -> DUPLICATE, one shared requirement
  // title with hostile bytes and one hostile filename.
  mkdirSync(join(dir, "docs", "specs"), { recursive: true });
  const specBody =
    "---\nspec_id: dup\ntitle: T\nstatus: proposed\ncreated: 2026-09-18\n---\n\n" +
    "# Spec: t\n\n## Purpose\n\nWhy it exists.\n\n" +
    "## Synopsis\n\n```bash\narggon x\n```\n\nOn error the command exits 1.\n\n" +
    "## Acceptance\n\n" +
    `### Requirement: Do ${HOSTILE_INLINE} thing\n\n` +
    "#### Scenario: it works\n\n- [x] works\n";
  writeFileSync(join(dir, "docs", "specs", "spec-dup-a.md"), specBody, "utf8");
  writeFileSync(join(dir, "docs", "specs", `spec-dup-b-${HOSTILE}.md`), specBody, "utf8");

  sharedTree = dir;
  return dir;
}

describe("row/table stdout: list", () => {
  it("escapes the id/title/assignee/branch cells (no raw control, one inert row)", () => {
    const proc = runCli(["list"], hostileTree());
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    expect(proc.stdout).not.toContain("\nspoof");

    // Discrimination: the hostile bytes must have reached the formatter and
    // been escaped; one physical line carries the evil row.
    const evilLines = proc.stdout.split("\n").filter((line) => line.includes("Fake title"));
    expect(evilLines).toHaveLength(1);
    const row = evilLines[0]!;
    expect(row).toContain(`task-evil`);
    expect(row).toContain(`alice${HOSTILE_ESCAPED}`);
    expect(row).toContain(`feat/${HOSTILE_ESCAPED}`);
    expect(row).toContain(`Fake title ${HOSTILE_ESCAPED}`);
    expect(proc.stderr).toBe("");
  });

  it("keeps the raw values in the --json envelope", () => {
    const proc = runCli(["list", "--json"], hostileTree());
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      items: { id: string; title: string; assignee: string; branch: string }[];
    };
    const evil = body.items.find((item) => item.id === "task-evil")!;
    expect(evil.title).toBe(`Fake title ${HOSTILE}`);
    expect(evil.assignee).toBe(`alice${HOSTILE}`);
    expect(evil.branch).toBe(`feat/${HOSTILE}`);
  });

  it("is byte-identical for ordinary values, including quotes/backslashes and long titles", () => {
    const dir = tempDir("arggon-row-table-list-");
    mkdirSync(join(dir, "tasks", "x"), { recursive: true });
    writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
    // Longer than the 200-char report cap and containing the characters the
    // JSON-quoting policy re-escapes: the row channel must render both as-is.
    const title = `long ${"a".repeat(250)} "quoted" \\ backslash`;
    writeFileSync(
      join(dir, "tasks", "x", "task-long.md"),
      "---\ntype: task\nstatus: todo\nid: task-long\n" +
        `title: ${title}\n` +
        "assignee: alice\n" +
        "created: 2026-09-18\n" +
        "---\n\nbody\n",
      "utf8",
    );
    const { items } = runList({ cwd: dir });
    const table = formatListTable(items);
    expect(table).toContain(title);
    expect(table).not.toContain("…");
    expect(table).toContain("alice");
  });
});

describe("row/table stdout: show", () => {
  it("escapes frontmatter field lines and the item path (--meta)", () => {
    const proc = runCli(["show", "task-evil", "--meta"], hostileTree());
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    expect(proc.stdout).not.toContain("\nspoof");

    expect(proc.stdout).toContain(`arggon show: task-evil — Fake title ${HOSTILE_ESCAPED}`);
    expect(proc.stdout).toContain(`  type: task · status: todo · parent: story-login`);
    expect(proc.stdout).toContain(`  assignee: alice${HOSTILE_ESCAPED}`);
    expect(proc.stdout).toContain(`  branch: feat/${HOSTILE_ESCAPED}`);
    // Discrimination: the escaped filename must be present.
    expect(proc.stdout).toContain(
      `  path: ${join(
        hostileTree(),
        "tasks",
        "launch-mvp",
        "auth",
        "story-login",
        `task-${HOSTILE_ESCAPED}.md`,
      )}`,
    );
    expect(proc.stderr).toBe("");
  });

  it("keeps the raw values in the --json envelope", () => {
    const proc = runCli(["show", "task-evil", "--meta", "--json"], hostileTree());
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      item: { title: string; assignee: string; branch: string };
      path: string;
    };
    expect(body.item.title).toBe(`Fake title ${HOSTILE}`);
    expect(body.item.assignee).toBe(`alice${HOSTILE}`);
    expect(body.item.branch).toBe(`feat/${HOSTILE}`);
    expect(body.path).toBe(
      join(hostileTree(), "tasks", "launch-mvp", "auth", "story-login", `task-${HOSTILE}.md`),
    );
  });

  it("is byte-identical for an ordinary item (--meta)", () => {
    const dir = hostileTree();
    const proc = runCli(["show", "story-login", "--meta"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toBe(
      `arggon show: story-login — Login\n` +
        `  type: story · status: todo · parent: auth\n` +
        `  path: ${join(dir, "tasks", "launch-mvp", "auth", "story-login", "story-login.md")}\n`,
    );
    expect(proc.stderr).toBe("");
  });

  it("records the verbatim-content boundary: field lines escape, prose/comments stay raw", () => {
    // Decision (task-row-table-stdout-sanitize): the field lines are a
    // line-oriented status channel and are sanitized; prose and comment text
    // are the item's CONTENT — a `cat`-like view, same contract as `show
    // --body` / `arggon instructions` — and stay verbatim. Only the
    // CLI-reconstructed comment heading has its repo-controlled author
    // escaped. This test pins that boundary so it is not mistaken for a leak.
    const dir = tempDir("arggon-row-table-show-boundary-");
    mkdirSync(join(dir, "tasks", "x"), { recursive: true });
    writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
    writeFileSync(
      join(dir, "tasks", "x", "task-boundary.md"),
      "---\ntype: task\nstatus: todo\nid: task-boundary\ntitle: Boundary\n" +
        "created: 2026-09-18\n---\n\n" +
        "Prose with \u001b[31m bytes.\n\n" +
        "### 2026-09-18 @author\u001bX\n\n" +
        "Comment line with \u2028 bytes.\n",
      "utf8",
    );
    const result = runShow({ cwd: dir, id: "task-boundary", body: true });
    const lines = renderShowText(result);
    // Field lines: escaped.
    expect(lines[0]).toBe(`arggon show: task-boundary — Boundary`);
    // Reconstructed heading: structural, so the author is escaped.
    expect(lines).toContain(`### 2026-09-18 @author\\u001bX`);
    // Verbatim content: raw by design.
    expect(lines).toContain("Prose with \u001b[31m bytes.");
    expect(lines).toContain("Comment line with \u2028 bytes.");
  });
});

describe("row/table stdout: report", () => {
  it("escapes the epic title in the table and the blocked reason in markdown", () => {
    const dir = hostileTree();
    const table = runCli(["report"], dir);
    expect(table.status).toBe(0);
    expect(table.stdout).not.toMatch(UNSAFE);
    expect(table.stdout).toContain(`epic: auth — Epic Auth ${HOSTILE_ESCAPED} [launch-mvp]`);
    expect(table.stderr).toBe("");

    const markdown = runCli(["report", "--format", "markdown"], dir);
    expect(markdown.status).toBe(0);
    expect(markdown.stdout).not.toMatch(UNSAFE);
    expect(markdown.stdout).toContain(`## auth — Epic Auth ${HOSTILE_ESCAPED} (launch-mvp)`);
    // Discrimination: the escaped reason must be present in the blocked line.
    expect(markdown.stdout).toContain(`— Waiting on OAuth ${HOSTILE_ESCAPED}`);
    expect(markdown.stdout).not.toContain("\nspoof");
  });

  it("keeps the raw epic title in the --json envelope", () => {
    const proc = runCli(["report", "--json"], hostileTree());
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { groups: { epic: { title: string } }[] };
    expect(body.groups[0]!.epic.title).toBe(`Epic Auth ${HOSTILE}`);
  });
});

describe("row/table stdout: playbook status", () => {
  it("escapes the tech id and version columns", () => {
    const proc = runCli(["playbook", "status"], hostileTree());
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    // Discrimination: both escaped values must appear in the table row.
    expect(proc.stdout).toContain(`tech${HOSTILE_ESCAPED}`);
    expect(proc.stdout).toContain(`v1${HOSTILE_ESCAPED}`);
    expect(proc.stderr).toBe("");
  });

  it("keeps the raw id/version in the --json envelope", () => {
    const proc = runCli(["playbook", "status", "--json"], hostileTree());
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { playbooks: { id: string; version: string }[] };
    const weird = body.playbooks.find((p) => p.id === `tech${HOSTILE}`)!;
    expect(weird.version).toBe(`v1${HOSTILE}`);
  });
});

describe("row/table stdout: spec audit", () => {
  it("escapes finding paths and shared requirement titles", () => {
    const proc = runCli(["spec", "audit"], hostileTree());
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    // Discrimination: escaped path and title must be present.
    expect(proc.stdout).toContain(`spec-dup-b-${HOSTILE_ESCAPED}.md`);
    expect(proc.stdout).toContain(`- Do ${HOSTILE_INLINE_ESCAPED} thing`);
    expect(proc.stdout).not.toContain("\nspoof");
  });

  it("keeps the raw paths/titles in the --json envelope", () => {
    const proc = runCli(["spec", "audit", "--json"], hostileTree());
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      findings: { files: [string, string]; sharedTitles: string[] }[];
    };
    const finding = body.findings[0]!;
    expect(finding.files.some((file) => file.includes(HOSTILE))).toBe(true);
    expect(finding.sharedTitles).toContain(`Do ${HOSTILE_INLINE} thing`);
  });
});

describe("row/table stdout: adopt skip path", () => {
  /**
   * Initialized tree whose existing open adoption task has a hostile
   * `parent:` — the exact repro from review finding F1 (PR #354). The
   * container story exists so the run takes the pure skip path (no writes).
   */
  function adoptSkipTree(): string {
    const dir = tempDir("arggon-row-adopt-");
    expect(runGit(["init"], dir).status).toBe(0);
    expect(runGit(["config", "user.email", "t@t"], dir).status).toBe(0);
    expect(runGit(["config", "user.name", "t"], dir).status).toBe(0);
    expect(runCli(["init", dir], dir).status).toBe(0);
    const storyPath = join(dir, "tasks", "adoption", "story-arggon-adoption.md");
    const taskPath = join(dir, "tasks", "adoption", "task-adopt-arggon.md");
    mkdirSync(dirname(storyPath), { recursive: true });
    writeFileSync(
      storyPath,
      "---\ntype: story\nstatus: todo\nid: story-arggon-adoption\n" +
        "created: 2026-09-18\nupdated: 2026-09-18\n---\n\nbody\n",
      "utf8",
    );
    writeFileSync(
      taskPath,
      "---\ntype: task\nstatus: todo\nid: task-adopt-arggon\n" +
        `parent: story-${HOSTILE}\n` +
        "created: 2026-09-18\nupdated: 2026-09-18\n---\n\nbody\n",
      "utf8",
    );
    return dir;
  }

  it("escapes the skip-path storyId taken from the existing task's parent:", () => {
    const proc = runCli(["adopt"], adoptSkipTree());
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    expect(proc.stdout).not.toContain("\nspoof");
    expect(proc.stdout).toContain("already tracked as task-adopt-arggon");
    // Discrimination: the escaped hostile parent must be present.
    expect(proc.stdout).toContain(`  story: story-${HOSTILE_ESCAPED} (existing)`);
    expect(proc.stderr).toBe("");
  });

  it("keeps the raw storyId in the --json envelope", () => {
    const proc = runCli(["adopt", "--json"], adoptSkipTree());
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { storyId: string; skipped: boolean };
    expect(body.skipped).toBe(true);
    expect(body.storyId).toBe(`story-${HOSTILE}`);
  });
});

describe("row/table stdout: adopt --ack", () => {
  /**
   * Tree whose `x-generated` state carries an entry whose key is the hostile
   * bytes and whose file exists on disk — the second repro from F1.
   */
  function ackTree(): string {
    const dir = tempDir("arggon-row-ack-");
    expect(runGit(["init"], dir).status).toBe(0);
    expect(runGit(["config", "user.email", "t@t"], dir).status).toBe(0);
    expect(runGit(["config", "user.name", "t"], dir).status).toBe(0);
    expect(runCli(["init", dir], dir).status).toBe(0);
    const hostilePath = `${HOSTILE}.md`;
    writeFileSync(join(dir, hostilePath), "hostile doc\n", "utf8");
    const conventionPath = join(dir, "tasks", ".convention.yml");
    writeFileSync(
      conventionPath,
      updateGeneratedSection(
        readFileSync(conventionPath, "utf8"),
        {
          [hostilePath]: {
            template: "docs/hostile.md",
            checksum: checksumOf("hostile doc\n"),
            arggonVersion: arggonVersion(),
            generatedAt: "2026-09-18T00:00:00.000Z",
          },
        },
        "hostile",
      ),
      "utf8",
    );
    return dir;
  }

  it("escapes the x-generated doc path in the ack report", () => {
    const proc = runCli(["adopt", "--ack"], ackTree());
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    expect(proc.stdout).not.toContain("\nspoof");
    expect(proc.stdout).toContain("1 generated doc(s) acknowledged");
    // Discrimination: the escaped key must be present.
    expect(proc.stdout).toContain(`  ${HOSTILE_ESCAPED}.md — sha256:`);
    expect(proc.stderr).toBe("");
  });

  it("keeps the raw doc path in the --ack --json envelope", () => {
    const proc = runCli(["adopt", "--ack", "--json"], ackTree());
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { acked: { path: string }[]; count: number };
    expect(body.count).toBe(1);
    expect(body.acked[0]!.path).toBe(`${HOSTILE}.md`);
  });
});

describe("row/table stdout: tui", () => {
  it("escapes hostile ids/titles and the Enter-message path in the frame", () => {
    const item: WorkItem = {
      id: `task-A\u001bB`,
      type: "task",
      status: "todo",
      title: `T A\u2028B`,
      assignee: null,
      branch: null,
      parent: null,
      labels: [],
      priority: null,
      created: "2026-09-18",
      updated: "2026-09-18",
      path: `tasks/x/task-A\u001bB.md`,
      blocked_reason: null,
      milestone: null,
      depends_on: [],
      claimed_at: null,
      worktree_path: null,
      issue: null,
    };
    const state = initialTuiState(200, 8);
    state.message = `/tmp/task-A\u001bB.md`;
    const frame = renderTui([item], state, { color: false });
    // The renderer's own frame escape is trusted; the body must be inert.
    const body = frame.replace(/^\x1b\[H\x1b\[2J/, "");
    expect(body).not.toMatch(UNSAFE);
    expect(body).toContain("task-A\\u001bB");
    expect(body).toContain("T A\\u2028B");
    expect(body).toContain("/tmp/task-A\\u001bB.md");
  });
});
