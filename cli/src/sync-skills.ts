import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generatedMarker } from "./docs.js";
import { loadCliCommands, spliceGeneratedCommands } from "./skill-commands.js";

// task-adr0006-docs-budget: .agents/skills/arggon-cli/SKILL.md is a generated
// copy of skills/arggon-cli/SKILL.md (gitignored — single committed source).
// Run via `npm run skills:sync` after cloning or editing the source so local
// dev and skill-reading agent clients always see the file on disk. The
// parity test (cli/src/skill-copy.test.ts) regenerates it when missing too,
// so CI never masks drift.
//
// task-skill-generated-command-reference: the pipeline first splices the
// `arggon:generated-commands` marker regions of the source SKILL with lines
// rendered from live CLI introspection (cli/src/skill-commands.ts), then
// writes the copy — so the committed source itself carries the fresh region.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = join(repoRoot, "skills/arggon-cli/SKILL.md");
const copyPath = join(repoRoot, ".agents/skills/arggon-cli/SKILL.md");

const spliced = spliceGeneratedCommands(readFileSync(sourcePath, "utf8"), loadCliCommands());
writeFileSync(sourcePath, spliced);
mkdirSync(dirname(copyPath), { recursive: true });
writeFileSync(copyPath, `${generatedMarker("skills/arggon-cli/SKILL.md")}\n${spliced}`);
console.log(`synced ${copyPath} from skills/arggon-cli/SKILL.md (generated regions refreshed)`);
