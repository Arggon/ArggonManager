/**
 * `arggon instructions` tests (task-instructions-command, story-next).
 *
 * Extraction runs against the real repo playbook (docs/agents.md), so a
 * doc edit that breaks the expected sections fails these tests instead of
 * silently drifting from the command output.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runInit } from "./init.js";
import { runInstructions } from "./instructions.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(repoRoot, "cli/src/cli.ts");
const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");

function primedTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-instructions-"));
  runInit({ dir, force: false });
  return dir;
}

const FIXTURE = `# Agent playbook

## Prerequisites

- Node.js and a checkout.

- \`npm install\`
- \`npm run arggon -- next\`

## Reference integrations

### Pre-commit gate

\`.git/hooks/pre-commit\` (make executable):

\`\`\`sh
#!/bin/sh
npm run arggon -- validate
\`\`\`

### CI gate

Add a job:

\`\`\`yaml
tasks-validate:
  runs-on: ubuntu-latest
\`\`\`

### Agent instructions snippet

Paste into AGENTS.md:

\`\`\`markdown
## Task workflow (ArggonManager)
\`\`\`

## Related

- Convention: docs/convention.md
`;

describe("runInstructions", () => {
  it("extracts install, pre-commit, CI and agent snippets from the real playbook", () => {
    const result = runInstructions({ cwd: repoRoot });
    expect(result.source).toBe("docs/agents.md");
    expect(result.snippets.install).toEqual({
      language: "sh",
      body: "npm install\nnpm run arggon -- <command>",
    });
    expect(result.snippets.precommit.language).toBe("sh");
    expect(result.snippets.precommit.body).toContain("npm run arggon -- validate");
    expect(result.snippets.ci.language).toBe("yaml");
    expect(result.snippets.ci.body).toContain("tasks-validate:");
    expect(result.snippets.agent.language).toBe("markdown");
    expect(result.snippets.agent.body).toContain("## Task workflow (ArggonManager)");
  });

  it("extracts the same snippets from a custom fixture tree", () => {
    const dir = primedTree();
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/agents.md"), FIXTURE, "utf8");
    const result = runInstructions({ cwd: dir });
    expect(result.snippets.install.body).toBe("npm install\nnpm run arggon -- next");
    expect(result.snippets.precommit.body).toContain("#!/bin/sh");
    expect(result.snippets.ci.body).toBe("tasks-validate:\n  runs-on: ubuntu-latest");
    expect(result.snippets.agent.body).toBe("## Task workflow (ArggonManager)");
  });

  it("does not leak past a section into fenced YAML comments or later sections", () => {
    const dir = primedTree();
    mkdirSync(join(dir, "docs"), { recursive: true });
    const tricky = FIXTURE.replace(
      "tasks-validate:\n  runs-on: ubuntu-latest",
      "tasks-validate:\n  # not a heading\n  runs-on: ubuntu-latest",
    );
    writeFileSync(join(dir, "docs/agents.md"), tricky, "utf8");
    const result = runInstructions({ cwd: dir });
    expect(result.snippets.ci.body).toContain("# not a heading");
    expect(result.snippets.agent.body).toContain("## Task workflow (ArggonManager)");
  });

  it("fails with an actionable error when the playbook is missing", () => {
    const dir = primedTree();
    expect(() => runInstructions({ cwd: dir })).toThrow(
      /playbook not found at docs\/agents\.md/,
    );
  });
});

describe("arggon instructions CLI", () => {
  it("--json emits the snippets as structured fields", () => {
    const proc = spawnSync(process.execPath, [tsx, cli, "--json", "instructions"], {
      encoding: "utf8",
      cwd: repoRoot,
    });
    expect(proc.status, proc.stderr).toBe(0);
    const envelope = JSON.parse(proc.stdout) as {
      ok: boolean;
      command: string;
      schemaVersion: number;
      source: string;
      snippets: Record<string, { language: string; body: string }>;
    };
    expect(envelope).toMatchObject({ ok: true, command: "instructions", schemaVersion: 1 });
    expect(envelope.source).toBe("docs/agents.md");
    expect(Object.keys(envelope.snippets).sort()).toEqual(["agent", "ci", "install", "precommit"]);
    expect(envelope.snippets.precommit.body).toContain("npm run arggon -- validate");
  });

  it("human output prints every section and fails cleanly without a playbook", () => {
    const human = spawnSync(process.execPath, [tsx, cli, "instructions"], {
      encoding: "utf8",
      cwd: repoRoot,
    });
    expect(human.status).toBe(0);
    for (const marker of ["## install", "## pre-commit gate", "## CI gate", "## agent instructions snippet"]) {
      expect(human.stdout).toContain(marker);
    }
    expect(human.stdout).toContain("```sh");

    const dir = primedTree();
    const missing = spawnSync(process.execPath, [tsx, cli, "--json", "instructions"], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(missing.status).not.toBe(0);
    const envelope = JSON.parse(missing.stdout) as { ok: boolean; error: { message: string } };
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toMatch(/playbook not found/);
  });
});
