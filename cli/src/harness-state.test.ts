/**
 * bug-harness-config-churn: `.zcode/` is per-machine ZCode harness state — the
 * harness rewrites `.zcode/config.json` during sessions, and while a copy was
 * TRACKED, `start`'s clean-tree precondition refused every claim until an
 * agent stashed the file by hand (three sessions hit it in one day). The only
 * shared content that tracked copy carried — the `arggon mcp` stdio
 * registration — lives verbatim in the tracked `.mcp.json`, so untracking
 * loses nothing shared. These repo invariants pin the untracking: nothing
 * under `.zcode/` may come back tracked, the harness state dir plus its
 * transient root-level `.zcodeignore` artifact stay ignored, and the shared
 * registration stays put in `.mcp.json` — so harness churn can never block
 * the clean-tree precondition again.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

describe("harness state is ignored, not tracked (bug-harness-config-churn)", () => {
  it("tracks nothing under .zcode/ (per-machine harness state, not repo config)", () => {
    const tracked = git(["ls-files", ".zcode/"]).trim();
    expect(
      tracked,
      "tracked files under .zcode/ churn during harness sessions and block start's clean-tree precondition — keep them ignored",
    ).toBe("");
  });

  it("keeps .zcode/ and the transient root-level .zcodeignore ignored", () => {
    // `check-ignore` prints exactly the named paths that are ignored and exits
    // non-zero only when NONE are — asserting the full list catches a partial
    // .gitignore regression too.
    const ignored = git(["check-ignore", ".zcode/", ".zcodeignore"]).trim().split("\n");
    expect(ignored).toEqual([".zcode/", ".zcodeignore"]);
  });

  it("keeps the arggon mcp registration tracked in .mcp.json (the shared content the untracked copy duplicated)", () => {
    const mcp = JSON.parse(readFileSync(join(repoRoot, ".mcp.json"), "utf8")) as {
      mcpServers?: Record<string, unknown>;
    };
    expect(mcp.mcpServers?.arggon).toBeDefined();
  });
});
