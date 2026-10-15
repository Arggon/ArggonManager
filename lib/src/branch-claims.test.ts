import { execFileSync } from "node:child_process";
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
import { findBranchClaims } from "./branch-claims.js";
import { loadItems } from "./items.js";
import type { PRInfo } from "./sync-types.js";

// bug-claim-pool-computed-from-main-misses-branch-claims: hermetic — a real
// local git repo, no network, no gh. Every case builds its own refs.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

function git(dir: string, args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
}

function write(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

function md(frontmatter: string, title: string): string {
  return `---\n${frontmatter}---\n\n# ${title}\n`;
}

const TASK_REL = "tasks/launch/epic-a/story-a/task-held.md";

function todoTask(): string {
  return md(
    'type: task\nstatus: todo\nid: task-held\nparent: story-a\ntitle: Held\nlabels: []\ncreated: "2026-10-01"\n',
    "Held",
  );
}

function claimedTask(assignee = "alice", claimedAt = "2026-10-01T00:00:00.000Z"): string {
  return md(
    `type: task\nstatus: in_progress\nid: task-held\nparent: story-a\nassignee: ${assignee}\nclaimed_at: "${claimedAt}"\nlabels: []\ncreated: "2026-10-01"\n`,
    "Held",
  );
}

/** A tracker tree in a real git repo, seeded on `main` and committed. */
function initRepo(): string {
  const root = mkdtempSync("arggon-branch-claims-");
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "t@example.com"]);
  git(root, ["config", "user.name", "T"]);
  write(root, "tasks/.convention.yml", "version: 0\n");
  write(
    root,
    "tasks/launch/launch.md",
    md("type: initiative\nstatus: todo\nid: launch\ntitle: Launch\nlabels: []\n", "Launch"),
  );
  write(
    root,
    "tasks/launch/epic-a/epic-a.md",
    md(
      "type: epic\nstatus: todo\nid: epic-a\nparent: launch\ntitle: Epic A\nlabels: []\n",
      "Epic A",
    ),
  );
  write(
    root,
    "tasks/launch/epic-a/story-a/story-a.md",
    md(
      "type: story\nstatus: todo\nid: story-a\nparent: epic-a\ntitle: Story A\nlabels: []\n",
      "Story A",
    ),
  );
  write(root, TASK_REL, todoTask());
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", "seed"]);
  return root;
}

/** Commit `content` for the item file on a new branch, then return to main. */
function commitOnBranch(root: string, branch: string, content: string): void {
  git(root, ["checkout", "-q", "-b", branch]);
  write(root, TASK_REL, content);
  git(root, ["add", "-A"]);
  // --allow-empty: a case may deliberately commit the SAME copy as main (an
  // unclaimed branch), and the branch itself is what the reader looks at.
  git(root, ["commit", "-q", "--allow-empty", "-m", `claim: task-held on ${branch}`]);
  git(root, ["checkout", "-q", "main"]);
}

function itemsOf(root: string) {
  return loadItems(join(root, "tasks"));
}

function pr(number: number, headRefName: string): PRInfo {
  return { number, headRefName, title: `PR #${number}`, url: `https://example.test/${number}` };
}

describe("findBranchClaims", () => {
  it("reads a claim from an unmerged branch while the local copy stays todo", () => {
    const root = initRepo();
    commitOnBranch(root, "feat/task-held", claimedTask());

    const result = findBranchClaims({ root, items: itemsOf(root), prs: [] });

    expect(result.errors).toEqual([]);
    expect(result.claims).toEqual([
      {
        id: "task-held",
        branch: "feat/task-held",
        pr: null,
        assignee: "alice",
        claimed_at: "2026-10-01T00:00:00.000Z",
        local: { status: "todo", assignee: null },
      },
    ]);
    // The local copy is untouched — the regression is the surface, not a write.
    expect(readFileSync(join(root, TASK_REL), "utf8")).toBe(todoTask());
  });

  it("maps an open PR to the branch claim", () => {
    const root = initRepo();
    commitOnBranch(root, "feat/task-held", claimedTask("bob"));

    const result = findBranchClaims({
      root,
      items: itemsOf(root),
      prs: [pr(42, "feat/task-held")],
    });

    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]).toMatchObject({ branch: "feat/task-held", pr: 42, assignee: "bob" });
  });

  it("reads a fetched origin ref when the branch is not checked out locally", () => {
    const root = initRepo();
    commitOnBranch(root, "feat/task-held", claimedTask("carol"));
    git(root, ["update-ref", "refs/remotes/origin/feat/task-held", "refs/heads/feat/task-held"]);
    git(root, ["branch", "-D", "feat/task-held"]);

    const result = findBranchClaims({ root, items: itemsOf(root), prs: [] });

    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]).toMatchObject({ branch: "feat/task-held", assignee: "carol" });
  });

  it("reports a PR branch that is not available locally instead of assuming it unclaimed", () => {
    const root = initRepo();

    const result = findBranchClaims({
      root,
      items: itemsOf(root),
      prs: [pr(77, "feat/task-held")],
    });

    expect(result.claims).toEqual([]);
    expect(result.errors).toEqual([
      {
        id: "task-held",
        branch: "feat/task-held",
        pr: 77,
        reason: "branch not available locally (fetch it to read its copy)",
      },
    ]);
  });

  it("reports an unreadable branch copy instead of assuming it unclaimed", () => {
    const root = initRepo();
    commitOnBranch(root, "feat/task-held", "no frontmatter here\n");

    const result = findBranchClaims({ root, items: itemsOf(root), prs: [] });

    expect(result.claims).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ id: "task-held", branch: "feat/task-held" });
    expect(result.errors[0]!.reason).toContain("no readable frontmatter");
  });

  it("ignores a branch copy that carries no claim", () => {
    const root = initRepo();
    commitOnBranch(root, "feat/task-held", todoTask());

    const result = findBranchClaims({ root, items: itemsOf(root), prs: [] });

    expect(result).toEqual({ claims: [], errors: [] });
  });

  it("skips an item this tree already shows as claimed", () => {
    const root = initRepo();
    // Locally claimed: the claim is visible here — no branch read needed.
    write(root, TASK_REL, claimedTask("dave"));
    git(root, ["add", "-A"]);
    git(root, ["commit", "-qm", "local claim"]);
    commitOnBranch(root, "feat/task-held", claimedTask("dave"));

    const result = findBranchClaims({ root, items: itemsOf(root), prs: [] });
    expect(result).toEqual({ claims: [], errors: [] });
  });

  it("skips terminal items — their branch claims are history, not held work", () => {
    const root = initRepo();
    write(
      root,
      TASK_REL,
      md(
        "type: task\nstatus: done\nid: task-held\nparent: story-a\nassignee: dave\nlabels: []\n",
        "Held",
      ),
    );
    git(root, ["add", "-A"]);
    git(root, ["commit", "-qm", "done"]);
    commitOnBranch(root, "feat/task-held", claimedTask("dave"));

    expect(findBranchClaims({ root, items: itemsOf(root), prs: [] })).toEqual({
      claims: [],
      errors: [],
    });
  });

  it("returns empty on a tree without a git repository (nothing to reconcile)", () => {
    const root = mkdtempSync("arggon-branch-claims-nogit-");
    write(root, "tasks/.convention.yml", "version: 0\n");
    write(
      root,
      "tasks/launch/launch.md",
      md("type: initiative\nstatus: todo\nid: launch\ntitle: Launch\nlabels: []\n", "Launch"),
    );
    write(
      root,
      "tasks/launch/epic-a/epic-a.md",
      md(
        "type: epic\nstatus: todo\nid: epic-a\nparent: launch\ntitle: Epic A\nlabels: []\n",
        "Epic A",
      ),
    );
    write(
      root,
      "tasks/launch/epic-a/story-a/story-a.md",
      md(
        "type: story\nstatus: todo\nid: story-a\nparent: epic-a\ntitle: Story A\nlabels: []\n",
        "Story A",
      ),
    );
    write(root, TASK_REL, todoTask());

    expect(findBranchClaims({ root, items: itemsOf(root), prs: [] })).toEqual({
      claims: [],
      errors: [],
    });
  });

  it("reports a branch copy whose frontmatter carries no item id", () => {
    const root = initRepo();
    commitOnBranch(
      root,
      "feat/task-held",
      md("type: task\nstatus: in_progress\nparent: story-a\nassignee: eve\nlabels: []\n", "No id"),
    );

    const result = findBranchClaims({ root, items: itemsOf(root), prs: [] });

    expect(result.claims).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.reason).toContain("no item id");
  });

  it("ignores a branch whose item file carries a different id", () => {
    const root = initRepo();
    commitOnBranch(
      root,
      "feat/task-held",
      md(
        "type: task\nstatus: in_progress\nid: task-other\nparent: story-a\nassignee: eve\nlabels: []\n",
        "Other",
      ),
    );

    expect(findBranchClaims({ root, items: itemsOf(root), prs: [] })).toEqual({
      claims: [],
      errors: [],
    });
  });
});
