/**
 * Claude Code plugin seam (spec-claude-code-adapter-024, task-claude-plugin-seam):
 * `arggon init` vendors a Claude Code plugin under `.claude-marketplace/` —
 * marketplace catalog, manifest, the 13 commands, the two subagents (maker,
 * standards-reviewer; the delivery lead is the MAIN SESSION — see the parity
 * test below), the bundled `arggon-cli` skill and the hook gates (global git
 * gates + the dispatch-scoped reviewer backstop).
 *
 * The gate script is exercised as a real child process against the GENERATED
 * file (not the template): init output is the artifact adopters run.
 *
 * Client-surface facts pinned here were probed on claude 2.1.289 (throwaway
 * HOME/CLAUDE_CONFIG_DIR; transcripts on the item / PR):
 *
 *   - the manifest must OMIT `agents`: setting the key — single path, array,
 *     in-folder or out-of-folder — replaces the convention `agents/` scan and
 *     `claude plugin details` then reports ZERO agents; omitting it loads the
 *     shipped pair (`Agents (2)`);
 *   - components are namespaced under the plugin name: the commands run as
 *     `/arggon:<command>` (file stem after the plugin prefix), the agents
 *     dispatch as `arggon:arggon-maker` / `arggon:arggon-standards-reviewer`,
 *     and the plugin's MCP tools surface as `mcp__plugin_arggon_arggon__<tool>`
 *     while the generated `.mcp.json` keeps `mcp__arggon__<tool>`;
 *   - `claude plugin validate --strict` is clean on both manifests, the inline
 *     `mcpServers.arggon` entry and the generated `.mcp.json` both load, and
 *     `claude mcp list` shows `plugin:arggon:arggon` plus the project `arggon`.
 *
 * The dispatch-scoped backstop is bound to the SHIPPED id by reading it out of
 * the templates (spec-agent-rename-019 AC 2, carried over to this seam): the
 * gate matches an agent name as a string, so a rename that misses its matcher
 * does not fail loudly — it silently stops opening the read-only window. Both
 * the matcher and the id are derived here; neither is restated, so the pairing
 * cannot drift.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { readGeneratedState } from "@arggondev/lib";
import { agentForTemplate } from "./adapters.js";
import { BUNDLED_SKILLS, claudeBundleSkillStagingPath, currentGeneratedTemplates } from "./docs.js";
import { runInit } from "./init.js";
import { removeFixtureTree } from "./test-tmp.js";
import { readEnvelope, spawnNodeCli } from "./test-spawn.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test
// through the shared bounded-retry helper — the MCP server child is killed
// in-test, but a still-settling fs entry must never trip the one-shot
// ENOTEMPTY race in plain recursive rmSync.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** The shipped templates (the source init materializes the seam from). */
const shipped = {
  agentsDir: join(repoRoot, "templates/docs/claude/arggon/agents"),
  commandsDir: join(repoRoot, "templates/docs/claude/arggon/commands"),
  reviewCommand: join(repoRoot, "templates/docs/claude/arggon/commands/review.md"),
  hooks: join(repoRoot, "templates/docs/claude/arggon/hooks/hooks.json"),
  gate: join(repoRoot, "templates/docs/claude/arggon/hooks/gate.mjs"),
  manifest: join(repoRoot, "templates/docs/claude/arggon/.claude-plugin/plugin.json"),
};

const MARKET_ROOT = ".claude-marketplace";
const PLUGIN_ROOT = `${MARKET_ROOT}/arggon`;
const COMMANDS = [
  "adopt",
  "adr",
  "board",
  "done",
  "explore",
  "goal",
  "handoff",
  "next",
  "playbook",
  "review",
  "spec",
  "start",
  "status",
];

/**
 * Every destination the claude adapter owns — derived from the ONE classifier
 * the generator and doctor both use (`agentForTemplate`), so this list cannot
 * drift from what a run actually writes. The floor (`.mcp.json`,
 * `CLAUDE.md`) is part of it: the two surfaces an init'd tree hands this
 * client with no bundle at all.
 */
const CLAUDE_DESTS: string[] = currentGeneratedTemplates({ layout: "arggon-manager" })
  .filter(({ template }) => agentForTemplate(template) === "claude")
  .map(({ dest }) => dest)
  .sort();

/** The skill files the bundle vendors: the single `arggon-cli` source set. */
const BUNDLED_SKILL_FILES = BUNDLED_SKILLS.filter((s) => s.source.startsWith("skills/arggon-cli/"));

function initClaudeTree(extra: { agents?: string; noAgents?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-claude-"));
  const selection =
    extra.noAgents === true ? { noAgents: true as const } : { agents: extra.agents ?? "claude" };
  runInit({ dir, force: false, ...selection });
  return dir;
}

/** Every file under `root`, repo-relative posix, sorted. */
function walk(root: string, base = root): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) found.push(...walk(abs, base));
    else found.push(relative(base, abs).split("\\").join("/"));
  }
  return found.sort();
}

/**
 * The shipped standards-reviewer id, DERIVED from the gate's own matcher
 * (AC 2): the behavioural probes below must keep working whatever the id is
 * called, so restating it here would only add a second place to forget.
 */
function shippedReviewerId(): string {
  const src = readFileSync(shipped.gate, "utf8");
  const match = /\/\(\^\|:\)([a-z-]+)\$\//.exec(src);
  expect(match, "the gate's isReviewerDispatch matcher must stay greppable").not.toBeNull();
  return match![1]!;
}

/**
 * The reviewer id read out of the SHIPPED agent files — the one whose
 * frontmatter toolset carries the verdict channel — so the gate's matcher is
 * bound to the agent a tree actually dispatches, not to the gate's own copy of
 * the name.
 */
function agentIdFromShippedAgents(): { reviewer: string; all: string[] } {
  const frontmatterOf = (body: string): string => /^---\n([\s\S]*?)\n---\n/.exec(body)?.[1] ?? "";
  const ids = readdirSync(shipped.agentsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const body = readFileSync(join(shipped.agentsDir, f), "utf8");
      return {
        id: /^name:\s*(\S+)/m.exec(body)![1]!,
        // The reviewer is the one whose toolset carries the verdict channel.
        // The toolset lives in the frontmatter (`tools:`); a body mention is
        // not a grant, so the maker's prose cannot be mistaken for one.
        isReviewer: /^tools:.*\bmcp__arggon__arggon_comment\b/m.test(frontmatterOf(body)),
      };
    });
  const reviewers = ids.filter((a) => a.isReviewer);
  expect(reviewers, "exactly one shipped agent carries the verdict channel").toHaveLength(1);
  return { reviewer: reviewers[0]!.id, all: ids.map((a) => a.id) };
}

/** Run the generated gate script with a JSON stdin payload. */
function gate(
  dir: string,
  mode: "pre" | "subagent-start" | "subagent-stop" | "stop",
  payload: Record<string, unknown>,
): { status: number; stderr: string } {
  const proc = spawnSync(process.execPath, [join(dir, PLUGIN_ROOT, "hooks/gate.mjs"), mode], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    timeout: 15_000,
  });
  return { status: proc.status ?? -1, stderr: proc.stderr ?? "" };
}

/** The payload the client sends for one reviewer dispatch lifecycle event. */
function reviewerEvent(
  session: string,
  agentType = `arggon:${shippedReviewerId()}`,
): Record<string, unknown> {
  return { session_id: session, agent_id: "agent-1", agent_type: agentType };
}

/** `content` without its one-line provenance marker (frontmatter, `<!--`, or `//`). */
function withoutMarker(content: string): string {
  return content
    .replace(/^---\n# arggon:generated template="[^"]+"\n/, "---\n")
    .replace(/^<!-- arggon:generated template="[^"]+" -->\n/, "")
    .replace(/^\/\/ arggon:generated template="[^"]+"\n/, "");
}

const manifestOf = (dir: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(dir, PLUGIN_ROOT, ".claude-plugin/plugin.json"), "utf8")) as Record<
    string,
    unknown
  >;

describe("claude code plugin seam generation", () => {
  it("generates the marketplace catalog and the vendored plugin, and nothing else", () => {
    const dir = initClaudeTree();
    for (const rel of [
      ...CLAUDE_DESTS,
      `${PLUGIN_ROOT}/hooks/hooks.json`,
      `${PLUGIN_ROOT}/README.md`,
    ]) {
      expect(existsSync(join(dir, ...rel.split("/"))), rel).toBe(true);
    }
    // The plugin root's own inventory: the marketplace catalog carries the
    // plugin, and the plugin carries exactly the shipped command/agent/skill
    // files — derived from the templates, never from a restated list.
    expect(readdirSync(join(dir, PLUGIN_ROOT, "commands"))).toHaveLength(13);
    expect(readdirSync(join(dir, PLUGIN_ROOT, "agents"))).toHaveLength(2);
    expect(readdirSync(join(dir, PLUGIN_ROOT, "skills"))).toEqual(["arggon-cli"]);
    // "and nothing else": the tree under the marketplace root is EXACTLY the
    // claude adapter's destinations — a file the classifier does not own there
    // would mean the bundle writes outside its seam.
    const onDisk = walk(join(dir, MARKET_ROOT)).map((rel) => `${MARKET_ROOT}/${rel}`);
    const declared = CLAUDE_DESTS.filter((dest) => dest.startsWith(`${MARKET_ROOT}/`));
    expect(onDisk.filter((rel) => !declared.includes(rel))).toEqual([]);
    expect(declared.filter((rel) => !onDisk.includes(rel))).toEqual([]);
  });

  /**
   * The 2.1.289 finding this test pins (probe A, recorded on the item): setting
   * `agents` in the manifest — as a single path, an array, in-folder or
   * out-of-folder — VALIDATES but replaces Claude Code's convention `agents/`
   * directory scan, and `claude plugin details` then reports 0 agents. Omitting
   * the key loads `agents/*.md` (probe: `Agents (2)`). So the key is
   * deliberately absent, and this test fails the day someone "completes" the
   * manifest with it.
   */
  it("omits `agents` from the manifest (the 2.1.289 convention-scan finding)", () => {
    const manifest = manifestOf(initClaudeTree());
    expect(Object.keys(manifest)).not.toContain("agents");
    expect(readFileSync(shipped.manifest, "utf8")).not.toContain('"agents"');
  });

  it("declares every component path, warning-free, inside the plugin root", () => {
    const dir = initClaudeTree();
    const manifest = manifestOf(dir);
    expect(manifest.name).toBe("arggon");
    expect(manifest.author).toMatchObject({ name: expect.any(String) });
    expect(manifest.description).toEqual(expect.any(String));
    for (const field of ["commands", "skills", "hooks"]) {
      const value = manifest[field];
      expect(typeof value, `${field} is a path string`).toBe("string");
      const rel = String(value);
      // Claude Code's path rules: `./`-prefixed, contained, and existing — the
      // two load failures (`path not found`, `path escapes plugin directory`)
      // are asserted absent, not assumed absent.
      expect(rel.startsWith("./"), `${field} starts with ./`).toBe(true);
      expect(rel.includes(".."), `${field} has no traversal`).toBe(false);
      expect(existsSync(join(dir, PLUGIN_ROOT, rel)), field).toBe(true);
    }
    // The marketplace entry mirrors the manifest (name/source/version/description)
    // and its source resolves to the generated plugin root.
    const catalog = JSON.parse(
      readFileSync(join(dir, MARKET_ROOT, ".claude-plugin/marketplace.json"), "utf8"),
    ) as {
      name: string;
      description?: string;
      owner?: { name?: string };
      plugins: Array<Record<string, unknown>>;
    };
    expect(catalog.name).toBe("arggon-local");
    expect(catalog.description).toEqual(expect.any(String));
    expect(catalog.owner?.name).toEqual(expect.any(String));
    const entry = catalog.plugins.find((p) => p.name === manifest.name);
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      source: "./arggon",
      version: manifest.version,
      description: expect.any(String),
    });
    expect(existsSync(join(dir, MARKET_ROOT, String(entry!.source)))).toBe(true);
  });

  it("carries provenance markers in the destination-appropriate syntax, and a state row per file", () => {
    const dir = initClaudeTree();
    const command = readFileSync(join(dir, PLUGIN_ROOT, "commands/next.md"), "utf8");
    // Frontmatter-first artifacts take the marker INSIDE the frontmatter.
    expect(command.startsWith("---\n# arggon:generated")).toBe(true);
    const agent = readFileSync(join(dir, PLUGIN_ROOT, "agents/arggon-maker.md"), "utf8");
    expect(agent.startsWith("---\n# arggon:generated")).toBe(true);
    const gateScript = readFileSync(join(dir, PLUGIN_ROOT, "hooks/gate.mjs"), "utf8");
    expect(gateScript.startsWith("// arggon:generated")).toBe(true);
    // JSON destinations carry no marker (an HTML comment is invalid JSON).
    const manifest = readFileSync(join(dir, PLUGIN_ROOT, ".claude-plugin/plugin.json"), "utf8");
    expect(manifest.startsWith("{")).toBe(true);

    // Provenance: every generated claude destination is recorded, and the
    // recorded template ids point at the shipped templates.
    const state = readGeneratedState(dir);
    for (const dest of CLAUDE_DESTS) {
      expect(state[dest], `${dest} is recorded in x-generated`).toBeDefined();
    }
  });

  it("never overwrites an adopter-modified seam file (provenance decision table)", () => {
    const dir = initClaudeTree();
    const dest = join(dir, PLUGIN_ROOT, "commands/next.md");
    const adopted = "---\ndescription: my own next command\n---\nmine.\n";
    const original = readFileSync(dest, "utf8");
    expect(original).not.toEqual(adopted);
    // Simulate an adopter edit: the content no longer matches the recorded
    // checksum, so the next run must keep it (modified-skip).
    writeFileSync(dest, adopted, "utf8");
    const result = runInit({ dir, force: false, agents: "claude" });
    expect(readFileSync(dest, "utf8")).toEqual(adopted);
    expect((result.skipped ?? []).some((s) => s.includes("next.md"))).toBe(true);
  });

  it("reports honest written/skipped counts for the claude selection", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-claude-counts-"));
    const result = runInit({ dir, force: false, agents: "claude" });
    const claudeRows = result.adapters.artifacts.filter((a) => a.agent === "claude");
    // Every claude destination is materialized on a fresh tree, and the block's
    // written total is that set — not a re-derived number that could drift.
    expect(claudeRows.map((a) => a.path).sort()).toEqual([...CLAUDE_DESTS].sort());
    expect(claudeRows.every((a) => a.outcome === "written")).toBe(true);
    expect(result.adapters.counts.written).toBe(CLAUDE_DESTS.length);
    expect(result.adapters.truncated).toBe(false);
    // Every other seam's row is skipped WITH the deselection reason: nothing was
    // written and nothing was deleted outside the selection.
    const otherRows = result.adapters.artifacts.filter((a) => a.agent !== "claude");
    expect(otherRows.length).toBeGreaterThan(0);
    expect(
      otherRows.every((a) => a.outcome === "skipped" && /adapter not selected/.test(a.reason)),
      JSON.stringify(otherRows.filter((a) => a.outcome !== "skipped")),
    ).toBe(true);
  });

  it("keeps this repo's own committed .claude-marketplace copy in step with the templates", () => {
    // Repo-self (this repo's own seam is materialized and committed the way
    // `.zcode-marketplace/**` is): a template edit that forgets to re-run
    // `arggon init . --agents claude` fails here instead of shipping a stale
    // seam to this repo's own Claude sessions. The pair asserted is the whole
    // mapping: `.claude-marketplace/<path>` ← `templates/docs/claude/<path>`.
    const repoDests = CLAUDE_DESTS.filter((dest) => dest.startsWith(`${MARKET_ROOT}/`));
    expect(repoDests.length).toBeGreaterThan(0);
    for (const dest of repoDests) {
      const templateRel = dest.slice(`${MARKET_ROOT}/`.length);
      const committed = readFileSync(join(repoRoot, ...dest.split("/")), "utf8");
      const template = readFileSync(
        join(repoRoot, "templates/docs/claude", ...templateRel.split("/")),
        "utf8",
      );
      expect(withoutMarker(committed), dest).toEqual(template);
    }
  });

  it("materializes no claude file unless the claude adapter is selected, and refuses an unknown name", () => {
    const other = initClaudeTree({ agents: "opencode,zcode" });
    expect(existsSync(join(other, MARKET_ROOT))).toBe(false);
    const none = initClaudeTree({ noAgents: true });
    expect(existsSync(join(none, MARKET_ROOT))).toBe(false);
    // An unknown agent name is still refused BY NAME with nothing written.
    const dir = mkdtempSync(join(tmpdir(), "arggon-claude-refuse-"));
    expect(() => runInit({ dir, force: false, agents: "claud" })).toThrow(/unknown agent "claud"/);
    expect(existsSync(join(dir, MARKET_ROOT))).toBe(false);
  });

  it("commands address the arggon MCP surface, and the README names the commands the client runs", () => {
    const dir = initClaudeTree();
    const commandsDir = join(dir, PLUGIN_ROOT, "commands");
    for (const name of readdirSync(commandsDir)) {
      const body = readFileSync(join(commandsDir, name), "utf8");
      expect(body, name).not.toContain("tools.arggon.");
      expect(body, name).not.toContain("ZCode");
    }
    // The README's claim is the client's own name form: every `/arggon:<command>`
    // it lists in its command table is a file the plugin ships, and every
    // shipped command is listed — a README that names a command the client
    // cannot run fails here.
    const readme = readFileSync(join(dir, PLUGIN_ROOT, "README.md"), "utf8");
    const named = readme
      .split("\n")
      .filter((line) => line.startsWith("| `"))
      .map((line) => /\/arggon:([a-z-]+)/.exec(line)?.[1])
      .filter((name): name is string => name !== undefined);
    expect([...new Set(named)].sort()).toEqual([...COMMANDS].sort());
  });

  it("binds the reviewer backstop to the shipped id (no silent disarm)", () => {
    const dir = initClaudeTree();
    const { reviewer, all } = agentIdFromShippedAgents();
    // The gate watches exactly that id — a rename that misses the matcher fails
    // HERE (silently disarmed backstop) instead of in an adopter's session.
    const watched = shippedReviewerId();
    expect(watched).toBe(reviewer);
    // The plugin-qualified spelling the Agent tool actually sends.
    expect(new RegExp(`(^|:)${watched}$`).test(`arggon:${reviewer}`)).toBe(true);
    // And no other shipped agent may satisfy it — the window is per-reviewer.
    for (const other of all.filter((id) => id !== reviewer)) {
      expect(new RegExp(`(^|:)${watched}$`).test(other), other).toBe(false);
    }
    // The hooks.json matchers are the client-side half of the same binding:
    // SubagentStart/SubagentStop match the plugin-scoped agent type exactly.
    const hooks = JSON.parse(readFileSync(join(dir, PLUGIN_ROOT, "hooks/hooks.json"), "utf8")) as {
      hooks: Record<string, Array<{ matcher?: string }>>;
    };
    for (const event of ["SubagentStart", "SubagentStop"]) {
      expect(hooks.hooks[event]?.[0]?.matcher, event).toBe(`^arggon:${reviewer}$`);
    }
    // …and the shipped review command dispatches that same id.
    expect(readFileSync(shipped.reviewCommand, "utf8")).toContain(`arggon:${reviewer}`);
  });

  // task-claude-gate-polish: the PreToolUse matcher is the client-side half of
  // the gate's reach. It must select every tool the gate can decide on and
  // NOTHING else: a bare `mcp__.*` arm spawned the gate on every unrelated MCP
  // tool call in the session. Both arggon registration prefixes are pinned —
  // dropping either one silently stops denying that route.
  it("matches PreToolUse only on the tools the gate can decide on", () => {
    const dir = initClaudeTree();
    const hooks = JSON.parse(readFileSync(join(dir, PLUGIN_ROOT, "hooks/hooks.json"), "utf8")) as {
      hooks: Record<string, Array<{ matcher?: string }>>;
    };
    const matcher = hooks.hooks.PreToolUse?.[0]?.matcher;
    expect(matcher, "PreToolUse matcher").toBeTruthy();
    const matches = new RegExp(matcher!);
    for (const tool of [
      "Bash",
      "Write",
      "Edit",
      "MultiEdit",
      "NotebookEdit",
      "mcp__arggon__arggon_handoff",
      "mcp__plugin_arggon_arggon__arggon_handoff",
    ]) {
      expect(matches.test(tool), tool).toBe(true);
    }
    for (const tool of [
      "Read",
      "WebFetch",
      "mcp__other__tool",
      "mcp__arggon_other__tool",
      "mcp__plugin_arggon_other__tool",
    ]) {
      expect(matches.test(tool), tool).toBe(false);
    }
  });

  it("ships exactly the two subagent roles and no surface dispatches a lead", () => {
    const dir = initClaudeTree();
    const { all } = agentIdFromShippedAgents();
    expect(all.sort()).toEqual(["arggon-maker", "arggon-standards-reviewer"]);
    // The lead's contract reaches the main session through the generated
    // carriers, and no bundle file may tell a session to dispatch a lead.
    // README is the one legitimate exception BY DESIGN: it names the id in
    // order to forbid dispatching it, so the scan covers everything else.
    //
    // The vendored skill (`skills/**`) is EXCLUDED, deliberately and with its
    // reason recorded: it is a byte-equal copy of the agent-agnostic single
    // source (`skills/arggon-cli/**`, pinned by the parity test above), whose
    // shared role table names every client's wire ids — including the OpenCode
    // seam's selectable `arggon-delivery-lead` session agent. The surfaces that
    // must not name a lead are this plugin's OWN dispatch surfaces: commands,
    // agents, manifest and hooks.
    const readme = readFileSync(join(dir, PLUGIN_ROOT, "README.md"), "utf8");
    expect(readme).toContain("the main session IS the delivery lead");
    expect(readme).toContain('Do not dispatch a "lead"');
    expect(readme).toMatch(/CLAUDE\.md` → `@AGENTS\.md/);
    for (const file of walk(join(dir, PLUGIN_ROOT))) {
      if (file === "README.md" || file.startsWith("skills/")) continue;
      const body = readFileSync(join(dir, PLUGIN_ROOT, file), "utf8");
      expect(body, file).not.toContain("arggon-delivery-lead");
    }
  });

  it("registers exactly one MCP server, byte-equal to the generated .mcp.json entry", () => {
    const dir = initClaudeTree();
    const manifest = manifestOf(dir);
    const servers = manifest.mcpServers as Record<string, { command: string; args: string[] }>;
    expect(Object.keys(servers)).toEqual(["arggon"]);
    const generated = JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    // One server, one name: the plugin entry and the project registration are
    // the same command and args, so resolution order cannot pick a different
    // answer (spec §MCP wiring).
    expect(Object.keys(generated.mcpServers)).toEqual(["arggon"]);
    expect(servers.arggon).toEqual(generated.mcpServers.arggon);
    expect(servers.arggon).toMatchObject({ command: "arggon", args: ["mcp"] });
  });

  it("bundles the arggon-cli skill byte-equal to its single source, modulo the generated marker", () => {
    const dir = initClaudeTree();
    expect(BUNDLED_SKILL_FILES.length).toBeGreaterThan(0);
    for (const { source } of BUNDLED_SKILL_FILES) {
      const staging = claudeBundleSkillStagingPath(source);
      expect(staging, `${source} must have a bundle staging path`).not.toBeNull();
      const sourceBytes = readFileSync(join(repoRoot, ...source.split("/")), "utf8");
      // One skill, two destinations: the committed staging copy is the source
      // bytes and nothing else — the marker is init's to stamp, like every
      // other template it renders.
      expect(readFileSync(join(repoRoot, ...staging!.split("/")), "utf8"), staging!).toEqual(
        sourceBytes,
      );
      const dest = `${MARKET_ROOT}/arggon/skills/arggon-cli/${source.slice("skills/arggon-cli/".length)}`;
      const generated = readFileSync(join(dir, ...dest.split("/")), "utf8");
      // The box's own reading: byte-equal modulo the generated marker…
      expect(withoutMarker(generated), dest).toEqual(sourceBytes);
      // …and the marker is the one `init` stamps for this template.
      expect(generated.startsWith("arggon:generated")).toBe(false);
      expect(generated).toContain('arggon:generated template="claude/arggon/skills/arggon-cli/');
    }
    // The bundled set is exactly the arggon-cli source set — no extra file may
    // ride along, and none may go missing.
    const bundled = walk(join(dir, PLUGIN_ROOT, "skills")).sort();
    const expected = BUNDLED_SKILL_FILES.map(
      ({ source }) => `arggon-cli/${source.slice("skills/arggon-cli/".length)}`,
    ).sort();
    expect(bundled).toEqual(expected);
  });
});

describe("claude gate script (reviewer backstop + global git gates)", () => {
  it("denies force push and --no-verify for every session", () => {
    const dir = initClaudeTree();
    for (const command of [
      "git push --force origin main",
      "git push -f origin main",
      "git push -fu origin main",
      "git push --force-with-lease origin main",
      "git push origin +main",
      "git push origin +refs/heads/task-x:main",
      "git commit --no-verify -m x",
    ]) {
      const r = gate(dir, "pre", {
        session_id: "s1",
        tool_name: "Bash",
        tool_input: { command },
      });
      expect(r.status, command).toBe(2);
      expect(r.stderr, command).toContain("arggon gate: denied");
    }
    for (const command of ["git push origin main", "git push origin main extra"]) {
      const ok = gate(dir, "pre", {
        session_id: "s1",
        tool_name: "Bash",
        tool_input: { command },
      });
      expect(ok.status, command).toBe(0);
    }
  });

  // bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes, ported:
  // the shell gates match the command's words, not its quoted arguments — a
  // tracker-comment payload or a commit message QUOTING a denied form is
  // documentation, and denying it blocked exactly the benign writes the
  // methodology mandates.
  it("quoted text is documentation: a comment payload quoting a denied form passes the gate", () => {
    const dir = initClaudeTree();
    for (const command of [
      'npm run arggon -- comment task-x "a force-push probe: git push --force origin main"',
      "npm run arggon -- comment task-x 'quoting git push -fu origin'",
      'git commit -m "docs: never run git commit --no-verify"',
      'echo "git push origin +main"',
      'npm run arggon -- comment task-x "we never git push --force" && git status',
    ]) {
      const r = gate(dir, "pre", { session_id: "s2", tool_name: "Bash", tool_input: { command } });
      expect(r.status, command).toBe(0);
    }
  });

  // The same decision, other side of the line: quoted text the shell still
  // EXECUTES is not documentation — the exemption must not become a bypass.
  // Wrapper-prefixed shells and combined short flags (`bash -lc`, `sh -ec`)
  // execute too, so the matcher is unanchored and only requires the final flag
  // word to CONTAIN c, accepting over-denial of inert look-alikes.
  it("quoted text that executes still denies (only inert text is exempt)", () => {
    const dir = initClaudeTree();
    for (const command of [
      'bash -c "git push --force origin main"',
      "sh -c 'git push --force'",
      'eval "git push --force"',
      'sudo sh -c "git push --force origin main"',
      "ls | xargs sh -c 'git push --force'",
      'bash -lc "git push --force origin main"',
      "sh -ec 'git push --force origin main'",
      'npm run arggon -- comment x "see $(git push --force) docs"',
      'npm run arggon -- comment x "never git push --force', // unterminated quote: tail stays scanned
    ]) {
      const r = gate(dir, "pre", { session_id: "s3", tool_name: "Bash", tool_input: { command } });
      expect(r.status, command).toBe(2);
    }
  });

  // Recorded residual (the gate header's "Deny-pattern scope"): variable
  // indirection is NOT caught — the quoted assignment value is inert text at
  // scan time while the later unquoted expansion executes. This test pins that
  // the ported code does what the documented decision says.
  it("records the variable-indirection residual: assignment values stay exempt", () => {
    const dir = initClaudeTree();
    const command = "X='git push --force origin main'; $X";
    const r = gate(dir, "pre", { session_id: "s4", tool_name: "Bash", tool_input: { command } });
    expect(r.status, command).toBe(0);
  });

  it("keeps ordinary sessions unimpaired", () => {
    const dir = initClaudeTree();
    for (const payload of [
      { session_id: "w1", tool_name: "Write", tool_input: { file_path: "/x/y.ts" } },
      { session_id: "w1", tool_name: "Edit", tool_input: { file_path: "/x/y.ts" } },
      {
        session_id: "w1",
        tool_name: "Bash",
        tool_input: { command: "npm run arggon -- update task-x --status done" },
      },
      {
        session_id: "w1",
        tool_name: "mcp__arggon__arggon_update",
        tool_input: { id: "task-x", status: "done" },
      },
      {
        session_id: "w1",
        tool_name: "mcp__plugin_arggon_arggon__arggon_start",
        tool_input: { id: "task-x" },
      },
      {
        session_id: "w1",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
      },
    ]) {
      const r = gate(dir, "pre", payload);
      expect(r.status, JSON.stringify(payload)).toBe(0);
    }
    // A dispatch of the MAKER role never opens the window: only the reviewer's
    // SubagentStart counts.
    expect(gate(dir, "subagent-start", reviewerEvent("w1", "arggon:arggon-maker")).status).toBe(0);
    expect(gate(dir, "pre", { session_id: "w1", tool_name: "Write", tool_input: {} }).status).toBe(
      0,
    );
  });

  // task-claude-gate-polish: `arggon_handoff` appends a handoff section to an
  // item body — a tracker mutation, not a verdict channel — so it is denied
  // with the rest of the mutating set (spec 024 §Hook gates: "the mutating
  // `mcp__arggon__*` tools are denied for that session; `arggon_comment` stays
  // open"). The ZCode gate leaves `arggon_handoff` unlisted; that divergence is
  // deliberate and recorded on the item. This test fails if the tool moves to
  // the allowed side under EITHER registration, or if the deny message stops
  // naming it.
  it("denies arggon_handoff with the mutating MCP set under both prefixes", () => {
    const dir = initClaudeTree();
    const session = "handoff-1";
    const prefixes = ["mcp__arggon__", "mcp__plugin_arggon_arggon__"];
    const call = (tool: string) =>
      gate(dir, "pre", { session_id: session, tool_name: tool, tool_input: { id: "task-x" } });
    // Outside the window the gate stays out of the way on both routes.
    for (const prefix of prefixes) {
      expect(call(`${prefix}arggon_handoff`).status, prefix).toBe(0);
    }
    expect(gate(dir, "subagent-start", reviewerEvent(session)).status).toBe(0);
    for (const prefix of prefixes) {
      const denied = call(`${prefix}arggon_handoff`);
      expect(denied.status, prefix).toBe(2);
      expect(denied.stderr, prefix).toContain("arggon_handoff");
    }
    // `arggon_comment` remains the one exception the mutating set keeps.
    expect(call("mcp__arggon__arggon_comment").status, "the verdict channel must stay open").toBe(
      0,
    );
  });

  it("marks the reviewer dispatch on SubagentStart and denies mutations until SubagentStop", () => {
    const dir = initClaudeTree();
    const session = "coord-1";
    const reviewerId = shippedReviewerId();
    // The window opens on the reviewer's OWN lifecycle event (agent_type), and
    // stays closed for the plain (unqualified) spelling too — the matcher is
    // prefix-tolerant on both sides.
    expect(gate(dir, "subagent-start", reviewerEvent(session)).status).toBe(0);
    // While the dispatch is in flight: read-only + verdict channel only.
    for (const payload of [
      { tool_name: "Write", tool_input: { file_path: "/x" } },
      { tool_name: "Edit", tool_input: { file_path: "/x" } },
      {
        tool_name: "Bash",
        tool_input: { command: "npm run arggon -- update task-x --status done" },
      },
      { tool_name: "Bash", tool_input: { command: 'sh -c "arggon update task-x --status done"' } },
      {
        tool_name: "Bash",
        tool_input: { command: 'sudo sh -c "arggon update task-x --status done"' },
      },
      { tool_name: "Bash", tool_input: { command: "git commit -m wip" } },
      { tool_name: "Bash", tool_input: { command: "git push origin main" } },
      // task-claude-gate-polish round 1: the shell route carries the same
      // decision as the MCP set — `arggon handoff …` is a tracker append, so it
      // is denied here too (bare, wrapped, and behind `npm run arggon --`).
      { tool_name: "Bash", tool_input: { command: "arggon handoff task-x --next ship-it" } },
      { tool_name: "Bash", tool_input: { command: 'sh -c "arggon handoff task-x"' } },
      { tool_name: "Bash", tool_input: { command: "npm run arggon -- handoff task-x" } },
      { tool_name: "mcp__arggon__arggon_update", tool_input: { id: "task-x" } },
      { tool_name: "mcp__arggon__arggon_create", tool_input: { id: "task-x" } },
      { tool_name: "mcp__plugin_arggon_arggon__arggon_update", tool_input: { id: "task-x" } },
      { tool_name: "mcp__plugin_arggon_arggon__arggon_start", tool_input: { id: "task-x" } },
    ]) {
      const r = gate(dir, "pre", { session_id: session, ...payload });
      expect(r.status, JSON.stringify(payload)).toBe(2);
    }
    // The verdict channel stays open under BOTH registrations, and quoted text
    // that merely documents the denied forms is not a mutation.
    for (const tool of [
      "mcp__arggon__arggon_comment",
      "mcp__plugin_arggon_arggon__arggon_comment",
      "mcp__arggon__arggon_show",
      "mcp__plugin_arggon_arggon__arggon_list",
    ]) {
      expect(
        gate(dir, "pre", { session_id: session, tool_name: tool, tool_input: {} }).status,
        tool,
      ).toBe(0);
    }
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Bash",
        tool_input: {
          command:
            'npm run arggon -- comment task-x "the reviewer cannot run arggon update or git commit"',
        },
      }).status,
    ).toBe(0);
    // task-claude-gate-polish round 1: `comment` stays OUT of the shell word
    // list on purpose — the verdict channel is open on this route too, even
    // when its payload documents the denied `handoff` word.
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Bash",
        tool_input: { command: 'npm run arggon -- comment task-x "handoff context: not shipped"' },
      }).status,
    ).toBe(0);
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Bash",
        tool_input: { command: "npm test" },
      }).status,
    ).toBe(0);
    // The dispatch returns: the window closes.
    expect(gate(dir, "subagent-stop", reviewerEvent(session, reviewerId)).status).toBe(0);
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Write", tool_input: {} }).status,
    ).toBe(0);
  });

  it("parallel reviewer dispatches keep the window open until the last returns", () => {
    const dir = initClaudeTree();
    const session = "coord-2";
    expect(gate(dir, "subagent-start", reviewerEvent(session)).status).toBe(0);
    expect(gate(dir, "subagent-start", reviewerEvent(session)).status).toBe(0);
    expect(gate(dir, "subagent-stop", reviewerEvent(session)).status).toBe(0);
    // One dispatch still in flight: mutations stay denied.
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Write", tool_input: {} }).status,
    ).toBe(2);
    expect(gate(dir, "subagent-stop", reviewerEvent(session)).status).toBe(0);
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Write", tool_input: {} }).status,
    ).toBe(0);
  });

  it("Stop clears the session state and other sessions are never touched", () => {
    const dir = initClaudeTree();
    const session = "coord-3";
    expect(gate(dir, "subagent-start", reviewerEvent(session)).status).toBe(0);
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Write", tool_input: {} }).status,
    ).toBe(2);
    expect(gate(dir, "stop", { session_id: session }).status).toBe(0);
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Write", tool_input: {} }).status,
    ).toBe(0);
    // A different session (or project) never sees the marker.
    expect(
      gate(dir, "pre", { session_id: "other", tool_name: "Write", tool_input: {} }).status,
    ).toBe(0);
  });

  it("fails open on an unparseable payload (documented, never a deny)", () => {
    const dir = initClaudeTree();
    const proc = spawnSync(process.execPath, [join(dir, PLUGIN_ROOT, "hooks/gate.mjs"), "pre"], {
      input: "not json",
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    });
    expect(proc.status).toBe(0);
  });
});

/**
 * Live stdio round-trip (spec §Headless smoke parity bar): the entry the
 * manifest declares — `arggon` + `["mcp"]` — is spawned as a real process
 * against a fixture tracker, and one `arggon_show` call returns the documented
 * envelope. CI has no globally installed `arggon`, so the child is the
 * worktree's own CLI entry with the declared args (`mcp`): the same bytes the
 * declared binary would run, and the registration Claude Code would perform.
 */
describe("claude bundle MCP registration serves a live server", () => {
  it("returns the documented arggon_show envelope over real stdio", async () => {
    const dir = initClaudeTree();
    const servers = manifestOf(dir).mcpServers as Record<string, { args: string[] }>;
    const child = spawnNodeCli(servers.arggon!.args, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.setEncoding("utf8");
    const responses = new Map<number, Record<string, unknown>>();
    let buffer = "";
    let notify: (() => void) | null = null;
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const message = JSON.parse(line) as { id?: number };
        if (typeof message.id === "number")
          responses.set(message.id, message as Record<string, unknown>);
        notify?.();
      }
    });
    const request = (id: number, method: string, params?: Record<string, unknown>) =>
      new Promise<Record<string, unknown>>((resolveRequest, reject) => {
        const deadline = Date.now() + 20_000;
        const check = () => {
          const found = responses.get(id);
          if (found !== undefined) return resolveRequest(found);
          if (Date.now() > deadline) return reject(new Error(`timed out: ${method}`));
          setTimeout(check, 25);
        };
        notify = () => check();
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
        check();
      });
    try {
      const initialized = await request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "claude-seam-test", version: "1.0" },
      });
      expect(initialized.result).toMatchObject({ serverInfo: { name: "arggon" } });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
      );
      const created = (await request(2, "tools/call", {
        name: "arggon_create",
        arguments: { type: "initiative", title: "Round trip" },
      })) as { result: { content: Array<{ text: string }> } };
      const createEnvelope = JSON.parse(created.result.content[0]!.text) as { ok: boolean };
      expect(createEnvelope.ok).toBe(true);
      const shown = (await request(3, "tools/call", {
        name: "arggon_show",
        arguments: { id: "round-trip", meta: true },
      })) as { result: { content: Array<{ text: string }> } };
      const envelope = readEnvelope({
        surface: "MCP",
        command: "arggon_show",
        text: shown.result.content[0]!.text,
      }).envelope;
      expect(envelope).toMatchObject({ ok: true, command: "show" });
      expect((envelope.item as { id?: string }).id).toBe("round-trip");
    } finally {
      child.kill("SIGTERM");
    }
  }, 40_000);
});

/**
 * Optional client probes (spec 024 §"Optional, skipped when absent"): the
 * binary is present on a developer machine and absent in CI, so these degrade
 * to vitest's SKIP — `skipped: claude not installed`, never a pass. Every
 * invocation runs under a THROWAWAY HOME + CLAUDE_CONFIG_DIR inside the temp
 * dir, so no probe can read or write the real `~/.claude`.
 */
describe("claude code live probes (optional, skipped when absent)", () => {
  /**
   * Is the Claude Code binary on PATH? Probed under a THROWAWAY HOME +
   * CLAUDE_CONFIG_DIR created here and removed again, so no probe — this one
   * included — can read or write the real `~/.claude`.
   */
  const claudeStatus = (() => {
    const probe = _mkdtempSync(join(tmpdir(), "claude-version-probe-"));
    try {
      const home = join(probe, "home");
      const config = join(probe, "config");
      mkdirSync(home, { recursive: true });
      mkdirSync(config, { recursive: true });
      return spawnSync("claude", ["--version"], {
        encoding: "utf8",
        timeout: 30_000,
        env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: config },
      }).status;
    } catch {
      return null;
    } finally {
      rmSync(probe, { recursive: true, force: true });
    }
  })();
  const available = claudeStatus === 0;
  if (!available) {
    // CI has no claude binary: record the degradation in the run log, in the
    // same shape the OpenCode smoke uses. `process.stdout.write`, not
    // `console.log` — vitest 5 swallows console output for passing files, and
    // a skip nobody can see in the log is indistinguishable from a deleted
    // probe. The machine-readable record is vitest's own `↓` skip line.
    process.stdout.write("skipped: claude not installed\n");
  }

  it.skipIf(!available)("validates, installs and inventories the generated bundle", () => {
    const dir = initClaudeTree();
    const probe = mkdtempSync(join(tmpdir(), "claude-probe-home-"));
    const home = join(probe, "home");
    const config = join(probe, "config");
    mkdirSync(home, { recursive: true });
    mkdirSync(config, { recursive: true });
    const env = { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: config };
    const claude = (args: string[], cwd = dir) =>
      spawnSync("claude", args, { cwd, encoding: "utf8", env, timeout: 180_000 });

    // `--strict` turns every warning into a failure: both manifests are
    // warning-free (author on the plugin, description on the marketplace).
    for (const root of [join(dir, PLUGIN_ROOT), join(dir, MARKET_ROOT)]) {
      const validated = claude(["plugin", "validate", "--strict", root]);
      expect(validated.status, validated.stderr + validated.stdout).toBe(0);
      expect(validated.stdout).toContain("Validation passed");
      expect(validated.stdout).not.toContain("warning");
    }

    // The platform's one manual install step, against a throwaway config dir.
    const added = claude(["plugin", "marketplace", "add", join(dir, MARKET_ROOT)]);
    expect(added.status, added.stderr + added.stdout).toBe(0);
    expect(added.stdout).toContain("Successfully added marketplace");
    const installed = claude(["plugin", "install", "arggon@arggon-local"]);
    expect(installed.status, installed.stderr + installed.stdout).toBe(0);
    expect(installed.stdout).toContain("Successfully installed");

    // The probe-pinned inventory: omitting `agents` loads the convention
    // directory — `Agents (2)` — and commands surface under Skills in 2.1.x.
    const details = claude(["plugin", "details", "arggon"]);
    expect(details.status, details.stderr + details.stdout).toBe(0);
    expect(details.stdout).toContain("Agents (2)");
    for (const id of ["arggon-maker", "arggon-standards-reviewer"]) {
      expect(details.stdout).toContain(id);
    }
    expect(details.stdout).toContain("Hooks (4)");
    expect(details.stdout).toContain("MCP servers (1)");
    for (const command of COMMANDS) expect(details.stdout).toContain(command);

    // Both registrations resolve to the same server: the plugin-scoped entry
    // and the project `.mcp.json` entry.
    const listed = claude(["mcp", "list"]);
    expect(listed.status, listed.stderr + listed.stdout).toBe(0);
    expect(listed.stdout).toContain("plugin:arggon:arggon");
    expect(listed.stdout).toMatch(/^arggon: /m);
  });
});
