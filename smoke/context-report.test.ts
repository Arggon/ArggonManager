import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { frontmatter, pad, stripJsonComments } from "./context-report.js";
import {
  METHODOLOGY_CORE_BUDGET_BYTES,
  METHODOLOGY_CORE_PATHS,
  METHODOLOGY_START_BUDGET_BYTES,
  measureMethodologyBudget,
} from "./methodology-budget.js";

// task-opencode2-context-polish (F5/F6, PR #329 review): unit tests for the
// report's pure helpers. Importing smoke/context-report.ts must NOT run the
// report (no CLI spawns, no git): the script body is behind an isDirectRun()
// guard, precisely so this test can live next to the source. vitest.config.ts
// includes `smoke/**/*.test.ts`; no model calls anywhere in this file.

// CI-enforced source budgets: these four carriers are the complete operational
// core. Moving depth to targeted references must not add it back into this sum.
describe("context-report: repository methodology budgets", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));

  it("keeps the four-file governing core at or below 122880 source bytes", () => {
    const measurement = measureMethodologyBudget(root);
    expect(measurement.files.map((file) => file.path)).toEqual([
      "ArggonManager/docs/agents.md",
      "ArggonManager/docs/convention.md",
      "ArggonManager/docs/engineering.md",
      "skills/arggon-cli/SKILL.md",
    ]);
    expect(measurement.core.budget).toBe(122_880);
    expect(measurement.core.bytes, JSON.stringify(measurement.files)).toBeLessThanOrEqual(122_880);
    expect(measurement.core.pass).toBe(true);
  });

  it("keeps the agents.md starting read at or below 20480 source bytes", () => {
    const measurement = measureMethodologyBudget(root);
    expect(measurement.start.path).toBe("ArggonManager/docs/agents.md");
    expect(measurement.start.budget).toBe(20_480);
    expect(measurement.start.bytes).toBeLessThanOrEqual(20_480);
    expect(measurement.start.pass).toBe(true);
  });
});

describe("context-report: methodology budget measurement", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "arggon-methodology-budget-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeSources(sizes: readonly number[] = [0, 0, 0, 0], omit?: string): void {
    METHODOLOGY_CORE_PATHS.forEach((path, index) => {
      if (path === omit) return;
      const absolute = join(root, path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, Buffer.alloc(sizes[index], "x"));
    });
  }

  it("accepts the exact aggregate and start boundaries", () => {
    writeSources([
      METHODOLOGY_START_BUDGET_BYTES,
      METHODOLOGY_CORE_BUDGET_BYTES - METHODOLOGY_START_BUDGET_BYTES,
      0,
      0,
    ]);
    const measurement = measureMethodologyBudget(root);
    expect(measurement.core).toEqual({ bytes: 122_880, budget: 122_880, pass: true });
    expect(measurement.start).toEqual({
      path: "ArggonManager/docs/agents.md",
      bytes: 20_480,
      budget: 20_480,
      pass: true,
    });
  });

  it("rejects aggregate bytes one over budget while start still passes", () => {
    writeSources([0, METHODOLOGY_CORE_BUDGET_BYTES + 1, 0, 0]);
    const measurement = measureMethodologyBudget(root);
    expect(measurement.core).toEqual({ bytes: 122_881, budget: 122_880, pass: false });
    expect(measurement.start.pass).toBe(true);
  });

  it("rejects start bytes one over budget while the aggregate still passes", () => {
    writeSources([METHODOLOGY_START_BUDGET_BYTES + 1, 0, 0, 0]);
    const measurement = measureMethodologyBudget(root);
    expect(measurement.start.bytes).toBe(20_481);
    expect(measurement.start.pass).toBe(false);
    expect(measurement.core.pass).toBe(true);
  });

  it("reports each source file's raw UTF-8 bytes and excludes targeted references", () => {
    writeSources([0, 2, 3, 4]);
    const unicode = "á🙂";
    writeFileSync(join(root, METHODOLOGY_CORE_PATHS[0]), unicode);
    for (const path of [
      "ArggonManager/docs/references/depth.md",
      "skills/arggon-cli/references/depth.md",
      "AGENTS.md",
    ]) {
      const absolute = join(root, path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, Buffer.alloc(METHODOLOGY_CORE_BUDGET_BYTES + 1, "x"));
    }
    const measurement = measureMethodologyBudget(root);
    expect(measurement.files).toEqual(
      METHODOLOGY_CORE_PATHS.map((path, index) => ({ path, bytes: [6, 2, 3, 4][index] })),
    );
    expect(measurement.start.bytes).toBe(Buffer.byteLength(unicode, "utf8"));
    expect(measurement.core.bytes).toBe(15);
    expect(measurement.core.pass).toBe(true);
  });

  it.each(METHODOLOGY_CORE_PATHS)("fails closed when required source %s is missing", (path) => {
    writeSources(undefined, path);
    expect(() => measureMethodologyBudget(root)).toThrow(
      `cannot measure required methodology source ${path}`,
    );
  });

  it("fails closed when a required source path is a directory", () => {
    const path = METHODOLOGY_CORE_PATHS[0];
    writeSources(undefined, path);
    mkdirSync(join(root, path));
    expect(() => measureMethodologyBudget(root)).toThrow(
      `cannot measure required methodology source ${path}`,
    );
  });
});

describe("context-report: frontmatter", () => {
  it("reads single-line name/description fields between the markers", () => {
    const raw = [
      "---",
      "name: arggon-cli",
      "description: Use when the task needs it",
      "---",
      "# body",
      "description: not this one",
    ].join("\n");
    expect(frontmatter(raw)).toEqual({
      name: "arggon-cli",
      description: "Use when the task needs it",
    });
  });

  it("returns {} when there is no frontmatter block", () => {
    expect(frontmatter("# title\ndescription: plain body line\n")).toEqual({});
  });

  it("stops at the first closing marker and trims the values", () => {
    const raw = "---\nname: a\ndescription:   spaced   \n---\ntail\n---\nname: ignored\n---";
    expect(frontmatter(raw)).toEqual({ name: "a", description: "spaced" });
  });

  it("ignores fields it does not read", () => {
    expect(frontmatter("---\nname: a\nallowed-tools: Bash\ndescription: d\n---")).toEqual({
      name: "a",
      description: "d",
    });
  });
});

describe("context-report: stripJsonComments", () => {
  it("strips // line comments and keeps the newline", () => {
    expect(stripJsonComments('{\n  "a": 1 // note\n}')).toBe('{\n  "a": 1 \n}');
  });

  it("strips /* */ block comments", () => {
    expect(stripJsonComments('{"a": 1 /* note */ }')).toBe('{"a": 1  }');
  });

  it("leaves // and /* sequences inside string values alone", () => {
    const raw = '{"url": "https://example.test/a//b", "glob": "src/*.ts"}';
    expect(stripJsonComments(raw)).toBe(raw);
  });

  it("handles escaped quotes inside strings", () => {
    const raw = '{"q": "say \\"//\\" now"}';
    expect(stripJsonComments(raw)).toBe(raw);
  });

  it("keeps a valid JSONC document parseable", () => {
    const raw = [
      "{",
      "  // retention",
      '  "compaction": /* V2 default */ { "keep": { "tokens": 15000 } }',
      "}",
    ].join("\n");
    expect(JSON.parse(stripJsonComments(raw))).toEqual({
      compaction: { keep: { tokens: 15000 } },
    });
  });

  it("drops an unterminated block comment to the end of input", () => {
    expect(stripJsonComments('{"a": 1} /* trailing')).toBe('{"a": 1} ');
  });
});

describe("context-report: pad", () => {
  it("pads short cells to the column width", () => {
    expect(pad("abc", 5)).toBe("abc  ");
  });

  it("returns cells that exactly fill the column unchanged", () => {
    expect(pad("abcde", 5)).toBe("abcde");
  });

  it("truncates over-width cells with an ellipsis (F5: no column collision)", () => {
    const label = "skill entry arggon-upgrade (description)";
    const cell = pad(label, 38);
    expect(label.length).toBeGreaterThan(38);
    expect(cell.length).toBe(38);
    expect(cell.endsWith("…")).toBe(true);
    // The next column starts exactly at the declared width, never mid-label.
    expect(`${cell}${pad("324", 11)}`.indexOf("324")).toBe(38);
  });
});
