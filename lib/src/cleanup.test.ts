/**
 * The removal-blocker parser and the two skip reasons it feeds
 * (bug-cleanup-prune-untracked-artifacts-no-force).
 *
 * `cleanup --prune` used to classify a terminal+merged worktree
 * `removable: true`, then fail the removal on git's own refusal for untracked
 * generated scaffolding, with no force path and a raw git error for a receipt
 * (observed end of the release-pipeline waves, 2026-10-12). These tests pin the
 * two halves of the fix that live in the kernel:
 *
 *   - `parseRemovalBlockers` must split the blockers by what the force opt-in
 *     may discard — untracked (`??`) versus tracked modifications (everything
 *     else git refuses on), ignored files excluded because they die with the
 *     worktree; and
 *   - each skip reason must name what blocks and the EXACT remedy: the force
 *     path plus the manual sequence for untracked content, and "commit or
 *     discard first" for tracked work, which force never discards.
 */
import { describe, expect, it } from "vitest";
import {
  classifyCleanupEntry,
  parseRemovalBlockers,
  worktreeTrackedRefusal,
  worktreeUntrackedRefusal,
  type CleanupGit,
} from "./cleanup.js";
import type { WorkItem } from "./items.js";
import { MAX_CLAIM_WRITE_NAMES } from "./worktree.js";

function item(branch = "fix/task-alpha"): WorkItem {
  return {
    type: "task",
    status: "done",
    id: "task-alpha",
    branch,
    labels: [],
    dependsOn: [],
    extras: {},
    filePath: "/tracker/task-alpha.md",
    containerDir: "/tracker",
    body: "",
    data: {},
    worktreePath: "/repo-task-alpha",
  };
}

describe("parseRemovalBlockers", () => {
  it("splits untracked entries from tracked modifications, in porcelain order", () => {
    const porcelain = [
      "?? .opencode/harness/",
      " M lib/src/cleanup.ts",
      "?? generated/spec.json",
      "M  cli/src/cli.ts",
      "A  new-file.txt",
      "MM both.txt",
      "UU conflicted.txt",
      "R  old.txt -> renamed.txt",
      "",
    ].join("\n");

    expect(parseRemovalBlockers(porcelain)).toEqual({
      untracked: [".opencode/harness/", "generated/spec.json"],
      tracked: [
        "lib/src/cleanup.ts",
        "cli/src/cli.ts",
        "new-file.txt",
        "both.txt",
        "conflicted.txt",
        "renamed.txt",
      ],
    });
  });

  it("skips ignored files (they die with the worktree) and tolerates empty input", () => {
    expect(parseRemovalBlockers("!! node_modules/\n!! .arggon.env\n")).toEqual({
      untracked: [],
      tracked: [],
    });
    expect(parseRemovalBlockers("")).toEqual({ untracked: [], tracked: [] });
    expect(parseRemovalBlockers("\n \n")).toEqual({ untracked: [], tracked: [] });
  });

  it("unquotes a porcelain-quoted path", () => {
    expect(parseRemovalBlockers('?? "weird name/x.txt"\n').untracked).toEqual(["weird name/x.txt"]);
  });
});

describe("cleanup skip reasons name the exact remedy (bug-cleanup-prune-untracked-artifacts-no-force)", () => {
  it("untracked refusal: the blockers, the force path and the full manual sequence", () => {
    const reason = worktreeUntrackedRefusal(item(), "/repo-task-alpha", [
      ".opencode/harness/run.json",
      ".opencode/checks/",
    ]);

    expect(reason).toContain("2 untracked files");
    expect(reason).toContain(".opencode/harness/run.json");
    expect(reason).toContain(".opencode/checks/");
    // The force path on both surfaces.
    expect(reason).toContain("arggon cleanup --prune --force");
    expect(reason).toContain("cleanup({ prune: true, force: true })");
    // The full manual sequence the incident ended with.
    expect(reason).toContain("git worktree remove --force /repo-task-alpha");
    expect(reason).toContain("git branch -D fix/task-alpha");
    expect(reason).toContain("arggon cleanup --prune");
  });

  it("untracked refusal: caps the named paths and keeps the exact count", () => {
    const paths = Array.from({ length: MAX_CLAIM_WRITE_NAMES + 2 }, (_, i) => `gen/${i}.txt`);
    const reason = worktreeUntrackedRefusal(item(), "/repo-task-alpha", paths);

    expect(reason).toContain(`${MAX_CLAIM_WRITE_NAMES + 2} untracked files`);
    expect(reason).toContain(`gen/${MAX_CLAIM_WRITE_NAMES - 1}.txt`);
    expect(reason).not.toContain(`gen/${MAX_CLAIM_WRITE_NAMES}.txt`);
    expect(reason).toContain("and 2 more");
  });

  it("bounds an over-long path inside the named list (the reason rides the envelope)", () => {
    const long = `gen/${"x".repeat(400)}.txt`;
    const reason = worktreeUntrackedRefusal(item(), "/repo-task-alpha", [long]);

    expect(reason).not.toContain(long);
    expect(reason).toContain("…");
    expect(reason.length).toBeLessThan(1000);
  });

  it("tracked refusal: never offers the force opt-in as a way past uncommitted tracked work", () => {
    const reason = worktreeTrackedRefusal(item(), "/repo-task-alpha", ["lib/src/cleanup.ts"]);

    expect(reason).toContain("1 tracked file has uncommitted changes");
    expect(reason).toContain("lib/src/cleanup.ts");
    expect(reason).toContain("the force opt-in never discards tracked work");
    expect(reason).toContain("git worktree remove --force /repo-task-alpha");
    expect(reason).toContain("git branch -D fix/task-alpha");
  });

  it("omits the branch step when the item records no branch", () => {
    const reason = worktreeTrackedRefusal(item(""), "/repo-task-alpha", ["a.txt"]);

    expect(reason).not.toContain("git branch -D");
    expect(reason).toContain("arggon cleanup --prune to clear the record");
  });
});

/**
 * The probe-degradation fallback (review N1 on PR #751). `git status
 * --porcelain` is the ONLY evidence that `git worktree remove` will succeed, so
 * a probe that does not answer must not be classified `removable: true` with a
 * null reason and then fail on a raw git error: the entry is an honest skip
 * naming the failed probe and the manual sequence, and the force opt-in does
 * not bypass it. The control case pins that an ANSWERING probe keeps the clean
 * path removable exactly as before.
 */
describe("cleanup's probe-degradation fallback (review N1 on PR #751)", () => {
  // The probe is only reached for an existing, registered worktree: cwd always
  // exists on disk and the runner below claims it as this repo's only worktree.
  const worktree = process.cwd();

  function gitRunner(): CleanupGit {
    return {
      isRepo: () => true,
      worktreeList: () => [worktree],
      defaultBranch: () => "main",
      isAncestor: () => true,
      remoteBranchExists: () => false,
      removeWorktree: () => {
        throw new Error("the classifier must never remove anything itself");
      },
      deleteBranch: () => {
        throw new Error("the classifier must never delete branches itself");
      },
      deleteBranchForce: () => {
        throw new Error("the classifier must never delete branches itself");
      },
      branchExists: () => true,
    };
  }

  function targetItem(): WorkItem {
    return { ...item(), worktreePath: worktree };
  }

  it("classifies removable: false, naming the failed probe and the manual sequence", () => {
    const entry = classifyCleanupEntry(targetItem(), "/repo", "main", gitRunner(), {
      status: () => undefined,
    });

    expect(entry.removable).toBe(false);
    expect(entry.action).toBeNull();
    expect(entry.reason).toContain("'git status --porcelain'");
    expect(entry.reason).toContain(worktree);
    expect(entry.reason).toContain("Nothing was removed");
    expect(entry.reason).toContain("git worktree remove");
    expect(entry.reason).toContain("git branch -D fix/task-alpha");
    expect(entry.reason).toContain("arggon cleanup --prune");
  });

  it("does not let the force opt-in bypass an unanswered probe", () => {
    const entry = classifyCleanupEntry(targetItem(), "/repo", "main", gitRunner(), {
      status: () => undefined,
      force: true,
    });

    expect(entry.removable).toBe(false);
    expect(entry.reason).toContain("did not answer");
  });

  it("keeps the clean path removable when the probe answers (control)", () => {
    const entry = classifyCleanupEntry(targetItem(), "/repo", "main", gitRunner(), {
      status: () => "",
    });

    expect(entry.removable).toBe(true);
    expect(entry.reason).toBeNull();
    expect(entry.action).toBe("remove worktree and delete the merged branch");
  });
});
