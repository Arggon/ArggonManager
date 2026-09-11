import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { getOpenPRs, getOpenPRsForRepo } from "./get-open-prs.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type MockFn = ReturnType<typeof vi.fn>;

/** Create a mock that handles both gh and git commands for getOpenPRs. */
function createPrsMock(
  prListOutput: string | null,
  apiOutput: string | null,
  gitRemoteUrl: string | null
): MockFn {
  return vi.fn((cmd: string, args: string[]) => {
    // Git commands (from detectRepo via execGit)
    if (cmd === "git" && args[0] === "remote" && args[1] === "get-url") {
      if (gitRemoteUrl === null) throw new Error("no git remote mock");
      return gitRemoteUrl;
    }
    // gh api fallback
    if (cmd === "gh" && args[0] === "api") {
      if (apiOutput === null) throw new Error("api failed");
      return apiOutput;
    }
    // gh pr list
    if (cmd === "gh" && args[0] === "pr" && args[1] === "list") {
      if (prListOutput === null) throw new Error("pr list failed");
      return prListOutput;
    }
    throw new Error(`Unexpected: ${cmd} ${args.join(" ")}`);
  });
}

/** Create a mock that handles only gh commands (for getOpenPRsForRepo). */
function createGhOnlyMock(prListOutput: string): MockFn {
  return vi.fn((cmd: string, args: string[]) => {
    if (cmd === "gh" && args[0] === "pr" && args[1] === "list") {
      return prListOutput;
    }
    throw new Error(`Unexpected: ${cmd} ${args.join(" ")}`);
  });
}

describe("getOpenPRs", () => {
  function withGitRepo(testDir: string): void {
    execFileSync("git", ["init", "--quiet"], { cwd: testDir, encoding: "utf8" });
    execFileSync(
      "git",
      ["remote", "add", "origin", "https://github.com/arggon/test.git"],
      { cwd: testDir, encoding: "utf8" }
    );
  }

  it("throws when repo cannot be detected and no explicit repo provided", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-prs-"));
    // No .git directory, so detectRepo returns null

    const execGh = vi.fn();
    expect(() => getOpenPRs(null, dir, execGh as unknown as typeof execFileSync)).toThrow(
      /Cannot determine GitHub repository/
    );
  });

  it("detects repo from git remote and fetches PRs", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-prs-"));
    withGitRepo(dir);

    const execGh = createPrsMock(
      JSON.stringify([
        {
          number: 42,
          title: "Add feature",
          headRefName: "feat/add-feature",
          url: "https://github.com/arggon/test/pull/42",
        },
      ]),
      null, // api not used
      "https://github.com/arggon/test.git"
    );

    const result = getOpenPRs(null, dir, execGh as unknown as typeof execFileSync);
    expect(result).toEqual([
      {
        number: 42,
        title: "Add feature",
        headRefName: "feat/add-feature",
        url: "https://github.com/arggon/test/pull/42",
      },
    ]);
  });

  it("falls back to gh api when pr list fails", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-prs-"));
    withGitRepo(dir);

    const execGh = createPrsMock(
      null, // pr list fails
      JSON.stringify([
        {
          number: 99,
          title: "API PR",
          headRefName: "feat/api-pr",
          url: "https://github.com/arggon/test/pull/99",
        },
      ]),
      "https://github.com/arggon/test.git"
    );

    const result = getOpenPRs(null, dir, execGh as unknown as typeof execFileSync);
    expect(result).toEqual([
      {
        number: 99,
        title: "API PR",
        headRefName: "feat/api-pr",
        url: "https://github.com/arggon/test/pull/99",
      },
    ]);
  });

  it("throws when both pr list and api fail", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-prs-"));
    withGitRepo(dir);

    const execGh = createPrsMock(
      null, // pr list fails
      null, // api fails
      "https://github.com/arggon/test.git"
    );

    expect(() => getOpenPRs(null, dir, execGh as unknown as typeof execFileSync)).toThrow(/GitHub API error/);
  });

  it("uses explicit repo without detecting from git", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-prs-"));
    // No .git directory, but explicit repo provided

    const execGh = createGhOnlyMock(
      JSON.stringify([
        {
          number: 1,
          title: "Explicit repo PR",
          headRefName: "feat/explicit",
          url: "https://github.com/explicit/repo/pull/1",
        },
      ])
    );

    const result = getOpenPRs("explicit/repo", dir, execGh as unknown as typeof execFileSync);
    expect(result).toEqual([
      {
        number: 1,
        title: "Explicit repo PR",
        headRefName: "feat/explicit",
        url: "https://github.com/explicit/repo/pull/1",
      },
    ]);
    // Should NOT call git remote get-url since repo is explicit
    expect(execGh).not.toHaveBeenCalledWith(
      "git",
      expect.any(Array),
      expect.any(Object)
    );
  });
});

describe("getOpenPRsForRepo", () => {
  it("returns parsed PRs from gh pr list output", () => {
    const execGh = createGhOnlyMock(
      JSON.stringify([
        {
          number: 10,
          title: "PR One",
          headRefName: "feat/one",
          url: "https://github.com/owner/repo/pull/10",
        },
        {
          number: 20,
          title: "PR Two",
          headRefName: "feat/two",
          url: "https://github.com/owner/repo/pull/20",
        },
      ])
    );

    const result = getOpenPRsForRepo("owner", "repo", execGh as unknown as typeof execFileSync);
    expect(result).toEqual([
      { number: 10, title: "PR One", headRefName: "feat/one", url: "https://github.com/owner/repo/pull/10" },
      { number: 20, title: "PR Two", headRefName: "feat/two", url: "https://github.com/owner/repo/pull/20" },
    ]);
  });

  it("returns empty array when no open PRs", () => {
    const execGh = createGhOnlyMock("[]");

    const result = getOpenPRsForRepo("owner", "repo", execGh as unknown as typeof execFileSync);
    expect(result).toEqual([]);
  });
});
