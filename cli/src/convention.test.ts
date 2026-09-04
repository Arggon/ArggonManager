import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONVENTION_VERSION, readConventionVersion } from "./convention.js";

describe("readConventionVersion", () => {
  it("returns the central default when tasks/.convention.yml is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-conv-missing-"));
    expect(readConventionVersion(dir)).toBe(CONVENTION_VERSION);
  });

  it("reads version from tasks/.convention.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-conv-present-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 0\n", "utf8");
    expect(readConventionVersion(dir)).toBe(0);
  });

  it("falls back to the default on unparseable content", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-conv-bad-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), "not-a-version\n", "utf8");
    expect(readConventionVersion(dir)).toBe(CONVENTION_VERSION);
  });
});
