/**
 * Document-number collisions (bug-spec-analyze-does-not-detect-duplicate-doc-numbers).
 *
 * The per-file `spec_id`/`plan_id` check keys on the id INSIDE each file, so
 * two documents with different slugs and the same number were invisible and
 * git merged both in silently. The shared thing is the numeric stem in the
 * FILENAME, which only a whole-directory scan can see.
 *
 * Fixture-driven: `fixtures/spec-docs-invalid/duplicate-doc-number/` is the
 * failing fixture for the rule (one per layout rule, like
 * `fixtures/tasks-invalid/`) — four colliding pairs, one per directory, plus a
 * digit-bearing slug (`spec-phase-2-009.md`, `plan-sync-2-003.md`) that must
 * NOT false-positive. Contract: report-only on both surfaces, one shared
 * message, no edits.
 */

import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DOC_NUMBER_COLLISION_CODE,
  DOC_NUMBER_COLLISION_KIND,
  docNumberCollisions,
  docNumberFromFileName,
  runSpecAnalyze,
  runSpecNew,
  runSpecValidate,
} from "./spec.js";
import { runCli } from "./test-spawn.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

/** Temp repo skeleton: only what findTasksDir needs (legacy tasks/ layout). */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-doc-numbers-"));
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
  return dir;
}

function writeDoc(dir: string, subdir: string, name: string, content = "# Doc\n\nbody\n"): void {
  const dirPath = join(dir, "docs", subdir);
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(join(dirPath, name), content, "utf8");
}

/** The failing fixture: a legacy-layout tree with four colliding pairs. */
const fixtureRoot = join(process.cwd(), "fixtures", "spec-docs-invalid", "duplicate-doc-number");

const EXPECTED = [
  {
    dir: "adr",
    label: "ADR",
    stem: "0020",
    files: ["docs/adr/0020-alpha.md", "docs/adr/0020-beta.md"],
  },
  {
    dir: "explorations",
    label: "exploration",
    stem: "007",
    files: [
      "docs/explorations/exploration-alpha-007.md",
      "docs/explorations/exploration-beta-007.md",
    ],
  },
  {
    dir: "plans",
    label: "plan",
    stem: "003",
    files: ["docs/plans/plan-deps-003.md", "docs/plans/plan-sync-2-003.md"],
  },
  {
    dir: "specs",
    label: "spec",
    stem: "004",
    files: ["docs/specs/spec-alpha-004.md", "docs/specs/spec-beta-004.md"],
  },
] as const;

describe("doc number extraction (filename convention per directory)", () => {
  it("reads the documented stem of each kind", () => {
    expect(docNumberFromFileName("adr", "0020-alpha.md")).toBe(20);
    expect(docNumberFromFileName("explorations", "exploration-updates-016.md")).toBe(16);
    expect(docNumberFromFileName("specs", "spec-sync-001.md")).toBe(1);
    expect(docNumberFromFileName("plans", "plan-sync-001.md")).toBe(1);
  });

  it("takes the LAST numeric run, so a slug with digits never becomes the number", () => {
    expect(docNumberFromFileName("specs", "spec-phase-2-009.md")).toBe(9);
    expect(docNumberFromFileName("plans", "plan-sync-2-003.md")).toBe(3);
    expect(docNumberFromFileName("explorations", "exploration-mcp-2026-07-28-004.md")).toBe(4);
    expect(docNumberFromFileName("adr", "0007-mcp-2026-07-28-adoption.md")).toBe(7);
  });

  it("ignores anything that is not a numbered document", () => {
    // READMEs, committed baseline snapshots (.json), unnumbered drafts.
    expect(docNumberFromFileName("adr", "README.md")).toBeUndefined();
    expect(docNumberFromFileName("specs", "README.md")).toBeUndefined();
    expect(
      docNumberFromFileName("specs", "spec-analyze-baseline-release-pipeline-015.json"),
    ).toBeUndefined();
    expect(docNumberFromFileName("specs", "spec-draft.md")).toBeUndefined();
    expect(docNumberFromFileName("specs", "spec-foo-01.md")).toBeUndefined();
    // A spec stem never matches the ADR shape, and vice versa.
    expect(docNumberFromFileName("adr", "spec-foo-002.md")).toBeUndefined();
    expect(docNumberFromFileName("specs", "0020-alpha.md")).toBeUndefined();
  });

  it("treats 0001 and 001 as the same number (padded forms)", () => {
    const dir = makeRepo();
    writeDoc(dir, "adr", "0001-alpha.md");
    writeDoc(dir, "adr", "001-beta.md");
    const collisions = docNumberCollisions(dir);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]!.number).toBe(1);
  });
});

describe("spec validate: duplicate document numbers (report-only warnings)", () => {
  it("warns once per colliding number, naming every file, on the fixture", () => {
    const result = runSpecValidate({ cwd: fixtureRoot });
    // Clean on every OTHER rule — the fixture only carries the collision.
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => w.code)).toEqual([
      DOC_NUMBER_COLLISION_CODE,
      DOC_NUMBER_COLLISION_CODE,
      DOC_NUMBER_COLLISION_CODE,
      DOC_NUMBER_COLLISION_CODE,
    ]);
    for (const expected of EXPECTED) {
      const warning = result.warnings.find((w) =>
        w.message.startsWith(`${expected.label} number `),
      );
      expect(warning, `no warning for ${expected.dir} ${expected.stem}`).toBeDefined();
      // Reported on the first file of the pair; every file named in the message.
      expect(warning!.path).toBe(expected.files[0]);
      for (const file of expected.files) expect(warning!.message).toContain(file);
      expect(warning!.message).toContain(`number ${expected.stem}`);
    }
  });

  it("is a warning, not an error: the run still exits 0", () => {
    const run = runCli(["spec", "validate"], fixtureRoot);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("[DOC_NUMBER_COLLISION]");
    expect(run.stdout).toContain("arggon spec: ok");
  });

  it("a digit-bearing slug is not a false positive (fixture control)", () => {
    const result = runSpecValidate({ cwd: fixtureRoot });
    // spec-phase-2-009.md is unique (009) and 0021-gamma.md is unique: the only
    // four warnings are the four real pairs, and none of them names 009/0021.
    expect(result.warnings.some((w) => w.message.includes("009"))).toBe(false);
    expect(result.warnings.some((w) => w.message.includes("0021"))).toBe(false);
    // plan-sync-2-003.md IS in a pair — read as 003, not as the slug's 2.
    expect(result.warnings.some((w) => w.message.includes("plan number 003"))).toBe(true);
  });

  it("--file cannot decide a collision: single-file mode stays silent", () => {
    const result = runSpecValidate({
      cwd: fixtureRoot,
      file: join(fixtureRoot, "docs/specs/spec-alpha-004.md"),
    });
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("names all three files when three documents share a number", () => {
    const dir = makeRepo();
    writeDoc(dir, "specs", "spec-a-011.md");
    writeDoc(dir, "specs", "spec-b-011.md");
    writeDoc(dir, "specs", "spec-c-011.md");
    const result = runSpecValidate({ cwd: dir });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.message).toContain("spec number 011 is shared by 3 documents");
    for (const name of ["spec-a-011.md", "spec-b-011.md", "spec-c-011.md"]) {
      expect(result.warnings[0]!.message).toContain(name);
    }
  });
});

describe("spec analyze: duplicate document numbers", () => {
  it("reports exactly the fixture collisions as duplicate-doc-number", () => {
    const result = runSpecAnalyze({ cwd: fixtureRoot });
    const collisions = result.consistency.filter((f) => f.kind === DOC_NUMBER_COLLISION_KIND);
    expect(collisions).toHaveLength(EXPECTED.length);
    for (const expected of EXPECTED) {
      const finding = collisions.find((f) => f.message.startsWith(`${expected.label} number `));
      expect(finding, `no finding for ${expected.dir} ${expected.stem}`).toBeDefined();
      expect(finding!.file).toBe(expected.files[0]);
      expect(finding!.severity).toBe("warn");
      for (const file of expected.files) expect(finding!.message).toContain(file);
    }
    // The fixture stays clean on every other consistency rule.
    expect(result.consistency.filter((f) => f.kind !== DOC_NUMBER_COLLISION_KIND)).toEqual([]);
    expect(result.ambiguity).toEqual([]);
    expect(result.decisions).toEqual([]);
  });

  it("is report-only: exit 0 with findings and byte-identical documents", () => {
    const before = readFileSync(join(fixtureRoot, "docs/adr/0020-alpha.md"), "utf8");
    const run = runCli(["spec", "analyze", "--json"], fixtureRoot);
    expect(run.status).toBe(0);
    const payload = JSON.parse(run.stdout) as {
      ok: boolean;
      findings: { consistency: { file: string; kind: string; message: string }[] };
    };
    expect(payload.ok).toBe(true);
    const collisions = payload.findings.consistency.filter(
      (f) => f.kind === DOC_NUMBER_COLLISION_KIND,
    );
    expect(collisions.length).toBe(EXPECTED.length);
    expect(readFileSync(join(fixtureRoot, "docs/adr/0020-alpha.md"), "utf8")).toBe(before);
  });

  it("--spec single-file mode skips the corpus-only check", () => {
    const result = runSpecAnalyze({
      cwd: fixtureRoot,
      spec: join(fixtureRoot, "docs/specs/spec-alpha-004.md"),
    });
    expect(result.consistency).toEqual([]);
  });

  it("survives the merge the incident describes: both files land, one finding", () => {
    // The collision is decidable only from the whole directory, so a document
    // arriving from another branch (here: written into the tree by "theirs")
    // is caught on the next scan — no state carried between runs.
    const dir = makeRepo();
    writeDoc(dir, "adr", "0020-alpha.md");
    expect(runSpecAnalyze({ cwd: dir }).consistency).toEqual([]);
    writeDoc(dir, "adr", "0020-beta.md"); // the other branch's file
    const findings = runSpecAnalyze({ cwd: dir }).consistency;
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("docs/adr/0020-alpha.md");
    expect(findings[0]!.message).toContain("docs/adr/0020-beta.md");
  });
});

describe("spec new: the next FREE number, never a colliding one", () => {
  it("numbers above the highest in use, digit-bearing slugs included", () => {
    const dir = makeRepo();
    writeDoc(dir, "specs", "spec-phase-2-009.md");
    writeDoc(dir, "plans", "plan-sync-2-017.md");
    const result = runSpecNew({ cwd: dir, slug: "after", plan: true });
    expect(result.files).toEqual(["docs/specs/spec-after-018.md", "docs/plans/plan-after-018.md"]);
    expect(runSpecValidate({ cwd: dir }).warnings).toEqual([]);
  });

  it("skips a colliding pair's number and lands on a free one", () => {
    const dir = makeRepo();
    writeDoc(dir, "specs", "spec-a-004.md");
    writeDoc(dir, "specs", "spec-b-004.md");
    // 004 is used twice; max+1 is still free, and the scaffolder never picks a
    // number that is already taken.
    expect(runSpecNew({ cwd: dir, slug: "next" }).files).toEqual(["docs/specs/spec-next-005.md"]);
  });
});
