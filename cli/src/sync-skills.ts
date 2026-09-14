import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generatedMarker } from "./docs.js";

// task-adr0006-docs-budget: .agents/skills/arggon-cli/SKILL.md is a generated
// copy of skills/arggon-cli/SKILL.md (gitignored — single committed source).
// Run via `npm run skills:sync` after cloning or editing the source so local
// dev and skill-reading agent clients always see the file on disk. The
// parity test (cli/src/skill-copy.test.ts) regenerates it when missing too,
// so CI never masks drift.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = join(repoRoot, "skills/arggon-cli/SKILL.md");
const copyPath = join(repoRoot, ".agents/skills/arggon-cli/SKILL.md");

const source = readFileSync(sourcePath, "utf8");
mkdirSync(dirname(copyPath), { recursive: true });
writeFileSync(copyPath, `${generatedMarker("skills/arggon-cli/SKILL.md")}\n${source}`);
console.log(`synced ${copyPath} from skills/arggon-cli/SKILL.md`);
