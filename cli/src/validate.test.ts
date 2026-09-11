import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runValidate } from "./validate.js";

const fixtures = join(process.cwd(), "fixtures");
const invalidRoot = join(fixtures, "tasks-invalid");

function invalidCases(): string[] {
  return readdirSync(invalidRoot).filter((name) => {
    if (name === "README.md") return false;
    return statSync(join(invalidRoot, name)).isDirectory();
  });
}

describe("validate", () => {
  it("passes the minimal valid fixture", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-valid/minimal") });
    expect(result.errors).toEqual([]);
  });

  it("passes the sample launch-mvp tree", () => {
    const result = runValidate({ cwd: process.cwd() });
    expect(result.errors).toEqual([]);
  });

  it("passes fixtures/tasks-valid golden tree", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-valid") });
    expect(result.errors).toEqual([]);
  });

  it.each(invalidCases())("rejects invalid fixture %s", (name) => {
    const result = runValidate({ cwd: join(invalidRoot, name) });
    expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
  });

  it("reports missing parent with PARENT_MISSING", () => {
    const result = runValidate({ cwd: join(invalidRoot, "parent-missing") });
    expect(result.errors.some((e) => e.code === "PARENT_MISSING")).toBe(true);
  });

  it("reports unknown status with UNKNOWN_STATUS", () => {
    const result = runValidate({ cwd: join(invalidRoot, "bad-status") });
    expect(result.errors.some((e) => e.code === "UNKNOWN_STATUS")).toBe(true);
  });

  it("reports broken yaml with file path", () => {
    const result = runValidate({ cwd: join(invalidRoot, "broken-yaml") });
    expect(result.errors.some((e) => e.code === "BROKEN_YAML")).toBe(true);
    expect(result.errors.find((e) => e.code === "BROKEN_YAML")?.path).toContain("y.md");
  });

  it("reports missing container index", () => {
    const result = runValidate({ cwd: join(invalidRoot, "missing-index") });
    expect(result.errors.some((e) => e.code === "MISSING_INDEX")).toBe(true);
  });

  it("reports invalid branch with INVALID_BRANCH", () => {
    const result = runValidate({ cwd: join(invalidRoot, "invalid-branch") });
    expect(result.errors.some((e) => e.code === "INVALID_BRANCH")).toBe(true);
  });

  it("reports bad branch_patterns with INVALID_BRANCH_PATTERN", () => {
    const result = runValidate({ cwd: join(invalidRoot, "invalid-branch-patterns") });
    expect(result.errors.some((e) => e.code === "INVALID_BRANCH_PATTERN")).toBe(true);
  });
});
