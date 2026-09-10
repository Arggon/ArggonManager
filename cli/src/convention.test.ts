import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONVENTION_VERSION,
  CONVENTION_VERSION_DEFAULT,
  readConventionVersion,
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
