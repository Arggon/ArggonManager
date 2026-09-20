/**
 * `arggon doctor --budget` measurement surface (task-adr0006-remeasure, ADR
 * 0006 consequence "re-measure all surfaces after 1-4 land"). Doctor is the
 * report-only charter holder, so the budget section lives there; this module
 * MEASURES the agent-facing surfaces with the 2026-09-14 baseline method
 * (exploration-token-context-efficiency-001) so numbers stay comparable:
 *
 * - a fresh `init --full` in a throwaway temp tree (deleted afterwards),
 *   sized total — mirrors the baseline's "fresh adopter" table;
 * - the generated AGENTS.md bytes (budget: <=2048 B, task-adr0006-docs-budget);
 * - a fixture `list --json` payload, BOTH compact default and `--full`, so
 *   the compact-envelope saving stays visible (baseline: 60.7 KB un-compact);
 * - a `show <id> --json` output (baseline method had no show; measured now);
 * - the live MCP tools/list payload (task-schema-budget), fetched in-process
 *   against runMcpServer the same way mcp-parity.test.ts does — the LIVE
 *   surface, never a copy-pasted schema list.
 *
 * Pure report: everything is created under a temp dir that is always removed.
 * Runs the real CLI from the RUNNING installation (tsx from source in the
 * repo, the installed dist/cli.js in adopter trees — bug-budget-adopter-trees)
 * so bytes are what an agent actually receives.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";

/** Generated-docs context budget (ADR 0006 direction 4; init-docs.test.ts). */
export const AGENTS_MD_BUDGET_BYTES = 2048;

/**
 * MCP tool-schema budget (task-schema-budget). Live baseline measured
 * 2026-09-15 against the in-process tools/list: 9 tools, 9,040 B of tool
 * definitions (~2,260 tok at ~chars/4) — the item brief's "~4.7 KB" was an
 * early estimate; the LIVE surface is the baseline of record. Advisory cap at
 * 12 KiB: ~36% headroom over the baseline, enough for several new tools or
 * schema growth without letting the 50K-token bloat spiral (Towards AI 2026)
 * start unnoticed. Advisory (no hard cap): report-only budget section.
 */
export const MCP_TOOLS_BUDGET_BYTES = 12_288;

/**
 * Live tools/list bytes at baseline commit 5d6c504 (2026-09-15), reproduced
 * two ways: that commit's own `doctor --budget` and an independent stdio
 * `tools/list` sum of `JSON.stringify(tool)` lengths (both 9,040 B, 9 tools,
 * ~2,260 tok at ~chars/4).
 */
export const MCP_TOOLS_BASELINE_BYTES = 9_040;

export type McpToolBytes = {
  /** MCP tool name (e.g. arggon_update). */
  name: string;
  /** Serialized tool-definition bytes as an agent receives them. */
  bytes: number;
};

export type McpSchemaBudget = {
  /** Number of tools the MCP server exposes. */
  toolCount: number;
  /** Total tools/list payload bytes (the tool definitions themselves). */
  totalBytes: number;
  /** Token estimate (~chars/4 — the same method as the baseline tables). */
  tokenEstimate: number;
  /** Largest tools by definition bytes, descending, top 3. */
  largestTools: McpToolBytes[];
};

/**
 * Fresh `init --full` tree at the 2026-09-14 baseline (ADR 0006 re-measure).
 * Advisory reference only (no hard cap): the total-tree line reports growth
 * against it so 18%-style drift stays visible (task-agents-md-budget-headroom).
 */
export const INIT_TREE_BASELINE_BYTES = 43_694;

/** Fixture shape: 1 initiative + 1 epic + 1 story + 5 tasks, 1 comment — deterministic. */
export const FIXTURE_TASK_COUNT = 5;

export type BudgetResult = {
  /** Total bytes of a fresh `init --full` tree (temp dir, deleted after). */
  initTreeBytes: number;
  /** Generated AGENTS.md bytes (ADR 0006 budget: <=2048). */
  generatedAgentsMdBytes: number;
  /** `list --json` payload bytes over the fixture (compact default). */
  listCompactBytes: number;
  /** `list --json --full` payload bytes over the same fixture. */
  listFullBytes: number;
  /** `show <id> --json` output bytes (compact view) for the fixture task. */
  showBytes: number;
  /** Fixture item count the list payloads cover. */
  fixtureItems: number;
  /** Live MCP tools/list measurement (task-schema-budget). */
  mcp: McpSchemaBudget;
};

export type BudgetCheck = {
  /** Surface name (mirrors the baseline method tables). */
  name: string;
  bytes: number;
  /** Stated budget in bytes, when the surface has one. */
  budget?: number;
  /** Whether the surface is within its budget (only when budget is set). */
  withinBudget?: boolean;
  note?: string;
};

/**
 * CLI invocation resolved from the RUNNING installation (bug-budget-adopter-
 * trees), never from the measured tree's cwd: from source (tsx, the repo
 * charter) when this module is cli/src/measure.ts, or from the installed
 * dist/cli.js of the executing arggon otherwise (adopter trees have no
 * cli/src — the measurement must work identically there). The measured tree
 * is only the SUBJECT (cwd of the spawned commands); the CLI binary always
 * comes from the running installation.
 */
export function cliCommand(): { file: string; args: string[] } {
  const modulePath = fileURLToPath(import.meta.url);
  const runningFromSource = modulePath.endsWith(`${sep}src${sep}measure.ts`);
  if (runningFromSource) {
    const repoRoot = resolve(dirname(modulePath), "../..");
    return {
      file: process.execPath,
      args: [
        join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
        join(repoRoot, "cli", "src", "cli.ts"),
      ],
    };
  }
  return { file: process.execPath, args: [resolve(dirname(modulePath), "cli.js")] };
}

function runCli(args: string[], cwd: string): string {
  const cmd = cliCommand();
  const proc = spawnSync(cmd.file, [...cmd.args, ...args], {
    encoding: "utf8",
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (proc.status !== 0) {
    throw new Error(`arggon ${args.join(" ")} failed (exit ${proc.status}): ${proc.stderr.trim()}`);
  }
  return proc.stdout;
}

/** Recursively sum file bytes under dir (init tree total; mirrors baseline method). */
function treeBytes(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) total += treeBytes(abs);
    else total += statSync(abs).size;
  }
  return total;
}

/** Signed percent growth of the init tree vs the baseline (advisory; 1 dp). */
export function treeGrowthPct(bytes: number): string {
  const pct = ((bytes - INIT_TREE_BASELINE_BYTES) / INIT_TREE_BASELINE_BYTES) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}`;
}

/**
 * Pure budget math over fetched tool definitions (task-schema-budget): total
 * bytes, ~chars/4 token estimate, and the largest tools. Exported separately
 * so tests can drive it with deterministic fixtures.
 */
export function buildMcpSchemaBudget(
  tools: Array<{ name: string; inputSchema?: Record<string, unknown> }>,
): McpSchemaBudget {
  const sized = tools.map((tool) => ({
    name: tool.name,
    bytes: Buffer.byteLength(JSON.stringify(tool), "utf8"),
  }));
  const totalBytes = sized.reduce((sum, t) => sum + t.bytes, 0);
  return {
    toolCount: tools.length,
    totalBytes,
    tokenEstimate: Math.round(totalBytes / 4),
    largestTools: [...sized].sort((a, b) => b.bytes - a.bytes).slice(0, 3),
  };
}

/**
 * Fetch the LIVE tool definitions from an in-process MCP server and size them
 * (task-schema-budget). Same pattern as mcp-parity.test.ts: raw JSON-RPC
 * tools/list over PassThrough streams against runMcpServer — the live public
 * surface, never a copied schema list.
 */
export async function measureMcpSchema(): Promise<McpSchemaBudget> {
  const { runMcpServer } = await import("./mcp-server.js");
  const input = new PassThrough();
  const output = new PassThrough();
  runMcpServer({ cwd: process.cwd(), input, output });
  const responsePromise = new Promise<Record<string, unknown>>((resolveResponse) => {
    output.on("data", (chunk: Buffer) => resolveResponse(JSON.parse(chunk.toString("utf8"))));
  });
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
  const response = await responsePromise;
  const tools = (
    response.result as { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> }
  ).tools;
  return buildMcpSchemaBudget(tools);
}

/**
 * Measure all agent-facing surfaces. Creates a throwaway `init --full` tree
 * under os.tmpdir(), creates the deterministic fixture inside it, measures,
 * and ALWAYS removes the temp tree (the repo's /tmp hygiene history).
 */
export async function measureBudget(): Promise<BudgetResult> {
  const cmd = cliCommand();
  const cliEntry = cmd.args[cmd.args.length - 1];
  if (!existsSync(cliEntry)) {
    throw new Error(
      `budget measurement runs the CLI from the running installation — entry not found: ${cliEntry}`,
    );
  }
  const dir = mkdtempSync(join(tmpdir(), "arggon-budget-"));
  try {
    runCli(["init", "--full", "--json"], dir);
    const agentsMd = join(dir, "AGENTS.md");
    const generatedAgentsMdBytes = statSync(agentsMd).size;

    // Deterministic fixture: initiative -> epic -> story -> N tasks.
    const created = (line: string): string => {
      const m = line.match(/"id":"([^"]+)"/);
      if (!m) throw new Error(`could not read id from create output: ${line.slice(0, 200)}`);
      return m[1];
    };
    // First stdout line is the envelope; ids are unique per type stem here.
    const initiativeId = created(
      runCli(["create", "initiative", "budget fixture", "--json"], dir).trim(),
    );
    const epicId = created(
      runCli(
        ["create", "epic", "budget fixture epic", "--parent", initiativeId, "--json"],
        dir,
      ).trim(),
    );
    const storyId = created(
      runCli(["create", "story", "budget fixture story", "--parent", epicId, "--json"], dir).trim(),
    );
    let firstTask = "";
    for (let i = 1; i <= FIXTURE_TASK_COUNT; i++) {
      const out = runCli(
        ["create", "task", `budget fixture task ${i}`, "--parent", storyId, "--json"],
        dir,
      ).trim();
      const id = created(out);
      if (!firstTask) firstTask = id;
    }
    runCli(["comment", firstTask, "fixture comment so show has content", "--json"], dir);

    const listCompactBytes = Buffer.byteLength(runCli(["list", "--json"], dir), "utf8");
    const listFullBytes = Buffer.byteLength(runCli(["list", "--json", "--full"], dir), "utf8");
    const showBytes = Buffer.byteLength(runCli(["show", firstTask, "--json"], dir), "utf8");
    const mcp = await measureMcpSchema();

    return {
      initTreeBytes: treeBytes(dir),
      generatedAgentsMdBytes,
      listCompactBytes,
      listFullBytes,
      showBytes,
      fixtureItems: FIXTURE_TASK_COUNT + 3,
      mcp,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Evaluate a measurement against the ADR 0006 budgets (pure; report-only). */
export function evaluateBudget(m: BudgetResult): BudgetCheck[] {
  return [
    {
      name: "init --full tree",
      bytes: m.initTreeBytes,
      note:
        `fresh adopter tree; advisory (no hard budget) — ` +
        `${treeGrowthPct(m.initTreeBytes)}% vs the 2026-09-14 baseline (${INIT_TREE_BASELINE_BYTES.toLocaleString("en-US")} B)`,
    },
    {
      name: "generated AGENTS.md",
      bytes: m.generatedAgentsMdBytes,
      budget: AGENTS_MD_BUDGET_BYTES,
      withinBudget: m.generatedAgentsMdBytes <= AGENTS_MD_BUDGET_BYTES,
      note: "ADR 0006 direction 4 budget (<=2048 B)",
    },
    {
      name: "list --json (compact)",
      bytes: m.listCompactBytes,
      note: `${m.fixtureItems}-item fixture; compact default per ADR 0006 direction 1`,
    },
    {
      name: "list --json --full",
      bytes: m.listFullBytes,
      note: "same fixture; --full restores null/empty fields (baseline shape)",
    },
    {
      name: "show --json",
      bytes: m.showBytes,
      note: "bounded single-item read (ADR 0006 direction 3); unbounded before show existed",
    },
    {
      name: "mcp tools/list",
      bytes: m.mcp.totalBytes,
      budget: MCP_TOOLS_BUDGET_BYTES,
      withinBudget: m.mcp.totalBytes <= MCP_TOOLS_BUDGET_BYTES,
      note:
        `${m.mcp.toolCount} tools, ~${m.mcp.tokenEstimate.toLocaleString("en-US")} tok (~chars/4); ` +
        `advisory (task-schema-budget) — live baseline ${MCP_TOOLS_BASELINE_BYTES.toLocaleString("en-US")} B (2026-09-15)`,
    },
  ];
}

/** Human lines appended to the doctor report when --budget is set. */
export function formatBudgetLines(m: BudgetResult): string[] {
  const lines = [
    `  budget (ADR 0006, fixture ${m.fixtureItems} items, method: 2026-09-14 baseline):`,
  ];
  for (const check of evaluateBudget(m)) {
    let line = `    ${check.name}: ${check.bytes.toLocaleString("en-US")} B`;
    if (check.budget !== undefined) {
      line += ` (budget ${check.budget} B: ${check.withinBudget ? "pass" : "FAIL"})`;
      // The MCP schema budget carries its live-baseline reference inline even
      // when budgeted (task-schema-budget) so growth is comparable, not just
      // pass/fail.
      if (check.note) line += ` — ${check.note}`;
    } else if (check.note) {
      // Advisory surfaces (no hard budget) carry their reference inline —
      // e.g. the init tree's growth vs the baseline (task-agents-md-budget-headroom).
      line += ` — ${check.note}`;
    }
    lines.push(line);
  }
  lines.push(
    `    compact-envelope saving: ${(m.listFullBytes - m.listCompactBytes).toLocaleString("en-US")} B ` +
      "per fixture list (null/empty fields omitted)",
  );
  const largest = m.mcp.largestTools
    .map((t) => `${t.name} ${t.bytes.toLocaleString("en-US")} B`)
    .join(", ");
  lines.push(`    mcp tools/list (largest): ${largest}`);
  return lines;
}
