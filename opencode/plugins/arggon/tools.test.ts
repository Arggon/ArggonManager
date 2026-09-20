/**
 * Native `arggon` tool namespace contract tests (W2, task-native-tools).
 *
 * The plugin registers fifteen in-process tools (namespace `arggon`,
 * `options.codemode: true`) whose outputs are the documented `--json`
 * envelopes. These tests pin that contract without an OpenCode runtime:
 *
 *   1. **registration** — the transform receives the `arggon` namespace with
 *      the expected description and the fifteen definitions, each with
 *      `options.namespace: "arggon"` + `options.codemode: true` (the Code Mode
 *      catalog surface).
 *   2. **contract** — for every tool, the envelope it returns is byte-identical
 *      (after normalizing volatile dates/hashes/root paths) to the CLI's
 *      `--json` envelope for the equivalent command, on twin fixtures; writes
 *      also leave byte-identical tracker trees.
 *   3. **failure isolation** — a kernel failure rejects with `ArgonToolError`
 *      (typed: `code`, `command`, `envelope`) instead of throwing through a
 *      hook, and later calls keep working.
 *
 * The real headless session evidence (`opencode run`, Code Mode catalog,
 * `tools.arggon.*` calls) lives in `npm run smoke:opencode`. `sync` and
 * `import_issues` shell out to `gh` (which resolves its repo from the
 * *process* cwd), so their failure contract is pinned by the smoke — where
 * the fixture is a git repo without a GitHub remote — instead of here.
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseFrontmatter, runCreate, runUpdate } from "@arggon/lib";
import { runInit } from "../../../cli/src/init.js";
import {
  ARGON_TOOL_NAMESPACE,
  ARGON_TOOL_NAMESPACE_DESCRIPTION,
  ArgonToolError,
  argonToolDefinitions,
  csvList,
  loadArgonKernel,
  nativeToolSchemas,
  nativeToolsCatalogBytes,
  PINNED_TOOL_NAMES,
  pluginTemplatesDir,
  registerArgonTools,
  sessionToken,
  type ArgonKernel,
  type ArgonToolDefinition,
} from "./index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const tsx = join(root, "node_modules/tsx/dist/cli.mjs");
const cli = join(root, "cli/src/cli.ts");

/**
 * The twelve spec tools (spec-native-first-011 §Tools) plus the three W4
 * worktree-domain tools (`start`/`branch`/`cleanup`,
 * task-native-permissions-worktrees).
 */
const EXPECTED_TOOLS = [
  "list",
  "create",
  "update",
  "show",
  "next",
  "report",
  "validate",
  "comment",
  "handoff",
  "priority",
  "sync",
  "import_issues",
  "start",
  "branch",
  "cleanup",
] as const;

/** ADR 0006 advisory tool-schema bound (the MCP `tools/list` cap, task-schema-budget). */
const NATIVE_TOOLS_BUDGET_BYTES = 12_288;

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function mkdtemp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** Minimal initialized tree: initiative → epic → story + one leaf task. */
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

function seedTree(prefix = "arggon-w2-"): string {
  const dir = mkdtemp(prefix);
  seedInto(dir);
  return dir;
}

/**
 * Twin-fixture root: same directory basename in a per-twin parent so generated
 * files that embed the project name are byte-identical across the CLI and tool
 * twins (same trick as cli/src/lib-build.test.ts).
 */
function seedTwin(): string {
  const dir = join(mkdtemp("arggon-w2-twin-"), "arggon-parity");
  mkdirSync(dir);
  seedInto(dir);
  return dir;
}

/** Fixed claim so twin fixtures stay byte-identical (no wall-clock race). */
function claimRateLimit(dir: string): void {
  runUpdate({
    cwd: dir,
    id: "task-rate-limit",
    status: "in_progress",
    assignee: "someone",
    now: new Date("2026-01-02T03:04:05.000Z"),
  });
}

/** Legacy pN label so `priority migrate` has something to report. */
function legacyPriorityLabel(dir: string): void {
  runUpdate({ cwd: dir, id: "task-rate-limit", labels: "p1,backend" });
}

function runCli(args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  const proc = spawnSync(process.execPath, [tsx, cli, "--json", ...args], {
    encoding: "utf8",
    cwd,
    timeout: 60_000,
    ...(env === undefined ? {} : { env }),
  });
  return { status: proc.status, stdout: proc.stdout ?? "", stderr: proc.stderr ?? "" };
}

/** Normalize volatile bytes: fixture root, dates, commit hashes. */
function normalize(text: string, dir: string): string {
  return text
    .split(dir)
    .join("<root>")
    .replace(/"hash": ?"[0-9a-f]{7,40}"/g, '"hash":"<hash>"')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<datetime>")
    .replace(/\d{4}-\d{2}-\d{2}/g, "<date>");
}

/** Byte snapshot of the tracker tree, normalized for volatile fields. */
function trackerSnapshot(dir: string): Record<string, string> {
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
  walk(join(dir, "ArggonManager"));
  return out;
}

/** `git` in a fixture (bootstrap for the sync twin: origin remote required). */
function git(dir: string, args: string[]): void {
  const proc = spawnSync("git", args, { cwd: dir, encoding: "utf8", timeout: 30_000 });
  expect(proc.status, proc.stderr).toBe(0);
}

/**
 * Git twin fixture for `sync`: same layout as {@link seedTwin} plus a git repo
 * whose origin is a GitHub remote, so the kernel detects `acme/demo` and only
 * the `gh pr list` call needs a fake.
 */
function seedGitTwin(): string {
  const dir = join(mkdtemp("arggon-w2-sync-"), "arggon-parity");
  mkdirSync(dir);
  seedInto(dir);
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "parity@example.com"]);
  git(dir, ["config", "user.name", "parity"]);
  git(dir, ["remote", "add", "origin", "https://github.com/acme/demo.git"]);
  return dir;
}

/**
 * A fake `gh` on PATH (review F2): prints the canned JSON for `gh pr list` /
 * `gh issue list` and fails loudly for anything else. Both surfaces under test
 * (`sync`, `import_issues`) shell out to `gh`; PATH is how the CLI subprocess
 * and the in-process tool both pick it up.
 */
function fakeGh(dir: string, responses: { prList?: string; issueList?: string }): string {
  const binDir = join(dir, "bin");
  mkdirSync(binDir, { recursive: true });
  const shim = join(binDir, "gh");
  const script = [
    "#!/bin/sh",
    'case "$1 $2" in',
    '  "pr list")',
    `    printf '%s' '${responses.prList ?? "[]"}'`,
    "    ;;",
    '  "issue list")',
    `    printf '%s' '${responses.issueList ?? "[]"}'`,
    "    ;;",
    '  *) echo "fake gh: unsupported: $*" >&2; exit 1 ;;',
    "esac",
    "",
  ].join("\n");
  writeFileSync(shim, script, "utf8");
  chmodSync(shim, 0o755);
  return binDir;
}

/** Run `fn` with `binDir` prepended to PATH (in-process fake `gh`). */
async function withFakeGh<T>(binDir: string, fn: () => Promise<T>): Promise<T> {
  const original = process.env.PATH;
  process.env.PATH = `${binDir}:${original ?? ""}`;
  try {
    return await fn();
  } finally {
    process.env.PATH = original;
  }
}

/** One open PR matching `task-rate-limit`, as `gh pr list --json` returns it. */
const FAKE_PR_LIST = JSON.stringify([
  {
    number: 7,
    title: "Add rate limiting",
    headRefName: "feat/task-rate-limit",
    url: "https://github.com/acme/demo/pull/7",
  },
]);

/** Two issues (bug + task, open + closed), as `gh issue list --json` returns them. */
const FAKE_ISSUE_LIST = JSON.stringify([
  {
    number: 11,
    title: "Login 500 on empty password",
    state: "OPEN",
    body: "Repro: submit an empty password.",
    labels: [{ name: "bug" }],
  },
  {
    number: 12,
    title: "Add rate limiting",
    state: "CLOSED",
    body: "",
    labels: [{ name: "enhancement" }],
  },
]);

let kernel: ArgonKernel;

beforeAll(async () => {
  const loaded = await loadArgonKernel();
  expect(loaded, "@arggon/lib must resolve in the repo").toBeDefined();
  kernel = loaded as ArgonKernel;
});

function definitions(cwd = root): ArgonToolDefinition[] {
  return argonToolDefinitions(kernel, { cwd, templatesDir: pluginTemplatesDir() });
}

function tool(defs: ArgonToolDefinition[], name: string): ArgonToolDefinition {
  const found = defs.find((entry) => entry.name === name);
  expect(found, `tool '${name}' is registered`).toBeDefined();
  return found as ArgonToolDefinition;
}

type Captured = {
  namespaces: Array<{ name: string; description: string }>;
  tools: Array<{
    name: string;
    options?: { namespace?: string; codemode?: boolean; pinned?: boolean };
  }>;
};

function fakeContext(captured: Captured, mode: "ok" | "no-transform" | "throw-on-add" = "ok") {
  return {
    tool:
      mode === "no-transform"
        ? {}
        : {
            transform: async (callback: (editor: unknown) => void) => {
              callback({
                namespace: (input: { name: string; description: string }) =>
                  captured.namespaces.push(input),
                add: (input: {
                  name: string;
                  options?: { namespace?: string; codemode?: boolean; pinned?: boolean };
                }) => {
                  if (mode === "throw-on-add") throw new Error("synthetic registration failure");
                  captured.tools.push(input);
                },
              });
            },
          },
  } as never;
}

describe("native arggon tool registration (W2)", () => {
  it("registers the arggon namespace with the expected description", async () => {
    const captured: Captured = { namespaces: [], tools: [] };
    const registered = await registerArgonTools(fakeContext(captured), {
      cwd: root,
      templatesDir: pluginTemplatesDir(),
    });
    expect(registered).toBe(EXPECTED_TOOLS.length);
    expect(captured.namespaces).toEqual([
      { name: ARGON_TOOL_NAMESPACE, description: ARGON_TOOL_NAMESPACE_DESCRIPTION },
    ]);
    expect(captured.tools.map((entry) => entry.name)).toEqual([...EXPECTED_TOOLS]);
    for (const registration of captured.tools) {
      // Code Mode catalog surface: namespace + codemode; the core subset the
      // native commands depend on is additionally pinned (W3 catalog lever,
      // PINNED_TOOL_NAMES).
      const pinned = PINNED_TOOL_NAMES.includes(registration.name);
      expect(registration.options).toEqual({
        namespace: ARGON_TOOL_NAMESPACE,
        codemode: true,
        ...(pinned ? { pinned: true } : {}),
      });
    }
    expect(captured.tools.filter((entry) => entry.options?.pinned).map((entry) => entry.name)).toEqual(
      [...PINNED_TOOL_NAMES],
    );
  });

  it("every definition carries an input and an output schema", () => {
    for (const definition of definitions()) {
      expect(definition.description.length, definition.name).toBeGreaterThan(20);
      expect(definition.input.type, definition.name).toBe("object");
      expect(definition.output.type, definition.name).toBe("object");
      expect(typeof definition.execute, definition.name).toBe("function");
    }
  });

  it("pins exactly the core workflow tools (W3 catalog lever)", () => {
    const pinned = nativeToolSchemas()
      .filter((schema) => schema.pinned)
      .map((schema) => schema.name);
    expect(pinned).toEqual([...PINNED_TOOL_NAMES]);
    // Every pinned name is a real tool: the subset is the contract.
    for (const name of PINNED_TOOL_NAMES) expect(EXPECTED_TOOLS).toContain(name);
  });

  it("keeps the tool-schema payload within the ADR 0006 advisory budget", () => {
    // Definitions JSON the Code Mode catalog is built from (pinned flags
    // included); the runtime renders it as one catalog line per tool under its
    // own token budget.
    const bytes = nativeToolsCatalogBytes();
    expect(bytes).toBeLessThanOrEqual(NATIVE_TOOLS_BUDGET_BYTES);
    expect(nativeToolSchemas()).toHaveLength(EXPECTED_TOOLS.length);
  });

  it("is a no-op without the tool transform surface (feature detection)", async () => {
    const captured: Captured = { namespaces: [], tools: [] };
    const registered = await registerArgonTools(fakeContext(captured, "no-transform"), {
      cwd: root,
    });
    expect(registered).toBe(0);
    expect(captured.tools).toEqual([]);
  });

  it("keeps registering the remaining tools when one add fails (failure isolation)", async () => {
    const captured: Captured = { namespaces: [], tools: [] };
    const submitted = await registerArgonTools(fakeContext(captured, "throw-on-add"), {
      cwd: root,
    });
    // Every definition is submitted; a per-add failure is logged and skipped,
    // never propagated to the caller or through a hook.
    expect(submitted).toBe(EXPECTED_TOOLS.length);
    expect(captured.namespaces).toHaveLength(1);
    expect(captured.tools).toEqual([]);
  });

  it("resolves the templates fallback to the package templates dir", () => {
    expect(pluginTemplatesDir()).toBe(join(root, "templates"));
  });
});

describe("native tool inputs (pure helpers)", () => {
  it("joins array inputs into the kernel's CSV fields", () => {
    expect(csvList(["a", "b"])).toBe("a,b");
    expect(csvList([])).toBe("");
    expect(csvList(undefined)).toBeUndefined();
    expect(csvList("a,b")).toBeUndefined();
  });

  it("accepts only plain session tokens as the attribution default", () => {
    expect(sessionToken("ses_abc-123.4:5")).toBe("ses_abc-123.4:5");
    expect(sessionToken("  ses_abc  ")).toBe("ses_abc");
    expect(sessionToken("ses_abc\n### injected")).toBeUndefined();
    expect(sessionToken("x".repeat(65))).toBeUndefined();
    expect(sessionToken(undefined)).toBeUndefined();
  });
});

describe("native tool outputs mirror the CLI --json envelopes", () => {
  const readCases: Array<{ name: string; input: Record<string, unknown>; args: string[] }> = [
    { name: "list", input: {}, args: ["list"] },
    { name: "list", input: { full: true }, args: ["list", "--full"] },
    { name: "show", input: { id: "story-login" }, args: ["show", "story-login"] },
    {
      name: "show",
      input: { id: "story-login", body: true },
      args: ["show", "story-login", "--body"],
    },
    {
      name: "show",
      input: { id: "story-login", meta: true },
      args: ["show", "story-login", "--meta"],
    },
    { name: "next", input: {}, args: ["next"] },
    { name: "report", input: {}, args: ["report"] },
    { name: "validate", input: {}, args: ["validate"] },
  ];

  for (const testCase of readCases) {
    const label = `${testCase.name} ${JSON.stringify(testCase.input)}`;
    it(`${label} equals \`${testCase.args.join(" ")} --json\``, async () => {
      const dir = seedTree();
      const expected = runCli(testCase.args, dir);
      expect(expected.status, expected.stderr).toBe(0);
      const output = await tool(definitions(dir), testCase.name).execute(testCase.input);
      expect(normalize(`${JSON.stringify(output.output)}\n`, dir)).toBe(
        normalize(expected.stdout, dir),
      );
    });
  }

  const writeCases: Array<{
    name: string;
    input: Record<string, unknown>;
    args: string[];
    seed?: (dir: string) => void;
  }> = [
    {
      name: "create",
      input: {
        type: "task",
        title: "Parity created",
        parent: "story-login",
        labels: ["px", "py"],
        priority: "p2",
      },
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
      name: "update",
      input: { id: "task-rate-limit", status: "done" },
      args: ["update", "task-rate-limit", "--status", "done"],
      seed: claimRateLimit,
    },
    {
      name: "update",
      input: { id: "task-rate-limit", labels: ["one", "two"], depends_on: ["story-login"] },
      args: ["update", "task-rate-limit", "--labels", "one,two", "--depends-on", "story-login"],
    },
    {
      name: "comment",
      input: { id: "task-rate-limit", text: "Parity comment line", author: "parity" },
      args: ["comment", "task-rate-limit", "Parity comment line", "--author", "parity"],
    },
    {
      name: "handoff",
      input: {
        id: "task-rate-limit",
        next: "Continue parity",
        branch: "feat/parity",
        open_questions: "q1; q2",
        session: "ses_parity",
        author: "parity",
      },
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
    {
      name: "priority",
      input: { dry_run: true },
      args: ["priority", "migrate", "--dry-run"],
      seed: legacyPriorityLabel,
    },
  ];

  for (const testCase of writeCases) {
    const label = `${testCase.name} ${JSON.stringify(testCase.input)}`;
    it(`${label} matches \`${testCase.args.join(" ")} --json\` and the tracker files`, async () => {
      const cliDir = seedTwin();
      const toolDir = seedTwin();
      testCase.seed?.(cliDir);
      testCase.seed?.(toolDir);

      const expected = runCli(testCase.args, cliDir);
      expect(expected.status, expected.stderr).toBe(0);
      const output = await tool(definitions(toolDir), testCase.name).execute(testCase.input);

      expect(normalize(`${JSON.stringify(output.output)}\n`, toolDir)).toBe(
        normalize(expected.stdout, cliDir),
      );
      // The mutation itself is identical too, not just its envelope.
      expect(trackerSnapshot(toolDir)).toEqual(trackerSnapshot(cliDir));
    });
  }
});

describe("kernel failures are typed tool errors and the session continues", () => {
  it("rejects with ArgonToolError carrying the kernel code and envelope", async () => {
    const dir = seedTree();
    const defs = definitions(dir);
    const expected = runCli(["show", "nope"], dir);
    expect(expected.status).toBe(1);

    let caught: unknown;
    try {
      await tool(defs, "show").execute({ id: "nope" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.name).toBe("ArgonToolError");
    expect(typed.code).toBe("SHOW_FAILED");
    expect(typed.command).toBe("show");
    expect(normalize(JSON.stringify(typed.envelope), dir)).toBe(
      normalize(expected.stdout.trim(), dir),
    );
    expect(typed.message.startsWith("SHOW_FAILED: ")).toBe(true);
    // The bounded envelope rides in the message: a Code Mode script that
    // catches the error still sees the documented payload.
    expect(typed.message).toContain('"command":"show"');

    // Failure isolation: the same definitions keep serving later calls.
    const after = await tool(defs, "list").execute({});
    expect(after.output.ok).toBe(true);
  });

  it("maps a failing validate to a typed error that keeps the error payload", async () => {
    const dir = seedTree();
    const broken = join(dir, "ArggonManager", "launch-mvp", "auth", "task-broken.md");
    // Put a leaf outside a story directory: validate reports a tree error.
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      broken,
      '---\ntype: task\nstatus: todo\nid: task-broken\ntitle: "Broken"\nparent: missing-story\n---\n\nbroken\n',
      "utf8",
    );
    const expected = runCli(["validate"], dir);
    expect(expected.status).toBe(1);

    let caught: unknown;
    try {
      await tool(definitions(dir), "validate").execute({});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("VALIDATE_FAILED");
    // The envelope (errors included) is preserved on the typed error.
    expect(normalize(JSON.stringify(typed.envelope), dir)).toBe(
      normalize(expected.stdout.trim(), dir),
    );
    expect(Array.isArray(typed.envelope.errors)).toBe(true);
    expect((typed.envelope.errors as unknown[]).length).toBeGreaterThan(0);
  });

  it("sync surfaces the CLI's SYNC_FAILED envelope on a fixture without a GitHub remote", async () => {
    const dir = seedTree();
    const expected = runCli(["sync"], dir);
    expect(expected.status).toBe(1);

    let caught: unknown;
    try {
      await tool(definitions(dir), "sync").execute({ check: true });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("SYNC_FAILED");
    expect(normalize(JSON.stringify(typed.envelope), dir)).toBe(
      normalize(expected.stdout.trim(), dir),
    );
  });

  it("fails a pure read outside a tracker with LIST_FAILED and keeps working", async () => {
    const empty = mkdtemp("arggon-w2-empty-");
    const defs = definitions(empty);
    await expect(tool(defs, "list").execute({})).rejects.toMatchObject({
      name: "ArgonToolError",
      code: "LIST_FAILED",
    });
    await expect(tool(defs, "next").execute({})).rejects.toMatchObject({ code: "NEXT_FAILED" });
    // A definition built for a real tree still works after the failures.
    const dir = seedTree();
    const ok = await tool(definitions(dir), "list").execute({});
    expect(ok.output.ok).toBe(true);
  });
});

describe("GitHub-dependent tools mirror the CLI --json envelopes (fake gh)", () => {
  it("sync write-mode matches `sync --write --json` and the tracker files", async () => {
    const cliDir = seedGitTwin();
    const toolDir = seedGitTwin();
    const binDir = fakeGh(mkdtemp("arggon-w2-gh-"), { prList: FAKE_PR_LIST });

    const expected = runCli(["sync", "--write"], cliDir, {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    });
    expect(expected.status, expected.stderr).toBe(0);
    const output = await withFakeGh(binDir, () =>
      tool(definitions(toolDir), "sync").execute({ write: true }),
    );
    expect(normalize(`${JSON.stringify(output.output)}\n`, toolDir)).toBe(
      normalize(expected.stdout, cliDir),
    );
    // The filled branch field is identical on both sides, not just the envelope.
    expect(trackerSnapshot(toolDir)).toEqual(trackerSnapshot(cliDir));
  });

  it("import_issues dry-run matches `import-issues --dry-run --json`", async () => {
    const cliDir = seedTwin();
    const toolDir = seedTwin();
    const binDir = fakeGh(mkdtemp("arggon-w2-gh-"), { issueList: FAKE_ISSUE_LIST });

    const expected = runCli(["import-issues", "--dry-run"], cliDir, {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    });
    expect(expected.status, expected.stderr).toBe(0);
    const output = await withFakeGh(binDir, () =>
      tool(definitions(toolDir), "import_issues").execute({ dry_run: true }),
    );
    expect(normalize(`${JSON.stringify(output.output)}\n`, toolDir)).toBe(
      normalize(expected.stdout, cliDir),
    );
    // Dry run writes nothing on either side.
    expect(trackerSnapshot(toolDir)).toEqual(trackerSnapshot(cliDir));
  });
});

// ---------------------------------------------------------------------------
// W4 — worktree domain tools (task-native-permissions-worktrees)
// ---------------------------------------------------------------------------

/** `git` in a fixture returning stdout (the W2 `git` helper discards it). */
function gitOut(dir: string, args: string[]): string {
  const proc = spawnSync("git", args, { cwd: dir, encoding: "utf8", timeout: 30_000 });
  expect(proc.status, proc.stderr).toBe(0);
  return (proc.stdout ?? "").trim();
}

/** Initialized tracker inside a git repo (the worktree tools need both). */
function seedGitTree(prefix = "arggon-w4-"): string {
  const dir = mkdtemp(prefix);
  seedInto(dir);
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "w4@example.com"]);
  git(dir, ["config", "user.name", "w4"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", "fixture"]);
  return dir;
}

/**
 * Fake `ctx.worktree` domain backed by real git: the same observable contract
 * as the 2.0.10 Git strategy probed for W4 (detached worktree at the start
 * ref, `directory` is the parent, `list` reports saved inventory, `remove`
 * needs force for dirty trees). Calls are recorded so the tests can assert the
 * plugin went through the domain, never `git worktree` directly.
 */
function fakeDomain(dir: string): {
  domain: {
    create(input: { projectID: string; name: string; directory?: string }): Promise<unknown>;
    list(input: { projectID: string }): Promise<unknown>;
    refresh(input: { projectID: string }): Promise<unknown>;
    remove(input: { projectID: string; directory: string; force?: boolean }): Promise<unknown>;
  };
  calls: { create: Array<Record<string, unknown>>; remove: Array<Record<string, unknown>>; refresh: number; list: number };
} {
  const calls = {
    create: [] as Array<Record<string, unknown>>,
    remove: [] as Array<Record<string, unknown>>,
    refresh: 0,
    list: 0,
  };
  return {
    calls,
    domain: {
      async create(input) {
        calls.create.push(input);
        const target = join(String(input.directory ?? dir), input.name);
        git(dir, ["worktree", "add", "--detach", target]);
        return { directory: target };
      },
      async list() {
        calls.list += 1;
        return gitOut(dir, ["worktree", "list", "--porcelain"])
          .split("\n")
          .filter((line) => line.startsWith("worktree "))
          .map((line) => ({ directory: line.slice("worktree ".length).trim() }));
      },
      async refresh() {
        calls.refresh += 1;
      },
      async remove(input) {
        calls.remove.push(input);
        git(dir, [
          "worktree",
          "remove",
          ...(input.force === true ? ["--force"] : []),
          input.directory,
        ]);
      },
    },
  };
}

/** Definitions wired to the fake domain (canonical = the fixture itself). */
function worktreeDefinitions(
  dir: string,
  domain: ReturnType<typeof fakeDomain>["domain"],
): ArgonToolDefinition[] {
  return argonToolDefinitions(kernel, {
    cwd: dir,
    templatesDir: pluginTemplatesDir(),
    worktree: { projectID: "project-id", canonical: dir, domain },
  });
}

/** Item frontmatter as the worktree copy records it. */
function itemData(dir: string, id: string, root = dir): Record<string, unknown> {
  const path = join(root, "ArggonManager", "launch-mvp", "auth", "story-login", `${id}.md`);
  return parseFrontmatter(readFileSync(path, "utf8")).data as Record<string, unknown>;
}

/** Claim → worktree → commit → merge (stub PR) → done; returns the worktree path. */
async function completedWorktree(
  dir: string,
  id = "task-rate-limit",
): Promise<{ worktreePath: string; defs: ArgonToolDefinition[]; calls: ReturnType<typeof fakeDomain>["calls"] }> {
  const { domain, calls } = fakeDomain(dir);
  const defs = worktreeDefinitions(dir, domain);
  const started = await tool(defs, "start").execute({ id, assignee: "smoke" });
  const worktreePath = String((started.output as { worktreePath?: unknown }).worktreePath);
  writeFileSync(join(worktreePath, "work.txt"), "work\n", "utf8");
  git(worktreePath, ["add", "work.txt"]);
  git(worktreePath, ["commit", "-qm", "feat: work"]);
  const branch = String((started.output as { branch?: unknown }).branch);
  git(dir, ["merge", "--no-ff", branch, "-m", "Merge PR (stubbed)"]);
  await tool(defs, "update").execute({ id, status: "done" });
  return { worktreePath, defs, calls };
}

describe("worktree domain tools (W4)", () => {
  it("start claims, creates the worktree through the domain and records branch + worktree_path in the worktree copy", async () => {
    const dir = seedGitTree();
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    const started = await tool(defs, "start").execute({
      id: "task-rate-limit",
      assignee: "smoke",
    });
    const output = started.output as Record<string, unknown>;
    const worktreePath = String(output.worktreePath);

    expect(output.ok).toBe(true);
    expect(output.command).toBe("start");
    expect(output.branch).toBe("feat/task-rate-limit");
    expect(output.worktreeCreated).toBe(true);
    expect(output.branchCreated).toBe(true);
    expect(output.pushed).toBe(false);

    // The domain was used (parent = the checkout's parent, name <repo>-<id>).
    expect(calls.create).toHaveLength(1);
    expect(calls.create[0]).toEqual({
      projectID: "project-id",
      name: `${basename(dir)}-task-rate-limit`,
      directory: dirname(dir),
    });
    expect(worktreePath).toBe(join(dirname(dir), `${basename(dir)}-task-rate-limit`));
    expect(existsSync(worktreePath)).toBe(true);

    // Branch created + checked out in the worktree (the domain creates detached).
    expect(gitOut(worktreePath, ["branch", "--show-current"])).toBe("feat/task-rate-limit");
    // The claim commit landed on the feature branch inside the worktree.
    expect(gitOut(worktreePath, ["log", "-1", "--pretty=%s"])).toBe(
      "chore(tasks): claimed task-rate-limit",
    );

    // Claim + records live in the worktree copy; the canonical checkout stays clean.
    expect(itemData(dir, "task-rate-limit", worktreePath)).toMatchObject({
      status: "in_progress",
      assignee: "smoke",
      branch: "feat/task-rate-limit",
      worktree_path: worktreePath,
    });
    expect(itemData(dir, "task-rate-limit")).toMatchObject({ status: "todo" });
    expect(itemData(dir, "task-rate-limit").branch).toBeUndefined();
  });

  it("start refuses to steal a claim and removes the worktree it just created", async () => {
    const dir = seedGitTree();
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    // Claim through the tool so the claim commit lands (realistic setup).
    await tool(defs, "update").execute({
      id: "task-rate-limit",
      status: "in_progress",
      assignee: "someone",
    });

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "intruder" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    expect(String((typed.envelope.error as { message?: unknown }).message)).toContain(
      "claim conflict",
    );
    expect(String((typed.envelope.error as { message?: unknown }).message)).toContain(
      "removed again",
    );

    // Nothing left behind: no orphan worktree, no branch, claim untouched.
    expect(calls.create).toHaveLength(1);
    expect(calls.remove).toHaveLength(1);
    expect(existsSync(join(dirname(dir), `${basename(dir)}-task-rate-limit`))).toBe(false);
    expect(gitOut(dir, ["worktree", "list"]).includes("task-rate-limit")).toBe(false);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toBe("");
    expect(itemData(dir, "task-rate-limit")).toMatchObject({
      status: "in_progress",
      assignee: "someone",
    });
  });

  it("start re-run attaches to the recorded worktree (no second domain create)", async () => {
    const dir = seedGitTree();
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    const first = await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    const second = await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    expect(calls.create).toHaveLength(1);
    expect((second.output as { worktreeCreated?: unknown }).worktreeCreated).toBe(false);
    expect((second.output as { worktreePath?: unknown }).worktreePath).toBe(
      (first.output as { worktreePath?: unknown }).worktreePath,
    );
    expect(itemData(dir, "task-rate-limit", String((first.output as { worktreePath?: unknown }).worktreePath)))
      .toMatchObject({ status: "in_progress", assignee: "smoke" });
  });


  it("start refuses a stale canonical copy (uncommitted claim) and removes the worktree", async () => {
    const dir = seedGitTree();
    // Uncommitted claim in the canonical tree: the fresh worktree (HEAD) would
    // not see it, so the kernel would validate a stale claim state.
    runUpdate({ cwd: dir, id: "task-rate-limit", status: "in_progress", assignee: "someone" });
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    expect(String((typed.envelope.error as { message?: unknown }).message)).toContain(
      "uncommitted tracker changes",
    );
    expect(calls.remove).toHaveLength(1);
    expect(existsSync(join(dirname(dir), `${basename(dir)}-task-rate-limit`))).toBe(false);
    expect(itemData(dir, "task-rate-limit")).toMatchObject({
      status: "in_progress",
      assignee: "someone",
    });
  });

  it("start attaches to an existing deterministic worktree instead of claiming a fresh copy", async () => {
    const dir = seedGitTree();
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const first = await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    const worktreePath = String((first.output as { worktreePath?: unknown }).worktreePath);

    // The canonical copy never sees the claim (records live on the feature
    // branch): a second start attaches to the fixed path and the worktree
    // copy's claim rule refuses the steal.
    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "intruder" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    expect((caught as ArgonToolError).code).toBe("START_FAILED");
    expect(calls.create).toHaveLength(1);
    expect(existsSync(worktreePath)).toBe(true);
    expect(itemData(dir, "task-rate-limit", worktreePath)).toMatchObject({
      status: "in_progress",
      assignee: "smoke",
    });
  });

  it("start without the domain fails typed and names the CLI fallback", async () => {
    const dir = seedGitTree();
    const defs = definitions(dir); // no worktree wiring
    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    expect(String((typed.envelope.error as { message?: unknown }).message)).toContain(
      "arggon start --worktree",
    );
  });

  it("branch records the convention branch name without touching git", async () => {
    const dir = seedGitTree();
    const defs = definitions(dir);
    const output = await tool(defs, "branch").execute({ id: "task-rate-limit" });
    expect(output.output.ok).toBe(true);
    expect(output.output.command).toBe("branch");
    expect(output.output.branch).toBe("feat/task-rate-limit");
    expect(itemData(dir, "task-rate-limit")).toMatchObject({ branch: "feat/task-rate-limit" });
  });

  it("cleanup classification is byte-identical to `cleanup --json --no-gh` (list mode)", async () => {
    const dir = seedGitTree();
    const { defs } = await completedWorktree(dir);

    const expected = runCli(["cleanup", "--no-gh"], dir);
    expect(expected.status, expected.stderr).toBe(0);
    const output = await tool(defs, "cleanup").execute({ no_gh: true });
    expect(`${JSON.stringify(output.output)}\n`).toBe(expected.stdout);
  });

  it("cleanup prune removes through the domain, deletes the merged branch and clears worktree_path in one commit", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs, calls } = await completedWorktree(dir);

    const output = await tool(defs, "cleanup").execute({ prune: true });
    const envelope = output.output as Record<string, unknown>;
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe("cleanup");
    expect(envelope.failures).toEqual([]);

    const candidates = envelope.candidates as Array<Record<string, unknown>>;
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: "task-rate-limit",
      status: "done",
      branch: "feat/task-rate-limit",
      removable: true,
      reason: null,
    });
    expect(envelope.pruned).toEqual([
      { id: "task-rate-limit", action: `removed worktree ${worktreePath}` },
      { id: "task-rate-limit", action: "deleted branch feat/task-rate-limit" },
      { id: "task-rate-limit", action: "cleared worktree_path" },
    ]);
    expect(envelope.commit).toMatchObject({ message: "chore(tasks): pruned task-rate-limit" });

    // Domain removal (never a direct git worktree remove in the plugin path).
    expect(calls.remove).toEqual([
      { projectID: "project-id", directory: worktreePath, force: false },
    ]);
    expect(existsSync(worktreePath)).toBe(false);
    expect(gitOut(dir, ["worktree", "list"]).includes("task-rate-limit")).toBe(false);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toBe("");
    expect(itemData(dir, "task-rate-limit").worktree_path).toBeUndefined();
    expect(itemData(dir, "task-rate-limit").status).toBe("done");
  });

  it("cleanup without prune lists only and never touches the worktree", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs, calls } = await completedWorktree(dir);

    const output = await tool(defs, "cleanup").execute({ no_gh: true });
    const envelope = output.output as Record<string, unknown>;
    expect((envelope.candidates as unknown[]).length).toBe(1);
    expect(envelope.pruned).toEqual([]);
    expect(envelope.commit).toBeUndefined();
    expect(calls.remove).toEqual([]);
    expect(existsSync(worktreePath)).toBe(true);
    expect(itemData(dir, "task-rate-limit").worktree_path).toBe(worktreePath);
  });

  it("cleanup skips non-terminal items and unmerged branches with a reason", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const started = await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    const worktreePath = String((started.output as { worktreePath?: unknown }).worktreePath);
    // Merge the claim so the canonical copy carries the records; keep the item
    // in_progress: only terminal items are pruned.
    git(dir, ["merge", "--no-ff", "feat/task-rate-limit", "-m", "Merge claim (stubbed)"]);

    const claimed = await tool(defs, "cleanup").execute({ no_gh: true });
    const claimedCandidate = (claimed.output.candidates as Array<Record<string, unknown>>)[0];
    expect(claimedCandidate.removable).toBe(false);
    expect(String(claimedCandidate.reason)).toContain("item is in_progress");

    // Done but unmerged (ancestry-only classification): skipped with a reason.
    const otherPath = join(dirname(dir), `${basename(dir)}-task-other`);
    git(dir, ["worktree", "add", "--detach", otherPath]);
    writeFileSync(join(otherPath, "other.txt"), "other\n", "utf8");
    git(otherPath, ["add", "other.txt"]);
    git(otherPath, ["commit", "-qm", "other work"]);
    git(otherPath, ["branch", "feat/task-other"]);
    runUpdate({
      cwd: dir,
      id: "task-rate-limit",
      status: "done",
      branch: "feat/task-other",
      worktreePath: otherPath,
    });
    const unmerged = await tool(defs, "cleanup").execute({ no_gh: true });
    const unmergedCandidate = (unmerged.output.candidates as Array<Record<string, unknown>>)[0];
    expect(unmergedCandidate.removable).toBe(false);
    expect(String(unmergedCandidate.reason)).toContain("not fully merged");
    expect(existsSync(worktreePath)).toBe(true);
    expect(existsSync(otherPath)).toBe(true);
  });

  it("cleanup fails typed outside a git repository", async () => {
    const dir = seedTree(); // tracker, no git
    const defs = definitions(dir);
    let caught: unknown;
    try {
      await tool(defs, "cleanup").execute({});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    expect((caught as ArgonToolError).code).toBe("CLEANUP_FAILED");
  });
});
