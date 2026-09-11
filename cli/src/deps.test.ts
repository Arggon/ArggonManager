/**
 * Dependency graph schema tests (story-deps-schema, ADR 0004).
 *
 * `depends_on` is an official v3 field parsed unconditionally (additive, like
 * milestone/branch): it round-trips through extras, raises no UNKNOWN_KEY
 * warning, and v0-v2 trees stay valid. `validate` gains the graph rules
 * (UNKNOWN_DEPENDENCY, SELF_DEPENDENCY, DEPENDENCY_CYCLE); `update` gains the
 * --depends-on (replace) / --add-depends-on (append) flags.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toContractWorkItem } from "./contract.js";
import { runCreate } from "./create.js";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { softTryLoadItem, tryLoadItem } from "./items.js";
import { runUpdate } from "./update.js";
import { runValidate } from "./validate.js";

function primedTree(): { dir: string; paths: Record<string, string> } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-deps-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP" });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp" });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login" });
  const a = runCreate({ cwd: dir, type: "task", title: "First", parent: "story-login", id: "task-a" });
  const b = runCreate({ cwd: dir, type: "task", title: "Second", parent: "story-login", id: "task-b" });
  const c = runCreate({ cwd: dir, type: "task", title: "Third", parent: "story-login", id: "task-c" });
  return { dir, paths: { "task-a": a.path, "task-b": b.path, "task-c": c.path } };
}

/** Set frontmatter keys on an item file via the real parser/serializer. */
function setFrontmatter(path: string, keys: Record<string, unknown>): void {
  const { data, body } = parseFrontmatter(readFileSync(path, "utf8"));
  for (const [k, v] of Object.entries(keys)) data[k] = v;
  writeFileSync(path, stringifyFrontmatter(data, body), "utf8");
}

function codes(result: ReturnType<typeof runValidate>): string[] {
  return result.errors.map((e) => e.code);
}

describe("depends_on kernel read path", () => {
  it("parses depends_on and does not flag it as an unknown key", () => {
    const { paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-b", "task-c"], custom: "x" });
    const loaded = softTryLoadItem(paths["task-a"]);
    expect(loaded.kind).toBe("item");
    if (loaded.kind !== "item") return;
    expect(loaded.item.dependsOn).toEqual(["task-b", "task-c"]);
    expect(loaded.unknownKeys).toEqual(["custom"]);
    expect(loaded.item.extras.depends_on).toEqual(["task-b", "task-c"]);
  });

  it("defaults to an empty list when the field is absent", () => {
    const { paths } = primedTree();
    const loaded = softTryLoadItem(paths["task-a"]);
    expect(loaded.kind).toBe("item");
    if (loaded.kind !== "item") return;
    expect(loaded.item.dependsOn).toEqual([]);
  });

  it("round-trips depends_on through parse + stringify", () => {
    const { paths } = primedTree();
    const raw = readFileSync(paths["task-a"], "utf8");
    const { data, body } = parseFrontmatter(raw);
    data.depends_on = ["task-b", "task-c"];
    const rewritten = stringifyFrontmatter(data, body);
    const reread = parseFrontmatter(rewritten);
    expect(reread.data.depends_on).toEqual(["task-b", "task-c"]);
    expect(softTryLoadItem(paths["task-a"]).kind).toBe("item");
    writeFileSync(paths["task-a"], rewritten, "utf8");
    const loaded = softTryLoadItem(paths["task-a"]);
    if (loaded.kind !== "item") throw new Error("expected item");
    expect(loaded.item.dependsOn).toEqual(["task-b", "task-c"]);
  });

  it("reports INVALID_DEPENDS_ON for a non-list value", () => {
    const { paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: "task-b" });
    const loaded = softTryLoadItem(paths["task-a"]);
    expect(loaded.kind).toBe("item");
    if (loaded.kind !== "item") return;
    expect(loaded.issues.map((i) => i.code)).toEqual(["INVALID_DEPENDS_ON"]);
    expect(() => tryLoadItem(paths["task-a"])).toThrow(/must be a list/);
  });

  it("maps depends_on through the contract item", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-b"] });
    const loaded = softTryLoadItem(paths["task-a"]);
    if (loaded.kind !== "item") throw new Error("expected item");
    expect(toContractWorkItem(loaded.item, dir).depends_on).toEqual(["task-b"]);
  });
});

describe("validate dependency rules", () => {
  it("keeps a clean DAG valid with zero findings", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-b", "task-c"] });
    const result = runValidate({ cwd: dir });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("reports UNKNOWN_DEPENDENCY with the item path", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-nope"] });
    const result = runValidate({ cwd: dir });
    expect(result.errors).toHaveLength(1);
    const issue = result.errors[0]!;
    expect(issue.code).toBe("UNKNOWN_DEPENDENCY");
    expect(issue.path).toBe("tasks/launch-mvp/auth/story-login/task-a.md");
    expect(issue.message).toContain("task-nope");
  });

  it("reports SELF_DEPENDENCY", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-a"] });
    const result = runValidate({ cwd: dir });
    expect(codes(result)).toEqual(["SELF_DEPENDENCY"]);
    expect(result.errors[0]!.message).toContain("task-a");
  });

  it("reports DEPENDENCY_CYCLE once for a two-item cycle", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-b"], { depends_on: ["task-a"] });
    setFrontmatter(paths["task-a"], { depends_on: ["task-b"] });
    const result = runValidate({ cwd: dir });
    expect(codes(result)).toEqual(["DEPENDENCY_CYCLE"]);
    expect(result.errors[0]!.message).toBe("dependency cycle: task-a -> task-b -> task-a");
    expect(result.errors[0]!.path).toContain("task-a.md");
  });

  it("reports DEPENDENCY_CYCLE for a three-item cycle", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-b"] });
    setFrontmatter(paths["task-b"], { depends_on: ["task-c"] });
    setFrontmatter(paths["task-c"], { depends_on: ["task-a"] });
    const result = runValidate({ cwd: dir });
    expect(codes(result)).toEqual(["DEPENDENCY_CYCLE"]);
    expect(result.errors[0]!.message).toBe(
      "dependency cycle: task-a -> task-b -> task-c -> task-a",
    );
  });

  it("keeps v0-v2 trees valid when they use depends_on (unconditional parsing)", () => {
    const { dir, paths } = primedTree();
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 0\n", "utf8");
    setFrontmatter(paths["task-a"], { depends_on: ["task-b"] });
    const result = runValidate({ cwd: dir });
    expect(result.conventionVersion).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("accepts a v3 tree and still rejects a newer one", () => {
    const { dir, paths } = primedTree();
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 3\n", "utf8");
    setFrontmatter(paths["task-a"], { depends_on: ["task-b"] });
    expect(runValidate({ cwd: dir }).errors).toEqual([]);
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 4\n", "utf8");
    const newer = runValidate({ cwd: dir });
    expect(codes(newer)).toContain("CONVENTION_VERSION");
  });
});

describe("update depends_on flags", () => {
  it("--depends-on replaces the full list", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-c"] });
    const result = runUpdate({ cwd: dir, id: "task-a", dependsOn: "task-b, task-c" });
    expect(result.changed).toEqual(["depends_on"]);
    expect(result.item.dependsOn).toEqual(["task-b", "task-c"]);
    const reread = softTryLoadItem(paths["task-a"]);
    if (reread.kind !== "item") throw new Error("expected item");
    expect(reread.item.dependsOn).toEqual(["task-b", "task-c"]);
  });

  it("--depends-on '' clears the list", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-b"] });
    const result = runUpdate({ cwd: dir, id: "task-a", dependsOn: "" });
    expect(result.changed).toEqual(["depends_on"]);
    expect(result.item.dependsOn).toEqual([]);
  });

  it("--depends-on with an unchanged list is a no-op", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-b"] });
    const result = runUpdate({ cwd: dir, id: "task-a", dependsOn: "task-b" });
    expect(result.changed).toEqual([]);
  });

  it("--add-depends-on appends one id", () => {
    const { dir } = primedTree();
    const result = runUpdate({ cwd: dir, id: "task-a", addDependsOn: "task-b" });
    expect(result.changed).toEqual(["depends_on"]);
    expect(result.item.dependsOn).toEqual(["task-b"]);
  });

  it("--add-depends-on is a no-op when the id is already present", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-b"] });
    const result = runUpdate({ cwd: dir, id: "task-a", addDependsOn: "task-b" });
    expect(result.changed).toEqual([]);
    expect(result.item.dependsOn).toEqual(["task-b"]);
  });

  it("--depends-on and --add-depends-on compose (replace, then append)", () => {
    const { dir } = primedTree();
    const result = runUpdate({
      cwd: dir,
      id: "task-a",
      dependsOn: "task-b",
      addDependsOn: "task-c",
    });
    expect(result.item.dependsOn).toEqual(["task-b", "task-c"]);
  });

  it("fails with an actionable error on unknown ids (replace and append)", () => {
    const { dir } = primedTree();
    expect(() => runUpdate({ cwd: dir, id: "task-a", dependsOn: "task-ghost" })).toThrow(
      /depends_on id 'task-ghost' does not resolve to an existing item/,
    );
    expect(() => runUpdate({ cwd: dir, id: "task-a", addDependsOn: "task-ghost" })).toThrow(
      /depends_on id 'task-ghost' does not resolve to an existing item/,
    );
  });

  it("rejects an empty --add-depends-on value", () => {
    const { dir } = primedTree();
    expect(() => runUpdate({ cwd: dir, id: "task-a", addDependsOn: "  " })).toThrow(
      /--add-depends-on requires a non-empty item id/,
    );
  });

  it("dependencies never block updates: closing with open deps still works (advisory)", () => {
    const { dir, paths } = primedTree();
    setFrontmatter(paths["task-a"], { depends_on: ["task-b"] });
    const result = runUpdate({
      cwd: dir,
      id: "task-a",
      status: "in_progress",
      assignee: "arggon",
    });
    expect(result.item.status).toBe("in_progress");
    expect(result.item.dependsOn).toEqual(["task-b"]);
  });
});
