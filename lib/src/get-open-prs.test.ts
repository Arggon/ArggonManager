import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { MAX_HUMAN_ERROR_CHARS } from "@arggondev/lib";
import { getOpenPRs, getOpenPRsForRepo, ghPrListJson, parseRepoSlug } from "./get-open-prs.js";
import { mkdtempSync as _mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

type MockFn = ReturnType<typeof vi.fn>;

/** Create a mock that handles both gh and git commands for getOpenPRs. */
function createPrsMock(
  prListOutput: string | null,
  apiOutput: string | null,
  gitRemoteUrl: string | null,
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

describe("parseRepoSlug", () => {
  it("accepts owner/name", () => {
    expect(parseRepoSlug("octocat/hello-world")).toEqual({ owner: "octocat", repo: "hello-world" });
  });

  it("rejects slugs that are not exactly owner/name", () => {
    for (const bad of ["foo", "a/b/c", "/repo", "owner/", "owner /repo", ""]) {
      expect(() => parseRepoSlug(bad)).toThrow(/Invalid --repo ".*": expected "owner\/name"/);
    }
  });
});

describe("getOpenPRs", () => {
  function withGitRepo(testDir: string): void {
    execFileSync("git", ["init", "--quiet"], { cwd: testDir, encoding: "utf8" });
    execFileSync("git", ["remote", "add", "origin", "https://github.com/arggon/test.git"], {
      cwd: testDir,
      encoding: "utf8",
    });
  }

  it("throws when repo cannot be detected and no explicit repo provided", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-prs-"));
    // No .git directory, so detectRepo returns null

    const execGh = vi.fn();
    expect(() => getOpenPRs(null, dir, execGh as unknown as typeof execFileSync)).toThrow(
      /Cannot determine GitHub repository/,
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
      "https://github.com/arggon/test.git",
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
      "https://github.com/arggon/test.git",
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
      "https://github.com/arggon/test.git",
    );

    expect(() => getOpenPRs(null, dir, execGh as unknown as typeof execFileSync)).toThrow(
      /GitHub API error/,
    );
  });

  it("rejects a malformed --repo slug up front with an actionable error", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-prs-"));
    const execGh = vi.fn();
    expect(() => getOpenPRs("foo", dir, execGh as unknown as typeof execFileSync)).toThrow(
      /Invalid --repo "foo": expected "owner\/name"/,
    );
    expect(execGh).not.toHaveBeenCalled();
  });

  it("uses explicit repo without detecting from git and passes --limit 100", () => {
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
      ]),
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
    expect(execGh).not.toHaveBeenCalledWith("git", expect.any(Array), expect.any(Object));
    // gh default cap is 30: the shared reader always asks for 100
    expect(execGh).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["--limit", "100"]),
      expect.any(Object),
    );
  });

  it("keeps its gh failure message bounded, so the trailing remedy is never clip-reachable", () => {
    // Recorded compliant by task-clip-class-sweep-remaining-sites (the sibling
    // item's F5 correction): gh runs with stderr IGNORED
    // (`stdio: ["ignore", "pipe", "ignore"]` in the kernel wrapper), so the
    // interpolated detail is Node's BOUNDED `Command failed: gh … <argv>`
    // echo — never an unbounded stderr tail — and the `check \`gh auth
    // status\`` remedy appended AFTER it cannot be pushed past any head-kept
    // clip. The mock reproduces Node's real echo shape, derived from the
    // invocation the wrapper itself makes, so it tracks any argv change.
    // `ghPrListJson` directly: `getOpenPRsForRepo` otherwise routes a pr-list
    // failure through its `gh api` fallback and reports that instead.
    const execGh = vi.fn((cmd: string, args: string[]) => {
      throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
    });
    let message = "";
    try {
      ghPrListJson({
        repo: "owner/repo",
        fields: "number,headRefName,url,isDraft,state,statusCheckRollup",
        execGh: execGh as unknown as typeof execFileSync,
      });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    // Both the receipt and the trailing remedy arrive…
    expect(message).toContain("gh pr list failed (Command failed: gh pr list");
    expect(message).toContain("check `gh auth status`");
    // …with more than 1000 chars of headroom under the human-channel clip, so
    // no ordering of these clauses can expose the remedy to the clip. A future
    // edit that interpolates anything unbounded into this message fails here.
    expect(message.length).toBeLessThan(MAX_HUMAN_ERROR_CHARS);
    expect(MAX_HUMAN_ERROR_CHARS - message.length).toBeGreaterThan(1000);
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
      ]),
    );

    const result = getOpenPRsForRepo("owner", "repo", execGh as unknown as typeof execFileSync);
    expect(result).toEqual([
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
    ]);
  });

  it("returns empty array when no open PRs", () => {
    const execGh = createGhOnlyMock("[]");

    const result = getOpenPRsForRepo("owner", "repo", execGh as unknown as typeof execFileSync);
    expect(result).toEqual([]);
  });
});
