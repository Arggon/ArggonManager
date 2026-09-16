import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileAtomic } from "./atomic.js";

// Fault injection: vitest cannot spy on the ESM namespace of node:fs, so we
// mock the module once and toggle injected failures via hoisted state.
const faults = vi.hoisted(() => ({
  renameError: null as string | null,
  writeError: null as string | null,
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    renameSync(path: Parameters<typeof actual.renameSync>[0], ...rest: unknown[]) {
      if (faults.renameError) throw new Error(faults.renameError);
      return (actual.renameSync as (...a: unknown[]) => void)(path, ...rest);
    },
    writeFileSync(path: Parameters<typeof actual.writeFileSync>[0], ...rest: unknown[]) {
      if (faults.writeError) throw new Error(faults.writeError);
      return (actual.writeFileSync as (...a: unknown[]) => void)(path, ...rest);
    },
  };
});

describe("writeFileAtomic", () => {
  const dirs: string[] = [];
  function tmpDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "atomic-"));
    dirs.push(dir);
    return dir;
  }
  beforeEach(() => {
    faults.renameError = null;
    faults.writeError = null;
  });
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("writes content intact (byte length + content)", () => {
    const dir = tmpDir();
    const path = join(dir, "doc.md");
    const content = "---\nid: x\n---\n\n# hello\n\nsome éthèr unicode 🚀\n";
    writeFileAtomic(path, content);
    expect(readFileSync(path, "utf8")).toBe(content);
    expect(statSync(path).size).toBe(Buffer.byteLength(content, "utf8"));
  });

  it("replaces an existing file atomically", () => {
    const dir = tmpDir();
    const path = join(dir, "doc.md");
    writeFileSync(path, "old", "utf8");
    writeFileAtomic(path, "brand new content");
    expect(readFileSync(path, "utf8")).toBe("brand new content");
  });

  it("leaves no temp files behind on success", () => {
    const dir = tmpDir();
    writeFileAtomic(join(dir, "doc.md"), "content");
    expect(readdirSync(dir)).toEqual(["doc.md"]);
  });

  it("leaves the original untouched and throws when the rename fails", () => {
    const dir = tmpDir();
    const path = join(dir, "doc.md");
    writeFileSync(path, "original", "utf8");
    faults.renameError = "injected rename failure";
    expect(() => writeFileAtomic(path, "new")).toThrow("injected rename failure");
    // atomicity: the target is either old or new — never partial/empty
    expect(readFileSync(path, "utf8")).toBe("original");
    expect(readdirSync(dir)).toEqual(["doc.md"]);
  });

  it("propagates write errors and cleans up the temp file", () => {
    const dir = tmpDir();
    const path = join(dir, "doc.md");
    faults.writeError = "injected write failure";
    expect(() => writeFileAtomic(path, "new")).toThrow("injected write failure");
    expect(readdirSync(dir)).toEqual([]);
  });
});
