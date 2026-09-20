import { afterEach, describe, expect, it, vi } from "vitest";
import { detectRepo, type GitExecutor } from "./detect-repo.js";
import { mkdirSync, mkdtempSync as _mkdtempSync, rmSync } from "node:fs";
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

describe("detectRepo", () => {
  it("returns null when not inside a git repository", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-detect-"));
    expect(detectRepo(dir)).toBeNull();
  });

  function withGitRepo(testDir: string): void {
    mkdirSync(join(testDir, ".git"), { recursive: true });
  }

  it("detects owner/repo from GitHub https remote", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-detect-"));
    withGitRepo(dir);

    const execGit = vi.fn((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "https://github.com/arggon/arggon-manager.git";
      }
      throw new Error(`Unexpected command: ${cmd} ${args.join(" ")}`);
    });

    const result = detectRepo(dir, execGit as unknown as GitExecutor);
    expect(result).toEqual({ owner: "arggon", repo: "arggon-manager" });
    expect(execGit).toHaveBeenCalledWith(
      "git",
      ["remote", "get-url", "origin"],
      expect.objectContaining({ cwd: dir })
    );
  });

  it("detects owner/repo from GitHub ssh remote", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-detect-"));
    withGitRepo(dir);

    const execGit = vi.fn((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "git@github.com:arggon/arggon-manager.git";
      }
      throw new Error(`Unexpected command: ${cmd} ${args.join(" ")}`);
    });

    const result = detectRepo(dir, execGit as unknown as GitExecutor);
    expect(result).toEqual({ owner: "arggon", repo: "arggon-manager" });
  });

  it("detects owner/repo from GitHub ssh remote with alternate port", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-detect-"));
    withGitRepo(dir);

    const execGit = vi.fn((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "ssh://git@github.com/arggon/arggon-manager.git";
      }
      throw new Error(`Unexpected command: ${cmd} ${args.join(" ")}`);
    });

    const result = detectRepo(dir, execGit as unknown as GitExecutor);
    expect(result).toEqual({ owner: "arggon", repo: "arggon-manager" });
  });

  it("returns null when origin is not a GitHub remote", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-detect-"));
    withGitRepo(dir);

    const execGit = vi.fn((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "https://gitlab.com/arggon/arggon-manager.git";
      }
      throw new Error(`Unexpected command: ${cmd} ${args.join(" ")}`);
    });

    const result = detectRepo(dir, execGit as unknown as GitExecutor);
    expect(result).toBeNull();
  });

  it("returns null when origin remote is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-detect-"));
    withGitRepo(dir);

    const execGit = vi.fn(() => {
      throw new Error("no such remote");
    });

    const result = detectRepo(dir, execGit as unknown as GitExecutor);
    expect(result).toBeNull();
  });

  it("handles .git suffix in repo name", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-detect-"));
    withGitRepo(dir);

    const execGit = vi.fn((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "https://github.com/owner/repo-name.git";
      }
      throw new Error(`Unexpected command: ${cmd} ${args.join(" ")}`);
    });

    const result = detectRepo(dir, execGit as unknown as GitExecutor);
    expect(result).toEqual({ owner: "owner", repo: "repo-name" });
  });

  it("handles shallow clone URL without .git suffix", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-detect-"));
    withGitRepo(dir);

    const execGit = vi.fn((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "https://github.com/owner/repo-name";
      }
      throw new Error(`Unexpected command: ${cmd} ${args.join(" ")}`);
    });

    const result = detectRepo(dir, execGit as unknown as GitExecutor);
    expect(result).toEqual({ owner: "owner", repo: "repo-name" });
  });
});
