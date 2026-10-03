/**
 * ZCode plugin seam (ADR 0014, task-zcode-plugin-seam): `arggon init` vendors
 * a declarative ZCode plugin under `.zcode-marketplace/` — marketplace
 * catalog, manifest, the eleven commands, the three agents and the hook
 * gates (global git gates + the dispatch-scoped reviewer backstop).
 *
 * The gate script is exercised as a real child process against the GENERATED
 * file (not the template): init output is the artifact adopters run.
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
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate, runUpdate } from "@arggondev/lib";
import { runGoal } from "./goal-mode.js";
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

const MARKET_ROOT = ".zcode-marketplace";
const PLUGIN_ROOT = `${MARKET_ROOT}/arggon`;
/** The goal-mode contract template (`arggon goal <id>` instantiates it). */
const GOAL_TEMPLATE = `${PLUGIN_ROOT}/templates/goal-mode.md`;
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
      GOAL_TEMPLATE,
      ...COMMANDS.map((c) => `${PLUGIN_ROOT}/commands/arggon-${c}.md`),
      ...["coordinator", "reviewer", "worker"].map((a) => `${PLUGIN_ROOT}/agents/arggon-${a}.md`),
    ]) {
      expect(existsSync(join(dir, ...rel.split("/"))), rel).toBe(true);
    }
    expect(readdirSync(join(dir, PLUGIN_ROOT, "commands"))).toHaveLength(13);
    expect(readdirSync(join(dir, PLUGIN_ROOT, "agents"))).toHaveLength(3);
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
    expect(reviewer).toContain("arggon:arggon-reviewer");
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

  it("never overwrites an adopter-edited goal-mode template either", () => {
    const dir = initTree();
    const dest = join(dir, ...GOAL_TEMPLATE.split("/"));
    const adopted = "---\ndescription: my own goal template\n---\nmine.\n";
    expect(readFileSync(dest, "utf8")).not.toEqual(adopted);
    writeFileSync(dest, adopted, "utf8");
    const result = runInit({ dir, force: false });
    expect(readFileSync(dest, "utf8")).toEqual(adopted);
    expect((result.skipped ?? []).some((s) => s.includes("templates/goal-mode.md"))).toBe(true);
  });
});

describe("zcode goal-mode template (task-zcode-goal-mode)", () => {
  it("is generated with provenance and the slots `arggon goal` fills", () => {
    const dir = initTree();
    const template = readFileSync(join(dir, ...GOAL_TEMPLATE.split("/")), "utf8");
    // Frontmatter-first destination: the marker sits INSIDE the frontmatter.
    expect(template.startsWith("---\n# arggon:generated")).toBe(true);
    expect(template).toContain('template="zcode/arggon/templates/goal-mode.md"');
    for (const slot of [
      "{{ITEM_ID}}",
      "{{GOAL_OBJECTIVE}}",
      "{{GOAL_VERIFICATION}}",
      "{{WORKTREE_PATH}}",
      "{{BRANCH}}",
    ]) {
      expect(template, slot).toContain(slot);
    }
    // The hard boundaries are NOT a slot: the CLI appends them, so an adopter
    // edit of this file cannot drop them from a rendered contract.
    expect(template).not.toContain("{{GOAL_BOUNDARIES}}");
  });

  it("is instantiated from a claimed item's checklist, not hand-written", () => {
    const dir = initTree();
    runCreate({ cwd: dir, type: "initiative", title: "Launch" });
    runCreate({ cwd: dir, type: "epic", title: "Platform", parent: "launch" });
    runCreate({ cwd: dir, type: "story", title: "Seam", parent: "platform", id: "story-seam" });
    const { id } = runCreate({
      cwd: dir,
      type: "task",
      title: "Goal template",
      parent: "story-seam",
      id: "goal-template",
    });
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "Arggon" });
    const { contract, goal } = runGoal({ cwd: dir, id, login: "Arggon" });
    expect(goal.objective.length).toBeGreaterThan(0);
    expect(goal.template).toBe("adopter");
    expect(contract).toContain("## Boundaries (hard)");
    expect(contract).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

describe("zcode gate script (reviewer backstop + global git gates)", () => {
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
        tool_input: { subagent_type: "arggon:arggon-worker" },
      },
    ]) {
      const r = gate(dir, "pre", payload);
      expect(r.status, JSON.stringify(payload)).toBe(0);
    }
  });

  it("marks a reviewer dispatch and denies mutations until it returns", () => {
    const dir = initTree();
    const session = "coord-1";
    // Dispatch begins: the gate marks the session.
    expect(
      gate(dir, "pre", {
        session_id: session,
        tool_name: "Agent",
        tool_input: { subagent_type: "arggon:arggon-reviewer" },
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
    // the old leading-character class let `sh -c "arggon update x"` through).
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
        tool_input: { subagent_type: "arggon:arggon-reviewer" },
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
      tool_input: { subagent_type: "arggon-reviewer" },
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
        tool_input: { subagent_type: "arggon:arggon-reviewer" },
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
