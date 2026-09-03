import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bundledTemplatesDir } from "./paths.js";

const CONVENTION_YML = `version: 0
`;

export type InitOptions = {
  dir: string;
  force: boolean;
};

function ensureTemplates(root: string, force: boolean): string[] {
  const templatesDest = join(root, "templates");
  const templatesSrc = bundledTemplatesDir();
  if (!existsSync(templatesSrc)) {
    throw new Error(`Bundled templates not found at ${templatesSrc}`);
  }
  mkdirSync(templatesDest, { recursive: true });
  const restored: string[] = [];
  for (const name of readdirSync(templatesSrc)) {
    if (!name.endsWith(".md")) continue;
    const dest = join(templatesDest, name);
    if (existsSync(dest) && !force) continue;
    copyFileSync(join(templatesSrc, name), dest);
    restored.push(name);
  }
  return restored;
}

export function runInit(opts: InitOptions): void {
  const root = resolve(opts.dir);
  const tasksDir = join(root, "tasks");
  const conventionPath = join(tasksDir, ".convention.yml");

  const already = existsSync(conventionPath);
  if (already && !opts.force) {
    const restored = ensureTemplates(root, false);
    console.log(`arggon init: already initialized at ${conventionPath}`);
    if (restored.length > 0) {
      console.log(`arggon init: restored missing templates: ${restored.join(", ")}`);
    } else {
      console.log("arggon init: templates/ already complete");
    }
    console.log("Next: create work with `arggon create` (coming soon), or copy from templates/.");
    return;
  }

  if (existsSync(tasksDir) && !already && !opts.force) {
    throw new Error(
      `tasks/ exists but is missing .convention.yml. Re-run with --force to scaffold, or fix manually.`,
    );
  }

  mkdirSync(tasksDir, { recursive: true });
  writeFileSync(conventionPath, CONVENTION_YML, "utf8");
  ensureTemplates(root, opts.force);

  console.log(`arggon init: ready in ${root}`);
  console.log("  - tasks/.convention.yml (version: 0)");
  console.log("  - templates/ (initiative, epic, story, task, bug)");
  console.log("Next:");
  console.log("  1. Add an initiative under tasks/<slug>/<slug>.md (see docs/convention.md)");
  console.log("  2. Or use templates/ as stubs until `arggon create` lands");
}
