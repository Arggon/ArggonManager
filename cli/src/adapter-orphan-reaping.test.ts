/**
 * Orphan detection and guarded reaping (task-adapter-orphan-reaping;
 * spec-agent-rename-019 §The precondition, AC 4-AC 8).
 *
 * The hazard: `arggon init` never deletes, so a template that leaves the install
 * leaves its destination behind — and under an auto-discovered seam directory
 * (`.opencode/agents/`) the stranded file is still DISPATCHABLE. That is what
 * makes the agent rename unsafe, and it is what these tests pin:
 *
 *   - an orphan is detectable with NO new data (the recorded `template:` is
 *     absent from this version's set), so the classifier is exercised directly;
 *   - `doctor --agents` reports `orphaned` with the per-file remedy, and names
 *     what `init` would do;
 *   - `init` removes an orphan ONLY when it is byte-identical to what was
 *     generated, and reports every refusal with its reason;
 *   - the safety vetoes (outside the repo, not recorded, directory, symlink,
 *     downgrade) each hold end-to-end, not just in the classifier;
 *   - `--dry-run` previews without writing, and a second run is a no-op.
 *
 * The scenario fixtures remove templates from a MUTABLE COPY of the installed
 * package (`installedPackage()`), which is exactly what a version bump does to
 * an adopter tree — so no production path needs a test-only switch beyond the
 * `templatesDir` injection point the planner already documents.
 */
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readGeneratedState } from "@arggondev/lib";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareArggonVersions,
  planGenerateDocs,
  planOrphanReaps,
  type OrphanReapDecision,
} from "./docs.js";
import { dryRunInit, runInit } from "./init.js";
import { formatDoctorReport, runDoctor, type DoctorAdapters } from "./doctor.js";
import { runCli } from "./test-spawn.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tempDir(): string {
  const dir = _mkdtempSync(join(tmpdir(), "arggon-orphan-"));
  tmpDirs.push(dir);
  return dir;
}

/**
 * A mutable copy of the INSTALLED package: `templates/` plus the two sibling
 * trees the bundled sources resolve from (`skills/`, `opencode/` — the layout
 * `renderGeneratedDoc`/`planGenerateDocs` expect around `templatesDir/..`).
 * Removing a file from `templates/docs/**` is what a version bump does when a
 * template is renamed or dropped.
 */
function installedPackage(): string {
  const root = tempDir();
  for (const tree of ["templates", "skills", "opencode"]) {
    cpSync(resolve(repoRoot, tree), join(root, tree), { recursive: true });
  }
  return join(root, "templates");
}

/** Drop a template from the "installed" package (package-root relative). */
function dropTemplate(templates: string, templateRel: string): void {
  const abs = join(templates, ...templateRel.split("/"));
  expect(existsSync(abs), `${templateRel} must exist before it is dropped`).toBe(true);
  rmSync(abs);
}

function existsIn(root: string, rel: string): boolean {
  return existsSync(join(root, ...rel.split("/")));
}

/** Initialize a tree from a given "installed package" (defaults to the real one). */
function primed(templates?: string): string {
  const dir = tempDir();
  runInit({ dir, force: false, full: true, ...(templates ? { templatesDir: templates } : {}) });
  return dir;
}

/** Adopt one `x-generated` entry with a template id the install does not ship. */
function setRecordedTemplate(dir: string, dest: string, template: string): void {
  setStateField(dir, dest, "template", JSON.stringify(template));
}

/**
 * Acknowledge one destination exactly as `arggon adopt --ack` does
 * (`runAdoptAck`, cli/src/adopt.ts): `acknowledged: true` AND the checksum
 * RE-BASELINED from the current on-disk bytes. Reproducing both halves matters
 * — the re-baseline is why "matches the recorded checksum" means "unchanged
 * since the ack" for an acknowledged entry, which is exactly the property the
 * reaping policy leans on.
 */
function ackEntry(dir: string, dest: string): void {
  const abs = join(dir, ...dest.split("/"));
  const checksum = `sha256:${createHash("sha256").update(readFileSync(abs, "utf8"), "utf8").digest("hex")}`;
  setStateField(dir, dest, "checksum", JSON.stringify(checksum));
  setStateField(dir, dest, "acknowledged", "true");
}

/**
 * Set one `x-tracker` option the way an adopter edits their convention file
 * (there is no CLI setter): insert or replace the key inside the `x-tracker:`
 * block, creating the block when the scaffolded file has none. Block-indentation
 * scoped, so a sibling option is never clobbered.
 */
function setTrackerOption(dir: string, key: string, value: string): void {
  const path = join(dir, "ArggonManager/.convention.yml");
  const lines = readFileSync(path, "utf8").split("\n");
  let start = lines.findIndex((line) => /^x-tracker:\s*$/.test(line));
  if (start === -1) {
    start = lines.length - 1;
    lines.splice(start, 0, "x-tracker:");
  }
  let end = start + 1;
  while (end < lines.length && lines[end]!.startsWith("  ")) end++;
  const at = lines.findIndex((line, i) => i > start && i < end && line.startsWith(`  ${key}:`));
  if (at === -1) lines.splice(start + 1, 0, `  ${key}: ${value}`);
  else lines[at] = `  ${key}: ${value}`;
  writeFileSync(path, lines.join("\n"), "utf8");
}

/** The `reap` verdict doctor carries on one destination's row. */
function verdictFor(report: DoctorAdapters, dest: string): { action: string; reason: string } {
  for (const agent of report.agents) {
    const row = agent.files.find((f) => f.path === dest);
    if (row?.reap) return row.reap;
  }
  throw new Error(`no reap row for ${dest}`);
}

/** Rewrite one field of one `x-generated` entry, inside its own block only. */
function setStateField(dir: string, dest: string, field: string, value: string): void {
  const path = join(dir, "ArggonManager/.convention.yml");
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines.findIndex((line) => line.startsWith(`  ${dest}:`));
  expect(start, `${dest} must carry provenance`).toBeGreaterThan(-1);
  let end = start + 1;
  while (end < lines.length && lines[end]!.startsWith("    ")) end++;
  const at = lines.findIndex((line, i) => i > start && i < end && line.startsWith(`    ${field}:`));
  if (at === -1) lines.splice(start + 1, 0, `    ${field}: ${value}`);
  else lines[at] = `    ${field}: ${value}`;
  writeFileSync(path, lines.join("\n"), "utf8");
}

/** Insert a whole new `x-generated` entry (for destinations init never wrote). */
function addStateEntry(dir: string, dest: string, template: string, checksum: string): void {
  const path = join(dir, "ArggonManager/.convention.yml");
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines.findIndex((line) => /^x-generated:\s*$/.test(line));
  expect(start, "the tree must be initialized").toBeGreaterThan(-1);
  lines.splice(
    start + 1,
    0,
    `  ${JSON.stringify(dest)}:`,
    `    template: ${JSON.stringify(template)}`,
    `    checksum: ${JSON.stringify(checksum)}`,
    `    arggonVersion: "0.5.0"`,
    `    generatedAt: "2026-10-01T00:00:00.000Z"`,
  );
  writeFileSync(path, lines.join("\n"), "utf8");
}

function decisionFor(rows: readonly OrphanReapDecision[], dest: string): OrphanReapDecision {
  const row = rows.find((r) => r.dest === dest);
  expect(row, `no decision for ${dest}; got ${rows.map((r) => r.dest).join(", ")}`).toBeDefined();
  return row!;
}

/** The product's own destination order (localeCompare), so expectations match. */
const byDest = (a: string, b: string): number => a.localeCompare(b);

/** The four shipped OpenCode agents — the seam a rename would strand. */
const OPENCODE_AGENTS = [
  ".opencode/agents/arggon-delivery-lead.md",
  ".opencode/agents/arggon-standards-reviewer.md",
  ".opencode/agents/arggon-maker.md",
  ".opencode/agents/arggon-verifier.md",
];

describe("orphan reaping: the decision (one classifier, both surfaces)", () => {
  it("reaps an unmodified orphan and attributes it to the seam that generated it", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const rows = planOrphanReaps({
      root: dir,
      state: readGeneratedState(dir),
      templatesDir: templates,
    });
    // Exactly the dropped template's destination — an adopter's own agent file
    // is not a reap candidate, and no other destination moved status.
    expect(rows.map((r) => r.dest)).toEqual([".opencode/agents/arggon-maker.md"]);
    const row = decisionFor(rows, ".opencode/agents/arggon-maker.md");
    expect(row.action).toBe("reap");
    expect(row.template).toBe("docs/opencode/agents/arggon-maker.md");
    // Attribution is by the RECORDED template id, so the orphan still files
    // itself under the agent whose seam produced it.
    expect(row.agent).toBe("opencode");
    expect(row.reason).toContain("unchanged since they were recorded");
  });

  it("reaps a plain doc orphan too — the leak is not seam-specific", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/AGENTS.md");
    const rows = planOrphanReaps({
      root: dir,
      state: readGeneratedState(dir),
      templatesDir: templates,
    });
    const row = decisionFor(rows, "AGENTS.md");
    expect(row.action).toBe("reap");
    // Not an adapter artifact: it carries no agent, so `doctor --agents` stays
    // out of it and only init reports it.
    expect(row.agent).toBeNull();
  });

  it("never considers a file absent from x-generated (an unknown file is somebody's own)", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    // An agent-shaped file with NO provenance: exactly the pre-init adopter tree.
    // Deliberately NOT one of the shipped ids — a name the product generates has
    // provenance by definition, so the fixture must be one nobody ships.
    const own = ".opencode/agents/team-helper.md";
    writeFileSync(join(dir, ...own.split("/")), "# hand written\n", "utf8");
    const rows = planOrphanReaps({
      root: dir,
      state: readGeneratedState(dir),
      templatesDir: templates,
    });
    expect(rows.map((r) => r.dest)).not.toContain(own);
    // And no run deletes it: it is not in any bucket.
    const result = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(existsIn(dir, own)).toBe(true);
    expect(result.reaped).toEqual([]);
  });

  it("refuses an adopter-edited orphan and names the reason (never-overwrite binds reaping)", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    const victim = ".opencode/agents/arggon-maker.md";
    writeFileSync(
      join(dir, ...victim.split("/")),
      `${readFileSync(join(dir, ...victim.split("/")), "utf8")}\nADOPTER EDIT\n`,
      "utf8",
    );
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const row = decisionFor(
      planOrphanReaps({ root: dir, state: readGeneratedState(dir), templatesDir: templates }),
      victim,
    );
    expect(row.action).toBe("refuse");
    expect(row.reason).toContain("adopter-edited");
    // The refusal tells the adopter what to do instead of just withholding.
    expect(row.reason).toContain("Delete the file by hand");
  });

  it("does NOT delete an UNARMED acknowledged orphan, and says why + how to arm", () => {
    // The default must be the safe side. `adopt --ack` acks EVERY entry AND
    // re-baselines the checksum from disk, so "matches" proves only "unchanged
    // since the ack" — a file the adopter curated and then acked matches too,
    // and provenance cannot tell the two apart. So: reported, never deleted,
    // unless the repo arms it.
    const templates = installedPackage();
    const dir = primed(templates);
    const victim = ".opencode/agents/arggon-maker.md";
    ackEntry(dir, victim);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const row = decisionFor(
      planOrphanReaps({ root: dir, state: readGeneratedState(dir), templatesDir: templates }),
      victim,
    );
    expect(row.action).toBe("refuse");
    // The reason must name the flag AND the manual alternative — an operator
    // who wanted the deletion is never left hunting for the switch.
    expect(row.reason).toContain("acknowledged baseline");
    expect(row.reason).toContain("NOT deleted by default");
    expect(row.reason).toContain("x-tracker.reap-acked-orphans: true");
    expect(row.reason).toContain("Delete it by hand");
    // And the real run agrees: the file survives, the refusal is named.
    const result = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(result.reaped).toEqual([]);
    expect(result.reapRefused.map((r) => r.dest)).toEqual([victim]);
    expect(existsIn(dir, victim)).toBe(true);
    // Its provenance survives too, so arming later reaps exactly this file.
    expect(readGeneratedState(dir)[victim]?.template).toBe("docs/opencode/agents/arggon-maker.md");
  });

  it("REAPS an armed acknowledged orphan whose bytes are unchanged (the migration case)", () => {
    // Armed (`x-tracker.reap-acked-orphans: true`) is how an adopted adopter
    // clears a dead agent: ADR 0021 §6.2a′ gates the rename on reaping, and a
    // stranded `.opencode/agents/arggon-maker.md` stays dispatchable.
    const templates = installedPackage();
    const dir = primed(templates);
    const victim = ".opencode/agents/arggon-maker.md";
    ackEntry(dir, victim);
    setTrackerOption(dir, "reap-acked-orphans", "true");
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const row = decisionFor(
      planOrphanReaps({ root: dir, state: readGeneratedState(dir), templatesDir: templates }),
      victim,
    );
    expect(row.action).toBe("reap");
    // The audit trail says a SANCTIONED file was removed deliberately: both the
    // baseline and the arming are named.
    expect(row.reason).toContain("acknowledged baseline");
    expect(row.reason).toContain("adopt --ack");
    expect(row.reason).toContain("reap-acked-orphans: true");
    const result = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(result.reaped).toEqual([victim]);
    expect(existsIn(dir, victim)).toBe(false);
    expect(result.reapRefused).toEqual([]);
  });

  it("reads the arming from the tree ONCE — doctor and init cannot disagree", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    const victim = ".opencode/agents/arggon-maker.md";
    ackEntry(dir, victim);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const unarmed = runDoctor({ cwd: dir, agents: true, templatesRoot: templates }).agents!;
    expect(verdictFor(unarmed, victim).action).toBe("refuse");
    setTrackerOption(dir, "reap-acked-orphans", "true");
    const armed = runDoctor({ cwd: dir, agents: true, templatesRoot: templates }).agents!;
    expect(verdictFor(armed, victim).action).toBe("reap");
  });

  it("refuses an acknowledged orphan whose bytes changed after the ack, ARMED OR NOT", () => {
    // A known edit is a known edit: arming widens the unknowable case only, and
    // never reaches a file whose bytes differ from the recorded baseline.
    for (const armed of [false, true]) {
      const templates = installedPackage();
      const dir = primed(templates);
      const victim = ".opencode/agents/arggon-maker.md";
      ackEntry(dir, victim);
      if (armed) setTrackerOption(dir, "reap-acked-orphans", "true");
      writeFileSync(
        join(dir, ...victim.split("/")),
        `${readFileSync(join(dir, ...victim.split("/")), "utf8")}\nPOST-ACK EDIT\n`,
        "utf8",
      );
      dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
      const row = decisionFor(
        planOrphanReaps({ root: dir, state: readGeneratedState(dir), templatesDir: templates }),
        victim,
      );
      expect(row.action, `armed=${armed}`).toBe("refuse");
      expect(row.reason).toContain("adopter-edited");
      // Arming must not even be mentioned as the deciding factor.
      expect(row.reason).not.toContain("reap-acked-orphans");
      const result = runInit({ dir, force: false, full: true, templatesDir: templates });
      expect(result.reaped, `armed=${armed}`).toEqual([]);
      expect(existsIn(dir, victim), `armed=${armed}`).toBe(true);
    }
  });

  it("a malformed arming value is reported by validate and deletes nothing", () => {
    // The parser rejects a non-boolean `x-tracker` value (the `allow-steal`
    // rule) and `arggon validate` is where that surfaces, naming the key — so
    // the operator fixes it instead of silently getting the default. What
    // matters for reaping is only that nothing is deleted: init's own state
    // read degrades to an empty set on an unparseable convention file
    // (pre-existing, and the safe direction), with the classifier's tolerant
    // read as the floor behind it.
    const templates = installedPackage();
    const dir = primed(templates);
    const victim = ".opencode/agents/arggon-maker.md";
    ackEntry(dir, victim);
    setTrackerOption(dir, "reap-acked-orphans", "maybe");
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const validated = runCli(["validate"], dir);
    expect(validated.status).toBe(1);
    expect(validated.stdout).toContain("'reap-acked-orphans' must be a boolean");
    const proc = runCli(["--json", "init", dir], repoRoot);
    expect(existsIn(dir, victim)).toBe(true);
    expect(JSON.parse(proc.stdout).reaped).toEqual([]);
    // And the decision path refuses on an unreadable flag, never reaps.
    const rows = planOrphanReaps({
      root: dir,
      state: {
        [victim]: {
          template: "docs/opencode/agents/arggon-maker.md",
          checksum: "",
          arggonVersion: "0.5.0",
          generatedAt: "2026-10-01T00:00:00.000Z",
          acknowledged: true,
        },
      },
      templatesDir: templates,
    });
    expect(decisionFor(rows, victim).action).toBe("refuse");
  });

  it("REFUSES an unacknowledged orphan whose bytes changed since generation", () => {
    // The same ownership test without the ack: one edited byte against the
    // generation checksum, which the ack never touched.
    const templates = installedPackage();
    const dir = primed(templates);
    const victim = ".opencode/agents/arggon-maker.md";
    writeFileSync(
      join(dir, ...victim.split("/")),
      `${readFileSync(join(dir, ...victim.split("/")), "utf8")}\nADOPTER EDIT\n`,
      "utf8",
    );
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const row = decisionFor(
      planOrphanReaps({ root: dir, state: readGeneratedState(dir), templatesDir: templates }),
      victim,
    );
    expect(row.action).toBe("refuse");
    expect(row.reason).toContain("adopter-edited");
  });

  it("refuses a downgrade: a template absent only because THIS install is older", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    const victim = ".opencode/agents/arggon-maker.md";
    setStateField(dir, victim, "arggonVersion", '"99.0.0"');
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const row = decisionFor(
      planOrphanReaps({ root: dir, state: readGeneratedState(dir), templatesDir: templates }),
      victim,
    );
    expect(row.action).toBe("refuse");
    // Both versions are named, so the operator knows which direction to move.
    expect(row.reason).toContain("NEWER arggon");
    expect(row.reason).toContain("99.0.0");
    expect(row.reason).toContain("upgrade arggon");
  });

  it("refuses a recorded destination that resolves outside the repo root", () => {
    const templates = installedPackage();
    const base = tempDir();
    const dir = join(base, "repo");
    mkdirSync(dir, { recursive: true });
    runInit({ dir, force: false, full: true, templatesDir: templates });
    // A sibling file the tree never generated, recorded as `../outside.md`
    // against a template the install does not ship (orphanhood is about the
    // TEMPLATE; the path is what the containment rule has to veto).
    const outside = join(base, "outside.md");
    writeFileSync(outside, "NOT OURS\n", "utf8");
    const checksum = `sha256:${"0".repeat(64)}`;
    addStateEntry(dir, "../outside.md", "docs/ghost.md", checksum);
    const row = decisionFor(
      planOrphanReaps({ root: dir, state: readGeneratedState(dir), templatesDir: templates }),
      "../outside.md",
    );
    expect(row.action).toBe("refuse");
    expect(row.reason).toContain("OUTSIDE the repo root");
    // And the real run leaves it alone.
    const result = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(existsSync(outside)).toBe(true);
    expect(result.reaped).not.toContain("../outside.md");
  });

  it("refuses a directory and a symlink — nothing but a regular file is reaped", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    // A DIRECTORY recorded as a generated destination.
    const asDir = ".opencode/agents/arggon-ghost.md";
    mkdirSync(join(dir, ...asDir.split("/")), { recursive: true });
    addStateEntry(dir, asDir, "docs/opencode/agents/arggon-ghost.md", `sha256:${"0".repeat(64)}`);
    // A SYMLINK pointing at a file inside the tree: reaping it must unlink
    // nothing, so it is refused rather than followed.
    const asLink = ".opencode/agents/arggon-ghost-link.md";
    symlinkSync(join(dir, ".opencode/agents/arggon-maker.md"), join(dir, ...asLink.split("/")));
    addStateEntry(
      dir,
      asLink,
      "docs/opencode/agents/arggon-ghost-link.md",
      `sha256:${"0".repeat(64)}`,
    );
    const rows = planOrphanReaps({
      root: dir,
      state: readGeneratedState(dir),
      templatesDir: templates,
    });
    expect(decisionFor(rows, asDir).action).toBe("refuse");
    expect(decisionFor(rows, asDir).reason).toContain("directory");
    expect(decisionFor(rows, asLink).action).toBe("refuse");
    expect(decisionFor(rows, asLink).reason).toContain("not a regular file");

    const result = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(lstatSync(join(dir, ...asDir.split("/"))).isDirectory()).toBe(true);
    expect(lstatSync(join(dir, ...asLink.split("/"))).isSymbolicLink()).toBe(true);
    expect(existsIn(dir, ".opencode/agents/arggon-maker.md")).toBe(true);
    expect(result.reaped).toEqual([]);
    expect(result.reapRefused.map((r) => r.dest).sort(byDest)).toEqual(
      [asDir, asLink].sort(byDest),
    );
  });

  it("refuses a destination that is not on disk (nothing to reap, and it says so)", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    const victim = ".opencode/agents/arggon-maker.md";
    rmSync(join(dir, ...victim.split("/")));
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const row = decisionFor(
      planOrphanReaps({ root: dir, state: readGeneratedState(dir), templatesDir: templates }),
      victim,
    );
    expect(row.action).toBe("refuse");
    expect(row.reason).toContain("nothing to reap");
  });

  it("compares versions numerically, and refuses to guess on anything undecidable", () => {
    expect(compareArggonVersions("0.5.0", "0.5.0")).toBe(0);
    expect(compareArggonVersions("0.10.0", "0.9.0")).toBe(1);
    expect(compareArggonVersions("0.5.0", "0.6.0")).toBe(-1);
    expect(compareArggonVersions("1.0", "1.0.0")).toBe(0);
    // Prerelease/build metadata and nonsense are undecidable, never "older".
    expect(compareArggonVersions("0.5.0-rc.1", "0.5.0")).toBeNull();
    expect(compareArggonVersions("unknown", "0.5.0")).toBeNull();
    expect(compareArggonVersions(undefined, "0.5.0")).toBeNull();
  });
});

describe("doctor --agents: the orphaned status", () => {
  it("reports orphaned with the per-file remedy, and no destination as missing", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    // Two agents lose their template; one of the two files is adopter-edited.
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    dropTemplate(templates, "docs/opencode/agents/arggon-standards-reviewer.md");
    const edited = ".opencode/agents/arggon-standards-reviewer.md";
    writeFileSync(
      join(dir, ...edited.split("/")),
      `${readFileSync(join(dir, ...edited.split("/")), "utf8")}\nADOPTER EDIT\n`,
      "utf8",
    );
    const report = runDoctor({ cwd: dir, agents: true, templatesRoot: templates }).agents!;
    const opencode = report.agents.find((a) => a.agent === "opencode")!;
    expect(opencode.counts.orphaned).toBe(2);
    // `missing` promises "init materializes it", which no orphan can be: the
    // whole point is that the template is gone. So an orphan is never `missing`.
    expect(opencode.counts.missing).toBe(0);
    // Every OTHER seam file is untouched: the report stays honest about scope.
    expect(opencode.counts.present).toBeGreaterThan(0);
    for (const other of ["claude", "zcode"] as const) {
      expect(report.agents.find((a) => a.agent === other)!.counts.orphaned).toBe(0);
    }
    const reapable = opencode.files.find((f) => f.path === ".opencode/agents/arggon-maker.md")!;
    expect(reapable.status).toBe("orphaned");
    expect(reapable.reap).toEqual({
      action: "reap",
      reason: expect.stringContaining("unchanged since they were recorded") as unknown as string,
    });
    const refused = opencode.files.find((f) => f.path === edited)!;
    expect(refused.status).toBe("orphaned");
    expect(refused.reap!.action).toBe("refuse");
    expect(refused.reap!.reason).toContain("adopter-edited");
  });

  it("names the remedy on the agent line and one line per refused orphan", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const text = formatDoctorReport(
      runDoctor({ cwd: dir, agents: true, templatesRoot: templates }),
    );
    const line = text.split("agent opencode: ")[1]!.split("\n")[0]!;
    // The status names what init would do, like every other bucket.
    expect(line).toContain("1 orphaned (template gone from this arggon");
    expect(line).toContain("init removes it when unmodified");
  });

  it("stays report-only: a full read reaps nothing", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const before = readdirDeep(dir);
    runDoctor({ cwd: dir, agents: true, templatesRoot: templates });
    expect(readdirDeep(dir)).toEqual(before);
    expect(existsIn(dir, ".opencode/agents/arggon-maker.md")).toBe(true);
  });

  it("a plain (non-adapter) orphan gets a human hint too — init deletes it", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/AGENTS.md");
    const result = runDoctor({ cwd: dir, agents: true, templatesRoot: templates });
    // Counted where it always was: the docs block's `stale` bucket IS the
    // orphan condition for a non-adapter destination.
    expect(result.docs.stale).toBe(1);
    // And the human report names the consequence instead of leaving a pending
    // deletion to be discovered by the next init.
    const text = formatDoctorReport(result);
    expect(text).toContain("1 generated doc(s) record a template this arggon no longer ships");
    expect(text).toContain("removes the ones still exactly as generated");
    expect(text).toContain("reapRefused[]");
  });
});

describe("init: the guarded reap", () => {
  it("--dry-run previews the reaping without touching the tree", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const before = readdirDeep(dir);
    const stateBefore = readFileSync(join(dir, "ArggonManager/.convention.yml"), "utf8");
    const preview = dryRunInit({ dir, force: false, full: true, templatesDir: templates });
    expect(preview.reaped).toEqual([".opencode/agents/arggon-maker.md"]);
    expect(preview.reapRefused).toEqual([]);
    // The plan row is there too, so the per-destination table shows the removal.
    const row = preview.plan.find((e) => e.dest === ".opencode/agents/arggon-maker.md")!;
    expect(row.decision).toBe("orphan-reap");
    // NOTHING was written: the file and its provenance are still there.
    expect(readdirDeep(dir)).toEqual(before);
    expect(readFileSync(join(dir, "ArggonManager/.convention.yml"), "utf8")).toBe(stateBefore);
    expect(existsIn(dir, ".opencode/agents/arggon-maker.md")).toBe(true);
  });

  it("the real CLI's dry run names the reap without repeating or performing it", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const victim = ".opencode/agents/arggon-maker.md";
    setRecordedTemplate(dir, victim, "docs/opencode/agents/arggon-retired.md");
    const proc = runCli(["init", "--dry-run", dir], repoRoot);
    expect(proc.status).toBe(0);
    // One row per file in the plan table, plus the tally that separates the two
    // buckets — a deletion must be visible before anyone runs the real thing.
    expect(proc.stdout).toContain("orphan-reap");
    expect(proc.stdout).toContain(victim);
    expect(proc.stdout).toContain("orphan reaping: 1 to remove, 0 to keep");
    expect(proc.stdout).toContain("nothing was written (dry run)");
    expect(existsIn(dir, victim)).toBe(true);
  });

  it("removes the unmodified orphan, keeps the edited one, and drops only the reaped entry", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    dropTemplate(templates, "docs/opencode/agents/arggon-standards-reviewer.md");
    const edited = ".opencode/agents/arggon-standards-reviewer.md";
    writeFileSync(
      join(dir, ...edited.split("/")),
      `${readFileSync(join(dir, ...edited.split("/")), "utf8")}\nADOPTER EDIT\n`,
      "utf8",
    );
    const result = runInit({ dir, force: false, full: true, templatesDir: templates });
    // Its own action family — never folded into the create/update/skip buckets.
    expect(result.reaped).toEqual([".opencode/agents/arggon-maker.md"]);
    expect(result.created).not.toContain(".opencode/agents/arggon-maker.md");
    expect(result.updated).not.toContain(".opencode/agents/arggon-maker.md");
    expect(result.modified).not.toContain(".opencode/agents/arggon-maker.md");
    expect(result.skipped).not.toContain(".opencode/agents/arggon-maker.md");
    expect(existsIn(dir, ".opencode/agents/arggon-maker.md")).toBe(false);
    // The refusal names the path AND why.
    expect(result.reapRefused).toHaveLength(1);
    expect(result.reapRefused[0]!.dest).toBe(edited);
    expect(result.reapRefused[0]!.template).toBe(
      "docs/opencode/agents/arggon-standards-reviewer.md",
    );
    expect(result.reapRefused[0]!.reason).toContain("adopter-edited");
    expect(existsIn(dir, edited)).toBe(true);
    // Provenance follows the file: the reaped destination's entry is gone, the
    // kept one still describes the bytes that are on disk.
    const state = readGeneratedState(dir);
    expect(state[".opencode/agents/arggon-maker.md"]).toBeUndefined();
    expect(state[edited]?.template).toBe("docs/opencode/agents/arggon-standards-reviewer.md");
  });

  it("is idempotent: a second run reaps nothing and reports nothing outstanding", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    const first = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(first.reaped).toEqual([".opencode/agents/arggon-maker.md"]);
    const second = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(second.reaped).toEqual([]);
    expect(second.reapRefused).toEqual([]);
    // No orphan decision is left in the plan at all: the reaped destination's
    // provenance went with it, so a later run has nothing left to consider.
    const secondPlan = dryRunInit({ dir, force: false, full: true, templatesDir: templates });
    expect(secondPlan.plan.some((e) => e.decision.startsWith("orphan-"))).toBe(false);
    expect(secondPlan.reaped).toEqual([]);
    // And the report agrees: nothing is orphaned any more.
    const opencode = runDoctor({
      cwd: dir,
      agents: true,
      templatesRoot: templates,
    }).agents!.agents.find((a) => a.agent === "opencode")!;
    expect(opencode.counts.orphaned).toBe(0);
  });

  it("keeps reporting a refused orphan on every run (the adopter's, still named)", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    writeFileSync(
      join(dir, ...".opencode/agents/arggon-maker.md".split("/")),
      `${readFileSync(join(dir, ...".opencode/agents/arggon-maker.md".split("/")), "utf8")}\nEDIT\n`,
      "utf8",
    );
    const run1 = runInit({ dir, force: false, full: true, templatesDir: templates });
    const run2 = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(run1.reapRefused).toHaveLength(1);
    // Same behaviour as any adopter-owned file: reported every run, never touched.
    expect(run2.reapRefused.map((r) => r.dest)).toEqual(run1.reapRefused.map((r) => r.dest));
    expect(existsIn(dir, ".opencode/agents/arggon-maker.md")).toBe(true);
  });

  it("carries the reaping family in --json and never folds it into the counts", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    writeFileSync(
      join(dir, ...".opencode/agents/arggon-standards-reviewer.md".split("/")),
      `${readFileSync(join(dir, ...".opencode/agents/arggon-standards-reviewer.md".split("/")), "utf8")}\nEDIT\n`,
      "utf8",
    );
    dropTemplate(templates, "docs/opencode/agents/arggon-standards-reviewer.md");
    const preview = dryRunInit({ dir, force: false, full: true, templatesDir: templates });
    // A removal is not a write: the create/replace/skip counts do not see it.
    expect(preview.created).not.toContain(".opencode/agents/arggon-maker.md");
    expect(preview.updated).not.toContain(".opencode/agents/arggon-maker.md");
    expect(preview.skipped).not.toContain(".opencode/agents/arggon-maker.md");
    expect(preview.reaped).toEqual([".opencode/agents/arggon-maker.md"]);
    expect(preview.reapRefused.map((r) => r.dest)).toEqual([
      ".opencode/agents/arggon-standards-reviewer.md",
    ]);

    // The real CLI cannot have a template removed from its install, so this
    // asserts the additive envelope fields exist on a healthy run (exit 0).
    const healthy = tempDir();
    const proc = runCli(["--json", "init", healthy], repoRoot);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      reaped: string[];
      reapRefused: unknown[];
      adapters: { counts: Record<string, number> };
    };
    expect(body.reaped).toEqual([]);
    expect(body.reapRefused).toEqual([]);
    // The adapter counts stay the create/replace/skip triple they always were.
    expect(Object.keys(body.adapters.counts).sort()).toEqual([
      "replaced",
      "skipped",
      "total",
      "written",
    ]);
  });
});

describe("end-to-end: a template leaves the installed package (AC 8)", () => {
  it("reports orphaned, creates what is missing, reaps the untouched one, refuses the edited one", () => {
    const templates = installedPackage();
    // 1. A generated seam, exactly as an adopting repo has it.
    const dir = primed(templates);
    for (const dest of OPENCODE_AGENTS) expect(existsIn(dir, dest)).toBe(true);

    // 2. The package drops two agent templates — what the rename does to every
    //    adopter: the old destinations are now un-refreshable.
    dropTemplate(templates, "docs/opencode/agents/arggon-maker.md");
    dropTemplate(templates, "docs/opencode/agents/arggon-standards-reviewer.md");
    const edited = ".opencode/agents/arggon-standards-reviewer.md";
    writeFileSync(
      join(dir, ...edited.split("/")),
      `${readFileSync(join(dir, ...edited.split("/")), "utf8")}\nADOPTER EDIT\n`,
      "utf8",
    );

    // 3. doctor sees both as `orphaned`, and none of the seam as `missing`.
    const opencode = runDoctor({
      cwd: dir,
      agents: true,
      templatesRoot: templates,
    }).agents!.agents.find((a) => a.agent === "opencode")!;
    expect(opencode.counts.orphaned).toBe(2);
    expect(opencode.counts.missing).toBe(0);
    expect(
      opencode.files
        .filter((f) => f.status === "orphaned")
        .map((f) => f.path)
        .sort(),
    ).toEqual([
      ".opencode/agents/arggon-maker.md",
      ".opencode/agents/arggon-standards-reviewer.md",
    ]);

    // 4. init removes the untouched orphan and REFUSES the edited one.
    const result = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(result.reaped).toEqual([".opencode/agents/arggon-maker.md"]);
    expect(result.reapRefused.map((r) => r.dest)).toEqual([edited]);
    expect(existsIn(dir, ".opencode/agents/arggon-maker.md")).toBe(false);
    expect(existsIn(dir, edited)).toBe(true);

    // 5. The survivors are still healthy: init never damaged the rest of the seam.
    for (const dest of OPENCODE_AGENTS.filter((d) => d !== ".opencode/agents/arggon-maker.md")) {
      expect(existsIn(dir, dest), `${dest} survives the reap`).toBe(true);
    }

    // 6. A second run is a no-op: nothing left to reap, and the edited orphan is
    // still named (it is the adopter's file, reported on every run).
    const second = runInit({ dir, force: false, full: true, templatesDir: templates });
    expect(second.reaped).toEqual([]);
    expect(second.reapRefused.map((r) => r.dest)).toEqual([edited]);
    const secondDry = dryRunInit({ dir, force: false, full: true, templatesDir: templates });
    expect(secondDry.plan.filter((e) => e.decision === "orphan-reap")).toEqual([]);
  });

  it("an orphan recorded against a template this install never had is reaped by the real CLI", () => {
    // The provenance-only path: `x-generated` names a template the install does
    // not ship, which is exactly the state a rename leaves behind. No injection
    // point, no fixture copy — the shipped binary, end to end.
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const victim = ".opencode/agents/arggon-maker.md";
    setRecordedTemplate(dir, victim, "docs/opencode/agents/arggon-retired.md");

    const dry = runCli(["--json", "init", "--dry-run", dir], repoRoot);
    expect(dry.status).toBe(0);
    const dryBody = JSON.parse(dry.stdout) as { dryRun: boolean; reaped: string[] };
    expect(dryBody.dryRun).toBe(true);
    expect(dryBody.reaped).toEqual([victim]);
    // The preview promised a removal and performed none.
    expect(existsIn(dir, victim)).toBe(true);

    const proc = runCli(["init", dir], repoRoot);
    expect(proc.status).toBe(0);
    // One human line per reaped file — never folded into another bucket's count.
    expect(proc.stdout).toContain(`arggon init: reaped orphaned file: ${victim}`);
    expect(existsIn(dir, victim)).toBe(false);

    const after = runCli(["--json", "init", dir], repoRoot);
    const afterBody = JSON.parse(after.stdout) as { reaped: string[]; reapRefused: unknown[] };
    expect(afterBody.reaped).toEqual([]);
    expect(afterBody.reapRefused).toEqual([]);
  });

  it("names an edited orphan in the real CLI's --json and human output", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const victim = ".opencode/agents/arggon-maker.md";
    setRecordedTemplate(dir, victim, "docs/opencode/agents/arggon-retired.md");
    writeFileSync(
      join(dir, ...victim.split("/")),
      `${readFileSync(join(dir, ...victim.split("/")), "utf8")}\nADOPTER EDIT\n`,
      "utf8",
    );
    const proc = runCli(["--json", "init", dir], repoRoot);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      reaped: string[];
      reapRefused: Array<{ dest: string; template: string; reason: string }>;
    };
    expect(body.reaped).toEqual([]);
    expect(body.reapRefused).toHaveLength(1);
    expect(body.reapRefused[0]!.dest).toBe(victim);
    expect(body.reapRefused[0]!.template).toBe("docs/opencode/agents/arggon-retired.md");
    expect(body.reapRefused[0]!.reason).toContain("adopter-edited");
    expect(existsIn(dir, victim)).toBe(true);
  });
});

describe("orphan reaping: plan wiring", () => {
  it("the planner reports one row per orphan and reaps only through the plan", () => {
    const templates = installedPackage();
    const dir = primed(templates);
    dropTemplate(templates, "docs/AGENTS.md");
    const plan = planGenerateDocs({ root: dir, full: true, templatesDir: templates });
    expect(plan.reaped).toEqual(["AGENTS.md"]);
    expect(plan.reapRefused).toEqual([]);
    // `orphan-reap` is not a write: the derived buckets stay untouched, so a
    // deletion can never be read as one by a client summing created+updated.
    expect(plan.created).not.toContain("AGENTS.md");
    expect(plan.updated).not.toContain("AGENTS.md");
    expect(plan.skipped).not.toContain("AGENTS.md");
    expect(plan.entries.filter((e) => e.dest === "AGENTS.md").map((e) => e.decision)).toEqual([
      "orphan-reap",
    ]);
    // Nothing was applied: the pure planner writes nothing.
    expect(existsIn(dir, "AGENTS.md")).toBe(true);
  });
});

/** Recursive relative file listing of a tree (for "wrote nothing" assertions). */
function readdirDeep(root: string, base = root): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const abs = join(root, entry.name);
    const rel = abs.slice(base.length + 1);
    if (entry.isDirectory()) out.push(...readdirDeep(abs, base));
    else out.push(rel);
  }
  return out.sort();
}
