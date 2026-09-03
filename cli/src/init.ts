import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bundledTemplatesDir } from "./paths.js";

const CONVENTION_YML = `version: 0
`;

export type InitOptions = {
  dir: string;
  force: boolean;
};

export function runInit(opts: InitOptions): void {
  const root = resolve(opts.dir);
  const tasksDir = join(root, "tasks");
  const conventionPath = join(tasksDir, ".convention.yml");
  const templatesDest = join(root, "templates");
  const templatesSrc = bundledTemplatesDir();

  const already = existsSync(conventionPath);
  if (already && !opts.force) {
    console.log(`arggon init: already initialized at ${conventionPath}`);
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

  mkdirSync(templatesDest, { recursive: true });
  if (!existsSync(templatesSrc)) {
    throw new Error(`Bundled templates not found at ${templatesSrc}`);
  }
  for (const name of readdirSync(templatesSrc)) {
    if (!name.endsWith(".md")) continue;
    const dest = join(templatesDest, name);
    if (existsSync(dest) && !opts.force) continue;
    copyFileSync(join(templatesSrc, name), dest);
  }

  console.log(`arggon init: ready in ${root}`);
  console.log("  - tasks/.convention.yml (version: 0)");
  console.log("  - templates/ (initiative, epic, story, task, bug)");
  console.log("Next:");
  console.log("  1. Add an initiative under tasks/<slug>/<slug>.md (see docs/convention.md)");
  console.log("  2. Or use templates/ as stubs until `arggon create` lands");
}
