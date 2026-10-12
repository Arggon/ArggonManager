/**
 * `init --agents` / `--no-agents` + `doctor --agents` (spec §S2,
 * task-adapter-selection-flags).
 *
 * The shape of these tests is a FIXTURE MATRIX: one table of flag combinations
 * × expected written/skipped adapter artifacts, asserted against the real tree
 * (files on disk) AND the `--json` `adapters` block (what was reported), plus
 * the two never-do contracts that the matrix alone cannot express — an unknown
 * agent name is refused by name rather than silently ignored, and an
 * adopter-edited generated file is never overwritten.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readGeneratedState } from "@arggondev/lib";
import { afterEach, describe, expect, it } from "vitest";
import {
  AGENT_IDS,
  agentForTemplate,
  detectAgents,
  MAX_ADAPTER_ARTIFACTS,
  parseAgentList,
  resolveAgentSelection,
} from "./adapters.js";
import { currentGeneratedTemplates, GENERATED_DOC_COUNT } from "./docs.js";
import { dryRunInit, runInit, type InitOptions, type InitResult } from "./init.js";
import { formatDoctorReport, runDoctor } from "./doctor.js";
import { runCli } from "./test-spawn.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tempDir(): string {
  const dir = _mkdtempSync(join(tmpdir(), "arggon-agents-"));
  tmpDirs.push(dir);
  return dir;
}

/**
 * Every adapter destination, grouped by the agent that owns it — read from the
 * ONE classifier the generator and doctor both use (`agentForTemplate`), so
 * this table cannot drift from what a run actually writes.
 */
const BY_AGENT: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const { dest, template } of currentGeneratedTemplates({ layout: "arggon-manager" })) {
    const agent = agentForTemplate(template);
    if (agent === null) continue;
    (out[agent] ??= []).push(dest);
  }
  for (const key of Object.keys(out)) {
    // Same comparator as doctor's per-agent file rows (localeCompare), so the
    // fixture order matches the report order — a case-sensitive `.sort()`
    // puts an uppercase entry (e.g. the seam README.md) ahead of the
    // lowercase directories and reads as a membership diff.
    out[key]!.sort((a, b) => a.localeCompare(b));
  }
  return out;
})();

const ALL_ADAPTER_DESTS = AGENT_IDS.flatMap((agent) => BY_AGENT[agent] ?? []);
/** Adapter artifacts per agent, asserted to be non-zero so a silent rename fails here. */
const PER_AGENT_COUNT: Record<string, number> = Object.fromEntries(
  AGENT_IDS.map((agent) => [agent, (BY_AGENT[agent] ?? []).length]),
);

/** Docs+CLI outputs that are NOT adapter seams — the always-complete floor. */
const NON_ADAPTER_DOCS = ["AGENTS.md", "CONTRIBUTING.md", "SECURITY.md", ".editorconfig"];

function existsIn(root: string, rel: string): boolean {
  return existsSync(join(root, ...rel.split("/")));
}

/**
 * Remove one destination's `x-generated` entry from the convention file, so a
 * fixture can be the "on disk with NO provenance state" case (F1) — the pre-init
 * adopter tree. Operates on the block by indentation: the key line plus every
 * following line indented deeper than it.
 */
function dropStateEntry(convention: string, dest: string): string {
  const lines = convention.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`  ${dest}:`));
  if (start === -1) return convention;
  let end = start + 1;
  while (end < lines.length && (lines[end].startsWith("    ") || lines[end] === "")) end++;
  return [...lines.slice(0, start), ...lines.slice(end)].join("\n");
}

/**
 * Mark one destination's recorded entry `acknowledged: true` — what
 * `arggon adopt --ack` does over every entry (bug-ack-baseline-regen-loss). The
 * recorded checksum stays the as-written baseline, which is what makes the
 * acknowledged / acknowledged-drifted split meaningful.
 */
function ackState(dir: string, dest: string): void {
  const convention = join(dir, "ArggonManager/.convention.yml");
  const lines = readFileSync(convention, "utf8").split("\n");
  const start = lines.findIndex((line) => line.startsWith(`  ${dest}:`));
  expect(start, `${dest} must carry provenance to be acked`).toBeGreaterThan(-1);
  // The block runs until the next line that is not indented deeper than the key.
  let end = start + 1;
  while (end < lines.length && lines[end].startsWith("    ")) end++;
  const block = lines.slice(start, end);
  expect(
    block.some((line) => line.startsWith("    acknowledged:")),
    `${dest} already acknowledged`,
  ).toBe(false);
  // Replace the block in one splice with its own length — the recorded checksum
  // stays the as-written baseline, which is what makes the acknowledged /
  // acknowledged-drifted split meaningful.
  lines.splice(start, block.length, ...block, "    acknowledged: true");
  writeFileSync(convention, lines.join("\n"), "utf8");
}

/** Destinations of `agent` that this run actually wrote to disk. */
function onDisk(root: string, agent: string): string[] {
  // localeCompare: the comparator BY_AGENT itself is sorted with (matches
  // doctor's file-row order), not a case-sensitive `.sort()` that would rank
  // an uppercase entry (the seam README.md) ahead of lowercase directories.
  return (BY_AGENT[agent] ?? []).filter((rel) => existsIn(root, rel)).sort((a, b) =>
    a.localeCompare(b),
  );
}

/** The `adapters` rows for one agent in an init result. */
function rowsFor(result: InitResult, agent: string) {
  return result.adapters.artifacts.filter((a) => a.agent === agent);
}

describe("adapter selection: registry", () => {
  it("knows every agent the spec lists, and each owns a non-empty seam", () => {
    expect([...AGENT_IDS]).toEqual(["claude", "opencode", "zcode"]);
    for (const agent of AGENT_IDS) {
      expect(PER_AGENT_COUNT[agent] ?? 0, `agent ${agent} owns no artifact`).toBeGreaterThan(0);
    }
  });

  it("classifies each agent's seam by template id and nothing else", () => {
    // The opencode seam: config + agents + commands + the vendored plugin pair.
    expect(BY_AGENT.opencode).toContain("opencode.jsonc");
    expect(BY_AGENT.opencode).toContain(".opencode/agents/arggon-maker.md");
    expect(BY_AGENT.opencode).toContain(".opencode/plugins/arggon/index.ts");
    // zcode: the whole vendored marketplace, nothing outside it.
    expect(BY_AGENT.zcode.some((d) => d.startsWith(".zcode-marketplace/"))).toBe(true);
    expect(BY_AGENT.zcode.some((d) => !d.startsWith(".zcode-marketplace/"))).toBe(false);
    // claude: the CLAUDE.md pointer shim and the .mcp.json registration — the
    // two surfaces an init'd tree hands that client today (spec §S6 is the
    // follow-on that adds a bundle).
    expect(BY_AGENT.claude).toEqual([".mcp.json", "CLAUDE.md"]);
    // A plain generated doc is nobody's adapter artifact.
    expect(agentForTemplate("docs/AGENTS.md")).toBeNull();
    expect(agentForTemplate("docs/docs/engineering.md")).toBeNull();
    expect(agentForTemplate("skills/arggon-cli/SKILL.md")).toBeNull();
  });

  it("the bundled skill is NOT an adapter seam (agent-agnostic, always generated)", () => {
    expect(ALL_ADAPTER_DESTS.some((d) => d.startsWith(".agents/skills/"))).toBe(false);
  });

  it("parseAgentList accepts a known list, dedupes, normalizes case", () => {
    expect(parseAgentList("opencode,zcode")).toEqual(["opencode", "zcode"]);
    expect(parseAgentList("OpenCode, opencode ,zcode")).toEqual(["opencode", "zcode"]);
  });

  it("parseAgentList refuses an unknown name BY NAME (never silently ignored)", () => {
    // The spec's own list is the authority: a typo must fail loudly rather
    // than install a different seam than the operator asked for.
    expect(() => parseAgentList("opencode,cursor")).toThrow(/unknown agent "cursor"/);
    expect(() => parseAgentList("cursor")).toThrow(/unknown agent "cursor"/);
    // The message must also say what IS valid, so the fix is one read away.
    expect(() => parseAgentList("cursor")).toThrow(/claude, opencode, zcode/);
    expect(() => parseAgentList("  ")).toThrow(/--agents needs at least one agent name/);
  });

  it("detects an agent only from its own tree markers", () => {
    const dir = tempDir();
    expect(detectAgents(dir)).toEqual([]);
    mkdirSync(join(dir, ".opencode"), { recursive: true });
    expect(detectAgents(dir)).toEqual(["opencode"]);
    writeFileSync(join(dir, "opencode.jsonc"), "{}\n", "utf8");
    writeFileSync(join(dir, "CLAUDE.md"), "# c\n", "utf8");
    expect(detectAgents(dir)).toEqual(["claude", "opencode"]);
    mkdirSync(join(dir, ".zcode-marketplace"), { recursive: true });
    expect(detectAgents(dir)).toEqual(["claude", "opencode", "zcode"]);
  });

  it("refuses --agents together with --no-agents (two contradictory selections)", () => {
    expect(() =>
      resolveAgentSelection({ root: tempDir(), agents: "opencode", noAgents: true }),
    ).toThrow(/--no-agents does not combine with --agents/);
  });

  it("defaults to every known agent on a tree with no marker, and says why", () => {
    const selection = resolveAgentSelection({ root: tempDir() });
    expect(selection.mode).toBe("detect");
    expect(selection.detected).toEqual([]);
    expect(selection.selected).toEqual([...AGENT_IDS].sort());
    expect(selection.reason).toMatch(/no agent marker in this tree/);
  });

  it("defaults to the DETECTED agents once a marker exists (spec S2)", () => {
    const dir = tempDir();
    mkdirSync(join(dir, ".zcode-marketplace"), { recursive: true });
    const selection = resolveAgentSelection({ root: dir });
    expect(selection.mode).toBe("detect");
    expect(selection.detected).toEqual(["zcode"]);
    expect(selection.selected).toEqual(["zcode"]);
  });
});

describe("adapter selection: init flag matrix", () => {
  /**
   * The matrix, one case per meaningful flag combination. `selected` is the
   * expectation; the assertion then checks BOTH surfaces an operator relies on:
   * which files exist on disk, and which rows the `--json` block reports.
   */
  // `opts` is the FLAG part only; `dir`/`force` are filled in per case, so the
  // row states exactly what it varies and nothing else can drift into it.
  const MATRIX: { name: string; opts: Partial<InitOptions>; selected: string[] }[] = [
    { name: "no flag on a fresh tree (every known agent)", opts: {}, selected: [...AGENT_IDS] },
    { name: "--agents opencode", opts: { agents: "opencode" }, selected: ["opencode"] },
    { name: "--agents zcode", opts: { agents: "zcode" }, selected: ["zcode"] },
    { name: "--agents claude", opts: { agents: "claude" }, selected: ["claude"] },
    {
      name: "--agents opencode,zcode",
      opts: { agents: "opencode,zcode" },
      selected: ["opencode", "zcode"],
    },
    {
      name: "--agents opencode,zcode,claude",
      opts: { agents: "opencode,zcode,claude" },
      selected: [...AGENT_IDS],
    },
    { name: "--no-agents", opts: { noAgents: true }, selected: [] },
  ];

  for (const row of MATRIX) {
    it(`writes exactly the selected seams: ${row.name}`, () => {
      const dir = tempDir();
      const result = runInit({ dir, force: false, ...row.opts });

      expect(result.adapters.selection.mode).toBe(
        "noAgents" in row.opts ? "none" : "agents" in row.opts ? "select" : "detect",
      );
      expect(result.adapters.selection.selected).toEqual(row.selected.sort());

      for (const agent of AGENT_IDS) {
        const dests = BY_AGENT[agent] ?? [];
        const onDiskForAgent = onDisk(dir, agent);
        if (row.selected.includes(agent)) {
          // Every selected artifact materialized — no silent partial seam.
          expect(onDiskForAgent, `agent ${agent} dests on disk`).toEqual(dests);
          for (const artifact of rowsFor(result, agent)) {
            expect(artifact.outcome, `${agent}:${artifact.path}`).toBe("written");
          }
        } else {
          expect(onDiskForAgent, `agent ${agent} must not be materialized`).toEqual([]);
          for (const artifact of rowsFor(result, agent)) {
            expect(artifact.outcome, `${agent}:${artifact.path}`).toBe("skipped");
            expect(artifact.reason, `${agent}:${artifact.path} reason`).toMatch(
              /adapter not selected/,
            );
          }
        }
      }

      // counts are honest: every adapter destination is accounted for exactly once.
      const total = AGENT_IDS.reduce((n, agent) => n + (BY_AGENT[agent]?.length ?? 0), 0);
      expect(result.adapters.counts.total).toBe(total);
      expect(result.adapters.counts.written + result.adapters.counts.skipped).toBe(total);
      const selectedTotal = row.selected.reduce(
        (n, agent) => n + (BY_AGENT[agent]?.length ?? 0),
        0,
      );
      expect(result.adapters.counts.written).toBe(selectedTotal);
      // The per-artifact detail is capped, but this bundle is far below the cap,
      // so nothing is cut here — a cap regression must be visible.
      expect(result.adapters.truncated).toBe(false);
      expect(result.adapters.artifacts.length).toBe(total);
      expect(MAX_ADAPTER_ARTIFACTS).toBeGreaterThanOrEqual(total);
    });
  }

  it("--no-agents still generates the docs+CLI floor (adapters are enhancers)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, noAgents: true });
    for (const doc of NON_ADAPTER_DOCS) {
      expect(existsIn(dir, doc), `${doc} must survive --no-agents`).toBe(true);
    }
    expect(existsIn(dir, "ArggonManager/.convention.yml")).toBe(true);
    expect(ALL_ADAPTER_DESTS.some((d) => existsIn(dir, d))).toBe(false);
  });

  it("the default run is byte-identical to a pre-flag tree (no flag = no change)", () => {
    // The strongest form of the "additive" claim: with no adapter flag, a fresh
    // init produces exactly the same file set as the explicit all-agents run.
    const plain = tempDir();
    const explicit = tempDir();
    runInit({ dir: plain, force: false });
    runInit({ dir: explicit, force: false, agents: "opencode,zcode,claude" });
    const list = (dir: string): string[] =>
      currentGeneratedTemplates({ layout: "arggon-manager" })
        .map((t) => t.dest)
        .filter((rel) => existsIn(dir, rel))
        .sort();
    expect(list(plain)).toEqual(list(explicit));
    // Both wrote the same number of generated docs — no seam quietly dropped.
    expect(readFileSync(join(plain, "ArggonManager/.convention.yml"), "utf8")).toContain(
      "x-generated:",
    );
    expect(GENERATED_DOC_COUNT).toBeGreaterThan(ALL_ADAPTER_DESTS.length);
  });

  it("honors the selection on a RE-INIT too (the already-initialized path, F4)", () => {
    // The re-init branch of `planInit` is a separate `planGenerateDocs` call
    // site: passing the selection to the fresh-scaffold one proves nothing about
    // this one, and deleting the argument here left the whole suite green. So
    // the assertions go through the second run.
    const dir = tempDir();
    runInit({ dir, force: false });
    // An adopter deleting a generated seam file, then re-running with a narrower
    // selection: init must NOT restore the unselected agent's file, and must not
    // disturb the selected one.
    const dropped = ".zcode-marketplace/marketplace.json";
    rmSync(join(dir, ...dropped.split("/")));
    const selected = ".opencode/agents/arggon-maker.md";
    const keptBytes = readFileSync(join(dir, ...selected.split("/")), "utf8");

    const rerun = runInit({ dir, force: false, agents: "opencode" });
    expect(existsIn(dir, dropped), "an unselected seam must not be restored").toBe(false);
    expect(readFileSync(join(dir, ...selected.split("/")), "utf8")).toBe(keptBytes);
    expect(rerun.adapters.selection.mode).toBe("select");
    // The selected seam is refreshed (untouched files regenerate by design), and
    // the deleted unselected one is reported as skipped — not silently restored.
    const droppedRow = rerun.adapters.artifacts.find((a) => a.path === dropped)!;
    expect(droppedRow.outcome).toBe("skipped");
    expect(droppedRow.reason).toMatch(/adapter not selected/);
    expect(rerun.adapters.counts.written).toBe(PER_AGENT_COUNT.opencode);

    // The same through the CLI, and through --no-agents, where the restore must
    // stay off as well.
    const proc = runCli(["--json", "init", ".", "--no-agents"], dir);
    expect(proc.status).toBe(0);
    expect(JSON.parse(proc.stdout).adapters.selection.mode).toBe("none");
    expect(existsIn(dir, dropped), "--no-agents must not restore it either").toBe(false);

    // And widening the selection is what DOES materialize the missing seam.
    const widened = runInit({ dir, force: false, agents: "opencode,zcode" });
    expect(existsIn(dir, dropped), "a widened selection materializes the seam").toBe(true);
    expect(widened.adapters.counts.written).toBeGreaterThanOrEqual(1);
  });

  it("reports the selection default honestly when a marker narrows it", () => {
    const dir = tempDir();
    // An adopter's own ZCode marketplace, no init: detection must see it.
    mkdirSync(join(dir, ".zcode-marketplace"), { recursive: true });
    const result = runInit({ dir, force: false });
    expect(result.adapters.selection.detected).toEqual(["zcode"]);
    expect(result.adapters.selection.selected).toEqual(["zcode"]);
    expect(onDisk(dir, "zcode").length).toBeGreaterThan(0);
    expect(onDisk(dir, "opencode")).toEqual([]);
    expect(onDisk(dir, "claude")).toEqual([]);
  });
});

describe("doctor --agents: per-agent report", () => {
  it("is absent without the flag (the plain envelope is unchanged)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    expect(runDoctor({ cwd: dir }).agents).toBeUndefined();
    const proc = runCli(["--json", "doctor"], dir);
    expect(proc.status).toBe(0);
    expect(JSON.parse(proc.stdout)).not.toHaveProperty("agents");
  });

  it("reports every known agent with its files and its matrix gap rows", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const report = runDoctor({ cwd: dir, agents: true }).agents;
    expect(report).toBeDefined();
    expect(report!.agents.map((a) => a.agent)).toEqual([...AGENT_IDS]);
    for (const agent of AGENT_IDS) {
      const entry = report!.agents.find((a) => a.agent === agent)!;
      // The seam exists and every one of its files is accounted for.
      expect(entry.counts.total).toBe(PER_AGENT_COUNT[agent]);
      expect(entry.detected, `${agent} detected after a full init`).toBe(true);
      expect(entry.counts.missing, `${agent} missing`).toBe(0);
      expect(entry.counts["adopter-edited"]).toBe(0);
      // One counter per status, so a new status can never vanish from the totals.
      expect(Object.keys(entry.counts).sort()).toEqual([
        "acknowledged",
        "acknowledged-drifted",
        "adopter-edited",
        "missing",
        "orphaned",
        "present",
        "stale",
        "total",
        "unverified",
      ]);
      // No orphan exists on a freshly generated tree: every recorded template is
      // still shipped, so the bucket is zero (task-adapter-orphan-reaping).
      expect(entry.counts.orphaned, `${agent} orphans after a full init`).toBe(0);
      expect(entry.truncated).toBe(false);
      // files[] is the detail behind the count, and every row names its status.
      expect(entry.files.map((f) => f.path)).toEqual(BY_AGENT[agent]);
      for (const file of entry.files) {
        // `reap` rides ONLY an orphaned row (it is the per-file remedy); a
        // present/stale/… row must not grow a field nothing reads.
        expect(Object.keys(file)).toEqual(["path", "status"]);
      }
    }
  });

  it("never calls a re-vendored plugin copy adopter-edited (init would overwrite it)", () => {
    // The vendored plugin artifacts are derived per checkout: init RE-VENDORS
    // them from the committed bundle on a provenance mismatch instead of
    // modified-skip (bug-stale-vendored-plugin-copy). Reporting `adopter-edited`
    // ("yours, never overwritten") would advertise a protection init does not
    // give them — a dishonesty the report cannot afford, since its whole value
    // is mapping a status onto the right operator action.
    const dir = tempDir();
    runInit({ dir, force: false });
    const vendored = ".opencode/plugins/arggon/index.ts";
    const state = readGeneratedState(dir) as Record<string, { checksum?: string }>;
    const recorded = state[vendored]?.checksum;
    expect(recorded, `${vendored} carries provenance`).toBeTruthy();
    // Corrupt the RECORDED state, leaving the bytes untouched: a mismatch init
    // handles by re-vendoring, not by skipping. The recorded form is
    // `sha256:<hex>`, so the whole value is replaced (asserted, or this test
    // would silently prove nothing).
    const convention = join(dir, "ArggonManager/.convention.yml");
    const before = readFileSync(convention, "utf8");
    const after = before.replace(recorded!, "sha256:" + "0".repeat(64));
    expect(after, "the recorded checksum must actually change").not.toBe(before);
    writeFileSync(convention, after, "utf8");
    const entry = runDoctor({ cwd: dir, agents: true }).agents!.agents.find(
      (a) => a.agent === "opencode",
    )!;
    const file = entry.files.find((f) => f.path === vendored)!;
    expect(file.status).not.toBe("adopter-edited");
    expect(file.status).toBe("present");
  });

  it("reports an adopter-edited file as adopter-edited, never as stale", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const victim = ".opencode/agents/arggon-maker.md";
    writeFileSync(
      join(dir, ...victim.split("/")),
      `${readFileSync(join(dir, ...victim.split("/")), "utf8")}\nADOPTER EDIT\n`,
      "utf8",
    );
    const entry = runDoctor({ cwd: dir, agents: true }).agents!.agents.find(
      (a) => a.agent === "opencode",
    )!;
    expect(entry.counts["adopter-edited"]).toBe(1);
    expect(entry.counts.stale).toBe(0);
    const file = entry.files.find((f) => f.path === victim)!;
    expect(file.status).toBe("adopter-edited");
  });

  it("reports a file with NO provenance state as adopter-edited, never as stale (F1)", () => {
    // The pre-init adopter tree — the exact case this feature targets: a repo
    // that already had `.opencode/agents/arggon-delivery-lead.md` of its own when
    // arggon first saw it. `docs.ts` classifies "on disk with no provenance
    // state" as adopter-modified and NEVER refreshes it, so `stale` (which
    // promises "arggon init would refresh it") would send the operator to a
    // command that cannot work.
    const dir = tempDir();
    const own = ".opencode/agents/arggon-delivery-lead.md";
    mkdirSync(join(dir, ...own.split("/").slice(0, -1)), { recursive: true });
    writeFileSync(join(dir, ...own.split("/")), "# the adopter's own agent\n", "utf8");
    runInit({ dir, force: false });
    // Provenance: the run recorded state for what it generated. Strip THIS one
    // dest's entry so the fixture is the no-state case (assert the strip landed,
    // or this test would silently prove nothing).
    const convention = join(dir, "ArggonManager/.convention.yml");
    const stripped = dropStateEntry(readFileSync(convention, "utf8"), own);
    expect(stripped, "the state entry must actually be removed").not.toContain(`  ${own}:`);
    writeFileSync(convention, stripped, "utf8");

    const entry = runDoctor({ cwd: dir, agents: true }).agents!.agents.find(
      (a) => a.agent === "opencode",
    )!;
    expect(entry.files.find((f) => f.path === own)!.status).toBe("adopter-edited");
    expect(entry.counts.stale, "nothing may be claimed as refreshable").toBe(0);
    // And the claim the status makes must be true: a re-run really does leave it.
    runInit({ dir, force: false });
    expect(readFileSync(join(dir, ...own.split("/")), "utf8")).toBe("# the adopter's own agent\n");
  });

  it("reports an acknowledged file as acknowledged, and an edit after the ack as acknowledged-drifted (F2b)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const acked = ".opencode/agents/arggon-standards-reviewer.md";
    const edited = ".opencode/agents/arggon-maker.md";
    // `adopt --ack` records the CURRENT bytes as the sanctioned baseline; the
    // reviewer observed that it acks EVERY state entry, so this is the NORMAL
    // state of a fully-adopted tree, not an edge case.
    ackState(dir, acked);
    ackState(dir, edited);
    // A hand edit AFTER the ack is the one case where the acknowledged branch and
    // the checksum branch disagree — which is exactly why it needs its own test:
    // moving the acknowledged check below the checksum compare keeps every other
    // test green.
    const editBaseline = readFileSync(join(dir, ...edited.split("/")), "utf8");
    writeFileSync(join(dir, ...edited.split("/")), `${editBaseline}\nLATE EDIT\n`, "utf8");

    const entry = runDoctor({ cwd: dir, agents: true }).agents!.agents.find(
      (a) => a.agent === "opencode",
    )!;
    expect(entry.files.find((f) => f.path === acked)!.status).toBe("acknowledged");
    expect(entry.files.find((f) => f.path === edited)!.status).toBe("acknowledged-drifted");
    // Neither may claim a refresh init would perform: init never regenerates an
    // acked entry, so `stale` would be a lie here.
    expect(entry.counts.stale).toBe(0);
    // …and neither is a hand edit: the sanctioned, reversible `adopt --ack` is
    // the way to take one, not an un-ack-able divergence.
    expect(entry.counts["adopter-edited"], "an acked file is not an adopter edit").toBe(0);
    // The mirror-image contract in the same envelope: the `docs` block calls the
    // same files acknowledged / acknowledgedDrifted.
    const docs = runDoctor({ cwd: dir }).docs;
    expect(docs.acknowledged).toBeGreaterThanOrEqual(1);
    expect(docs.acknowledgedDrifted).toBeGreaterThanOrEqual(1);
    // Acked content is still never regenerated by init.
    runInit({ dir, force: false });
    expect(readFileSync(join(dir, ...edited.split("/")), "utf8")).toBe(
      `${editBaseline}\nLATE EDIT\n`,
    );
  });

  it("reports a missing seam as missing rather than as a failure", () => {
    const dir = tempDir();
    runInit({ dir, force: false, agents: "opencode" });
    const entry = runDoctor({ cwd: dir, agents: true }).agents!.agents.find(
      (a) => a.agent === "zcode",
    )!;
    expect(entry.detected).toBe(false);
    expect(entry.counts.total).toBe(PER_AGENT_COUNT.zcode);
    expect(entry.counts.missing).toBe(PER_AGENT_COUNT.zcode);
    expect(entry.counts.present).toBe(0);
  });

  it("reuses the capability-matrix reader: per-agent gap rows come from it", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    // Give the fixture tree this repo's committed matrix (tree-only resolution
    // means the fixture must CARRY it, exactly as an adopter tree would).
    mkdirSync(join(dir, "adapters"), { recursive: true });
    cpSync(
      join(repoRoot, "adapters/capability-matrix.json"),
      join(dir, "adapters/capability-matrix.json"),
    );
    const result = runDoctor({ cwd: dir, agents: true });
    const matrix = result.matrix;
    expect(matrix.present).toBe(true);
    const report = result.agents!;
    expect(report.matrix.present).toBe(true);
    expect(report.matrix.source).toBe(matrix.source);
    // Per-agent gap totals must sum to the reader's own honest total — the
    // report cannot understate by re-deriving from the capped detail list.
    const perAgent = report.agents.reduce((n, a) => n + a.gaps.total, 0);
    expect(perAgent).toBe(matrix.gaps);
    for (const entry of report.agents) {
      const rowsForAgent = entry.gaps.rows.filter((r) => r.agent === entry.agent);
      expect(entry.gaps.rows).toEqual(rowsForAgent);
      expect(entry.gaps.rows.length).toBeLessThanOrEqual(entry.gaps.total);
      expect(entry.gaps.truncated).toBe(entry.gaps.rows.length < entry.gaps.total);
      expect(entry.gaps.matrixPresent).toBe(true);
    }
  });

  it("snapshots the per-agent human block on a full init (the report's contract)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    // A full init with no markers narrowing it and no matrix in the tree: every
    // file is present, every agent is detected, every gap list is empty. That is
    // the deterministic shape, so the block's exact wording — the report an
    // operator reads — is pinned rather than merely probed for substrings.
    //
    // Only the per-agent lines are snapshotted: they carry counts and statuses,
    // never a path, so they do not move with a new template, while the file
    // counts themselves FAIL the snapshot whenever the seam's shape changes.
    const lines = formatDoctorReport(runDoctor({ cwd: dir, agents: true }))
      .split("\n")
      .filter((line) => /^ {2}agent[s]?\b/.test(line) || /^ {4}gap:/.test(line));
    expect(lines.join("\n")).toMatchInlineSnapshot(`
      "  agents: claude, opencode, zcode (adapter selection: init --agents / --no-agents; report-only)
        agent claude: 2 file(s) — 2 present, 0 acknowledged (yours, never regenerated), 0 acknowledged-drifted (hand edit after the ack), 0 adopter-edited (yours; init skips it unless --backup), 0 stale (arggon init would refresh it), 0 missing, 0 unverified, 0 orphaned (template gone from this arggon; init removes it when unmodified, else you delete it by hand); 0 capability gap(s)
        agent opencode: 18 file(s) — 18 present, 0 acknowledged (yours, never regenerated), 0 acknowledged-drifted (hand edit after the ack), 0 adopter-edited (yours; init skips it unless --backup), 0 stale (arggon init would refresh it), 0 missing, 0 unverified, 0 orphaned (template gone from this arggon; init removes it when unmodified, else you delete it by hand); 0 capability gap(s)
        agent zcode: 23 file(s) — 23 present, 0 acknowledged (yours, never regenerated), 0 acknowledged-drifted (hand edit after the ack), 0 adopter-edited (yours; init skips it unless --backup), 0 stale (arggon init would refresh it), 0 missing, 0 unverified, 0 orphaned (template gone from this arggon; init removes it when unmodified, else you delete it by hand); 0 capability gap(s)"
    `);
  });

  it("reports a tree with no matrix as present:false, exit 0, never a failure", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const result = runDoctor({ cwd: dir, agents: true });
    expect(result.agents!.matrix.present).toBe(false);
    for (const entry of result.agents!.agents) {
      expect(entry.gaps.total).toBe(0);
      expect(entry.gaps.rows).toEqual([]);
      expect(entry.gaps.matrixPresent).toBe(false);
    }
    const proc = runCli(["--json", "doctor", "--agents"], dir);
    expect(proc.status).toBe(0);
    expect(JSON.parse(proc.stdout).ok).toBe(true);
  });

  it("never writes anything (report-only)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const before = readdirDeep(dir);
    runDoctor({ cwd: dir, agents: true });
    expect(readdirDeep(dir)).toEqual(before);
  });

  it("human output carries one line per agent, with the gap rows attached", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    mkdirSync(join(dir, "adapters"), { recursive: true });
    cpSync(
      join(repoRoot, "adapters/capability-matrix.json"),
      join(dir, "adapters/capability-matrix.json"),
    );
    const text = formatDoctorReport(runDoctor({ cwd: dir, agents: true }));
    // One `agent <id>:` line per known agent, in registry order.
    for (const agent of AGENT_IDS) {
      expect(text, `agent line for ${agent}`).toContain(`agent ${agent}: `);
      expect(text).toContain(`${PER_AGENT_COUNT[agent]} file(s)`);
      // Each bucket names the action init actually takes (round-1 F2): no label
      // may promise a protection or a refresh init does not provide.
      expect(text).toContain("adopter-edited (yours; init skips it unless --backup)");
      expect(text).toContain("stale (arggon init would refresh it)");
      expect(text).toContain("acknowledged (yours, never regenerated)");
      expect(text).toContain("acknowledged-drifted (hand edit after the ack)");
    }
    // The file counts are asserted against the registry, not against a literal:
    // the seam grows whenever a template is added, and a hardcoded count here
    // would rot silently into a wrong expectation. (The counts the SNAPSHOT
    // pins are the ones that must not move for a reason we did not intend.)
    // Report-only wording is explicit, and gap rows are attached to their agent.
    expect(text).toContain("report-only");
    const claude = text.split("agent claude: ")[1]!;
    expect(claude).toContain("capability gap(s)");
    expect(claude).toMatch(/gap: \S+ x claude — /);
    expect(text.split("agent opencode: ")[1]!.split("agent zcode:")[0]).not.toMatch(/^ {4}gap:/m);
  });

  it("human output prints the block on a non-initialized tree too", () => {
    const dir = tempDir();
    const text = formatDoctorReport(runDoctor({ cwd: dir, agents: true }));
    expect(text).toContain("not initialized");
    expect(text).toContain("agents: none detected in this tree");
    expect(text).toContain("agent opencode: ");
    expect(text).toContain("no capability matrix");
  });
});

describe("adapter selection: never-overwrite and refusal", () => {
  it("never overwrites an adopter-edited generated file in ANY default mode", () => {
    const dir = tempDir();
    runInit({ dir, force: false, agents: "opencode" });
    const victim = ".opencode/agents/arggon-maker.md";
    const adopterEdit = `${readFileSync(join(dir, ...victim.split("/")), "utf8")}\nADOPTER EDIT\n`;
    writeFileSync(join(dir, ...victim.split("/")), adopterEdit, "utf8");

    // A plain re-run and an explicit re-select must both keep the adopter bytes,
    // and so must `--force` — the never-overwrite rule is NOT lifted by it.
    // (`--backup` is deliberately absent from this list and covered by the
    // `replaced` test below: it archives the original and regenerates, which is
    // the documented opt-out from "never overwrite", not an instance of it.)
    const rerun = runInit({ dir, force: false, agents: "opencode" });
    expect(readFileSync(join(dir, ...victim.split("/")), "utf8")).toBe(adopterEdit);
    expect(rerun.modified).toContain(victim);
    const forced = runInit({ dir, force: true, agents: "opencode" });
    expect(readFileSync(join(dir, ...victim.split("/")), "utf8")).toBe(adopterEdit);
    expect(forced.modified).toContain(victim);

    // Reported as skipped-with-a-reason in the per-artifact block, so the
    // operator learns WHY the file was not refreshed.
    const row = rerun.adapters.artifacts.find((a) => a.path === victim);
    expect(row?.outcome).toBe("skipped");
    expect(row?.reason).toMatch(/adopter-modified/);
    expect(rerun.modified).toContain(victim);
    expect(rerun.skipped).toContain(victim);
    expect(rerun.adapters.counts.replaced, "nothing was replaced without --backup").toBe(0);
  });

  it("reports `init --backup` on an adopter-edited file as `replaced`, not `skipped` (F3)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, agents: "opencode" });
    const victim = ".opencode/agents/arggon-maker.md";
    const adopterEdit = `${readFileSync(join(dir, ...victim.split("/")), "utf8")}\nADOPTER EDIT\n`;
    writeFileSync(join(dir, ...victim.split("/")), adopterEdit, "utf8");

    // `--backup` archives the adopter's bytes and regenerates the destination —
    // a WRITE. Reporting it `skipped` contradicted the row's own reason
    // ("archived … then regenerated"), so the per-artifact report could state
    // that a file was left alone while it had been overwritten.
    const result = runInit({ dir, force: false, backup: true, agents: "opencode" });
    const row = result.adapters.artifacts.find((a) => a.path === victim);
    expect(row?.outcome).toBe("replaced");
    expect(row?.reason).toMatch(/archived to backup\//);
    expect(result.adapters.counts.replaced).toBe(1);
    // Honest totals: every destination in exactly one bucket.
    const c = result.adapters.counts;
    expect(c.total).toBe(c.written + c.replaced + c.skipped);
    // The displaced original is recoverable, and the destination was regenerated.
    // (`backedUp[]` carries the DEST paths, as it always has; the archive itself
    // is at `backup/<date>/<dest>` — the path in the row's reason.)
    expect(result.backedUp).toContain(victim);
    const archived = readdirDeep(join(dir, "backup")).find((p) => p.endsWith(victim))!;
    expect(readFileSync(join(dir, "backup", archived), "utf8")).toBe(adopterEdit);
    expect(readFileSync(join(dir, ...victim.split("/")), "utf8")).not.toContain("ADOPTER EDIT");
  });

  it("never overwrites an adopter-edited file even for an UNSELECTED agent", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const victim = ".zcode-marketplace/marketplace.json";
    const edited = `${readFileSync(join(dir, ...victim.split("/")), "utf8")}\nADOPTER EDIT\n`;
    writeFileSync(join(dir, ...victim.split("/")), edited, "utf8");
    // Selecting only opencode must not touch the zcode file at all — not even
    // to "helpfully" clean it up.
    runInit({ dir, force: false, agents: "opencode" });
    expect(readFileSync(join(dir, ...victim.split("/")), "utf8")).toBe(edited);
  });

  it("refuses both selection tokens in one invocation, in EITHER order (F6)", () => {
    // `--agents <list>` and `--no-agents` collapse onto ONE commander option key,
    // so parsed options alone cannot distinguish "the operator passed
    // `--no-agents`" from "the operator passed both and the last one won" — the
    // difference between an intended selection and a silently discarded one. The
    // shipped "does not combine" error was unreachable from the CLI, while the
    // README and json-output.md both asserted refusal.
    for (const args of [
      ["--agents", "opencode", "--no-agents"],
      ["--no-agents", "--agents", "opencode"],
    ]) {
      const dir = tempDir();
      const before = readdirDeep(dir);
      const proc = runCli(["--json", "init", ...args], dir);
      expect(proc.status, `${args.join(" ")} must not be accepted`).not.toBe(0);
      const body = JSON.parse(proc.stdout) as {
        ok: boolean;
        error: { message: string; code: string };
      };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("INIT_FAILED");
      expect(body.error.message).toMatch(/--no-agents does not combine with --agents/);
      expect(readdirDeep(dir), `${args.join(" ")} must write nothing`).toEqual(before);
    }
    // Either token ALONE still works, on its own terms — the refusal is about the
    // combination, not about one of them being invalid.
    const onlyAgents = runCli(["--json", "init", "--agents", "opencode"], tempDir());
    expect(onlyAgents.status).toBe(0);
    expect(JSON.parse(onlyAgents.stdout).adapters.selection.mode).toBe("select");
    const onlyNone = runCli(["--json", "init", "--no-agents"], tempDir());
    expect(onlyNone.status).toBe(0);
    expect(JSON.parse(onlyNone.stdout).adapters.selection.mode).toBe("none");
  });

  it("refuses an unknown agent name in --propose WITHOUT writing side files (F5)", () => {
    // `--propose` applies its side files (and can `rmSync` a leftover on
    // `absorbed`) before the selection used to be resolved, so the refusal landed
    // with `.proposed-*` files already on disk — the opposite of the documented
    // "refused before anything is written".
    const dir = tempDir();
    runInit({ dir, force: false });
    // An adopter-modified doc, so the proposal sweep has real work to do.
    const victim = "CONTRIBUTING.md";
    writeFileSync(
      join(dir, victim),
      `${readFileSync(join(dir, victim), "utf8")}\nADOPTER EDIT\n`,
      "utf8",
    );
    const before = readdirDeep(dir);
    const proc = runCli(["--json", "init", "--propose", "--agents", "cursor"], dir);
    expect(proc.status).not.toBe(0);
    const body = JSON.parse(proc.stdout) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain('unknown agent "cursor"');
    // Nothing written AND nothing removed: a full recursive listing, not just the
    // absence of new files.
    expect(readdirDeep(dir)).toEqual(before);
    expect(existsIn(dir, "backup")).toBe(false);
  });

  it("refuses an unknown agent name with INIT_FAILED, writing nothing", () => {
    const dir = tempDir();
    const before = readdirDeep(dir);
    const proc = runCli(["--json", "init", "--agents", "opencode,cursor"], dir);
    expect(proc.status).not.toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      error: { message: string; code: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INIT_FAILED");
    // Named, with the valid set — never a silent no-op.
    expect(body.error.message).toContain('unknown agent "cursor"');
    expect(body.error.message).toContain("claude, opencode, zcode");
    // A refused run leaves no partial scaffold behind.
    expect(readdirDeep(dir)).toEqual(before);
  });

  it("refuses an unknown agent name in --dry-run too (the plan is the contract)", () => {
    const dir = tempDir();
    const proc = runCli(["--json", "init", "--dry-run", "--agents", "warp"], dir);
    expect(proc.status).not.toBe(0);
    const body = JSON.parse(proc.stdout) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain('unknown agent "warp"');
    expect(existsIn(dir, "ArggonManager/.convention.yml")).toBe(false);
  });

  it("--dry-run reports the same adapter rows the run it previews would write", () => {
    const dir = tempDir();
    const dry = dryRunInit({ dir, force: false, agents: "opencode,zcode" });
    expect(existsIn(dir, "opencode.jsonc")).toBe(false); // pure read
    const real = runInit({ dir, force: false, agents: "opencode,zcode" });
    expect(dry.adapters.selection).toEqual(real.adapters.selection);
    expect(dry.adapters.artifacts.map((a) => [a.path, a.outcome])).toEqual(
      real.adapters.artifacts.map((a) => [a.path, a.outcome]),
    );
  });

  it("--propose reports the selection without claiming to write adapter files", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const result = dryRunInit({ dir, force: false, propose: true, agents: "opencode" });
    expect(result.adapters.scope).toBe("propose");
    expect(result.adapters.artifacts).toEqual([]);
    expect(result.adapters.counts.written).toBe(0);
    expect(result.adapters.selection.selected).toEqual(["opencode"]);
  });
});

/** Sorted relative paths of every file under `dir` (a "nothing was written" probe). */
function readdirDeep(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string, prefix: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const name of entries.sort()) {
      const rel = prefix === "" ? name : `${prefix}/${name}`;
      const abs = join(current, name);
      if (statSync(abs).isDirectory()) walk(abs, rel);
      else out.push(rel);
    }
  };
  walk(dir, "");
  return out.sort();
}
