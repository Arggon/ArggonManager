/**
 * task-skill-generated-command-reference: the SKILL command reference is
 * GENERATED from the live CLI (cli/src/skill-commands.ts). Two invariants:
 *
 * 1. The regions between the `arggon:generated-commands` markers in
 *    skills/arggon-cli/SKILL.md match what the generator renders from the
 *    current cli/src/cli.ts surface — changing a command, argument or
 *    description without re-running `npm run skills:sync` fails here.
 * 2. Cross-check net: every user-facing command (minus the maintained
 *    exclusion list in skill-commands.ts) is documented SOMEWHERE in
 *    SKILL.md, README.md, or docs/agents.md — a new undocumented command
 *    fails loudly.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMAND_EXCLUSIONS,
  loadCliCommands,
  renderRegion,
  spliceGeneratedCommands,
} from "./skill-commands.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const skillPath = join(repoRoot, "skills/arggon-cli/SKILL.md");
const REGION_RE =
  /<!-- arggon:generated-commands start: (.+?) -->\n([\s\S]*?)<!-- arggon:generated-commands end -->/g;

describe("generated SKILL command reference (task-skill-generated-command-reference)", () => {
  it("keeps every generated region identical to freshly rendered output (run `npm run skills:sync` after CLI changes)", () => {
    const source = readFileSync(skillPath, "utf8");
    const regions = [...source.matchAll(REGION_RE)];
    expect(
      regions.length,
      "skills/arggon-cli/SKILL.md carries no arggon:generated-commands region",
    ).toBeGreaterThanOrEqual(3);
    expect(
      spliceGeneratedCommands(source, loadCliCommands()),
      "a generated region is stale relative to cli/src/cli.ts — run `npm run skills:sync`",
    ).toBe(source);
  });

  it("documents every user-facing command in SKILL.md, README.md, or docs/agents.md", () => {
    const docs = [
      readFileSync(skillPath, "utf8"),
      readFileSync(join(repoRoot, "README.md"), "utf8"),
      readFileSync(join(repoRoot, "docs/agents.md"), "utf8"),
    ].join("\n");
    const undocumented: string[] = [];
    for (const info of loadCliCommands()) {
      const name = info.path.join(" ");
      const reason = COMMAND_EXCLUSIONS[name];
      if (reason) continue;
      if (!new RegExp(`\\b${name.replaceAll("-", "\\-")}\\b`).test(docs)) {
        undocumented.push(name);
      }
    }
    expect(
      undocumented,
      "undocumented CLI commands: add them to a generated-commands region, the docs net, " +
        "or COMMAND_EXCLUSIONS in cli/src/skill-commands.ts (with a reason)",
    ).toEqual([]);
  });

  it("keeps every user-facing command INSIDE a generated region (task-generated-regions-coverage: coverage is not opt-in — description edits must feed a region mechanically)", () => {
    const source = readFileSync(skillPath, "utf8");
    const infos = loadCliCommands();
    // Render from the current source (not the file body) so the check reads the
    // same regions the sync writes — a stale-but-present region still counts.
    const regionBodies = [...spliceGeneratedCommands(source, infos).matchAll(REGION_RE)].map(
      (m) => m[2]!,
    );
    const outside: string[] = [];
    for (const info of infos) {
      const name = info.path.join(" ");
      if (COMMAND_EXCLUSIONS[name]) continue;
      const inRegion = regionBodies.some((body) =>
        new RegExp(`^arggon ${name.replaceAll("-", "\\-")}(?:\\s|$)`, "m").test(body),
      );
      if (!inRegion) outside.push(name);
    }
    expect(
      outside,
      "commands documented only in hand-written prose (their description edits never " +
        "regenerate anything): add them to a generated-commands filter in " +
        "skills/arggon-cli/SKILL.md and run `npm run skills:sync`, or exclude them in " +
        "COMMAND_EXCLUSIONS with a reason",
    ).toEqual([]);
  });

  it("renders region lines from the live .description() strings (sanity on the generator itself)", () => {
    const rendered = renderRegion(loadCliCommands(), "list,next");
    expect(rendered).toContain("arggon list  # List work items under the tracker root");
    expect(rendered).toMatch(/arggon next  # Suggest the next claimable leaf item/);
  });
});
