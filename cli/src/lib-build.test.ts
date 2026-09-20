/**
 * Clean-build gate for the kernel library (W1, task-native-kernel-lib).
 *
 * Acceptance: the library imports from a clean `npm run build`, the package
 * subpath `arggon-manager/lib` resolves to the built entry, and the operations
 * from that built artifact produce the CLI's `--json` envelopes byte for byte.
 *
 * The test spawns the real `npm run build`, drives the built library in a real
 * Node ESM process (self-referencing the package subpath, so the `exports` map
 * is exercised, not a file path), and compares each envelope against the real
 * CLI (node + tsx) on the same fixture tree.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync as _mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { removeFixtureTree } from "./test-tmp.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(root, "cli/src/cli.ts");
const tsx = join(root, "node_modules/tsx/dist/cli.mjs");

/** Kernel entrypoints the built artifact must expose (subset of lib.test.ts). */
const REQUIRED_BUILT_EXPORTS = [
  "loadItems",
  "itemsById",
  "toContractWorkItem",
  "assertUpdateRules",
  "canTransition",
  "assertParentEdge",
  "trackerAt",
  "findTasksDir",
  "readConventionVersion",
  "JSON_SCHEMA_VERSION",
  "successEnvelope",
  "failEnvelope",
  "compactWorkItem",
  "listOperation",
  "createOperation",
  "updateOperation",
  "showOperation",
  "nextOperation",
  "reportOperation",
  "validateOperation",
  "commentOperation",
  "handoffOperation",
  "priorityOperation",
  "syncOperation",
  "importIssuesOperation",
] as const;

/** Read-only parity cases: operation name → CLI argv (same fixture tree). */
const PARITY_CASES: Array<{ name: string; args: string[] }> = [
  { name: "list", args: ["list"] },
  { name: "list-full", args: ["list", "--full"] },
  { name: "show", args: ["show", "story-login"] },
  { name: "show-body", args: ["show", "story-login", "--body"] },
  { name: "show-missing", args: ["show", "nope"] },
  { name: "next", args: ["next"] },
  { name: "report", args: ["report"] },
  { name: "validate", args: ["validate"] },
];

/** One Node ESM process driving the built operations, keyed by case name. */
const PROBE = `
const lib = await import("arggon-manager/lib");
const cwd = process.env.ARGGON_LIB_CWD;
const cases = {
  list: () => lib.listOperation({ cwd }),
  "list-full": () => lib.listOperation({ cwd, full: true }),
  show: () => lib.showOperation({ cwd, id: "story-login" }),
  "show-body": () => lib.showOperation({ cwd, id: "story-login", body: true }),
  "show-missing": () => lib.showOperation({ cwd, id: "nope" }),
  next: () => lib.nextOperation({ cwd }),
  report: () => lib.reportOperation({ cwd }),
  validate: () => lib.validateOperation({ cwd }),
};
const out = { exports: Object.keys(lib).sort(), cases: {} };
for (const [name, run] of Object.entries(cases)) {
  const outcome = run();
  out.cases[name] = { envelope: outcome.envelope, ok: outcome.ok, exitCode: outcome.exitCode };
}
process.stdout.write(JSON.stringify(out));
`;

function npm(args: string[], cwd: string) {
  // Same npm resolution as the pack-contents gate: npm_execpath is set when
  // the suite runs under `npm test`.
  const execpath = process.env.npm_execpath;
  const command = execpath ? process.execPath : "npm";
  const argv = execpath ? [execpath, ...args] : args;
  return spawnSync(command, argv, { cwd, encoding: "utf8", timeout: 180_000 });
}

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, "--json", ...args], {
    encoding: "utf8",
    cwd,
    timeout: 60_000,
  });
}

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

type Probe = {
  exports: string[];
  cases: Record<string, { envelope: Record<string, unknown>; ok: boolean; exitCode: number }>;
};

let probe: Probe;
let fixtureDir = "";

beforeAll(() => {
  const build = npm(["run", "build"], root);
  expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);

  const dir = _mkdtempSync(join(tmpdir(), "arggon-libbuild-"));
  tmpDirs.push(dir);
  fixtureDir = dir;
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP" });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp" });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login" });
  runCreate({
    cwd: dir,
    type: "task",
    title: "Add rate limiting",
    parent: "story-login",
    id: "rate-limit",
  });

  const proc = spawnSync(process.execPath, ["--input-type=module", "-e", PROBE], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, ARGGON_LIB_CWD: dir },
  });
  expect(proc.status, proc.stderr).toBe(0);
  probe = JSON.parse(proc.stdout) as Probe;
}, 240_000);

describe("kernel library from a clean build", () => {
  it("emits the built entry and the typed subpath export", () => {
    expect(existsSync(join(root, "dist/lib.js"))).toBe(true);
    expect(existsSync(join(root, "dist/lib.d.ts"))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      exports: Record<string, { types?: string; import?: string }>;
    };
    expect(pkg.exports["./lib"]).toEqual({
      types: "./dist/lib.d.ts",
      import: "./dist/lib.js",
    });
  });

  it("imports in a real Node process and exposes the kernel entrypoints", () => {
    for (const name of REQUIRED_BUILT_EXPORTS) {
      expect(probe.exports, `missing built export '${name}'`).toContain(name);
    }
  });

  it("proves the build gate actually produced the artifact (mutation sanity)", () => {
    // The probe imports via the package subpath, not a file path: an empty or
    // stale dist cannot pass this.
    expect(probe.exports.length).toBeGreaterThan(50);
  });

  for (const { name, args } of PARITY_CASES) {
    it(`\`${args.join(" ")}\` --json is byte-identical to the built operation`, () => {
      const entry = probe.cases[name];
      expect(entry, `probe case '${name}' missing`).toBeDefined();
      const proc = runCli(args, fixtureDir);
      expect(proc.status, proc.stderr).toBe(entry!.exitCode);
      expect(proc.stdout).toBe(`${JSON.stringify(entry!.envelope)}\n`);
      expect(entry!.ok).toBe(entry!.envelope.ok);
    });
  }
});
