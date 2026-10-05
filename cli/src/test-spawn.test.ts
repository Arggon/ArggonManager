import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifySpawnFailure,
  cliEntryPath,
  cliNodeArgs,
  EnvelopeReadError,
  KernelArtifactDriftError,
  kernelSourceHookPath,
  nodeImportArgs,
  readEnvelope,
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
      // The representative argv is the harness one, so the rendered diagnostic
      // shows what a real spawn would have run.
      argv: [...cliNodeArgs(cliEntryPath()), "--json", "list"],
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

/**
 * bug-test-suite-lib-dist-rebuild-race gate: the READER side of the shared-build
 * isolation, complementing the `--ignore-scripts` writer gate above.
 *
 * `lib/dist` is frozen for the run (`test/kernel-artifacts.ts`), so a writer can
 * no longer produce the race. That is only half of it: a child that resolves the
 * kernel through `node_modules` reads the artifact at all, so any writer that
 * gets past the freeze (root, `chmod -R u+w`, a platform without POSIX modes)
 * is one broken child away from the original flake. `cliNodeArgs` removes the
 * read: the child loads `lib/src`, which nothing rebuilds.
 *
 * So the pin is on the argv, in two directions:
 *   - the harness itself must never build a child argv the old way, and
 *   - no test may spawn a CLI child with the bare source-run argv.
 *
 * The exemption is deliberate and narrow: `cli/src/lib-build.test.ts` spawns the
 * CLI of a PRIVATE fresh-clone copy against that copy's own `dist`, which is the
 * gate that exercises the built kernel for real (the reason the alias-to-source
 * exists at all). Nothing else may name a CLI entry through `nodeImportArgs`.
 */
describe("spawned children resolve the kernel from source (bug-test-suite-lib-dist-rebuild-race)", () => {
  // Assembled at runtime so this gate's own pattern cannot match itself (the
  // precedent the wrapper scan sets with WRAPPER_REF above).
  const CLI_ENTRY_ARGV = new RegExp(
    ["nodeImportArgs", "\\(\\s*(cliEntryPath\\(\\)|cli\\b|cliEntry\\b)"].join(""),
  );

  it("the harness builds every child argv with the kernel-source hook", () => {
    const code = stripComments(readFileSync(join(repoRoot, "cli/src/test-spawn.ts"), "utf8"));
    // `nodeImportArgs` stays as an exported helper (production's shape, see
    // cli/src/measure.ts) but the harness must not CALL it: the one remaining
    // occurrence in this file is the helper's own declaration.
    expect(code.match(/nodeImportArgs\(/g) ?? []).toHaveLength(1);
    expect(code).toContain("export function nodeImportArgs(");
    // Both spawn paths (runCli and spawnNodeCli) spread the hooked argv.
    expect(code.match(/\[\.\.\.cliNodeArgs\(\), \.\.\.args\]/g) ?? []).toHaveLength(2);
    expect(existsSync(kernelSourceHookPath())).toBe(true);
    // The entry is last in both shapes: measureBudget and the loader contract
    // read the position, not the whole argv.
    expect(cliNodeArgs("entry.ts").at(-1)).toBe("entry.ts");
  });

  it("no test spawns a CLI child through the bare source-run argv", () => {
    const offenders: string[] = [];
    for (const rel of SCANNED) {
      for (const file of walkTestFiles(join(repoRoot, rel))) {
        if (file.endsWith("lib-build.test.ts")) continue; // private copy's dist
        const code = stripComments(readFileSync(file, "utf8"));
        // A CLI entry named through nodeImportArgs: `cliEntryPath()`, a `cli`
        // const, or an `cliEntry` parameter. Driver scripts (which import no
        // kernel) pass a bare filename and are untouched.
        if (CLI_ENTRY_ARGV.test(code)) {
          offenders.push(file.slice(repoRoot.length + 1));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("drift is a named failure of its own, not a footnote on somebody else's error", () => {
    // The reported class was report-only: it surfaced only when a reader was
    // unlucky enough to die, as an unrelated SyntaxError. A writer is a defect
    // whether or not it broke somebody, so it now has its own name.
    const err = new KernelArtifactDriftError({
      argv: [...cliNodeArgs(cliEntryPath()), "--json", "list"],
      cwd: repoRoot,
      drift: "before[lib/dist/index.js=6001:1] after[lib/dist/index.js=0:2]",
    });
    expect(err.name).toBe("KernelArtifactDriftError");
    expect(err).toBeInstanceOf(Error);
    expect(err.drift).toContain("before[");
    expect(err.message).toContain("REWRITTEN");
    expect(err.message).toContain("not an assertion failure");
    // The two instructions that matter: where a build belongs, and whose bug it is.
    expect(err.message).toContain("freshCloneCopy");
    expect(err.message).toContain("fix the writer, not the reader");
  });
});

/**
 * bug-mcp-parity-branch-test-json-parse-of-human-stdout gate: a test that reads
 * a surface's output as a `--json` envelope must never surface a bare
 * `SyntaxError` from `JSON.parse`.
 *
 * CI captured exactly this on PR #610 (a docs-only change), twice, in
 * `mcp-parity.test.ts`:
 *
 *   SyntaxError: Unexpected token 'a', "arggon bra"... is not valid JSON
 *     ❯ mcp-parity.test.ts:72:25
 *   SyntaxError: Unexpected token 'a', "arggon cle"... is not valid JSON
 *
 * The text was NOT a human success line from the CLI: `arggon branch --json`
 * and `arggon cleanup --json` write the envelope and nothing else. It was the
 * MCP server's own tool-LEVEL error sentence (`spawnedOutcome` in
 * `cli/src/mcp-server.ts` throws `arggon <command> did not emit a JSON envelope
 * (…)` when a spawned child died before printing one), and the parity helper
 * parsed the tool result before the caller could read `isError`. The product
 * message is reproduced verbatim below, because the whole point of this gate is
 * that a reader no longer needs three guesses to identify it.
 */
describe("envelope reading (bug-mcp-parity-branch-test-json-parse-of-human-stdout)", () => {
  const ENVELOPE = '{"ok":true,"schemaVersion":1,"conventionVersion":5,"command":"branch"}';

  it("reads the contract shape exactly, and reports that it was exact", () => {
    const read = readEnvelope({ surface: "CLI", command: "arggon branch", text: `${ENVELOPE}\n` });
    expect(read.envelope).toEqual({
      ok: true,
      schemaVersion: 1,
      conventionVersion: 5,
      command: "branch",
    });
    expect(read.exact).toBe(true);
  });

  it("reads an envelope that a human line precedes, on its own line or not", () => {
    // The shape acceptance box 1 asks for: a human success line must not be able
    // to turn a parsable stream into a SyntaxError.
    for (const text of [
      `arggon branch: task task-rate-limit -> feat/rate-limit (created)\n${ENVELOPE}\n`,
      `arggon branch: task task-rate-limit -> feat/rate-limit (created) ${ENVELOPE}`,
    ]) {
      const read = readEnvelope({ surface: "CLI", command: "arggon branch", text });
      expect(read.envelope.command).toBe("branch");
      // Found by locating, not by taking the whole text: the strict JSON-only
      // contract is still assertable by a test that wants it.
      expect(read.exact).toBe(false);
    }
  });

  it("is not fooled by an apostrophe or a brace in the human line ahead of it", () => {
    const read = readEnvelope({
      surface: "CLI",
      command: "arggon branch",
      text: `arggon branch: can't attach 'fix/x' { id: task-rate-limit }\n${ENVELOPE}\n`,
    });
    expect(read.envelope.command).toBe("branch");
    expect(read.exact).toBe(false);
  });

  it("raises a named, surface-tagged error for the MCP tool-error text, not a SyntaxError", () => {
    // The CI-captured shape, byte-for-byte in its opening.
    const text =
      "arggon branch did not emit a JSON envelope (exit code 1): " +
      "Cannot find module '/nonexistent/nope.js'";
    let raised: unknown;
    try {
      readEnvelope({ surface: "MCP", command: "arggon_branch", text, isError: true });
    } catch (err) {
      raised = err;
    }
    expect(raised).toBeInstanceOf(EnvelopeReadError);
    const err = raised as EnvelopeReadError;
    expect(err.name).toBe("EnvelopeReadError");
    expect(err.surface).toBe("MCP");
    expect(err.command).toBe("arggon_branch");
    expect(err.isError).toBe(true);
    // One read has to be enough: which surface, that it was a tool error, and
    // the raw text itself.
    expect(err.message).toContain("surface: MCP (arggon_branch) produced no JSON envelope");
    expect(err.message).toContain("tool-level error: true");
    expect(err.message).toContain("TOOL ERROR");
    expect(err.message).toContain("did not emit a JSON envelope (exit code 1)");
    // Not the old symptom: no bare JSON.parse SyntaxError escapes any more.
    expect(err.message).not.toContain("is not valid JSON");
  });

  it("fails when the envelope is genuinely malformed, and echoes the raw text", () => {
    const cases = [
      { label: "truncated", text: '{"ok":true,"schemaVers' },
      { label: "not json at all", text: "arggon: error: no tracker root found" },
      { label: "empty", text: "" },
      { label: "json but not an object", text: "[1,2,3]" },
      { label: "prose that merely mentions json", text: "expected {ok:true} but got nothing" },
    ];
    for (const { label, text } of cases) {
      expect(() => readEnvelope({ surface: "CLI", command: "arggon branch", text }), label).toThrow(
        EnvelopeReadError,
      );
    }
    const err = (() => {
      try {
        readEnvelope({
          surface: "CLI",
          command: "arggon branch",
          text: '{"ok":true,"schemaVers',
          stderr: "SyntaxError: Unexpected end of JSON input",
        });
        return null;
      } catch (e) {
        return e as EnvelopeReadError;
      }
    })();
    expect(err?.message).toContain('{"ok":true,"schemaVers');
    expect(err?.message).toContain("SyntaxError: Unexpected end of JSON input");
    // No stderr is stated, not left blank.
    expect(
      (() => {
        try {
          readEnvelope({ surface: "CLI", command: "arggon cleanup", text: "boom" });
          return "";
        } catch (e) {
          return (e as EnvelopeReadError).message;
        }
      })(),
    ).toContain("--- CLI stderr ---\n(empty)");
  });

  it("clips an oversized stream but keeps the head, where the noise is", () => {
    // No envelope anywhere in it, so the scan runs out and reports.
    const huge = `${"x".repeat(5000)}\narggon branch: still going`;
    const err = (() => {
      try {
        readEnvelope({ surface: "MCP", command: "arggon_cleanup", text: huge });
        return null;
      } catch (e) {
        return e as EnvelopeReadError;
      }
    })();
    expect(err).toBeInstanceOf(EnvelopeReadError);
    expect(err?.message).toContain("more characters)");
    // The head is what the message carries; the tail is not echoed.
    expect(err?.message).not.toContain("still going");
  });

  it("still finds the envelope behind a long human preamble", () => {
    // The scan is budgeted, so a preamble long enough to push the envelope past
    // the budget would silently report "no envelope" — pin that it does not.
    const preamble = Array.from({ length: 400 }, (_v, i) => `warning ${i}: continuing`).join("\n");
    const read = readEnvelope({
      surface: "CLI",
      command: "arggon branch",
      text: `${preamble}\n${ENVELOPE}\n`,
    });
    expect(read.envelope.command).toBe("branch");
    expect(read.exact).toBe(false);
  });
});
