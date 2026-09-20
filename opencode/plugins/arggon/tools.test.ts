/**
 * Native `arggon` tool namespace contract tests (W2, task-native-tools).
 *
 * The plugin registers twelve in-process kernel tools (namespace `arggon`,
 * `options.codemode: true`) whose outputs are the documented `--json`
 * envelopes. These tests pin that contract without an OpenCode runtime:
 *
 *   1. **registration** — the transform receives the `arggon` namespace with
 *      the expected description and the twelve definitions, each with
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
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCreate, runUpdate } from "@arggon/lib";
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

/** The twelve tools the spec lists (spec-native-first-011 §Tools). */
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
