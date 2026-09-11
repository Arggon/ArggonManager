import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runNext } from "./next.js";

function write(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

function md(frontmatter: string, title: string): string {
  return `---\n${frontmatter}---\n\n# ${title}\n`;
}

function makeTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-next-"));
  write(root, "tasks/.convention.yml", "version: 0\n");
  write(
    root,
    "tasks/launch/launch.md",
    md(
      'type: initiative\nstatus: todo\nid: launch\ntitle: Launch\nlabels: []\ncreated: "2026-09-11"\n',
      "Launch",
    ),
  );
  write(
    root,
    "tasks/launch/epic-a/epic-a.md",
    md(
      'type: epic\nstatus: todo\nid: epic-a\nparent: launch\ntitle: Epic A\nlabels: []\ncreated: "2026-09-11"\n',
      "Epic A",
    ),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/story-a.md",
    md(
      'type: story\nstatus: todo\nid: story-a\nparent: epic-a\ntitle: Story A\nlabels: []\ncreated: "2026-09-11"\n',
      "Story A",
    ),
  );
  // Lexicographically first, but claimed -> skipped.
  write(
    root,
    "tasks/launch/epic-a/story-a/task-aaa.md",
    md(
      'type: task\nstatus: in_progress\nid: task-aaa\nparent: story-a\nassignee: alice\nlabels: []\ncreated: "2026-09-11"\n',
      "Claimed",
    ),
  );
  // Unclaimed todo -> the pick (b < c).
  write(
    root,
    "tasks/launch/epic-a/story-a/task-bbb.md",
    md(
      'type: task\nstatus: todo\nid: task-bbb\nparent: story-a\nlabels: []\ncreated: "2026-09-11"\n',
      "Bee",
    ),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/task-ccc.md",
    md(
      'type: task\nstatus: todo\nid: task-ccc\nparent: story-a\nassignee: bob\nlabels: []\ncreated: "2026-09-11"\n',
      "Pre-claimed",
    ),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/bug-ddd.md",
    md(
      'type: bug\nstatus: blocked\nid: bug-ddd\nparent: story-a\nblocked_reason: "waiting"\nlabels: []\ncreated: "2026-09-11"\n',
      "Blocked",
    ),
  );
  return root;
}

describe("runNext", () => {
  it("suggests id, title, parent chain, and reason", () => {
    const { suggestion } = runNext({ cwd: makeTree() });
    expect(suggestion).not.toBeNull();
    // story-a sorts before task-bbb and is itself an unclaimed claimable todo.
    expect(suggestion!.item.id).toBe("story-a");
    expect(suggestion!.item.title).toBe("Story A");
    expect(suggestion!.parentChain).toEqual(["launch", "epic-a"]);
    expect(suggestion!.parentChainDisplay).toEqual(["launch (Launch)", "epic-a (Epic A)"]);
    expect(suggestion!.reason).toContain("unclaimed todo story");
    expect(suggestion!.reason).toContain("epic-a");
    expect(suggestion!.poolSize).toBe(2);
  });

  it("picks the lexicographic task once the story is claimed", () => {
    const root = makeTree();
    const storyMd = join(root, "tasks/launch/epic-a/story-a/story-a.md");
    const raw = readFileSync(storyMd, "utf8")
      .replace("status: todo", "status: in_progress")
      .replace('created: "2026-09-11"', 'assignee: alice\ncreated: "2026-09-11"');
    writeFileSync(storyMd, raw, "utf8");
    const { suggestion } = runNext({ cwd: root });
    expect(suggestion!.item.id).toBe("task-bbb");
    expect(suggestion!.parentChain).toEqual(["launch", "epic-a", "story-a"]);
    expect(suggestion!.poolSize).toBe(1);
  });

  it("returns null for an empty todo pool", () => {
    const root = mkdtempSync(join(tmpdir(), "arggon-next-empty-"));
    write(root, "tasks/.convention.yml", "version: 0\n");
    write(
      root,
      "tasks/launch/launch.md",
      md(
        'type: initiative\nstatus: done\nid: launch\ntitle: Launch\nlabels: []\ncreated: "2026-09-11"\n',
        "Launch",
      ),
    );
    const result = runNext({ cwd: root });
    expect(result.suggestion).toBeNull();
  });

  it("throws outside a tasks/ tree", () => {
    const root = mkdtempSync(join(tmpdir(), "arggon-next-naked-"));
    expect(() => runNext({ cwd: root })).toThrow(/No tasks\/ convention/);
  });
});

describe("runNext dependency awareness (spec-deps-001)", () => {
  function depTree(): string {
    const root = mkdtempSync(join(tmpdir(), "arggon-next-deps-"));
    write(root, "tasks/.convention.yml", "version: 3\n");
    write(
      root,
      "tasks/launch/epic-a/story-a/task-aaa.md",
      md(
        'type: task\nstatus: todo\nid: task-aaa\nparent: story-a\ndepends_on: ["task-zzz"]\nlabels: []\ncreated: "2026-09-11"\n',
        "Blocked task",
      ),
    );
    write(
      root,
      "tasks/launch/epic-a/story-a/task-bbb.md",
      md(
        'type: task\nstatus: todo\nid: task-bbb\nparent: story-a\nlabels: []\ncreated: "2026-09-11"\n',
        "Ready task",
      ),
    );
    write(
      root,
      "tasks/launch/epic-a/story-a/task-zzz.md",
      md(
        'type: task\nstatus: in_progress\nid: task-zzz\nparent: story-a\nassignee: alice\nlabels: []\ncreated: "2026-09-11"\n',
        "Open blocker",
      ),
    );
    return root;
  }

  it("ranks ready items first even when a blocked item sorts earlier", () => {
    const { suggestion } = runNext({ cwd: depTree() });
    expect(suggestion!.item.id).toBe("task-bbb");
    expect(suggestion!.blockedBy).toEqual([]);
    expect(suggestion!.poolSize).toBe(2);
  });

  it("--ready limits the pool to items whose depends_on are all terminal", () => {
    const { suggestion } = runNext({ cwd: depTree(), ready: true });
    expect(suggestion!.item.id).toBe("task-bbb");
    expect(suggestion!.poolSize).toBe(1);
    expect(suggestion!.reason).toContain("--ready");
  });

  it("suggests the blocked item when nothing is ready, with the blockers in reason and blockedBy", () => {
    const root = depTree();
    // Claim the only ready candidate so the pool is blocked-only.
    const readyMd = join(root, "tasks/launch/epic-a/story-a/task-bbb.md");
    writeFileSync(
      readyMd,
      readFileSync(readyMd, "utf8")
        .replace("status: todo", "status: in_progress")
        .replace('created: "2026-09-11"', 'assignee: bob\ncreated: "2026-09-11"'),
      "utf8",
    );
    const { suggestion } = runNext({ cwd: root });
    expect(suggestion!.item.id).toBe("task-aaa");
    expect(suggestion!.blockedBy).toEqual(["task-zzz"]);
    expect(suggestion!.reason).toContain("task-zzz");
    expect(suggestion!.reason).toContain("open dependencies");
  });

  it("--ready returns null when every candidate has open dependencies", () => {
    const root = depTree();
    const readyMd = join(root, "tasks/launch/epic-a/story-a/task-bbb.md");
    writeFileSync(
      readyMd,
      readFileSync(readyMd, "utf8")
        .replace("status: todo", "status: in_progress")
        .replace('created: "2026-09-11"', 'assignee: bob\ncreated: "2026-09-11"'),
      "utf8",
    );
    const { suggestion } = runNext({ cwd: root, ready: true });
    expect(suggestion).toBeNull();
  });

  it("treats done and cancelled dependencies as terminal (item becomes ready)", () => {
    const root = depTree();
    const blockerMd = join(root, "tasks/launch/epic-a/story-a/task-zzz.md");
    writeFileSync(
      blockerMd,
      readFileSync(blockerMd, "utf8")
        .replace("status: in_progress", "status: done")
        .replace("assignee: alice", "assignee: null"),
      "utf8",
    );
    const { suggestion } = runNext({ cwd: root });
    expect(suggestion!.item.id).toBe("task-aaa");
    expect(suggestion!.blockedBy).toEqual([]);
    expect(suggestion!.poolSize).toBe(2);
  });
});
