import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runValidate } from "./validate.js";

const fixtures = join(process.cwd(), "fixtures");

describe("validate", () => {
  it("passes the minimal valid fixture", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-valid/minimal") });
    expect(result.errors).toEqual([]);
  });

  it("passes the sample launch-mvp tree", () => {
    const result = runValidate({ cwd: process.cwd() });
    expect(result.errors).toEqual([]);
  });

  it("reports missing parent", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-invalid/parent-missing") });
    expect(result.errors.some((e) => e.code === "PARENT_MISSING")).toBe(true);
  });

  it("reports unknown status", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-invalid/bad-status") });
    expect(result.errors.some((e) => e.code === "UNKNOWN_STATUS")).toBe(true);
  });

  it("reports wrong parent type", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-invalid/wrong-parent-type") });
    expect(
      result.errors.some((e) => e.code === "PARENT_TYPE" || e.code === "PARENT_PATH_MISMATCH"),
    ).toBe(true);
  });

  it("reports leaf under epic", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-invalid/leaf-under-epic") });
    expect(
      result.errors.some(
        (e) =>
          e.code === "PARENT_TYPE" ||
          e.code === "PARENT_PATH_MISMATCH" ||
          e.message.includes("story"),
      ),
    ).toBe(true);
  });

  it("reports broken yaml with file path", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-invalid/broken-yaml") });
    expect(result.errors.some((e) => e.code === "BROKEN_YAML")).toBe(true);
    expect(result.errors.find((e) => e.code === "BROKEN_YAML")?.path).toContain("y.md");
  });

  it("reports missing container index", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-invalid/missing-index") });
    expect(result.errors.some((e) => e.code === "MISSING_INDEX")).toBe(true);
  });
});
