/**
 * Live docs ↔ shipped seam ids: retired-id drift guard
 * (bug-retired-agent-ids-in-doc-samples).
 *
 * The defect this pins. PR #762 re-measured the `doctor --agents` sample in
 * `ArggonManager/docs/json-output.md`, but the PLAIN `doctor` sample in the same
 * file still named `arggon-coordinator` / `arggon-reviewer` / `arggon-worker` —
 * three of the four ids ADR 0021 §6.2a′ retired on 2026-10-04 (PR #641). The
 * sample presents itself as what an initialized repo reports, so it taught
 * readers three agent files no seam materializes. Nothing failed: the
 * template-family walk added by `bug-adopter-engineering-template-software-locked`
 * sweeps `templates/docs/**` — what `arggon init` writes INTO an adopting tree —
 * and the repo's own `ArggonManager/docs/**` is not a template, so the retired
 * ids shipped green (the PR #762 verdict assigned this instance its own item).
 *
 * Why a sibling guard instead of extending the family walk. The two walks ask
 * different questions. The family walk asks what an adopting tree READS: every
 * template is rendered byte-for-byte into that tree's `AGENTS.md`, convention
 * and seam, so every template file must already restate the carriers. The repo's
 * docs tree answers a different question and mixes two kinds of file. Some are
 * LIVE — carriers, playbooks and the `--json` samples, which state what the
 * shipped CLI and seam are TODAY, and are pinned here. The rest are DATED
 * RECORDS — `adr/`, `explorations/`, `plans/`, `specs/` and tracker items —
 * which this repo supersedes rather than rewrites (ADR 0006/0007; the posture
 * `mcp-doc-contract.test.ts` and `adr-status-doc-contract.test.ts` state
 * explicitly). The records MUST keep the retired ids: ADR 0021 §6.2a′'s mapping
 * table IS the single source of the rename, and `spec-agent-rename-019` records
 * the migration as it was planned. Extending the family walk to
 * `ArggonManager/docs/**` wholesale would flag the record of the rename itself;
 * excluding the record subtrees inside it would make the family walk's own
 * definition ("every adopter template, whatever its extension") false. The
 * honest boundary is a sibling rule over the live docs, stated once.
 *
 * What this suite asserts, in two rules plus premise guards:
 *
 *   1. NO LIVE DOC NAMES A RETIRED ID. Every `.md` under `ArggonManager/docs/`
 *      except the four record subtrees, plus the two package-facing surfaces
 *      that restate the seam: `README.md` (the user-facing doc, inside
 *      `npm pack`'s allowlist; PR #762 repaired the same drift class in its
 *      README sample) and `skills/**` (`npm pack` ships the skill bundle, and
 *      `mcp-doc-contract.test.ts` already treats its references as part of the
 *      doc contract). The list is the exact four ids of ADR 0021 §6.2a′, never
 *      a word search: `arggon-standards-reviewer` does not contain
 *      `arggon-reviewer`, and `arggon-maker` not `arggon-worker`, so this fires
 *      on the ids themselves and nothing else.
 *   2. A SAMPLE'S AGENT ENUMERATION IS THE SHIPPED SET. Every fenced `json`
 *      block in a live doc that parses is read; an `opencode.artifacts.agents`
 *      array must equal, id for id and in order, the `.md` stems `arggon init`
 *      writes into `.opencode/agents/` (`templates/docs/opencode/agents/*.md`,
 *      the same directory `doctor` lists and sorts). This is the rule that
 *      makes the sample's claim checkable against the corpus instead of
 *      hand-typed: a retired id, an invented id, or a shipped id missing from
 *      the sample all fail. Rule 1 alone would catch only the first.
 *
 * Premise guards: the walk and the derived shipped set must not be vacuous, the
 * four record subtrees must exist on disk (so the exclusion cannot silently
 * become a no-op when a directory is renamed), every fenced `json` block must
 * parse (a sample that cannot be read cannot be checked), and the scanner is
 * exercised on the exact pre-fix sample text (so "clean" cannot mean "read
 * nothing", the move `adr-status-doc-contract.test.ts` makes for its scanner).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bundledTemplatesDir } from "./package-assets.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The retired agent ids of ADR 0021 §6.2a′ (`arggon-coordinator` →
 * `arggon-delivery-lead`, `arggon-worker` → `arggon-maker`,
 * `arggon-reviewer` → `arggon-standards-reviewer`, `arggon-prover` →
 * `arggon-verifier`). A live doc naming one names an id no seam materializes.
 */
const RETIRED_SEAM_IDS = [
  "arggon-coordinator",
  "arggon-worker",
  "arggon-prover",
  "arggon-reviewer",
];

/** Where `arggon init` writes the `.opencode` seam's agent files from. */
const SEAM_AGENT_TEMPLATE_DIR = join(bundledTemplatesDir(), "docs", "opencode", "agents");

/**
 * The methodology's dated records: what was true when written, superseded
 * rather than rewritten (ADR 0006/0007). They keep the retired ids on purpose —
 * ADR 0021 §6.2a′ IS the old → new mapping, and a record that quoted it would
 * otherwise have to rewrite itself.
 */
const RECORD_DIRS = ["adr", "explorations", "plans", "specs"];

/** The repo-root live doc: user-facing, and inside `npm pack`'s allowlist. */
const ROOT_DOCS = ["README.md"];

/** The shipped skill bundle: `npm pack` ships it, references and all. */
const SKILL_DOCS_ROOT = "skills";

/** Every `.md` under one root, as `<relPrefix><relative path>`, sorted. */
function markdownFiles(
  absDir: string,
  relPrefix: string,
  skipTopLevel: readonly string[],
): string[] {
  const found: string[] = [];
  const walk = (abs: string, rel: string): void => {
    for (const entry of readdirSync(abs).sort()) {
      const absEntry = join(abs, entry);
      const relEntry = rel === "" ? entry : `${rel}/${entry}`;
      if (statSync(absEntry).isDirectory()) {
        // The record subtrees are top-level under `ArggonManager/docs/`; a
        // nested directory of the same name would be walked, and the guard
        // would report it like any other live doc.
        if (rel === "" && skipTopLevel.includes(entry)) continue;
        walk(absEntry, relEntry);
        continue;
      }
      if (entry.endsWith(".md")) found.push(`${relPrefix}${relEntry}`);
    }
  };
  walk(absDir, "");
  return found;
}

/** Every live shipped `.md`, as repo-relative paths, sorted. */
function liveDocs(): string[] {
  return [
    ...markdownFiles(join(repoRoot, "ArggonManager", "docs"), "ArggonManager/docs/", RECORD_DIRS),
    ...markdownFiles(join(repoRoot, SKILL_DOCS_ROOT), `${SKILL_DOCS_ROOT}/`, []),
    ...ROOT_DOCS,
  ].sort();
}

/** One fenced code block: where it opens, its info string, and its body. */
interface FencedBlock {
  path: string;
  line: number;
  lang: string;
  code: string;
}

/**
 * Every fenced code block in one file, in document order. The closer must carry
 * at least as many backticks as the opener, so a nested fence inside a longer
 * outer fence cannot end the block early.
 */
function fencedBlocks(path: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  let open: { line: number; lang: string; fence: number; body: string[] } | null = null;
  for (const [index, line] of readFileSync(join(repoRoot, path), "utf8").split("\n").entries()) {
    if (open === null) {
      const opener = /^\s*(`{3,})\s*([A-Za-z0-9_+-]*)\s*$/.exec(line);
      if (opener) {
        open = { line: index + 1, lang: opener[2] ?? "", fence: opener[1]!.length, body: [] };
      }
      continue;
    }
    const closer = /^\s*(`{3,})\s*$/.exec(line);
    if (closer && closer[1]!.length >= open.fence) {
      blocks.push({ path, line: open.line, lang: open.lang, code: open.body.join("\n") });
      open = null;
      continue;
    }
    open.body.push(line);
  }
  return blocks;
}

/**
 * The `.md` stems `arggon init` writes into `.opencode/agents/`, sorted — the
 * same corpus `doctor`'s `opencode.artifacts.agents` reads off a disk. Derived
 * from the shipped templates, never hand-typed, so a renamed or added seam
 * agent moves this list with it.
 */
function shippedSeamAgentIds(): string[] {
  return readdirSync(SEAM_AGENT_TEMPLATE_DIR)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => entry.slice(0, -".md".length))
    .sort();
}

/** The `opencode.artifacts.agents` enumerations of every live doc's json samples. */
function agentEnumerations(): Array<{ path: string; line: number; ids: unknown[] }> {
  const found: Array<{ path: string; line: number; ids: unknown[] }> = [];
  for (const path of liveDocs()) {
    for (const block of fencedBlocks(path)) {
      if (block.lang !== "json") continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(block.code);
      } catch {
        continue; // reported by the parse premise guard below
      }
      const ids = (parsed as { opencode?: { artifacts?: { agents?: unknown } } })?.opencode
        ?.artifacts?.agents;
      if (Array.isArray(ids)) found.push({ path, line: block.line, ids });
    }
  }
  return found;
}

describe("live shipped docs name only shipped seam ids", () => {
  const docs = liveDocs();

  it("walks the live docs, and the dated record subtrees are excluded on purpose", () => {
    // A vacuous walk would make every clause below pass for free.
    expect(docs.length).toBeGreaterThan(10);
    expect(docs).toContain("ArggonManager/docs/json-output.md");
    expect(docs).toContain("README.md");
    expect(docs).toContain("skills/arggon-cli/references/orchestration.md");
    for (const dir of RECORD_DIRS) {
      // The exclusion above is only honest while the directory it names is
      // real; a rename would otherwise silently widen the walk.
      expect(existsSync(join(repoRoot, "ArggonManager", "docs", dir)), `${dir} must exist`).toBe(
        true,
      );
      expect(
        docs.some((path) => path.startsWith(`ArggonManager/docs/${dir}/`)),
        `${dir}/ must stay outside the live-doc walk`,
      ).toBe(false);
    }
  });

  it("no live doc names a retired seam id", () => {
    const failures: string[] = [];
    for (const path of docs) {
      const text = readFileSync(join(repoRoot, path), "utf8");
      for (const id of RETIRED_SEAM_IDS) {
        if (text.includes(id)) {
          failures.push(
            `${path}: names the retired agent id "${id}" (ADR 0021 §6.2a′) — ` +
              "restate it at the shipped id; the old → new mapping lives in the dated record",
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("every fenced json block parses, so a sample cannot dodge the rules by not being readable", () => {
    const failures: string[] = [];
    for (const path of docs) {
      for (const block of fencedBlocks(path)) {
        if (block.lang !== "json") continue;
        try {
          JSON.parse(block.code);
        } catch (error) {
          failures.push(
            `${path}:${block.line}: fenced json block does not parse — ` +
              (error instanceof Error ? error.message : String(error)),
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("every sample enumeration of opencode.artifacts.agents is exactly the shipped seam set", () => {
    const shipped = shippedSeamAgentIds();
    // Non-vacuous derivation: the seam ships agent files and the walk found
    // them. The seam ships more than one role (delivery lead, maker, reviewer,
    // verifier); a single entry would mean the templates moved, not shrank.
    expect(shipped.length).toBeGreaterThan(1);

    const found = agentEnumerations();
    // The plain `doctor` sample is the one this suite exists for; if no sample
    // carries the enumeration the rule below has nothing to hold, so absence
    // fails here instead of passing vacuously.
    expect(found.length).toBeGreaterThan(0);
    for (const entry of found) {
      // The expectation carries the corpus-derived list, so a failure reads
      // "this sample names ids the seam does not ship".
      expect(entry.ids, `${entry.path}:${entry.line}`).toEqual(shipped);
    }
  });

  it("the retired-id check fires on the exact pre-fix sample and collides with no shipped id", () => {
    // The control is the pre-fix bytes from `json-output.md:857` (the PR #762
    // verdict's instance). A clean run must never mean "the scanner read
    // nothing": this exact text has to produce the three retired ids.
    const preFix = `      "agents": ["arggon-coordinator", "arggon-reviewer", "arggon-worker"],`;
    expect(RETIRED_SEAM_IDS.filter((id) => preFix.includes(id))).toEqual([
      "arggon-coordinator",
      "arggon-worker",
      "arggon-reviewer",
    ]);
    // The other direction: no shipped id contains a retired id as a substring,
    // so the check cannot be satisfied by an id overlap. `arggon-standards-reviewer`
    // ends in `-reviewer`, but never in `arggon-reviewer`.
    for (const shippedId of shippedSeamAgentIds()) {
      for (const retiredId of RETIRED_SEAM_IDS) {
        expect(
          shippedId.includes(retiredId),
          `shipped "${shippedId}" must not contain retired "${retiredId}"`,
        ).toBe(false);
      }
    }
  });
});
