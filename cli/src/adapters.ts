/**
 * Adapter registry (spec-methodology-adapters-017 §S2, plan T2,
 * task-adapter-selection-flags).
 *
 * One registry, two consumers: `init` uses it to decide WHICH adapter seams
 * materialize (`--agents <list>` / `--no-agents`), and `doctor` uses it to
 * report the same seams per agent (`--agents`). Keeping the agent↔destination
 * mapping here is the point — the selection and the report can never disagree
 * about what "the opencode adapter" is.
 *
 * Three decisions this module owns, and why:
 *
 *  1. **Classification is by TEMPLATE id**, never by destination. A template id
 *     is package-root relative and layout independent (`docs/opencode/…` is the
 *     OpenCode seam on a v5 tree and on a legacy one), so the same predicate
 *     selects and reports without duplicating the `DOC_PATH_MAP` /
 *     `DOC_PREFIX_MAP` remapping in `cli/src/docs.ts`. This module therefore
 *     imports NOTHING from `docs.ts` — `docs.ts` imports this one.
 *  2. **Detection reads only the examined tree** (`<root>/…` markers), like the
 *     capability-matrix reader: an additive field or a selection default that
 *     read outside the tree would make `init --json` differ between the packed
 *     bin and the checkout CLI on the same tree, which the headless pack-parity
 *     gate pins byte-identical.
 *  3. **A fresh scaffold has nothing to detect, so it keeps everything.** The
 *     default is "every DETECTED agent" (spec §S2), but a brand-new empty tree
 *     carries no agent marker at all — narrowing there to the empty set would
 *     silently delete the OpenCode + ZCode seams `init` has always shipped,
 *     breaking the generated AGENTS.md contract and every adopter flow. So when
 *     NO marker is present, the default is every known agent, and `--json`
 *     reports `mode: "detect"` with an empty `detected` so the operator can see
 *     exactly which rule fired. Narrow an existing tree with `--agents`.
 *
 * The bundled **arggon-cli skill** (`.agents/skills/**`) is deliberately NOT an
 * adapter artifact: it is agent-agnostic (the capability matrix lists it as a
 * surface that can never be "the missing thing" for any client), so it is
 * generated whatever `--agents` says. The per-client generated CI recipe and
 * the GitHub templates are not adapters either — only the seams below are.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

/** Every agent id `init --agents` accepts, sorted (the spec's list, §S2). */
export const AGENT_IDS = ["claude", "opencode", "zcode"] as const;

/** One adapter agent id. */
export type AgentId = (typeof AGENT_IDS)[number];

/** Is `value` a known agent id? */
export function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value);
}

/**
 * OpenCode config discovery candidates (opencode-seam-010), in V2 discovery
 * order: the root and `.opencode/` JSON/JSONC shapes, both of which V2 reads.
 *
 * MINOR-3 (PR #324 review): this is the single source of truth, imported by
 * `findOpenCodeConfig` (init's "is there an adopter config?" probe) AND by
 * doctor AND by opencode detection here, so the three cannot drift. The use
 * differs intentionally: `findOpenCodeConfig` returns the first ADOPTER config
 * (arggon's own generated config is skipped by signature), while doctor reports
 * every present file.
 *
 * Moved here from `cli/src/docs.ts` (task-adapter-selection-flags) so adapter
 * detection can use it without an import cycle: `docs.ts` imports this module,
 * never the reverse. `docs.ts` re-exports it, so every existing importer and
 * the doctor parity comment stay valid.
 */
export const OPENCODE_CONFIG_CANDIDATES = [
  "opencode.json",
  "opencode.jsonc",
  ".opencode/opencode.json",
  ".opencode/opencode.jsonc",
] as const;

/**
 * Adapter assignment per agent, by template id. A null agent means "not an
 * adapter artifact" — a plain generated doc (the CLI playbook, the templates,
 * the CI recipe, the bundled skill).
 *
 * The opencode seam is the widest one: the generated config
 * (`docs/opencode.jsonc`), the agents/commands subtree (`docs/opencode/**` →
 * `.opencode/**`) and the two bundled plugin artifacts
 * (`opencode/plugins/arggon/**` → `.opencode/plugins/arggon/**`). Matching is
 * exact-or-prefix-on-a-separator, so a sibling template that merely starts with
 * the same characters can never be swept into a seam.
 */
const AGENT_TEMPLATES: { agent: AgentId; match: (template: string) => boolean }[] = [
  {
    agent: "opencode",
    match: (t) =>
      t === "docs/opencode.jsonc" ||
      t.startsWith("docs/opencode/") ||
      t.startsWith("opencode/plugins/arggon/"),
  },
  { agent: "zcode", match: (t) => t.startsWith("docs/zcode/") },
  // claude-code has no bundle yet (spec §S6 is a follow-on story). The two
  // surfaces an init'd tree already hands that client are the `CLAUDE.md`
  // → `@AGENTS.md` pointer shim and the `.mcp.json` registration of
  // `arggon mcp` — exactly the `claude:` mechanisms the committed capability
  // matrix derives its claude rows from.
  { agent: "claude", match: (t) => t === "docs/CLAUDE.md" || t === "docs/mcp-json" },
];

/** The agent whose seam a template generates, or null when it is not an adapter artifact. */
export function agentForTemplate(template: string): AgentId | null {
  for (const { agent, match } of AGENT_TEMPLATES) {
    if (match(template)) return agent;
  }
  return null;
}

/**
 * Tree markers that mean "this repo already uses agent X", in the order each
 * agent is probed. Markers are fixed paths — one `existsSync` each, no
 * recursive scan, no machine-wide client probing (an agent installed on the
 * operator's PATH says nothing about the repo it is being run in).
 */
const AGENT_MARKERS: { agent: AgentId; markers: string[] }[] = [
  {
    agent: "opencode",
    markers: [...OPENCODE_CONFIG_CANDIDATES, ".opencode"],
  },
  { agent: "zcode", markers: [".zcode-marketplace"] },
  { agent: "claude", markers: ["CLAUDE.md", ".claude"] },
];

/**
 * Detected agents for `root` (posix-relative markers, tree-only), sorted.
 * `detectAgents([])` on an empty tree is the documented "nothing to detect"
 * case the selection default resolves from.
 */
export function detectAgents(root: string): AgentId[] {
  const found: AgentId[] = [];
  for (const { agent, markers } of AGENT_MARKERS) {
    if (markers.some((rel) => existsSync(join(root, ...rel.split("/"))))) found.push(agent);
  }
  return found.sort();
}

/** How the agent selection for this run was decided. */
export type AgentSelectionMode =
  /** `--agents <list>`: exactly the named agents. */
  | "select"
  /** `--no-agents`: docs + CLI only, no adapter seam at all. */
  | "none"
  /**
   * No flag: every DETECTED agent — or, on a tree with no agent marker at all
   * (the fresh-scaffold case), every known agent, so `init` keeps shipping the
   * full set it always did. See the module docstring.
   */
  | "detect";

/** The resolved selection for one init run (pure; carries no rule logic). */
export type AgentSelection = {
  mode: AgentSelectionMode;
  /** Every known agent id, sorted. */
  known: AgentId[];
  /** Agents detected in this tree, sorted (empty on a fresh scaffold). */
  detected: AgentId[];
  /** Agents this run materializes, sorted. */
  selected: AgentId[];
  /** Why `selected` is what it is (human output + `--json` honesty). */
  reason: string;
};

/** Options for {@link resolveAgentSelection}. */
export type ResolveAgentSelectionOptions = {
  /** Root of the tree being initialized (detection + the default). */
  root: string;
  /** Raw `--agents` value (comma-separated); mutually exclusive with `noAgents`. */
  agents?: string;
  /** `--no-agents`. */
  noAgents?: boolean;
};

/**
 * Parse a `--agents` value into ids, refusing an unknown name with an error
 * that NAMES it (an unknown adapter must never be silently ignored — the
 * operator would believe a seam was installed). Duplicates and blank entries
 * collapse; case is normalized (agent ids are lowercase).
 */
export function parseAgentList(raw: string): AgentId[] {
  const names = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
  if (names.length === 0) {
    throw new Error(`--agents needs at least one agent name (known: ${AGENT_IDS.join(", ")})`);
  }
  const out: AgentId[] = [];
  for (const name of names) {
    if (!isAgentId(name)) {
      throw new Error(`unknown agent "${name}" in --agents (known: ${AGENT_IDS.join(", ")})`);
    }
    if (!out.includes(name)) out.push(name);
  }
  return out.sort();
}

/**
 * Resolve the selection for an init run. Pure read of the tree (markers only),
 * never writes; throws on `--agents` + `--no-agents` together and on an unknown
 * agent name, so both surface as `INIT_FAILED` with a message naming the cause.
 */
export function resolveAgentSelection(opts: ResolveAgentSelectionOptions): AgentSelection {
  const known = [...AGENT_IDS].sort();
  const detected = detectAgents(opts.root);
  if (opts.noAgents && opts.agents !== undefined) {
    throw new Error(
      "init --no-agents does not combine with --agents (one suppresses adapter generation, the other selects it)",
    );
  }
  if (opts.noAgents === true) {
    return {
      mode: "none",
      known,
      detected,
      selected: [],
      reason:
        "--no-agents — docs + CLI only, no adapter seam materialized (nothing on disk was deleted)",
    };
  }
  if (opts.agents !== undefined) {
    const selected = parseAgentList(opts.agents);
    return {
      mode: "select",
      known,
      detected,
      selected,
      reason: `--agents ${opts.agents.trim()} — exactly the named agents; every other seam is left untouched`,
    };
  }
  // No flag: detected agents, or — on a tree carrying no agent marker at all —
  // every known agent (the fresh-scaffold default init has always shipped).
  const selected = detected.length > 0 ? detected : known;
  return {
    mode: "detect",
    known,
    detected,
    selected,
    reason:
      detected.length > 0
        ? `no --agents flag — every agent detected in this tree (${detected.join(", ")})`
        : "no --agents flag and no agent marker in this tree — every known agent " +
          `(the pre-selection default; narrow it with --agents)`,
  };
}

/**
 * Rows for one adapter destination in the `init --json` `adapters` block.
 */
export type AdapterArtifact = {
  /** The agent whose seam owns this destination. */
  agent: AgentId;
  /** Destination path (posix, relative to the tree root). */
  path: string;
  /** `written` when this run created or refreshed the file; `skipped` otherwise. */
  outcome: "written" | "skipped";
  /** Why — the plan's own decision reason, or the deselection reason. */
  reason: string;
};

/** Per-artifact rows cap; honest totals stay in `counts` when rows are cut. */
export const MAX_ADAPTER_ARTIFACTS = 64;

/** What `init` did (or would do) with every adapter destination (spec §S2). */
export type AdapterSelectionReport = {
  /** `generate` rows describe this run's writes; `propose` writes no adapter file. */
  scope: "generate" | "propose";
  /** The resolved selection (verbatim). */
  selection: AgentSelection;
  /** One row per adapter destination, capped at {@link MAX_ADAPTER_ARTIFACTS}. */
  artifacts: AdapterArtifact[];
  /** A row was cut from `artifacts` (`counts` still counts them all). */
  truncated: boolean;
  /** Honest totals over ALL adapter destinations, not the capped list. */
  counts: { total: number; written: number; skipped: number };
};
