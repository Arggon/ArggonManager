import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifySpawnFailure,
  cliEntryPath,
  nodeImportArgs,
  runCli,
  SpawnHarnessError,
  tsxLoaderPath,
  type SpawnOutcome,
} from "./test-spawn.js";

/**
 * bug-row-table-flake gate (task-runcli-import-tsx-migration): the tsx
 * wrapper CLI must stay out of test spawn chains. Every suite spawns the CLI
 * through the shared loader helper (`node --import <tsx loader> cli.ts`);
 * this file pins the helper wiring and scans the test trees for any wrapper
 * reference outside comments. smoke/ scripts and e2e/ helpers are deliberate
 * exceptions tracked as a follow-up on the item — they are NOT scanned here.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Built dynamically so this gate never spells the wrapper path in code.
const WRAPPER_REF = ["cli", "mjs"].join(".");

/** Trees whose test spawn chains must use the loader helper. */
const SCANNED = ["cli/src", "labs", "test", "opencode"];
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/**
 * Only `*.test.*` files are scanned: this gate owns the TEST spawn chains.
 * Product code is not scanned, and since task-derive-cli-spawn-loader it no
 * longer carries wrapper surface either: cli/src/measure.ts `cliCommand()`
 * spawns through the same loader registration, and cli/src/mcp-server.ts
 * `deriveDefaultCliSpawn()` keeps the wrapper shape only as a recognized
 * back-compat form. The package.json `tsx`-bin script lanes (arggon/dev/
 * smoke:*) are documented exceptions on that item.
 */

/**
 * Strip line/block comments so prose mentions of the wrapper (e.g. the bug
 * comment in test-spawn.ts) do not trip the scan. String literals are KEPT:
 * the wrapper only ever appears inside them (`join(root, "…/tsx/dist/cli.mjs")`),
 * and that is exactly what this gate must catch.
 */
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  type State = "code" | "line" | "block" | "single" | "double" | "template";
  let state: State = "code";
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = "single";
        out += ch;
        i++;
        continue;
      }
      if (ch === '"') {
        state = "double";
        out += ch;
        i++;
        continue;
      }
      if (ch === "`") {
        state = "template";
        out += ch;
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }
    if (state === "line") {
      if (ch === "\n") {
        state = "code";
        out += ch;
      }
      i++;
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    // String/template states: keep the quote characters, keep the contents
    // (honor escapes). Best-effort by design: `${…}` interiors are kept with
    // the literal, and this repo's sources contain no nested-backtick
    // templates.
    const quote = state === "single" ? "'" : state === "double" ? '"' : "`";
    if (ch === "\\") {
      out += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === quote) {
      state = "code";
    }
    out += ch;
    i++;
  }
  return out;
}

function walkTestFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkTestFiles(full));
    else if (TEST_FILE.test(entry.name)) files.push(full);
  }
  return files;
}

describe("test-spawn helper wiring (bug-row-table-flake)", () => {
  it("resolves the tsx loader and CLI entry inside the repo", () => {
    expect(tsxLoaderPath()).toMatch(/tsx[/\\]dist[/\\]loader\.mjs$/);
    expect(existsSync(tsxLoaderPath())).toBe(true);
    expect(cliEntryPath()).toMatch(/cli[/\\]src[/\\]cli\.ts$/);
    expect(existsSync(cliEntryPath())).toBe(true);
  });

  it("builds the --import argv (loader registration, no wrapper process)", () => {
    expect(nodeImportArgs("entry.ts")).toEqual(["--import", tsxLoaderPath(), "entry.ts"]);
  });

  it("runCli spawns the real CLI successfully", () => {
    const proc = runCli(["--version"], repoRoot);
    expect(proc.status, proc.stderr).toBe(0);
  });

  it("no scanned test tree references the wrapper CLI outside comments", () => {
    const offenders: string[] = [];
    for (const rel of SCANNED) {
      for (const file of walkTestFiles(join(repoRoot, rel))) {
        const code = stripComments(readFileSync(file, "utf8"));
        if (code.includes(WRAPPER_REF)) offenders.push(file.slice(repoRoot.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * bug-cli-spawn-suites-exit-1-flake gate: a spawn that produced NO CLI result
 * must be distinguishable from a real assertion failure, and the shared kernel
 * artifact the children load must not be rebuilt underneath them.
 *
 * These are the two halves of the fix that cleared the three CI flakes which
 * each printed a bare `expected 1 to be +0`: the classification below turns
 * that into a named, diagnosable failure, and the second case pins the
 * discipline that removes the cause (`npm pack` in the repo root must not run
 * `prepare`, which rebuilds `lib/dist` in place under live readers).
 */
describe("spawn failure classification (bug-cli-spawn-suites-exit-1-flake)", () => {
  /** The exact stderr shape CI captured: a child linking a half-written kernel. */
  const BOOT_FAILURE_STDERR = [
    "file:///home/runner/work/ArggonManager/ArggonManager/lib/dist/create.js:9",
    'import { assertParentEdge, expectedParentType } from "./relations.js";',
    "         ^^^^^^^^^^^^^^^^",
    "SyntaxError: The requested module './relations.js' does not provide an export named 'assertParentEdge'",
    "    at ModuleJob._instantiate (node:internal/modules/esm/module_job:226:21)",
    "    at async ModuleJob.run (node:internal/modules/esm/module_job:335:5)",
    "    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)",
    "Node.js v22.23.3",
    "",
  ].join("\n");

  const outcome = (over: Partial<SpawnOutcome>): SpawnOutcome => ({
    status: 0,
    signal: null,
    error: undefined,
    stdout: "",
    stderr: "",
    ...over,
  });

  it("classifies a clean exit as none and a CLI's own non-zero exit as program-exit", () => {
    // program-exit is the class runCli must RETURN, not raise: dozens of tests
    // assert on a non-zero arggon exit code, and raising here would break them.
    expect(classifySpawnFailure(outcome({}))).toBe("none");
    expect(
      classifySpawnFailure(
        outcome({ status: 1, stdout: '{"ok":false,"error":{"code":"CREATE_FAILED"}}' }),
      ),
    ).toBe("program-exit");
  });

  it("classifies the three no-result classes: spawn-error, signalled, child-boot-failed", () => {
    expect(classifySpawnFailure(outcome({ status: null, signal: null }))).toBe("spawn-error");
    expect(
      classifySpawnFailure(
        outcome({
          status: null,
          error: Object.assign(new Error("spawn EAGAIN"), { code: "EAGAIN" }),
        }),
      ),
    ).toBe("spawn-error");
    // OOM-killed / timeout-killed child.
    expect(classifySpawnFailure(outcome({ status: null, signal: "SIGKILL" }))).toBe("signalled");
    // The CI shape: exit 1, but dead inside Node's ESM loader before the CLI ran.
    expect(classifySpawnFailure(outcome({ status: 1, stderr: BOOT_FAILURE_STDERR }))).toBe(
      "child-boot-failed",
    );
  });

  it("does not mistake a CLI envelope or hostile fixture text for a boot failure", () => {
    // Regression guard on the classifier being too eager: a suite that prints
    // "Cannot find module" as DATA (an envelope quoting a user's message) must
    // stay a program-exit, or every non-zero spawn would be misreported.
    expect(
      classifySpawnFailure(
        outcome({
          status: 1,
          stderr: 'arggon: error: task "Cannot find module" not found\n',
        }),
      ),
    ).toBe("program-exit");
  });

  it("runCli returns a program exit untouched and raises a typed error for a boot failure", () => {
    // `show` on a missing id exits non-zero on its own terms: no raise.
    const missing = runCli(["--json", "show", "definitely-not-an-item"], repoRoot);
    expect(missing.status).not.toBe(0);
    expect(missing.error).toBeUndefined();

    // The error carries the class, the argv and the child's own stderr, so the
    // next occurrence of the CI flake is diagnosable from the test output alone.
    const err = new SpawnHarnessError({
      kind: "child-boot-failed",
      argv: [...nodeImportArgs(cliEntryPath()), "--json", "list"],
      cwd: repoRoot,
      outcome: outcome({ status: 1, stderr: BOOT_FAILURE_STDERR }),
      artifactDrift: "before[lib/dist/index.js=6001:1] after[lib/dist/index.js=0:2]",
    });
    expect(err.name).toBe("SpawnHarnessError");
    expect(err.kind).toBe("child-boot-failed");
    expect(err.status).toBe(1);
    expect(err.artifactDrift).toContain("before[");
    expect(err.message).toContain("REWRITTEN");
    expect(err.message).toContain("not an assertion failure");
    expect(err.message).toContain("does not provide an export named 'assertParentEdge'");
  });

  it("the in-repo pack passes --ignore-scripts so it cannot rebuild lib/dist under the suite", () => {
    // The cause, pinned at the one lane whose cwd IS the repo.
    // Deliberately NOT a repo-wide "no unguarded pack" scan: lib-build and
    // pack-contents run `npm run build` / `npm pack` on purpose and are safe
    // precisely because their cwd is a fresh clone copy that owns its own
    // `lib/` — and which cwd an argv literal carries cannot be decided
    // statically, so a blanket ban would delete real coverage. This pins the
    // flag on the only lane whose lifecycle scripts reach the artifact every
    // other lane is reading.
    const code = stripComments(readFileSync(join(repoRoot, "cli/src/headless-ci.test.ts"), "utf8"));
    const packs = [...code.matchAll(/"pack",([^[\]]*)\]/g)].map((m) => m[1]!);
    expect(packs.length).toBeGreaterThan(0);
    expect(packs.filter((argv) => !argv.includes("--ignore-scripts"))).toEqual([]);
    // The clone-copy lane keeps its build — opposite discipline, still covered.
    expect(
      stripComments(readFileSync(join(repoRoot, "cli/src/pack-contents.test.ts"), "utf8")),
    ).toContain('"pack", "--dry-run", "--json"');
  });
});
