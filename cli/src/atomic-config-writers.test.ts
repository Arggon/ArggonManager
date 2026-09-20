/**
 * F3 (bug-atomic-write-followups): every `tasks/.convention.yml` write goes
 * through `writeFileAtomic`. This file records both sides of the delegation:
 *
 *  - `node:fs.writeFileSync` must never be called with the convention path
 *    directly — an in-place rewrite is exactly the truncate window the fix
 *    removes (readConventionConfig throws on a torn read; readConventionVersion
 *    degrades to version 0);
 *  - `writeFileAtomic` must be called with the convention path by the three
 *    known writers: the init scaffold, `applyDocsPlan`'s state rewrite, and
 *    `arggon adopt --ack`.
 *
 * The mocks are pass-through: real files still land on disk, only the calls
 * are recorded.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAdoptAck } from "./adopt.js";
import { CONVENTION_VERSION, readConventionConfig } from "@arggon/lib";
import { generateDocs } from "./docs.js";
import { runInit } from "./init.js";

const spies = vi.hoisted(() => ({
  /** Every path passed to the real fs.writeFileSync. */
  directWrites: [] as string[],
  /** Every writeFileAtomic(path, content) call. */
  atomicWrites: [] as Array<{ path: string; content: string }>,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync(path: Parameters<typeof actual.writeFileSync>[0], ...rest: unknown[]) {
      spies.directWrites.push(String(path));
      return (actual.writeFileSync as (...a: unknown[]) => void)(path, ...rest);
    },
  };
});

vi.mock("@arggon/lib", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@arggon/lib")>();
  return {
    ...actual,
    writeFileAtomic(path: string, content: string) {
      spies.atomicWrites.push({ path, content });
      return actual.writeFileAtomic(path, content);
    },
  };
});

const dirs: string[] = [];
function tmpDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function resetSpies(): void {
  spies.directWrites.length = 0;
  spies.atomicWrites.length = 0;
}
function conventionPath(dir: string): string {
  return join(dir, "ArggonManager", ".convention.yml");
}
function atomicConventionWrites(dir: string): Array<{ path: string; content: string }> {
  return spies.atomicWrites.filter((call) => call.path === conventionPath(dir));
}
function directConventionWrites(): string[] {
  return spies.directWrites.filter((path) => path.endsWith(".convention.yml"));
}

describe(".convention.yml writers are atomic (F3)", () => {
  it("fresh init scaffolds through writeFileAtomic, never in place", () => {
    const dir = tmpDir("arggon-atomic-config-init-");
    resetSpies();
    runInit({ dir, force: false, full: true });

    const writes = atomicConventionWrites(dir);
    // Two known writers run on a fresh scaffold: the init write (empty
    // x-generated) and the applyDocsPlan state rewrite (entries).
    expect(writes.some((call) => !call.content.includes("x-generated:"))).toBe(true);
    expect(writes.some((call) => call.content.includes("x-generated:"))).toBe(true);
    expect(directConventionWrites()).toEqual([]);

    expect(readConventionConfig(dir).version).toBe(CONVENTION_VERSION);
  });

  it("applyDocsPlan's state rewrite goes through writeFileAtomic", () => {
    const dir = tmpDir("arggon-atomic-config-docs-");
    runInit({ dir, force: false, full: true });
    resetSpies();
    generateDocs({ root: dir, full: false });

    const writes = atomicConventionWrites(dir);
    expect(writes.length).toBeGreaterThanOrEqual(1);
    expect(writes.at(-1)?.content).toContain("x-generated:");
    expect(directConventionWrites()).toEqual([]);
  });

  it("adopt --ack refreshes the baseline through writeFileAtomic", () => {
    const dir = tmpDir("arggon-atomic-config-ack-");
    runInit({ dir, force: false, full: true });
    resetSpies();
    const result = runAdoptAck({ cwd: dir });

    expect(result.count).toBeGreaterThan(0);
    const writes = atomicConventionWrites(dir);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain("acknowledged: true");
    expect(directConventionWrites()).toEqual([]);

    // The ack landed and the tree is still readable.
    expect(readConventionConfig(dir).generated["AGENTS.md"]?.acknowledged).toBe(true);
    expect(readFileSync(conventionPath(dir), "utf8")).toContain("acknowledged: true");
  });
});
