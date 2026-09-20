/**
 * Distribution asset locations for the root package (ADR 0013).
 *
 * The kernel library (`@arggon/lib`) is asset-free: it reads the repo's own
 * `templates/` first and takes a fallback templates directory as an explicit
 * caller option. These helpers resolve the *root* package root — where
 * `package.json`, `templates/`, `skills/` and `opencode/` live — so the CLI,
 * `init`/`doctor` and the MCP adapter can inject the bundled fallback.
 */
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo / package root (where package.json and templates/ live). */
export function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // cli/src under tsx, or dist after build
  if (here.endsWith(`${sep}dist`) || here.split(sep).includes("dist")) {
    return resolve(here, "..");
  }
  return resolve(here, "../..");
}

export function bundledTemplatesDir(): string {
  return resolve(packageRoot(), "templates");
}
