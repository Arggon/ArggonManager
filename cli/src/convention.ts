import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Task-tree convention version written by `arggon init` (docs/convention.md). */
export const CONVENTION_VERSION = 0;

/**
 * Read the tree convention version from `<dir>/tasks/.convention.yml`.
 * Returns CONVENTION_VERSION when the file is missing or has no parseable
 * `version: N` line (per docs/json-output.md: omit file = 0).
 */
export function readConventionVersion(dir: string): number {
  const path = join(dir, "tasks/.convention.yml");
  if (!existsSync(path)) return CONVENTION_VERSION;
  try {
    const raw = readFileSync(path, "utf8");
    const match = raw.match(/^version\s*:\s*(\d+)/m);
    if (!match) return CONVENTION_VERSION;
    const parsed = Number.parseInt(match[1] ?? "", 10);
    return Number.isFinite(parsed) ? parsed : CONVENTION_VERSION;
  } catch {
    return CONVENTION_VERSION;
  }
}
