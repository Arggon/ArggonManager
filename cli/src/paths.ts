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
