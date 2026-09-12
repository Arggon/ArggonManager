import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";
import { type GhExecutor, ghIssueListJson, importedBody, mapIssueState, normalizeGhLabels, runImportIssues } from "./import-issues.js";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { runValidate } from "./validate.js";

const NOW = new Date("2026-09-11T12:00:00Z");

type MockFn = ReturnType<typeof vi.fn>;

function ghIssueListMock(payload: string | null): MockFn {
  return vi.fn((cmd: string, args: string[]) => {
    if (cmd === "gh" && args[0] === "issue" && args[1] === "list") {
      if (payload === null) throw new Error("gh auth expired");
      return payload;
    }
    throw new Error(`Unexpected: ${cmd} ${args.join(" ")}`);
  });
}

const FIXTURE_ISSUES = [
  {
    number: 1,
    title: "Fix login",
    state: "OPEN",
    body: "Login fails on empty password.",
    labels: ["bug", { name: "Good First Issue" }],
  },
  {
    number: 2,
    title: "Old dark mode request",
    state: "CLOSED",
    body: "Shipped already.",
    labels: [{ name: "???" }],
  },
];

/** Primed tree: init + initiative + epic (enough for the default story placement). */
function primed(withEpic = true): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-import-issues-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
  if (withEpic) {
    runCreate({ cwd: dir, type: "epic", title: "Backlog", parent: "launch-mvp", now: NOW });
  }
  return dir;
}

function treeFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (cur: string): void => {
    for (const name of readdirSync(cur)) {
      const full = join(cur, name);
      if (name === ".git") continue;
      try {
        if (readdirSync(full)) {
          walk(full);
          continue;
        }
      } catch {
        // not a directory
      }
      out.push(full);
    }
  };
  walk(join(dir, "tasks"));
  return out.sort();
}

function fm(path: string) {
  return parseFrontmatter(readFileSync(path, "utf8")).data;
}

describe("runImportIssues", () => {
  it("maps open issues to todo and closed issues to done under an auto-created story", () => {
    const dir = primed();
    const execGh = ghIssueListMock(JSON.stringify(FIXTURE_ISSUES));

    const result = runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, now: NOW });

    expect(result.story).toEqual({ id: "story-imported-issues", created: true });
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.entries).toEqual([
      {
        issue: 1,
        id: "task-issue-1",
        title: "issue #1: Fix login",
        status: "todo",
        action: "created",
      },
      {
        issue: 2,
        id: "task-issue-2",
        title: "issue #2: Old dark mode request",
        status: "done",
        action: "created",
      },
    ]);

    const storyPath = join(dir, "tasks/launch-mvp/backlog/story-imported-issues/story-imported-issues.md");
    expect(fm(storyPath)).toMatchObject({ type: "story", id: "story-imported-issues", parent: "backlog" });

    const openPath = join(dir, "tasks/launch-mvp/backlog/story-imported-issues/task-issue-1.md");
    expect(fm(openPath)).toMatchObject({
      type: "task",
      id: "task-issue-1",
      status: "todo",
      parent: "story-imported-issues",
      title: "issue #1: Fix login",
    });

    const closedPath = join(dir, "tasks/launch-mvp/backlog/story-imported-issues/task-issue-2.md");
    expect(fm(closedPath)).toMatchObject({ type: "task", id: "task-issue-2", status: "done" });
    // The temporary import claimant never persists on the closed item.
    expect(fm(closedPath).assignee).toBeUndefined();

    // The imported tree must be convention-clean.
    const validation = runValidate({ cwd: dir });
    expect(validation.errors).toEqual([]);
  });

  it("writes the original issue body plus the provenance line", () => {
    const dir = primed();
    const execGh = ghIssueListMock(JSON.stringify(FIXTURE_ISSUES));
    runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, now: NOW });

    const raw = readFileSync(
      join(dir, "tasks/launch-mvp/backlog/story-imported-issues/task-issue-1.md"),
      "utf8",
    );
    expect(raw).toContain("Login fails on empty password.");
    expect(raw).toContain("> imported from issue #1");

    const closed = readFileSync(
      join(dir, "tasks/launch-mvp/backlog/story-imported-issues/task-issue-2.md"),
      "utf8",
    );
    expect(closed).toContain("> imported from issue #2");
  });

  it("is idempotent: a re-run imports nothing", () => {
    const dir = primed();
    const execGh = ghIssueListMock(JSON.stringify(FIXTURE_ISSUES));
    const first = runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, now: NOW });
    expect(first.created).toBe(2);

    const before = treeFiles(dir);
    const second = runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, now: NOW });

    expect(second.created).toBe(0);
    expect(second.skipped).toBe(2);
    expect(second.story).toEqual({ id: "story-imported-issues", created: false });
    expect(second.entries.map((e) => e.action)).toEqual(["skipped", "skipped"]);
    expect(treeFiles(dir)).toEqual(before);
  });

  it("dry run prints the plan and writes nothing", () => {
    const dir = primed();
    const execGh = ghIssueListMock(JSON.stringify(FIXTURE_ISSUES));
    const before = treeFiles(dir);

    const result = runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, dryRun: true, now: NOW });

    expect(result.dryRun).toBe(true);
    expect(result.created).toBe(2);
    expect(result.entries.map((e) => e.action)).toEqual(["would-create", "would-create"]);
    expect(result.story).toEqual({ id: "story-imported-issues", created: false });
    expect(existsSync(join(dir, "tasks/launch-mvp/backlog/story-imported-issues"))).toBe(false);
    expect(treeFiles(dir)).toEqual(before);
  });

  it("honors --parent instead of creating the default story", () => {
    const dir = primed();
    runCreate({ cwd: dir, type: "story", title: "Import", parent: "backlog", id: "story-import", now: NOW });
    const execGh = ghIssueListMock(JSON.stringify(FIXTURE_ISSUES));

    const result = runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, parent: "story-import", now: NOW });

    expect(result.story).toEqual({ id: "story-import", created: false });
    expect(existsSync(join(dir, "tasks/launch-mvp/backlog/story-imported-issues"))).toBe(false);
    const taskPath = join(dir, "tasks/launch-mvp/backlog/story-import/task-issue-1.md");
    expect(fm(taskPath)).toMatchObject({ id: "task-issue-1", parent: "story-import" });
  });

  it("maps labels kebab-case, dedupes, and counts invalid ones", () => {
    const dir = primed();
    const issues = [
      {
        number: 7,
        title: "Labeled",
        state: "OPEN",
        body: null,
        labels: ["Bug Report", { name: "bug report" }, "???", { name: "" }],
      },
    ];
    const execGh = ghIssueListMock(JSON.stringify(issues));

    const result = runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, now: NOW });

    expect(result.labelsMapped).toBe(1);
    expect(result.labelsSkipped).toBe(2);
    expect(
      fm(join(dir, "tasks/launch-mvp/backlog/story-imported-issues/task-issue-7.md")).labels,
    ).toEqual(["bug-report"]);
  });

  it("fails with an actionable error when the tree has no epic", () => {
    const dir = primed(false); // initiative only
    const execGh = ghIssueListMock(JSON.stringify(FIXTURE_ISSUES));

    expect(() => runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, now: NOW })).toThrow(
      /no epic found under tasks\/.*--parent <story-id>/s,
    );
  });

  it("rejects a --parent that does not resolve or is not a story", () => {
    const dir = primed();
    const execGh = ghIssueListMock(JSON.stringify(FIXTURE_ISSUES));

    expect(() => runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, parent: "story-nope", now: NOW })).toThrow(
      /--parent 'story-nope' does not resolve/,
    );
    expect(() => runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, parent: "backlog", now: NOW })).toThrow(
      /is a epic, not a story/,
    );
  });

  it("rejects a malformed --repo slug before calling gh", () => {
    const dir = primed();
    const execGh = ghIssueListMock(JSON.stringify(FIXTURE_ISSUES));

    expect(() => runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, repo: "foo", now: NOW })).toThrow(
      /Invalid --repo "foo": expected "owner\/name"/,
    );
    expect(execGh).not.toHaveBeenCalled();
  });

  it("surfaces gh failures as actionable errors", () => {
    const dir = primed();
    const execGh = ghIssueListMock(null);

    expect(() => runImportIssues({ cwd: dir, execGh: execGh as unknown as GhExecutor, now: NOW })).toThrow(
      /gh issue list failed \(gh auth expired; check `gh auth status`\)/,
    );
  });
});

describe("ghIssueListJson", () => {
  it("requests all issues with the documented JSON fields and limit", () => {
    const execGh = ghIssueListMock(JSON.stringify(FIXTURE_ISSUES));
    ghIssueListJson({ repo: "octocat/hello-world", execGh: execGh as unknown as GhExecutor });
    expect(execGh).toHaveBeenCalledWith(
      "gh",
      [
        "issue",
        "list",
        "--state",
        "all",
        "--limit",
        "200",
        "--json",
        "number,title,state,body,labels",
        "--repo",
        "octocat/hello-world",
      ],
      expect.any(Object),
    );
  });

  it("maps ENOENT to an install hint", () => {
    const enoent = Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
    const execGh = vi.fn(() => {
      throw enoent;
    });
    expect(() => ghIssueListJson({ execGh: execGh as unknown as GhExecutor })).toThrow(
      /gh not found \(install gh and run `gh auth login`\)/,
    );
  });

  it("rejects unparseable gh output", () => {
    const execGh = ghIssueListMock("not json");
    expect(() => ghIssueListJson({ execGh: execGh as unknown as GhExecutor })).toThrow(
      /gh issue list returned unparseable JSON/,
    );
  });
});

describe("normalizeGhLabels", () => {
  it("slugifies, dedupes, and counts invalid entries", () => {
    expect(normalizeGhLabels(["Bug Report", { name: "bug report" }, "???"])).toEqual({
      labels: ["bug-report"],
      skipped: 1,
    });
    expect(normalizeGhLabels(undefined)).toEqual({ labels: [], skipped: 0 });
  });
});

describe("mapIssueState", () => {
  it("maps closed (any case) to done and everything else to todo", () => {
    expect(mapIssueState("CLOSED")).toBe("done");
    expect(mapIssueState("closed")).toBe("done");
    expect(mapIssueState("OPEN")).toBe("todo");
    expect(mapIssueState("")).toBe("todo");
  });
});

describe("importedBody", () => {
  it("keeps the issue body and appends the provenance line", () => {
    expect(importedBody({ number: 3, title: "T", state: "OPEN", body: "Line one.\r\nLine two." })).toBe(
      "Line one.\nLine two.\n> imported from issue #3\n",
    );
    expect(importedBody({ number: 4, title: "T", state: "OPEN", body: null })).toBe(
      "> imported from issue #4\n",
    );
  });
});
