/**
 * Unit gate for the plugin bundle SIZE bound (`MAX_BUNDLE_BYTES`,
 * task-plugin-bundle-near-byte-ceiling).
 *
 * `buildPluginBundle` throws when the emitted artifact exceeds the bound, and
 * that throw is the single-file design's only noise gate: nothing else catches
 * accidental dependency creep (an unmapped bare import builds fine and only
 * fails at load time, in a dependency-less adopter tree) or an accidental
 * runaway bundle. Raising the constant must never raise it out of existence,
 * so the boundary proof lives here instead of in a scratch injection: a graph
 * that lands exactly ON the bound builds, one byte past it throws with the
 * measured byte counts.
 *
 * The graphs under test are synthetic two-module trees in os.tmpdir() (never
 * the repo), so the proof needs no source padding and reverts nothing.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { MAX_BUNDLE_BYTES, buildPluginBundle } from "./plugin-bundle.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A fresh scratch root holding one synthetic entry → filler graph. */
function scratchGraph(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-plugin-bound-"));
  tempDirs.push(dir);
  writeFileSync(
    join(dir, "entry.ts"),
    [
      `import { filler } from "./filler.js";`,
      `const plugin = { id: "synthetic", setup: () => {} };`,
      `export default plugin;`,
      `export const marker = filler;`,
      ``,
    ].join("\n"),
  );
  return dir;
}

/**
 * Rewrite the scratch graph's filler module so its string literal is exactly
 * `len` characters. The emitted module is a verbatim transpile, so the built
 * artifact's byte length moves 1:1 with `len` — which is what makes an exact
 * boundary position reachable (see the tests below).
 */
function scratchBytes(dir: string, fillerLength: number): number {
  writeFileSync(join(dir, "filler.ts"), `export const filler = "${"z".repeat(fillerLength)}";\n`);
  const { code } = buildPluginBundle(dir, "entry.ts");
  return Buffer.byteLength(code, "utf8");
}

/** Filler length that places the scratch artifact exactly on the bound. */
function exactBoundFiller(dir: string): number {
  const baseline = 1024;
  const base = scratchBytes(dir, baseline);
  const filler = baseline + (MAX_BUNDLE_BYTES - base);
  expect(filler).toBeGreaterThan(0);
  return filler;
}

describe("plugin bundle byte bound (task-plugin-bundle-near-byte-ceiling)", () => {
  it("keeps the emitted artifact at or under the bound", () => {
    const bytes = Buffer.byteLength(buildPluginBundle(repoRoot).code, "utf8");
    expect(
      bytes,
      `bundle is ${bytes} bytes against a ${MAX_BUNDLE_BYTES}-byte bound`,
    ).toBeLessThanOrEqual(MAX_BUNDLE_BYTES);
  });

  it("builds a graph sized exactly to the bound (the gate is not a blanket cap)", () => {
    const dir = scratchGraph();
    const filler = exactBoundFiller(dir);
    expect(scratchBytes(dir, filler)).toBe(MAX_BUNDLE_BYTES);
  });

  it("throws with the measured byte counts one byte past the bound", () => {
    const dir = scratchGraph();
    const filler = exactBoundFiller(dir);
    expect(() => scratchBytes(dir, filler + 1)).toThrow(
      `plugin bundle: ${MAX_BUNDLE_BYTES + 1} bytes > ${MAX_BUNDLE_BYTES} bound`,
    );
  });
});
