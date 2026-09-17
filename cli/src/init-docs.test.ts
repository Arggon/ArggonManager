import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  arggonVersion,
  checksumOf,
  GENERATED_DOC_COUNT,
  generateDocs,
  generatedMarker,
  renderDocPlaceholders,
} from "./docs.js";
import {
  parseConventionConfig,
  readConventionConfig,
  updateGeneratedSection,
  type GeneratedEntry,
} from "./convention.js";
import { runInit } from "./init.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
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
  return mkdtempSync(join(tmpdir(), "arggon-init-docs-"));
}

describe("init docs: placeholders", () => {
  it("renders {{PROJECT_NAME}} and {{YEAR}} at write time", () => {
    expect(renderDocPlaceholders("# {{PROJECT_NAME}} ({{YEAR}})", { projectName: "acme", year: 2031 })).toBe(
      "# acme (2031)",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(
      renderDocPlaceholders("hi {{PROJECT_NAME}} and {{UNKNOWN_TOKEN}}", { projectName: "acme", year: 2026 }),
    ).toBe("hi acme and {{UNKNOWN_TOKEN}}");
  });

  it("derives the project name from the target root dir name", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain(`working on **${basename(dir)}**`);
    expect(agents).not.toContain("{{PROJECT_NAME}}");
    expect(agents).not.toContain("{{YEAR}}");
  });
});

describe("init docs: generated-docs context budget (task-adr0006-docs-budget)", () => {
  it("generated AGENTS.md stays within the 2 KB context budget", () => {
    // ADR 0006: the generated AGENTS.md is a fixed per-session read; its byte
    // size is budgeted (<=2048 incl. the generated marker) so it cannot
    // regress silently. Pointers over inline rules keep it small.
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(Buffer.byteLength(agents, "utf8")).toBeLessThanOrEqual(2048);
  });
});

describe("init docs: tier-1 content", () => {
  const dir = tempDir();
  runInit({ dir, force: false });

  it("AGENTS.md contains the arggon workflow loop lines", () => {
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain("arggon list --status todo --json");
    expect(agents).toContain("arggon update <id> --status in_progress --assignee <your-login>");
    expect(agents).toContain("arggon branch <id>");
    expect(agents).toContain("arggon create task|bug");
    expect(agents).toContain("Never reopen");
    expect(agents).toContain("docs/convention.md");
    expect(agents).toContain("docs/engineering.md");
    expect(agents).toContain("docs/playbooks/");
    expect(agents).toContain("arggon playbook status");
    expect(agents).toContain("arggon validate");
    expect(agents).toMatch(/arggon comment <item-id>[^\n]*never as GitHub PR comments/);
  });

  it("CLAUDE.md is the @AGENTS.md shim under the provenance marker", () => {
    expect(readFileSync(join(dir, "CLAUDE.md"), "utf8")).toBe(
      `${generatedMarker("CLAUDE.md")}\n@AGENTS.md\n`,
    );
  });

  it("copilot instructions point at AGENTS.md", () => {
    const copilot = readFileSync(join(dir, ".github/copilot-instructions.md"), "utf8");
    expect(copilot).toContain("Read [AGENTS.md](../../AGENTS.md) first and follow it");
  });

  it("SECURITY.md has supported-versions and reporting sections", () => {
    const security = readFileSync(join(dir, "SECURITY.md"), "utf8");
    expect(security).toContain("## Supported versions");
    expect(security).toContain("## Reporting a vulnerability");
  });

  it("CONTRIBUTING.md documents branches, commits, and PR rules", () => {
    const contributing = readFileSync(join(dir, "CONTRIBUTING.md"), "utf8");
    expect(contributing).toContain("arggon branch <id>");
    expect(contributing).toContain("feat/<id>");
    expect(contributing).toContain("### PR checklist");
    expect(contributing).toContain("work item id");
  });

  it("docs/tracking.md replaces GitHub issue templates", () => {
    const tracking = readFileSync(join(dir, "docs/tracking.md"), "utf8");
    expect(tracking).toContain("tasks/");
    expect(tracking).toContain("PRs only");
    expect(existsSync(join(dir, ".github/ISSUE_TEMPLATE"))).toBe(false);
  });

  it("does not generate any tier-2 file", () => {
    expect(existsSync(join(dir, "ARCHITECTURE.md"))).toBe(false);
    expect(existsSync(join(dir, "docs/convention.md"))).toBe(false);
    expect(existsSync(join(dir, "docs/engineering.md"))).toBe(false);
    expect(existsSync(join(dir, "CHANGELOG.md"))).toBe(false);
    expect(existsSync(join(dir, "SUPPORT.md"))).toBe(false);
    expect(existsSync(join(dir, "docs/runbooks/README.md"))).toBe(false);
    expect(existsSync(join(dir, "docs/deploy.md"))).toBe(false);
  });
});

describe("init docs: tier-2 content (--full)", () => {
  const dir = tempDir();
  runInit({ dir, force: false, full: true });

  it("ARCHITECTURE.md is a matklad-style skeleton", () => {
    const arch = readFileSync(join(dir, "ARCHITECTURE.md"), "utf8");
    expect(arch).toContain("## Problem");
    expect(arch).toContain("## Code map");
    expect(arch).toContain("## Boundaries");
  });

  it("docs/convention.md and docs/engineering.md are adopter-owned templates, not ArggonManager's", () => {
    const convention = readFileSync(join(dir, "docs/convention.md"), "utf8");
    expect(convention).toContain("# Convention");
    expect(convention).not.toContain("ArggonManager stores work");
    expect(convention).toContain("frontmatter");
    const engineering = readFileSync(join(dir, "docs/engineering.md"), "utf8");
    expect(engineering).toContain("## Review bar");
    expect(engineering).toContain("## Definition of done");
    // Adopter-owned: the generated docs must not leak this repo's own doc text.
    expect(engineering).not.toContain("auto-done workflow");
  });

  it("CHANGELOG.md follows Keep a Changelog", () => {
    const changelog = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
    expect(changelog).toContain("## [Unreleased]");
    expect(changelog).toContain("Keep a Changelog");
  });

  it("SUPPORT.md and docs/runbooks/README.md exist", () => {
    expect(readFileSync(join(dir, "SUPPORT.md"), "utf8")).toContain("# Support");
    expect(readFileSync(join(dir, "docs/runbooks/README.md"), "utf8")).toContain("# Runbooks");
  });
});

describe("init docs: no-overwrite guarantee", () => {
  it("pre-existing docs keep their exact content and land in skipped[] + modified[]", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "AGENTS.md"), "MY OWN RULES v1", "utf8");
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/engineering.md"), "MY REVIEW BAR", "utf8");
    const result = runInit({ dir, force: false, full: true });
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe("MY OWN RULES v1");
    expect(readFileSync(join(dir, "docs/engineering.md"), "utf8")).toBe("MY REVIEW BAR");
    expect(result.created).not.toContain("AGENTS.md");
    expect(result.created).not.toContain("docs/engineering.md");
    expect(result.skipped).toContain("AGENTS.md");
    expect(result.skipped).toContain("docs/engineering.md");
    // No provenance state existed for these files: they count as adopter-modified.
    expect(result.modified).toContain("AGENTS.md");
    expect(result.modified).toContain("docs/engineering.md");
  });

  it("generateDocs creates on the first run and treats stateless files as modified on the second", () => {
    const dir = tempDir();
    const first = generateDocs({ root: dir, full: true });
    expect(first.created.length).toBe(GENERATED_DOC_COUNT); // generated docs (incl. .mcp.json) + bundled arggon-cli skill
    expect(first.created).toContain(".agents/skills/arggon-cli/SKILL.md");
    expect(first.skipped).toEqual([]);
    expect(first.updated).toEqual([]);
    expect(first.modified).toEqual([]);
    const second = generateDocs({ root: dir, full: true });
    expect(second.created).toEqual([]);
    // No tasks/.convention.yml exists (bare generateDocs, no init): with no
    // provenance state every on-disk file counts as adopter-modified and is
    // skipped (never overwritten).
    expect(second.updated).toEqual([]);
    expect(second.modified.length).toBe(GENERATED_DOC_COUNT);
    expect(second.skipped.length).toBe(GENERATED_DOC_COUNT);
  });
});

describe("init docs: --json payload", () => {
  it("fresh init lists created docs and empty skipped/modified", () => {
    const dir = tempDir();
    const proc = runCli(["init", dir, "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      command: string;
      created: string[];
      updated: string[];
      modified: string[];
      backedUp: string[];
      skipped: string[];
    };
    expect(body.ok).toBe(true);
    expect(body.command).toBe("init");
    expect(body.created).toContain("AGENTS.md");
    expect(body.created).toContain("docs/tracking.md");
    expect(body.skipped).toEqual([]);
    expect(body.updated).toEqual([]);
    expect(body.modified).toEqual([]);
    expect(body.backedUp).toEqual([]);
  });

  it("second init regenerates every untouched doc and reports it in updated[]", () => {
    const dir = tempDir();
    runCli(["init", dir, "--full", "--json"]);
    const proc = runCli(["init", dir, "--full", "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      created: string[];
      updated: string[];
      modified: string[];
      skipped: string[];
    };
    expect(body.created).toEqual([]);
    expect(body.updated).toContain("AGENTS.md");
    expect(body.updated).toContain("ARCHITECTURE.md");
    expect(body.updated).toContain(".agents/skills/arggon-cli/SKILL.md");
    expect(body.updated.length).toBe(GENERATED_DOC_COUNT);
    expect(body.modified).toEqual([]);
    expect(body.skipped).toEqual([]);
  });

  it("a later --full run adds only the tier-2 docs (tier-1 untouched docs update)", () => {
    const dir = tempDir();
    runCli(["init", dir, "--json"]);
    const proc = runCli(["init", dir, "--full", "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { created: string[]; updated: string[]; skipped: string[] };
    expect(body.created).toEqual(
      ["ARCHITECTURE.md", "CHANGELOG.md", "SUPPORT.md", "docs/convention.md", "docs/deploy.md", "docs/engineering.md", "docs/runbooks/README.md"].sort(),
    );
    expect(body.updated.length).toBe(11); // 10 tier-1 docs (incl. .mcp.json) + bundled skill
    expect(body.updated).toContain("AGENTS.md");
    expect(body.updated).toContain(".agents/skills/arggon-cli/SKILL.md");
    expect(body.skipped).toEqual([]);
  });

  it("--full creates the tier-2 files", () => {
    const dir = tempDir();
    const proc = runCli(["init", dir, "--full", "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { created: string[] };
    expect(body.created).toContain("ARCHITECTURE.md");
    expect(body.created).toContain("docs/convention.md");
    expect(body.created).toContain("docs/runbooks/README.md");
    expect(existsSync(join(dir, "docs/engineering.md"))).toBe(true);
  });
});

describe("init bundles the arggon-cli skill (task-init-skill-bundle)", () => {
  it("copies the skill from the single source into .agents/skills/", () => {
    const dir = tempDir();
    const result = runInit({ dir, force: false, full: true });
    const skillDest = join(dir, ".agents/skills/arggon-cli/SKILL.md");
    expect(result.created).toContain(".agents/skills/arggon-cli/SKILL.md");
    const skill = readFileSync(skillDest, "utf8");
    expect(skill).toContain("arggon-cli");
    expect(skill).toContain("Pitfalls");
  });

  it("regenerates the untouched skill on a second run (idempotent)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const second = runInit({ dir, force: false, full: true });
    expect(second.created).not.toContain(".agents/skills/arggon-cli/SKILL.md");
    expect(second.modified).not.toContain(".agents/skills/arggon-cli/SKILL.md");
    expect(second.updated).toContain(".agents/skills/arggon-cli/SKILL.md");
  });

  it("generated AGENTS.md mandates the arggon-cli skill by default", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain(".agents/skills/arggon-cli/SKILL.md");
    expect(agents).toMatch(/skill by default/i);
  });
});

describe("init generates .mcp.json (task-init-mcp-config)", () => {
  it("creates a valid tier-1 .mcp.json with the arggon MCP server and no HTML marker", () => {
    const dir = tempDir();
    const result = runInit({ dir, force: false });
    expect(result.created).toContain(".mcp.json");
    const raw = readFileSync(join(dir, ".mcp.json"), "utf8");
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, { command: string; args: string[] }> };
    expect(parsed.mcpServers.arggon).toEqual({ command: "arggon", args: ["mcp"] });
    // MCP clients parse the file as JSON: the arggon:generated HTML comment
    // must never be prepended (it would break their parsers).
    expect(raw).not.toContain("arggon:generated");
    // Tier-1: present even without --full.
    const full = tempDir();
    runInit({ dir: full, force: false, full: true });
    expect(JSON.parse(readFileSync(join(full, ".mcp.json"), "utf8")).mcpServers).toBeDefined();
  });

  it("records the x-generated entry and skips the untouched file on a second init", () => {
    const dir = tempDir();
    const first = runInit({ dir, force: false });
    expect(first.created).toContain(".mcp.json");
    const entry = readConventionConfig(dir).generated[".mcp.json"]!;
    expect(entry.template).toBe("docs/mcp-json");
    expect(entry.checksum).toBe(checksumOf(readFileSync(join(dir, ".mcp.json"), "utf8")));
    const second = runInit({ dir, force: false });
    expect(second.created).not.toContain(".mcp.json");
    expect(second.updated).toContain(".mcp.json");
    expect(second.skipped).not.toContain(".mcp.json");
  });

  it("never overwrites a pre-existing adopter .mcp.json (reported in skipped[] + modified[])", () => {
    const dir = tempDir();
    const theirs = JSON.stringify(
      { mcpServers: { other: { command: "other-server", args: ["serve"] } } },
      null,
      2,
    );
    writeFileSync(join(dir, ".mcp.json"), `${theirs}\n`, "utf8");
    const result = runInit({ dir, force: false });
    expect(readFileSync(join(dir, ".mcp.json"), "utf8")).toBe(`${theirs}\n`);
    expect(result.created).not.toContain(".mcp.json");
    expect(result.skipped).toContain(".mcp.json");
    expect(result.modified).toContain(".mcp.json");
    expect(readConventionConfig(dir).generated[".mcp.json"]).toBeUndefined();
  });

  it("generated AGENTS.md mentions the registered MCP server", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain(".mcp.json");
    expect(agents).toContain("MCP");
  });
});

describe("init docs: x-generated provenance (story-adoption-state)", () => {
  it("first init stamps markers and records the x-generated state (checksum matches file)", () => {
    const dir = tempDir();
    const result = runInit({ dir, force: false, full: true });
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents.startsWith(`${generatedMarker("AGENTS.md")}\n`)).toBe(true);
    const skill = readFileSync(join(dir, ".agents/skills/arggon-cli/SKILL.md"), "utf8");
    expect(skill.startsWith(`${generatedMarker("skills/arggon-cli/SKILL.md")}\n`)).toBe(true);

    const config = readConventionConfig(dir);
    expect(Object.keys(config.generated).length).toBe(GENERATED_DOC_COUNT);
    const agentsEntry = config.generated["AGENTS.md"]!;
    expect(agentsEntry.template).toBe("docs/AGENTS.md");
    expect(agentsEntry.checksum).toBe(checksumOf(agents));
    expect(agentsEntry.checksum.startsWith("sha256:")).toBe(true);
    expect(agentsEntry.arggonVersion).toBe(arggonVersion());
    expect(agentsEntry.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.created).toContain("AGENTS.md");

    const skillEntry = config.generated[".agents/skills/arggon-cli/SKILL.md"]!;
    expect(skillEntry.template).toBe("skills/arggon-cli/SKILL.md");
    expect(skillEntry.checksum).toBe(checksumOf(skill));
  });

  it("second init refreshes state for untouched docs and preserves the rest of the yml", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const before = readFileSync(join(dir, "AGENTS.md"), "utf8");
    const result = runInit({ dir, force: false, full: true });
    expect(result.updated.length).toBe(GENERATED_DOC_COUNT);
    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([]);
    // Content is byte-identical (same template, same placeholders).
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(before);
    const raw = readFileSync(join(dir, "tasks/.convention.yml"), "utf8");
    expect(raw).toContain("version: 4");
    expect(raw).toContain('bug: "fix/{id}"');
    const config = parseConventionConfig(raw);
    expect(config.generated["AGENTS.md"]!.checksum).toBe(checksumOf(before));
  });

  it("an edited doc is skipped and reported in modified[] (state keeps other entries)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const originalChecksum = readConventionConfig(dir).generated["AGENTS.md"]!.checksum;
    writeFileSync(join(dir, "AGENTS.md"), "MY EDIT\n", "utf8");
    const result = runInit({ dir, force: false, full: true });
    expect(result.created).toEqual([]);
    expect(result.updated).not.toContain("AGENTS.md");
    expect(result.skipped).toContain("AGENTS.md");
    expect(result.modified).toContain("AGENTS.md");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe("MY EDIT\n");
    const config = readConventionConfig(dir);
    // The modified file keeps its old provenance entry (stale checksum).
    expect(config.generated["AGENTS.md"]!.checksum).toBe(originalChecksum);
    expect(config.generated["AGENTS.md"]!.checksum).not.toBe(checksumOf("MY EDIT\n"));
    expect(config.generated["CONTRIBUTING.md"]!.checksum).toBe(
      checksumOf(readFileSync(join(dir, "CONTRIBUTING.md"), "utf8")),
    );
  });

  it("--backup archives the modified doc to backup/<date>/<dest> then regenerates", () => {
    const dir = tempDir();
    const now = new Date("2026-09-12T10:30:00Z");
    runInit({ dir, force: false, full: true, now });
    writeFileSync(join(dir, "AGENTS.md"), "MY EDIT v2\n", "utf8");
    const result = runInit({ dir, force: false, full: true, backup: true, now });
    expect(result.backedUp).toEqual(["AGENTS.md"]);
    expect(result.modified).toEqual(["AGENTS.md"]);
    expect(result.skipped).toEqual([]);
    expect(result.updated).not.toContain("AGENTS.md");
    // Archived copy keeps the adopter's bytes, at backup/<YYYY-MM-DD>/<dest>.
    expect(readFileSync(join(dir, "backup/2026-09-12/AGENTS.md"), "utf8")).toBe("MY EDIT v2\n");
    // Destination regenerated from the current template with fresh state.
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents.startsWith(`${generatedMarker("AGENTS.md")}\n`)).toBe(true);
    const config = readConventionConfig(dir);
    expect(config.generated["AGENTS.md"]!.checksum).toBe(checksumOf(agents));
    expect(config.generated["AGENTS.md"]!.generatedAt).toBe("2026-09-12T10:30:00.000Z");
  });

  it("--force carries the provenance section across a re-scaffold", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const result = runInit({ dir, force: true, full: true });
    // State survived the forced convention.yml rewrite, so untouched docs
    // update instead of degrading to adopter-modified.
    expect(result.updated.length).toBe(GENERATED_DOC_COUNT);
    expect(result.modified).toEqual([]);
    expect(readConventionConfig(dir).generated["AGENTS.md"]!.template).toBe("docs/AGENTS.md");
  });

  it("keeps a stale entry for a template that no longer exists (via updateGeneratedSection)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const raw = readFileSync(join(dir, "tasks/.convention.yml"), "utf8");
    const stale: GeneratedEntry = {
      template: "docs/gone.md",
      checksum: "sha256:deadbeef",
      arggonVersion: "0.0.0",
      generatedAt: "2026-09-12T00:00:00.000Z",
    };
    const next = updateGeneratedSection(raw, {
      ...readConventionConfig(dir).generated,
      "docs/legacy.md": stale,
    });
    writeFileSync(join(dir, "tasks/.convention.yml"), next, "utf8");
    const config = readConventionConfig(dir);
    expect(config.generated["docs/legacy.md"]!.template).toBe("docs/gone.md");
    expect(config.generated["AGENTS.md"]).toBeDefined();
    expect(config.views).toEqual({});
  });
});

describe("init docs: acknowledged baselines are never regenerated (bug-ack-baseline-regen-loss)", () => {
  it("round-trips the acknowledged flag through the x-generated section", () => {
    const raw = 'version: 3\n\nx-generated:\n  AGENTS.md:\n    template: "docs/AGENTS.md"\n    checksum: "sha256:x"\n    arggonVersion: "0.0.0"\n    generatedAt: "2026-09-13T00:00:00.000Z"\n    acknowledged: true\n';
    const config = parseConventionConfig(raw);
    expect(config.generated["AGENTS.md"]!.acknowledged).toBe(true);
    // Entries without the flag parse as undefined (old sections stay valid).
    expect(parseConventionConfig(raw.replace("    acknowledged: true\n", "")).generated["AGENTS.md"]!.acknowledged).toBeUndefined();
    // Serializing only emits the flag when set (byte-stable for old state).
    const reserialized = updateGeneratedSection("version: 3\n", config.generated);
    expect(reserialized).toContain("    acknowledged: true");
  });

  it("a re-run after acking skips the acked doc and keeps its bytes; unacked untouched docs still update", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    // Sanctioned sweep edit + ack on one doc (simulating adopt --ack's flag;
    // the runAdoptAck tests in adopt.test.ts cover the command wiring).
    const yml = join(dir, "tasks/.convention.yml");
    const state = readConventionConfig(dir).generated;
    writeFileSync(join(dir, "AGENTS.md"), "SWEEP: sanctioned content\n", "utf8");
    const acked = updateGeneratedSection(readFileSync(yml, "utf8"), {
      ...state,
      "AGENTS.md": { ...state["AGENTS.md"]!, acknowledged: true },
    });
    writeFileSync(yml, acked, "utf8");

    // A "template bump" would normally regenerate untouched docs; the acked
    // doc must survive byte-for-byte instead.
    const result = generateDocs({ root: dir, full: true });
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe("SWEEP: sanctioned content\n");
    expect(result.updated).not.toContain("AGENTS.md");
    expect(result.modified).not.toContain("AGENTS.md");
    expect(result.skipped).toContain("AGENTS.md");
    // The unacked untouched docs still follow the silent-update promise.
    expect(result.updated).toContain("CONTRIBUTING.md");
    expect(result.updated).toContain("ARCHITECTURE.md");
    // The entry stays acknowledged after the skip.
    expect(readConventionConfig(dir).generated["AGENTS.md"]!.acknowledged).toBe(true);
  });

  it("a hand edit to an acked doc is still skipped (acknowledged wins over any hash)", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const yml = join(dir, "tasks/.convention.yml");
    const state = readConventionConfig(dir).generated;
    writeFileSync(yml, updateGeneratedSection(readFileSync(yml, "utf8"), {
      ...state,
      "AGENTS.md": { ...state["AGENTS.md"]!, acknowledged: true },
    }), "utf8");
    writeFileSync(join(dir, "AGENTS.md"), "LATE HAND EDIT\n", "utf8");
    const result = generateDocs({ root: dir, full: true });
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe("LATE HAND EDIT\n");
    expect(result.updated).not.toContain("AGENTS.md");
    expect(result.modified).not.toContain("AGENTS.md");
    expect(result.skipped).toContain("AGENTS.md");
  });
});

describe("init docs: orchestration by default (task-orchestration-default-refile)", () => {
  it("generated AGENTS.md ships an Orchestration subsection in the task workflow", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toMatch(/### orchestration/i);
    expect(agents).toMatch(/delegated by default/i);
    expect(agents).toContain("file-disjoint");
    expect(agents).toContain("coordinator");
    expect(agents).toMatch(/never steal a claim/i);
    expect(agents).toMatch(/code-review/i);
    expect(agents).toMatch(/lead architect/i);
  });
});

describe("init docs: generated convention.md documents the x-* namespaced extensions (task-init-convention-extensions)", () => {
  it("init --full generates a convention.md with a Namespaced extensions section listing each x-* key", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const generated = readFileSync(join(dir, "docs/convention.md"), "utf8");
    expect(generated).toMatch(/Namespaced extensions/);
    for (const ext of ["x-views", "x-playbooks", "x-tracker", "x-import", "x-worktree", "x-github", "x-generated"]) {
      expect(generated).toContain(ext);
    }
  });
});

describe("init docs: deploy defaults (task-adr0005-deploy-defaults)", () => {
  it("--full generates docs/deploy.md with the per-shape ADR 0005 defaults, dated pricing, and exit notes", () => {
    const dir = tempDir();
    const result = runInit({ dir, force: false, full: true });
    expect(result.created).toContain("docs/deploy.md");
    const deploy = readFileSync(join(dir, "docs/deploy.md"), "utf8");
    // All four project shapes (ADR 0005 defaults) are keyed in the table.
    expect(deploy).toContain("Static site");
    expect(deploy).toContain("SPA + small API");
    expect(deploy).toContain("Long-running server");
    expect(deploy).toContain("Jobs / cron");
    // Pricing-verification date and re-verify cadence are named.
    expect(deploy).toContain("2026-09-14");
    expect(deploy).toMatch(/re-verify/i);
    expect(deploy).toMatch(/annually|release wave/);
    // Each default is agent-executable (config-in-repo) with an exit note.
    expect(deploy).toContain("wrangler");
    expect(deploy).toContain("Exit note");
  });

  it("tier-1 (no --full) does not generate docs/deploy.md, and generated AGENTS.md carries one pointer line", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    expect(existsSync(join(dir, "docs/deploy.md"))).toBe(false);
    const full = tempDir();
    runInit({ dir: full, force: false, full: true });
    const agents = readFileSync(join(full, "AGENTS.md"), "utf8");
    expect(agents).toContain("docs/deploy.md");
  });

  it("a second --full run regenerates the untouched deploy.md and refreshes its x-generated state", () => {
    const dir = tempDir();
    runInit({ dir, force: false, full: true });
    const first = readFileSync(join(dir, "docs/deploy.md"), "utf8");
    expect(first.startsWith(generatedMarker("docs/deploy.md"))).toBe(true);
    const second = runInit({ dir, force: false, full: true });
    expect(second.updated).toContain("docs/deploy.md");
    expect(readFileSync(join(dir, "docs/deploy.md"), "utf8")).toBe(first);
    expect(readConventionConfig(dir).generated["docs/deploy.md"]!.template).toBe("docs/docs/deploy.md");
  });
});
