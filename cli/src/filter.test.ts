import { describe, expect, it } from "vitest";
import { buildBlockedByIndex, matchesPredicate, parseFilter, type FilterableItem } from "./filter.js";

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

describe("dependency predicates (spec-deps-001)", () => {
  it("parses depends-on: and blocked-by: like the other fields", () => {
    expect(parseFilter("depends-on:task-x blocked-by:story-y")).toEqual([
      { field: "depends-on", value: "task-x", negated: false },
      { field: "blocked-by", value: "story-y", negated: false },
    ]);
    expect(parseFilter("!depends-on:task-x")).toEqual([
      { field: "depends-on", value: "task-x", negated: true },
    ]);
  });

  it("matches depends-on against the item's own depends_on list", () => {
    const dep = item({ id: "task-a", dependsOn: ["task-x", "story-y"] });
    expect(matchesPredicate(dep, { field: "depends-on", value: "task-x", negated: false })).toBe(
      true,
    );
    expect(matchesPredicate(dep, { field: "depends-on", value: "task-z", negated: false })).toBe(
      false,
    );
    expect(matchesPredicate(dep, { field: "depends-on", value: "task-x", negated: true })).toBe(
      false,
    );
    expect(matchesPredicate(item(), { field: "depends-on", value: "task-x", negated: false })).toBe(
      false,
    );
  });

  it("matches blocked-by through the computed inverse index", () => {
    const index = buildBlockedByIndex([
      { id: "task-a", dependsOn: ["task-x"] },
      { id: "bug-b", dependsOn: ["task-x", "story-y"] },
      { id: "task-c", dependsOn: [] },
    ]);
    expect(index.get("task-x")).toEqual(["task-a", "bug-b"]);
    expect(matchesPredicate(item({ id: "task-a" }), { field: "blocked-by", value: "task-x", negated: false }, index)).toBe(true);
    expect(matchesPredicate(item({ id: "bug-b" }), { field: "blocked-by", value: "task-x", negated: false }, index)).toBe(true);
    expect(matchesPredicate(item({ id: "task-c" }), { field: "blocked-by", value: "task-x", negated: false }, index)).toBe(false);
    expect(matchesPredicate(item({ id: "task-c" }), { field: "blocked-by", value: "task-x", negated: true }, index)).toBe(true);
    // Unknown blocker id: nothing is blocked by it.
    expect(matchesPredicate(item({ id: "task-a" }), { field: "blocked-by", value: "nope", negated: false }, index)).toBe(false);
  });

  it("composes with AND and ! like the existing predicates", () => {
    const index = buildBlockedByIndex([{ id: "task-a", dependsOn: ["task-x"] }]);
    const preds = parseFilter("status:todo !type:bug blocked-by:task-x");
    const subject = item({ id: "task-a", status: "todo", type: "task" });
    expect(preds.every((pred) => matchesPredicate(subject, pred, index))).toBe(true);
    const bug = item({ id: "bug-b", status: "todo", type: "bug" });
    expect(preds.every((pred) => matchesPredicate(bug, pred, index))).toBe(false);
  });
});
