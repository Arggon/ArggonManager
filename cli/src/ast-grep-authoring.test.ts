/**
 * Authoring-constraint gate for the structural rules (PR #418 review follow-up,
 * task-ast-grep-authoring-and-receiver-scope).
 *
 * `tools/ast-grep/README.md` § Authoring notes used to claim that only ONE
 * multi-metavariable (`$$$`) pattern per rule is reliable and that "several
 * `$$$` patterns as siblings in one `any`" produce a wrong match set. The final
 * review observed the opposite in the merged native rule (a dozen distinct
 * sibling `$$$` patterns, all firing), so this gate pins the behavior that the
 * rewritten note documents, against the exact-pinned `@ast-grep/cli`:
 *
 *   - Sibling patterns under one `any` are independent alternatives: every
 *     branch fires on its own matches, repeated metavariable names across
 *     branches do NOT unify, and there is no one-`$$$`-per-rule limit.
 *   - Sibling patterns under one `all` must match the same node, and a name
 *     repeated across those patterns unifies as an EQUALITY constraint: the
 *     rule only fires when every occurrence binds identical text, and silently
 *     produces an empty match set otherwise.
 *
 * The rules below live in a scratch config (not `tools/ast-grep/rules/`) so the
 * repository's policy rules stay untouched; `ast-grep test` cannot express this
 * cross-rule semantics check, hence the scan shell-out (same shape as the
 * plugin type gate).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { removeFixtureTree } from "./test-tmp.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The `ast-grep` entry under @ast-grep/cli differs by install shape: a node
 * dispatcher script on some installs, the raw platform binary on others (CI's
 * optional-dep layout) — executing it via `process.execPath` only works for
 * the former (bug found on CI, PR #479). Resolve a DIRECTLY-executable entry
 * once: the platform packages first, then the cli entry; null => the tests
 * skip cleanly (same contract as smoke:tui-board where `script` is absent).
 */
function resolveAstGrep(): string | null {
  const candidates = [
    "cli-linux-x64-gnu",
    "cli-linux-arm64-gnu",
    "cli-darwin-arm64",
    "cli-darwin-x64",
  ].map((platform) => join(root, "node_modules/@ast-grep", platform, "ast-grep"));
  candidates.push(join(root, "node_modules/@ast-grep/cli/ast-grep"));
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8", timeout: 30_000 });
    if (probe.status === 0 && String(probe.stdout).trim().length > 0) return candidate;
  }
  return null;
}
const astGreps = resolveAstGrep();

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

/** One scratch project: `sgconfig.yml` (Tsx-for-.ts, like the repo config). */
function scratch(config: string): string {
  const dir = mkdtempSync(join(tmpdir(), "astgrep-authoring-"));
  tmpDirs.push(dir);
  writeFileSync(
    join(dir, "sgconfig.yml"),
    ["ruleDirs:", "  - rules", "languageGlobs:", "  tsx:", '    - "**/*.ts"', ""].join("\n"),
    "utf8",
  );
  writeFileSync(join(dir, "fixture.ts"), config, "utf8");
  return dir;
}

function rule(dir: string, body: string): void {
  mkdirSync(join(dir, "rules"), { recursive: true });
  writeFileSync(
    join(dir, "rules", "r.yml"),
    // One rule per scratch run keeps the assertions line-anchored and simple.
    ["id: r", "language: Tsx", "severity: error", "rule:", body, ""].join("\n"),
    "utf8",
  );
}

/** Run the pinned binary and return the fixture lines every match reports. */
function scanLines(dir: string): { status: number; lines: string[]; output: string } {
  const proc = spawnSync(astGreps!, ["scan", "-c", "sgconfig.yml", "fixture.ts"], {
    cwd: dir,
    encoding: "utf8",
    timeout: 120_000,
  });
  expect(proc.status, `${proc.stdout ?? ""}${proc.stderr ?? ""}`).not.toBeNull();
  // Matches are rendered as `│ N │ <source line>` boxes; the source lines are
  // the stable assertion surface (rule ids are constant here: `r`).
  const lines = [...`${proc.stdout ?? ""}`.matchAll(/│\s*(\d+)\s│/g)].map(
    (match) => match[1] ?? "",
  );
  return { status: proc.status ?? -1, lines, output: `${proc.stdout ?? ""}${proc.stderr ?? ""}` };
}

describe.skipIf(astGreps === null)("ast-grep authoring constraints (pinned @ast-grep/cli)", () => {
  it("fires every distinct sibling $$$ pattern in one any (no one-$$$-per-rule limit)", () => {
    const dir = scratch("alpha(1, 2);\nbeta(3);\ngamma(4);\n");
    rule(
      dir,
      ["  any:", "    - pattern: alpha($$$FIRST_ARGS)", "    - pattern: beta($$$SECOND_ARGS)"].join(
        "\n",
      ),
    );
    const { lines, output } = scanLines(dir);
    expect(lines, output).toEqual(["1", "2"]);
  });

  it("does not unify the same metavariable name across any branches", () => {
    const dir = scratch("alpha(1);\nbeta(2, 3);\n");
    rule(
      dir,
      ["  any:", "    - pattern: alpha($VAL)", "    - pattern: beta($VAL, $OTHER)"].join("\n"),
    );
    // If the name unified across branches, beta(2, 3) could not fire ($VAL
    // already bound to 1 by alpha); independence is the documented contract.
    const { lines, output } = scanLines(dir);
    expect(lines, output).toEqual(["1", "2"]);
  });

  it("unifies a repeated name inside one all as an equality constraint", () => {
    const dir = scratch(
      'editor.add({ name: "x" });\ntoolEditor.add(extraTool);\neditor.add(one, two);\n',
    );
    rule(
      dir,
      [
        "  all:",
        "    - pattern: $RECEIVER.add($$$ARGS)",
        "    - pattern: editor.add($$$ARGS)",
      ].join("\n"),
    );
    // The repeated $$$ARGS is an equality constraint: exactly the editor.add
    // calls fire (the receiver name is pinned too), nothing else.
    const { lines, output } = scanLines(dir);
    expect(lines, output).toEqual(["1", "3"]);
  });

  it("silently matches nothing when an all-unified name cannot hold one text", () => {
    const dir = scratch(
      "transform((editor) => {\n  editor.add({ name: 'x' });\n});\neditor.add(solo);\n",
    );
    rule(
      dir,
      ["  all:", "    - pattern: transform($$$CALL)", "    - pattern: editor.add($$$CALL)"].join(
        "\n",
      ),
    );
    // $$$CALL cannot bind both the transform argument and the editor.add
    // argument (different texts, different nodes): the match set is empty —
    // the trap the rewritten authoring note warns about.
    const { lines, output } = scanLines(dir);
    expect(lines, output).toEqual([]);
  });
});
