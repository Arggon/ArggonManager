import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runInit } from "./init.js";

describe("init", () => {
  it("scaffolds tasks/.convention.yml and templates", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    runInit({ dir, force: false });
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toContain("version: 0");
    expect(existsSync(join(dir, "templates/task.md"))).toBe(true);
    expect(existsSync(join(dir, "templates/initiative.md"))).toBe(true);
  });

  it("is idempotent without --force when already initialized", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    runInit({ dir, force: false });
    runInit({ dir, force: false });
    expect(existsSync(join(dir, "tasks/.convention.yml"))).toBe(true);
  });

  it("errors when tasks/ exists without convention unless --force", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks/note.txt"), "x");
    expect(() => runInit({ dir, force: false })).toThrow(/--force/);
  });
});
