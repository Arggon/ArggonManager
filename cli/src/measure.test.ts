import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync as _mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  createMeasurementTree,
  evaluateBudget,
  formatBudgetLines,
  measureBudget,
  measureMcpSchema,
  buildMcpSchemaBudget,
  cliCommand,
  AGENTS_MD_BUDGET_BYTES,
  FIXTURE_TASK_COUNT,
  MCP_TOOLS_BUDGET_BYTES,
  MCP_TOOLS_BASELINE_BYTES,
} from "./measure.js";
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
  it("measures all ADR 0006 surfaces with the baseline method, deterministically bounded", async () => {
    const m = await measureBudget();
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

  it("creates a unique measurement tree per run under the given root", () => {
    const root = mkdtempSync(join(tmpdir(), "arggon-budget-unit-"));
    const first = createMeasurementTree(root);
    const second = createMeasurementTree(root);
    try {
      expect(first).not.toBe(second); // mkdtemp: no shared tree between runs
      const prefix = join(root, `arggon-budget-${process.pid}-`);
      expect(first.startsWith(prefix)).toBe(true); // owned by this process
      expect(second.startsWith(prefix)).toBe(true);
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });

  it("always deletes the measurement temp tree (private root; no shared-path globbing)", async () => {
    // bug-measure-tmp-hygiene-flake: the run's tree lives under a root owned by
    // this test, so the assertion cannot see — or delete — the in-flight trees
    // of sibling suites on the same machine (the old script globbed
    // ${TMPDIR:-/tmp}/arggon-budget-* and flagged exactly those).
    const root = mkdtempSync(join(tmpdir(), "arggon-budget-hygiene-"));
    await measureBudget({ tmpRoot: root });
    expect(readdirSync(root)).toEqual([]);
  }, 60_000);

  it("two concurrent runs in one root never interfere (race regression)", async () => {
    // bug-measure-tmp-hygiene-flake regression: a sibling run's in-flight tree
    // (here `sibling`, created before the runs) must survive untouched, and
    // each of the two concurrent runs must remove only its own tree.
    const root = mkdtempSync(join(tmpdir(), "arggon-budget-race-"));
    const sibling = mkdtempSync(join(root, "arggon-budget-sibling-"));
    const [a, b] = await Promise.all([
      measureBudget({ tmpRoot: root }),
      measureBudget({ tmpRoot: root }),
    ]);
    expect(a.fixtureItems).toBe(FIXTURE_TASK_COUNT + 3);
    expect(b.fixtureItems).toBe(FIXTURE_TASK_COUNT + 3);
    expect(existsSync(sibling)).toBe(true); // never deleted by a sibling run
    expect(readdirSync(root)).toEqual([basename(sibling)]); // only own trees removed
  }, 120_000);

  it("reports the init --full tree as an advisory line with numeric growth vs the baseline", async () => {
    const m = await measureBudget();
    const lines = formatBudgetLines(m);
    const treeLine = lines.find((l) => l.includes("init --full tree"));
    expect(treeLine).toBeDefined();
    // Advisory number present, plus a signed numeric delta vs the 43,694 B baseline.
    expect(treeLine).toMatch(/init --full tree: [\d,]+ B/);
    expect(treeLine).toMatch(/[+-]\d+\.\d+% vs the 2026-09-14 baseline \(43,694 B\)/);
    expect(treeLine).not.toContain("FAIL"); // advisory: no hard budget
  }, 60_000);

  it("evaluateBudget checks the generated AGENTS.md against the 2048 B budget", async () => {
    const m = await measureBudget();
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
      budget?: {
        generatedAgentsMdBytes: number;
        listCompactBytes: number;
        listFullBytes: number;
        showBytes: number;
        mcp?: {
          toolCount: number;
          totalBytes: number;
          tokenEstimate: number;
          largestTools: unknown[];
        };
      };
      budgetError?: string;
    };
    expect(body.ok).toBe(true);
    expect(body.budgetError).toBeUndefined();
    expect(body.budget).toBeDefined();
    expect(body.budget!.generatedAgentsMdBytes).toBeLessThanOrEqual(AGENTS_MD_BUDGET_BYTES);
    expect(body.budget!.listFullBytes).toBeGreaterThan(body.budget!.listCompactBytes);
    expect(body.budget!.showBytes).toBeGreaterThan(0);
    // task-schema-budget: the MCP schema dimension rides in the same payload.
    expect(body.budget!.mcp).toBeDefined();
    expect(body.budget!.mcp!.toolCount).toBeGreaterThan(0);
    expect(body.budget!.mcp!.totalBytes).toBeGreaterThan(0);
    expect(body.budget!.mcp!.largestTools.length).toBeGreaterThan(0);
  }, 60_000);

  it("resolves the CLI from the RUNNING installation: doctor --json --budget works from an adopter tree outside the repo (bug-budget-adopter-trees)", () => {
    // Adopter simulation: init a throwaway tree elsewhere, then run doctor
    // --json --budget with THAT tree as cwd. The CLI binary is located via the
    // same import.meta.url resolution the product code uses (cliCommand), so
    // the assertion covers the resolution, not the test's own repo layout.
    const cmd = cliCommand();
    const adopter = mkdtempSync(join(tmpdir(), "arggon-budget-adopter-"));
    try {
      const init = spawnSync(cmd.file, [...cmd.args, "init", "--full", "--json"], {
        encoding: "utf8",
        cwd: adopter,
      });
      expect(init.status).toBe(0);
      const doctor = spawnSync(cmd.file, [...cmd.args, "doctor", "--json", "--budget"], {
        encoding: "utf8",
        cwd: adopter,
      });
      expect(doctor.status).toBe(0);
      const body = JSON.parse(doctor.stdout) as {
        ok: boolean;
        budget?: unknown;
        budgetError?: string;
      };
      expect(body.ok).toBe(true);
      expect(body.budgetError).toBeUndefined(); // the reported casa-pendiente failure
      expect(body.budget).toBeDefined();
    } finally {
      rmSync(adopter, { recursive: true, force: true });
    }
  }, 60_000);

  it("runDoctor itself stays synchronous and budget-free; the CLI action attaches the budget", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-measure-"));
    const result = runDoctor({ cwd: dir });
    expect(result.initialized).toBe(false);
    expect(result.budget).toBeUndefined(); // attached by the CLI action when --budget is passed
  });
});

describe("MCP tool-schema budget (task-schema-budget)", () => {
  it("buildMcpSchemaBudget sizes deterministic fixture tools exactly", () => {
    const toolA = {
      name: "arggon_alpha",
      inputSchema: { type: "object", properties: { x: { type: "string" } } },
    };
    const toolB = { name: "arggon_beta", inputSchema: { type: "object" } };
    const budget = buildMcpSchemaBudget([toolA, toolB]);
    expect(budget.toolCount).toBe(2);
    expect(budget.totalBytes).toBe(
      Buffer.byteLength(JSON.stringify(toolA), "utf8") +
        Buffer.byteLength(JSON.stringify(toolB), "utf8"),
    );
    expect(budget.tokenEstimate).toBe(Math.round(budget.totalBytes / 4));
    expect(budget.largestTools[0]).toEqual({
      name: "arggon_alpha",
      bytes: Buffer.byteLength(JSON.stringify(toolA), "utf8"),
    });
    expect(budget.largestTools).toHaveLength(2);
  });

  it("buildMcpSchemaBudget caps the largest-tools list at 3, descending", () => {
    const tools = [1, 2, 3, 4].map((n) => ({
      name: `arggon_tool_${n}`,
      inputSchema: { description: "x".repeat(n * 10) },
    }));
    const budget = buildMcpSchemaBudget(tools);
    expect(budget.largestTools).toHaveLength(3);
    const bytes = budget.largestTools.map((t) => t.bytes);
    expect([...bytes].sort((a, b) => b - a)).toEqual(bytes); // descending
    expect(budget.largestTools[0]!.name).toBe("arggon_tool_4"); // biggest fixture schema
  });

  it("evaluateBudget checks the live tools/list against the advisory 12 KiB budget", async () => {
    const m = await measureBudget();
    expect(m.mcp.toolCount).toBe(9); // the live surface (mcp-parity.test.ts wraps the same 9 commands)
    expect(m.mcp.totalBytes).toBeGreaterThan(MCP_TOOLS_BASELINE_BYTES - 2_000); // near the recorded baseline
    const checks = evaluateBudget(m);
    const mcpCheck = checks.find((c) => c.name === "mcp tools/list")!;
    expect(mcpCheck.budget).toBe(MCP_TOOLS_BUDGET_BYTES);
    expect(mcpCheck.withinBudget).toBe(true); // live surface is within the advisory cap
    const lines = formatBudgetLines(m);
    const mcpLine = lines.find((l) => l.includes("mcp tools/list:"))!;
    expect(mcpLine).toContain(`(budget ${MCP_TOOLS_BUDGET_BYTES} B: pass)`);
    expect(mcpLine).toContain("tok (~chars/4)");
    expect(lines.join("\n")).toContain("mcp tools/list (largest): arggon_");
  }, 60_000);

  it("measureMcpSchema reads the LIVE server surface (never a copied schema list)", async () => {
    const budget = await measureMcpSchema();
    expect(budget.toolCount).toBe(9);
    expect(budget.totalBytes).toBeGreaterThan(0);
    expect(budget.largestTools[0]!.name).toMatch(/^arggon_/);
  }, 60_000);
});
