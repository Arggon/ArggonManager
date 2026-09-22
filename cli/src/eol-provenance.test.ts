import {
  cpSync,
  existsSync,
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
  parseConventionConfig,
  readGeneratedProjectName,
  updateGeneratedSection,
} from "@arggondev/lib";
import { checksumMatches, checksumOf, GENERATED_DOC_COUNT, normalizeEol } from "./docs.js";
import { dryRunInit, runInit } from "./init.js";
import { runAdoptAck } from "./adopt.js";
import { runDoctor } from "./doctor.js";

// bug-crlf-provenance-breakage: an adopter repo with `* text=auto eol=crlf` in
// .gitattributes MANDATES CRLF working trees — every fresh checkout/worktree
// smudges the LF-generated docs to CRLF. Arggon writes LF and records checksums
// over those bytes, so pre-fix every byte-based comparison broke: doctor
// reported 100% acknowledgedDrifted/modified, project-name recovery returned
// null (inert propose/outdated channel), and init degraded untouched docs to
// adopter-modified. These tests pin the EOL-normalized comparison layer:
// normalize `\r\n`/`\r` to `\n` at COMPARE TIME on both sides — recorded state
// and adopter files are never rewritten — in both directions (LF-recorded
// state on a CRLF tree, and CRLF-recorded ack state on an LF tree).

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  // Absolute prefix: a relative one would create fixtures inside the CWD
  // (the worktree), where init's auto-commit would sweep them into the branch.
  const dir = _mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** Fixed timestamp so two independent runs plan byte-identical state. */
const FIXED_NOW = new Date("2026-09-17T12:00:00.000Z");

/** Rewrite every managed doc's bytes (state checksums stay as recorded). */
function rewriteManagedDocs(dir: string, transform: (content: string) => string): void {
  const config = parseConventionConfig(
    readFileSync(join(dir, "ArggonManager/.convention.yml"), "utf8"),
  );
  for (const dest of Object.keys(config.generated)) {
    const abs = join(dir, dest);
    if (!existsSync(abs)) continue;
    writeFileSync(abs, transform(readFileSync(abs, "utf8")), "utf8");
  }
}

const toCrlf = (content: string): string => content.replaceAll("\n", "\r\n");

/** Copy a fixture tree to a fresh temp dir. */
function copyFixture(from: string, prefix: string): string {
  const to = mkdtempSync(prefix);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  return to;
}

/** Re-record every state checksum over the file's CURRENT bytes (ack-style). */
function restampStateChecksums(dir: string): void {
  const path = join(dir, "ArggonManager/.convention.yml");
  const raw = readFileSync(path, "utf8");
  const config = parseConventionConfig(raw);
  for (const [dest, entry] of Object.entries(config.generated)) {
    const abs = join(dir, dest);
    if (!existsSync(abs)) continue;
    entry.checksum = checksumOf(readFileSync(abs, "utf8"));
  }
  writeFileSync(
    path,
    updateGeneratedSection(raw, config.generated, config.generatedProjectName),
    "utf8",
  );
}

/** Strip the x-generated.projectName line, simulating a legacy tree. */
function stripRecordedName(dir: string): void {
  const path = join(dir, "ArggonManager/.convention.yml");
  writeFileSync(
    path,
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => !l.startsWith("  projectName:"))
      .join("\n"),
    "utf8",
  );
}

/** Normalize a result for cross-tree comparison (location fields stripped). */
function normalize(result: unknown): string {
  return JSON.stringify(result, (key, value) => {
    if (typeof value !== "string") return value;
    if (key === "root" || key === "conventionPath" || key === "cwd") return "";
    return value.replace(/\/tmp\/arggon-[A-Za-z0-9._-]+/g, "<TMP>");
  });
}

/** Mutable copy of the bundled templates dir (see doctor.test.ts). */
function fixtureTemplates(): string {
  const root = mkdtempSync("arggon-eol-templates-");
  cpSync(resolve(repoRoot, "templates"), join(root, "templates"), { recursive: true });
  cpSync(resolve(repoRoot, "skills"), join(root, "skills"), { recursive: true });
  return join(root, "templates");
}

describe("bug-crlf-provenance-breakage: EOL-normalized comparison primitives", () => {
  it("normalizeEol maps CRLF and lone CR to LF", () => {
    expect(normalizeEol("a\r\nb\rc\n")).toBe("a\nb\nc\n");
    expect(normalizeEol("plain\nlf\n")).toBe("plain\nlf\n");
  });

  it("checksumMatches: full tolerance matrix, genuine edits still mismatch", () => {
    const lf = "# Title\n\nbody line\n";
    const crlf = "# Title\r\n\r\nbody line\r\n";
    const lfChecksum = checksumOf(lf); // what init records (writes LF)
    const crlfChecksum = checksumOf(crlf); // what an ack on a CRLF tree records

    // Clause 1 — exact bytes (pre-existing behavior, both EOL flavors).
    expect(checksumMatches(lfChecksum, lf)).toBe(true);
    expect(checksumMatches(crlfChecksum, crlf)).toBe(true);
    // Clause 2 — LF-recorded state vs CRLF working tree (the bug).
    expect(checksumMatches(lfChecksum, crlf)).toBe(true);
    // Clause 3 — CRLF-recorded ack state vs LF checkout (the reverse).
    expect(checksumMatches(crlfChecksum, lf)).toBe(true);
    // Mixed/lone-CR content normalizes to the same LF checksum too.
    expect(checksumMatches(lfChecksum, "# Title\r\n\nbody line\r\n")).toBe(true);

    // Genuine content edits are never absorbed by the tolerance.
    expect(checksumMatches(lfChecksum, `${lf}adopter edit\n`)).toBe(false);
    expect(checksumMatches(crlfChecksum, `# Title\r\n\r\nbody line!\r\n`)).toBe(false);
  });
});

describe("bug-crlf-provenance-breakage: CRLF working tree vs LF checkout", () => {
  it("doctor/propose/init --dry-run are identical; projectName recovered; 0 false drifted", () => {
    const lf = mkdtempSync("arggon-eol-lf-");
    runInit({ dir: lf, force: false, full: true });
    const crlf = copyFixture(lf, "arggon-eol-crlf-");
    rewriteManagedDocs(crlf, toCrlf); // git smudge, state checksums stay LF
    // Precondition: the CRLF tree really carries CRLF bytes that no longer
    // match the recorded LF checksums byte-for-byte.
    expect(readFileSync(join(crlf, "AGENTS.md"), "utf8")).toContain("\r\n");
    expect(readFileSync(join(crlf, "AGENTS.md"), "utf8")).not.toBe(
      readFileSync(join(lf, "AGENTS.md"), "utf8"),
    );

    const docLf = runDoctor({ cwd: lf });
    const docCrlf = runDoctor({ cwd: crlf });
    expect(docCrlf.projectName).toBe(docLf.projectName);
    expect(docCrlf.projectName).toBeTruthy();
    expect(docCrlf.docs).toEqual({
      managed: GENERATED_DOC_COUNT,
      untouched: GENERATED_DOC_COUNT,
      modified: 0,
      acknowledged: 0,
      acknowledgedDrifted: 0, // pre-fix: all 14+ docs false-positived here
      stale: 0,
      missing: 0,
      outdated: 0,
      outdatedDocs: [],
    });
    expect(docCrlf.docs).toEqual(docLf.docs);

    // init --dry-run: byte-identical plan (decisions, write bytes, state).
    const dryLf = dryRunInit({ dir: lf, force: false, now: FIXED_NOW });
    const dryCrlf = dryRunInit({ dir: crlf, force: false, now: FIXED_NOW });
    expect(dryCrlf.updated).toEqual(dryLf.updated);
    expect(dryCrlf.modified).toEqual([]);
    expect(normalize(dryCrlf)).toBe(normalize(dryLf));

    // propose: identical proposals — on a pristine tree that means NONE.
    // Pre-fix the CRLF tree proposed EVERY doc (render-vs-disk always differed).
    const propLf = dryRunInit({ dir: lf, force: false, propose: true, now: FIXED_NOW });
    const propCrlf = dryRunInit({ dir: crlf, force: false, propose: true, now: FIXED_NOW });
    expect(propCrlf.proposals).toEqual([]);
    expect(normalize(propCrlf)).toBe(normalize(propLf));

    // A genuine adopter edit must still surface, identically on both trees
    // (line endings alone never inflate the diff or hide the divergence).
    writeFileSync(
      join(lf, "AGENTS.md"),
      `${readFileSync(join(lf, "AGENTS.md"), "utf8")}\nADOPTER NOTE\n`,
      "utf8",
    );
    writeFileSync(
      join(crlf, "AGENTS.md"),
      `${readFileSync(join(crlf, "AGENTS.md"), "utf8")}\nADOPTER NOTE\r\n`,
      "utf8",
    );
    const propEditLf = dryRunInit({ dir: lf, force: false, propose: true, now: FIXED_NOW });
    const propEditCrlf = dryRunInit({ dir: crlf, force: false, propose: true, now: FIXED_NOW });
    expect(propEditCrlf.proposals).toEqual(propEditLf.proposals);
    expect(propEditCrlf.proposals?.filter((p) => p.decision === "proposed")).toHaveLength(1);
    expect(propEditCrlf.proposals?.[0]).toMatchObject({ dest: "AGENTS.md", mode: "whole-file" });
    // doctor: the edit shows as modified, everything else stays untouched.
    const docEditCrlf = runDoctor({ cwd: crlf });
    expect(docEditCrlf.docs.modified).toBe(1);
    expect(docEditCrlf.docs.untouched).toBe(GENERATED_DOC_COUNT - 1);
    expect(docEditCrlf.docs.acknowledgedDrifted).toBe(0);

    // Upstream template movement is still detected as outdated through CRLF.
    const templates = fixtureTemplates();
    writeFileSync(join(templates, "docs/AGENTS.md"), "UPSTREAM IMPROVEMENT\n", "utf8");
    const docMoved = runDoctor({ cwd: crlf, templatesRoot: templates });
    expect(docMoved.docs.outdated).toBe(1);
    expect(docMoved.docs.outdatedDocs).toEqual(["AGENTS.md"]);
  });

  it("legacy CRLF tree (no recorded name): projectName recovered from CRLF content", () => {
    const lf = mkdtempSync("arggon-eol-legacy-lf-");
    runInit({ dir: lf, force: false, full: true });
    const expectedName = readGeneratedProjectName(lf);
    const crlf = copyFixture(lf, "arggon-eol-legacy-crlf-");
    rewriteManagedDocs(crlf, toCrlf);
    stripRecordedName(crlf);
    stripRecordedName(lf);
    expect(expectedName).toBeTruthy();
    // Pre-fix: extraction failed on CRLF disk -> projectName null -> the
    // propose/outdated upgrade channel went inert on eol=crlf adopters.
    expect(runDoctor({ cwd: crlf }).projectName).toBe(expectedName);
    expect(runDoctor({ cwd: crlf }).docs.outdated).toBe(0);
    // Same plan as the identical legacy LF tree.
    const dryLf = dryRunInit({ dir: lf, force: false, now: FIXED_NOW });
    const dryCrlf = dryRunInit({ dir: crlf, force: false, now: FIXED_NOW });
    expect(normalize(dryCrlf)).toBe(normalize(dryLf));
  });
});

describe("bug-crlf-provenance-breakage: reversed direction (CRLF-recorded state, LF tree)", () => {
  it("state recorded from CRLF bytes still matches an LF checkout", () => {
    const lf = mkdtempSync("arggon-eol-rev-base-");
    runInit({ dir: lf, force: false, full: true });
    const rev = copyFixture(lf, "arggon-eol-rev-");
    // Record state over CRLF bytes (what an ack/regen on a CRLF tree does)…
    rewriteManagedDocs(rev, toCrlf);
    restampStateChecksums(rev);
    // …then the tree re-materializes as LF (fresh checkout without the
    // attribute, worktree with core.eol=lf, manual conversion, …).
    rewriteManagedDocs(rev, normalizeEol);
    const doc = runDoctor({ cwd: rev });
    expect(doc.docs).toEqual({
      managed: GENERATED_DOC_COUNT,
      untouched: GENERATED_DOC_COUNT,
      modified: 0,
      acknowledged: 0,
      acknowledgedDrifted: 0,
      stale: 0,
      missing: 0,
      outdated: 0,
      outdatedDocs: [],
    });
    // Untouched docs still regenerate (not degraded to adopter-modified) and
    // plan identically to the pristine LF fixture.
    const dryRev = dryRunInit({ dir: rev, force: false, now: FIXED_NOW });
    const dryLf = dryRunInit({ dir: lf, force: false, now: FIXED_NOW });
    expect(dryRev.updated).toEqual(dryLf.updated);
    expect(normalize(dryRev)).toBe(normalize(dryLf));
  });
});

describe("bug-crlf-provenance-breakage: adopt --ack cross-EOL equivalence", () => {
  it("an ack recorded on CRLF bytes matches on both the CRLF tree and an LF copy", () => {
    const lf = mkdtempSync("arggon-eol-ack-base-");
    runInit({ dir: lf, force: false, full: true });
    const crlfAcked = copyFixture(lf, "arggon-eol-ack-crlf-");
    rewriteManagedDocs(crlfAcked, toCrlf);
    // Ack records checksumOf(current bytes) — CRLF on this tree (unchanged
    // live behavior; nothing about what gets recorded is normalized).
    const ack = runAdoptAck({ cwd: crlfAcked });
    expect(ack.count).toBe(GENERATED_DOC_COUNT);
    const ackedState = parseConventionConfig(
      readFileSync(join(crlfAcked, "ArggonManager/.convention.yml"), "utf8"),
    );
    expect(ackedState.generated["AGENTS.md"]!.acknowledged).toBe(true);
    expect(ackedState.generated["AGENTS.md"]!.checksum).toBe(
      checksumOf(readFileSync(join(crlfAcked, "AGENTS.md"), "utf8")),
    );

    // CRLF tree: all acknowledged, zero false drift.
    const docCrlf = runDoctor({ cwd: crlfAcked });
    expect(docCrlf.docs.acknowledged).toBe(GENERATED_DOC_COUNT);
    expect(docCrlf.docs.acknowledgedDrifted).toBe(0);
    expect(docCrlf.docs.modified).toBe(0);

    // LF checkout of the same repo: clause 3 — still all acknowledged.
    const lfCopy = copyFixture(crlfAcked, "arggon-eol-ack-lf-");
    rewriteManagedDocs(lfCopy, normalizeEol);
    const docLf = runDoctor({ cwd: lfCopy });
    expect(docLf.docs.acknowledged).toBe(GENERATED_DOC_COUNT);
    expect(docLf.docs.acknowledgedDrifted).toBe(0);
    expect(docLf.docs.modified).toBe(0);

    // init must never regenerate acknowledged docs on either EOL…
    const dryCrlf = dryRunInit({ dir: crlfAcked, force: false, full: true, now: FIXED_NOW });
    const dryLf = dryRunInit({ dir: lfCopy, force: false, full: true, now: FIXED_NOW });
    expect(dryCrlf.updated).toEqual([]);
    expect(dryLf.updated).toEqual([]);
    expect(dryCrlf.skipped).toHaveLength(GENERATED_DOC_COUNT);
    expect(normalize(dryLf)).toBe(normalize(dryCrlf));
    const res = runInit({ dir: lfCopy, force: false, full: true, now: FIXED_NOW });
    expect(res.updated).toEqual([]);
    // …and the LF docs stay byte-identical (LF, never rewritten to CRLF).
    expect(readFileSync(join(lfCopy, "AGENTS.md"), "utf8")).not.toContain("\r");
  });
});

describe("bug-crlf-provenance-breakage: regeneration writes LF, never re-breaks checksums", () => {
  it("regenerating a CRLF tree writes LF bytes; the next compare matches exactly", () => {
    const crlf = mkdtempSync("arggon-eol-regen-");
    runInit({ dir: crlf, force: false, full: true });
    rewriteManagedDocs(crlf, toCrlf); // smudged checkout: LF state, CRLF disk

    // Untouched (via the normalized clause) -> silently regenerated.
    const res = runInit({ dir: crlf, force: false, full: true, now: FIXED_NOW });
    expect(res.updated).toHaveLength(GENERATED_DOC_COUNT);
    expect(res.modified).toEqual([]);

    // Write convention: regenerated bytes are LF-only.
    for (const dest of res.updated) {
      expect(readFileSync(join(crlf, dest), "utf8")).not.toContain("\r");
    }
    // The refreshed state matches the fresh LF disk EXACTLY (clause 1), so
    // the next compare — including after another git smudge (clause 2) —
    // stays clean. Nothing re-breaks.
    const config = parseConventionConfig(
      readFileSync(join(crlf, "ArggonManager/.convention.yml"), "utf8"),
    );
    for (const [dest, entry] of Object.entries(config.generated)) {
      expect(entry.checksum).toBe(checksumOf(readFileSync(join(crlf, dest), "utf8")));
    }
    const doc = runDoctor({ cwd: crlf });
    expect(doc.docs.modified).toBe(0);
    expect(doc.docs.acknowledgedDrifted).toBe(0);
    expect(doc.docs.untouched).toBe(GENERATED_DOC_COUNT);
    expect(doc.docs.outdated).toBe(0);

    // A second run is idempotent and stays clean.
    runInit({ dir: crlf, force: false, full: true, now: FIXED_NOW });
    expect(runDoctor({ cwd: crlf }).docs.modified).toBe(0);
    expect(runDoctor({ cwd: crlf }).docs.acknowledgedDrifted).toBe(0);
  });
});
