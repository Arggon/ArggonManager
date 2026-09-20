/**
 * Clean-build gate for the kernel package (`@arggon/lib`, ADR 0013).
 *
 * Acceptance: the kernel package imports from a clean `npm run build` (no
 * pre-existing `dist/`), its public entry resolves through the package
 * `exports` map in a real Node ESM process, and the operations from that built
 * artifact produce the CLI's `--json` envelopes byte for byte — for reads and
 * for writes (create, cascade update, comment, handoff).
 *
 * The build runs in a fresh-clone copy (tracked files + a linked
 * `node_modules`), so the gate is a real clean build and never deletes the
 * working tree's `dist/` while sibling test files are spawning the CLI. The
 * copy's own `node_modules/@arggon/lib` links to the copy's `lib/`, so the
 * probe and the CLI exercise the artifact just built. Volatile fields (dates,
 * commit hashes, the fixture root path) are normalized on both sides;
 * everything else is byte-compared.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCreate, runUpdate } from "@arggon/lib";
import { runInit } from "./init.js";
import { removeFixtureTree } from "./test-tmp.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** Fresh-clone stand-in, created in beforeAll (see {@link freshCloneCopy}). */
let copy = "";
/** The copy's CLI entry + tsx, so every parity run uses the copy's artifact. */
let cli = "";
let tsx = "";

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
  // Adapter-helper re-exports the root package consumes (W1 polish): the MCP
  // adapter imports HANDOFF_SESSION_CAP/parseCsvList from the entry, and
  // PriorityMigrateOptions/SyncFilled are type-only exports (checked by tsc).
  "HANDOFF_SESSION_CAP",
  "parseCsvList",
  "maybeCommitUpdate",
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

/**
 * Write parity cases: each runs the CLI on one twin fixture and the matching
 * operation on the other, then compares envelope + resulting tracker files.
 * `seed` runs on both twins before the case (fixed `now`, so the fixtures are
 * byte-identical regardless of when the test runs).
 */
const WRITE_CASES: Array<{ name: string; args: string[]; seed?: (dir: string) => void }> = [
  {
    name: "create",
    args: [
      "create",
      "task",
      "Parity created",
      "--parent",
      "story-login",
      "--labels",
      "px,py",
      "--priority",
      "p2",
    ],
  },
  {
    name: "update-cascade",
    args: ["update", "task-rate-limit", "--status", "done"],
    seed: claimRateLimit,
  },
  {
    name: "comment",
    args: ["comment", "task-rate-limit", "Parity comment line", "--author", "parity"],
  },
  {
    name: "handoff",
    args: [
      "handoff",
      "task-rate-limit",
      "--next",
      "Continue parity",
      "--branch",
      "feat/parity",
      "--open-questions",
      "q1; q2",
      "--session",
      "ses_parity",
      "--author",
      "parity",
    ],
  },
];

/** One Node ESM process driving the built operations, keyed by case name. */
const PROBE = `
const lib = await import("@arggon/lib");
const cwd = process.env.ARGGON_LIB_CWD;
const only = process.env.ARGGON_LIB_CASE;
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
const writes = {
  create: () =>
    lib.createOperation({
      cwd,
      type: "task",
      title: "Parity created",
      parent: "story-login",
      labels: ["px", "py"],
      priority: "p2",
    }),
  "update-cascade": () => lib.updateOperation({ cwd, id: "task-rate-limit", status: "done" }),
  comment: () =>
    lib.commentOperation({ cwd, id: "task-rate-limit", text: "Parity comment line", author: "parity" }),
  handoff: () =>
    lib.handoffOperation({
      cwd,
      id: "task-rate-limit",
      next: "Continue parity",
      branch: "feat/parity",
      openQuestions: "q1; q2",
      session: "ses_parity",
      author: "parity",
    }),
};
if (only) {
  const outcome = writes[only]();
  process.stdout.write(
    JSON.stringify({ exports: Object.keys(lib).sort(), case: only, envelope: outcome.envelope, ok: outcome.ok, exitCode: outcome.exitCode }),
  );
} else {
  const out = { exports: Object.keys(lib).sort(), cases: {} };
  for (const [name, run] of Object.entries(cases)) {
    const outcome = run();
    out.cases[name] = { envelope: outcome.envelope, ok: outcome.ok, exitCode: outcome.exitCode };
  }
  process.stdout.write(JSON.stringify(out));
}
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

function runProbeCase(cwd: string, name: string) {
  const proc = spawnSync(process.execPath, ["--input-type=module", "-e", PROBE], {
    cwd: copy,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, ARGGON_LIB_CWD: cwd, ARGGON_LIB_CASE: name },
  });
  expect(proc.status, proc.stderr).toBe(0);
  return JSON.parse(proc.stdout) as {
    case: string;
    envelope: Record<string, unknown>;
    ok: boolean;
    exitCode: number;
  };
}

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
 * Fresh-clone stand-in: every tracked (plus untracked-but-uncommitted) file,
 * with no build output at all, and a `node_modules` assembled from linked
 * entries of the working tree's install. `@arggon/lib` links to the COPY's
 * `lib/`, so the build and the probe exercise the copy — never the working
 * tree's `dist/`.
 */
function freshCloneCopy(): string {
  const dir = mkdtemp("arggon-libbuild-clone-");
  const listed = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  expect(listed.status, listed.stderr).toBe(0);
  for (const rel of listed.stdout.split("\0")) {
    if (rel === "") continue;
    if (rel === "node_modules" || rel.startsWith("node_modules/")) continue;
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(root, rel), dest);
  }
  const nm = join(dir, "node_modules");
  mkdirSync(nm);
  for (const entry of readdirSync(join(root, "node_modules"))) {
    if (entry === "@arggon") {
      const scope = join(nm, "@arggon");
      mkdirSync(scope);
      symlinkSync(join(dir, "lib"), join(scope, "lib"), "junction");
      continue;
    }
    symlinkSync(join(root, "node_modules", entry), join(nm, entry), "junction");
  }
  return dir;
}

/** Minimal initialized tree: initiative → epic → story + one leaf task. */
function seedTree(prefix = "arggon-libbuild-"): string {
  const dir = mkdtemp(prefix);
  seedInto(dir);
  return dir;
}

/**
 * Twin-fixture root: same directory basename in a per-twin parent, so
 * `arggon init`-generated files that embed the project name are byte-identical
 * across the CLI and operation twins.
 */
function seedTwin(): string {
  const dir = join(mkdtemp("arggon-libwrite-"), "arggon-parity");
  mkdirSync(dir);
  seedInto(dir);
  return dir;
}

function seedInto(dir: string): void {
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
}

/** Fixed claim so twin fixtures are byte-identical (no wall-clock race). */
function claimRateLimit(dir: string): void {
  runUpdate({
    cwd: dir,
    id: "task-rate-limit",
    status: "in_progress",
    assignee: "someone",
    now: new Date("2026-01-02T03:04:05.000Z"),
  });
}

/** Byte snapshot of the tracker tree, normalized for volatile date fields. */
function trackerSnapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        walk(full);
      } else {
        out[relative(dir, full)] = normalizeContent(readFileSync(full, "utf8"), dir);
      }
    }
  };
  walk(dir);
  return out;
}

/** Normalize volatile bytes: fixture root, dates, times, commit hashes. */
function normalizeContent(raw: string, fixtureDir: string): string {
  return raw
    .split(fixtureDir)
    .join("<root>")
    .replace(/"hash": ?"[0-9a-f]{7,40}"/g, '"hash":"<hash>"')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<datetime>")
    .replace(/\d{4}-\d{2}-\d{2}/g, "<date>");
}

type Probe = {
  exports: string[];
  cases: Record<string, { envelope: Record<string, unknown>; ok: boolean; exitCode: number }>;
};

let probe: Probe;
let fixtureDir = "";

beforeAll(() => {
  // Clean build in a fresh clone: no dist/ exists at all, so the build gate
  // cannot pass on stale output (and never deletes the working tree's dist/
  // while sibling test files run).
  copy = freshCloneCopy();
  cli = join(copy, "cli/src/cli.ts");
  tsx = join(copy, "node_modules/tsx/dist/cli.mjs");
  expect(existsSync(join(copy, "dist"))).toBe(false);
  expect(existsSync(join(copy, "lib/dist"))).toBe(false);
  const build = npm(["run", "build"], copy);
  expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);

  fixtureDir = seedTree();
  const proc = spawnSync(process.execPath, ["--input-type=module", "-e", PROBE], {
    cwd: copy,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, ARGGON_LIB_CWD: fixtureDir },
  });
  expect(proc.status, proc.stderr).toBe(0);
  probe = JSON.parse(proc.stdout) as Probe;
}, 240_000);

describe("kernel package from a clean build", () => {
  it("emits the built entry and the package's typed exports map", () => {
    // Built from a tree with no dist/ (asserted in beforeAll).
    expect(existsSync(join(copy, "lib/dist/index.js"))).toBe(true);
    expect(existsSync(join(copy, "lib/dist/index.d.ts"))).toBe(true);
    expect(existsSync(join(copy, "dist/cli.js"))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(copy, "lib/package.json"), "utf8")) as {
      name: string;
      exports: Record<string, { types?: string; import?: string; default?: string }>;
      dependencies?: Record<string, string>;
    };
    expect(pkg.name).toBe("@arggon/lib");
    expect(pkg.exports["."]).toEqual({
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
      default: "./dist/index.js",
    });
    // The kernel stays dependency-free (W3 bundles it into the vendored
    // single-file plugin; ADR 0011 §5 as amended by ADR 0013).
    expect(pkg.dependencies).toBeUndefined();
  });

  it("the root package consumes the kernel through the workspace", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      workspaces?: string[];
      dependencies?: Record<string, string>;
    };
    expect(pkg.workspaces).toEqual(["lib"]);
    expect(pkg.dependencies?.["@arggon/lib"]).toBeTruthy();
  });

  it("imports in a real Node process and exposes the kernel entrypoints", () => {
    for (const name of REQUIRED_BUILT_EXPORTS) {
      expect(probe.exports, `missing built export '${name}'`).toContain(name);
    }
  });

  it("proves the build gate actually produced the artifact (mutation sanity)", () => {
    // The probe imports via the package entry, not a file path: an empty or
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

describe("write parity against twin fixtures", () => {
  for (const { name, args, seed } of WRITE_CASES) {
    it(`\`${args.join(" ")}\` --json matches the built operation and the tracker files`, () => {
      const cliDir = seedTwin();
      const opDir = seedTwin();
      seed?.(cliDir);
      seed?.(opDir);

      const proc = runCli(args, cliDir);
      const entry = runProbeCase(opDir, name);

      expect(proc.status, proc.stderr).toBe(entry.exitCode);
      expect(normalizeContent(proc.stdout, cliDir)).toBe(
        normalizeContent(`${JSON.stringify(entry.envelope)}\n`, opDir),
      );
      expect(entry.ok).toBe(entry.envelope.ok);
      // The mutation itself is identical too, not just its envelope.
      expect(trackerSnapshot(opDir)).toEqual(trackerSnapshot(cliDir));
    });
  }
});
