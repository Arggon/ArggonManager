import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateDocs, renderDocPlaceholders } from "./docs.js";
import { runInit } from "./init.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(repoRoot, "cli/src/cli.ts");
const tsx = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[]) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd: repoRoot });
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
    expect(agents).toContain("arggon validate");
  });

  it("CLAUDE.md is exactly the @AGENTS.md shim", () => {
    expect(readFileSync(join(dir, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
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
  it("pre-existing docs keep their exact content and land in skipped[]", () => {
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
  });

  it("generateDocs never overwrites and reports skips", () => {
    const dir = tempDir();
    const first = generateDocs({ root: dir, full: true });
    expect(first.created.length).toBe(15);
    expect(first.skipped).toEqual([]);
    const second = generateDocs({ root: dir, full: true });
    expect(second.created).toEqual([]);
    expect(second.skipped.length).toBe(15);
  });
});

describe("init docs: --json payload", () => {
  it("fresh init lists created docs and empty skipped", () => {
    const dir = tempDir();
    const proc = runCli(["init", dir, "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      command: string;
      created: string[];
      skipped: string[];
    };
    expect(body.ok).toBe(true);
    expect(body.command).toBe("init");
    expect(body.created).toContain("AGENTS.md");
    expect(body.created).toContain("docs/tracking.md");
    expect(body.skipped).toEqual([]);
  });

  it("second init lists nothing created and every doc skipped", () => {
    const dir = tempDir();
    runCli(["init", dir, "--full", "--json"]);
    const proc = runCli(["init", dir, "--full", "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { created: string[]; skipped: string[] };
    expect(body.created).toEqual([]);
    expect(body.skipped).toContain("AGENTS.md");
    expect(body.skipped).toContain("ARCHITECTURE.md");
    expect(body.skipped.length).toBe(15);
  });

  it("a later --full run adds only the tier-2 docs (tier-1 kept)", () => {
    const dir = tempDir();
    runCli(["init", dir, "--json"]);
    const proc = runCli(["init", dir, "--full", "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { created: string[]; skipped: string[] };
    expect(body.created).toEqual(
      ["ARCHITECTURE.md", "CHANGELOG.md", "SUPPORT.md", "docs/convention.md", "docs/engineering.md", "docs/runbooks/README.md"].sort(),
    );
    expect(body.skipped.length).toBe(9);
    expect(body.skipped).toContain("AGENTS.md");
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
