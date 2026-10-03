/**
 * Headless bootstrap + CI adapter (W6 `task-native-headless-ci`).
 *
 * Acceptance, mapped to the tests below:
 *
 *   1. **pin install → `init` → CI green without a model** — the shipped
 *      install step runs verbatim with `ARGGON_VERSION` pointed at a tarball
 *      packed from the working tree (a `file:` spec, so the templates under
 *      test are the tree under test) and `npm_config_prefix` redirected; the
 *      rest of the recipe then runs on an adopter-shaped fixture (git repo, no
 *      tracker) without any model.
 *   2. **`npm pack` install test** — the bin installed by that step runs and
 *      the `--json` envelopes are byte-identical to the checkout CLI (`init`,
 *      `validate`, `doctor`, `list`, `show`, `next`, `report`).
 *   3. **the CI recipe is documented and used by an adopter-shaped fixture** —
 *      the workflow `arggon init` vendors is the recipe executed here, step
 *      bodies verbatim; the doc lives in `ArggonManager/docs/ci.md`.
 *   4. **MCP is not required anywhere** — no executed step mentions it, and the
 *      recipe stays green with `.mcp.json` and the whole OpenCode seam deleted.
 *   5. **the drift gate is branch-aware** (bug-seam-drift-gate-blocks-new-generated-seam-content)
 *      — it compares the committed seam against the generator that owns it:
 *      the CHECKOUT's own build when the checkout is the seam's source (the
 *      #605 shape: a feature PR that adds generated content is NOT drift), the
 *      pinned release everywhere else. A pinned-lag assertion keeps the release
 *      protection the branch-local comparison gives up: no committed
 *      `arggonVersion` stamp may be NEWER than `ARGGON_VERSION`, because the
 *      pinned init would then rewrite committed content. Both directions are
 *      driven here — a seam newer than the pin goes GREEN, a seam whose bytes
 *      differ from its own generator's goes RED, and the messages name the
 *      generator that disagrees. The lag assertion is driven on both sides of
 *      the `package.json`-vs-pin question too (a fixture whose `package.json`
 *      version equals the pin still goes RED): it never reads `package.json`,
 *      which is why the repo-side predicate's old `pin !== pkgVersion` conjunct
 *      could not be pasted in here to "close the gap" — see
 *      `cli/src/ci-seam-pin.test.ts` and `ArggonManager/docs/ci.md`
 *      §Where the rule of record lives.
 *
 * The shipped install step is `npm install -g "arggon-manager@$ARGGON_VERSION"`
 * (task-ci-recipe-published-one-liner): registry install, no clone. Its TEXT
 * is pinned by assertion (pin form, no clone, ARGGON_VERSION env), and the
 * released one-liner was verified against the real npm registry (bin links on
 * npm 10 and 12). The EXECUTED install is the documented checkout-pinned
 * variant (ArggonManager/docs/ci.md): both tarballs packed from the working
 * tree and installed together — the tested bin is the tree under test
 * (templates AND kernel), hermetic except `commander` from the registry, and
 * independent of a local registry reimplementation. `npm_config_prefix`
 * redirects the global install into a temp prefix. Every other step body runs
 * as-is with `bash -e`.
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
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
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONVENTION_VERSION } from "@arggondev/lib";
import { checksumOf } from "./docs.js";
import { initFixtureRepo, removeFixtureTree } from "./test-tmp.js";
import { runCli } from "./test-spawn.js";
// Ordering assertions go through assertOrder, never a bare `indexOf`
// comparison: `-1 < n` makes a renamed clause pass as if it were still
// ordered (bug-vacuous-substring-ordering-assertions).
import { assertOrder } from "../../test/assert-order.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKFLOW_TEMPLATE = join(root, "templates/docs/github/workflows/arggon.yml");
const WORKFLOW_DEST = ".github/workflows/arggon.yml";
const WORKFLOW_MARKER = `# arggon:generated template="github/workflows/arggon.yml"`;
/** Provenance marker of the committed-seam fixture's generated doc. */
const AGENTS_MARKER = `# arggon:generated template="docs/AGENTS.md"`;
const CI_DOC = join(root, "ArggonManager/docs/ci.md");

/** Step names of the shipped workflow (asserted, so a restructure fails loudly). */
const INSTALL_STEP = "Install the headless arggon bin (no model, no MCP)";
const BOOTSTRAP_STEP = "Bootstrap the tracker (idempotent; never overwrites adopter files)";
const DRIFT_STEP = "Committed seam is current (drift gate; no-op until initialized)";
const VALIDATE_STEP = "Validate the tracker";
const DIAGNOSTICS_STEP = "Diagnostics (report-only)";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

function mkdtemp(prefix: string): string {
  const dir = _mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/**
 * `run:` bodies of the shipped workflow, keyed by step name. Hand-rolled on
 * purpose: the repo has no YAML parser dependency, and every assertion below
 * names its step, so a workflow restructure fails the gate instead of silently
 * skipping it. Handles the two shapes the workflow uses: `run: |` blocks and
 * single-line `run: <command>` steps.
 */
export function workflowRunSteps(workflow: string): Map<string, string> {
  const lines = workflow.split("\n");
  const steps = new Map<string, string>();
  for (let i = 0; i < lines.length; i++) {
    const name = /^\s*- name: (.+?)\s*$/.exec(lines[i]!);
    if (!name) continue;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*- name: /.test(lines[j]!)) break; // next step
      const block = /^(\s+)run: \|\s*$/.exec(lines[j]!);
      if (block) {
        const minIndent = block[1]!.length + 1;
        const body: string[] = [];
        for (let k = j + 1; k < lines.length; k++) {
          const line = lines[k]!;
          if (line.trim() !== "" && line.length - line.trimStart().length < minIndent) break;
          body.push(line);
        }
        const firstContent = body.find((line) => line.trim() !== "");
        const indent =
          firstContent === undefined ? minIndent : /^\s*/.exec(firstContent)![0].length;
        steps.set(name[1]!, body.map((line) => line.slice(indent)).join("\n"));
        break;
      }
      const inline = /^\s+run: (\S.*)$/.exec(lines[j]!);
      if (inline) {
        steps.set(name[1]!, inline[1]!);
        break;
      }
    }
  }
  return steps;
}

/** Byte snapshot of a tree, normalized for the volatile generated values. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        walk(full);
      } else {
        out[relative(dir, full)] = normalize(readFileSync(full, "utf8"), dir);
      }
    }
  };
  walk(dir);
  return out;
}

/** Normalize volatile bytes: fixture root, timestamps, commit hashes. */
function normalize(raw: string, dir: string): string {
  return raw
    .split(dir)
    .join("<root>")
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<datetime>")
    .replace(/\d{4}-\d{2}-\d{2}/g, "<date>")
    .replace(/"hash": ?"[0-9a-f]{7,40}"/g, '"hash":"<hash>"');
}

/**
 * The drift gate's rule of record is the TEMPLATE (it is what adopters vendor);
 * `.github/workflows/arggon.yml` is the copy CI actually runs. They must carry
 * the same rule, and the only documented difference is the `uses:` action refs —
 * the template floats on `@v4`, this repo SHA-pins them
 * (task-action-pins-hygiene). Nothing enforced that: the rest of this file
 * parses the TEMPLATE, so a hand-divide of the two copies (a predicate edited in
 * one, an exclusion dropped in the other) shipped unnoticed — and the reviewer of
 * PR #607 found a real semantic divergence in the pin-lag rule because of it.
 * The OTHER two-copy pair (the shell clause vs the `pinLagsSeam()` predicate in
 * `cli/src/ci-seam-pin.test.ts`) is closed: they are one rule, held together by
 * a parity test that EXECUTES the clause lifted from both copies below
 * (bug-ci-seam-pin-shell-vs-test-copy-divergence). This block is the workflow
 * pair — template vs the committed copy.
 */
describe("workflow parity: template vs the copy CI runs", () => {
  const COMMITTED_WORKFLOW = join(root, ".github/workflows/arggon.yml");
  /** Collapse every action reference so the two copies compare on the RULE. */
  const withoutActionRefs = (workflow: string): string =>
    workflow.replace(/^\s*-?\s*uses:.*$/gm, "      - uses: <action-ref>");

  it("carries one rule: identical modulo the `uses:` action refs", () => {
    const template = withoutActionRefs(readFileSync(WORKFLOW_TEMPLATE, "utf8"));
    const committed = withoutActionRefs(readFileSync(COMMITTED_WORKFLOW, "utf8"));
    expect(
      committed,
      `${COMMITTED_WORKFLOW} diverged from ${WORKFLOW_TEMPLATE} beyond the action refs — ` +
        `the drift gate runs the COMMITTED copy, so edit the template and regenerate ` +
        "(never hand-divide the two)",
    ).toBe(template);
  });

  it("both copies pick the branch-aware generator, in both steps, the same way", () => {
    // Same predicate, same fallback, both steps, both copies — the invariant the
    // byte comparison above implies, asserted directly so a regression names the
    // step and the file instead of printing two workflows.
    const predicate = `grep -q '"name":[[:space:]]*"arggon-manager"' package.json`;
    for (const file of [WORKFLOW_TEMPLATE, COMMITTED_WORKFLOW]) {
      const steps = workflowRunSteps(readFileSync(file, "utf8"));
      const drift = steps.get(DRIFT_STEP)!;
      for (const name of [BOOTSTRAP_STEP, DRIFT_STEP]) {
        const body = steps.get(name)!;
        expect(body, `${file}: step '${name}' lost the branch-local generator`).toContain(
          predicate,
        );
        expect(body, `${file}: step '${name}' must keep the pinned-release fallback`).toContain(
          "arggon init --no-commit",
        );
      }
      expect(drift, `${file}: drift step must regenerate with the checkout's own build`).toContain(
        "node dist/cli.js init --no-commit",
      );
      // The pinned-lag assertion owns the lag case: it has to precede the diff it
      // would otherwise be reported as — and both clauses must be PRESENT, which
      // the bare `indexOf` comparison it replaces could not say.
      assertOrder(drift, "lags the committed arggon seam", "git status --porcelain");
    }
  });
});

const describePacked = describe.skipIf(process.platform === "win32");

describePacked("headless bootstrap + CI (packed install)", () => {
  /** Empty temp root the install step runs against. */
  let runnerTemp = "";
  /** Temp npm prefix the step's `npm install -g` is redirected into. */
  let prefix = "";
  let bin = "";
  /** Version of the packed bin — the `ARGGON_VERSION` the recipe runs under. */
  let binVersion = "";
  /** Adopter-shaped fixture (git repo without a tracker). */
  let fixture = "";
  /** The shipped workflow's step bodies, by name. */
  let steps = new Map<string, string>();

  function git(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync("git", args, { cwd, encoding: "utf8" });
  }

  beforeAll(() => {
    // 1. The shipped recipe, parsed once (step names are asserted, so a
    //    restructure fails loudly).
    steps = workflowRunSteps(readFileSync(WORKFLOW_TEMPLATE, "utf8"));
    for (const name of [
      INSTALL_STEP,
      BOOTSTRAP_STEP,
      DRIFT_STEP,
      VALIDATE_STEP,
      DIAGNOSTICS_STEP,
    ]) {
      expect(steps.has(name), `workflow step '${name}' missing`).toBe(true);
    }

    // 2. Pack BOTH working-tree packages and install them together — the
    //    documented checkout-pinned variant (see the header note): the tested
    //    bin is the tree under test, and the build must exist first (`npm run
    //    build`; the CI job builds before testing).
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
    };
    const libPkg = JSON.parse(readFileSync(join(root, "lib", "package.json"), "utf8")) as {
      version: string;
    };
    expect(existsSync(join(root, "dist", "cli.js")), "run `npm run build` first").toBe(true);
    expect(existsSync(join(root, "lib", "dist", "index.js")), "run `npm run build` first").toBe(
      true,
    );
    runnerTemp = mkdtemp("arggon-headless-runner-");
    prefix = mkdtemp("arggon-headless-prefix-");
    const packsDir = join(runnerTemp, "packs");
    mkdirSync(packsDir, { recursive: true });
    for (const cwd of [join(root, "lib"), root]) {
      // bug-cli-spawn-suites-exit-1-flake: `--ignore-scripts` is load-bearing,
      // not a speed-up. `npm pack` in the repo ROOT runs the `prepare`
      // lifecycle (`npm run build`), and this loop runs with vitest's other
      // forks live: four `tsc` passes then rewrite every file of `lib/dist` and
      // `dist` IN PLACE (tsc does not skip byte-identical output, so each file
      // is `open(O_TRUNC)` + write), for ~1s of wall clock. Every other lane's
      // spawned child ESM-loads those exact files — the CLI's own sources are
      // transpiled in memory, but `@arggondev/lib` resolves to `lib/dist` — so
      // a child linking the graph inside that window reads a half-written
      // module and dies in Node's loader before the CLI ever runs. That was
      // three CI flakes that all printed a bare `expected 1 to be +0` (PR #571
      // run 36960202458 `handoff --session`, PR #576 `adopt --ack`, PR #573 run
      // 36966932103 `arggon init`); a measured full-suite run rewrites 141
      // artifact files across two such windows. The bytes under test must be
      // the ones `npm run build` already produced (the assertions above are
      // the build-before-test precondition), so skipping the rebuild is exactly
      // what this gate means: pack the built tree, never rebuild it under the
      // suite. `pack-contents.test.ts` does build on purpose — but in a fresh
      // clone copy that owns its own `lib/`: same repo, opposite discipline.
      const packed = spawnSync(
        "npm",
        ["pack", "--ignore-scripts", "--pack-destination", packsDir],
        { cwd, encoding: "utf8" },
      );
      expect(packed.status, `${packed.stdout}\n${packed.stderr}`).toBe(0);
    }
    const rootTarball = join(packsDir, `arggon-manager-${pkg.version}.tgz`);
    const libTarball = join(packsDir, `arggondev-lib-${libPkg.version}.tgz`);
    expect(existsSync(rootTarball)).toBe(true);
    expect(existsSync(libTarball)).toBe(true);
    // `npm run test` exports the lifecycle NPM_CONFIG_* env (the uppercase
    // variants outrank the lowercase ones in npm's config resolution), so
    // inherit nothing npm-related — the install config comes only from the
    // explicit vars below.
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key) && key !== "PREFIX"),
    );
    const install = spawnSync(
      "npm",
      ["install", "-g", libTarball, rootTarball, "--no-audit", "--no-fund"],
      { cwd: runnerTemp, encoding: "utf8", env: { ...inherited, npm_config_prefix: prefix } },
    );
    expect(install.status, `${install.stdout}\n${install.stderr}`).toBe(0);
    // The globally-installed bin (redirected into the temp prefix) resolves
    // at the pinned version.
    bin = join(prefix, "bin", "arggon");
    expect(existsSync(bin)).toBe(true);
    const version = spawnSync(bin, ["--version"], { encoding: "utf8" });
    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toContain(pkg.version);
    binVersion = pkg.version;

    // 4. Adopter-shaped fixture: a small git repo with no tracker at all.
    fixture = mkdtemp("arggon-headless-fixture-");
    writeFileSync(
      join(fixture, "package.json"),
      `${JSON.stringify({ name: "adopter-demo", version: "0.1.0", private: true }, null, 2)}\n`,
    );
    writeFileSync(join(fixture, "README.md"), "# Adopter demo\n");
    writeFileSync(join(fixture, ".gitignore"), "node_modules/\n");
    mkdirSync(join(fixture, "src"));
    writeFileSync(join(fixture, "src/index.js"), "export const x = 1;\n");
    initFixtureRepo(fixture);
    const first = git(["add", "--", "."], fixture);
    expect(first.status, first.stderr).toBe(0);
    const commit = git(["commit", "-m", "initial"], fixture);
    expect(commit.status, commit.stderr).toBe(0);
  }, 900_000);

  /** Run one workflow step body the way the runner does (`bash -e`). */
  function runStep(
    name: string,
    cwd: string,
    extraEnv: Record<string, string> = {},
  ): SpawnSyncReturns<string> {
    const body = steps.get(name);
    expect(body, `workflow step '${name}' missing`).toBeDefined();
    const path = bin === "" ? process.env.PATH : `${dirname(bin)}:${process.env.PATH ?? ""}`;
    return spawnSync("bash", ["-e", "-c", body!], {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
      // `ARGGON_VERSION` is the recipe's own `env:` block; the drift step's
      // pinned-lag assertion reads it, so the fixture supplies the pin the
      // runner would (the packed bin's version — what the seam's stamps record).
      env: { ...process.env, PATH: path, ARGGON_VERSION: binVersion, ...extraEnv },
    });
  }

  /** Run the checkout CLI (tsx loader, see bug-row-table-flake) with the same argv. */
  function runCheckoutCli(args: string[], cwd: string): SpawnSyncReturns<string> {
    return runCli(args, cwd, { timeout: 120_000 });
  }

  /** Run the packed bin with the same argv. */
  function runPacked(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync(bin, args, { cwd, encoding: "utf8", timeout: 120_000 });
  }

  it("installs the headless bin from the two packed tarballs", () => {
    const version = runPacked(["--version"], fixture);
    expect(version.status, version.stderr).toBe(0);
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
    expect(version.stdout.trim().startsWith(pkg.version)).toBe(true);
    // `hello` is the cheapest end-to-end proof that the bin's kernel resolves.
    const hello = runPacked(["--json", "hello"], fixture);
    expect(hello.status, hello.stderr).toBe(0);
    expect(JSON.parse(hello.stdout)).toMatchObject({ ok: true, command: "hello" });
  });

  it("ships the recipe in the tarball and documents it (no model, no MCP)", () => {
    // task-ci-recipe-published-one-liner: the shipped install step is the
    // registry pin — no GitHub clone, no packing — and the pin travels in the
    // workflow's env. The pin is what an adopter compares against (its only
    // generator) and what the pinned-lag assertion polices; a repo that IS the
    // seam's source compares against its own build instead.
    const install = steps.get(INSTALL_STEP)!;
    expect(install).toContain('npm install -g "arggon-manager@$ARGGON_VERSION"');
    expect(install, "install step must not clone the repo").not.toContain("git clone");
    const workflow = readFileSync(WORKFLOW_TEMPLATE, "utf8");
    expect(workflow).toContain("ARGGON_VERSION:");
    expect(workflow).not.toContain("ARGGON_REF");
    expect(workflow).not.toContain("ARGGON_REPO");
    // The gate is branch-aware (bug-seam-drift-gate-blocks-new-generated-seam-content):
    // both the bootstrap and the drift step pick the checkout's own build when
    // the checkout IS the seam's source, and the pinned release otherwise. A
    // step cannot hand an env var to the next one without GITHUB_ENV (which
    // ci-seam-pin.test.ts forbids), so both carry the same predicate — assert
    // they agree, and that the lag assertion runs BEFORE the diff it would
    // otherwise be reported as.
    const bootstrap = steps.get(BOOTSTRAP_STEP)!;
    const drift = steps.get(DRIFT_STEP)!;
    const selfHosted = `grep -q '"name":[[:space:]]*"arggon-manager"' package.json`;
    for (const [name, body] of [
      [BOOTSTRAP_STEP, bootstrap],
      [DRIFT_STEP, drift],
    ] as const) {
      expect(body, `step '${name}' lost the branch-local seam generator`).toContain(selfHosted);
      expect(body, `step '${name}' must still fall back to the pinned release`).toContain(
        "arggon init --no-commit",
      );
    }
    expect(bootstrap).toContain("npm ci --ignore-scripts");
    expect(bootstrap).toContain("npm run build");
    expect(bootstrap).toContain("node dist/cli.js init --no-commit");
    expect(drift).toContain("node dist/cli.js init --no-commit");
    assertOrder(drift, "lags the committed arggon seam", "git status --porcelain");
    // The recipe is an init-vendored artifact: it must ship in the tarball
    // (the installed package is what `init` reads its templates from).
    const recipe = "templates/docs/github/workflows/arggon.yml";
    expect(existsSync(join(prefix, "lib/node_modules/arggon-manager", recipe))).toBe(true);
    // No executed step may reference a model, OpenCode or MCP.
    for (const [name, body] of steps) {
      expect(body, `step '${name}' mentions MCP/OpenCode/a model`).not.toMatch(
        /mcp|opencode|model/i,
      );
    }
    // The recipe is documented: ci.md carries the released pin AND the
    // pinned-checkout dev variant (pack + mkdir, B1's ENOENT knowledge), plus
    // the branch-aware gate and its two-direction probe.
    const doc = readFileSync(CI_DOC, "utf8");
    expect(doc).toContain('npm install -g "arggon-manager@$ARGGON_VERSION"');
    expect(doc).toContain("npm pack --workspace lib");
    expect(doc).toContain("mkdir -p /tmp/arggon-packs");
    expect(doc).toMatch(/no model, no MCP/i);
    expect(doc).toContain("headless-ci.test.ts");
    expect(doc).toContain("Reproduce the drift gate both ways");
    expect(doc).toContain("lags the committed arggon seam");
    // `arggon instructions` prints this snippet. Since 0.4.0 both packages are
    // published, so the agents.md CI-gate snippet is the released one-liner;
    // the pinned-checkout tarball variant (mkdir included) stays in ci.md and
    // README, asserted above (bug-docs-retired-opencode2-split).
    expect(readFileSync(join(root, "ArggonManager/docs/agents.md"), "utf8")).toContain(
      "npm install -g arggon-manager",
    );
    expect(readFileSync(join(root, "README.md"), "utf8")).toContain("mkdir -p /tmp/arggon-packs");
  });

  // bug-spawn-lanes-load-flake: the three phases below SHARE one fixture and
  // are strictly order-dependent (bootstrap writes the generated seam; the
  // drift gate commits it and proves staleness fails; the MCP phase removes
  // the seam artifacts and asserts validate/doctor hold). Vitest 5.0.0 has
  // no sequential/ordering API and `--sequence.shuffle` shuffles `it`s, so
  // the phases are ONE atomic test: shuffling cannot break the lifecycle.
  it("runs the shipped recipe end-to-end: bootstrap -> drift gate -> seam removal", () => {
    const bootstrap = runStep(BOOTSTRAP_STEP, fixture);
    expect(bootstrap.status, `${bootstrap.stdout}\n${bootstrap.stderr}`).toBe(0);
    // Fresh repo: the drift gate has nothing committed to compare yet and
    // must no-op (the recipe is green on a first clone).
    const freshDrift = runStep(DRIFT_STEP, fixture);
    expect(freshDrift.status, freshDrift.stderr).toBe(0);
    expect(freshDrift.stdout).toContain("no committed arggon seam yet");
    // init created the tracker and vendored the very workflow it came from.
    expect(existsSync(join(fixture, "ArggonManager/.convention.yml"))).toBe(true);
    const vendored = readFileSync(join(fixture, WORKFLOW_DEST), "utf8");
    expect(vendored.startsWith(`${WORKFLOW_MARKER}\n`)).toBe(true);
    expect(vendored).toBe(`${WORKFLOW_MARKER}\n${readFileSync(WORKFLOW_TEMPLATE, "utf8")}`);

    const validate = runStep(VALIDATE_STEP, fixture);
    expect(validate.status, validate.stderr).toBe(0);
    expect(JSON.parse(validate.stdout)).toMatchObject({
      ok: true,
      command: "validate",
      conventionVersion: CONVENTION_VERSION,
      errors: [],
      warnings: [],
    });

    const diagnostics = runStep(DIAGNOSTICS_STEP, fixture);
    expect(diagnostics.status, diagnostics.stderr).toBe(0);
    const envelopes = diagnostics.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { command: string; ok: boolean });
    expect(envelopes.map((e) => [e.command, e.ok])).toEqual([
      ["doctor", true],
      ["list", true],
    ]);
    // --- phase 2: drift gate (commit the seam; stale generated file must fail) ---
    // The fixture is a throwaway adopter repo: `-- .` is the adopter's commit.
    const add = git(["add", "--", "."], fixture);
    expect(add.status, add.stderr).toBe(0);
    const commit = git(["commit", "-m", "chore: arggon init"], fixture);
    expect(commit.status, commit.stderr).toBe(0);
    expect(git(["status", "--porcelain"], fixture).stdout.trim()).toBe("");

    // Committed + current: bootstrap is a no-op and the gate passes (the state
    // file's generatedAt refresh is the one documented exception).
    const bootstrapNoop = runStep(BOOTSTRAP_STEP, fixture);
    expect(bootstrapNoop.status, `${bootstrapNoop.stdout}\n${bootstrapNoop.stderr}`).toBe(0);
    const drift = runStep(DRIFT_STEP, fixture);
    expect(drift.status, `${drift.stdout}\n${drift.stderr}`).toBe(0);

    // Mutation: a generated file changed behind the pinned ref must fail the
    // gate instead of silently passing.
    const agents = join(fixture, "AGENTS.md");
    writeFileSync(agents, `${readFileSync(agents, "utf8")}\nstale edit\n`);
    const stale = runStep(DRIFT_STEP, fixture);
    expect(stale.status).not.toBe(0);
    expect(stale.stdout).toContain("AGENTS.md");
    const restore = git(["checkout", "--", "AGENTS.md"], fixture);
    expect(restore.status, restore.stderr).toBe(0);
    expect(runStep(DRIFT_STEP, fixture).status).toBe(0);

    // The runner's own file is excluded from the comparison (bootstrap runner:
    // its template change only reaches the pinned ref after merge, so gating it
    // would fail every trigger/template edit's own PR); a local edit there must
    // not fire the gate. Its step bodies are exercised verbatim above.
    const workflowPath = join(fixture, WORKFLOW_DEST);
    writeFileSync(workflowPath, `${readFileSync(workflowPath, "utf8")}\n# local trigger edit\n`);
    expect(runStep(DRIFT_STEP, fixture).status).toBe(0);
    const restoreWorkflow = git(["checkout", "--", WORKFLOW_DEST], fixture);
    expect(restoreWorkflow.status, restoreWorkflow.stderr).toBe(0);

    // N3 hardening: the gate activates on any committed provenance marker, not
    // on the state file alone — untrack the state file and it must still fire.
    const untrack = git(["rm", "--cached", "ArggonManager/.convention.yml"], fixture);
    expect(untrack.status, untrack.stderr).toBe(0);
    const commit2 = git(["commit", "-m", "untrack state file"], fixture);
    expect(commit2.status, commit2.stderr).toBe(0);
    writeFileSync(agents, `${readFileSync(agents, "utf8")}\nstale edit 2\n`);
    expect(runStep(DRIFT_STEP, fixture).status).not.toBe(0);
    const restore2 = git(["checkout", "--", "AGENTS.md"], fixture);
    expect(restore2.status, restore2.stderr).toBe(0);
    expect(runStep(DRIFT_STEP, fixture).status).toBe(0);

    const validateDrift = runStep(VALIDATE_STEP, fixture);
    expect(validateDrift.status, validateDrift.stderr).toBe(0);
    // --- phase 3: seam artifacts removed; validate/doctor must still hold ---
    rmSync(join(fixture, ".mcp.json"), { force: true });
    rmSync(join(fixture, "opencode.jsonc"), { force: true });
    rmSync(join(fixture, ".opencode"), { recursive: true, force: true });
    rmSync(join(fixture, ".agents"), { recursive: true, force: true });
    const validateNoSeam = runStep(VALIDATE_STEP, fixture);
    expect(validateNoSeam.status, validateNoSeam.stderr).toBe(0);
    const doctor = runPacked(["doctor", "--json"], fixture);
    expect(doctor.status, doctor.stderr).toBe(0);
    const envelope = JSON.parse(doctor.stdout) as {
      ok: boolean;
      initialized: boolean;
      opencode: { artifacts: { config: boolean }; mcp: { native: boolean; mcpJson: boolean } };
    };
    expect(envelope).toMatchObject({
      ok: true,
      initialized: true,
      opencode: { artifacts: { config: false }, mcp: { native: false, mcpJson: false } },
    });
  });

  /**
   * Stand-in for the seam's own generator (`npm run build` → `dist/cli.js`).
   * The fixture cannot build the real bin — it holds no arggon source, and
   * building one is not the thing under test — so it stands in with `init`'s
   * provenance contract for seam bytes, which is what the gate's red/green
   * actually turns on:
   *
   *   - destination missing, or its recorded `x-generated` checksum matching
   *     disk → write the template's bytes (this is how a moved template shows
   *     up as a dirty tree, and how the pinned install rewrites a seam that
   *     postdates it — the #605 mechanism);
   *   - checksum NOT matching disk → leave it alone (`modified[]`, protected).
   *
   * The recognizable stdout line is how the test proves the BRANCH's generator
   * ran and not the pinned release's; the real branch-local round trip (real
   * templates, real build) is the documented probe in ArggonManager/docs/ci.md
   * ("Reproduce the drift gate both ways").
   */
  const BRANCH_GENERATOR_STUB = `#!/usr/bin/env node
const { createHash } = require("node:crypto");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const checksumOf = (content) =>
  \`sha256:\${createHash("sha256").update(content).digest("hex")}\`;
const statePath = join(root, "ArggonManager/.convention.yml");
const state = readFileSync(statePath, "utf8").split("\\n");
const entryStart = (dest) => state.indexOf(\`  \${dest}:\`);
const fieldLines = (dest) => {
  const start = entryStart(dest);
  const out = [];
  for (let i = start + 1; i < state.length && /^ {4}\\S/.test(state[i]); i++) out.push(i);
  return out;
};
const recorded = (dest) => {
  for (const i of fieldLines(dest)) {
    const hit = /^ {4}checksum: "([^"]+)"/.exec(state[i]);
    if (hit) return hit[1];
  }
  return undefined;
};
const manifest = JSON.parse(readFileSync(join(root, "seam-manifest.json"), "utf8"));
let wrote = false;
for (const { template, dest } of manifest) {
  const abs = join(root, dest);
  const render = readFileSync(join(root, template));
  const untouched = existsSync(abs) && recorded(dest) === checksumOf(readFileSync(abs));
  if (!existsSync(abs) || untouched) {
    writeFileSync(abs, render);
    // init refreshes the recorded provenance for everything it wrote.
    for (const i of fieldLines(dest)) {
      if (/^ {4}checksum: /.test(state[i])) {
        state[i] = \`    checksum: "\${checksumOf(render)}"\`;
        break;
      }
    }
    wrote = true;
  } else {
    process.stdout.write(\`adopter-modified (kept): \${dest}\\n\`);
  }
}
if (wrote) writeFileSync(statePath, state.join("\\n"));
process.stdout.write("fixture branch generator: init --no-commit\\n");
`;

  /**
   * A committed seam whose bytes the RELEASED generator does not produce —
   * #605's exact shape (a feature PR adds generated content, the pin's init
   * would rewrite the manifest back). Built from the repo's own committed
   * `.mcp.json` (byte-identical to what `arggon-manager@<pin>` renders) plus
   * one extra server entry.
   */
  function seamNewerThanPin(): string {
    const seam = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    seam.mcpServers["arggon-goal"] = { command: "arggon", args: ["mcp", "--goal"] };
    return `${JSON.stringify(seam, null, 2)}\n`;
  }

  /**
   * Git fixture holding that seam, shaped either as the seam's own source
   * (selfHosted: the arggon package name + the CLI entry point + a built bin)
   * or as an adopter repo (anything else — the pinned release is its only
   * generator). `pkgVersion`/`stamp` override the two version inputs the
   * pinned-lag assertion compares, so a fixture can reproduce a specific
   * (pin, package.json, stamps) triple.
   */
  function seedSeam(
    dir: string,
    selfHosted: boolean,
    opts: { pkgVersion?: string; stamp?: string } = {},
  ): void {
    const name = selfHosted ? "arggon-manager" : "adopter-demo";
    writeFileSync(
      join(dir, "package.json"),
      `${JSON.stringify({ name, version: opts.pkgVersion ?? "0.1.0", private: true }, null, 2)}\n`,
    );
    const seam = seamNewerThanPin();
    if (selfHosted) {
      mkdirSync(join(dir, "cli", "src"), { recursive: true });
      writeFileSync(join(dir, "cli", "src", "cli.ts"), "export {};\n");
      mkdirSync(join(dir, "dist"), { recursive: true });
      writeFileSync(join(dir, "dist", "cli.js"), BRANCH_GENERATOR_STUB);
      mkdirSync(join(dir, "tpl"), { recursive: true });
      writeFileSync(join(dir, "tpl", "mcp-json"), seam);
      writeFileSync(
        join(dir, "seam-manifest.json"),
        `${JSON.stringify([{ template: "tpl/mcp-json", dest: ".mcp.json" }], null, 2)}\n`,
      );
    }
    // Committed provenance marker (the drift gate's activation key) + the
    // generated state file whose `arggonVersion` stamps the pinned-lag
    // assertion reads.
    writeFileSync(join(dir, "AGENTS.md"), `${AGENTS_MARKER}\n# adopter repo\n`);
    mkdirSync(join(dir, "ArggonManager"), { recursive: true });
    writeFileSync(
      join(dir, "ArggonManager", ".convention.yml"),
      stateFile(opts.stamp ?? binVersion, seam),
    );
    writeFileSync(join(dir, ".mcp.json"), seam);
    initFixtureRepo(dir);
    expect(git(["add", "--", "."], dir).status).toBe(0);
    expect(git(["commit", "-m", "seam"], dir).status).toBe(0);
    expect(git(["status", "--porcelain"], dir).stdout.trim()).toBe("");
  }

  /**
   * Generated state file recording the seam's OWN bytes at the given stamp.
   * `checksumOf` is what `arggon init` writes, and the matching checksum is
   * load bearing: `init` REGENERATES a destination whose recorded checksum
   * matches disk, so the pinned install rewrites this fixture's `.mcp.json`
   * back to the release's bytes instead of protecting it as
   * adopter-modified. That is the whole #605 mechanism, faithfully
   * reproduced — the committed seam postdates the pin while the state file
   * still records the bytes as last generated.
   */
  function stateFile(stamp: string, seam: string): string {
    const entry = (dest: string, template: string, content: string): string =>
      [
        `  ${dest}:`,
        `    template: "${template}"`,
        `    checksum: "${checksumOf(content)}"`,
        `    arggonVersion: "${stamp}"`,
        '    generatedAt: "2026-01-01T00:00:00.000Z"',
      ].join("\n");
    return [
      "version: 5",
      "x-generated:",
      '  projectName: "seam-demo"',
      entry("AGENTS.md", "docs/AGENTS.md", `${AGENTS_MARKER}\n# adopter repo\n`),
      entry(".mcp.json", "docs/mcp-json", seam),
      "",
    ].join("\n");
  }

  it("drift gate compares against the checkout's own generator, not the pin (bug-seam-drift-gate-blocks-new-generated-seam-content)", () => {
    // The pin under test is the packed install's own version: an empty
    // `binVersion` would make the assertions below pass vacuously (the drift
    // step reads `$ARGGON_VERSION` from its env).
    expect(existsSync(bin), "the packed install must run before this test").toBe(true);
    expect(binVersion, "the packed bin's version is the fixture's ARGGON_VERSION").toMatch(
      /^\d+\.\d+\.\d+$/,
    );
    // Direction 1 (the #605 bug): the committed seam POSTDATES the pinned
    // release. The pinned path still reddens — that is the reported failure,
    // now with a message naming the generator that disagrees — while the
    // branch-local path the gate now prefers is GREEN: a feature PR that adds
    // generated content can satisfy it.
    const adopter = mkdtemp("arggon-headless-pinned-");
    seedSeam(adopter, false);
    const pinned = runStep(DRIFT_STEP, adopter);
    expect(pinned.status, `${pinned.stdout}\n${pinned.stderr}`).not.toBe(0);
    expect(pinned.stdout).toContain(".mcp.json");
    expect(pinned.stdout).toContain(`arggon-manager@${binVersion}`);
    // The remedy the message prescribes must be the one that can work for the
    // direction it found.
    expect(pinned.stdout).toContain(`re-run 'arggon init' with arggon-manager@${binVersion}`);

    const branch = mkdtemp("arggon-headless-branch-");
    seedSeam(branch, true);
    const branchGate = runStep(DRIFT_STEP, branch);
    expect(branchGate.status, `${branchGate.stdout}\n${branchGate.stderr}`).toBe(0);
    // Proof the branch's generator ran (not the pinned release's).
    expect(branchGate.stdout).toContain("fixture branch generator: init --no-commit");

    // Direction 2a (what the gate is FOR): the branch's TEMPLATE moved and the
    // committed seam was not regenerated. The branch generator rewrites the
    // destination, the tree goes dirty, and the message names the generator
    // that disagrees plus a remedy that works for this direction.
    const tplPath = join(branch, "tpl", "mcp-json");
    writeFileSync(tplPath, `${readFileSync(tplPath, "utf8")}// template moved\n`);
    const stale = runStep(DRIFT_STEP, branch);
    expect(stale.status, `${stale.stdout}\n${stale.stderr}`).not.toBe(0);
    expect(stale.stdout).toContain(".mcp.json");
    expect(stale.stdout).toContain("this checkout's own build");
    expect(stale.stdout).toContain("node dist/cli.js init");
    // Committing the regenerated seam — the whole loop for a feature PR — is
    // green again (and green from then on).
    expect(git(["add", "--", "."], branch).status).toBe(0);
    expect(git(["commit", "-m", "regenerated seam"], branch).status).toBe(0);
    expect(runStep(DRIFT_STEP, branch).status).toBe(0);
    // Reverting the template change reverts the regenerated seam with it.
    expect(git(["reset", "--hard", "HEAD~1"], branch).status).toBe(0);
    expect(runStep(DRIFT_STEP, branch).status).toBe(0);

    // Direction 2b: a hand edit of a generated file. `init` protects those
    // (its recorded checksum no longer matches), so the bytes stay put and the
    // gate still reports the disagreement — the adopter-side behaviour, now
    // asserted on the branch-local path too.
    const seamPath = join(branch, ".mcp.json");
    writeFileSync(seamPath, `${readFileSync(seamPath, "utf8")}stale edit\n`);
    const handEdited = runStep(DRIFT_STEP, branch);
    expect(handEdited.status, `${handEdited.stdout}\n${handEdited.stderr}`).not.toBe(0);
    expect(handEdited.stdout).toContain("adopter-modified (kept): .mcp.json");
    expect(handEdited.stdout).toContain(".mcp.json");
    expect(git(["checkout", "--", ".mcp.json"], branch).status).toBe(0);
    expect(runStep(DRIFT_STEP, branch).status).toBe(0);

    // Direction 3 (the protection the branch-local comparison gives up): the
    // pin may never sit BEHIND the seam it must reproduce — a committed stamp
    // newer than ARGGON_VERSION means the pinned init rewrites committed
    // content (#527). The message must name the lag and the bump remedy, never
    // "re-run init" (that is what deletes the newer content).
    const statePath = join(branch, "ArggonManager", ".convention.yml");
    writeFileSync(statePath, stateFile("99.0.0", seamNewerThanPin()));
    expect(git(["add", "--", "ArggonManager/.convention.yml"], branch).status).toBe(0);
    expect(git(["commit", "-m", "stale stamp"], branch).status).toBe(0);
    const lag = runStep(DRIFT_STEP, branch);
    expect(lag.status, `${lag.stdout}\n${lag.stderr}`).not.toBe(0);
    expect(lag.stdout).toContain(
      `ARGGON_VERSION (${binVersion}) lags the committed arggon seam (99.0.0)`,
    );
    expect(lag.stdout).toContain("bump ARGGON_VERSION to 99.0.0");
    expect(lag.stdout).not.toContain("re-run 'arggon init'");
    // Restored: the assertion is on the COMMITTED stamps, so it keeps firing
    // for the commit, not just for a dirty working tree.
    writeFileSync(statePath, stateFile(binVersion, seamNewerThanPin()));
    expect(git(["commit", "-am", "re-pin"], branch).status).toBe(0);
    expect(runStep(DRIFT_STEP, branch).status).toBe(0);

    // Direction 3b — the one input where the shipped clause and the repo-side
    // `pinLagsSeam()` used to disagree (bug-ci-seam-pin-shell-vs-test-copy-divergence):
    // the SAME lag, on a repo whose `package.json` version EQUALS the pin. That is
    // this repo's mid-cycle shape and, for any adopter, the shape their version
    // lands in whenever it coincides with the pin literal. The clause still fires
    // — it never reads `package.json` — and that is precisely why the TS
    // predicate's old `pin !== package.json` conjunct could NOT be pasted into the
    // shell copy to "close the gap": pasted in, this repo would go green while the
    // pinned init rewrites committed content, i.e. #527 with the gate off.
    // `cli/src/ci-seam-pin.test.ts` asserts the TS predicate agrees on this exact
    // triple by EXECUTING the clause this step runs.
    const coincident = mkdtemp("arggon-headless-coincident-");
    seedSeam(coincident, true, { pkgVersion: binVersion, stamp: "99.0.0" });
    const coincidentLag = runStep(DRIFT_STEP, coincident);
    expect(coincidentLag.status, `${coincidentLag.stdout}\n${coincidentLag.stderr}`).not.toBe(0);
    expect(coincidentLag.stdout).toContain(
      `ARGGON_VERSION (${binVersion}) lags the committed arggon seam (99.0.0)`,
    );
    expect(coincidentLag.stdout).toContain("bump ARGGON_VERSION to 99.0.0");

    // A missing build is an error, never a silent fall back to the pinned
    // release — that fall back IS the bug (it strips the branch's own content
    // and then blames the seam for it).
    rmSync(join(branch, "dist", "cli.js"));
    const unbuilt = runStep(DRIFT_STEP, branch);
    expect(unbuilt.status, `${unbuilt.stdout}\n${unbuilt.stderr}`).not.toBe(0);
    expect(unbuilt.stdout).toContain("dist/cli.js is missing");
    expect(unbuilt.stdout).toContain("npm ci && npm run build");
  });

  it("packed-bin --json envelopes are byte-identical to the checkout CLI", () => {
    // `init` parity needs twins (it writes); same basename so the rendered
    // `{{PROJECT_NAME}}` matches and only the volatile bytes differ.
    const twinA = join(mkdtemp("arggon-headless-twin-a-"), "adopter");
    const twinB = join(mkdtemp("arggon-headless-twin-b-"), "adopter");
    mkdirSync(twinA);
    mkdirSync(twinB);
    const initA = runPacked(["--json", "init", "--no-commit"], twinA);
    const initB = runCheckoutCli(["--json", "init", "--no-commit"], twinB);
    expect(initA.status, initA.stderr).toBe(initB.status);
    expect(normalize(initA.stdout, twinA)).toBe(normalize(initB.stdout, twinB));
    expect(snapshot(twinB)).toEqual(snapshot(twinA));

    // Default `init` (auto-commit) parity: git twins, so the envelope carries
    // the real `commit` payload (the hash is volatile, hence normalized).
    const gitTwinA = join(mkdtemp("arggon-headless-git-twin-a-"), "adopter");
    const gitTwinB = join(mkdtemp("arggon-headless-git-twin-b-"), "adopter");
    for (const twin of [gitTwinA, gitTwinB]) {
      mkdirSync(twin);
      writeFileSync(join(twin, "README.md"), "# Adopter demo\n");
      initFixtureRepo(twin);
      const add = git(["add", "--", "."], twin);
      expect(add.status, add.stderr).toBe(0);
      const commit = git(["commit", "-m", "initial"], twin);
      expect(commit.status, commit.stderr).toBe(0);
    }
    const commitA = runPacked(["--json", "init"], gitTwinA);
    const commitB = runCheckoutCli(["--json", "init"], gitTwinB);
    expect(commitA.status, commitA.stderr).toBe(commitB.status);
    expect(normalize(commitA.stdout, gitTwinA)).toBe(normalize(commitB.stdout, gitTwinB));
    expect(snapshot(gitTwinB)).toEqual(snapshot(gitTwinA));
    // A real commit happened on both sides (the payload's hash, not a skip).
    expect(JSON.parse(commitA.stdout).commit.hash).toMatch(/^[0-9a-f]{7,40}$/);

    // Reads run on the same tree (twinA, initialized by the packed bin): any
    // difference is an envelope difference, not a fixture difference.
    const seed = (type: string, title: string, extra: string[]) => {
      const proc = runPacked(["--json", "create", type, title, ...extra], twinA);
      expect(proc.status, proc.stderr).toBe(0);
    };
    seed("initiative", "Launch MVP", []);
    seed("epic", "Auth", ["--parent", "launch-mvp"]);
    seed("story", "Login", ["--parent", "auth", "--id", "story-login"]);
    seed("task", "Add rate limiting", ["--parent", "story-login", "--id", "rate-limit"]);

    for (const args of [
      ["validate"],
      ["doctor"],
      ["list"],
      ["list", "--full"],
      ["show", "task-rate-limit"],
      ["show", "task-rate-limit", "--body"],
      ["next"],
      ["report"],
    ]) {
      const packed = runPacked(["--json", ...args!], twinA);
      const checkout = runCheckoutCli(["--json", ...args!], twinA);
      expect(packed.status, `arggon ${args!.join(" ")}: ${packed.stderr}`).toBe(checkout.status);
      expect(packed.stdout, `arggon ${args!.join(" ")} shifted`).toBe(checkout.stdout);
    }
  });
});
