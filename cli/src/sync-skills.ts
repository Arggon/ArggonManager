import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLED_SKILLS, generatedMarker } from "./docs.js";
import { loadCliCommands, spliceGeneratedCommands } from "./skill-commands.js";

// task-adr0006-docs-budget: .agents/skills/arggon-cli/SKILL.md is a generated
// copy of skills/arggon-cli/SKILL.md (gitignored — single committed source).
// Run via `npm run skills:sync` after cloning or editing the source so local
// dev and skill-reading agent clients always see the file on disk. The
// parity test (cli/src/skill-copy.test.ts) regenerates it when missing too,
// so CI never masks drift.
//
// task-opencode2-methodology (W5): the arggon-cli skill ships as an umbrella
// (`SKILL.md`) plus `references/`; every file in BUNDLED_SKILLS is copied with
// its generated marker, exactly like init bundles it into adopter trees.
//
// task-skill-generated-command-reference: the pipeline first splices the
// `arggon:generated-commands` marker regions of the source SKILL with lines
// rendered from live CLI introspection (cli/src/skill-commands.ts), then
// writes the copy — so the committed source itself carries the fresh region.
// Reference files carry no regions; splice is a no-op for them.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const commands = loadCliCommands();

for (const { source, dest } of BUNDLED_SKILLS) {
  const sourcePath = join(repoRoot, ...source.split("/"));
  const copyPath = join(repoRoot, ...dest.split("/"));
  const spliced = spliceGeneratedCommands(readFileSync(sourcePath, "utf8"), commands);
  writeFileSync(sourcePath, spliced);
  mkdirSync(dirname(copyPath), { recursive: true });
  writeFileSync(copyPath, `${generatedMarker(source)}\n${spliced}`);
}

console.log(`synced ${BUNDLED_SKILLS.length} bundled skill file(s) from their single sources`);
