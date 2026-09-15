import { spawnSync } from "node:child_process";
import { mkdtempSync as _mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateBudget, formatBudgetLines, measureBudget, AGENTS_MD_BUDGET_BYTES } from "./measure.js";
import { runDoctor } from "./doctor.js";

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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(repoRoot, "cli/src/cli.ts");
const tsx = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

describe("budget measurement (task-adr0006-remeasure, ADR 0006)", () => {
  it("measures all ADR 0006 surfaces with the baseline method, deterministically bounded", () => {
    const m = measureBudget();
    // Present + numeric, under stated bounds where stable (loose asserts).
    expect(m.initTreeBytes).toBeGreaterThan(30_000); // baseline was 43,694 B
    expect(m.generatedAgentsMdBytes).toBeGreaterThan(500);
    expect(m.generatedAgentsMdBytes).toBeLessThanOrEqual(AGENTS_MD_BUDGET_BYTES); // ADR 0006 dir 4
    expect(m.fixtureItems).toBe(8); // 1 initiative + 1 epic + 1 story + 5 tasks
    expect(m.listCompactBytes).toBeGreaterThan(0);
    expect(m.listFullBytes).toBeGreaterThan(m.listCompactBytes); // --full restores omitted fields
    expect(m.showBytes).toBeGreaterThan(0);
    expect(m.showBytes).toBeLessThan(2_048); // bounded read (ADR 0006 dir 3)
  }, 60_000);

  it("always deletes the measurement temp tree (/tmp hygiene)", () => {
    measureBudget();
    const leftovers = spawnSync("bash", ["-c", "ls -d ${TMPDIR:-/tmp}/arggon-budget-* 2>/dev/null || true"], {
      encoding: "utf8",
    });
    expect(leftovers.stdout.trim()).toBe("");
  }, 60_000);

  it("reports the init --full tree as an advisory line with numeric growth vs the baseline", () => {
    const m = measureBudget();
    const lines = formatBudgetLines(m);
    const treeLine = lines.find((l) => l.includes("init --full tree"));
    expect(treeLine).toBeDefined();
    // Advisory number present, plus a signed numeric delta vs the 43,694 B baseline.
    expect(treeLine).toMatch(/init --full tree: [\d,]+ B/);
    expect(treeLine).toMatch(/[+-]\d+\.\d+% vs the 2026-09-14 baseline \(43,694 B\)/);
    expect(treeLine).not.toContain("FAIL"); // advisory: no hard budget
  }, 60_000);

  it("evaluateBudget checks the generated AGENTS.md against the 2048 B budget", () => {
    const m = measureBudget();
    const checks = evaluateBudget(m);
    const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
    expect(byName["generated AGENTS.md"].budget).toBe(2048);
    expect(byName["generated AGENTS.md"].withinBudget).toBe(true);
    const lines = formatBudgetLines(m);
    expect(lines.join("\n")).toContain("(budget 2048 B: pass)");
    expect(lines.join("\n")).toContain("compact-envelope saving");
  }, 60_000);

  it("is wired through the CLI: doctor --json --budget carries a budget section; plain doctor --json does not", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-measure-"));
    const plain = runCli(["doctor", "--json"], dir);
    expect(plain.status).toBe(0);
    const plainBody = JSON.parse(plain.stdout) as Record<string, unknown>;
    expect(plainBody.ok).toBe(true);
    expect(plainBody.budget).toBeUndefined(); // additive: absent without --budget

    const withBudget = runCli(["doctor", "--json", "--budget"], dir);
    expect(withBudget.status).toBe(0);
    const body = JSON.parse(withBudget.stdout) as {
      ok: boolean;
      command: string;
      budget?: { generatedAgentsMdBytes: number; listCompactBytes: number; listFullBytes: number; showBytes: number };
      budgetError?: string;
    };
    expect(body.ok).toBe(true);
    expect(body.budgetError).toBeUndefined();
    expect(body.budget).toBeDefined();
    expect(body.budget!.generatedAgentsMdBytes).toBeLessThanOrEqual(AGENTS_MD_BUDGET_BYTES);
    expect(body.budget!.listFullBytes).toBeGreaterThan(body.budget!.listCompactBytes);
    expect(body.budget!.showBytes).toBeGreaterThan(0);
  }, 60_000);

  it("runDoctor supports the budget flag directly (best-effort, still exit-0 charter)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-measure-"));
    const result = runDoctor({ cwd: dir, budget: true });
    expect(result.initialized).toBe(false); // temp dir is not initialized...
    expect(result.budget).toBeDefined(); // ...but the measurement uses its own temp tree
    expect(result.budget!.generatedAgentsMdBytes).toBeGreaterThan(0);
  }, 60_000);
});
