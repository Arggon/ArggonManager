import { describe, expect, it, vi } from "vitest";
import { detectRepo, type GitExecutor } from "./detect-repo.js";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
