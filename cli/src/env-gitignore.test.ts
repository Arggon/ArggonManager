import { mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ARGON_ENV_IGNORE_LINE, readEnvGitignore } from "./env-gitignore.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

/** Tree with the given `.gitignore` bytes, or none at all (`null`). */
function fixture(gitignore: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-env-gitignore-"));
  if (gitignore !== null) writeFileSync(join(dir, ".gitignore"), gitignore, "utf8");
  return dir;
}

describe("readEnvGitignore (spec worktree-env-contract-016)", () => {
  it("reports no hint when the entry is present, in any anchored form", () => {
    for (const line of [".arggon.env", "/.arggon.env", "**/.arggon.env"]) {
      expect(readEnvGitignore(fixture(`node_modules/\n${line}\n`))).toEqual({
        path: ".gitignore",
        present: true,
        ignores: true,
        hint: null,
      });
    }
  });

  it("reports the missing entry with the exact line and the spec id", () => {
    const report = readEnvGitignore(fixture("node_modules/\n*.log\n"));
    expect(report.present).toBe(true);
    expect(report.ignores).toBe(false);
    expect(report.hint).toContain(ARGON_ENV_IGNORE_LINE);
    expect(report.hint).toContain("worktree-env-contract-016");
  });

  it("does not count comments, and lets a later negation un-ignore the entry", () => {
    expect(readEnvGitignore(fixture("# .arggon.env\n")).ignores).toBe(false);
    expect(readEnvGitignore(fixture("!.arggon.env\n")).ignores).toBe(false);
    // File order is git's own evaluation order: the negation wins when it
    // comes last, and the entry wins again when re-added after it.
    expect(readEnvGitignore(fixture(".arggon.env\n!.arggon.env\n")).ignores).toBe(false);
    expect(readEnvGitignore(fixture("!.arggon.env\n.arggon.env\n")).ignores).toBe(true);
  });

  it("reports absent without a hint (a fresh init generates the entry itself)", () => {
    expect(readEnvGitignore(fixture(null))).toEqual({
      path: ".gitignore",
      present: false,
      ignores: false,
      hint: null,
    });
  });

  it("tolerates CRLF and surrounding whitespace", () => {
    expect(readEnvGitignore(fixture("node_modules/\r\n  .arggon.env  \r\n")).ignores).toBe(true);
  });

  it("is a pure read: the file's bytes are untouched", () => {
    const dir = fixture("node_modules/\n");
    const before = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(readEnvGitignore(dir).hint).not.toBeNull();
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe(before);
  });
});
