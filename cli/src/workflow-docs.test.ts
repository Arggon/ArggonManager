import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runInit } from "./init.js";
import { runInstructions } from "./instructions.js";
import {
  canonicalContract,
  renderWorkflowCopy,
  syncWorkflowDocs,
  workflowRegion,
  WORKFLOW_SOURCE,
  WORKFLOW_TARGETS,
  WORKFLOW_URL,
} from "./workflow-docs.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const source = read(WORKFLOW_SOURCE);

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
function temp() {
  const dir = mkdtempSync(join(tmpdir(), "arggon-workflow-"));
  dirs.push(dir);
  return dir;
}

/** A neutral copy target with one well-formed copy region. */
const COPY =
  "before\n<!-- arggon:workflow-copy:start -->\nstale\n<!-- arggon:workflow-copy:end -->\nafter\n";

/**
 * The old recipes, rejected wherever an agent-facing entrypoint still teaches
 * them: a bare `update` claim without the single-checkout boundary, `PR linked`
 * as completion, a "manual fallback" claim, or an optional worktree flag.
 */
function assertSafeRecipe(text: string) {
  for (const line of text.split("\n")) {
    if (/update\s+<id>\s+--status in_progress/.test(line)) {
      expect(line, "bare update claim without the single-checkout boundary").toMatch(
        /single-checkout humans only/i,
      );
    }
  }
  expect(text).not.toMatch(/done[^\n]*\+ PR linked/i);
  expect(text).not.toMatch(/manual fallback:/i);
  expect(text).not.toMatch(/\[--worktree\]/);
  expect(text).not.toMatch(/edit frontmatter \+ open a PR/i);
}

/** Every agent-facing surface that must not restate a competing recipe. */
const ENTRYPOINTS = [
  WORKFLOW_SOURCE,
  "AGENTS.md",
  "CONTRIBUTING.md",
  ".github/copilot-instructions.md",
  "templates/docs/AGENTS.md",
  "templates/docs/CONTRIBUTING.md",
  "templates/docs/github/copilot-instructions.md",
  "skills/arggon-cli/SKILL.md",
];

/** Adapter claim commands: the agent claim must be the worktree claim. */
const ADAPTER_STARTS = [
  "templates/docs/opencode/commands/arggon-start.md",
  "templates/docs/zcode/arggon/commands/arggon-start.md",
  "templates/docs/claude/arggon/commands/start.md",
];

describe("canonical workflow contract", () => {
  it("is normative in the playbook and names every role boundary", () => {
    const contract = canonicalContract(source);
    expect(source).toContain('<a id="canonical-workflow-contract"></a>');
    expect(contract).toContain("start <id> --worktree --assignee <agent-id>");
    expect(contract).toContain("tools.arggon.start({ id, assignee, worktree: true })");
    expect(contract).toContain("worktree_path");
    expect(contract).toContain("Single-checkout humans only");
    expect(contract).toContain("never re-claims");
    expect(contract).toContain("maker never flips `done`");
    expect(contract).toContain("delivery lead verifies");
    expect(contract).toContain("auto-done");
    expect(contract).toContain("default branch");
  });

  it("regenerates every committed copy with no drift (also run in CI)", () => {
    expect(syncWorkflowDocs(root)).toEqual([]);
    expect(WORKFLOW_TARGETS.map(({ path }) => path)).toEqual([
      WORKFLOW_SOURCE,
      "templates/docs/AGENTS.md",
      "templates/docs/CONTRIBUTING.md",
      "templates/docs/github/copilot-instructions.md",
      ".github/copilot-instructions.md",
    ]);
    for (const { path } of WORKFLOW_TARGETS) {
      expect(workflowRegion(read(path), "copy").body).toContain(WORKFLOW_URL);
    }
  });

  it("no longer teaches the old claim or completion recipe anywhere agent-facing", () => {
    for (const path of ENTRYPOINTS) assertSafeRecipe(read(path));
    for (const path of ADAPTER_STARTS) {
      const text = read(path);
      assertSafeRecipe(text);
      expect(text, path).toContain("worktree: true");
      expect(text, path).not.toMatch(/worktree:\s*false/);
      expect(text, path).not.toContain("add `worktree: true`");
    }
    // The previous root copilot copy and its template.
    expect(read(".github/copilot-instructions.md")).not.toContain(
      "claim it with `arggon update <id>",
    );
    expect(read("templates/docs/github/copilot-instructions.md")).not.toContain(
      "claim it with `arggon update <id>",
    );
  });

  it("rejects the original stale claim and completion recipes", () => {
    expect(() =>
      assertSafeRecipe("Claim: `arggon update <id> --status in_progress --assignee <you>`"),
    ).toThrow();
    expect(() =>
      assertSafeRecipe(
        "Done = acceptance checklist complete + `arggon update <id> --status done` + PR linked.",
      ),
    ).toThrow();
    expect(() => assertSafeRecipe("Manual fallback: update + branch")).toThrow();
    expect(() => assertSafeRecipe("start <id> [--worktree]")).toThrow();
    expect(() =>
      assertSafeRecipe(
        "Prefer claiming via the CLI when those commands exist; until then, edit frontmatter + open a PR.",
      ),
    ).toThrow();
    // The canonical contract itself is safe: the human bullet names its boundary.
    expect(() => assertSafeRecipe(canonicalContract(source))).not.toThrow();
  });

  it("prints the full copy-paste recipe from the canonical source", () => {
    const result = runInstructions({ cwd: root });
    expect(result.snippets.agent.body).toContain("## Task workflow (ArggonManager)");
    expect(result.snippets.agent.body).toContain(canonicalContract(source).trim());
    expect(result.snippets.agent.body).toContain(WORKFLOW_URL);
    expect(result.snippets.agent.body).toContain("start <id> --worktree --assignee <agent-id>");
  });

  it("ships the generated pointer and a bounded router to fresh adopters", () => {
    const dir = temp();
    runInit({ dir, force: false });
    for (const path of ["AGENTS.md", "CONTRIBUTING.md", ".github/copilot-instructions.md"]) {
      const text = readFileSync(join(dir, path), "utf8");
      expect(text, path).toContain(WORKFLOW_URL);
      assertSafeRecipe(text);
    }
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(Buffer.byteLength(agents, "utf8")).toBeLessThanOrEqual(2048);
    // The generated CONTRIBUTING keeps the human path, and the AGENTS router
    // keeps the native surface; neither is a competing agent recipe.
    expect(readFileSync(join(dir, "CONTRIBUTING.md"), "utf8")).toContain(
      "Single-checkout humans only",
    );
    expect(agents).toContain("tools.arggon.start");
  });
});

describe("workflow copy generation", () => {
  it("preserves surrounding prose, is deterministic and detects a changed source", () => {
    const first = renderWorkflowCopy(COPY, source, false);
    expect(first.startsWith("before\n")).toBe(true);
    expect(first.endsWith("\nafter\n")).toBe(true);
    expect(renderWorkflowCopy(first, source, false)).toBe(first);
    expect(
      renderWorkflowCopy(
        first,
        source.replace("**Agents claim through the worktree:**", "**Agents claim another way:**"),
        true,
      ),
    ).not.toBe(first);
    expect(renderWorkflowCopy(COPY, source, true)).toContain(canonicalContract(source));
  });

  it.each([
    ["", "missing pair"],
    [COPY + COPY, "duplicate pair"],
    [COPY.replace("<!-- arggon:workflow-copy:end -->", ""), "missing end"],
    ["<!-- arggon:workflow-copy:end -->\n<!-- arggon:workflow-copy:start -->\n", "reversed"],
    [COPY.replace("before\n", "before"), "marker not line-delimited"],
  ])("refuses a malformed copy region (%s)", (target) => {
    expect(() => renderWorkflowCopy(target, source, false)).toThrow(/marker/);
  });

  it("refuses duplicate, empty or anchor-less canonical sources", () => {
    expect(() => renderWorkflowCopy(COPY, source + source, false)).toThrow(/marker/);
    expect(() =>
      renderWorkflowCopy(
        COPY,
        "<!-- arggon:workflow-source:start -->\n\n<!-- arggon:workflow-source:end -->",
        false,
      ),
    ).toThrow(/anchor/);
    expect(() =>
      renderWorkflowCopy(
        COPY,
        '<a id="canonical-workflow-contract"></a>\n<!-- arggon:workflow-source:start -->\n\n<!-- arggon:workflow-source:end -->',
        false,
      ),
    ).toThrow(/empty/);
  });

  it("checks without repairing, writes all-or-nothing, and is idempotent", () => {
    const dir = temp();
    for (const { path } of WORKFLOW_TARGETS) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), path === WORKFLOW_SOURCE ? source : COPY);
    }
    expect(syncWorkflowDocs(dir).length).toBeGreaterThan(0);
    expect(readFileSync(join(dir, "templates/docs/AGENTS.md"), "utf8")).toBe(COPY);
    expect(syncWorkflowDocs(dir, true).length).toBeGreaterThan(0);
    expect(syncWorkflowDocs(dir, true)).toEqual([]);

    const last = join(dir, WORKFLOW_TARGETS.at(-1)!.path);
    writeFileSync(last, "no markers");
    writeFileSync(join(dir, "templates/docs/AGENTS.md"), COPY);
    expect(() => syncWorkflowDocs(dir, true)).toThrow(/marker/);
    // Failing before the first write leaves the earlier stale target intact.
    expect(readFileSync(join(dir, "templates/docs/AGENTS.md"), "utf8")).toBe(COPY);
  });
});
