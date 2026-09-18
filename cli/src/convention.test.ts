import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONVENTION_VERSION,
  CONVENTION_VERSION_DEFAULT,
  parseConventionConfig,
  readConventionConfig,
  readConventionVersion,
  readGeneratedState,
  resolveBranchName,
  updateGeneratedSection,
} from "./convention.js";
import { runInit } from "./init.js";

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
    const config = parseConventionConfig(
      "version: 0\nx-widgets: yes\nx-views:\n  open: status:todo\n",
    );
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

describe("x-import (issue-import options, task-import-type-mapping)", () => {
  it("defaults to labelTypes null when the file or the key is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-ximport-missing-"));
    expect(readConventionConfig(dir).import).toEqual({ labelTypes: null });
    expect(parseConventionConfig("version: 3\n").import).toEqual({ labelTypes: null });
  });

  it("parses quoted and unquoted label-types (unknown option keys ignored)", () => {
    const config = parseConventionConfig(
      [
        "version: 0",
        "x-import:",
        "  label-types:",
        "    bug: bug",
        '    "help wanted": task',
        "  future-option: 7",
        "",
      ].join("\n"),
    );
    expect(config.import).toEqual({ labelTypes: { bug: "bug", "help wanted": "task" } });
  });

  it("parses any valid work-item type as a value (the import narrows to leaves)", () => {
    const config = parseConventionConfig("x-import:\n  label-types:\n    feature: story\n");
    expect(config.import.labelTypes).toEqual({ feature: "story" });
  });

  it("treats an explicit empty label-types mapping as set (not the built-in default)", () => {
    const config = parseConventionConfig("x-import:\n  label-types:\n");
    expect(config.import).toEqual({ labelTypes: {} });
  });

  it("rejects scalar sections, invalid values, and duplicate labels", () => {
    expect(() => parseConventionConfig("x-import: true\n")).toThrow(/'x-import' must be a mapping/);
    expect(() => parseConventionConfig("x-import:\n  label-types: bug\n")).toThrow(
      /'label-types' must be a mapping/,
    );
    expect(() => parseConventionConfig("x-import:\n  label-types:\n    bug: canoe\n")).toThrow(
      /'label-types' values must be work-item types/,
    );
    expect(() => parseConventionConfig("x-import:\n  label-types:\n    bug: ''\n")).toThrow(
      /'label-types' values must be work-item types/,
    );
    expect(() =>
      parseConventionConfig("x-import:\n  label-types:\n    bug: bug\n    bug: task\n"),
    ).toThrow(/duplicate label 'bug' in x-import\.label-types/);
  });
});

describe("x-worktree (worktree bootstrap, task-start-post-hook)", () => {
  it("defaults to postStart null when the file or the key is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-xwt-missing-"));
    expect(readConventionConfig(dir).worktree).toEqual({ postStart: null, postStartShell: null });
    expect(parseConventionConfig("version: 3\n").worktree).toEqual({
      postStart: null,
      postStartShell: null,
    });
  });

  it("parses quoted and unquoted post-start commands (unknown nested keys ignored)", () => {
    const config = parseConventionConfig(
      ["version: 3", "x-worktree:", '  post-start: "npm ci"', "  future-option: 7", ""].join("\n"),
    );
    expect(config.worktree).toEqual({ postStart: "npm ci", postStartShell: null });
    expect(parseConventionConfig("x-worktree:\n  post-start: npm ci\n").worktree).toEqual({
      postStart: "npm ci",
      postStartShell: null,
    });
  });

  it("parses x-worktree regardless of the declared tree version (v0 too)", () => {
    const config = parseConventionConfig('version: 0\nx-worktree:\n  post-start: "make setup"\n');
    expect(config.worktree).toEqual({ postStart: "make setup", postStartShell: null });
  });

  it("rejects scalar x-worktree and empty / mapping post-start values", () => {
    expect(() => parseConventionConfig("x-worktree: npm ci\n")).toThrow(/must be a mapping/);
    expect(() => parseConventionConfig("x-worktree:\n  post-start: ''\n")).toThrow(
      /'post-start' must be a non-empty string/,
    );
    // A nested mapping under post-start surfaces as an empty scalar value.
    expect(() => parseConventionConfig("x-worktree:\n  post-start:\n    npm: ci\n")).toThrow(
      /'post-start' must be a non-empty string/,
    );
  });

  it("parses post-start-shell inherit/login and rejects anything else (task-post-start-env)", () => {
    expect(
      parseConventionConfig('x-worktree:\n  post-start-shell: "login"\n').worktree.postStartShell,
    ).toBe("login");
    expect(
      parseConventionConfig("x-worktree:\n  post-start-shell: inherit\n").worktree.postStartShell,
    ).toBe("inherit");
    expect(() => parseConventionConfig("x-worktree:\n  post-start-shell: bash\n")).toThrow(
      /'post-start-shell' must be "inherit" or "login"/,
    );
    expect(() => parseConventionConfig("x-worktree:\n  post-start-shell: ''\n")).toThrow(
      /'post-start-shell' must be "inherit" or "login"/,
    );
  });
});

describe("x-generated (generated-doc provenance, story-adoption-state)", () => {
  const SECTION = [
    "version: 3",
    "branch_patterns:",
    '  bug: "fix/{id}"',
    "# a comment arggon wrote",
    "x-generated:",
    "  AGENTS.md:",
    '    template: "docs/AGENTS.md"',
    '    checksum: "sha256:abc123"',
    '    arggonVersion: "0.0.0"',
    '    generatedAt: "2026-09-12T10:00:00.000Z"',
    "  .agents/skills/arggon-cli/SKILL.md:",
    '    template: "skills/arggon-cli/SKILL.md"',
    '    checksum: "sha256:def456"',
    '    arggonVersion: "0.0.0"',
    '    generatedAt: "2026-09-12T10:00:00.000Z"',
    "",
  ].join("\n");

  it("parses destination entries with their fields (tolerant of unknown fields)", () => {
    const config = parseConventionConfig(`${SECTION}    futureField: whatever\n`);
    expect(Object.keys(config.generated).sort()).toEqual([
      ".agents/skills/arggon-cli/SKILL.md",
      "AGENTS.md",
    ]);
    expect(config.generated["AGENTS.md"]).toEqual({
      template: "docs/AGENTS.md",
      checksum: "sha256:abc123",
      arggonVersion: "0.0.0",
      generatedAt: "2026-09-12T10:00:00.000Z",
    });
    expect(config.generated[".agents/skills/arggon-cli/SKILL.md"]!.template).toBe(
      "skills/arggon-cli/SKILL.md",
    );
  });

  it("keeps incomplete entries instead of throwing (machine-written state)", () => {
    const config = parseConventionConfig("x-generated:\n  AGENTS.md:\n    checksum: sha256:x\n");
    expect(config.generated["AGENTS.md"]).toEqual({
      template: "",
      checksum: "sha256:x",
      arggonVersion: "",
      generatedAt: "",
    });
  });

  it("rejects a scalar x-generated section (mapping required)", () => {
    expect(() => parseConventionConfig("x-generated: AGENTS.md\n")).toThrow(/must be a mapping/);
  });

  it("readGeneratedState never throws (missing or malformed file -> empty state)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-conv-gen-"));
    expect(readGeneratedState(dir)).toEqual({});
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), "branch_patterns:\n  oops\n", "utf8");
    expect(readGeneratedState(dir)).toEqual({});
  });

  it("updateGeneratedSection preserves surrounding content and replaces the section", () => {
    const updated = updateGeneratedSection(SECTION, {
      "AGENTS.md": {
        template: "docs/AGENTS.md",
        checksum: "sha256:new",
        arggonVersion: "0.0.0",
        generatedAt: "2026-09-13T00:00:00.000Z",
      },
    });
    expect(updated).toContain("version: 3");
    expect(updated).toContain('bug: "fix/{id}"');
    expect(updated).toContain("# a comment arggon wrote");
    expect(updated).toContain('checksum: "sha256:new"');
    expect(updated).not.toContain("def456");
    expect(updated).not.toContain("SKILL.md");
    expect(parseConventionConfig(updated).generated["AGENTS.md"]!.checksum).toBe("sha256:new");
  });

  it("updateGeneratedSection appends the section when missing and removes it when empty", () => {
    const appended = updateGeneratedSection(
      'version: 3\nbranch_patterns:\n  bug: "fix/{id}"\n',
      {},
    );
    expect(appended).toBe('version: 3\nbranch_patterns:\n  bug: "fix/{id}"\n');
    const withEntry = updateGeneratedSection("version: 3\n# keep me\n", {
      "AGENTS.md": {
        template: "docs/AGENTS.md",
        checksum: "sha256:x",
        arggonVersion: "0.0.0",
        generatedAt: "2026-09-12T00:00:00.000Z",
      },
    });
    expect(withEntry).toBe(
      [
        "version: 3",
        "# keep me",
        "",
        "x-generated:",
        "  AGENTS.md:",
        '    template: "docs/AGENTS.md"',
        '    checksum: "sha256:x"',
        '    arggonVersion: "0.0.0"',
        '    generatedAt: "2026-09-12T00:00:00.000Z"',
        "",
      ].join("\n"),
    );
    // Round-trip: parsing the serialized section yields the same entry.
    expect(parseConventionConfig(withEntry).generated["AGENTS.md"]!.checksum).toBe("sha256:x");
  });
});

/** Raw (file-level) backslashes in one line. */
function rawBackslashes(line: string): number {
  return (line.match(/\\/g) ?? []).length;
}

/** The exact `projectName:` line of a `.convention.yml` (raw bytes, escapes intact). */
function rawProjectNameLine(raw: string): string {
  const line = raw.match(/^ {2}projectName:.*$/m)?.[0];
  if (!line) throw new Error("no x-generated.projectName line in convention file");
  return line;
}

/**
 * bug-convention-config-scalar-unescape: follow-up from the tracker-title fix
 * (bug-tracker-title-rescape); `stripQuotes` returned the inner text of a
 * quoted `.convention.yml` scalar verbatim while `yamlQuote` re-escaped it, so
 * every init/upgrade rewrite doubled literal backslashes. Latent today — the
 * 2026-09-18 audit found no live scalar with backslashes (this repo's own
 * state records `projectName: "ArggonManager"`) — but any quoted value with a
 * backslash, quote or control character would compound silently.
 */
describe("convention quoted-scalar round-trip (bug-convention-config-scalar-unescape)", () => {
  it("decodes a YAML double-quoted scalar instead of returning raw bytes", () => {
    // Raw file text has TWO backslashes (YAML escape for one literal `\`).
    const config = parseConventionConfig(
      String.raw`x-generated:
  projectName: "nits: \\( here"
`,
    );
    expect(config.generatedProjectName).toBe("nits: \\( here"); // one literal backslash
  });

  it("decodes the full YAML double-quoted escape set (unknown escapes preserved)", () => {
    const config = parseConventionConfig(
      String.raw`x-generated:
  projectName: "a\tb \u0041 \x42 \\ \"q\" \q \ "
`,
    );
    expect(config.generatedProjectName).toBe('a\tb A B \\ "q" \\q  ');
    // A trailing lone backslash is preserved verbatim, never thrown on.
    expect(
      parseConventionConfig(String.raw`x-generated:
  projectName: "a\"
`).generatedProjectName,
    ).toBe("a\\");
  });

  it("decodes doubled single quotes in a single-quoted scalar", () => {
    expect(
      parseConventionConfig("x-generated:\n  projectName: 'it''s fine'\n").generatedProjectName,
    ).toBe("it's fine");
  });

  it("decodes quoted escapes for every config scalar, not just projectName", () => {
    const config = parseConventionConfig(
      [
        "version: 4",
        "branch_patterns:",
        String.raw`  task: "feat/{id}\t(v2)"`,
        "x-views:",
        String.raw`  open: "status:todo \"hot\""`,
        "x-worktree:",
        String.raw`  post-start: "echo \"a\\b\""`,
        "x-import:",
        "  label-types:",
        String.raw`    "help \"x\"": task`,
        "",
      ].join("\n"),
    );
    expect(config.branchPatterns.task).toBe("feat/{id}\t(v2)");
    expect(config.views.open).toBe('status:todo "hot"');
    expect(config.worktree.postStart).toBe('echo "a\\b"');
    expect(config.import.labelTypes).toEqual({ 'help "x"': "task" });
  });

  it("writes backslash-bearing values quoted and keeps the rewrite byte-stable", () => {
    const projectName = 'nits: escaped \\\\( in "cmd"'; // two literal backslashes
    const once = updateGeneratedSection("version: 4\n", {}, projectName);
    // JSON-escaped: two backslashes -> four raw, plus one per escaped quote.
    expect(rawBackslashes(rawProjectNameLine(once))).toBe(6);
    expect(parseConventionConfig(once).generatedProjectName).toBe(projectName);
    const cfg = parseConventionConfig(once);
    expect(updateGeneratedSection(once, cfg.generated, cfg.generatedProjectName)).toBe(once);
  });

  it("escapes control characters so a hand-written \\n escape cannot corrupt the file", () => {
    for (const value of [
      "a\nb",
      "\x00nul",
      "\x07bell",
      "\x1besc",
      "\u007fdel",
      "\u2028sep",
      "\u2029par",
    ]) {
      const once = updateGeneratedSection("version: 4\n", {}, value);
      expect(/[\u0000-\u001f\u007f\u2028\u2029]/.test(rawProjectNameLine(once))).toBe(false);
      expect(parseConventionConfig(once).generatedProjectName).toBe(value);
      const cfg = parseConventionConfig(once);
      expect(updateGeneratedSection(once, cfg.generated, cfg.generatedProjectName)).toBe(once);
    }
  });

  it("does not grow an ALREADY-corrupted value on repeated rewrites", () => {
    // Eight raw backslashes decode to four; the rewrite must stay at eight.
    const corrupt = String.raw`version: 4
x-generated:
  projectName: "nits: \\\\\\\\( here"
`;
    let out = corrupt;
    for (let i = 0; i < 3; i++) {
      const cfg = parseConventionConfig(out);
      out = updateGeneratedSection(out, cfg.generated, cfg.generatedProjectName);
      expect(rawBackslashes(rawProjectNameLine(out))).toBe(8);
    }
    expect(parseConventionConfig(out).generatedProjectName).toBe(String.raw`nits: \\\\( here`);
  });

  it("init rewrite cycles keep a backslash-bearing projectName byte-stable (raw-file)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-conv-escape-"));
    // Fixed timestamp: init rewrites `generatedAt` on every run, so the whole
    // file stays byte-identical only when the clock stands still.
    const now = new Date("2026-09-18T12:00:00Z");
    runInit({ dir, force: false, commit: false, now });
    const path = join(dir, "tasks/.convention.yml");
    // Hand-write the escaped form of two literal backslashes (four raw bytes).
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(
        /^ {2}projectName:.*$/m,
        String.raw`  projectName: "acme\\\\tools"`,
      ),
      "utf8",
    );
    const expectStable = (step: string) => {
      const raw = readFileSync(path, "utf8");
      expect(rawBackslashes(rawProjectNameLine(raw)), `after ${step}`).toBe(4);
      expect(parseConventionConfig(raw).generatedProjectName, `after ${step}`).toBe(
        String.raw`acme\\tools`,
      );
    };
    expectStable("hand-edit");
    runInit({ dir, force: false, commit: false, now });
    expectStable("init 1");
    const afterFirst = readFileSync(path, "utf8");
    runInit({ dir, force: false, commit: false, now });
    expectStable("init 2");
    expect(readFileSync(path, "utf8")).toBe(afterFirst);
  });
});
