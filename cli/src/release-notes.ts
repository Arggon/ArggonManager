/**
 * Extract one release's CHANGELOG section for the GitHub Release notes
 * (bug-release-notes-extraction-breaks-on-linked-header).
 *
 * The incident: `.github/workflows/release.yml` used to do this inline with
 * awk and a pattern anchored to the closing bracket —
 * `^## \[0\.5\.0\]` with nothing allowed after it. release-please writes the
 * LINKED header form
 * `## [0.5.0](https://github.com/.../compare/...v0.5.0) (2026-10-02)`,
 * which that pattern never matches, so the first fully-automated release
 * (v0.5.0) died at this step — AFTER the tag was already pushed and the
 * lockstep agreement asserted. The step failed closed (no empty release), but
 * it stranded a published tag with no release object and nothing on npm.
 *
 * This module fixes it three ways:
 *   1. it matches the header by its `## [V]` PREFIX, so linked, plain
 *      (`## [0.4.1] - 2026-10-01`) and bare (`## [Unreleased]`) all work;
 *   2. it is a real module with tests, not inline shell — the class cannot
 *      regress silently into a workflow edit;
 *   3. `main` re-runs it BEFORE the tag step (the workflow calls
 *      `--check` there), so a notes problem can never strand a tag again.
 *
 * Usage (the workflow invokes it through tsx, like the repo's other scripts):
 *   npx tsx cli/src/release-notes.ts --check            # exit 0 / 1, no output file
 *   npx tsx cli/src/release-notes.ts --write <out.md>   # write the section
 *   npx tsx cli/src/release-notes.ts --version <V>      # default: read package.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The `## [V]` prefix for a version: links and trailing text are irrelevant. */
function headerPrefix(version: string): string {
  return `## [${version}]`;
}

/**
 * The section body for `version`, or `null` when CHANGELOG.md carries no such
 * header or the section is empty. Stops at the next level-2 heading, skips the
 * blank line directly under the header, and keeps everything else verbatim
 * (including nested `###` headings and fenced blocks).
 */
export function extractReleaseSection(changelog: string, version: string): string | null {
  const prefix = headerPrefix(version);
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(prefix));
  if (start === -1) return null;
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    body.push(line);
  }
  while (body.length > 0 && body[0].trim() === "") body.shift();
  while (body.length > 0 && body[body.length - 1].trim() === "") body.pop();
  return body.length > 0 ? body.join("\n") : null;
}

/** Version of the release being cut: `--version` wins, else the root package. */
export function resolveVersion(argv: string[]): string {
  const flag = argv.indexOf("--version");
  if (flag !== -1 && argv[flag + 1] !== undefined) return argv[flag + 1];
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
}

function main(argv: string[]): void {
  const version = resolveVersion(argv);
  const changelogPath = argv.includes("--changelog")
    ? (argv[argv.indexOf("--changelog") + 1] as string)
    : join(root, "CHANGELOG.md");
  let changelog: string;
  try {
    changelog = readFileSync(changelogPath, "utf8");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`release-notes: cannot read ${changelogPath}: ${reason} — refusing to continue`);
    process.exit(1);
  }
  const section = extractReleaseSection(changelog, version);
  if (section === null) {
    // Fail closed, with the shape the operator needs to fix it.
    const headers = changelog
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) => `  ${line.slice(0, 72)}`)
      .join("\n");
    console.error(
      `release-notes: CHANGELOG.md has no non-empty '${headerPrefix(version)}' section.\n` +
        `The merged release section is the GitHub Release notes source; refusing to create an\n` +
        `empty release (and, with --check, refusing to tag). Sections present:\n${headers}`,
    );
    process.exit(1);
  }
  const write = argv.indexOf("--write");
  if (write !== -1 && argv[write + 1] !== undefined) {
    const out = argv[write + 1] as string;
    writeFileSync(out, `${section}\n`, "utf8");
    console.log(
      `release-notes: wrote ${section.split("\n").length} line(s) for ${version} to ${out}`,
    );
  } else {
    console.log(`release-notes: ${version} section ok (${section.split("\n").length} lines)`);
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith("release-notes.ts")) {
  main(process.argv.slice(2));
}
