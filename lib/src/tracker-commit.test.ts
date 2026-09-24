/**
 * Direct tests for the tracker commit primitive used by the native start
 * claim. The important invariant is surgical staging even when the caller's
 * index already contains unrelated work, and preserving hook failures as a
 * reported result rather than a false success.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { commitTrackerMutation } from "./tracker-commit.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 });
  expect(result.status, `${args.join(" ")}\n${result.stderr ?? ""}`).toBe(0);
  return (result.stdout ?? "").trim();
}

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-tracker-commit-"));
  roots.push(root);
  writeFileSync(join(root, "target.md"), "target 0\n");
  writeFileSync(join(root, "other.md"), "other 0\n");
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "commit-test@example.com"]);
  git(root, ["config", "user.name", "commit-test"]);
  git(root, ["add", "target.md", "other.md"]);
  git(root, ["commit", "-qm", "fixture"]);
  return root;
}

describe("commitTrackerMutation", () => {
  it("commits only the requested path and leaves unrelated staged work staged", () => {
    const root = repo();
    writeFileSync(join(root, "target.md"), "target 1\n");
    writeFileSync(join(root, "other.md"), "other 1\n");
    git(root, ["add", "other.md"]);

    const result = commitTrackerMutation(root, ["target.md"], {
      message: "chore(tasks): claimed task-test",
      commit: true,
    });

    expect(result.committed).toBe(true);
    expect(git(root, ["show", "--name-only", "--format=", "HEAD"])).toBe("target.md");
    expect(git(root, ["diff", "--cached", "--name-only"])).toBe("other.md");
    expect(git(root, ["status", "--short"])).toContain("M  other.md");
  });

  it("refuses a path outside the repository root", () => {
    const root = repo();
    const outside = join(root, "..", "outside.md");
    writeFileSync(outside, "outside\n");
    try {
      const result = commitTrackerMutation(root, [outside], {
        message: "chore(tasks): claimed task-test",
        commit: true,
      });
      expect(result).toMatchObject({
        committed: false,
        skipReason: "mutated path escapes repository root",
      });
    } finally {
      rmSync(outside, { force: true });
    }
  });

  it("reports a pre-commit hook failure and leaves the claim staged for retry", () => {
    const root = repo();
    const hook = join(root, ".git", "hooks", "pre-commit");
    writeFileSync(hook, "#!/bin/sh\necho hook-ran > hook-ran\nexit 1\n");
    chmodSync(hook, 0o755);
    writeFileSync(join(root, "target.md"), "target 1\n");

    const result = commitTrackerMutation(root, ["target.md"], {
      message: "chore(tasks): claimed task-test",
      commit: true,
    });

    expect(result.committed).toBe(false);
    expect(result.skipReason).toContain("git commit failed");
    expect(readFileSync(join(root, "hook-ran"), "utf8")).toBe("hook-ran\n");
    expect(git(root, ["status", "--short"])).toContain("M  target.md");
  });
});
