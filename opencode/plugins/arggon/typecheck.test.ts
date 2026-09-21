/**
 * Type gate for the vendored plugin source (review F1, task-native-tools).
 *
 * The root tsconfig includes `cli/src` only, vitest transpiles with oxc (no
 * type-checking) and eslint is not type-aware — so
 * `opencode/plugins/arggon/index.ts`, the single source `arggon init` builds
 * the vendored bundle from, could ship a TypeScript error unnoticed (the review
 * caught exactly that: an undefined `ToolEditorLike` → TS2304). This gate runs
 * a strict `tsc --noEmit` over the plugin source.
 *
 * Since W5 (`task-native-tui`) the plugin source statically imports the kernel
 * (`board.ts` → `@arggon/lib`, inlined by the bundle build), so the gate uses
 * `cli/tsconfig.plugin.json` — the same strict options plus a `paths` mapping
 * of `@arggon/lib` to `lib/src/index.ts`, which keeps the check independent of
 * a previous `npm run build` (a fresh clone has no `lib/dist`). The TUI entry
 * is deliberately out of scope: it imports `solid-js`, which is resolved by the
 * OpenCode TUI runtime and is not a repo dependency (its wiring is covered by
 * `tui.test.ts` and its real load by `npm run smoke:tui`).
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
