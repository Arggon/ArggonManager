import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bundledTemplatesDir } from "./paths.js";

const CONVENTION_YML = `version: 0
`;

export type InitOptions = {
  dir: string;
  force: boolean;
};

export type InitResult = {
  root: string;
  alreadyInitialized: boolean;
  force: boolean;
  created: string[];
  restored: string[];
  conventionPath: string;
};

function ensureTemplates(root: string, force: boolean): string[] {
  const templatesDest = join(root, "templates");
  const templatesSrc = bundledTemplatesDir();
  if (!existsSync(templatesSrc)) {
    throw new Error(`Bundled templates not found at ${templatesSrc}`);
  }
  mkdirSync(templatesDest, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(templatesSrc)) {
    if (!name.endsWith(".md")) continue;
    const dest = join(templatesDest, name);
    if (existsSync(dest) && !force) continue;
    copyFileSync(join(templatesSrc, name), dest);
    copied.push(name);
  }
  return copied;
}

export function runInit(opts: InitOptions): InitResult {
  const root = resolve(opts.dir);
  const tasksDir = join(root, "tasks");
  const conventionPath = join(tasksDir, ".convention.yml");

  const alreadyInitialized = existsSync(conventionPath);
  if (alreadyInitialized && !opts.force) {
    const restored = ensureTemplates(root, false)
      .map((name) => `templates/${name}`)
      .sort();
    return {
      root,
      alreadyInitialized: true,
      force: false,
      created: [],
      restored,
      conventionPath,
    };
  }

  if (existsSync(tasksDir) && !alreadyInitialized && !opts.force) {
    throw new Error(
      `tasks/ exists but is missing .convention.yml. Re-run with --force to scaffold, or fix manually.`,
    );
  }

  mkdirSync(tasksDir, { recursive: true });
  writeFileSync(conventionPath, CONVENTION_YML, "utf8");
  const copiedTemplates = ensureTemplates(root, opts.force).map((name) => `templates/${name}`);
  const created = ["tasks/.convention.yml", ...copiedTemplates].sort();

  return {
    root,
    alreadyInitialized,
    force: opts.force,
    created,
    restored: [],
    conventionPath,
  };
}
