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
import { initFixtureRepo, removeFixtureTree } from "./test-tmp.js";
import { runCli } from "./test-spawn.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKFLOW_TEMPLATE = join(root, "templates/docs/github/workflows/arggon.yml");
const WORKFLOW_DEST = ".github/workflows/arggon.yml";
const WORKFLOW_MARKER = `# arggon:generated template="github/workflows/arggon.yml"`;
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

// The packed-install describe shares ONE fixture across its tests (bootstrap
// -> drift gate -> MCP-removal are ORDER-DEPENDENT: each step builds on the
// previous one's side effects), so it must run sequentially even under
// `--sequence.shuffle` (bug-spawn-lanes-load-flake: shuffled order produced
// "nothing to commit" / validate failures that looked like load flakes).
const describePacked =
  process.platform === "win32" ? describe.skip : describe.sequential;

describePacked("headless bootstrap + CI (packed install)", () => {
  /** Empty temp root the install step runs against. */
  let runnerTemp = "";
  /** Temp npm prefix the step's `npm install -g` is redirected into. */
  let prefix = "";
  let bin = "";
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
      const packed = spawnSync("npm", ["pack", "--pack-destination", packsDir], {
        cwd,
        encoding: "utf8",
      });
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
      env: { ...process.env, PATH: path, ...extraEnv },
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
    // workflow's env so the drift gate compares against a fixed release.
    const install = steps.get(INSTALL_STEP)!;
    expect(install).toContain('npm install -g "arggon-manager@$ARGGON_VERSION"');
    expect(install, "install step must not clone the repo").not.toContain("git clone");
    const workflow = readFileSync(WORKFLOW_TEMPLATE, "utf8");
    expect(workflow).toContain("ARGGON_VERSION:");
    expect(workflow).not.toContain("ARGGON_REF");
    expect(workflow).not.toContain("ARGGON_REPO");
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
    // pinned-checkout dev variant (pack + mkdir, B1's ENOENT knowledge).
    const doc = readFileSync(CI_DOC, "utf8");
    expect(doc).toContain('npm install -g "arggon-manager@$ARGGON_VERSION"');
    expect(doc).toContain("npm pack --workspace lib");
    expect(doc).toContain("mkdir -p /tmp/arggon-packs");
    expect(doc).toMatch(/no model, no MCP/i);
    expect(doc).toContain("headless-ci.test.ts");
    // `arggon instructions` prints this snippet. Since 0.4.0 both packages are
    // published, so the agents.md CI-gate snippet is the released one-liner;
    // the pinned-checkout tarball variant (mkdir included) stays in ci.md and
    // README, asserted above (bug-docs-retired-opencode2-split).
    expect(readFileSync(join(root, "ArggonManager/docs/agents.md"), "utf8")).toContain(
      "npm install -g arggon-manager",
    );
    expect(readFileSync(join(root, "README.md"), "utf8")).toContain("mkdir -p /tmp/arggon-packs");
  });

  it("runs the shipped recipe on the adopter fixture: fresh init -> validate/doctor/list green", () => {
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
  });

  it("drift gate: committed seam current passes, a stale generated file fails", () => {
    // The fixture is a throwaway adopter repo: `-- .` is the adopter's commit.
    const add = git(["add", "--", "."], fixture);
    expect(add.status, add.stderr).toBe(0);
    const commit = git(["commit", "-m", "chore: arggon init"], fixture);
    expect(commit.status, commit.stderr).toBe(0);
    expect(git(["status", "--porcelain"], fixture).stdout.trim()).toBe("");

    // Committed + current: bootstrap is a no-op and the gate passes (the state
    // file's generatedAt refresh is the one documented exception).
    const bootstrap = runStep(BOOTSTRAP_STEP, fixture);
    expect(bootstrap.status, `${bootstrap.stdout}\n${bootstrap.stderr}`).toBe(0);
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

    const validate = runStep(VALIDATE_STEP, fixture);
    expect(validate.status, validate.stderr).toBe(0);
  });

  it("needs no MCP and no OpenCode seam", () => {
    rmSync(join(fixture, ".mcp.json"), { force: true });
    rmSync(join(fixture, "opencode.jsonc"), { force: true });
    rmSync(join(fixture, ".opencode"), { recursive: true, force: true });
    rmSync(join(fixture, ".agents"), { recursive: true, force: true });
    const validate = runStep(VALIDATE_STEP, fixture);
    expect(validate.status, validate.stderr).toBe(0);
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
