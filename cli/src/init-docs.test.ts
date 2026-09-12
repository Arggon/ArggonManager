import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checksumOf,
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
    expect(first.created.length).toBe(16); // 15 docs + bundled arggon-cli skill
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
    expect(second.modified.length).toBe(16);
    expect(second.skipped.length).toBe(16);
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
    expect(body.updated.length).toBe(16);
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
      ["ARCHITECTURE.md", "CHANGELOG.md", "SUPPORT.md", "docs/convention.md", "docs/engineering.md", "docs/runbooks/README.md"].sort(),
    );
    expect(body.updated.length).toBe(10); // 9 tier-1 docs + bundled skill
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

describe("init docs: x-generated provenance (story-adoption-state)", () => {
  it("first init stamps markers and records the x-generated state (checksum matches file)", () => {
    const dir = tempDir();
    const result = runInit({ dir, force: false, full: true });
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents.startsWith(`${generatedMarker("AGENTS.md")}\n`)).toBe(true);
    const skill = readFileSync(join(dir, ".agents/skills/arggon-cli/SKILL.md"), "utf8");
    expect(skill.startsWith(`${generatedMarker("skills/arggon-cli/SKILL.md")}\n`)).toBe(true);

    const config = readConventionConfig(dir);
    expect(Object.keys(config.generated).length).toBe(16);
    const agentsEntry = config.generated["AGENTS.md"]!;
    expect(agentsEntry.template).toBe("docs/AGENTS.md");
    expect(agentsEntry.checksum).toBe(checksumOf(agents));
    expect(agentsEntry.checksum.startsWith("sha256:")).toBe(true);
    expect(agentsEntry.arggonVersion).toBe("0.0.0");
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
    expect(result.updated.length).toBe(16);
    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([]);
    // Content is byte-identical (same template, same placeholders).
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(before);
    const raw = readFileSync(join(dir, "tasks/.convention.yml"), "utf8");
    expect(raw).toContain("version: 3");
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
    expect(result.updated.length).toBe(16);
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
