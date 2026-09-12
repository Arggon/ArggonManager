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

describe("x-playbooks (playbook staleness)", () => {
  it("defaults to maxAgeDays null when the file or the key is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-xpb-missing-"));
    expect(readConventionConfig(dir).playbooks).toEqual({ maxAgeDays: null });
    expect(parseConventionConfig("version: 3\n").playbooks).toEqual({ maxAgeDays: null });
  });

  it("parses max-age-days in a v3 tree (unknown nested keys ignored)", () => {
    const config = parseConventionConfig(
      ["version: 3", "x-playbooks:", "  max-age-days: 30", "  future-option: 7", ""].join("\n"),
    );
    expect(config.playbooks).toEqual({ maxAgeDays: 30 });
    expect(config.version).toBe(3);
  });

  it("parses x-playbooks regardless of the declared tree version (v0 too)", () => {
    const config = parseConventionConfig("version: 0\nx-playbooks:\n  max-age-days: 14\n");
    expect(config.playbooks).toEqual({ maxAgeDays: 14 });
  });

  it("rejects scalar x-playbooks and non-positive / non-numeric max-age-days", () => {
    expect(() => parseConventionConfig("x-playbooks: 30\n")).toThrow(/must be a mapping/);
    expect(() => parseConventionConfig("x-playbooks:\n  max-age-days: soon\n")).toThrow(
      /'max-age-days' must be a positive integer/,
    );
    expect(() => parseConventionConfig("x-playbooks:\n  max-age-days: 0\n")).toThrow(
      /must be a positive integer/,
    );
    expect(() => parseConventionConfig("x-playbooks:\n  max-age-days: -5\n")).toThrow(
      /must be a positive integer/,
    );
  });
});

describe("x-views (saved views)", () => {
  it("defaults to no views when the file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-xviews-missing-"));
    expect(readConventionConfig(dir).views).toEqual({});
  });

  it("parses quoted and unquoted view expressions", () => {
    const config = parseConventionConfig(
      [
        "version: 0",
        "x-views:",
        '  my-open: "status:todo !status:done"',
        "  bugs: type:bug",
        "",
      ].join("\n"),
    );
    expect(config.views).toEqual({
      "my-open": "status:todo !status:done",
      bugs: "type:bug",
    });
  });

  it("still ignores unknown x-* keys (only x-views is official)", () => {
    const config = parseConventionConfig("version: 0\nx-widgets: yes\nx-views:\n  open: status:todo\n");
    expect(config.views).toEqual({ open: "status:todo" });
  });

  it("rejects scalar x-views, empty expressions, and duplicate names", () => {
    expect(() => parseConventionConfig("x-views: open\n")).toThrow(/must be a mapping/);
    expect(() => parseConventionConfig("x-views:\n  open: ''\n")).toThrow(
      /empty expression for view 'open'/,
    );
    expect(() =>
      parseConventionConfig("x-views:\n  open: status:todo\n  open: type:bug\n"),
    ).toThrow(/duplicate view 'open'/);
  });
});
