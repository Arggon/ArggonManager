/**
 * Provenance-ledger audit (bug-stale-x-generated-records-goal-mode-seam-pair).
 *
 * The defect this pins: `ArggonManager/.convention.yml` lost the `x-generated`
 * records for the goal-mode seam pair (`.zcode-marketplace/arggon/commands/
 * arggon-goal.md`, `.zcode-marketplace/arggon/templates/goal-mode.md`) in the
 * agent-rename seam regen (0d1571e0, whose branch predated the goal-mode
 * merge), while the committed copies themselves stayed byte-synced with their
 * templates. Every existing gate stayed green: the CI drift gate compares the
 * committed copies against the generator's output and deliberately excludes
 * the state file, so nothing noticed that `init` now classifies both files
 * adopter-modified and silently refuses to propagate the next template edit
 * to them. The audit (`auditGeneratedProvenance`, cli/src/docs.ts) closes
 * exactly that hole: a committed copy that is byte-identical to the current
 * generator render must carry a matching `x-generated` record.
 *
 * Two surfaces, one rule:
 *  - the repo-self block runs the audit against THIS checkout on every test
 *    run (CI's unit lane), so a template edit that regenerates copies without
 *    the records — or a merge that drops records — cannot land green;
 *  - the fixture blocks prove the rule fires on deliberately stale and
 *    deliberately missing records, and stays silent on the states init is
 *    RIGHT to skip (adopter edits, acknowledged baselines, vendored plugin
 *    artifacts).
 */
import { mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { readGeneratedProjectName, readGeneratedState, updateGeneratedSection, type GeneratedEntry } from "@arggondev/lib";
import { auditGeneratedProvenance, renderGeneratedDoc } from "./docs.js";
import { runInit } from "./init.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const templatesDir = join(repoRoot, "templates");
const STATE_REL = "ArggonManager/.convention.yml";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

/** A real init tree (state file + every generated doc), as an adopter gets it. */
function scaffold(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-provenance-audit-"));
  runInit({ dir, force: false, full: true });
  return dir;
}

/** The fixture's x-generated entries, copied so tests can edit them surgically. */
function stateEntries(dir: string): Record<string, GeneratedEntry> {
  return structuredClone(readGeneratedState(dir));
}

/** Rewrite the fixture's x-generated section with the given entries. */
function writeState(dir: string, generated: Record<string, GeneratedEntry>): void {
  const path = join(dir, ...STATE_REL.split("/"));
  writeFileSync(
    path,
    updateGeneratedSection(readFileSync(path, "utf8"), generated, readGeneratedProjectName(dir) ?? undefined),
    "utf8",
  );
}

describe("provenance audit: records vs committed seam bytes", () => {
  it("fires on a deliberately stale record (checksum no longer matches generator bytes)", () => {
    const dir = scaffold();
    // Precondition: the committed copy IS the current generator output.
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toBe(
      renderGeneratedDoc({
        templatesDir,
        root: dir,
        template: "docs/AGENTS.md",
        dest: "AGENTS.md",
        projectName: readGeneratedProjectName(dir),
      }),
    );
    // The deliberate staleness: same entry, checksum pointing somewhere else —
    // exactly what a merge that keeps one side's ledger over the other's
    // bytes produces.
    const generated = stateEntries(dir);
    generated["AGENTS.md"]!.checksum = `sha256:${"0".repeat(64)}`;
    writeState(dir, generated);
    const violations = auditGeneratedProvenance({ root: dir, templatesDir, full: true });
    const hit = violations.find((v) => v.dest === "AGENTS.md");
    expect(hit).toBeDefined();
    expect(hit!.kind).toBe("stale-checksum");
    expect(hit!.reason).toContain("silently stops propagating template edits");
  });

  it("fires on a missing record (generator bytes on disk with no x-generated entry)", () => {
    const dir = scaffold();
    // The goal-mode failure shape: the copy is byte-synced but the ledger row
    // is gone (init reads it as a pre-provenance adopter file).
    const generated = stateEntries(dir);
    delete generated[".editorconfig"];
    writeState(dir, generated);
    const violations = auditGeneratedProvenance({ root: dir, templatesDir, full: true });
    const hit = violations.find((v) => v.dest === ".editorconfig");
    expect(hit).toBeDefined();
    expect(hit!.kind).toBe("missing-record");
    expect(hit!.template).toBe("docs/editorconfig");
  });

  it("does not flag adopter-edited bytes even when the record is stale", () => {
    const dir = scaffold();
    const generated = stateEntries(dir);
    generated["AGENTS.md"]!.checksum = `sha256:${"0".repeat(64)}`;
    writeState(dir, generated);
    // A real adopter edit: the bytes stop being generator output. init's skip
    // is then CORRECT, and the audit must stay silent about it.
    writeFileSync(join(dir, "AGENTS.md"), "MY ADOPTER EDIT\n", "utf8");
    const violations = auditGeneratedProvenance({ root: dir, templatesDir, full: true });
    expect(violations.find((v) => v.dest === "AGENTS.md")).toBeUndefined();
  });

  it("does not flag acknowledged entries (sanctioned divergence)", () => {
    const dir = scaffold();
    const generated = stateEntries(dir);
    generated["AGENTS.md"]!.checksum = `sha256:${"0".repeat(64)}`;
    generated["AGENTS.md"]!.acknowledged = true;
    writeState(dir, generated);
    const violations = auditGeneratedProvenance({ root: dir, templatesDir, full: true });
    expect(violations.find((v) => v.dest === "AGENTS.md")).toBeUndefined();
  });

  it("does not flag vendored plugin artifacts (per-checkout bytes)", () => {
    const dir = scaffold();
    const dest = ".opencode/plugins/arggon/index.ts";
    const generated = stateEntries(dir);
    generated[dest]!.checksum = `sha256:${"0".repeat(64)}`;
    writeState(dir, generated);
    const violations = auditGeneratedProvenance({ root: dir, templatesDir, full: true });
    expect(violations.find((v) => v.dest === dest)).toBeUndefined();
  });

  it("this repo's own committed seam has no ledger violations", () => {
    // The gate a template edit cannot skip: CI's unit lane runs this on every
    // PR against the live checkout. It failed before the repair in this item —
    // the goal-mode pair (records dropped by 0d1571e0) and the stale
    // `.opencode/commands/arggon-explore.md` record were exactly these rows.
    const violations = auditGeneratedProvenance({ root: repoRoot, templatesDir, full: true });
    expect(violations).toEqual([]);
  });
});
