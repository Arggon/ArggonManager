import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Source carriers only: targeted references are deliberately outside the core. */
export const METHODOLOGY_CORE_PATHS = [
  "ArggonManager/docs/agents.md",
  "ArggonManager/docs/convention.md",
  "ArggonManager/docs/engineering.md",
  "skills/arggon-cli/SKILL.md",
] as const;

export const METHODOLOGY_CORE_BUDGET_BYTES = 122_880;
export const METHODOLOGY_START_BUDGET_BYTES = 20_480;

export type MethodologyBudget = {
  files: Array<{ path: string; bytes: number }>;
  core: { bytes: number; budget: number; pass: boolean };
  start: { path: string; bytes: number; budget: number; pass: boolean };
};

/**
 * Measure raw source bytes, not generated copies or character/token estimates.
 * Every carrier is required: a missing, unreadable or non-file path throws
 * rather than shrinking the total into a misleading passing measurement.
 */
export function measureMethodologyBudget(root: string): MethodologyBudget {
  const files = METHODOLOGY_CORE_PATHS.map((path) => {
    const absolute = join(root, path);
    try {
      if (!statSync(absolute).isFile()) throw new Error("not a regular file");
      return { path, bytes: readFileSync(absolute).byteLength };
    } catch (cause) {
      throw new Error(`cannot measure required methodology source ${path}`, { cause });
    }
  });
  const coreBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const start = files[0];
  return {
    files,
    core: {
      bytes: coreBytes,
      budget: METHODOLOGY_CORE_BUDGET_BYTES,
      pass: coreBytes <= METHODOLOGY_CORE_BUDGET_BYTES,
    },
    start: {
      path: start.path,
      bytes: start.bytes,
      budget: METHODOLOGY_START_BUDGET_BYTES,
      pass: start.bytes <= METHODOLOGY_START_BUDGET_BYTES,
    },
  };
}
