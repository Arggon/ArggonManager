import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  DECISION_PENDING_DAYS,
  STALE_PROPOSED_DAYS,
  ageDaysFromTodayUtc,
  decisionSectionHasAdrRef,
  parseAdrStatusAndDate,
  parseDecisionSection,
  runSpecAnalyze,
} from "./spec.js";

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

/** A date N whole days before today (UTC midnight), YYYY-MM-DD. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Temp repo skeleton: only what findTasksDir needs (legacy tasks/ layout). */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-spec-decision-gaps-"));
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
  return dir;
}

function frontmatter(fields: Record<string, string>): string {
  return `---\n${Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}\n---\n`;
}

function writeDoc(dir: string, subdir: string, name: string, content: string): void {
  const dirPath = join(dir, "docs", subdir);
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(join(dirPath, name), content, "utf8");
}

function writeExploration(dir: string, name: string, created: string, decisionBody: string): void {
  writeDoc(
    dir,
    "explorations",
    name,
    `${frontmatter({ exploration_id: name.replace(/\.md$/, ""), title: "T", status: "open", created })}\n` +
      `# Exploration: T\n\n## Findings\n\nsomething.\n\n## Decision\n\n${decisionBody}\n`,
  );
}

function writeAdr(dir: string, name: string, status: string, date: string | undefined): void {
  const dateLine = date === undefined ? "" : `- Date: ${date}\n`;
  writeDoc(dir, "adr", name, `# ADR\n\n- Status: ${status}\n${dateLine}\n## Decision\n\nx\n`);
}

function writeSpec(
  dir: string,
  name: string,
  fields: Record<string, string>,
  body = "# Spec: t\n\n## Purpose\n\nwhy\n\n## Synopsis\n\nOn error: exit 1.\n\n## Acceptance\n\n- [x] ok\n",
): void {
  writeDoc(dir, "specs", name, `${frontmatter(fields)}\n${body}`);
}

function writePlan(dir: string, name: string, fields: Record<string, string>): void {
  writeDoc(dir, "plans", name, `${frontmatter(fields)}\n# Plan: t\n\n## Tasks\n`);
}

describe("decision-gap parsers", () => {
  it("parseAdrStatusAndDate reads the first Status and Date list lines with positions", () => {
    const info = parseAdrStatusAndDate("# ADR\n\n- Status: Proposed\n- Date: 2026-09-07\n");
    expect(info.status).toBe("Proposed");
    expect(info.statusLine).toBe(3);
    expect(info.date).toBe("2026-09-07");
  });

  it("parseAdrStatusAndDate keeps qualifier text and skips later Status/Date lines", () => {
    const info = parseAdrStatusAndDate(
      "- Status: Proposed (Accepted on merge)\n- Date: 2026-09-29\n- Status: Accepted\n- Date: 2020-01-01\n",
    );
    expect(info.status).toBe("Proposed (Accepted on merge)");
    expect(info.statusLine).toBe(1);
    expect(info.date).toBe("2026-09-29");
  });

  it("parseAdrStatusAndDate returns empty for prose or frontmatter-only documents", () => {
    expect(
      parseAdrStatusAndDate("---\nstatus: proposed\n---\n\nThe status is Accepted.\n"),
    ).toEqual({});
  });

  it("parseDecisionSection finds the section, strips comments, and covers 'Decision gate'", () => {
    const raw =
      "---\ncreated: 2026-09-16\n---\n\n# T\n\n## Findings\n\nx\n\n## Decision\n\n" +
      "<!-- ADR placeholder: docs/adr/0009-x.md once decided. -->\n\ntext\n\n## Next\n\ny\n";
    const section = parseDecisionSection(raw);
    expect(section.headingLine).toBe(11);
    expect(section.text).not.toContain("0009-x.md");
    expect(section.text).toContain("text");
  });

  it("parseDecisionSection returns empty when no Decision heading exists", () => {
    expect(parseDecisionSection("# T\n\n## Recommendation\n\nx\n")).toEqual({});
  });

  it("decisionSectionHasAdrRef: true for markdown link and bare real ADR paths", () => {
    expect(decisionSectionHasAdrRef("Adopted in [ADR 0009](../adr/0009-x.md).")).toBe(true);
    expect(decisionSectionHasAdrRef("- ADR: docs/adr/0007-mcp-adoption.md (accepted).")).toBe(true);
    expect(
      decisionSectionHasAdrRef("See [the ADR](ArggonManager/docs/adr/0012-x.md#decision)."),
    ).toBe(true);
  });

  it("decisionSectionHasAdrRef: false for placeholders, comments and non-ADR paths", () => {
    expect(decisionSectionHasAdrRef("ADR placeholder: docs/adr/0000-<slug>.md once decided.")).toBe(
      false,
    );
    expect(decisionSectionHasAdrRef("No separate ADR — this is a bug fix.")).toBe(false);
    expect(decisionSectionHasAdrRef("See [readme](../adr/README.md) and [plan](plan.md).")).toBe(
      false,
    );
  });

  it("ageDaysFromTodayUtc: whole days to today UTC, null on missing/malformed", () => {
    expect(ageDaysFromTodayUtc(daysAgo(13))).toBe(13);
    expect(ageDaysFromTodayUtc(daysAgo(0))).toBe(0);
    expect(ageDaysFromTodayUtc(undefined)).toBeNull();
    expect(ageDaysFromTodayUtc("2026-13-99")).toBeNull();
    expect(ageDaysFromTodayUtc("2026-09-16 extra")).toBeNull();
  });
});

describe("decision-gap findings (fixtures)", () => {
  it("flags an old exploration whose Decision is only a placeholder comment", () => {
    const dir = makeRepo();
    writeExploration(dir, "exploration-old-001.md", daysAgo(30), "<!-- ADR placeholder: x -->");
    const result = runSpecAnalyze({ cwd: dir });
    const hits = result.decisions.filter((f) => f.kind === "DECISION-PENDING-EXPLORATION");
    expect(hits.length).toBe(1);
    expect(hits[0]!.file).toBe("docs/explorations/exploration-old-001.md");
    expect(hits[0]!.severity).toBe("warn");
    expect(hits[0]!.line).toBeDefined();
    expect(hits[0]!.message).toContain("Decision");
  });

  it("does not flag a fresh exploration or one whose Decision links a numbered ADR", () => {
    const dir = makeRepo();
    writeExploration(dir, "exploration-fresh-001.md", daysAgo(0), "<!-- ADR placeholder: x -->");
    writeExploration(
      dir,
      "exploration-decided-001.md",
      daysAgo(30),
      "Adopted in [ADR 0009](../adr/0009-item-priority.md).",
    );
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.decisions.filter((f) => f.kind === "DECISION-PENDING-EXPLORATION")).toEqual([]);
  });

  it("flags only after the threshold: exactly DECISION_PENDING_DAYS old is clean, one more is a finding", () => {
    const dir = makeRepo();
    writeExploration(dir, "exploration-edge-001.md", daysAgo(DECISION_PENDING_DAYS), "pending");
    writeExploration(dir, "exploration-over-001.md", daysAgo(DECISION_PENDING_DAYS + 1), "pending");
    const result = runSpecAnalyze({ cwd: dir });
    const files = result.decisions
      .filter((f) => f.kind === "DECISION-PENDING-EXPLORATION")
      .map((f) => f.file);
    expect(files).toEqual(["docs/explorations/exploration-over-001.md"]);
  });

  it("flags a Proposed ADR older than the threshold at its Status line", () => {
    const dir = makeRepo();
    writeAdr(dir, "0002-stale-adr.md", "Proposed", daysAgo(60));
    const result = runSpecAnalyze({ cwd: dir });
    const hits = result.decisions.filter((f) => f.kind === "STALE-PROPOSED-ADR");
    expect(hits.length).toBe(1);
    expect(hits[0]!.file).toBe("docs/adr/0002-stale-adr.md");
    expect(hits[0]!.line).toBe(3);
    expect(hits[0]!.message).toContain("Proposed");
  });

  it("does not flag Accepted ADRs, fresh Proposed ADRs, or Proposed ADRs without a date", () => {
    const dir = makeRepo();
    writeAdr(dir, "0001-accepted.md", "Accepted", daysAgo(60));
    writeAdr(dir, "0002-fresh.md", "Proposed", daysAgo(0));
    writeAdr(dir, "0003-undated.md", "Proposed", undefined);
    writeAdr(dir, "0004-boundary.md", "Proposed", daysAgo(STALE_PROPOSED_DAYS));
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.decisions.filter((f) => f.kind === "STALE-PROPOSED-ADR")).toEqual([]);
  });

  it("flags a proposed spec whose linked plan is implemented (drift)", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-drift-001.md", {
      spec_id: "drift-001",
      title: "Drift",
      status: "proposed",
      created: daysAgo(1),
    });
    writePlan(dir, "plan-drift-001.md", {
      plan_id: "drift-001",
      title: "Drift",
      spec: "docs/specs/spec-drift-001.md",
      status: "implemented",
      created: daysAgo(1),
    });
    const result = runSpecAnalyze({ cwd: dir });
    const hits = result.decisions.filter((f) => f.kind === "SPEC-STATUS-DRIFT");
    expect(hits.length).toBe(1);
    expect(hits[0]!.file).toBe("docs/specs/spec-drift-001.md");
    expect(hits[0]!.message).toContain("plan-drift-001.md");
  });

  it("does not flag when the plan is proposed or the spec is implemented", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-pair-001.md", {
      spec_id: "pair-001",
      title: "Pair",
      status: "proposed",
      created: daysAgo(1),
    });
    writePlan(dir, "plan-pair-001.md", {
      plan_id: "pair-001",
      title: "Pair",
      spec: "docs/specs/spec-pair-001.md",
      status: "proposed",
      created: daysAgo(1),
    });
    writeSpec(dir, "spec-done-001.md", {
      spec_id: "done-001",
      title: "Done",
      status: "implemented",
      created: daysAgo(1),
    });
    writePlan(dir, "plan-done-001.md", {
      plan_id: "done-001",
      title: "Done",
      spec: "docs/specs/spec-done-001.md",
      status: "implemented",
      created: daysAgo(1),
    });
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.decisions.filter((f) => f.kind === "SPEC-STATUS-DRIFT")).toEqual([]);
  });

  it("clean fixture produces no decisions findings at all", () => {
    const dir = makeRepo();
    writeExploration(dir, "exploration-ok-001.md", daysAgo(0), "<!-- placeholder -->");
    writeAdr(dir, "0001-ok.md", "Proposed", daysAgo(0));
    writeSpec(dir, "spec-ok-001.md", {
      spec_id: "ok-001",
      title: "Ok",
      status: "proposed",
      created: daysAgo(0),
    });
    writePlan(dir, "plan-ok-001.md", {
      plan_id: "ok-001",
      title: "Ok",
      spec: "docs/specs/spec-ok-001.md",
      status: "proposed",
      created: daysAgo(0),
    });
    const result = runSpecAnalyze({ cwd: dir });
    expect(result.decisions).toEqual([]);
  });

  it("single-file mode (--spec) skips the decision pass", () => {
    const dir = makeRepo();
    writeExploration(dir, "exploration-old-001.md", daysAgo(30), "<!-- ADR placeholder: x -->");
    writeSpec(dir, "spec-single-001.md", {
      spec_id: "single-001",
      title: "Single",
      status: "proposed",
      created: daysAgo(1),
    });
    const result = runSpecAnalyze({
      cwd: dir,
      spec: join(dir, "docs", "specs", "spec-single-001.md"),
    });
    expect(result.scanned).toBe(1);
    expect(result.decisions).toEqual([]);
  });

  it("never writes: every scanned decision-pipeline file is byte-identical after the run", () => {
    const dir = makeRepo();
    writeExploration(dir, "exploration-old-001.md", daysAgo(30), "<!-- ADR placeholder: x -->");
    writeAdr(dir, "0002-stale.md", "Proposed", daysAgo(60));
    writeSpec(dir, "spec-drift-001.md", {
      spec_id: "drift-001",
      title: "Drift",
      status: "proposed",
      created: daysAgo(1),
    });
    writePlan(dir, "plan-drift-001.md", {
      plan_id: "drift-001",
      title: "Drift",
      spec: "docs/specs/spec-drift-001.md",
      status: "implemented",
      created: daysAgo(1),
    });
    const paths = [
      join(dir, "docs", "explorations", "exploration-old-001.md"),
      join(dir, "docs", "adr", "0002-stale.md"),
      join(dir, "docs", "specs", "spec-drift-001.md"),
      join(dir, "docs", "plans", "plan-drift-001.md"),
    ];
    const before = paths.map((p) => readFileSync(p, "utf8"));
    runSpecAnalyze({ cwd: dir });
    expect(paths.map((p) => readFileSync(p, "utf8"))).toEqual(before);
  });
});

describe("decision-gap findings (CLI contract)", () => {
  it("--json emits the additive decisions bucket, exit 0 with findings, schemaVersion unchanged", () => {
    const dir = makeRepo();
    writeExploration(dir, "exploration-old-001.md", daysAgo(30), "<!-- ADR placeholder: x -->");
    writeAdr(dir, "0002-stale.md", "Proposed", daysAgo(60));
    writeSpec(dir, "spec-drift-001.md", {
      spec_id: "drift-001",
      title: "Drift",
      status: "proposed",
      created: daysAgo(1),
    });
    writePlan(dir, "plan-drift-001.md", {
      plan_id: "drift-001",
      title: "Drift",
      spec: "docs/specs/spec-drift-001.md",
      status: "implemented",
      created: daysAgo(1),
    });
    const run = runCli(["spec", "analyze", "--json"], dir);
    expect(run.status).toBe(0);
    const payload = JSON.parse(run.stdout) as {
      ok: boolean;
      schemaVersion: number;
      findings: { decisions: Array<Record<string, unknown>> };
    };
    expect(payload.ok).toBe(true);
    expect(payload.schemaVersion).toBe(1);
    const kinds = payload.findings.decisions.map((f) => f.kind).sort();
    expect(kinds).toEqual([
      "DECISION-PENDING-EXPLORATION",
      "SPEC-STATUS-DRIFT",
      "STALE-PROPOSED-ADR",
    ]);
    const pending = payload.findings.decisions.find(
      (f) => f.kind === "DECISION-PENDING-EXPLORATION",
    ) as Record<string, unknown>;
    expect(pending).toMatchObject({
      file: "docs/explorations/exploration-old-001.md",
      severity: "warn",
    });
    expect(pending).toHaveProperty("message");
  });

  it("human output lists the [KIND] tags and still exits 0", () => {
    const dir = makeRepo();
    writeExploration(dir, "exploration-old-001.md", daysAgo(30), "<!-- ADR placeholder: x -->");
    writeAdr(dir, "0002-stale.md", "Proposed", daysAgo(60));
    const run = runCli(["spec", "analyze"], dir);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("[DECISION-PENDING-EXPLORATION]");
    expect(run.stdout).toContain("[STALE-PROPOSED-ADR]");
    expect(run.stdout).toContain("report only, nothing was edited");
  });
});
