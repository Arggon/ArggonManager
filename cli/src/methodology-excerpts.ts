import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCES = {
  dispatch: "ArggonManager/docs/agents.md",
  priority: "ArggonManager/docs/engineering.md",
} as const;
export const EXCERPT_DESTINATION = "skills/arggon-cli/references/orchestration.md";

/** Required, unique source regions prevent a removed rule becoming an empty copy. */
export function coreExcerpts(root: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SOURCES).map(([name, path]) => {
      const source = readFileSync(join(root, path), "utf8");
      const pattern = new RegExp(
        `<!-- arggon:excerpt start: ${name} -->\\n([\\s\\S]*?)<!-- arggon:excerpt end: ${name} -->`,
        "g",
      );
      const regions = [...source.matchAll(pattern)];
      if (regions.length !== 1 || !regions[0]![1]!.trim()) {
        throw new Error(`${path}: expected one non-empty ${name} excerpt`);
      }
      return [name, regions[0]![1]!.trim()];
    }),
  );
}

export function spliceCoreExcerpts(text: string, excerpts: Record<string, string>): string {
  for (const [name, body] of Object.entries(excerpts)) {
    const pattern = new RegExp(
      `(<!-- arggon:generated-excerpt start: ${name} -->)\\n[\\s\\S]*?(<!-- arggon:generated-excerpt end: ${name} -->)`,
      "g",
    );
    if ([...text.matchAll(pattern)].length !== 1) {
      throw new Error(`${EXCERPT_DESTINATION}: expected one ${name} destination`);
    }
    text = text.replace(
      pattern,
      (_match, start: string, end: string) => `${start}\n\n${body}\n\n${end}`,
    );
  }
  return text;
}

/** Source-checkout maintenance only; adopters receive the already generated skill. */
export function syncCoreExcerpts(root: string): void {
  const path = join(root, EXCERPT_DESTINATION);
  writeFileSync(path, spliceCoreExcerpts(readFileSync(path, "utf8"), coreExcerpts(root)));
}
