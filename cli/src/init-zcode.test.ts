/**
 * ZCode plugin seam (ADR 0014, task-zcode-plugin-seam): `arggon init` vendors
 * a declarative ZCode plugin under `.zcode-marketplace/` — marketplace
 * catalog, manifest, the commands, the two subagents (maker,
 * standards-reviewer; the delivery lead is the MAIN SESSION in ZCode — see the
 * parity test below) and the hook
 * gates (global git gates + the dispatch-scoped reviewer backstop).
 *
 * The gate script is exercised as a real child process against the GENERATED
 * file (not the template): init output is the artifact adopters run.
 *
 * The dispatch-scoped backstop is additionally bound to the SHIPPED ids by
 * reading them out of the templates (spec-agent-rename-019 AC 2): the gate
 * matches an agent name as a string, so a rename that misses its matcher does
 * not fail loudly — it silently stops opening the read-only window. Both the
 * matcher and the id are derived here; neither is restated, so the pairing
 * cannot drift.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runInit } from "./init.js";

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
/** The shipped templates (the source init materializes the seam from). */
const shipped = {
  agentsDir: join(repoRoot, "templates/docs/zcode/arggon/agents"),
  reviewCommand: join(repoRoot, "templates/docs/zcode/arggon/commands/arggon-review.md"),
  gate: join(repoRoot, "templates/docs/zcode/arggon/hooks/gate.mjs"),
};

const MARKET_ROOT = ".zcode-marketplace";
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

function initTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-zcode-"));
  runInit({ dir, force: false });
  return dir;
}

/**
 * The shipped standards-reviewer id, DERIVED from the gate's own matcher
 * (AC 2): the behavioural probes below must keep working whatever the id is
 * called, so restating it here would only add a second place to forget.
 */
function shippedReviewerId(): string {
  const src = readFileSync(join(repoRoot, "templates/docs/zcode/arggon/hooks/gate.mjs"), "utf8");
  const match = /\/\(\^\|:\)([a-z-]+)\$\//.exec(src);
  expect(match, "the gate's isReviewerDispatch matcher must stay greppable").not.toBeNull();
  return match![1]!;
}

/** Run the generated gate script with a JSON stdin payload. */
function gate(
  dir: string,
  mode: "pre" | "post" | "stop",
  payload: Record<string, unknown>,
): { status: number; stderr: string } {
  const proc = spawnSync(process.execPath, [join(dir, PLUGIN_ROOT, "hooks/gate.mjs"), mode], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, ZCODE_PROJECT_DIR: dir },
    timeout: 15_000,
  });
  return { status: proc.status ?? -1, stderr: proc.stderr ?? "" };
}

describe("zcode plugin seam generation", () => {
  it("generates the marketplace catalog and the vendored plugin", () => {
    const dir = initTree();
    for (const rel of [
      `${MARKET_ROOT}/marketplace.json`,
      `${PLUGIN_ROOT}/.zcode-plugin/plugin.json`,
      `${PLUGIN_ROOT}/hooks/hooks.json`,
      `${PLUGIN_ROOT}/hooks/gate.mjs`,
      ...COMMANDS.map((c) => `${PLUGIN_ROOT}/commands/arggon-${c}.md`),
      // The shipped agent set, derived: a new role must be generated because the
      // template exists, not because this list remembers it.
      ...readdirSync(shipped.agentsDir).map((a) => `${PLUGIN_ROOT}/agents/${a}`),
    ]) {
      expect(existsSync(join(dir, ...rel.split("/"))), rel).toBe(true);
    }
    expect(readdirSync(join(dir, PLUGIN_ROOT, "commands"))).toHaveLength(13);
    // task-zcode-lead-role-belongs-to-the-main-session: two subagents — the
    // delivery lead is the main session's role and is no longer materialized
    // (the parity test below pins the rule, not this count).
    expect(readdirSync(join(dir, PLUGIN_ROOT, "agents"))).toHaveLength(2);
  });

  /**
   * The 2026-10-01 artifact-audit rule ("`agents/` name-for-name parity with
   * `.opencode/agents`"), RELAXED (task-zcode-lead-role-belongs-to-the-main-
   * session) to **parity modulo the primary/subagent mode split**: ZCode can
   * only surface plugin agents as dispatchable subagents (Settings →
   * Subagents; the Agent tool) — it has no primary/session-agent concept —
   * while the delivery lead is the primary worker who interacts with the
   * product owner (ADR 0021 §6.1/§6.2a′; `ArggonManager/docs/agents.md`
   * §Orchestration marks maker/reviewer/verifier "(subagent)" and leaves the
   * lead unmarked for exactly this reason). Materializing the lead here
   * invited the main session to spawn a lead-child with no product-owner
   * channel, so the lead role is carried by the instruction carriers instead.
   * Concretely: the OpenCode seam (the reference implementation) is the role
   * source; every ZCode agent must be an OpenCode SUBAGENT role of the same
   * name, no ZCode surface may dispatch a primary role, and the only OpenCode
   * subagent not yet shipped here is the recorded v1 verifier gap (no ZCode
   * verifier — `ArggonManager/docs/agents.md` §Who proves, who reviews; it
   * joins as a subagent when it ships, which breaks the count below on
   * purpose).
   */
  it("agents/ parity with .opencode/agents modulo the primary/subagent mode split", () => {
    const opencodeAgentsDir = join(repoRoot, "templates/docs/opencode/agents");
    const modes = readdirSync(opencodeAgentsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        id: f.replace(/\.md$/, ""),
        mode: /^mode:\s*(\S+)/m.exec(readFileSync(join(opencodeAgentsDir, f), "utf8"))?.[1] ?? "",
      }));
    // The reference seam's role split is sound: exactly one primary (the lead),
    // everything else a subagent — otherwise "modulo the mode split" has no
    // well-defined complement to parity against.
    const primary = modes.filter((a) => a.mode === "primary").map((a) => a.id);
    const subagents = modes.filter((a) => a.mode === "subagent").map((a) => a.id);
    expect(primary).toEqual(["arggon-delivery-lead"]);

    const zcodeIds = readdirSync(shipped.agentsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
    // Name-for-name parity holds on the subagent side: every ZCode agent IS an
    // OpenCode subagent role — no ZCode-only role may appear.
    for (const id of zcodeIds) {
      expect(subagents, id).toContain(id);
    }
    // ...and the primary role is exactly what the seam omits: the lead is the
    // main session, never a dispatchable subagent.
    for (const id of primary) {
      expect(zcodeIds, id).not.toContain(id);
    }
    // The recorded residual: the verifier subagent has no ZCode materialization
    // yet (v1 gap, `task-prover-agent-reviewer-split` scoped it to OpenCode).
    // When it ships, update this line WITH the generator change — the assertion
    // is the inventory's memory.
    expect(zcodeIds.sort()).toEqual(["arggon-maker", "arggon-standards-reviewer"]);
  });

  it("the lead's contract reaches the main session: the README states the rule and no surface dispatches a lead", () => {
    // task-zcode-lead-role-belongs-to-the-main-session AC 2: with the lead
    // agent gone, the main session must still learn it IS the lead — through
    // the init-generated seam README (the carrier that ships with the plugin),
    // and no generated file may tell it to dispatch one.
    const dir = initTree();
    const readme = readFileSync(join(dir, PLUGIN_ROOT, "README.md"), "utf8");
    expect(readme).toContain("the main session IS the delivery lead");
    expect(readme).toContain("Do not dispatch a \"lead\"");

    // No generated file carries the lead's agent id — the id is retired from
    // the seam, so a stale dispatch instruction cannot hide in any artifact.
    // The README is the one legitimate exception BY DESIGN: it names the id in
    // order to forbid dispatching it, so the scan covers everything else.
    const walk = (rel: string): string[] => {
      const abs = join(dir, PLUGIN_ROOT, rel);
      return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(rel, e.name)) : [join(rel, e.name)],
      );
    };
    for (const file of walk(".")) {
      if (file === "README.md") continue;
      const body = readFileSync(join(dir, PLUGIN_ROOT, file), "utf8");
      expect(body, String(file)).not.toContain("arggon-delivery-lead");
    }
  });

  it("generates a schema-valid manifest whose marketplace entry matches it", () => {
    const dir = initTree();
    const manifest = JSON.parse(
      readFileSync(join(dir, PLUGIN_ROOT, ".zcode-plugin/plugin.json"), "utf8"),
    ) as Record<string, unknown>;
    // ZCode name pattern: ^[a-z0-9][a-z0-9._-]{0,127}$
    expect(manifest.name).toMatch(/^[a-z0-9][a-z0-9._-]{0,127}$/);
    expect(manifest.name).toBe("arggon");
    for (const field of ["commands", "agents", "hooks"]) {
      expect(existsSync(join(dir, PLUGIN_ROOT, String(manifest[field]))), String(field)).toBe(true);
    }
    // Inline MCP server: the stdio adapter the whole surface rides on.
    const mcp = manifest.mcpServers as Record<string, Record<string, unknown>>;
    expect(mcp.arggon).toMatchObject({ command: "arggon", args: ["mcp"] });

    const catalog = JSON.parse(
      readFileSync(join(dir, MARKET_ROOT, "marketplace.json"), "utf8"),
    ) as { plugins: Array<{ name: string; source: string }> };
    const entry = catalog.plugins.find((p) => p.name === manifest.name);
    expect(entry).toBeDefined();
    expect(existsSync(join(dir, MARKET_ROOT, entry!.source))).toBe(true);
  });

  it("carries provenance markers in the destination-appropriate syntax", () => {
    const dir = initTree();
    const command = readFileSync(join(dir, PLUGIN_ROOT, "commands/arggon-next.md"), "utf8");
    // Frontmatter-first artifacts take the marker INSIDE the frontmatter.
    expect(command.startsWith("---\n# arggon:generated")).toBe(true);
    const gate = readFileSync(join(dir, PLUGIN_ROOT, "hooks/gate.mjs"), "utf8");
    expect(gate.startsWith("// arggon:generated")).toBe(true);
    // JSON destinations carry no marker.
    const manifest = readFileSync(join(dir, PLUGIN_ROOT, ".zcode-plugin/plugin.json"), "utf8");
    expect(manifest.startsWith("{")).toBe(true);
  });

  it("commands address the arggon MCP surface, not the OpenCode code-mode API", () => {
    const dir = initTree();
    const commandsDir = join(dir, PLUGIN_ROOT, "commands");
    for (const name of readdirSync(commandsDir)) {
      const body = readFileSync(join(commandsDir, name), "utf8");
      expect(body, name).not.toContain("tools.arggon.");
    }
    const reviewer = readFileSync(join(dir, PLUGIN_ROOT, "commands/arggon-review.md"), "utf8");
    expect(reviewer).toContain(`arggon:${shippedReviewerId()}`);
  });

  it("never overwrites an adopter-modified seam file (provenance decision table)", () => {
    const dir = initTree();
    const dest = join(dir, PLUGIN_ROOT, "commands/arggon-next.md");
    const adopted = "---\ndescription: my own next command\n---\nmine.\n";
    const original = readFileSync(dest, "utf8");
    expect(original).not.toEqual(adopted);
    // Simulate an adopter edit: the content no longer matches the recorded
    // checksum, so the next run must keep it (modified-skip).
    writeFileSync(dest, adopted, "utf8");
    const result = runInit({ dir, force: false });
    expect(readFileSync(dest, "utf8")).toEqual(adopted);
    expect((result.skipped ?? []).some((s) => s.includes("arggon-next.md"))).toBe(true);
  });
});

describe("zcode gate script (reviewer backstop + global git gates)", () => {
  // AC 2 (spec-agent-rename-019): the shipped reviewer id cannot drift from the
  // gate's matcher. The matcher is a STRING in a security-relevant path — rename
  // the agent, miss the regex, and the dispatch-scoped read-only window stops
  // opening with no failure anywhere: the reviewer's backstop silently disarms.
  // Both sides are read from the shipped templates, so this test fails CI on a
  // rename that does not update the gate (and on a gate that outlives its id).
  it("the reviewer backstop's matcher follows the shipped reviewer id (AC 2: no silent disarm)", () => {
    const dir = initTree();
    const agentsDir = join(dir, PLUGIN_ROOT, "agents");
    const ids = readdirSync(agentsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const body = readFileSync(join(agentsDir, f), "utf8");
        return {
          id: /^name:\s*(\S+)/m.exec(body)![1]!,
          // The reviewer is the one whose toolset carries the verdict channel.
          isReviewer: body.includes("mcp__arggon__arggon_comment"),
        };
      });
    const reviewers = ids.filter((a) => a.isReviewer);
    expect(reviewers, "exactly one generated agent carries the verdict channel").toHaveLength(1);

    // The gate watches exactly that id — a rename that misses the matcher fails
    // HERE (silently disarmed backstop) instead of in an adopter's session.
    const watched = shippedReviewerId();
    expect(watched).toBe(reviewers[0]!.id);
    // The plugin-qualified spelling the Agent tool actually sends.
    expect(new RegExp(`(^|:)${watched}$`).test(`arggon:${reviewers[0]!.id}`)).toBe(true);
    // And no other shipped agent may satisfy it — the window is per-reviewer.
    for (const other of ids.filter((a) => !a.isReviewer)) {
      expect(new RegExp(`(^|:)${watched}$`).test(other.id), other.id).toBe(false);
    }
  });

  it("the shipped review command dispatches the id the gate matches (AC 2)", () => {
    const command = readFileSync(shipped.reviewCommand, "utf8");
    expect(command, "the review command must dispatch the id the gate watches").toContain(
      `arggon:${shippedReviewerId()}`,
    );
  });

  it("denies force push and --no-verify for every session", () => {
    const dir = initTree();
    for (const command of [
      "git push --force origin main",
      "git push -f origin main",
      "git push -fu origin main",
      "git push --force-with-lease origin main",
      "git push origin +main",
      "git push origin +refs/heads/task-x:main",
      "git commit --no-verify -m x",
    ]) {
      const r = gate(dir, "pre", { session_id: "s1", tool_name: "Bash", tool_input: { command } });
      expect(r.status, command).toBe(2);
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

  // bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes: the
  // decided scope (documented in the gate header) is that the shell gates
  // match the command's words, not its quoted arguments — a tracker-comment
  // payload or a commit message QUOTING a denied form is documentation, and
  // denying it blocked exactly the benign writes the methodology mandates.
  it("quoted text is documentation: a comment payload quoting a denied form passes the gate", () => {
    const dir = initTree();
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
  // Wrapper-prefixed shells execute too (review round 1: the first matcher
  // was anchored to a command boundary, so `sudo sh -c …` / `xargs sh -c …`
  // were blanked as inert and ran), and so do combined short flags (review
  // round 2: requiring the final flag word to be exactly `-c` let `bash -lc`
  // / `sh -ec` payloads blank and run); the matcher is unanchored and only
  // requires the final flag word to CONTAIN c, accepting over-denial of
  // inert look-alikes.
  it("quoted text that executes still denies (only inert text is exempt)", () => {
    const dir = initTree();
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

  // Recorded residual (decision artifact, header "Deny-pattern scope"):
  // variable indirection is NOT caught — the quoted assignment value is inert
  // text at scan time while the later unquoted expansion executes. Fixing
  // that would mean a real shell parser, past this gate's accidental-use
  // threat model (the old regex gate was equally evadable via a split flag).
  // This test pins that the code does what the documented decision says.
  it("records the variable-indirection residual: assignment values stay exempt", () => {
    const dir = initTree();
    const command = "X='git push --force origin main'; $X";
    const r = gate(dir, "pre", { session_id: "s4", tool_name: "Bash", tool_input: { command } });
    expect(r.status, command).toBe(0);
  });

  it("keeps ordinary sessions unimpaired", () => {
    const dir = initTree();
    for (const payload of [
      { session_id: "w1", tool_name: "Write", tool_input: { file_path: "/x/y.ts" } },
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
        tool_name: "Agent",
        tool_input: { subagent_type: "arggon:arggon-maker" },
      },
    ]) {
      const r = gate(dir, "pre", payload);
      expect(r.status, JSON.stringify(payload)).toBe(0);
    }
  });

  it("marks a reviewer dispatch and denies mutations until it returns", () => {
    const dir = initTree();
    const session = "coord-1";
    const reviewerId = shippedReviewerId();
    // Dispatch begins: the gate marks the session.
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Agent",
        tool_input: { subagent_type: `arggon:${reviewerId}` },
      }).status,
    ).toBe(0);
    // While the dispatch is in flight: read-only + verdict channel only.
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Write", tool_input: { file_path: "/x" } })
        .status,
    ).toBe(2);
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Edit", tool_input: { file_path: "/x" } })
        .status,
    ).toBe(2);
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Bash",
        tool_input: { command: "npm run arggon -- update task-x --status done" },
      }).status,
    ).toBe(2);
    // Quoted invocations mutate the tracker all the same (review finding:
    // the old leading-character class let `sh -c "arggon update x"` through)
    // — and wrapper-prefixed shells all the same again (review on this bug:
    // the first quote-aware matcher was boundary-anchored, so a sudo-wrapped
    // form blanked as inert inside the read-only window).
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Bash",
        tool_input: { command: 'sh -c "arggon update task-x --status done"' },
      }).status,
    ).toBe(2);
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Bash",
        tool_input: { command: 'sudo sh -c "arggon update task-x --status done"' },
      }).status,
    ).toBe(2);
    // …but quoted TEXT that merely documents the denied forms (a verdict
    // describing them) is not a mutation (bug-gate-deny-pattern-matches-
    // quoted-text-blocking-benign-writes decision).
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
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Bash",
        tool_input: { command: "git commit -m wip" },
      }).status,
    ).toBe(2);
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "mcp__arggon__arggon_update",
        tool_input: { id: "task-x" },
      }).status,
    ).toBe(2);
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "mcp__arggon__arggon_comment",
        tool_input: { id: "task-x", text: "verdict" },
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
    expect(
      gate(dir, "post", {
        session_id: session,
        tool_name: "Agent",
        tool_input: { subagent_type: `arggon:${reviewerId}` },
      }).status,
    ).toBe(0);
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Write", tool_input: { file_path: "/x" } })
        .status,
    ).toBe(0);
  });

  it("parallel reviewer dispatches keep the window open until the last returns", () => {
    const dir = initTree();
    const session = "coord-2";
    const reviewer = {
      session_id: session,
      tool_name: "Agent",
      tool_input: { subagent_type: shippedReviewerId() },
    };
    expect(gate(dir, "pre", reviewer).status).toBe(0);
    expect(gate(dir, "pre", reviewer).status).toBe(0);
    expect(gate(dir, "post", reviewer).status).toBe(0);
    // One dispatch still in flight: mutations stay denied.
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Write", tool_input: { file_path: "/x" } })
        .status,
    ).toBe(2);
    expect(gate(dir, "post", reviewer).status).toBe(0);
    expect(
      gate(dir, "pre", { session_id: session, tool_name: "Write", tool_input: { file_path: "/x" } })
        .status,
    ).toBe(0);
  });

  it("Stop clears the session state and other sessions are never touched", () => {
    const dir = initTree();
    const session = "coord-3";
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Agent",
        tool_input: { subagent_type: `arggon:${shippedReviewerId()}` },
      }).status,
    ).toBe(0);
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
});

/**
 * Opt-in automation templates (spec methodology-adapters-017 §S5, plan T5,
 * task-zcode-automations): a daily spec-drift scan and a weekly stale-claim
 * sweep, vendored beside the goal-mode contract template. The contracts are
 * pinned by DERIVING them from the shipped template bytes — restating the
 * rules here would let the template and the test drift apart silently.
 */
describe("zcode automation templates (opt-in, spec S5)", () => {
  const AUTOMATIONS = [
    "automations/spec-drift-scan.md",
    "automations/stale-claim-sweep.md",
  ] as const;

  /** Read a shipped automation template (the source init materializes from). */
  function shippedAutomation(rel: string): string {
    return readFileSync(join(repoRoot, "templates/docs/zcode/arggon/templates", rel), "utf8");
  }

  /** Text before the filing section: frontmatter + preconditions + scan. */
  function preFiling(template: string): string {
    const cut = template.indexOf("## Filing");
    expect(cut, "the template carries a filing section").toBeGreaterThan(0);
    return template.slice(0, cut);
  }

  /** Text of the scan section only. */
  function scanSection(template: string): string {
    const start = template.indexOf("## Scan");
    const end = template.indexOf("## Filing");
    expect(start, "the template carries a scan section").toBeGreaterThan(0);
    expect(end, "filing follows scan").toBeGreaterThan(start);
    return template.slice(start, end);
  }

  /** Backtick-quoted commands in `text` (the templates quote every command). */
  function quotedCommands(text: string): string[] {
    return [...text.matchAll(/`([^`]+)`/g)]
      .map((m) => m[1]!.trim())
      .filter((cmd) => cmd.startsWith("arggon ") || cmd.startsWith("git "));
  }

  /**
   * The contract prose with markdown hard-wraps collapsed, so a phrase
   * assertion is about the WORDS the template carries, not its line length.
   */
  function contract(template: string): string {
    return template.replace(/\s+/g, " ");
  }

  it("generates both automation templates with provenance markers (tier-1)", () => {
    const dir = initTree();
    for (const rel of AUTOMATIONS) {
      const dest = join(dir, PLUGIN_ROOT, "templates", ...rel.split("/"));
      expect(existsSync(dest), rel).toBe(true);
      const generated = readFileSync(dest, "utf8");
      // Frontmatter-first artifacts carry the marker INSIDE the frontmatter,
      // like the commands and the goal-mode template.
      expect(generated.startsWith("---\n# arggon:generated"), rel).toBe(true);
      // The generated copy is the template modulo the marker line.
      const marker = /^# arggon:generated template="[^"]+"\n/m;
      expect(generated.replace(marker, ""), rel).toEqual(shippedAutomation(rel));
    }
  });

  it("never overwrites an adopter-edited automation template", () => {
    const dir = initTree();
    const dest = join(dir, PLUGIN_ROOT, "templates/automations/spec-drift-scan.md");
    const adopted = readFileSync(dest, "utf8").replace(
      "Cadence: **daily**",
      "Cadence: **twice a day**",
    );
    writeFileSync(dest, adopted, "utf8");
    const result = runInit({ dir, force: false });
    expect(readFileSync(dest, "utf8")).toEqual(adopted);
    expect((result.skipped ?? []).some((s) => s.includes("spec-drift-scan.md"))).toBe(true);
  });

  it("each template carries the claim/branch preconditions (AC 1)", () => {
    for (const rel of AUTOMATIONS) {
      const pre = contract(preFiling(shippedAutomation(rel)));
      // Claim precondition: the automation is nobody's item work.
      expect(pre, rel).toContain("No claim held");
      expect(pre, rel).toContain("worktree_path");
      expect(pre, rel).toContain("never claims, branches or checks out anything");
      // Branch precondition: primary checkout, default branch, clean tree.
      expect(pre, rel).toContain("Primary checkout, default branch");
      expect(pre, rel).toContain("git status --porcelain");
      expect(pre, rel).toContain("clean tree");
    }
  });

  it("the scan runs read-only; only the filing section may write (AC 2)", () => {
    // The read-only primitives the scan sections may quote. A new scan step
    // must either be added here (after proving it is a pure read) or rejected.
    const READ_ONLY = new Set([
      "arggon validate --json",
      "arggon spec validate --json",
      "arggon spec analyze --json",
      "arggon doctor --agents --json",
      "arggon list --stale --older-than 7d --json",
      "arggon show <id> --meta --json",
      "git status --porcelain",
    ]);
    for (const rel of AUTOMATIONS) {
      const template = shippedAutomation(rel);
      // The scan itself never names the write primitive, and every command it
      // quotes is a pure read. (Frontmatter and preconditions MAY name
      // `arggon create` — they declare the write budget; the scan does not.)
      const scan = scanSection(template);
      expect(scan, rel).not.toContain("arggon create");
      for (const cmd of quotedCommands(scan)) {
        expect(READ_ONLY.has(cmd), `${rel}: ${cmd}`).toBe(true);
      }
      // The ONLY write surface is `arggon create` (plus its documented comment
      // on the NEW finding, never on a scanned item).
      const filing = template.slice(template.indexOf("## Filing"));
      expect(filing, rel).toContain("arggon create");
      expect(filing, rel).toContain("whole write surface");
    }
    // The spec-drift scan's no-story fallback is a parseable rule with a main
    // verb and a deterministic parent, not a dangling sentence (review fix):
    // fall back to the topic-matched story, else skip and log — never a
    // guessed parent.
    const driftFiling = shippedAutomation("automations/spec-drift-scan.md").slice(
      shippedAutomation("automations/spec-drift-scan.md").indexOf("## Filing"),
    );
    expect(contract(driftFiling)).toContain(
      "falls back to the story whose id stem matches the spec's topic",
    );
    expect(contract(driftFiling)).toContain("never filed under a guessed parent");
    expect(contract(driftFiling)).toContain("`spec-<topic>-NNN` → `story-<topic>`");
    // The sweep pins its kernel primitive: `arggon list --stale`.
    expect(shippedAutomation("automations/stale-claim-sweep.md")).toContain(
      "arggon list --stale",
    );
    // ... and never mutates the stale item it reports.
    const sweep = shippedAutomation("automations/stale-claim-sweep.md");
    expect(sweep).toContain("NEVER touch the stale item itself");
  });

  it("both templates are documented as opt-in (AC 3)", () => {
    for (const rel of AUTOMATIONS) {
      const template = contract(shippedAutomation(rel));
      expect(template, rel).toMatch(/description: OPT-IN /);
      expect(template, rel).toContain("Nothing is scheduled or runs until");
      expect(template, rel).toContain("Deleting it is the off switch");
    }
    // Docs travel: agents.md §ZCode documents the pair as opt-in automations.
    const agents = readFileSync(join(repoRoot, "ArggonManager/docs/agents.md"), "utf8");
    expect(agents).toContain("templates/automations/spec-drift-scan.md");
    expect(agents).toContain("templates/automations/stale-claim-sweep.md");
    expect(agents).toContain("**Automations (opt-in)**");
  });
});
