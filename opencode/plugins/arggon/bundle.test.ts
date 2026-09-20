/**
 * W3 task-native-commands-seam: the vendored plugin bundle must be
 * single-file, dependency-free and fully functional in a dependency-less
 * fixture (ADR 0011 §5/§6, ADR 0013). This suite loads the committed artifact
 * `opencode/plugins/arggon/index.bundle.ts` from a temp directory OUTSIDE the
 * repo (so no `node_modules` is reachable), runs its `setup()` with a fake
 * plugin context and exercises the native tools end to end. That is the
 * deterministic, model-free proof of the dependency-less adopter shape; the
 * real OpenCode runtime load is covered by `npm run smoke:opencode`.
 *
 * The committed artifact is read-only here: drift is gated by
 * `cli/src/plugin-copy.test.ts` (assert-before-write) and `npm run check:plugin`
 * in CI, never auto-healed by the suite.
 */
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { PLUGIN_BUNDLE } from "../../../cli/src/plugin-bundle.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The twelve native tools (spec-native-first-011 §Tools). */
const TOOL_NAMES = [
  "list",
  "create",
  "update",
  "show",
  "next",
  "report",
  "validate",
  "comment",
  "handoff",
  "priority",
  "sync",
  "import_issues",
];

/** Core tools pinned into the Code Mode catalog (W3 lever, plugin constant). */
const PINNED = ["list", "create", "update", "show", "next", "validate", "comment", "handoff"];

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Copy the artifact to a fresh dependency-less temp dir and import it. */
async function importDependencyLess(): Promise<Record<string, unknown>> {
  const dir = mkdtempSync(join(tmpdir(), "arggon-plugin-bundle-"));
  tempDirs.push(dir);
  const copy = join(dir, "index.mjs");
  copyFileSync(join(repoRoot, ...PLUGIN_BUNDLE.split("/")), copy);
  return (await import(pathToFileURL(copy).href)) as Record<string, unknown>;
}

type CapturedTool = {
  name: string;
  description: string;
  options: { namespace?: string; codemode?: boolean; pinned?: boolean };
  execute: (
    input: Record<string, unknown>,
    tool?: { sessionID?: string },
  ) => Promise<{
    output: Record<string, unknown>;
  }>;
};

type ArgonPlugin = {
  id: string;
  setup(ctx: Record<string, unknown>): Promise<(() => void) | void>;
};

function fakeContext(directory: string): { ctx: Record<string, unknown>; tools: CapturedTool[] } {
  const tools: CapturedTool[] = [];
  const ctx = {
    location: { directory },
    tool: {
      transform: async (callback: (editor: unknown) => void) => {
        callback({
          namespace: () => {},
          add: (tool: CapturedTool) => {
            tools.push(tool);
          },
        });
      },
      hook: async () => ({}),
    },
    session: { hook: async () => ({}) },
    storage: {
      get: async () => undefined,
      set: async () => undefined,
      remove: async () => undefined,
    },
    vcs: { get: async () => ({ branch: "opencode2" }) },
  };
  return { ctx, tools };
}

describe("vendored plugin bundle: dependency-less load (W3)", () => {
  it("loads from a temp dir with no node_modules and exports the plugin definition", async () => {
    const mod = await importDependencyLess();
    expect(Object.keys(mod)).toEqual(["default"]);
    const definition = mod.default as ArgonPlugin;
    expect(definition.id).toBe("arggon");
    expect(typeof definition.setup).toBe("function");
  });

  it("registers the twelve native tools and exercises them against a real tracker", async () => {
    const mod = await importDependencyLess();
    const definition = mod.default as ArgonPlugin;
    const { ctx, tools } = fakeContext(repoRoot);
    const dispose = await definition.setup(ctx);
    expect(tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
    for (const tool of tools) {
      expect(tool.options.namespace, tool.name).toBe("arggon");
      expect(tool.options.codemode, tool.name).toBe(true);
    }
    expect(tools.filter((tool) => tool.options.pinned === true).map((tool) => tool.name)).toEqual(
      PINNED,
    );

    const list = tools.find((tool) => tool.name === "list")!;
    const listResult = await list.execute({}, { sessionID: "ses_bundle_test" });
    expect(listResult.output.ok).toBe(true);
    expect(listResult.output.command).toBe("list");
    expect(Array.isArray(listResult.output.items)).toBe(true);

    const show = tools.find((tool) => tool.name === "show")!;
    const missing = await show
      .execute({ id: "task-does-not-exist" }, { sessionID: "ses_bundle_test" })
      .then(
        () => undefined,
        (error: unknown) => error as { code?: string; message?: string },
      );
    expect(missing?.code).toBe("SHOW_FAILED");
    expect(missing?.message).toContain('"ok":false');

    if (typeof dispose === "function") dispose();
  });

  it("stays inert with a bare context (failure isolation, no throws)", async () => {
    const mod = await importDependencyLess();
    const definition = mod.default as ArgonPlugin;
    // No location/tool/session surfaces: setup resolves (a cleanup function or
    // undefined) instead of throwing.
    await expect(definition.setup({})).resolves.toBeTypeOf("function");
  });
});
