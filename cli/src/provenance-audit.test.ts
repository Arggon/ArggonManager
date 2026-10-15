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
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  readGeneratedProjectName,
  readGeneratedState,
  updateGeneratedSection,
  type GeneratedEntry,
} from "@arggondev/lib";
import {
  BUNDLED_SKILLS,
  auditGeneratedProvenance,
  checksumOf,
  currentGeneratedTemplates,
  generatedMarker,
  generatedYamlMarker,
  readGeneratedMarker,
  renderGeneratedDoc,
} from "./docs.js";
import { runInit } from "./init.js";
import { syncBundledSkills } from "./sync-skills.js";

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
    updateGeneratedSection(
      readFileSync(path, "utf8"),
      generated,
      readGeneratedProjectName(dir) ?? undefined,
    ),
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

/**
 * The marker reader the class check is built on: anchored exactly like
 * `stampGeneratedContent` writes the marker, so provenance is read from the
 * file head only and a phrase in a body is never a claim.
 */
describe("provenance marker reader", () => {
  it("reads each shape stampGeneratedContent writes", () => {
    expect(readGeneratedMarker(`${generatedMarker("AGENTS.md")}\n# x\n`)).toBe("AGENTS.md");
    expect(
      readGeneratedMarker(`${generatedYamlMarker("github/workflows/arggon.yml")}\nname: x\n`),
    ).toBe("github/workflows/arggon.yml");
    expect(
      readGeneratedMarker(`// arggon:generated template="opencode/plugins/arggon/index.ts"\n`),
    ).toBe("opencode/plugins/arggon/index.ts");
    // Frontmatter destinations take the marker INSIDE the frontmatter.
    expect(
      readGeneratedMarker(
        `---\n# arggon:generated template="opencode/agents/x.md"\nmode: subagent\n`,
      ),
    ).toBe("opencode/agents/x.md");
  });

  it("tolerates CRLF and a BOM, and never trusts the phrase below the head", () => {
    expect(readGeneratedMarker(`\uFEFF${generatedMarker("AGENTS.md")}\r\n# x\r\n`)).toBe(
      "AGENTS.md",
    );
    expect(
      readGeneratedMarker('---\r\n# arggon:generated template="opencode/agents/x.md"\r\n'),
    ).toBe("opencode/agents/x.md");
    expect(
      readGeneratedMarker("description: mine\ndocs say <!-- arggon:generated -->\n"),
    ).toBeNull();
    expect(readGeneratedMarker("# ordinary markdown\n")).toBeNull();
    expect(readGeneratedMarker("")).toBeNull();
  });
});

/**
 * The false-absence class (bug-prover-agent-has-no-x-generated-entry).
 *
 * The defect this pins: `.opencode/agents/arggon-prover.md` was committed with
 * the visible generated marker but with NO `x-generated` entry, so init
 * classified it adopter-modified and skipped it — and a walk over the CURRENT
 * destinations could not see it either once its template left the install.
 * Both enforcement layers were blind to a file that self-declares as generated
 * content. The class fix reports the SHAPE, not this instance: any file under a
 * managed path whose own marker claims arggon provenance but which has no row.
 *
 * The deliberate non-findings pin the boundary: an adopter-owned file with no
 * marker and no row is init behaving correctly (the pre-provenance adopter
 * file), and a marker-bearing file WITH a row is ordinary adopter content, not
 * a false absence.
 */
describe("provenance audit: unprovenanced managed files", () => {
  /** The stranded shape: marker + no row + a template the install no longer ships. */
  function strand(dir: string, dest: string, marker: string, body: string): void {
    const abs = join(dir, ...dest.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `${marker}\n${body}`, "utf8");
  }

  it("reports a stranded marker file under a managed path with no row", () => {
    const dir = scaffold();
    const dest = ".opencode/agents/arggon-prover.md";
    const template = "opencode/agents/arggon-prover.md";
    // Precondition, asserted rather than assumed: the byte rule cannot see this
    // file — the current template walk no longer owns its destination, and no
    // ledger row exists. It is exactly the shape the item was filed for.
    expect(currentGeneratedTemplates().some((d) => d.dest === dest)).toBe(false);
    expect(stateEntries(dir)[dest]).toBeUndefined();
    strand(dir, dest, generatedYamlMarker(template), "description: stranded\n");

    const hit = auditGeneratedProvenance({ root: dir, templatesDir, full: true }).find(
      (v) => v.dest === dest,
    );
    expect(hit).toBeDefined();
    expect(hit!.kind).toBe("unprovenanced");
    expect(hit!.template).toBe(template);
    expect(hit!.reason).toContain("no x-generated entry");
  });

  it("reports a marker file in a nested managed namespace (frontmatter and HTML shapes)", () => {
    const dir = scaffold();
    const nested = "ArggonManager/docs/runbooks/stranded-runbook.md";
    strand(dir, nested, generatedMarker("docs/runbooks/stranded-runbook.md"), "# Stranded\n");
    const hits = auditGeneratedProvenance({ root: dir, templatesDir, full: true });
    expect(hits.map((v) => [v.kind, v.dest])).toEqual([["unprovenanced", nested]]);
  });

  it("never reports an adopter-owned managed file (no marker, no row)", () => {
    const dir = scaffold();
    // The sanctioned pre-provenance adopter file: init is RIGHT to skip it, and
    // a path-only check would false-positive here.
    strand(dir, ".opencode/agents/my-own-agent.md", "", "description: mine\n");
    // The marker phrase in a BODY is not provenance: the anchored read only
    // trusts the file head.
    strand(
      dir,
      ".opencode/agents/mentions-marker.md",
      "description: mine",
      "docs say <!-- arggon:generated -->",
    );
    expect(auditGeneratedProvenance({ root: dir, templatesDir, full: true })).toEqual([]);
  });

  it("never reports a marker file that has a row, even when its bytes diverge", () => {
    const dir = scaffold();
    // AGENTS.md carries a row and a marker; a hand edit keeps the marker and
    // diverges from the render. It has a row, so it is not a false absence —
    // and the byte rule stays silent because the bytes are adopter content.
    appendFileSync(join(dir, "AGENTS.md"), "\nMY ADOPTER EDIT\n", "utf8");
    expect(auditGeneratedProvenance({ root: dir, templatesDir, full: true })).toEqual([]);
  });

  it("reports a marker file whose row was dropped, independent of the byte rule", () => {
    const dir = scaffold();
    const generated = stateEntries(dir);
    delete generated["CONTRIBUTING.md"];
    writeState(dir, generated);
    // Keep the marker, diverge the bytes: the byte rule stays silent (adopter
    // content, and no row to compare), so only the class check can name it.
    appendFileSync(join(dir, "CONTRIBUTING.md"), "\nMY EDIT\n", "utf8");
    const violations = auditGeneratedProvenance({ root: dir, templatesDir, full: true });
    expect(violations.map((v) => [v.kind, v.dest])).toEqual([["unprovenanced", "CONTRIBUTING.md"]]);
  });
});

/**
 * Derived bundled-skill rows (bug-skill-source-edit-leaves-ledger-stale).
 *
 * The skill copies are gitignored in the seam repo (single committed source),
 * so a fresh checkout — and therefore CI — has NO copy for the byte rule above
 * to compare a row against: that is how a source edit (`json-contract.md` after
 * #751, `exploration.md` after #771) left the ledger stale, red only in local
 * checkouts. This block pins the two halves of the fix:
 *
 *  - a skill row is DERIVABLE from the committed source, so a stale row fails
 *    the audit even with no copy on disk — the CI surface the byte rule could
 *    not reach;
 *  - `skills:sync` re-records the row it regenerates, so the remedy is the
 *    writer, never a hand-edited ledger. The recorded checksum is always the
 *    SOURCE render, never read back from the destination, so a hand edit of a
 *    copy can never be blessed as generated — and the seam's version stamp
 *    (the drift gate's input) is never moved by a per-checkout copy.
 */
describe("provenance audit: derived bundled-skill rows", () => {
  /**
   * A seam-shaped fixture: the real committed skill sources, their ledger rows,
   * and NO copies (the fresh-checkout/CI shape). Sources are copied rather than
   * synthesized so the real render pipeline is exercised.
   */
  function skillFixture(): string {
    const dir = mkdtempSync(join(tmpdir(), "arggon-skill-derived-"));
    cpSync(join(repoRoot, "skills"), join(dir, "skills"), { recursive: true });
    // The bundle boundary `renderGeneratedDoc` resolves as `<templatesDir>/../skills`.
    mkdirSync(join(dir, "templates"), { recursive: true });
    const rows: Record<string, GeneratedEntry> = {};
    for (const { source, dest } of BUNDLED_SKILLS) {
      rows[dest] = {
        template: source,
        checksum: checksumOf(renderSkill(dir, source, dest)),
        // Two distinct stamps so the inheritance rule below has a "newest".
        arggonVersion: dest.includes("arggon-upgrade") ? "0.7.0" : "0.5.0",
        generatedAt: "2026-01-01T00:00:00.000Z",
      };
    }
    const statePath = join(dir, ...STATE_REL.split("/"));
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, updateGeneratedSection("version: 5\n", rows, "Fixture"), "utf8");
    return dir;
  }

  /** The generator's render of one bundled skill copy, in the fixture's own bundle. */
  function renderSkill(dir: string, source: string, dest: string): string {
    const rendered = renderGeneratedDoc({
      templatesDir: join(dir, "templates"),
      root: dir,
      template: source,
      dest,
      projectName: "Fixture",
    });
    if (rendered === null) throw new Error(`no render for ${source}`);
    return rendered;
  }

  function auditFixture(dir: string): ReturnType<typeof auditGeneratedProvenance> {
    return auditGeneratedProvenance({
      root: dir,
      templatesDir: join(dir, "templates"),
      full: true,
    });
  }

  it("flags a row left stale by a source edit with no copy on disk, and skills:sync repairs it", () => {
    const dir = skillFixture();
    const source = "skills/arggon-cli/references/pitfalls.md";
    const dest = ".agents/skills/arggon-cli/references/pitfalls.md";
    // The CI shape, asserted rather than assumed: the copies are gitignored, so
    // a fresh checkout has none of them.
    expect(existsSync(join(dir, ...dest.split("/")))).toBe(false);
    expect(auditFixture(dir)).toEqual([]);

    // The recurrence: a source edit lands while the row keeps describing the
    // previous revision.
    appendFileSync(join(dir, ...source.split("/")), "\n- a new pitfall\n", "utf8");
    expect(auditFixture(dir).map((v) => [v.kind, v.dest])).toEqual([
      ["stale-derived-checksum", dest],
    ]);

    // The repair: the writer that materializes the copy re-records the row —
    // no hand-edited ledger.
    syncBundledSkills(dir);
    expect(auditFixture(dir)).toEqual([]);
    const row = readGeneratedState(dir)[dest]!;
    expect(row.template).toBe(source);
    expect(row.checksum).toBe(checksumOf(renderSkill(dir, source, dest)));
  });

  it("never blesses a hand edit of a copy: the row tracks the source render, not the destination", () => {
    const dir = skillFixture();
    const source = "skills/arggon-cli/references/orchestration.md";
    const dest = ".agents/skills/arggon-cli/references/orchestration.md";
    const copyPath = join(dir, ...dest.split("/"));
    const sourceBytes = readFileSync(join(dir, ...source.split("/")), "utf8");
    mkdirSync(dirname(copyPath), { recursive: true });
    writeFileSync(copyPath, `${generatedMarker(source)}\n${sourceBytes}\nMY HAND EDIT\n`, "utf8");
    const render = renderSkill(dir, source, dest);

    // init skipping an edited copy is correct, so the audit stays silent about
    // those bytes — and the row is not chased to describe them: it still is the
    // source render, so the edit never reaches the ledger.
    expect(auditFixture(dir)).toEqual([]);
    expect(readGeneratedState(dir)[dest]!.checksum).toBe(checksumOf(render));
    expect(checksumOf(readFileSync(copyPath, "utf8"))).not.toBe(checksumOf(render));

    // The sanctioned writer regenerates from the source: the edit is overwritten
    // because the copy is derived, never because the ledger recorded it.
    syncBundledSkills(dir);
    expect(readFileSync(copyPath, "utf8")).toBe(
      `${generatedMarker(source)}\n${readFileSync(join(dir, ...source.split("/")), "utf8")}`,
    );
    expect(readGeneratedState(dir)[dest]!.checksum).toBe(
      checksumOf(readFileSync(copyPath, "utf8")),
    );
  });

  it("never advances the seam version stamp, and leaves unchanged rows byte-identical", () => {
    const dir = skillFixture();
    const statePath = join(dir, ...STATE_REL.split("/"));
    const source = "skills/arggon-cli/references/methodology.md";
    const dest = ".agents/skills/arggon-cli/references/methodology.md";

    // A merge that dropped the row, plus a source edit: the writer recreates it
    // from the source render and inherits the state's newest stamp. The stamp is
    // the drift gate's input (release.md §"The re-pin"), and a gitignored
    // per-checkout copy must never move it.
    appendFileSync(join(dir, ...source.split("/")), "\nnew step\n", "utf8");
    const rows = readGeneratedState(dir);
    delete rows[dest];
    writeFileSync(
      statePath,
      updateGeneratedSection(readFileSync(statePath, "utf8"), rows, "Fixture"),
      "utf8",
    );
    syncBundledSkills(dir);
    expect(readGeneratedState(dir)[dest]!.arggonVersion).toBe("0.7.0");

    // Idempotent: a second run with nothing changed leaves the state untouched.
    const before = readFileSync(statePath, "utf8");
    syncBundledSkills(dir);
    expect(readFileSync(statePath, "utf8")).toBe(before);
  });

  it("leaves acknowledged rows and an unparseable ledger alone", () => {
    const dir = skillFixture();
    const statePath = join(dir, ...STATE_REL.split("/"));
    const source = "skills/arggon-cli/references/exploration.md";
    const dest = ".agents/skills/arggon-cli/references/exploration.md";
    appendFileSync(join(dir, ...source.split("/")), "\nsource moved on\n", "utf8");

    // `adopt --ack` re-baselines a row from the adopter's bytes: it is an
    // ownership statement, so the writer must not re-point it at the render.
    const acked = readGeneratedState(dir);
    acked[dest] = { ...acked[dest]!, checksum: `sha256:${"1".repeat(64)}`, acknowledged: true };
    writeFileSync(
      statePath,
      updateGeneratedSection(readFileSync(statePath, "utf8"), acked, "Fixture"),
      "utf8",
    );
    syncBundledSkills(dir);
    expect(readGeneratedState(dir)[dest]).toMatchObject({
      checksum: `sha256:${"1".repeat(64)}`,
      acknowledged: true,
    });

    // A ledger this script cannot parse is `arggon init`'s repair: writing a
    // fresh section from the tolerant reader's empty result would delete the
    // rows it could not read. The source edit below WOULD be recorded, so the
    // untouched bytes prove the parse guard, not an idle run.
    appendFileSync(join(dir, "skills/arggon-cli/references/methodology.md"), "\nmore\n", "utf8");
    const broken = `${readFileSync(statePath, "utf8")}x-tracker: {auto-commit: false}\n`;
    writeFileSync(statePath, broken, "utf8");
    syncBundledSkills(dir);
    expect(readFileSync(statePath, "utf8")).toBe(broken);
  });
});
