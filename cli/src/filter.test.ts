import { describe, expect, it } from "vitest";
import { matchesPredicate, parseFilter, type FilterableItem } from "./filter.js";

function item(overrides: Partial<FilterableItem> = {}): FilterableItem {
  return { status: "todo", type: "task", assignee: null, labels: [], parent: null, ...overrides };
}

describe("parseFilter", () => {
  it("parses single and combined expressions", () => {
    expect(parseFilter("status:todo")).toEqual([
      { field: "status", value: "todo", negated: false },
    ]);
    expect(parseFilter("status:todo assignee:@me label:security")).toEqual([
      { field: "status", value: "todo", negated: false },
      { field: "assignee", value: "@me", negated: false },
      { field: "label", value: "security", negated: false },
    ]);
  });

  it("supports all five tokens", () => {
    const preds = parseFilter("status:todo type:bug assignee:lug parent:story-x label:cli");
    expect(preds.map((p) => p.field)).toEqual(["status", "type", "assignee", "parent", "label"]);
    expect(parseFilter("assignee:lug")).toEqual([
      { field: "assignee", value: "lug", negated: false },
    ]);
  });

  it("supports negation with !", () => {
    expect(parseFilter("!status:done")).toEqual([
      { field: "status", value: "done", negated: true },
    ]);
    expect(parseFilter("!label:wip !type:epic")).toHaveLength(2);
  });

  it("allows quoted values with spaces", () => {
    expect(parseFilter('assignee:"Jane Doe"')).toEqual([
      { field: "assignee", value: "Jane Doe", negated: false },
    ]);
    expect(parseFilter("parent:'story one' status:todo")).toEqual([
      { field: "parent", value: "story one", negated: false },
      { field: "status", value: "todo", negated: false },
    ]);
  });

  it("splits values on the first colon only", () => {
    expect(parseFilter("parent:a:b")).toEqual([{ field: "parent", value: "a:b", negated: false }]);
  });

  it("rejects unknown fields instead of ignoring them", () => {
    expect(() => parseFilter("title:foo")).toThrow(/unknown filter field "title"/);
    expect(() => parseFilter("status:todo title:foo")).toThrow(/unknown filter field "title"/);
  });

  it("rejects malformed tokens", () => {
    expect(() => parseFilter("status")).toThrow(/bad filter token/);
    expect(() => parseFilter("status:")).toThrow(/empty value/);
    expect(() => parseFilter(":todo")).toThrow(/bad filter token/);
    expect(() => parseFilter('assignee:"jane')).toThrow(/unterminated quote/);
  });
});

describe("matchesPredicate", () => {
  it("matches every field and negates", () => {
    const it1 = item({
      status: "todo",
      type: "bug",
      assignee: "lug",
      labels: ["security"],
      parent: "s",
    });
    expect(matchesPredicate(it1, { field: "status", value: "todo", negated: false })).toBe(true);
    expect(matchesPredicate(it1, { field: "status", value: "done", negated: false })).toBe(false);
    expect(matchesPredicate(it1, { field: "status", value: "done", negated: true })).toBe(true);
    expect(matchesPredicate(it1, { field: "type", value: "bug", negated: false })).toBe(true);
    expect(matchesPredicate(it1, { field: "assignee", value: "lug", negated: false })).toBe(true);
    expect(matchesPredicate(it1, { field: "label", value: "security", negated: false })).toBe(true);
    expect(matchesPredicate(it1, { field: "label", value: "other", negated: false })).toBe(false);
    expect(matchesPredicate(it1, { field: "label", value: "other", negated: true })).toBe(true);
    expect(matchesPredicate(it1, { field: "parent", value: "s", negated: false })).toBe(true);
    expect(matchesPredicate(item(), { field: "assignee", value: "lug", negated: true })).toBe(true);
    expect(matchesPredicate(item(), { field: "parent", value: "s", negated: true })).toBe(true);
  });
});
