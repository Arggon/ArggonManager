import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONVENTION_VERSION,
  CONVENTION_VERSION_DEFAULT,
  parseConventionConfig,
  readConventionConfig,
  readConventionVersion,
  resolveBranchName,
} from "./convention.js";

describe("readConventionVersion", () => {
  it("returns the default (0) when tasks/.convention.yml is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-conv-missing-"));
    expect(readConventionVersion(dir)).toBe(0);
    expect(readConventionVersion(dir)).toBe(CONVENTION_VERSION_DEFAULT);
  });

  it("reads version from tasks/.convention.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-conv-present-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), `version: ${CONVENTION_VERSION}\n`, "utf8");
    expect(readConventionVersion(dir)).toBe(CONVENTION_VERSION);
  });

  it("still reads legacy v0 trees", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-conv-legacy-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 0\n", "utf8");
    expect(readConventionVersion(dir)).toBe(0);
  });

  it("falls back to the default on unparseable content", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-conv-bad-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), "not-a-version\n", "utf8");
    expect(readConventionVersion(dir)).toBe(CONVENTION_VERSION_DEFAULT);
  });
});

describe("convention config", () => {
  it("returns version 0 + defaults when the file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-convcfg-missing-"));
    const config = readConventionConfig(dir);
    expect(config.version).toBe(0);
    expect(config.branchPatterns).toEqual({
      initiative: "feat/{id}",
      epic: "feat/{id}",
      story: "feat/{id}",
      task: "feat/{id}",
      bug: "fix/{id}",
    });
  });

  it("parses version + custom patterns (unknown keys ignored)", () => {
    const config = parseConventionConfig(
      'version: 2\ncustom_future: true\nbranch_patterns:\n  bug: "fix/{id}"\n  task: chore/{id}-{type}\n',
    );
    expect(config.version).toBe(2);
    expect(config.branchPatterns.bug).toBe("fix/{id}");
    expect(config.branchPatterns.task).toBe("chore/{id}-{type}");
    expect(config.branchPatterns.story).toBe("feat/{id}");
  });

  it("rejects patterns without {id}, unknown types, and scalar sections", () => {
    expect(() => parseConventionConfig("branch_patterns:\n  task: static\n")).toThrow(
      /must contain an \{id\} placeholder/,
    );
    expect(() => parseConventionConfig("branch_patterns:\n  doc: feat\/{id}\n")).toThrow(
      /unknown type 'doc'/,
    );
    expect(() => parseConventionConfig("branch_patterns: feat/{id}\n")).toThrow(
      /must be a mapping/,
    );
    expect(() => parseConventionConfig("branch_patterns:\n  task: ''\n")).toThrow(/empty pattern/);
  });

  it("resolves {id} and {type} placeholders", () => {
    expect(resolveBranchName("feat/{id}", { id: "task-x", type: "task" })).toBe("feat/task-x");
    expect(resolveBranchName("fix/{type}-{id}", { id: "b", type: "bug" })).toBe("fix/bug-b");
  });
});
