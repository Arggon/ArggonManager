import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Supply-chain gate (task-action-pins-hygiene): every `uses:` in the shipped
 * GitHub workflows must reference a FULL 40-hex commit SHA — never a moving
 * tag/branch. A trailing `# <version>` comment keeps the pin human-readable
 * (the #563 pattern).
 *
 * The release-please action was floating on `@v4` until it was SHA-pinned;
 * this gate keeps the class out.
 */
const workflowsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.github/workflows",
);

const SHA_REF = /uses:\s*\S+@[0-9a-f]{40}\s*(#.*)?$/;

describe("workflow action pins (supply-chain gate)", () => {
  it("pins every `uses:` in every shipped workflow to a full commit SHA", () => {
    const files = readdirSync(workflowsDir).filter((f) => f.endsWith(".yml"));
    expect(files.length).toBeGreaterThan(0);
    const floating: string[] = [];
    for (const file of files) {
      const lines = readFileSync(join(workflowsDir, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/^\s*#\s/.test(line) || /^\s*-?\s*name:/.test(line)) return;
        const m = /^\s*-?\s*uses:\s*(\S+)/.exec(line);
        if (m && !SHA_REF.test(line)) {
          floating.push(`${file}:${i + 1} -> ${m[1]}`);
        }
      });
    }
    expect(
      floating,
      "floating (non-SHA-pinned) action references found:\n" +
        floating.join("\n") +
        "\nPin each to a full 40-hex commit SHA with a '# <version>' comment " +
        "(git ls-remote <repo> refs/tags/<tag>) — the #563 pattern.",
    ).toEqual([]);
  });
});
