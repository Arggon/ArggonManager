import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generatedMarker } from "./docs.js";

// task-adr0006-docs-budget: skills/arggon-cli/SKILL.md is the single committed
// source; .agents/skills/arggon-cli/SKILL.md is a gitignored generated copy
// (marker + source). Self-healing: when the copy is absent (fresh clone), this
// test regenerates it from the source before asserting equality — so it can
// never silently mask drift: any source/copy mismatch still fails.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("bundled skill copy parity", () => {
  it("keeps .agents/skills/arggon-cli/SKILL.md byte-equal to skills/arggon-cli/SKILL.md modulo the generated marker", () => {
    const source = readFileSync(join(repoRoot, "skills/arggon-cli/SKILL.md"), "utf8");
    const copyPath = join(repoRoot, ".agents/skills/arggon-cli/SKILL.md");
    const expected = `${generatedMarker("skills/arggon-cli/SKILL.md")}\n${source}`;
    if (!existsSync(copyPath)) {
      mkdirSync(dirname(copyPath), { recursive: true });
      writeFileSync(copyPath, expected);
    }
    expect(readFileSync(copyPath, "utf8")).toBe(expected);
  });
});
