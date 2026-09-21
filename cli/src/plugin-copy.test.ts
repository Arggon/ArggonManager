import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stampGeneratedContent } from "./docs.js";
import {
  BUNDLE_EXPORTS,
  PLUGIN_BUNDLE,
  PLUGIN_SOURCE,
  buildPluginBundle,
  moduleValueExports,
} from "./plugin-bundle.js";

// W3 task-native-commands-seam: the vendored plugin is a single-file,
// dependency-free bundle built from opencode/plugins/arggon/index.ts with
// @arggon/lib inlined (ADR 0011 §5/§6, ADR 0013). `arggon init` vendors the
// committed artifact `opencode/plugins/arggon/index.bundle.ts` to
// `.opencode/plugins/arggon/index.ts`.
//
// The committed artifact is DRIFT-GATED, never auto-healed (review F1, PR
// #376): this suite asserts the on-disk bytes equal the deterministic build and
// FAILS when they differ — a source change without `npm run build:plugin` must
// never merge silently (`npm run check:plugin` runs the same gate in CI). Only
// the derived, gitignored `.opencode/plugins/arggon/index.ts` copy is
// regenerated here, exactly like the bundled skill (skill-copy.test.ts
// precedent); `npm run build:plugin` is the explicit sync command for the
// artifact.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEST = ".opencode/plugins/arggon/index.ts";
const BUNDLE_PATH = join(repoRoot, ...PLUGIN_BUNDLE.split("/"));
/** W5 TUI entry: vendored verbatim (not bundled), same parity contract. */
const TUI_SOURCE = "opencode/plugins/arggon/tui.tsx";
const TUI_DEST = ".opencode/plugins/arggon/tui.tsx";

/** Committed artifact bytes, read-only: this suite never rewrites it. */
function bundleOnDisk(): string {
  return readFileSync(BUNDLE_PATH, "utf8");
}

const STALE_HINT =
  "opencode/plugins/arggon/index.bundle.ts is stale — run `npm run build:plugin` and commit the artifact";

describe("vendored plugin bundle parity (W3)", () => {
  it("the committed bundle matches the deterministic build (drift gate, no auto-heal)", () => {
    const { code } = buildPluginBundle(repoRoot);
    // Provenance + content contract, independent of the implementation.
    expect(code.startsWith("// ArggonManager plugin bundle — GENERATED")).toBe(true);
    expect(code).toContain('__arggonModules.set("lib/src/index.ts"');
    expect(code).toContain(`__arggonModules.set("opencode/plugins/arggon/index.ts"`);
    // Determinism guard: a second build is byte-identical (no timestamps).
    expect(buildPluginBundle(repoRoot).code).toBe(code);
    // Assert BEFORE any write: a stale committed artifact fails the suite.
    expect(bundleOnDisk(), STALE_HINT).toBe(code);
  });

  it("inlines @arggon/lib through the build-time edge table (no runtime resolution)", () => {
    const { edges } = buildPluginBundle(repoRoot);
    expect(edges.get(`opencode/plugins/arggon/index.ts\u0000@arggon/lib`)).toBe("lib/src/index.ts");
    // The kernel's own relative imports all map to inlined modules.
    expect(edges.get("lib/src/index.ts\u0000./list.js")).toBe("lib/src/list.ts");
  });

  it("vendors only node builtins as imports (single file, no npm dependency)", () => {
    const code = bundleOnDisk();
    const imports = [...code.matchAll(/^import\s[^\n]*from\s+"([^"]+)"/gm)].map((m) => m[1]);
    expect(imports).toEqual(["node:module"]);
    // The adopter shape: no static import of a package, no `@opencode/plugin`
    // sugar (the plain definition object loads on 2.0.x, see the playbook).
    expect(code).not.toMatch(/^import\s[^\n]*"@/m);
    expect(code).not.toContain("@opencode/plugin");
  });

  it("regenerates the derived, gitignored .opencode copy from the committed bundle", () => {
    const expected = stampGeneratedContent(DEST, PLUGIN_BUNDLE, bundleOnDisk());
    // Pin the marker contract independently of the stamp implementation.
    expect(expected.startsWith(`// arggon:generated template="${PLUGIN_BUNDLE}"\n`)).toBe(true);
    const copyPath = join(repoRoot, DEST);
    // Derived copy (gitignored, also rewritten by `arggon init`): auto-heal is
    // safe here — the committed artifact above is what must never drift.
    if (!existsSync(copyPath) || readFileSync(copyPath, "utf8") !== expected) {
      mkdirSync(dirname(copyPath), { recursive: true });
      writeFileSync(copyPath, expected);
    }
    expect(readFileSync(copyPath, "utf8")).toBe(expected);
  });

  it("forwards exactly the board surface the TUI entry imports (W5)", () => {
    // Both directions: every allowlisted name exists in the entry module...
    const entryExports = moduleValueExports(repoRoot, PLUGIN_SOURCE);
    for (const name of BUNDLE_EXPORTS) {
      expect(entryExports, `entry exports ${name}`).toContain(name);
    }
    // ...and the emitted wrapper forwards nothing else.
    const forwarded = [...bundleOnDisk().matchAll(/^export const (\w+) = __arggonEntry\./gm)].map(
      (match) => match[1],
    );
    expect(forwarded.sort()).toEqual([...BUNDLE_EXPORTS].sort());
    // The allowlist IS the TUI import surface (no more, no less): a new import
    // in `tui.tsx` without a `BUNDLE_EXPORTS` entry fails here, not at load.
    const source = readFileSync(join(repoRoot, ...TUI_SOURCE.split("/")), "utf8");
    const block = /import\s*\{([^}]*)\}\s*from\s*"\.\/index\.ts"/.exec(source)?.[1] ?? "";
    const imported = block
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "" && !name.startsWith("type "));
    expect(imported.sort()).toEqual([...BUNDLE_EXPORTS].sort());
  });
});

describe("vendored TUI entry parity (W5)", () => {
  it("regenerates the derived, gitignored tui.tsx copy from the committed source", () => {
    const source = readFileSync(join(repoRoot, ...TUI_SOURCE.split("/")), "utf8");
    const expected = stampGeneratedContent(TUI_DEST, TUI_SOURCE, source);
    // Pin the marker contract independently of the stamp implementation.
    expect(expected.startsWith(`// arggon:generated template="${TUI_SOURCE}"\n`)).toBe(true);
    const copyPath = join(repoRoot, TUI_DEST);
    // Derived copy (gitignored, also rewritten by `arggon init`): auto-heal is
    // safe — the committed source is what must never drift.
    if (!existsSync(copyPath) || readFileSync(copyPath, "utf8") !== expected) {
      mkdirSync(dirname(copyPath), { recursive: true });
      writeFileSync(copyPath, expected);
    }
    expect(readFileSync(copyPath, "utf8")).toBe(expected);
  });

  it("keeps the vendored TUI entry dependency-less (runtime-resolved imports only)", () => {
    const source = readFileSync(join(repoRoot, ...TUI_SOURCE.split("/")), "utf8");
    const imports = [...source.matchAll(/^import\s[\s\S]*?from\s+"([^"]+)"/gm)].map(
      (match) => match[1],
    );
    expect(imports).toEqual(["solid-js", "./index.ts"]);
  });
});
