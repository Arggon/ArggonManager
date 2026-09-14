import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generatedMarker } from "./docs.js";

// task-skill-copy-sync: skills/arggon-cli/SKILL.md is the single source;
// init bundles it at .agents/skills/arggon-cli/SKILL.md (with the standard
// generated marker stamped on top). This parity test fails whenever the copy
// drifts from the source, so every SKILL.md edit must land in both (or be
// regenerated) before merge.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("bundled skill copy parity", () => {
  it("keeps .agents/skills/arggon-cli/SKILL.md byte-equal to skills/arggon-cli/SKILL.md modulo the generated marker", () => {
    const source = readFileSync(join(repoRoot, "skills/arggon-cli/SKILL.md"), "utf8");
    const copy = readFileSync(join(repoRoot, ".agents/skills/arggon-cli/SKILL.md"), "utf8");
    expect(copy).toBe(`${generatedMarker("skills/arggon-cli/SKILL.md")}\n${source}`);
  });
});
