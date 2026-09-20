import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { findOpenCodeConfig, generatedYamlMarker, stampGeneratedContent } from "./docs.js";
import { runInit } from "./init.js";
import { readConventionConfig } from "@arggon/lib";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterAll(() => {
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

function runCli(args: string[], cwd: string = repoRoot) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "arggon-opencode-seam-"));
}

/** Files the OpenCode seam must create on a fresh init (opencode-seam-010). */
const SEAM_AGENTS = [
  ".opencode/agents/arggon-coordinator.md",
  ".opencode/agents/arggon-worker.md",
  ".opencode/agents/arggon-reviewer.md",
];
const SEAM_COMMANDS = [
  ".opencode/commands/arggon-next.md",
  ".opencode/commands/arggon-start.md",
  ".opencode/commands/arggon-done.md",
  ".opencode/commands/arggon-handoff.md",
  ".opencode/commands/arggon-review.md",
  ".opencode/commands/arggon-status.md",
  ".opencode/commands/arggon-adopt.md",
];

/** Bundled OpenCode V2 plugin destination (plan-opencode2-009 W2). */
const SEAM_PLUGIN = ".opencode/plugins/arggon/index.ts";
/** W3 single-file bundle vendored by init (kernel inlined, no node_modules). */
const SEAM_PLUGIN_SOURCE = "opencode/plugins/arggon/index.bundle.ts";

describe("opencode seam: fresh init", () => {
  it("creates the config, agents and commands (tier-1, plain init)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    expect(existsSync(join(dir, "opencode.jsonc"))).toBe(true);
    for (const rel of [...SEAM_AGENTS, ...SEAM_COMMANDS, SEAM_PLUGIN]) {
      expect(existsSync(join(dir, ...rel.split("/"))), rel).toBe(true);
    }
  });

  it("opencode.jsonc is valid JSONC (comments only), formatter/compaction and NO MCP stanza (W3)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const raw = readFileSync(join(dir, "opencode.jsonc"), "utf8");
    expect(raw.startsWith("<!-- arggon:generated")).toBe(false);
    expect(raw).not.toContain("arggon:generated");
    const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
    const parsed = JSON.parse(stripped) as {
      mcp?: unknown;
      formatter?: unknown;
      compaction?: { keep?: { tokens?: number } };
    };
    // W3 seam without MCP: the native tools/plugin are the default path; the
    // optional stdio server can be registered by the adopter.
    expect(parsed.mcp).toBeUndefined();
    expect(raw).not.toContain('"arggon", "mcp"');
    expect(parsed.formatter).toBe(true);
    expect(parsed.compaction?.keep?.tokens).toBe(15000);
  });

  it("agents and commands are frontmatter-first with the YAML provenance marker", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const worker = readFileSync(join(dir, ".opencode/agents/arggon-worker.md"), "utf8");
    expect(
      worker.startsWith('---\n# arggon:generated template="opencode/agents/arggon-worker.md"\n'),
    ).toBe(true);
    expect(worker).not.toContain("<!-- arggon:generated");
    expect(worker).toContain("mode: subagent");
    const review = readFileSync(join(dir, ".opencode/commands/arggon-review.md"), "utf8");
    expect(
      review.startsWith('---\n# arggon:generated template="opencode/commands/arggon-review.md"\n'),
    ).toBe(true);
    expect(review).toContain("agent: arggon-reviewer");
    expect(review).toContain("subagent: true");
  });

  it("agents deny nested subagents and the reviewer denies edits (W4 probes)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const worker = readFileSync(join(dir, ".opencode/agents/arggon-worker.md"), "utf8");
    const reviewer = readFileSync(join(dir, ".opencode/agents/arggon-reviewer.md"), "utf8");
    // One nesting level: workers and reviewers never launch subagents.
    expect(worker).toMatch(/action: subagent\s+resource: "\*"\s+effect: deny/);
    expect(reviewer).toMatch(/action: subagent\s+resource: "\*"\s+effect: deny/);
    expect(reviewer).toMatch(/action: edit\s+resource: "\*"\s+effect: deny/);
  });

  it("agents deny tracker mutations at the tool level, native and MCP spellings (W4 probe)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const worker = readFileSync(join(dir, ".opencode/agents/arggon-worker.md"), "utf8");
    const reviewer = readFileSync(join(dir, ".opencode/agents/arggon-reviewer.md"), "utf8");
    // Probe-verified on real V2 sessions: a native tool action is the
    // normalized `<namespace>_<tool>` (namespace `arggon`), an MCP tool action
    // the normalized `<server>_<tool>` (server `arggon`, tools `arggon_*`).
    for (const action of [
      "arggon_create",
      "arggon_arggon_create",
    ]) {
      expect(worker, action).toMatch(
        new RegExp(`action: ${action}\\s+resource: "\\*"\\s+effect: deny`),
      );
    }
    for (const action of [
      "arggon_create",
      "arggon_update",
      "arggon_handoff",
      "arggon_start",
      "arggon_branch",
      "arggon_cleanup",
      "arggon_priority",
      "arggon_sync",
      "arggon_import_issues",
      "arggon_arggon_create",
      "arggon_arggon_update",
      "arggon_arggon_handoff",
    ]) {
      expect(reviewer, action).toMatch(
        new RegExp(`action: ${action}\\s+resource: "\\*"\\s+effect: deny`),
      );
    }
    // arggon_comment is the reviewer's one tracker write: never denied.
    expect(reviewer).not.toMatch(/action: arggon_comment|action: arggon_arggon_comment/);
    expect(worker).not.toMatch(
      /action: arggon_comment|action: arggon_update|action: arggon_handoff|action: arggon_arggon_comment|action: arggon_arggon_update|action: arggon_arggon_handoff/,
    );
    // W4 review: the reviewer cannot run the worktree lifecycle either.
    expect(reviewer).not.toMatch(/action: arggon_comment|action: arggon_arggon_comment/);
  });

  it("the reviewer never mutates history: minimal shell gates (W4)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const reviewer = readFileSync(join(dir, ".opencode/agents/arggon-reviewer.md"), "utf8");
    for (const resource of ["git commit*", "git push*", "git merge*", "git rebase*"]) {
      expect(reviewer, resource).toMatch(
        new RegExp(`action: shell\\s+resource: "${resource.replace("*", "\\*")}"\\s+effect: deny`),
      );
    }
    // Read-only inspection stays allowed: only the mutating git verbs are gated.
    expect(reviewer).not.toMatch(/resource: "git (status|diff|log|show)/);
  });

  it("the coordinator subagent allow-list stays explicit (W4 default)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const coordinator = readFileSync(join(dir, ".opencode/agents/arggon-coordinator.md"), "utf8");
    expect(coordinator).toMatch(/action: subagent\s+resource: "\*"\s+effect: deny/);
    for (const agent of ["arggon-worker", "arggon-reviewer", "explore"]) {
      expect(coordinator, agent).toMatch(
        new RegExp(`action: subagent\\s+resource: ${agent}\\s+effect: allow`),
      );
    }
  });

  it("the generated seam carries the minimal shell gates without breaking ordinary sessions (W4)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const raw = readFileSync(join(dir, "opencode.jsonc"), "utf8");
    const parsed = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "")) as {
      permissions?: Array<{ action?: string; resource?: string; effect?: string }>;
    };
    expect(parsed.permissions).toEqual([
      { action: "shell", resource: "git commit --no-verify*", effect: "deny" },
      { action: "shell", resource: "git push --force*", effect: "deny" },
      { action: "shell", resource: "git push -f*", effect: "deny" },
    ]);
    // Non-breaking by construction: the base policy stays allow-all — a global
    // `ask`/deny-all would block ordinary and headless sessions.
    for (const rule of parsed.permissions ?? []) {
      expect(rule.resource, JSON.stringify(rule)).not.toBe("*");
      expect(rule.effect).toBe("deny");
    }
  });

  it("records x-generated provenance for every seam file", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const config = readConventionConfig(dir);
    expect(config.generated["opencode.jsonc"]?.template).toBe("docs/opencode.jsonc");
    expect(config.generated[".opencode/agents/arggon-coordinator.md"]?.template).toBe(
      "docs/opencode/agents/arggon-coordinator.md",
    );
    expect(config.generated[".opencode/commands/arggon-next.md"]?.template).toBe(
      "docs/opencode/commands/arggon-next.md",
    );
  });
});

describe("opencode seam: conditional config", () => {
  // All four shapes V2 discovers: any non-arggon config at any of them wins
  // (MAJOR-1 + MINOR-3, PR #322 review).
  const ADOPTER_SHAPES = [
    "opencode.json",
    "opencode.jsonc",
    ".opencode/opencode.json",
    ".opencode/opencode.jsonc",
  ];

  for (const shape of ADOPTER_SHAPES) {
    it(`does not write opencode.jsonc when the adopter has ${shape}`, () => {
      const dir = tempDir();
      mkdirSync(dirname(join(dir, shape)), { recursive: true });
      const adopterBytes = `{ "adopter": "${shape}" }\n`;
      writeFileSync(join(dir, ...shape.split("/")), adopterBytes, "utf8");
      const proc = runCli(["init", dir, "--json"]);
      expect(proc.status).toBe(0);
      const body = JSON.parse(proc.stdout) as {
        created: string[];
        updated: string[];
        skipped: string[];
      };
      expect(body.created).not.toContain("opencode.jsonc");
      expect(body.updated).not.toContain("opencode.jsonc");
      expect(body.skipped).toContain("opencode.jsonc");
      // The adopter's config keeps its exact bytes, wherever it lives.
      expect(readFileSync(join(dir, ...shape.split("/")), "utf8")).toBe(adopterBytes);
      if (shape !== "opencode.jsonc") {
        expect(existsSync(join(dir, "opencode.jsonc"))).toBe(false);
      }
      // The rest of the seam is still generated.
      expect(body.created).toContain(".opencode/agents/arggon-worker.md");
      expect(readConventionConfig(dir).generated["opencode.jsonc"]).toBeUndefined();
    });
  }

  // MAJOR-1 regression (PR #322 review): an adopter `.opencode/` config added
  // AFTER init used to be shadowed by our own root `opencode.jsonc`
  // (findOpenCodeConfig returned the first existing candidate), so generation
  // continued and the adopter config was ignored. It must present-skip and
  // leave every byte untouched.
  for (const shape of [".opencode/opencode.json", ".opencode/opencode.jsonc"]) {
    it(`present-skips ${shape} added after init while our root opencode.jsonc exists`, () => {
      const dir = tempDir();
      runInit({ dir, force: false });
      const ours = readFileSync(join(dir, "opencode.jsonc"), "utf8");
      expect(ours).toContain("generated by `arggon init`");
      mkdirSync(join(dir, ".opencode"), { recursive: true });
      const adopterBytes = `{ "adopter": "${shape}" }\n`;
      writeFileSync(join(dir, ...shape.split("/")), adopterBytes, "utf8");
      const proc = runCli(["init", dir, "--json"]);
      expect(proc.status).toBe(0);
      const body = JSON.parse(proc.stdout) as { updated: string[]; skipped: string[] };
      expect(body.updated).not.toContain("opencode.jsonc");
      expect(body.skipped).toContain("opencode.jsonc");
      expect(readFileSync(join(dir, "opencode.jsonc"), "utf8")).toBe(ours);
      expect(readFileSync(join(dir, ...shape.split("/")), "utf8")).toBe(adopterBytes);
    });
  }

  it("present-skips our generated config once the signature is removed (bytes untouched)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const generated = readFileSync(join(dir, "opencode.jsonc"), "utf8");
    const rewritten = generated.replace(
      "generated by `arggon init`",
      "hand-written by the adopter",
    );
    expect(rewritten).not.toBe(generated);
    writeFileSync(join(dir, "opencode.jsonc"), rewritten, "utf8");
    const proc = runCli(["init", dir, "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      updated: string[];
      modified: string[];
      skipped: string[];
    };
    expect(body.skipped).toContain("opencode.jsonc");
    expect(body.updated).not.toContain("opencode.jsonc");
    expect(body.modified).not.toContain("opencode.jsonc");
    expect(readFileSync(join(dir, "opencode.jsonc"), "utf8")).toBe(rewritten);
  });

  it("does not claim an adopter config that merely mentions the signature (NIT-12)", () => {
    const dir = tempDir();
    // The phrase sits in a string value, NOT on the leading comment line. The
    // old substring-anywhere check claimed this file as arggon's, so
    // findOpenCodeConfig returned null and the destination degraded to
    // `modified-skip` instead of the adopter-present `present-skip`.
    const adopterBytes = [
      "{",
      "  // hand-written adopter config",
      '  "note": "not generated by `arggon init`",',
      '  "formatter": false',
      "}",
      "",
    ].join("\n");
    writeFileSync(join(dir, "opencode.jsonc"), adopterBytes, "utf8");
    const dry = runCli(["init", dir, "--dry-run", "--json"]);
    expect(dry.status).toBe(0);
    const body = JSON.parse(dry.stdout) as {
      plan: Array<{ dest: string; decision: string }>;
      skipped: string[];
    };
    expect(body.plan.find((e) => e.dest === "opencode.jsonc")?.decision).toBe("present-skip");
    expect(body.skipped).toContain("opencode.jsonc");
    // A real run leaves the adopter's bytes untouched.
    const real = runCli(["init", dir, "--json"]);
    expect(real.status).toBe(0);
    expect(readFileSync(join(dir, "opencode.jsonc"), "utf8")).toBe(adopterBytes);
  });

  it("generates opencode.jsonc again when the adopter config disappears", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "opencode.json"), "{}\n", "utf8");
    runCli(["init", dir, "--json"]);
    rmSync(join(dir, "opencode.json"));
    const proc = runCli(["init", dir, "--json"]);
    expect(proc.status).toBe(0);
    expect(existsSync(join(dir, "opencode.jsonc"))).toBe(true);
  });

  it("findOpenCodeConfig detects root and .opencode shapes in order", () => {
    const dir = tempDir();
    expect(findOpenCodeConfig(dir)).toBeNull();
    mkdirSync(join(dir, ".opencode"), { recursive: true });
    writeFileSync(join(dir, ".opencode/opencode.json"), "{}\n", "utf8");
    expect(findOpenCodeConfig(dir)).toBe(".opencode/opencode.json");
    writeFileSync(join(dir, "opencode.jsonc"), "{}\n", "utf8");
    expect(findOpenCodeConfig(dir)).toBe("opencode.jsonc");
  });
});

describe("opencode seam: provenance on re-runs", () => {
  it("re-runs refresh untouched seam files and skip adopter-modified ones", () => {
    const dir = tempDir();
    runCli(["init", dir, "--json"]);
    const agentPath = join(dir, ".opencode/agents/arggon-worker.md");
    const original = readFileSync(agentPath, "utf8");
    // Untouched: a second run reports it as updated (regenerated silently).
    const second = runCli(["init", dir, "--json"]);
    const secondBody = JSON.parse(second.stdout) as { updated: string[]; modified: string[] };
    expect(secondBody.updated).toContain(".opencode/agents/arggon-worker.md");
    expect(secondBody.modified).toEqual([]);
    // Adopter-modified: kept as-is and reported.
    writeFileSync(agentPath, `${original}\n<!-- mine -->\n`, "utf8");
    const third = runCli(["init", dir, "--json"]);
    const thirdBody = JSON.parse(third.stdout) as { modified: string[]; skipped: string[] };
    expect(thirdBody.modified).toContain(".opencode/agents/arggon-worker.md");
    expect(thirdBody.skipped).toContain(".opencode/agents/arggon-worker.md");
    expect(readFileSync(agentPath, "utf8")).toBe(`${original}\n<!-- mine -->\n`);
  });

  it("--backup round-trips a modified seam file (archive + regenerate)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const rel = ".opencode/agents/arggon-worker.md";
    const dest = join(dir, ...rel.split("/"));
    const original = readFileSync(dest, "utf8");
    const edited = `${original}\nADOPTER EDIT\n`;
    writeFileSync(dest, edited, "utf8");
    const proc = runCli(["init", dir, "--backup", "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      updated: string[];
      modified: string[];
      backedUp: string[];
      skipped: string[];
    };
    expect(body.modified).toContain(rel);
    expect(body.backedUp).toContain(rel);
    expect(body.updated).not.toContain(rel);
    expect(body.skipped).not.toContain(rel);
    // The adopter's bytes survive in the dated archive...
    const date = new Date().toISOString().slice(0, 10);
    expect(readFileSync(join(dir, "backup", date, ...rel.split("/")), "utf8")).toBe(edited);
    // ...and the destination is regenerated from the template.
    expect(readFileSync(dest, "utf8")).toBe(original);
  });
});

describe("opencode seam: bundled plugin (W2/W3)", () => {
  it("vendors the single-file dependency-free bundle with provenance (W3)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const raw = readFileSync(join(dir, ...SEAM_PLUGIN.split("/")), "utf8");
    expect(raw.startsWith(`// arggon:generated template="${SEAM_PLUGIN_SOURCE}"\n`)).toBe(true);
    expect(raw).toContain('id: "arggon"');
    // W3: @arggon/lib is inlined (no npm dependency), the optional
    // @opencode/plugin sugar and the MCP auto-registration are gone.
    expect(raw).toContain('__arggonModules.set("lib/src/index.ts"');
    expect(raw).not.toContain("@opencode/plugin");
    expect(raw).not.toContain('"arggon", "mcp"');
    const config = readConventionConfig(dir);
    expect(config.generated[SEAM_PLUGIN]?.template).toBe(SEAM_PLUGIN_SOURCE);
  });

  it("stays in byte parity with its single source (modulo the generated marker)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const source = readFileSync(join(repoRoot, SEAM_PLUGIN_SOURCE), "utf8");
    const expected = stampGeneratedContent(SEAM_PLUGIN, SEAM_PLUGIN_SOURCE, source);
    expect(readFileSync(join(dir, ...SEAM_PLUGIN.split("/")), "utf8")).toBe(expected);
  });

  it("re-runs refresh the untouched plugin and skip the adopter-modified one", () => {
    const dir = tempDir();
    runCli(["init", dir, "--json"]);
    const dest = join(dir, ...SEAM_PLUGIN.split("/"));
    const original = readFileSync(dest, "utf8");
    const second = runCli(["init", dir, "--json"]);
    const secondBody = JSON.parse(second.stdout) as { updated: string[]; modified: string[] };
    expect(secondBody.updated).toContain(SEAM_PLUGIN);
    expect(secondBody.modified).toEqual([]);
    writeFileSync(dest, `${original}\n// adopter edit\n`, "utf8");
    const third = runCli(["init", dir, "--json"]);
    const thirdBody = JSON.parse(third.stdout) as { modified: string[]; skipped: string[] };
    expect(thirdBody.modified).toContain(SEAM_PLUGIN);
    expect(thirdBody.skipped).toContain(SEAM_PLUGIN);
    expect(readFileSync(dest, "utf8")).toBe(`${original}\n// adopter edit\n`);
  });

  it("--backup archives and regenerates a modified plugin", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const dest = join(dir, ...SEAM_PLUGIN.split("/"));
    const original = readFileSync(dest, "utf8");
    const edited = `${original}\nADOPTER EDIT\n`;
    writeFileSync(dest, edited, "utf8");
    const proc = runCli(["init", dir, "--backup", "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      updated: string[];
      modified: string[];
      backedUp: string[];
    };
    expect(body.modified).toContain(SEAM_PLUGIN);
    expect(body.backedUp).toContain(SEAM_PLUGIN);
    expect(body.updated).not.toContain(SEAM_PLUGIN);
    const date = new Date().toISOString().slice(0, 10);
    expect(readFileSync(join(dir, "backup", date, ...SEAM_PLUGIN.split("/")), "utf8")).toBe(edited);
    expect(readFileSync(dest, "utf8")).toBe(original);
  });
});

describe("opencode seam: marker stamping", () => {
  it("takes the YAML frontmatter marker from the named helper (NIT-11)", () => {
    const marker = generatedYamlMarker("opencode/agents/example.md");
    expect(marker).toBe('# arggon:generated template="opencode/agents/example.md"');
    const out = stampGeneratedContent(
      ".opencode/agents/example.md",
      "opencode/agents/example.md",
      "---\nmode: subagent\n---\nbody\n",
    );
    expect(out.startsWith(`---\n${marker}\n`)).toBe(true);
  });

  it("stamps a TypeScript destination with a // provenance marker (W2 plugin)", () => {
    const out = stampGeneratedContent(SEAM_PLUGIN, SEAM_PLUGIN_SOURCE, "export default {}\n");
    expect(out).toBe(`// arggon:generated template="${SEAM_PLUGIN_SOURCE}"\nexport default {}\n`);
  });

  it("stamps a CRLF frontmatter template frontmatter-first (NIT-9)", () => {
    const out = stampGeneratedContent(
      ".opencode/agents/example.md",
      "opencode/agents/example.md",
      "---\r\nmode: subagent\r\n---\r\nbody\r\n",
    );
    expect(
      out.startsWith(
        '---\r\n# arggon:generated template="opencode/agents/example.md"\r\nmode: subagent\r\n',
      ),
    ).toBe(true);
  });
});

describe("opencode seam: methodology commands and skill references (W5)", () => {
  /** Methodology prompt templates (plan-opencode2-009 T14; adopt W3). */
  const METHODOLOGY_COMMANDS = [
    ".opencode/commands/arggon-adr.md",
    ".opencode/commands/arggon-explore.md",
    ".opencode/commands/arggon-playbook.md",
    ".opencode/commands/arggon-spec.md",
    ".opencode/commands/arggon-adopt.md",
  ];
  /** Bundled arggon-cli skill references (progressive disclosure). */
  const SKILL_REFERENCES = [
    ".agents/skills/arggon-cli/references/json-contract.md",
    ".agents/skills/arggon-cli/references/methodology.md",
    ".agents/skills/arggon-cli/references/orchestration.md",
    ".agents/skills/arggon-cli/references/pitfalls.md",
  ];
  /** Bundled source -> destination, for the parity assertions. */
  function sourceOf(dest: string): string {
    return dest.replace(".agents/skills/", "skills/");
  }
  function markerOf(rel: string): string {
    // Docs templates are stamped with their templates/docs-relative id.
    return rel.startsWith(".opencode/")
      ? rel.replace(".opencode/", "opencode/")
      : rel.replace(".agents/skills/", "skills/");
  }

  it("creates the four methodology commands frontmatter-first, with provenance and no shell blocks", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const config = readConventionConfig(dir);
    for (const rel of METHODOLOGY_COMMANDS) {
      const raw = readFileSync(join(dir, ...rel.split("/")), "utf8");
      expect(raw.startsWith(`---\n# arggon:generated template="${markerOf(rel)}"\n`), rel).toBe(
        true,
      );
      // Prompt templates only: no shell-substitution blocks with argument
      // placeholders — the agent runs the CLI through its shell tool under
      // permissions.
      expect(raw, rel).not.toMatch(/!`/);
      expect(raw, rel).toContain("$ARGUMENTS");
      expect(config.generated[rel]?.template, rel).toBe(`docs/${markerOf(rel)}`);
    }
  });

  it("drives the native arggon tools, never the headless adapter (W3)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const read = (rel: string): string => readFileSync(join(dir, ...rel.split("/")), "utf8");
    const commands = readdirSync(join(dir, ".opencode/commands"));
    expect(commands.length).toBeGreaterThanOrEqual(11);
    for (const name of commands) {
      const body = read(`.opencode/commands/${name}`);
      expect(body, name).toContain("$ARGUMENTS");
      // Prompt templates only: no V2 shell blocks.
      expect(body, name).not.toMatch(/!`/);
      // No CLI-driving prose in the default path: `arggon <subcommand>`
      // invocations belong to the headless adapter (bootstrap/CI), not here.
      expect(body, name).not.toMatch(
        /(^|[^.\w-])arggon (next|start|done|handoff|review|status|spec|adr|explore|playbook|adopt|stack|branch|create|update|validate|show|list|mcp)\b/,
      );
    }
    expect(read(".opencode/commands/arggon-done.md")).toContain("tools.arggon.update");
    expect(read(".opencode/commands/arggon-spec.md")).toContain("tools.arggon.validate");
    expect(read(".opencode/commands/arggon-explore.md")).toContain("tools.arggon.create");
    expect(read(".opencode/commands/arggon-playbook.md")).toContain("tools.arggon.create");
    expect(read(".opencode/commands/arggon-adopt.md")).toContain("tools.arggon.create");
    expect(read(".opencode/commands/arggon-adr.md")).toContain("docs/engineering.md");
  });

  it("every generated command carries valid V2 frontmatter (description; agent/subagent where they apply)", () => {
    // The smoke harness runs command BODIES as prompts (it cannot exercise the
    // V2 command loader headless); this test closes the frontmatter flank:
    // schema-valid fields, the W3 agent placements and subagent mode.
    const dir = tempDir();
    runInit({ dir, force: false });
    const frontmatter = (rel: string): Record<string, string> => {
      const raw = readFileSync(join(dir, ...rel.split("/")), "utf8");
      const match = /^---\n([\s\S]*?)\n---\n/.exec(raw);
      expect(match, rel).not.toBeNull();
      const fields: Record<string, string> = {};
      for (const line of match![1].split("\n")) {
        const kv = /^([a-z_]+):\s*(.+)$/.exec(line);
        if (kv !== null) fields[kv[1]] = kv[2];
      }
      return fields;
    };
    for (const name of readdirSync(join(dir, ".opencode/commands")).sort()) {
      const rel = `.opencode/commands/${name}`;
      const fields = frontmatter(rel);
      expect(fields.description, rel).toBeTruthy();
      if (fields.agent !== undefined) {
        expect(["arggon-coordinator", "arggon-reviewer"], rel).toContain(fields.agent);
      }
      if (fields.subagent !== undefined) expect(fields.subagent, rel).toBe("true");
    }
    expect(frontmatter(".opencode/commands/arggon-done.md").agent).toBe("arggon-coordinator");
    expect(frontmatter(".opencode/commands/arggon-adopt.md").agent).toBe("arggon-coordinator");
    expect(frontmatter(".opencode/commands/arggon-review.md").agent).toBe("arggon-reviewer");
    expect(frontmatter(".opencode/commands/arggon-review.md").subagent).toBe("true");
  });

  it("creates the skill references with provenance and byte parity against their sources", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const config = readConventionConfig(dir);
    for (const rel of SKILL_REFERENCES) {
      const source = sourceOf(rel);
      const sourceBytes = readFileSync(join(repoRoot, ...source.split("/")), "utf8");
      expect(readFileSync(join(dir, ...rel.split("/")), "utf8"), rel).toBe(
        stampGeneratedContent(rel, source, sourceBytes),
      );
      expect(config.generated[rel]?.template, rel).toBe(source);
    }
    // The umbrella points at every reference (V2 advertises the paths; the
    // model reads them on demand).
    const umbrella = readFileSync(join(dir, ".agents/skills/arggon-cli/SKILL.md"), "utf8");
    for (const rel of SKILL_REFERENCES) {
      expect(umbrella, rel).toContain(rel.split("/").slice(-2).join("/"));
    }
  });

  it("re-runs refresh untouched references and skip adopter-modified ones (--backup round-trip)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const rel = ".agents/skills/arggon-cli/references/methodology.md";
    const dest = join(dir, ...rel.split("/"));
    const original = readFileSync(dest, "utf8");
    const second = runCli(["init", dir, "--json"]);
    const secondBody = JSON.parse(second.stdout) as { updated: string[]; modified: string[] };
    expect(secondBody.updated).toContain(rel);
    expect(secondBody.modified).toEqual([]);
    const edited = `${original}\nADOPTER EDIT\n`;
    writeFileSync(dest, edited, "utf8");
    const third = runCli(["init", dir, "--json"]);
    const thirdBody = JSON.parse(third.stdout) as { modified: string[]; skipped: string[] };
    expect(thirdBody.modified).toContain(rel);
    expect(thirdBody.skipped).toContain(rel);
    expect(readFileSync(dest, "utf8")).toBe(edited);
    const fourth = runCli(["init", dir, "--backup", "--json"]);
    expect(fourth.status).toBe(0);
    const fourthBody = JSON.parse(fourth.stdout) as { updated: string[]; backedUp: string[] };
    expect(fourthBody.backedUp).toContain(rel);
    expect(fourthBody.updated).not.toContain(rel);
    const date = new Date().toISOString().slice(0, 10);
    expect(readFileSync(join(dir, "backup", date, ...rel.split("/")), "utf8")).toBe(edited);
    expect(readFileSync(dest, "utf8")).toBe(original);
  });
});
