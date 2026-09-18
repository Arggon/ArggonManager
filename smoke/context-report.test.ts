import { describe, expect, it } from "vitest";
import { frontmatter, pad, stripJsonComments } from "./context-report.js";

// task-opencode2-context-polish (F5/F6, PR #329 review): unit tests for the
// report's pure helpers. Importing smoke/context-report.ts must NOT run the
// report (no CLI spawns, no git): the script body is behind an isDirectRun()
// guard, precisely so this test can live next to the source. vitest.config.ts
// includes `smoke/**/*.test.ts`; no model calls anywhere in this file.

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
