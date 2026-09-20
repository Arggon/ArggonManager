import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stampGeneratedContent } from "./docs.js";
import { PLUGIN_BUNDLE, buildPluginBundle } from "./plugin-bundle.js";

// W3 task-native-commands-seam: the vendored plugin is a single-file,
// dependency-free bundle built from opencode/plugins/arggon/index.ts with
// @arggon/lib inlined (ADR 0011 §5/§6, ADR 0013). `arggon init` vendors the
// committed artifact `opencode/plugins/arggon/index.bundle.ts` to
// `.opencode/plugins/arggon/index.ts`; the destination is a gitignored derived
// copy (marker + artifact), exactly like the bundled skill
// (skill-copy.test.ts precedent). This test REGENERATES both whenever they are
// absent or mismatched — a stale local copy (e.g. after merging a PR that
// changed the source) can never fail the suite; the source is the truth. The
// assertions pin the marker contract, determinism and the no-bare-import rule.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEST = ".opencode/plugins/arggon/index.ts";

/** Rebuild the artifact from source in memory and refresh it on disk if stale. */
function regenerateBundle(): string {
  const { code } = buildPluginBundle(repoRoot);
  const path = join(repoRoot, ...PLUGIN_BUNDLE.split("/"));
  if (!existsSync(path) || readFileSync(path, "utf8") !== code) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, code);
  }
  return code;
}

function bundleOnDisk(): string {
  return readFileSync(join(repoRoot, ...PLUGIN_BUNDLE.split("/")), "utf8");
}

describe("vendored plugin bundle parity (W3)", () => {
  it("regenerates the committed bundle from the plugin source, deterministically", () => {
    const code = regenerateBundle();
    // Provenance + content contract, independent of the implementation.
    expect(code.startsWith("// ArggonManager plugin bundle — GENERATED")).toBe(true);
    expect(code).toContain('__arggonModules.set("lib/src/index.ts"');
    expect(code).toContain(`__arggonModules.set("opencode/plugins/arggon/index.ts"`);
    // Determinism guard: a second build is byte-identical (no timestamps).
    expect(buildPluginBundle(repoRoot).code).toBe(code);
    expect(bundleOnDisk()).toBe(code);
  });

  it("inlines @arggon/lib through the build-time edge table (no runtime resolution)", () => {
    const { edges } = buildPluginBundle(repoRoot);
    expect(edges.get(`opencode/plugins/arggon/index.ts\u0000@arggon/lib`)).toBe("lib/src/index.ts");
    // The kernel's own relative imports all map to inlined modules.
    expect(edges.get("lib/src/index.ts\u0000./list.js")).toBe("lib/src/list.ts");
  });

  it("vendors only node builtins as imports (single file, no npm dependency)", () => {
    const code = regenerateBundle();
    const imports = [...code.matchAll(/^import\s[^\n]*from\s+"([^"]+)"/gm)].map((m) => m[1]);
    expect(imports).toEqual(["node:module"]);
    // The adopter shape: no static import of a package, no `@opencode/plugin`
    // sugar (the plain definition object loads on 2.0.x, see the playbook).
    expect(code).not.toMatch(/^import\s[^\n]*"@/m);
    expect(code).not.toContain("@opencode/plugin");
  });

  it("regenerates .opencode/plugins/arggon/index.ts from the bundle, deterministically", () => {
    const bundle = regenerateBundle();
    const expected = stampGeneratedContent(DEST, PLUGIN_BUNDLE, bundle);
    // Pin the marker contract independently of the stamp implementation.
    expect(expected.startsWith(`// arggon:generated template="${PLUGIN_BUNDLE}"\n`)).toBe(true);
    const copyPath = join(repoRoot, DEST);
    if (!existsSync(copyPath) || readFileSync(copyPath, "utf8") !== expected) {
      mkdirSync(dirname(copyPath), { recursive: true });
      writeFileSync(copyPath, expected);
    }
    expect(stampGeneratedContent(DEST, PLUGIN_BUNDLE, bundleOnDisk())).toBe(
      readFileSync(copyPath, "utf8"),
    );
  });
});
