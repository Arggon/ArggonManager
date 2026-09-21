/**
 * Type gate for the vendored plugin source (review F1, task-native-tools).
 *
 * The root tsconfig includes `cli/src` only, vitest transpiles with oxc (no
 * type-checking) and eslint is not type-aware — so the plugin sources
 * `arggon init` vendors could ship a TypeScript error unnoticed (the review
 * caught exactly that: an undefined `ToolEditorLike` → TS2304). This gate runs
 * a strict `tsc --noEmit` over the plugin sources through
 * `cli/tsconfig.plugin.json`: the server entry, the board surface (`board.ts`,
 * a static `@arggon/lib` import mapped to `lib/src/index.ts` so the check needs
 * no prior build) and the TUI entry `tui.tsx` (W5 review P3: it used to be
 * gated only by eslint + smoke). `solid-js`/JSX resolve to the repo-only
 * `cli/types/tui-runtime.d.ts` shim — the runtime provides them at load time
 * and the repo deliberately has no `solid-js` dependency.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const tsc = join(root, "node_modules/typescript/bin/tsc");
const TSCONFIG = "cli/tsconfig.plugin.json";

describe("vendored plugin type gate", () => {
  it(`type-checks the plugin source with --strict (${TSCONFIG})`, () => {
    expect(existsSync(tsc), `typescript is not installed at ${tsc}`).toBe(true);
    const proc = spawnSync(process.execPath, [tsc, "-p", TSCONFIG], {
      cwd: root,
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(proc.status, `${proc.stdout ?? ""}${proc.stderr ?? ""}`).toBe(0);
  });
});
