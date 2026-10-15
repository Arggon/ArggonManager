import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readConventionConfig,
  readGeneratedProjectName,
  trackerAt,
  updateGeneratedSection,
  type GeneratedEntry,
} from "@arggondev/lib";
import {
  BUNDLED_SKILLS,
  arggonVersion,
  checksumOf,
  claudeBundleSkillStagingPath,
  compareArggonVersions,
  generatedMarker,
} from "./docs.js";
import { loadCliCommands, spliceGeneratedCommands } from "./skill-commands.js";

// task-adr0006-docs-budget: .agents/skills/arggon-cli/SKILL.md is a generated
// copy of skills/arggon-cli/SKILL.md (gitignored — single committed source).
// Run via `npm run skills:sync` after cloning or editing the source so local
// dev and skill-reading agent clients always see the file on disk. The
// parity test (cli/src/skill-copy.test.ts) regenerates it when missing too,
// so CI never masks drift.
//
// task-opencode2-methodology (W5): the arggon-cli skill ships as an umbrella
// (`SKILL.md`) plus `references/`; every file in BUNDLED_SKILLS is copied with
// its generated marker, exactly like init bundles it into adopter trees.
//
// task-skill-generated-command-reference: the pipeline first splices the
// `arggon:generated-commands` marker regions of the source SKILL with lines
// rendered from live CLI introspection (cli/src/skill-commands.ts), then
// writes the copy — so the committed source itself carries the fresh region.
// Reference files carry no regions; splice is a no-op for them.
//
// bug-skill-source-edit-leaves-ledger-stale: the copy write and the provenance
// record are ONE operation. Before this, the script wrote the copy and left the
// `x-generated` row describing the previous source revision, so every checkout
// that had the copy on disk failed the provenance audit after a source edit
// while CI (copies absent, gitignored) stayed green. The row is refreshed from
// the SAME source-derived bytes that are written — never read back from the
// destination — so a hand edit of a copy can never be recorded as generated.
//
// task-claude-plugin-seam (spec-claude-code-adapter-024): the Claude Code
// bundle vendors the same skill as a THIRD copy, and it is a TRACKED template
// (`templates/docs/claude/arggon/skills/arggon-cli/**`, materialized into
// `.claude-marketplace/arggon/skills/arggon-cli/**` by `init`). One skill, two
// destinations: this script writes the staging copy too — byte-equal to the
// source and marker-less, because the `arggon:generated` marker is `init`'s to
// stamp on every template it renders. There is no `x-generated` row for a
// template path; the destination row is written by `init` when it materializes
// the plugin in an adopter tree.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Materialize every bundled skill copy from its single committed source and
 * re-record each destination's `x-generated` row (bug-skill-source-edit-
 * leaves-ledger-stale). Returns the number of files synced.
 *
 * The version stamp is PRESERVED, never bumped: a row created by this script
 * inherits the state's newest recorded stamp, and an existing row keeps its
 * own. The stamp is the CI drift gate's input, and only committed seam bytes
 * may move it — a stamp newer than `ARGGON_VERSION` is a re-pin request, not a
 * bookkeeping edit (release.md §"The re-pin"). A gitignored per-checkout copy
 * is not committed seam content, so this script must never move it.
 *
 * Idempotent: when the checksum and template already match, the row (including
 * `generatedAt`) is left byte-identical, so a no-op sync leaves no churn.
 * Trees without a tracker state file get the copies only (markers still
 * stamped; there is no ledger to record into).
 */
export function syncBundledSkills(root: string = repoRoot): number {
  const commands = loadCliCommands();
  const statePath = trackerAt(root)?.conventionPath ?? null;
  // The ledger is only extendable when it PARSES. `readGeneratedState` is the
  // tolerant reader (a malformed file reads as {}), and writing a fresh section
  // from that empty read would replace the rows the reader could not parse —
  // destroying the very bookkeeping this script exists to keep honest. A state
  // this script cannot read is `arggon init`'s repair, not ours.
  const prevState: Record<string, GeneratedEntry> | null = (() => {
    if (statePath === null || !existsSync(statePath)) return null;
    try {
      return readConventionConfig(root).generated;
    } catch {
      console.warn(
        `skills:sync: ${statePath} is unreadable or unparseable — copies written, ` +
          `provenance rows left untouched (run \`arggon init\` to repair the state)`,
      );
      return null;
    }
  })();
  const nextState: Record<string, GeneratedEntry> = { ...prevState };
  // The newest stamp already in the state: what a row created here inherits so
  // the script cannot advance the seam's version. `arggonVersion()` only ever
  // applies to a state with no stamps at all (never true for an initialized
  // tree, which is the only tree that has a state file).
  const inheritedVersion = (() => {
    let newest: string | null = null;
    for (const entry of Object.values(prevState ?? {})) {
      if (typeof entry.arggonVersion !== "string" || entry.arggonVersion === "") continue;
      if (newest === null || (compareArggonVersions(entry.arggonVersion, newest) ?? -1) > 0) {
        newest = entry.arggonVersion;
      }
    }
    return newest ?? arggonVersion();
  })();
  let recorded = false;

  for (const { source, dest } of BUNDLED_SKILLS) {
    const sourcePath = join(root, ...source.split("/"));
    const copyPath = join(root, ...dest.split("/"));
    const spliced = spliceGeneratedCommands(readFileSync(sourcePath, "utf8"), commands);
    writeFileSync(sourcePath, spliced);
    mkdirSync(dirname(copyPath), { recursive: true });
    const bytes = `${generatedMarker(source)}\n${spliced}`;
    writeFileSync(copyPath, bytes);
    // The Claude bundle's staging copy (task-claude-plugin-seam): the same
    // source bytes, marker-less, inside the committed template subtree the
    // plugin is generated from. Written from the SAME `spliced` bytes as the
    // `.agents` copy above, so the two destinations can never disagree about
    // what the skill says.
    const stagingDest = claudeBundleSkillStagingPath(source);
    if (stagingDest !== null) {
      const stagingPath = join(root, ...stagingDest.split("/"));
      mkdirSync(dirname(stagingPath), { recursive: true });
      writeFileSync(stagingPath, spliced);
    }
    if (prevState === null) continue;
    const prev = prevState[dest];
    // An acknowledged row is an OWNERSHIP statement (`arggon adopt --ack`
    // re-baselined it from the adopter's bytes), not a generation record: this
    // script must never re-point it at the source render. The copy write above
    // is still its documented job (the source is the truth).
    if (prev?.acknowledged === true) continue;
    const checksum = checksumOf(bytes);
    if (prev?.checksum === checksum && prev.template === source) continue; // no churn
    nextState[dest] = {
      template: source,
      checksum,
      arggonVersion: prev?.arggonVersion ?? inheritedVersion,
      generatedAt: new Date().toISOString(),
    };
    recorded = true;
  }

  if (recorded && statePath !== null && prevState !== null) {
    writeFileSync(
      statePath,
      updateGeneratedSection(
        readFileSync(statePath, "utf8"),
        nextState,
        readGeneratedProjectName(root) ?? undefined,
      ),
    );
  }
  return BUNDLED_SKILLS.length;
}

// Direct invocation (`npm run skills:sync`) vs. import by tests: the guard
// keeps the script side-effect-free on import.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = syncBundledSkills();
  console.log(`synced ${count} bundled skill file(s) from their single sources`);
}
