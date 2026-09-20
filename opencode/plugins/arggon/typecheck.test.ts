/**
 * Type gate for the vendored plugin source (review F1, task-native-tools).
 *
 * The root tsconfig includes `cli/src` only, vitest transpiles with esbuild (no
 * type-checking) and eslint is not type-aware — so
 * `opencode/plugins/arggon/index.ts`, the single file `arggon init` vendors
 * into every adopter tree, could ship a TypeScript error unnoticed (the review
 * caught exactly that: an undefined `ToolEditorLike` → TS2304). This gate runs
 * the same strict `tsc --noEmit` the reviewer ran. Scope is the plugin source
 * alone: it imports no packages (Node builtins plus a computed dynamic
 * `@opencode/plugin` specifier), so the check needs no build.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const tsc = join(root, "node_modules/typescript/bin/tsc");
const PLUGIN = "opencode/plugins/arggon/index.ts";

describe("vendored plugin type gate", () => {
  it(`type-checks ${PLUGIN} with --strict`, () => {
    expect(existsSync(tsc), `typescript is not installed at ${tsc}`).toBe(true);
    const proc = spawnSync(
      process.execPath,
      [
        tsc,
        "--noEmit",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--strict",
        "--skipLibCheck",
        PLUGIN,
      ],
      { cwd: root, encoding: "utf8", timeout: 120_000 },
    );
    expect(proc.status, `${proc.stdout ?? ""}${proc.stderr ?? ""}`).toBe(0);
  });
});
