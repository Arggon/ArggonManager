import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { findOpenCodeConfig, GENERATED_DOC_COUNT } from "./docs.js";
import { runInit } from "./init.js";
import { readConventionConfig } from "./convention.js";

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
];

describe("opencode seam: fresh init", () => {
  it("creates the config, agents and commands (tier-1, plain init)", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    expect(existsSync(join(dir, "opencode.jsonc"))).toBe(true);
    for (const rel of [...SEAM_AGENTS, ...SEAM_COMMANDS]) {
      expect(existsSync(join(dir, ...rel.split("/"))), rel).toBe(true);
    }
    // The seam counts as generated docs: the constant is derived from the same
    // template walk, so a missing template would already fail this count.
    expect(GENERATED_DOC_COUNT).toBeGreaterThan(0);
  });

  it("opencode.jsonc is valid JSONC (comments only), with no HTML marker", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const raw = readFileSync(join(dir, "opencode.jsonc"), "utf8");
    expect(raw.startsWith("<!-- arggon:generated")).toBe(false);
    expect(raw).not.toContain("arggon:generated");
    const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
    const parsed = JSON.parse(stripped) as {
      mcp?: { servers?: Record<string, { type?: string; command?: string[] }> };
    };
    expect(parsed.mcp?.servers?.arggon?.type).toBe("local");
    expect(parsed.mcp?.servers?.arggon?.command).toEqual(["arggon", "mcp"]);
  });

  it("agents and commands are frontmatter-first with the YAML provenance marker", () => {
    const dir = tempDir();
    runInit({ dir, force: false });
    const worker = readFileSync(join(dir, ".opencode/agents/arggon-worker.md"), "utf8");
    expect(worker.startsWith("---\n# arggon:generated template=\"opencode/agents/arggon-worker.md\"\n")).toBe(true);
    expect(worker).not.toContain("<!-- arggon:generated");
    expect(worker).toContain("mode: subagent");
    const review = readFileSync(join(dir, ".opencode/commands/arggon-review.md"), "utf8");
    expect(review.startsWith("---\n# arggon:generated template=\"opencode/commands/arggon-review.md\"\n")).toBe(true);
    expect(review).toContain("agent: arggon-reviewer");
    expect(review).toContain("subagent: true");
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
  it("does not write opencode.jsonc when the adopter has opencode.json", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "opencode.json"), '{ "model": "anthropic/claude-sonnet-4-5" }\n', "utf8");
    const proc = runCli(["init", dir, "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { created: string[]; skipped: string[] };
    expect(existsSync(join(dir, "opencode.jsonc"))).toBe(false);
    expect(body.created).not.toContain("opencode.jsonc");
    expect(body.skipped).toContain("opencode.jsonc");
    // The rest of the seam is still generated.
    expect(body.created).toContain(".opencode/agents/arggon-worker.md");
    expect(readConventionConfig(dir).generated["opencode.jsonc"]).toBeUndefined();
  });

  it("does not write opencode.jsonc when the adopter has .opencode/opencode.jsonc", () => {
    const dir = tempDir();
    mkdirSync(join(dir, ".opencode"), { recursive: true });
    writeFileSync(join(dir, ".opencode/opencode.jsonc"), "{}\n", "utf8");
    const proc = runCli(["init", dir, "--json"]);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { skipped: string[] };
    expect(existsSync(join(dir, "opencode.jsonc"))).toBe(false);
    expect(body.skipped).toContain("opencode.jsonc");
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
});
