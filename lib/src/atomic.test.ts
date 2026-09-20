import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileAtomic } from "./atomic.js";

// Fault injection: vitest cannot spy on the ESM namespace of node:fs, so we
// mock the module once and toggle injected failures via hoisted state. The
// after-rename faults simulate the non-locking co-writers of F1
// (bug-atomic-write-followups) racing inside writeFileAtomic's rename->stat
// window; all of them use the captured `actual` namespace so the mock cannot
// recurse.
const faults = vi.hoisted(() => ({
  renameError: null as string | null,
  writeError: null as string | null,
  /** Rename a different-size file onto the target right after our rename. */
  replaceAfterRename: null as string | null,
  /** Truncate the target (same inode) right after our rename. */
  truncateAfterRename: null as number | null,
  /** Move the target away right after our rename. */
  moveAfterRename: null as string | null,
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    renameSync(path: Parameters<typeof actual.renameSync>[0], ...rest: unknown[]) {
      if (faults.renameError) throw new Error(faults.renameError);
      (actual.renameSync as (...a: unknown[]) => void)(path, ...rest);
      const to = String(rest[0]);
      if (faults.replaceAfterRename !== null) {
        const side = join(dirname(to), `.co-writer-${process.pid}.tmp`);
        actual.writeFileSync(side, faults.replaceAfterRename, "utf8");
        actual.renameSync(side, to);
      }
      if (faults.truncateAfterRename !== null) {
        actual.truncateSync(to, faults.truncateAfterRename);
      }
      if (faults.moveAfterRename !== null) actual.renameSync(to, faults.moveAfterRename);
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
    faults.replaceAfterRename = null;
    faults.truncateAfterRename = null;
    faults.moveAfterRename = null;
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

  // F2 (bug-atomic-write-followups): rename replaces the directory entry, so
  // without an explicit chmod the temp file's default mode would win.
  it("preserves the existing target's permission bits (F2)", () => {
    const dir = tmpDir();
    const path = join(dir, "doc.md");
    writeFileSync(path, "old", "utf8");
    chmodSync(path, 0o600);
    writeFileAtomic(path, "new content");
    expect(statSync(path).mode & 0o7777).toBe(0o600);
  });

  it("gives a fresh target the process default mode (F2)", () => {
    const dir = tmpDir();
    const path = join(dir, "doc.md");
    writeFileAtomic(path, "new content");
    // 0666 masked by the process umask — the pre-fix behavior for new files.
    expect(statSync(path).mode & 0o7777).toBe(0o666 & ~process.umask());
  });

  // F1 (bug-atomic-write-followups): the post-rename shrink guard must not
  // blame this write when a non-locking co-writer swapped the path.
  it("tolerates a co-writer replacing the path between rename and stat (F1)", () => {
    const dir = tmpDir();
    const path = join(dir, "doc.md");
    writeFileSync(path, "old", "utf8");
    faults.replaceAfterRename = "co-writer content of a different size entirely";
    expect(() => writeFileAtomic(path, "new")).not.toThrow();
    expect(readFileSync(path, "utf8")).toBe("co-writer content of a different size entirely");
    expect(readdirSync(dir)).toEqual(["doc.md"]);
  });

  it("tolerates the target being moved away by a co-writer after rename (F1)", () => {
    const dir = tmpDir();
    const path = join(dir, "doc.md");
    const moved = join(dir, "moved-away.md");
    faults.moveAfterRename = moved;
    expect(() => writeFileAtomic(path, "new")).not.toThrow();
    expect(readFileSync(moved, "utf8")).toBe("new");
  });

  it("still throws when the file we renamed is truncated in place (F1)", () => {
    const dir = tmpDir();
    const path = join(dir, "doc.md");
    writeFileSync(path, "old", "utf8");
    faults.truncateAfterRename = 3;
    expect(() => writeFileAtomic(path, "new content that is longer than three")).toThrow(
      /shrink guard/,
    );
    expect(readFileSync(path, "utf8")).toBe("new");
  });
});
