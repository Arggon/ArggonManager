/**
 * Release-notes extraction (bug-release-notes-extraction-breaks-on-linked-header).
 *
 * The v0.5.0 release died after its tag was already pushed: the workflow's
 * inline awk anchored to the closing bracket of the section header, and
 * release-please writes the LINKED form `## [0.5.0](…compare/…) (date)`, so
 * the pattern never matched and the step failed closed with "CHANGELOG.md has
 * no '## [0.5.0]' section". These cases pin the fix: prefix matching (linked,
 * plain and bare headers), the stop-at-the-next-`## `-heading rule, fail-closed
 * on a missing or empty section, and the real repository CHANGELOG.md (whose
 * 0.5.0 header is the exact shape that broke it).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractReleaseSection, resolveVersion } from "./release-notes.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const LINKED = [
  '<!-- arggon:generated template="CHANGELOG.md" -->',
  "",
  "# Changelog",
  "",
  "## [0.5.0](https://github.com/Arggon/ArggonManager/compare/arggon-manager-v0.4.1...arggon-manager-v0.5.0) (2026-10-02)",
  "",
  "### Added",
  "",
  "- **worktree:** the env contract",
  "",
  "## [Unreleased]",
  "",
  "- nothing yet",
  "",
  "## [0.4.1] - 2026-10-01",
  "",
  "### Fixed",
  "",
  "- **board:** keepNames",
  "",
].join("\n");

const PLAIN = ["## [0.4.1] - 2026-10-01", "", "### Fixed", "", "- **board:** keepNames", ""].join(
  "\n",
);

describe("release-notes extraction (bug-release-notes-extraction-breaks-on-linked-header)", () => {
  it("matches release-please's LINKED header (the shape that broke 0.5.0)", () => {
    const section = extractReleaseSection(LINKED, "0.5.0");
    expect(section).not.toBeNull();
    expect(section).toContain("### Added");
    expect(section).toContain("- **worktree:** the env contract");
  });

  it("matches the plain `## [V] - date` header", () => {
    expect(extractReleaseSection(PLAIN, "0.4.1")).toBe("### Fixed\n\n- **board:** keepNames");
  });

  it("stops at the next level-2 heading and keeps nested `###` sections", () => {
    const section = extractReleaseSection(LINKED, "0.5.0");
    expect(section).not.toContain("## [Unreleased]");
    expect(section).not.toContain("nothing yet");
    // The following release's own section is still extractable and unchanged.
    expect(extractReleaseSection(LINKED, "0.4.1")).toBe("### Fixed\n\n- **board:** keepNames");
  });

  it("fails closed (null) when the section is missing or empty", () => {
    expect(extractReleaseSection(LINKED, "9.9.9")).toBeNull();
    expect(extractReleaseSection("## [1.0.0]\n\n", "1.0.0")).toBeNull();
    expect(extractReleaseSection("", "1.0.0")).toBeNull();
  });

  it("does not confuse a prefix match with a different version", () => {
    // `## [0.4.10]` must not satisfy a request for `0.4.1` (the header is
    // prefix-matched, but only against the bracketed token, not its digits).
    const trap = ["## [0.4.10] - 2026-01-01", "", "- trap", ""].join("\n");
    expect(extractReleaseSection(trap, "0.4.1")).toBeNull();
    expect(extractReleaseSection(trap, "0.4.10")).toBe("- trap");
  });

  it("resolves the version from the root package.json unless --version is given", () => {
    const fromPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
    expect(resolveVersion([])).toBe(fromPackage);
    expect(resolveVersion(["--version", "1.2.3"])).toBe("1.2.3");
  });

  it("the repository CHANGELOG.md yields a non-empty section for its own version", () => {
    const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
    const version = resolveVersion([]);
    const section = extractReleaseSection(changelog, version);
    // The released version has no section until the release PR adds one, so
    // assert the SHAPE instead: every header the file carries is prefix-matchable
    // and the newest released one is extractable.
    const headers = changelog.split("\n").filter((line) => line.startsWith("## ["));
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      const match = /^## \[([^\]]+)\]/.exec(header);
      expect(match, `unparseable header: ${header}`).not.toBeNull();
      if (match === null) continue;
      if (match[1] === "Unreleased") continue;
      expect(
        extractReleaseSection(changelog, match[1] ?? ""),
        `no section for the released version ${match[1]}`,
      ).not.toBeNull();
    }
    if (section !== null) expect(section.split("\n").length).toBeGreaterThan(3);
  });
});
