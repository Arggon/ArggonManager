#!/usr/bin/env node
/**
 * V2 context-surface report (plan-opencode2-009 W6, task-opencode2-context).
 *
 * Measures the per-session context a real adopter tree pays after `arggon init`
 * and prints it as a table (or JSON with `--json`). Report-only, NO model calls:
 * the only network/process work is the local CLI, git history and an in-process
 * MCP tools/list reached through `arggon doctor --budget --json`.
 *
 * Measured surfaces (fixture = `arggon init` in a temp tree):
 *   1. generated `AGENTS.md` bytes (budget <=2048 B, test-enforced elsewhere);
 *   2. the advertised skill entries (frontmatter name/description as V2 lists
 *      them) and the on-demand load: umbrella `SKILL.md` vs `references/*.md`;
 *   3. agent descriptions + full prompt bytes (READ-only assessment: the agent
 *      templates are owned by another worker, never edited here);
 *   4. the live MCP `tools/list` payload (reused from `doctor --budget --json`,
 *      advisory budget <=12,288 B, task-schema-budget);
 *   5. the injected item block: the plugin's own `ITEM_BLOCK_MAX_BYTES` bound
 *      and `buildItemBlock()` reused from `opencode/plugins/arggon/index.ts`
 *      (so the number cannot drift from the shipped helper), measured on the
 *      fixture items and cited against the W3 smoke evidence (181-204 B);
 *   6. the generated compaction `keep.tokens`;
 *   7. before/after for the W5 skill split: the last pre-split `SKILL.md` is
 *      reconstructed from git history (`git log -- skills/arggon-cli/SKILL.md`,
 *      the newest revision whose tree has no `references/`), override with
 *      `CONTEXT_REPORT_BEFORE_REV=<rev>`.
 *
 * Token heuristic: bytes / 4, the stated ADR 0006 baseline method (never exact).
 *
 * Exit codes: 0 report written (budgets flagged inline, like `doctor
 * --budget`); 1 measurement failed; with `--strict`, 1 when any enforced/
 * advisory bound is exceeded too. `--strict` is a manual/release gate, NOT
 * wired into CI: over the test suite it adds the advisory MCP `tools/list`
 * size (schema drift, not a product regression) and the generated compaction
 * `keep.tokens` regression check (expected 15,000; no suite test enforces
 * it). `ARGON_CONTEXT_REPORT_KEEP=1` keeps the fixture for inspection.
 *
 * Pure helpers (frontmatter, stripJsonComments, pad) are exported for
 * `smoke/context-report.test.ts`; the report body only runs when this file is
 * the process entrypoint.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGENTS_MD_BUDGET_BYTES,
  MCP_TOOLS_BASELINE_BYTES,
  MCP_TOOLS_BUDGET_BYTES,
  type BudgetResult,
} from "../cli/src/measure.js";
import {
  ARGON_TOOL_NAMESPACE,
  ITEM_BLOCK_MAX_BYTES,
  buildItemBlock,
  nativeToolsCatalogBytes,
  nativeToolSchemas,
} from "../opencode/plugins/arggon/index.js";

/** W3 measured injected-block range (task-opencode-v2-plugin, 2026-09-18). */
export const W3_ITEM_BLOCK_RANGE_BYTES = { min: 181, max: 204 } as const;

/**
 * Native tool-schema advisory bound (native-first W2, task-native-tools): the
 * same 12,288 B advisory the MCP `tools/list` surface uses (task-schema-budget),
 * applied to the tool-definition payload the Code Mode catalog is built from —
 * namespace description plus one definition per tool. The runtime renders it as
 * a one-line-per-tool catalog and caps the whole catalog at its own ~2000-token
 * budget (omitted tools stay reachable through `search`), so this payload is the
 * stable, runtime-free measure of what the wave adds.
 */
export const NATIVE_TOOLS_BUDGET_BYTES = 12_288;

/** Compaction retention the generated config ships (V2 default, see template). */
export const GENERATED_KEEP_TOKENS = 15_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(repoRoot, "cli/src/cli.ts");
const TSX = join(repoRoot, "node_modules/tsx/dist/cli.mjs");

/** Repo-relative paths of the W5 skill split, used for history detection. */
const SKILL_PATH = "skills/arggon-cli/SKILL.md";
const REFERENCES_DIR = "skills/arggon-cli/references";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const strict = args.includes("--strict");
const keepFixture = process.env.ARGON_CONTEXT_REPORT_KEEP === "1";

const bytes = (text: string): number => Buffer.byteLength(text, "utf8");
const tokens = (count: number): number => Math.round(count / 4);
const fmt = (count: number): string => count.toLocaleString("en-US");

type RunResult = { status: number | null; stdout: string; stderr: string };

function run(command: string, argv: string[], cwd: string): RunResult {
  const proc = spawnSync(command, argv, {
    cwd,
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ARGON_ITEM: undefined },
  });
  return { status: proc.status, stdout: proc.stdout ?? "", stderr: proc.stderr ?? "" };
}

/** Run the CLI from source (the installed `arggon` bin may lag the checkout). */
function arggon(argv: string[], cwd: string): string {
  const result = run(process.execPath, [TSX, CLI, ...argv], cwd);
  if (result.status !== 0) {
    throw new Error(`arggon ${argv.join(" ")} failed (exit ${result.status}): ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function parseJson<T>(stdout: string, what: string): T {
  try {
    return JSON.parse(stdout) as T;
  } catch {
    throw new Error(`could not parse ${what} JSON from: ${stdout.slice(0, 200)}`);
  }
}

/** Item id from a `create`/`update` envelope (falls back to the id regex). */
function createdId(stdout: string): string {
  const match = stdout.match(/"id":"([^"]+)"/);
  if (match === null) throw new Error(`no id in output: ${stdout.slice(0, 200)}`);
  return match[1];
}

type Frontmatter = { name?: string; description?: string };

/** Single-line YAML frontmatter fields the report needs (name, description). */
export function frontmatter(raw: string): Frontmatter {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "---");
  if (start === -1) return {};
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  const found: Frontmatter = {};
  for (const line of lines.slice(start + 1, end)) {
    const match = /^(name|description):\s*(.+?)\s*$/.exec(line);
    if (match !== null) found[match[1] as keyof Frontmatter] = match[2];
  }
  return found;
}

/** Strip JSONC `//` and `/* *\/` comments without touching string values. */
export function stripJsonComments(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === "/" && raw[i + 1] === "/") {
      while (i < raw.length && raw[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (char === "/" && raw[i + 1] === "*") {
      i += 2;
      while (i < raw.length && !(raw[i] === "*" && raw[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }
    out += char;
  }
  return out;
}

type SkillEntry = {
  id: string;
  name: string;
  description: string;
  descriptionBytes: number;
  skillBytes: number;
  references: Array<{ path: string; bytes: number }>;
};

/** Advertised skill entries from the generated `.agents/skills/` tree. */
function readSkillEntries(fixture: string): SkillEntry[] {
  const skillsDir = join(fixture, ".agents/skills");
  const entries = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return entries.map((id) => {
    const dir = join(skillsDir, id);
    const raw = readFileSync(join(dir, "SKILL.md"), "utf8");
    const meta = frontmatter(raw);
    const references: Array<{ path: string; bytes: number }> = [];
    const refDir = join(dir, "references");
    if (readdirSync(dir).includes("references")) {
      for (const file of readdirSync(refDir).sort()) {
        references.push({
          path: `references/${file}`,
          bytes: statSync(join(refDir, file)).size,
        });
      }
    }
    return {
      id,
      name: meta.name ?? id,
      description: meta.description ?? "",
      descriptionBytes: bytes(meta.description ?? ""),
      skillBytes: bytes(raw),
      references,
    };
  });
}

type AgentEntry = { id: string; description: string; descriptionBytes: number; fileBytes: number };

/** Generated `.opencode/agents/*.md` — descriptions advertised, full file = prompt. */
function readAgentEntries(fixture: string): AgentEntry[] {
  const agentsDir = join(fixture, ".opencode/agents");
  return readdirSync(agentsDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(agentsDir, file), "utf8");
      const meta = frontmatter(raw);
      return {
        id: basename(file, ".md"),
        description: meta.description ?? "",
        descriptionBytes: bytes(meta.description ?? ""),
        fileBytes: bytes(raw),
      };
    });
}

type BeforeAfter = {
  beforeRev: string;
  beforeBytes: number;
  beforeDescription: string;
  umbrellaBytes: number;
  referencesBytes: number;
  fullBytes: number;
};

type BeforeAfterResult =
  { available: true; beforeAfter: BeforeAfter } | { available: false; reason: string };

/**
 * Reference files present in a revision's own tree. Empty means the revision
 * predates the W5 split; detection scans the revision's whole reference set,
 * never one hardcoded file (F4, PR #329 review). A missing/unresolvable rev
 * also lists nothing, and the subsequent `git show` skips it.
 */
function revisionReferences(rev: string): string[] {
  const listed = run("git", ["ls-tree", "-r", "--name-only", rev, "--", REFERENCES_DIR], repoRoot);
  if (listed.status !== 0 || listed.stdout.trim() === "") return [];
  return listed.stdout.trim().split("\n");
}

/**
 * Reconstruct the pre-W5 single `SKILL.md`: walk the commits that touched the
 * file and take the newest revision whose tree has no `references/` directory.
 * Never throws: outside a usable history, or on a pre-split working tree
 * (bisect/revert) where the after side cannot be measured, it returns an
 * explicit reason that the report prints as "unavailable".
 */
function reconstructBeforeAfter(): BeforeAfterResult {
  const umbrella = join(repoRoot, SKILL_PATH);
  const refDir = join(repoRoot, REFERENCES_DIR);
  if (!existsSync(umbrella) || !existsSync(refDir)) {
    return {
      available: false,
      reason:
        `working tree has no ${SKILL_PATH} + ${REFERENCES_DIR}/ pair ` +
        "(pre-W5 checkout?): the after side cannot be measured",
    };
  }
  const log = run("git", ["log", "--format=%H", "--", SKILL_PATH], repoRoot);
  if (log.status !== 0 || log.stdout.trim() === "") {
    return { available: false, reason: `no git history for ${SKILL_PATH}` };
  }
  const revisions = [
    process.env.CONTEXT_REPORT_BEFORE_REV,
    ...log.stdout.trim().split("\n"),
  ].filter((rev): rev is string => typeof rev === "string" && rev !== "");
  for (const rev of revisions) {
    if (revisionReferences(rev).length > 0) continue;
    const show = run("git", ["show", `${rev}:${SKILL_PATH}`], repoRoot);
    if (show.status !== 0) continue;
    const umbrellaBytes = statSync(umbrella).size;
    const referencesBytes = readdirSync(refDir)
      .map((file) => statSync(join(refDir, file)).size)
      .reduce((sum, size) => sum + size, 0);
    return {
      available: true,
      beforeAfter: {
        beforeRev: rev,
        beforeBytes: bytes(show.stdout),
        beforeDescription: frontmatter(show.stdout).description ?? "",
        umbrellaBytes,
        referencesBytes,
        fullBytes: umbrellaBytes + referencesBytes,
      },
    };
  }
  return {
    available: false,
    reason:
      `no revision of ${SKILL_PATH} without a references/ tree in the available history ` +
      "(shallow clone?)",
  };
}

type Measurement = {
  date: string;
  fixture: string;
  projectName: string;
  tokenHeuristic: string;
  agentsMd: { bytes: number; budget: number; pass: boolean };
  skills: SkillEntry[];
  agents: AgentEntry[];
  mcp: {
    toolCount: number;
    totalBytes: number;
    tokenEstimate: number;
    budget: number;
    baselineBytes: number;
    pass: boolean;
    largestTools: BudgetResult["mcp"]["largestTools"];
  };
  nativeTools: {
    namespace: string;
    toolCount: number;
    bytes: number;
    budget: number;
    pass: boolean;
  };
  itemBlock: {
    boundBytes: number;
    measuredBytes: number[];
    w3Evidence: { min: number; max: number; source: string };
    pass: boolean;
  };
  compaction: { keepTokens: number; v2Default: number };
  fixedTotalBytes: number;
  skillBeforeAfter: BeforeAfter | null;
  /** Why `skillBeforeAfter` is null (pre-W5 checkout, shallow clone, no history). */
  skillBeforeAfterUnavailable: string | null;
  doctor: BudgetResult;
  regressions: string[];
};

function measure(): Measurement {
  const tempRoot = mkdtempSync(join(tmpdir(), "arggon-context-"));
  // Fixed basename => deterministic {{PROJECT_NAME}} render: AGENTS.md bytes
  // are reproducible run to run (the mkdtemp suffix itself is not rendered).
  const fixture = join(tempRoot, "ctx-fixture");
  mkdirSync(fixture, { recursive: true });
  const regressions: string[] = [];
  try {
    run("git", ["init", "-q"], fixture);
    run("git", ["config", "user.email", "context-report@example.com"], fixture);
    run("git", ["config", "user.name", "context-report"], fixture);
    arggon(["init", "--json"], fixture);

    // Deterministic small tracker: initiative -> epic -> story -> 2 tasks.
    const initiative = createdId(arggon(["create", "initiative", "ctx fixture", "--json"], fixture));
    const epic = createdId(
      arggon(["create", "epic", "ctx fixture epic", "--parent", initiative, "--json"], fixture),
    );
    const story = createdId(
      arggon(["create", "story", "ctx fixture story", "--parent", epic, "--json"], fixture),
    );
    const claimed = createdId(
      arggon(["create", "task", "ctx claimed task", "--parent", story, "--json"], fixture),
    );
    const open = createdId(
      arggon(["create", "task", "ctx open task", "--parent", story, "--json"], fixture),
    );
    arggon(
      [
        "update",
        claimed,
        "--status",
        "in_progress",
        "--assignee",
        "ctx-worker",
        "--branch",
        "feat/ctx-fixture",
        "--json",
      ],
      fixture,
    );

    // Item blocks through the shipped plugin helper: bound and measured range.
    const itemBlockBytes: number[] = [];
    for (const id of [open, claimed]) {
      const shown = parseJson<{ item?: Record<string, unknown> }>(
        arggon(["show", id, "--meta", "--json"], fixture),
        "show",
      );
      if (shown.item === undefined) throw new Error(`show ${id} returned no item`);
      itemBlockBytes.push(buildItemBlock(shown.item, { currentDirectory: fixture }).bytes);
    }
    const itemBlockPass = itemBlockBytes.every((size) => size <= ITEM_BLOCK_MAX_BYTES);
    if (!itemBlockPass) {
      regressions.push(
        `injected item block ${fmt(Math.max(...itemBlockBytes))} B > bound ${fmt(ITEM_BLOCK_MAX_BYTES)} B`,
      );
    }

    // Kernel surfaces reused from the doctor budget (live MCP tools/list).
    const doctor = parseJson<{ budget?: BudgetResult; budgetError?: string }>(
      arggon(["doctor", "--json", "--budget"], fixture),
      "doctor --budget",
    );
    if (doctor.budget === undefined) {
      throw new Error(`doctor --budget produced no budget: ${doctor.budgetError ?? "unknown error"}`);
    }

    const agentsMdBytes = statSync(join(fixture, "AGENTS.md")).size;
    const skills = readSkillEntries(fixture);
    const agents = readAgentEntries(fixture);
    const agentsMdPass = agentsMdBytes <= AGENTS_MD_BUDGET_BYTES;
    if (!agentsMdPass) {
      regressions.push(
        `generated AGENTS.md ${fmt(agentsMdBytes)} B > budget ${fmt(AGENTS_MD_BUDGET_BYTES)} B`,
      );
    }
    if (doctor.budget.mcp.totalBytes > MCP_TOOLS_BUDGET_BYTES) {
      regressions.push(
        `MCP tools/list ${fmt(doctor.budget.mcp.totalBytes)} B > advisory ${fmt(MCP_TOOLS_BUDGET_BYTES)} B`,
      );
    }

    const config = JSON.parse(
      stripJsonComments(readFileSync(join(fixture, "opencode.jsonc"), "utf8")),
    ) as { compaction?: { keep?: { tokens?: number } } };
    const keepTokens = config.compaction?.keep?.tokens ?? 0;
    if (keepTokens !== GENERATED_KEEP_TOKENS) {
      regressions.push(
        `generated compaction keep.tokens ${fmt(keepTokens)} != expected ${fmt(GENERATED_KEEP_TOKENS)}`,
      );
    }

    // Native tool namespace (native-first W2): the definitions payload the
    // Code Mode catalog is built from, straight from the shipped definitions.
    const nativeToolsBytes = nativeToolsCatalogBytes();
    const nativeToolsPass = nativeToolsBytes <= NATIVE_TOOLS_BUDGET_BYTES;
    if (!nativeToolsPass) {
      regressions.push(
        `native ${ARGON_TOOL_NAMESPACE} tools ${fmt(nativeToolsBytes)} B > advisory ${fmt(NATIVE_TOOLS_BUDGET_BYTES)} B`,
      );
    }

    const beforeAfter = reconstructBeforeAfter();

    return {
      date: new Date().toISOString().slice(0, 10),
      fixture,
      projectName: basename(fixture),
      tokenHeuristic: "bytes/4 (~chars/4, ADR 0006 baseline method; stated, never exact)",
      agentsMd: {
        bytes: agentsMdBytes,
        budget: AGENTS_MD_BUDGET_BYTES,
        pass: agentsMdPass,
      },
      skills,
      agents,
      mcp: {
        toolCount: doctor.budget.mcp.toolCount,
        totalBytes: doctor.budget.mcp.totalBytes,
        tokenEstimate: doctor.budget.mcp.tokenEstimate,
        budget: MCP_TOOLS_BUDGET_BYTES,
        baselineBytes: MCP_TOOLS_BASELINE_BYTES,
        pass: doctor.budget.mcp.totalBytes <= MCP_TOOLS_BUDGET_BYTES,
        largestTools: doctor.budget.mcp.largestTools,
      },
      itemBlock: {
        boundBytes: ITEM_BLOCK_MAX_BYTES,
        measuredBytes: itemBlockBytes,
        w3Evidence: {
          min: W3_ITEM_BLOCK_RANGE_BYTES.min,
          max: W3_ITEM_BLOCK_RANGE_BYTES.max,
          source: "task-opencode-v2-plugin W3, 2026-09-18",
        },
        pass: itemBlockPass,
      },
      nativeTools: {
        namespace: ARGON_TOOL_NAMESPACE,
        toolCount: nativeToolSchemas().length,
        bytes: nativeToolsBytes,
        budget: NATIVE_TOOLS_BUDGET_BYTES,
        pass: nativeToolsPass,
      },
      compaction: { keepTokens, v2Default: GENERATED_KEEP_TOKENS },
      fixedTotalBytes:
        agentsMdBytes +
        skills.reduce((sum, skill) => sum + skill.descriptionBytes, 0) +
        agents.reduce((sum, agent) => sum + agent.descriptionBytes, 0) +
        doctor.budget.mcp.totalBytes +
        nativeToolsBytes,
      skillBeforeAfter: beforeAfter.available ? beforeAfter.beforeAfter : null,
      skillBeforeAfterUnavailable: beforeAfter.available ? null : beforeAfter.reason,
      doctor: doctor.budget,
      regressions,
    };
  } finally {
    if (!keepFixture) rmSync(tempRoot, { recursive: true, force: true });
  }
}

/**
 * Pad to `width`. Cells longer than the column are truncated with an ellipsis
 * so an over-width label can never run into the next column (F5, PR #329
 * review).
 */
export function pad(text: string, width: number): string {
  if (text.length > width) return `${text.slice(0, width - 1)}…`;
  return text + " ".repeat(width - text.length);
}

function printReport(m: Measurement): void {
  const rows: Array<[string, string, string, string, string]> = [];
  const push = (surface: string, size: string, tok: string, bound: string, status: string): void => {
    rows.push([surface, size, tok, bound, status]);
  };

  console.log(`ArggonManager V2 context report - ${m.date}`);
  console.log(`fixture: ${m.fixture} (arggon init, project name "${m.projectName}")`);
  console.log(`method: generated bytes as a V2 session receives them; tokens = ${m.tokenHeuristic}`);
  console.log("        kernel surfaces (list/show/MCP) reused from `arggon doctor --budget --json`");
  console.log("");
  console.log("per-session fixed surface");
  push("surface", "bytes", "~tok", "bound", "status");
  push(
    "generated AGENTS.md",
    fmt(m.agentsMd.bytes),
    String(tokens(m.agentsMd.bytes)),
    `<=${fmt(m.agentsMd.budget)} B`,
    m.agentsMd.pass ? "pass" : "FAIL",
  );
  for (const skill of m.skills) {
    push(
      `skill entry ${skill.id} (description)`,
      fmt(skill.descriptionBytes),
      String(tokens(skill.descriptionBytes)),
      "-",
      "-",
    );
  }
  push(
    `agent descriptions (${m.agents.length})`,
    fmt(m.agents.reduce((sum, agent) => sum + agent.descriptionBytes, 0)),
    String(tokens(m.agents.reduce((sum, agent) => sum + agent.descriptionBytes, 0))),
    "-",
    "-",
  );
  const mcpGrowth = m.mcp.totalBytes - m.mcp.baselineBytes;
  const mcpGrowthPct = ((mcpGrowth / m.mcp.baselineBytes) * 100).toFixed(1);
  const growthSign = mcpGrowth >= 0 ? "+" : "";
  push(
    `MCP tools/list (${m.mcp.toolCount} tools)`,
    fmt(m.mcp.totalBytes),
    String(m.mcp.tokenEstimate),
    `<=${fmt(m.mcp.budget)} B adv.`,
    m.mcp.pass ? `pass (${growthSign}${fmt(mcpGrowth)} B (${growthSign}${mcpGrowthPct}%) vs baseline)` : "FAIL",
  );
  push(
    `native ${m.nativeTools.namespace} tools (${m.nativeTools.toolCount})`,
    fmt(m.nativeTools.bytes),
    String(tokens(m.nativeTools.bytes)),
    `<=${fmt(m.nativeTools.budget)} B adv.`,
    m.nativeTools.pass ? "pass" : "FAIL",
  );
  const measuredBlock = Math.max(...m.itemBlock.measuredBytes);
  push(
    "injected item block (measured max)",
    fmt(measuredBlock),
    String(tokens(measuredBlock)),
    `<=${fmt(m.itemBlock.boundBytes)} B`,
    m.itemBlock.pass ? "pass" : "FAIL",
  );
  const fixedTotal = m.fixedTotalBytes;
  push(
    "fixed per-session total",
    fmt(fixedTotal),
    String(tokens(fixedTotal)),
    "-",
    "-",
  );
  push(
    "compaction keep.tokens (retained)",
    `${fmt(m.compaction.keepTokens)} tok`,
    "-",
    `V2 default ${fmt(m.compaction.v2Default)}`,
    "keep",
  );
  // The first column grows to its longest label (min 38, +2 gap) so a long
  // skill id cannot run into the bytes column; `pad` truncates as a backstop.
  const surfaceWidth = Math.max(38, ...rows.map(([surface]) => surface.length + 2));
  console.log(
    rows
      .map(
        ([surface, size, tok, bound, status]) =>
          `  ${pad(surface, surfaceWidth)}${pad(size, 11)}${pad(tok, 8)}${pad(bound, 18)}${status}`,
      )
      .join("\n"),
  );
  console.log(
    `  native ${m.nativeTools.namespace} tools: ${m.nativeTools.toolCount} definitions, ${fmt(m.nativeTools.bytes)} B ` +
      `(definitions payload the Code Mode catalog is built from, reused from the plugin helper; the runtime renders ` +
      `one catalog line per tool under its own ~2000-token catalog budget — omitted tools stay reachable via search)`,
  );
  console.log(
    `  item block: bound ${fmt(m.itemBlock.boundBytes)} B = ITEM_BLOCK_MAX_BYTES reused from the plugin helper ` +
      `(buildItemBlock); fixture items ${m.itemBlock.measuredBytes.join(" B / ")} B; W3 smoke evidence ` +
      `${m.itemBlock.w3Evidence.min}-${m.itemBlock.w3Evidence.max} B (${m.itemBlock.w3Evidence.source})`,
  );

  console.log("");
  console.log("on-demand loads (skill progressive disclosure)");
  for (const skill of m.skills) {
    console.log(
      `  ${pad(`skill ${skill.id}`, 38)}${pad(fmt(skill.skillBytes), 11)}${tokens(skill.skillBytes)} tok  (umbrella SKILL.md, read on skill load)`,
    );
    for (const ref of skill.references) {
      console.log(
        `    ${pad(ref.path, 36)}${pad(fmt(ref.bytes), 11)}${tokens(ref.bytes)} tok  (read on demand)`,
      );
    }
  }
  const before = m.skillBeforeAfter;
  if (before !== null) {
    console.log("");
    console.log("before/after: W5 skill split (source bytes, before marker stamping)");
    console.log(`  before  ${before.beforeRev.slice(0, 12)} skills/arggon-cli/SKILL.md`);
    console.log(
      `          ${pad(fmt(before.beforeBytes), 11)}${tokens(before.beforeBytes)} tok  always loaded (single file)`,
    );
    console.log(
      `  after   umbrella ${pad(fmt(before.umbrellaBytes), 11)}${tokens(before.umbrellaBytes)} tok  always loaded`,
    );
    console.log(
      `          references ${fmt(before.referencesBytes)} B total, each read only when the task needs it`,
    );
    console.log(
      `          full content ${fmt(before.fullBytes)} B (${before.fullBytes >= before.beforeBytes ? "+" : "-"}${fmt(Math.abs(before.fullBytes - before.beforeBytes))} B vs before)`,
    );
    const saved = before.beforeBytes - before.umbrellaBytes;
    const pct = ((saved / before.beforeBytes) * 100).toFixed(0);
    console.log(
      `  on-load delta: ${fmt(saved)} B (-${pct}%) per skill-aware session`,
    );
    console.log(
      `  reconstruct: git log --oneline -- skills/arggon-cli/SKILL.md; git show ${before.beforeRev}:skills/arggon-cli/SKILL.md | wc -c`,
    );
  } else {
    console.log("");
    console.log(
      `before/after: unavailable (${m.skillBeforeAfterUnavailable ?? "reason not recorded"})`,
    );
  }

  if (m.agents.length > 0) {
    console.log("");
    console.log("agent prompts (READ-only assessment; templates owned by another item)");
    for (const agent of m.agents) {
      console.log(
        `  ${pad(agent.id, 38)}${pad(fmt(agent.fileBytes), 11)}${tokens(agent.fileBytes)} tok  (prompt file; description ${agent.descriptionBytes} B)`,
      );
    }
  }

  console.log("");
  console.log("doctor cross-check (doctor's own init --full tree):");
  console.log(
    `  AGENTS.md ${fmt(m.doctor.generatedAgentsMdBytes)} B, list compact ${fmt(m.doctor.listCompactBytes)} B, ` +
      `list full ${fmt(m.doctor.listFullBytes)} B, show ${fmt(m.doctor.showBytes)} B, MCP ${fmt(m.doctor.mcp.totalBytes)} B ` +
      `(live baseline ${fmt(m.mcp.baselineBytes)} B, 2026-09-15)`,
  );
  console.log("");
  if (m.regressions.length === 0) {
    console.log("verdict: all bounds pass");
  } else {
    console.log(`verdict: ${m.regressions.length} REGRESSION(S) beyond the agreed bounds:`);
    for (const regression of m.regressions) console.log(`  - ${regression}`);
  }
}

/**
 * True when this module is the process entrypoint. The unit tests import the
 * pure helpers above; without the guard that import would run the whole
 * report (spawning the CLI, git and the fixture) as a side effect.
 */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  const measurement = measure();
  if (asJson) {
    console.log(JSON.stringify(measurement, null, 2));
  } else {
    printReport(measurement);
  }
  if (strict && measurement.regressions.length > 0) process.exitCode = 1;
}
