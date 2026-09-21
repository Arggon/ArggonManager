/**
 * Headless bootstrap + CI adapter (W6 `task-native-headless-ci`).
 *
 * Acceptance, mapped to the tests below:
 *
 *   1. **fresh clone → `init` → CI green without a model** — the tarballs are
 *      packed from a fresh-clone copy (no pre-built `dist/`), installed into a
 *      temp prefix and the recipe extracted from the shipped workflow runs on
 *      an adopter-shaped fixture (git repo, no tracker) without any model.
 *   2. **`npm pack` install test** — the bin runs from the packed install and
 *      the `--json` envelopes are byte-identical to the checkout CLI (`init`,
 *      `validate`, `doctor`, `list`, `show`, `next`, `report`).
 *   3. **the CI recipe is documented and used by an adopter-shaped fixture** —
 *      the workflow `arggon init` vendors is the recipe executed here, step
 *      bodies verbatim; the doc lives in `ArggonManager/docs/ci.md`.
 *   4. **MCP is not required anywhere** — no executed step mentions it, and the
 *      recipe stays green with `.mcp.json` and the whole OpenCode seam deleted.
 *
 * Why both tarballs: `@arggon/lib` is `private` (no npm release yet), so the
 * root tarball alone cannot resolve its kernel dependency — `npm install -g
 * arggon-manager-<v>.tgz` fails with `404 @arggon/lib@^0.3.0`. The documented
 * mechanism (ArggonManager/docs/ci.md) packs both packages from a pinned
 * checkout and installs them in one command; this test does exactly that.
 *
 * The install step of the workflow clones the product repo over the network,
 * so the test replaces it with that same local pack+install (asserted to be
 * the same mechanism) and runs every other step body as-is. `bash` semantics
 * match the workflow runner (`bash -e`).
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
import { CONVENTION_VERSION } from "@arggon/lib";
import { freshCloneCopy, npm, parsePackResult, type PackResult } from "./pack-fixtures.js";
import { initFixtureRepo, removeFixtureTree } from "./test-tmp.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(root, "cli/src/cli.ts");
const tsx = join(root, "node_modules/tsx/dist/cli.mjs");
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

const describePacked = describe.skipIf(process.platform === "win32");

describePacked("headless bootstrap + CI (packed install)", () => {
  /** The packed tarballs and the prefix the bin was installed into. */
  let packs = "";
  let bin = "";
  let rootPack: PackResult;
  let libPack: PackResult;
  /** Adopter-shaped fixture (git repo without a tracker). */
  let fixture = "";
  /** The shipped workflow's step bodies, by name. */
  let steps = new Map<string, string>();

  function git(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync("git", args, { cwd, encoding: "utf8" });
  }

  beforeAll(() => {
    // 1. Fresh-clone copy (no dist/, no lib/dist/) -> `npm pack` runs `prepare`
    //    and builds both packages, exactly like an adopter's first install.
    const clone = mkdtemp("arggon-headless-clone-");
    freshCloneCopy(root, clone);
    expect(existsSync(join(clone, "dist"))).toBe(false);
    expect(existsSync(join(clone, "lib/dist"))).toBe(false);

    packs = mkdtemp("arggon-headless-packs-");
    // Root first: its `prepare` builds lib/dist + dist, so the kernel tarball
    // below is complete (lib has no prepare of its own).
    const rootPackRun = npm(["pack", "--json", "--pack-destination", packs], clone, 600_000);
    expect(rootPackRun.status, `${rootPackRun.stdout}\n${rootPackRun.stderr}`).toBe(0);
    rootPack = parsePackResult(rootPackRun.stdout);
    const libPackRun = npm(
      ["pack", "--json", "--workspace", "@arggon/lib", "--pack-destination", packs],
      clone,
      300_000,
    );
    expect(libPackRun.status, `${libPackRun.stdout}\n${libPackRun.stderr}`).toBe(0);
    libPack = parsePackResult(libPackRun.stdout);
    expect([libPack.name, rootPack.name]).toEqual(["@arggon/lib", "arggon-manager"]);
    expect(existsSync(join(clone, "dist", "cli.js"))).toBe(true); // prepare built it

    // 2. Adopter-shaped fixture: a small git repo with no tracker at all.
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

    // 3. Install both tarballs in one command (the documented mechanism).
    const prefix = mkdtemp("arggon-headless-prefix-");
    const install = npm(
      [
        "install",
        "-g",
        "--prefix",
        prefix,
        join(packs, libPack.filename!),
        join(packs, rootPack.filename!),
      ],
      fixture,
      300_000,
    );
    expect(install.status, `${install.stdout}\n${install.stderr}`).toBe(0);
    bin = join(prefix, "bin", "arggon");
    expect(existsSync(bin)).toBe(true);

    // 4. The shipped recipe, parsed once.
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
  }, 600_000);

  /** Run one workflow step body the way the runner does (`bash -e`). */
  function runStep(name: string, cwd: string): SpawnSyncReturns<string> {
    const body = steps.get(name);
    expect(body, `workflow step '${name}' missing`).toBeDefined();
    return spawnSync("bash", ["-e", "-c", body!], {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, PATH: `${dirname(bin)}:${process.env.PATH ?? ""}` },
    });
  }

  /** Run the checkout CLI (`tsx cli/src/cli.ts`) with the same argv. */
  function runCheckoutCli(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync(process.execPath, [tsx, cli, ...args], {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
    });
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
    // The recipe is an init-vendored artifact, so it must be in the pack.
    expect(rootPack.files.map((f) => f.path)).toContain(
      "templates/docs/github/workflows/arggon.yml",
    );
    const install = steps.get(INSTALL_STEP)!;
    // The install step the fixture cannot run (network clone) uses exactly the
    // pack+install mechanism the fixture is installed with.
    expect(install).toContain("npm pack --workspace @arggon/lib");
    expect(install).toContain("npm pack --pack-destination");
    expect(install).toContain("npm install -g");
    expect(install).toContain("@arggon/lib");
    // No executed step may reference a model, OpenCode or MCP.
    for (const [name, body] of steps) {
      expect(body, `step '${name}' mentions MCP/OpenCode/a model`).not.toMatch(
        /mcp|opencode|model/i,
      );
    }
    // The recipe is documented, including the two-tarball mechanism.
    const doc = readFileSync(CI_DOC, "utf8");
    expect(doc).toContain("npm pack --workspace @arggon/lib");
    expect(doc).toMatch(/no model, no MCP/i);
    expect(doc).toContain("headless-ci.test.ts");
  });

  it("runs the shipped recipe on the adopter fixture: fresh init -> validate/doctor/list green", () => {
    const bootstrap = runStep(BOOTSTRAP_STEP, fixture);
    expect(bootstrap.status, `${bootstrap.stdout}\n${bootstrap.stderr}`).toBe(0);
    // Fresh repo: the drift gate has nothing committed to compare yet and
    // must no-op (the recipe is green on a first clone).
    const freshDrift = runStep(DRIFT_STEP, fixture);
    expect(freshDrift.status, freshDrift.stderr).toBe(0);
    expect(freshDrift.stdout).toContain("tracker not committed yet");
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
