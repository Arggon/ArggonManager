import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync as _mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractTitles,
  jaccard,
  normalizeForSimilarity,
  resolveSpecAuditThresholds,
  runSpecAudit,
  shingles,
  SPEC_AUDIT_DEFAULTS,
} from "./spec-audit.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

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

/** Temp repo skeleton: only what findTasksDir needs (tasks/.convention.yml). */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-spec-audit-"));
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
  return dir;
}

const PROSE = (topic: string, flavor: string): string =>
  [
    `# Spec: ${topic}`,
    "",
    "## Purpose",
    "",
    `The ${topic} command exists so that ${flavor}. It reads the inputs,`,
    `applies the ${topic} rules strictly and reports the outcome. On error`,
    `the command prints a diagnostic and exits 1 without side effects.`,
    "",
    "## Synopsis",
    "",
    "```bash",
    `arggon ${topic}`,
    "```",
    "",
    "## Acceptance criteria",
    "",
    "### Requirement: it must validate input",
    "",
    `Given a ${flavor} input, when the command runs, then it validates.`,
    "",
    "#### Scenario: valid input",
    "",
    "Given a valid file, when the command runs, then it exits 0.",
    "",
    "### Verification checklist",
    "",
    "- [ ] Scenario: valid input",
    "",
    "*Source: fixtures*",
  ].join("\n");

function writeSpec(dir: string, name: string, specId: string, body: string): void {
  const dirPath = join(dir, "docs", "specs");
  mkdirSync(dirPath, { recursive: true });
  const fm = `spec_id: ${specId}\ntitle: ${specId}\nstatus: proposed\ncreated: 2026-09-16`;
  writeFileSync(join(dirPath, name), `---\n${fm}\n---\n\n${body}`, "utf8");
}

/** Recursive fs snapshot: relative path -> content (for the report-only check). */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.set(full, readFileSync(full, "utf8"));
    }
  };
  visit(dir);
  return out;
}

describe("spec audit: normalization, shingles, jaccard", () => {
  it("identical text -> 1, disjoint text -> 0", () => {
    const a = normalizeForSimilarity("alpha beta gamma delta");
    expect(jaccard(shingles(a), shingles(a))).toBe(1);
    const b = normalizeForSimilarity("one two three four");
    expect(jaccard(shingles(a), shingles(b))).toBe(0);
  });

  it("known overlap computes the expected value", () => {
    // shingles(k=3) of "a b c d": {a b c, b c d}; of "a b c e": {a b c, b c e}
    const a = shingles("a b c d");
    const b = shingles("a b c e");
    expect(jaccard(a, b)).toBeCloseTo(1 / 3, 10);
  });

  it("normalizes: frontmatter and code fences are stripped, case/whitespace collapsed", () => {
    const raw = `---\nspec_id: x-001\ntitle: T\n---\n\n# T\n\n\`\`\`bash\narggon x\n\`\`\`\n\nThe   COMMAND reads inputs.\n`;
    expect(normalizeForSimilarity(raw)).toBe("t the command reads inputs");
    // identical modulo frontmatter/fences/case/whitespace -> similarity 1
    const raw2 = "---\nspec_id: y-002\n---\n\n# t\n\nthe command reads inputs\n";
    expect(jaccard(shingles(normalizeForSimilarity(raw)), shingles(normalizeForSimilarity(raw2)))).toBe(1);
  });

  it("two empty sets count as identical (1.0); one empty -> 0", () => {
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(jaccard(new Set(["a"]), new Set())).toBe(0);
  });

  it("extracts requirement/scenario titles verbatim", () => {
    const titles = extractTitles("### Requirement: it must validate input\n#### Scenario: valid input\n");
    expect(titles).toEqual(["it must validate input", "valid input"]);
  });
});

describe("spec audit: classification (golden fixtures)", () => {
  it("TRUE duplicate: near-identical docs, different ids/titles -> DUPLICATE", () => {
    const dir = makeRepo();
    const prose = PROSE("widget", "teams ship faster");
    writeSpec(dir, "spec-a-001.md", "a-001", prose);
    writeSpec(dir, "spec-b-002.md", "b-002", prose);
    const result = runSpecAudit({ cwd: dir });
    expect(result.pairs).toBe(1);
    expect(result.counts.duplicate).toBe(1);
    expect(result.findings[0]?.classification).toBe("duplicate");
    expect(result.findings[0]?.similarity).toBeGreaterThanOrEqual(SPEC_AUDIT_DEFAULTS.duplicateThreshold);
  });

  it("DIVERGING duplicate: same titles verbatim, rewritten prose -> MERGE via shared titles, not Jaccard", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-a-001.md", "a-001", PROSE("widget", "teams ship faster"));
    // Same `### Requirement:` / `#### Scenario:` titles verbatim; prose mostly
    // rewritten but sharing the boilerplate frame, so Jaccard stays moderate
    // (above the shared-title floor, below the merge threshold).
    const diverging = [
      "# Spec: widget",
      "",
      "## Purpose",
      "",
      "Widgets unify deployment across every region so squads deliver weekly.",
      "It reads the inputs, applies the widget rules strictly and reports the outcome. On error",
      "the command prints a diagnostic and exits 1 without side effects.",
      "",
      "## Synopsis",
      "",
      "```bash",
      "arggon widget",
      "```",
      "",
      "## Acceptance criteria",
      "",
      "### Requirement: it must validate input",
      "",
      "The parser rejects manifests missing a checksum field and names the offending path.",
      "",
      "#### Scenario: valid input",
      "",
      "A manifest with a matching checksum is accepted and recorded in the ledger.",
      "",
      "### Verification checklist",
      "",
      "- [ ] Scenario: valid input",
    ].join("\n");
    writeSpec(dir, "spec-b-002.md", "b-002", diverging);
    const result = runSpecAudit({ cwd: dir });
    expect(result.pairs).toBe(1);
    expect(result.counts.merge).toBe(1);
    const f = result.findings[0]!;
    expect(f.classification).toBe("merge");
    expect(f.similarity).toBeLessThan(SPEC_AUDIT_DEFAULTS.mergeThreshold); // shared-titles path, NOT high Jaccard
    expect(f.sharedTitles.length).toBeGreaterThanOrEqual(SPEC_AUDIT_DEFAULTS.minSharedTitles);
    expect(f.sharedTitles).toContain("it must validate input");
    expect(f.sharedTitles).toContain("valid input");
  });

  it("HEALTHY corpus: distinct topics -> no duplicate/merge; below-floor pairs counted, not reported", () => {
    const dir = makeRepo();
    writeSpec(
      dir,
      "spec-alpha-001.md",
      "alpha-001",
      "Alpha schedules nightly pruning of stale cache entries so the disk budget stays flat.",
    );
    writeSpec(
      dir,
      "spec-beta-002.md",
      "beta-002",
      "Beta renders invoice PDFs on demand and streams them to the browser without staging files.",
    );
    writeSpec(
      dir,
      "spec-gamma-003.md",
      "gamma-003",
      "Gamma rotates signing keys every ninety days and publishes the new public half to partners.",
    );
    const result = runSpecAudit({ cwd: dir });
    expect(result.pairs).toBe(3);
    expect(result.counts.duplicate).toBe(0);
    expect(result.counts.merge).toBe(0);
    expect(result.counts.keepSeparate).toBe(0);
    expect(result.counts.belowFloor).toBe(3);
    expect(result.findings).toEqual([]);
  });
});

describe("spec audit: threshold boundaries", () => {
  /** Deterministic corpus whose single pair sits at a known Jaccard: {abc,bcd} vs {abc,bce} = 1/3. */
  function pairAtOneThird(dir: string): void {
    writeSpec(dir, "spec-a-001.md", "a-001", "a b c d");
    writeSpec(dir, "spec-b-002.md", "b-002", "a b c e");
  }

  it("similarity just below/above a threshold flips the classification", () => {
    const low = makeRepo();
    pairAtOneThird(low); // similarity exactly 1/3
    // merge threshold exactly at the similarity: >= wins -> merge
    const atMerge = runSpecAudit({ cwd: low, thresholds: { mergeThreshold: 1 / 3 } });
    expect(atMerge.findings[0]?.classification).toBe("merge");
    // just above the merge threshold (sim 1/3 no longer >= it) -> keep-separate
    const justBelow = runSpecAudit({ cwd: low, thresholds: { mergeThreshold: 1 / 3 + 1e-9 } });
    expect(justBelow.findings[0]?.classification).toBe("keep-separate");
    // duplicate threshold exactly at the similarity: >= wins -> duplicate
    const atDup = makeRepo();
    pairAtOneThird(atDup);
    const atDupResult = runSpecAudit({ cwd: atDup, thresholds: { mergeThreshold: 1 / 3, duplicateThreshold: 1 / 3 } });
    expect(atDupResult.findings[0]?.classification).toBe("duplicate");
    // just above the similarity: not duplicate, still merge
    const belowDup = makeRepo();
    pairAtOneThird(belowDup);
    const belowDupResult = runSpecAudit({
      cwd: belowDup,
      thresholds: { mergeThreshold: 1 / 3, duplicateThreshold: 1 / 3 + 1e-9 },
    });
    expect(belowDupResult.findings[0]?.classification).toBe("merge");
  });

  it("report-floor boundary: exactly at floor is reported, below is counted only", () => {
    const dir = makeRepo();
    pairAtOneThird(dir); // 1/3 ~ 0.333
    const atFloor = runSpecAudit({ cwd: dir, thresholds: { reportFloor: 1 / 3, mergeThreshold: 0.34 } });
    expect(atFloor.counts.keepSeparate).toBe(1);
    const aboveFloor = runSpecAudit({ cwd: dir, thresholds: { reportFloor: 0.34, mergeThreshold: 0.34 } });
    expect(aboveFloor.counts.belowFloor).toBe(1);
    expect(aboveFloor.findings).toEqual([]);
  });

  it("invalid threshold values fail cleanly", () => {
    const dir = makeRepo();
    expect(() => resolveSpecAuditThresholds({ duplicateThreshold: Number.NaN })).toThrow(/duplicate-threshold/);
    expect(() => resolveSpecAuditThresholds({ reportFloor: 1.5 })).toThrow(/report-floor/);
    expect(() => resolveSpecAuditThresholds({ minSharedTitles: -1 })).toThrow(/min-shared-titles/);
    expect(() => resolveSpecAuditThresholds({ duplicateThreshold: 0.3, mergeThreshold: 0.5 })).toThrow(
      /duplicate-threshold .*merge-threshold/s,
    );
    expect(() => runSpecAudit({ cwd: dir, thresholds: { mergeThreshold: 2 } })).toThrow(/merge-threshold/);
  });
});

describe("spec audit: report-only invariant + structural failures", () => {
  it("unit: an audit run leaves the fs byte-identical", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-a-001.md", "a-001", PROSE("widget", "teams ship faster"));
    writeSpec(dir, "spec-b-002.md", "b-002", PROSE("widget", "teams ship faster"));
    const before = snapshot(dir);
    runSpecAudit({ cwd: dir });
    expect(snapshot(dir)).toEqual(before);
  });

  it("missing or empty docs/specs -> clean failure", () => {
    const dir = makeRepo();
    expect(() => runSpecAudit({ cwd: dir })).toThrow(/no docs\/specs directory/);
    mkdirSync(join(dir, "docs", "specs"), { recursive: true });
    expect(() => runSpecAudit({ cwd: dir })).toThrow(/nothing to audit/);
  });
});

describe("spec audit: CLI contract (e2e)", () => {
  it("audits a corpus: human output, exit 0 with findings", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-a-001.md", "a-001", PROSE("widget", "teams ship faster"));
    writeSpec(dir, "spec-b-002.md", "b-002", PROSE("widget", "teams ship faster"));
    const before = snapshot(dir);
    const run = runCli(["spec", "audit"], dir);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("DUPLICATE (1)");
    expect(run.stdout).toContain("similarity:");
    expect(run.stdout).toContain("report only, nothing was edited");
    expect(snapshot(dir)).toEqual(before); // e2e report-only
  });

  it("--json envelope shape matches the contract", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-a-001.md", "a-001", PROSE("widget", "teams ship faster"));
    writeSpec(dir, "spec-b-002.md", "b-002", PROSE("widget", "teams ship faster"));
    writeSpec(
      dir,
      "spec-gamma-003.md",
      "gamma-003",
      "Gamma rotates signing keys every ninety days and publishes the new public half to partners.",
    );
    const run = runCli(["spec", "audit", "--json"], dir);
    expect(run.status).toBe(0);
    const payload = JSON.parse(run.stdout) as {
      ok: boolean;
      schemaVersion: number;
      conventionVersion: number;
      command: string;
      specs: number;
      pairs: number;
      thresholds: Record<string, number>;
      findings: Array<{ classification: string; files: string[]; similarity: number; sharedTitles: string[]; note: string }>;
      counts: { duplicate: number; merge: number; keepSeparate: number; belowFloor: number };
    };
    expect(payload.ok).toBe(true);
    expect(payload.command).toBe("spec");
    expect(payload.specs).toBe(3);
    expect(payload.pairs).toBe(3);
    expect(payload.thresholds).toEqual({ ...SPEC_AUDIT_DEFAULTS });
    expect(payload.counts.duplicate).toBe(1);
    expect(payload.counts.merge).toBe(0);
    expect(payload.counts.duplicate + payload.counts.merge + payload.counts.keepSeparate + payload.counts.belowFloor).toBe(3);
    const dup = payload.findings.find((f) => f.classification === "duplicate")!;
    expect(dup.files).toEqual(["docs/specs/spec-a-001.md", "docs/specs/spec-b-002.md"]);
    expect(dup.similarity).toBeGreaterThanOrEqual(SPEC_AUDIT_DEFAULTS.duplicateThreshold);
    expect(typeof dup.note).toBe("string");
  });

  it("threshold flags reach the run; invalid values fail cleanly with SPEC_FAILED", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-a-001.md", "a-001", "a b c d");
    writeSpec(dir, "spec-b-002.md", "b-002", "a b c e");
    // similarity is 1/3 ~ 0.3333: below a 0.34 merge threshold, above the default report floor
    const run = runCli(
      ["spec", "audit", "--merge-threshold", "0.34", "--duplicate-threshold", "0.9", "--json"],
      dir,
    );
    expect(run.status).toBe(0);
    const payload = JSON.parse(run.stdout) as { counts: { keepSeparate: number }; thresholds: Record<string, number> };
    expect(payload.thresholds.reportFloor).toBeCloseTo(0.15, 10);
    expect(payload.thresholds.duplicateThreshold).toBeCloseTo(0.9, 10);
    expect(payload.counts.keepSeparate).toBe(1);
    const bad = runCli(["spec", "audit", "--merge-threshold", "1.5", "--json"], dir);
    expect(bad.status).toBe(1);
    const fail = JSON.parse(bad.stdout) as { ok: boolean; command: string; error: { code: string } };
    expect(fail.ok).toBe(false);
    expect(fail.command).toBe("spec");
    expect(fail.error.code).toBe("SPEC_FAILED");
  });

  it("missing docs/specs -> clean failure exit 1", () => {
    const dir = makeRepo();
    const run = runCli(["spec", "audit"], dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("no docs/specs directory");
    const jsonRun = runCli(["spec", "audit", "--json"], dir);
    expect(jsonRun.status).toBe(1);
    const fail = JSON.parse(jsonRun.stdout) as { ok: boolean; error: { code: string } };
    expect(fail.ok).toBe(false);
    expect(fail.error.code).toBe("SPEC_FAILED");
  });
});
