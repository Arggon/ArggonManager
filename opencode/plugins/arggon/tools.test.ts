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
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { MAX_GATE_BINS, MAX_MISSING_DEPENDENCIES, parseFrontmatter, runCreate, runUpdate } from "@arggondev/lib";
import { runInit } from "../../../cli/src/init.js";
import { tickAcceptance, tickAllAcceptance } from "../../../test/acceptance.js";
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
  resolveToolCwd,
  SESSION_ROOT_UNRESOLVED,
  sessionToken,
  type ArgonKernel,
  type ArgonToolDefinition,
} from "./index.js";
import { runCli as runCliBase } from "../../../cli/src/test-spawn.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");


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
afterEach(() => {
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
  // Done gate (task-done-gate-acceptance-waiver, ADR 0015): these suites flip
  // the leaf done for tool/lifecycle rules, so arrange a satisfied contract.
  tickAllAcceptance(dir);
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
  const proc = runCliBase(["--json", ...args], cwd, {
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
  git(dir, ["config", "maintenance.auto", "false"]);
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
  expect(loaded, "@arggondev/lib must resolve in the repo").toBeDefined();
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

/**
 * Tracker-root resolution from the calling session
 * (bug-native-tools-commit-to-primary-checkout).
 *
 * The regression: every native tool resolved the tracker from
 * `ctx.location.directory` captured once at plugin `setup`. V2 documents that as
 * "the plugin instance's location, not the location of every session it can
 * access or event it receives", so a session that `session_move`d into an item
 * worktree still read and committed to the PRIMARY checkout — twice in one
 * coordinator session a worker's evidence commit landed on the primary's `main`
 * instead of the item branch its PR is built from, and the tool still answered
 * `ok: true` with a hash no reviewer of that PR would see.
 *
 * These tests drive the real committing tools from a real linked worktree, with
 * the definitions bound to the PRIMARY location (exactly the value `setup` used
 * to freeze) and the session resolving to the worktree, then assert the branch,
 * the commit, reachability from the pushed item branch and an untouched primary.
 * The refusal cases pin that an unresolvable session directory fails loudly
 * instead of falling back to the plugin location.
 */
describe("tracker-root resolution from the calling session (bug-native-tools-commit-to-primary-checkout)", () => {
  const SESSION = "ses_root123";
  const ID = "task-rate-limit";
  const BRANCH = `fix/${ID}`;

  /**
   * Primary checkout on its base branch plus a real linked worktree checked out
   * on the item branch — what `arggon start --worktree` plus `session_move`
   * leave behind. `defs` carries the stale-by-design `cwd: primary`, so every
   * assertion below is about the per-call session resolution, not the fallback.
   */
  function scene(
    sessionDirectory?: (sessionID: string) => Promise<string | undefined>,
  ): {
    primary: string;
    worktree: string;
    base: string;
    head: string;
    defs: ArgonToolDefinition[];
    session: { sessionID?: unknown };
  } {
    const primary = seedGitTree();
    const base = gitOut(primary, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const head = gitOut(primary, ["rev-parse", "HEAD"]);
    const worktree = join(dirname(primary), `repo-${ID}`);
    git(primary, ["worktree", "add", "-q", "-b", BRANCH, worktree]);
    const defs = argonToolDefinitions(kernel, {
      cwd: primary,
      templatesDir: pluginTemplatesDir(),
      sessionDirectory:
        sessionDirectory ?? (async (sessionID) => (sessionID === SESSION ? worktree : undefined)),
    });
    return { primary, worktree, base, head, defs, session: { sessionID: SESSION } };
  }

  /** Item file bytes in one checkout (the tracker write under assertion). */
  function itemBytes(root: string): string {
    return readFileSync(
      join(root, "ArggonManager", "launch-mvp", "auth", "story-login", `${ID}.md`),
      "utf8",
    );
  }

  /**
   * The commit landed on the item branch INSIDE the worktree and the primary is
   * byte-for-byte untouched. Returns the hash so reachability can be asserted.
   */
  function committedInWorktree(
    ctx: { primary: string; worktree: string; head: string },
    output: Record<string, unknown>,
    name: string,
    itemBefore: string,
  ): string {
    expect(output.ok, name).toBe(true);
    const hash = String((output.commit as { hash?: unknown } | undefined)?.hash ?? "");
    expect(hash.length, `${name}: a commit hash is reported`).toBeGreaterThan(0);
    const head = gitOut(ctx.worktree, ["rev-parse", "HEAD"]);
    expect(gitOut(ctx.worktree, ["branch", "--show-current"]), `${name}: branch`).toBe(BRANCH);
    // The kernel reports an abbreviated hash; it is the worktree HEAD and it
    // resolves as a commit inside the worktree.
    expect(head.startsWith(hash), `${name}: the reported hash is the worktree HEAD`).toBe(true);
    expect(gitOut(ctx.worktree, ["rev-parse", `${hash}^{commit}`]), `${name}: resolvable`).toBe(head);
    // `--format` drops the `* ` current-branch marker the default listing adds.
    expect(
      gitOut(ctx.worktree, ["branch", "--contains", hash, "--format=%(refname:short)"]),
      `${name}: the commit is on the item branch`,
    ).toContain(BRANCH);
    // The primary checkout: no commit, no staged/untracked byte, item unchanged.
    expect(gitOut(ctx.primary, ["rev-parse", "HEAD"]), `${name}: primary HEAD`).toBe(ctx.head);
    expect(gitOut(ctx.primary, ["status", "--porcelain"]), `${name}: primary tree`).toBe("");
    expect(itemBytes(ctx.primary), `${name}: primary item bytes`).toBe(itemBefore);
    return hash;
  }

  it("resolves the tracker root from the session's worktree for comment, handoff, update, create and branch", async () => {
    const ctx = scene();
    const itemBefore = itemBytes(ctx.primary);

    // branch — records the convention branch on the item, inside the worktree.
    const branched = await tool(ctx.defs, "branch").execute(
      { id: ID, branch: BRANCH },
      ctx.session,
    );
    committedInWorktree(ctx, branched.output as Record<string, unknown>, "branch", itemBefore);

    // update — the claim the PR is built on.
    const updated = await tool(ctx.defs, "update").execute(
      { id: ID, status: "in_progress", assignee: "smoke" },
      ctx.session,
    );
    committedInWorktree(ctx, updated.output as Record<string, unknown>, "update", itemBefore);

    // A READ proves the root, not just the commit: the session sees the
    // worktree copy, the primary copy is still `todo`.
    const shown = await tool(ctx.defs, "show").execute({ id: ID, meta: true }, ctx.session);
    expect((shown.output as { item?: Record<string, unknown> }).item).toMatchObject({
      status: "in_progress",
      assignee: "smoke",
      branch: BRANCH,
    });
    expect(parseFrontmatter(itemBefore).data).toMatchObject({ status: "todo" });
    expect(parseFrontmatter(itemBefore).data.branch).toBeUndefined();

    const commented = await tool(ctx.defs, "comment").execute(
      { id: ID, text: "worktree evidence", author: "worker" },
      ctx.session,
    );
    committedInWorktree(ctx, commented.output as Record<string, unknown>, "comment", itemBefore);
    expect(itemBytes(ctx.worktree)).toContain("worktree evidence");
    expect(itemBytes(ctx.primary)).not.toContain("worktree evidence");

    const handed = await tool(ctx.defs, "handoff").execute(
      { id: ID, next: "open the PR", open_questions: "none" },
      ctx.session,
    );
    committedInWorktree(ctx, handed.output as Record<string, unknown>, "handoff", itemBefore);

    const created = await tool(ctx.defs, "create").execute(
      { type: "task", title: "Worktree note", parent: "story-login" },
      ctx.session,
    );
    const createdOutput = created.output as Record<string, unknown>;
    committedInWorktree(ctx, createdOutput, "create", itemBefore);
    // The new item exists in the worktree copy and NOT in the primary checkout.
    const createdPath = String(createdOutput.path ?? "");
    expect(createdPath.length).toBeGreaterThan(0);
    expect(existsSync(join(ctx.worktree, createdPath))).toBe(true);
    expect(existsSync(join(ctx.primary, createdPath))).toBe(false);
  });

  it("puts the worktree session's commit on the item branch the PR head is built from", async () => {
    const ctx = scene();
    const itemBefore = itemBytes(ctx.primary);
    // A local bare `origin` stands in for GitHub: a PR head is the pushed tip
    // of the item branch, so "reachable from it" is exactly this rev-parse.
    const remote = join(dirname(ctx.primary), "origin.git");
    git(ctx.primary, ["init", "-q", "--bare", remote]);
    git(ctx.primary, ["remote", "add", "origin", remote]);

    const commented = await tool(ctx.defs, "comment").execute(
      { id: ID, text: "PR evidence" },
      ctx.session,
    );
    const hash = committedInWorktree(ctx, commented.output as Record<string, unknown>, "comment", itemBefore);

    git(ctx.worktree, ["push", "-q", "-u", "origin", BRANCH]);
    expect(
      gitOut(remote, ["rev-parse", BRANCH]).startsWith(hash),
      "pushed item branch head carries the commit",
    ).toBe(true);
    // The primary's own branch never moved and carries none of it.
    expect(gitOut(ctx.primary, ["rev-parse", ctx.base])).toBe(ctx.head);
  });

  it("never writes to the primary while the session works in a worktree, even for a non-base-branch worktree", async () => {
    // The worktree above is a linked (non-main) worktree of the repo and the
    // session is the only actor; pin that the whole primary working tree stays
    // clean across every call, not just HEAD.
    const ctx = scene();
    const itemBefore = itemBytes(ctx.primary);
    await tool(ctx.defs, "update").execute({ id: ID, status: "in_progress", assignee: "smoke" }, ctx.session);
    await tool(ctx.defs, "comment").execute({ id: ID, text: "no primary writes" }, ctx.session);
    expect(gitOut(ctx.primary, ["status", "--porcelain"])).toBe("");
    // Still the one fixture commit: nothing of this session's work is in the
    // primary's history, and no untracked/staged byte is waiting there either.
    expect(gitOut(ctx.primary, ["rev-list", "--count", ctx.base]), "primary commits").toBe("1");
    expect(gitOut(ctx.primary, ["rev-parse", ctx.base]), "primary base head").toBe(ctx.head);
    expect(itemBytes(ctx.primary)).toBe(itemBefore);
  });

  it("refuses loudly instead of committing to the primary when the session directory is unresolvable", async () => {
    const ctx = scene(async () => undefined);
    const itemBefore = itemBytes(ctx.primary);
    await expect(
      tool(ctx.defs, "comment").execute({ id: ID, text: "must not land" }, ctx.session),
    ).rejects.toMatchObject({ code: SESSION_ROOT_UNRESOLVED, command: "comment" });
    // A refused call writes nothing at all — not a file, not a commit.
    expect(gitOut(ctx.primary, ["status", "--porcelain"])).toBe("");
    expect(gitOut(ctx.primary, ["rev-parse", "HEAD"])).toBe(ctx.head);
    expect(itemBytes(ctx.primary)).toBe(itemBefore);
  });

  it("treats a failing session lookup as unresolvable rather than falling back", async () => {
    const ctx = scene(async () => {
      throw new Error("session store unavailable");
    });
    const itemBefore = itemBytes(ctx.primary);
    await expect(
      tool(ctx.defs, "handoff").execute({ id: ID, next: "must not land" }, ctx.session),
    ).rejects.toMatchObject({ code: SESSION_ROOT_UNRESOLVED, command: "handoff" });
    expect(gitOut(ctx.primary, ["status", "--porcelain"])).toBe("");
    expect(itemBytes(ctx.primary)).toBe(itemBefore);
  });

  it("uses the session's own checkout when that checkout is not a worktree", async () => {
    // Documented behavior for a session running from a plain checkout: the
    // tracker resolves there and the commit lands on the branch checked out
    // there — which is the pre-existing, unchanged path.
    const primary = seedGitTree();
    const head = gitOut(primary, ["rev-parse", "HEAD"]);
    const defs = argonToolDefinitions(kernel, {
      cwd: primary,
      templatesDir: pluginTemplatesDir(),
      sessionDirectory: async () => primary,
    });
    const output = (
      await tool(defs, "comment").execute({ id: ID, text: "in the checkout" }, { sessionID: SESSION })
    ).output as Record<string, unknown>;
    expect(output.ok).toBe(true);
    const hash = String((output.commit as { hash?: unknown }).hash);
    expect(gitOut(primary, ["rev-parse", "HEAD"]).startsWith(hash)).toBe(true);
    expect(gitOut(primary, ["rev-parse", "HEAD"])).not.toBe(head);
    expect(itemBytes(primary)).toContain("in the checkout");
  });

  it("keeps the plugin location for a call that carries no calling session", async () => {
    const primary = seedGitTree();
    const defs = argonToolDefinitions(kernel, {
      cwd: primary,
      templatesDir: pluginTemplatesDir(),
      sessionDirectory: async () => {
        throw new Error("must not be consulted without a session");
      },
    });
    const output = (
      // Explicit author: the call exercises plugin-location resolution, not
      // host-identity lookup — keep it hermetic (task-spawned-tests-gh-path).
      await tool(defs, "comment").execute({ id: ID, text: "ambient", author: "ambient-agent" })
    ).output as Record<string, unknown>;
    expect(output.ok).toBe(true);
    expect(itemBytes(primary)).toContain("ambient");
  });
});

describe("resolveToolCwd: per-call tracker root (bug-native-tools-commit-to-primary-checkout)", () => {
  const options = {
    cwd: "/primary",
    sessionDirectory: async (sessionID: string) =>
      sessionID === "ses_work" ? "/worktrees/repo-task-x" : undefined,
  };

  it("prefers the calling session's directory over the plugin location", async () => {
    expect(await resolveToolCwd(kernel, "comment", options, { sessionID: "ses_work" })).toEqual({
      cwd: "/worktrees/repo-task-x",
    });
  });

  it("falls back to the plugin location without a session or without the resolver", async () => {
    expect(await resolveToolCwd(kernel, "list", options)).toEqual({ cwd: "/primary" });
    expect(await resolveToolCwd(kernel, "list", options, { sessionID: 42 })).toEqual({ cwd: "/primary" });
    expect(await resolveToolCwd(kernel, "list", { cwd: "/primary" }, { sessionID: "ses_work" })).toEqual({
      cwd: "/primary",
    });
  });

  it("is a typed failure carrying the envelope, never a silent fallback", async () => {
    const unresolved = await resolveToolCwd(kernel, "handoff", options, { sessionID: "ses_gone" });
    expect("cwd" in unresolved).toBe(false);
    const error = (unresolved as { error: ArgonToolError }).error;
    expect(error).toBeInstanceOf(ArgonToolError);
    expect(error.code).toBe(SESSION_ROOT_UNRESOLVED);
    expect(error.command).toBe("handoff");
    expect(error.envelope).toMatchObject({
      ok: false,
      command: "handoff",
      error: { code: SESSION_ROOT_UNRESOLVED },
    });
    expect(String(error.envelope.error).length).toBeGreaterThan(0);
    expect(JSON.stringify(error.envelope)).toContain("ses_gone");
    expect(JSON.stringify(error.envelope)).toContain("/primary");
  });
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
  // Keep every sibling worktree/remote under one tracked parent. The domain
  // derives sibling paths from the repo basename, so the child layout makes
  // teardown remove the whole fixture instead of leaving a /tmp worktree.
  const parent = mkdtemp(`${prefix}parent-`);
  const dir = join(parent, "repo");
  mkdirSync(dir);
  seedInto(dir);
  git(dir, ["init", "-q"]);
  git(dir, ["config", "maintenance.auto", "false"]);
  git(dir, ["config", "user.email", "w4@example.com"]);
  git(dir, ["config", "user.name", "w4"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", "fixture"]);
  return dir;
}

/** Add a dependency only the primary checkout has; start must link it. */
function addNativeGateDependency(dir: string): void {
  const dep = join(dir, "node_modules", "native-gate-dep");
  mkdirSync(dep, { recursive: true });
  writeFileSync(join(dep, "package.json"), JSON.stringify({ name: "native-gate-dep", main: "index.js" }));
  writeFileSync(join(dep, "index.js"), "module.exports = true;\n");
}

/**
 * Commit a root `package.json` on top of the seeded tree (start refuses a dirty
 * tree) — the declaration the shared preparation receipt checks
 * (bug-worktree-readiness-misses-stale-primary-install).
 */
function addNativeManifest(dir: string, manifest: Record<string, unknown>): void {
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  git(dir, ["add", "package.json"]);
  git(dir, ["commit", "-qm", "test: declare dependencies"]);
}

/** Install a real (never bypassed) dependency-requiring pre-commit gate. */
function setNativePreCommitHook(dir: string, script: string): void {
  const hook = join(dir, ".git", "hooks", "pre-commit");
  mkdirSync(join(dir, ".git", "hooks"), { recursive: true });
  writeFileSync(hook, script.endsWith("\n") ? script : `${script}\n`, "utf8");
  chmodSync(hook, 0o755);
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

/**
 * Claim → worktree → commit → merge (stub PR) → done; returns the worktree
 * path. `withDomain` (optional) replaces the fake domain before the lifecycle
 * runs, so a test can drive the removal contract the happy path never hits.
 */
async function completedWorktree(
  dir: string,
  id = "task-rate-limit",
  withDomain?: (fake: ReturnType<typeof fakeDomain>) => void,
): Promise<{ worktreePath: string; defs: ArgonToolDefinition[]; calls: ReturnType<typeof fakeDomain>["calls"] }> {
  const { domain, calls } = fakeDomain(dir);
  withDomain?.({ domain, calls });
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
    // A cold checkout without an install is reported honestly: the claim can
    // still commit when no gate needs dependencies, but readiness is false.
    expect(output.preparation).toMatchObject({
      ready: false,
      install: "missing",
      linkedNodeModules: false,
      // The preparation log names what ran (bug-start-install-ordering): the
      // primary had no install to link, and with nothing declared the probe
      // verdict is vacuous.
      steps: [
        { step: "link", outcome: "primary-install-missing" },
        { step: "gate-bins", outcome: "all-worktree" },
      ],
    });
    expect(output.claimCommitted).toBe(true);
    expect(output.claimCommit).toMatchObject({ status: "committed", committed: true });

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

  it("keeps worktree:false on the created item branch, pushes once, and attaches without a duplicate", async () => {
    const dir = seedGitTree();
    const recorded = join(dirname(dir), `${basename(dir)}-legacy-rate-limit`);
    const remote = join(dirname(dir), `${basename(dir)}-remote.git`);
    git(dirname(remote), ["init", "--bare", "-q", remote]);
    git(remote, ["config", "maintenance.auto", "false"]);
    git(dir, ["remote", "add", "origin", remote]);
    git(dir, ["worktree", "add", "--detach", recorded]);
    runUpdate({ cwd: dir, id: "task-rate-limit", worktreePath: recorded });
    if (gitOut(dir, ["status", "--porcelain"]) !== "") {
      git(dir, ["add", "ArggonManager"]);
      git(dir, ["commit", "-qm", "test: record legacy worktree"]);
    }
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    const output = (await tool(defs, "start").execute({
      id: "task-rate-limit",
      assignee: "smoke",
      worktree: false,
      push: true,
    })).output as Record<string, unknown>;
    const branch = "feat/task-rate-limit";

    expect(calls.create).toHaveLength(0);
    expect(output.worktreePath).toBeNull();
    expect(output.preparation).toBeUndefined();
    expect(output.branchCreated).toBe(true);
    expect(output.pushed).toBe(true);
    expect(output.claimCommitted).toBe(true);
    expect(output.claimCommit).toMatchObject({ status: "committed", committed: true });
    expect(gitOut(dir, ["branch", "--show-current"])).toBe(branch);
    expect(gitOut(dir, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(branch);
    expect(gitOut(dir, ["log", "-1", "--pretty=%s"])).toBe(
      "chore(tasks): claimed task-rate-limit",
    );
    expect(gitOut(remote, ["rev-parse", "--verify", `refs/heads/${branch}`])).toMatch(/^[0-9a-f]+$/);
    // The old record is preserved, but this invocation did not enter that tree.
    expect(itemData(dir, "task-rate-limit")).toMatchObject({
      status: "in_progress",
      assignee: "smoke",
      branch,
      worktree_path: recorded,
    });
    expect(existsSync(recorded)).toBe(true);
    expect(gitOut(recorded, ["status", "--porcelain"])).toBe("");

    const attach = (await tool(defs, "start").execute({
      id: "task-rate-limit",
      assignee: "smoke",
      worktree: false,
      push: true,
    })).output as Record<string, unknown>;
    expect(attach.branchCreated).toBe(false);
    expect(attach.claimCommitted).toBe(true);
    expect(attach.claimCommit).toMatchObject({ status: "not-needed", committed: true });
    expect(attach.pushed).toBe(false);
    expect(gitOut(dir, ["branch", "--show-current"])).toBe(branch);
    expect(gitOut(dir, ["log", "-1", "--pretty=%s"])).toBe(
      "chore(tasks): claimed task-rate-limit",
    );
  });

  it("leaves the item untouched when a divergent recorded branch cannot be switched to", async () => {
    const dir = seedGitTree();
    const branch = "feat/task-rate-limit";
    // The item records a branch, and that branch exists — but checking it out
    // cannot complete: the canonical checkout holds an UNTRACKED file with the
    // same name as a file committed on the branch. `git switch` refuses, which
    // is the reviewer's divergent-recorded-branch repro.
    runUpdate({ cwd: dir, id: "task-rate-limit", branch });
    if (gitOut(dir, ["status", "--porcelain"]) !== "") {
      git(dir, ["add", "ArggonManager"]);
      git(dir, ["commit", "-qm", "test: record item branch"]);
    }
    const base = gitOut(dir, ["branch", "--show-current"]);
    git(dir, ["branch", branch]);
    git(dir, ["switch", branch]);
    writeFileSync(join(dir, "divergent.txt"), "committed on the item branch\n", "utf8");
    git(dir, ["add", "divergent.txt"]);
    git(dir, ["commit", "-qm", "test: branch-only file"]);
    git(dir, ["switch", base]);
    writeFileSync(join(dir, "divergent.txt"), "untracked in the canonical checkout\n", "utf8");
    const itemPath = join(
      dir,
      "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md",
    );
    const before = readFileSync(itemPath, "utf8");

    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    let caught: unknown;
    try {
      await tool(defs, "start").execute({
        id: "task-rate-limit",
        assignee: "smoke",
        worktree: false,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    expect(String((typed.envelope.error as { message?: unknown }).message)).toContain(
      "branch setup failed",
    );
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
      reason: "branch setup failed",
    });
    // The claim never ran: the item file is byte-identical and still unclaimed,
    // and the failed switch left the canonical checkout where it was.
    expect(readFileSync(itemPath, "utf8")).toBe(before);
    expect(itemData(dir, "task-rate-limit")).toMatchObject({ status: "todo", branch });
    expect(itemData(dir, "task-rate-limit").assignee).toBeUndefined();
    expect(calls.create).toHaveLength(0);
    expect(gitOut(dir, ["branch", "--show-current"])).toBe(base);
    expect(gitOut(dir, ["branch", "--list", branch])).toContain(branch);
    expect(gitOut(dir, ["status", "--porcelain"])).toContain("divergent.txt");
  });

  it("rolls back only the branch it created when the plain claim update is refused", async () => {
    const dir = seedGitTree();
    const branch = "feat/task-rate-limit";
    const base = gitOut(dir, ["branch", "--show-current"]);
    // Another agent already owns the claim, so our update is refused AFTER the
    // branch has been created and checked out.
    runUpdate({ cwd: dir, id: "task-rate-limit", status: "in_progress", assignee: "owner" });
    if (gitOut(dir, ["status", "--porcelain"]) !== "") {
      git(dir, ["add", "ArggonManager"]);
      git(dir, ["commit", "-qm", "test: commit owner claim"]);
    }

    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    let caught: unknown;
    try {
      await tool(defs, "start").execute({
        id: "task-rate-limit",
        assignee: "intruder",
        worktree: false,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({ status: "not-attempted", committed: false });
    expect(typed.envelope.rollback).toMatchObject({ branchDeleted: true, restoredBranch: base });
    expect(String((typed.envelope.error as { message?: unknown }).message)).toContain(
      "the branch created by this run was removed again",
    );
    // Owned branch gone, checkout restored, and the existing claim untouched.
    expect(gitOut(dir, ["branch", "--list", branch])).toBe("");
    expect(gitOut(dir, ["branch", "--show-current"])).toBe(base);
    expect(itemData(dir, "task-rate-limit")).toMatchObject({
      status: "in_progress",
      assignee: "owner",
    });
    expect(itemData(dir, "task-rate-limit").branch).toBeUndefined();
    expect(gitOut(dir, ["status", "--porcelain"])).toBe("");
  });

  it("keeps the claim receipt truthful when successEnvelope throws after a real commit", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    // A kernel whose success-envelope builder throws: everything up to and
    // including the claim commit runs for real, then the response blows up.
    const throwingKernel = {
      ...kernel,
      successEnvelope: () => {
        throw new Error("envelope builder exploded");
      },
    } as unknown as ArgonKernel;
    const defs = argonToolDefinitions(throwingKernel, {
      cwd: dir,
      templatesDir: pluginTemplatesDir(),
      worktree: { projectID: "project-id", canonical: dir, domain },
    });

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    const claimCommit = typed.envelope.claimCommit as Record<string, unknown>;
    // The commit really landed, so the receipt must say so — never not-attempted.
    expect(typed.envelope.claimCommitted).toBe(true);
    expect(claimCommit).toMatchObject({ status: "committed", committed: true });
    expect(String(claimCommit.hash)).toMatch(/^[0-9a-f]+$/);
    expect(String((typed.envelope.error as { message?: unknown }).message)).toContain(
      "the claim commit already landed",
    );
    const worktreePath = String(typed.envelope.worktreePath);
    // Git state corroborates the receipt: the claim commit is really in history.
    expect(gitOut(worktreePath, ["log", "-1", "--pretty=%s"])).toBe(
      "chore(tasks): claimed task-rate-limit",
    );
    expect(gitOut(worktreePath, ["rev-parse", "--short", "HEAD"])).toBe(String(claimCommit.hash));
    expect(itemData(dir, "task-rate-limit", worktreePath)).toMatchObject({
      status: "in_progress",
      assignee: "smoke",
    });
  });

  it("returns a not-attempted receipt for a branch ownership conflict", async () => {
    const dir = seedGitTree();
    git(dir, ["branch", "feat/task-rate-limit"]);
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    let caught: unknown;
    try {
      await tool(defs, "start").execute({
        id: "task-rate-limit",
        assignee: "smoke",
        worktree: false,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
      reason: "branch ownership conflict",
    });
    expect(calls.create).toHaveLength(0);
    expect(itemData(dir, "task-rate-limit")).toMatchObject({ status: "todo" });
    expect(gitOut(dir, ["branch", "--show-current"])).not.toBe("feat/task-rate-limit");
  });

  it("fails plain start before claim mutation when the item branch is checked out elsewhere", async () => {
    const dir = seedGitTree();
    const sibling = join(dirname(dir), `${basename(dir)}-branch-holder`);
    git(dir, ["worktree", "add", "-b", "feat/task-rate-limit", sibling]);
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    let caught: unknown;
    try {
      await tool(defs, "start").execute({
        id: "task-rate-limit",
        assignee: "smoke",
        branch: "feat/task-rate-limit",
        worktree: false,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
      reason: "plain-start preflight failed",
    });
    expect(itemData(dir, "task-rate-limit")).toMatchObject({ status: "todo" });
    expect(calls.create).toHaveLength(0);
  });

  it("returns a not-attempted receipt before root/item resolution", async () => {
    const defs = definitions(root);
    let caught: unknown;
    try {
      await tool(defs, "start").execute({ assignee: "smoke" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
    });
  });

  it("does not report an ignored item as already-committed when branch-only start writes it", async () => {
    const dir = seedGitTree();
    const itemPath =
      "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md";
    git(dir, ["rm", "--cached", "--", itemPath]);
    writeFileSync(join(dir, ".gitignore"), `${itemPath}\n`, "utf8");
    git(dir, ["add", ".gitignore"]);
    git(dir, ["commit", "-qm", "test: ignore item path"]);
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    let caught: unknown;
    try {
      await tool(defs, "start").execute({
        id: "task-rate-limit",
        assignee: "smoke",
        worktree: false,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({ status: "failed", committed: false });
    const commit = typed.envelope.commit as Record<string, unknown>;
    expect(String(commit.skipped)).toContain("all mutated paths are ignored");
  });

  it("prepares a dependency-requiring gate and reports readiness plus the claim commit", async () => {
    const dir = seedGitTree();
    addNativeGateDependency(dir);
    setNativePreCommitHook(
      dir,
      "#!/bin/sh\nnode -e \"require('native-gate-dep')\" || exit 1\ntouch .native-gate-ran\n",
    );
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    const started = await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    const output = started.output as Record<string, unknown>;
    const worktreePath = String(output.worktreePath);
    const preparation = output.preparation as Record<string, unknown>;
    const claimCommit = output.claimCommit as Record<string, unknown>;

    expect(output.ok).toBe(true);
    expect(preparation).toMatchObject({
      ready: true,
      install: "linked",
      linkedNodeModules: true,
      linkedWorkspaces: [],
    });
    // Worktree env contract (spec worktree-env-contract-016): the native
    // receipt forwards the kernel's bounded env fragment.
    expect(preparation.env).toMatchObject({
      written: true,
      keys: [
        "ARGON_ITEM",
        "ARGGON_WORKTREE_ID",
        "ARGGON_WORKTREE_PATH",
        "ARGGON_WORKTREE_BRANCH",
        "ARGGON_STATE_DIR",
        "ARGGON_CACHE_DIR",
      ],
    });
    expect(existsSync(join(worktreePath, ".arggon.env"))).toBe(true);
    expect(readFileSync(join(worktreePath, ".arggon.env"), "utf8")).toContain(
      `ARGON_ITEM=task-rate-limit\n`,
    );
    expect(output.claimCommitted).toBe(true);
    expect(claimCommit).toMatchObject({ status: "committed", committed: true });
    expect(output.commit).toMatchObject({ message: "chore(tasks): claimed task-rate-limit" });
    // The gate really ran in the fresh worktree; no --no-verify escape hatch.
    expect(existsSync(join(worktreePath, ".native-gate-ran"))).toBe(true);
    expect(gitOut(worktreePath, ["log", "-1", "--pretty=%s"])).toBe(
      "chore(tasks): claimed task-rate-limit",
    );
    // ADR 0006: the coverage fields travel in the RESULT, not the catalog —
    // the `start` definition gains no schema bytes and no description text.
    const startSchema = JSON.stringify(nativeToolSchemas().find((schema) => schema.name === "start"));
    expect(startSchema).not.toContain("manifestCoverage");
    expect(startSchema).not.toContain("missingDependencies");
  });

  it("refuses a fresh worktree whose stale mirrored install cannot provide a declared gate bin (bug-worktree-readiness-misses-stale-primary-install + bug-start-install-ordering)", async () => {
    // The measured machine state, reproduced deterministically: the primary's
    // install predates a merged devDependency, so the linked install (which
    // mirrors it) cannot resolve that name. The receipt used to say
    // `ready: true` and the claim landed anyway (incident 3's "readiness
    // passed while the environment needed hand-install"); a start that
    // created the worktree now refuses, naming the dependency.
    const dir = seedGitTree();
    addNativeGateDependency(dir);
    addNativeManifest(dir, {
      name: "fixture",
      dependencies: { "native-gate-dep": "1.0.0" },
      devDependencies: { "@ast-grep/cli": "0.45.3" },
    });
    setNativePreCommitHook(dir, "#!/bin/sh\nnode -e \"require('native-gate-dep')\" || exit 1\n");
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    const payload = typed.envelope;
    const preparation = payload.preparation as Record<string, unknown>;

    // The linked install is still there and still reported as linked...
    expect(preparation).toMatchObject({ install: "linked", linkedNodeModules: true });
    // ...but readiness is not silently claimed, the reason is IN the payload
    // (a native caller does not shell out to the CLI to learn which declared
    // dependency the mirrored install is missing), and a start that created
    // the worktree refuses the claim instead of landing it on a broken env.
    expect(preparation.ready).toBe(false);
    expect(preparation.manifestCoverage).toBe("stale");
    expect(preparation.missingDependencies).toEqual(["@ast-grep/cli"]);
    expect(preparation.missingDependenciesTotal).toBe(1);
    expect(payload.ok).toBe(false);
    expect(typed.code).toBe("START_FAILED");
    const claimCommit = payload.claimCommit as Record<string, unknown>;
    expect(claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
      reason: "fresh-worktree install gate refused",
    });
    const message = String((payload.error as Record<string, unknown>).message);
    expect(message).toContain("@ast-grep/cli: not resolvable from the worktree");
    expect(message).toContain("npm install");
    const worktreePath = String(payload.worktreePath);
    expect(existsSync(worktreePath)).toBe(true);
    expect(itemData(dir, "task-rate-limit", worktreePath)).toMatchObject({ status: "todo" });
  });

  it("refuses the claim with the capped missing-dependency receipt intact (cap travels through the refusal)", async () => {
    const dir = seedGitTree();
    addNativeGateDependency(dir);
    const declared: Record<string, string> = {};
    for (let index = 0; index < MAX_MISSING_DEPENDENCIES + 3; index += 1) {
      declared[`absent-dep-${index}`] = "1.0.0";
    }
    addNativeManifest(dir, { name: "fixture", devDependencies: declared });
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const preparation = ((caught as ArgonToolError).envelope.preparation ?? {}) as Record<
      string,
      unknown
    >;

    expect(preparation.manifestCoverage).toBe("stale");
    expect(preparation.ready).toBe(false);
    // The kernel's cap is forwarded, not re-derived, and the total keeps the
    // capped list from being read as the whole set.
    expect(preparation.missingDependencies).toHaveLength(MAX_MISSING_DEPENDENCIES);
    expect(preparation.missingDependenciesTotal).toBe(MAX_MISSING_DEPENDENCIES + 3);
    expect(preparation.truncated).toBe(true);
  });

  it("keeps the worktree and reports a skipped claim commit when the gate fails, then retries on attach", async () => {
    const dir = seedGitTree();
    setNativePreCommitHook(dir, '#!/bin/sh\necho "native gate: missing dependency" >&2\nexit 1\n');
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    const payload = typed.envelope;
    const error = payload.error as Record<string, unknown>;
    const worktreePath = String(payload.worktreePath);
    const claimCommit = payload.claimCommit as Record<string, unknown>;

    expect(typed.code).toBe("START_FAILED");
    expect(payload.ok).toBe(false);
    expect(payload.preparation).toMatchObject({
      ready: false,
      install: "missing",
      linkedNodeModules: false,
    });
    expect(payload.claimCommitted).toBe(false);
    expect(claimCommit).toMatchObject({ status: "failed", committed: false });
    expect(String(error.message)).toContain("committing the claim");
    expect(String(error.message)).toContain("worktree was kept");
    expect(String(error.message)).toContain("tools.arggon.start");
    expect(String(claimCommit.skipped)).toContain("native gate: missing dependency");
    expect(existsSync(worktreePath)).toBe(true);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toContain(
      "feat/task-rate-limit",
    );
    expect(
      gitOut(worktreePath, [
        "status",
        "--porcelain",
        "--",
        "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md",
      ]),
    ).not.toBe("");

    // Fix the shared hook and attach: the dirty claim is retried, not silently
    // accepted as a no-op.
    setNativePreCommitHook(dir, "#!/bin/sh\nexit 0\n");
    const retry = await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    const retryOutput = retry.output as Record<string, unknown>;
    expect(retryOutput.worktreeCreated).toBe(false);
    expect(retryOutput.worktreePath).toBe(worktreePath);
    expect(retryOutput.claimCommitted).toBe(true);
    expect(retryOutput.claimCommit).toMatchObject({ status: "committed", committed: true });
    expect(gitOut(worktreePath, ["log", "-1", "--pretty=%s"])).toBe(
      "chore(tasks): claimed task-rate-limit",
    );
  });

  it("refuses a fresh worktree whose gate bin resolves nowhere, BEFORE the claim, by default (bug-start-install-ordering)", async () => {
    // The measured machine state, reproduced deterministically: no install
    // anywhere (the worktree has no node_modules and the primary has none), a
    // manifest declaring the gate binary, and a PATH-lookup gate like `npm run`
    // resolving tsx. This is the eight-incident record's "no install at all"
    // flavor: the preparation used to degrade silently and the claim commit
    // died at the gate with a bare `command not found`. The fresh-worktree
    // install gate now refuses BEFORE any claim, with the named cause.
    const dir = seedGitTree();
    addNativeManifest(dir, { name: "fixture", devDependencies: { "native-gate-dep": "1.0.0" } });
    setNativePreCommitHook(
      dir,
      '#!/bin/sh\ncommand -v native-gate-dep >/dev/null 2>&1 || { echo "sh: native-gate-dep: command not found" >&2; exit 1; }\n',
    );
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    const payload = typed.envelope;

    // The receipt carries the resolution: the declared dep is installed
    // nowhere, so its own name is probed (npm's string-bin convention) and it
    // reports missing, with no path.
    const preparation = payload.preparation as {
      gateBins?: Array<{ name: string; source: string; path?: string }>;
      steps?: Array<{ step: string; outcome: string; pkg?: string }>;
    };
    expect(preparation.gateBins).toEqual([{ name: "native-gate-dep", source: "missing" }]);
    expect(preparation.ready).toBe(false);
    // The preparation log names the decision that produced the state
    // (bug-start-install-ordering instrumentation).
    expect(preparation.steps).toEqual([
      { step: "link", outcome: "primary-install-missing" },
      { step: "gate-bins", outcome: "foreign-resolution" },
    ]);

    // The refusal names the flavor, the preparation log, and the fix — and it
    // happened BEFORE the claim update: not-attempted receipt, item copy todo.
    const error = payload.error as Record<string, unknown>;
    const message = String(error.message);
    expect(message).toContain("fresh worktree must leave a gate-usable install");
    expect(message).toContain("native-gate-dep: not resolvable from the worktree");
    expect(message).toContain("Preparation ran: link:primary-install-missing");
    expect(message).toContain("npm ci");
    const claimCommit = payload.claimCommit as Record<string, unknown>;
    expect(claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
      reason: "fresh-worktree install gate refused",
    });
    const worktreePath = String(payload.worktreePath);
    expect(existsSync(worktreePath)).toBe(true);
    expect(itemData(dir, "task-rate-limit", worktreePath)).toMatchObject({ status: "todo" });
  });

  it("refuses a fresh worktree whose gate bin resolves only via PATH, by default (bug-start-install-ordering masking flavor)", async () => {
    // Incident 1's flavor: the sibling's bin masks the absent worktree install
    // — the gate USED to pass through the PATH lookup and the claim landed on
    // a broken environment. A start that created the worktree now refuses the
    // claim instead of handing the worker that state, naming the sibling.
    const dir = seedGitTree();
    addNativeManifest(dir, { name: "fixture", devDependencies: { "native-gate-dep": "1.0.0" } });
    setNativePreCommitHook(dir, "#!/bin/sh\ncommand -v native-gate-dep >/dev/null 2>&1 || exit 1\n");
    const siblingBinDir = join(dirname(dir), "sibling", "node_modules", ".bin");
    mkdirSync(siblingBinDir, { recursive: true });
    writeFileSync(join(siblingBinDir, "native-gate-dep"), "#!/bin/sh\nexit 0\n", "utf8");
    chmodSync(join(siblingBinDir, "native-gate-dep"), 0o755);
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const savedPath = process.env.PATH ?? "";
    let caught: unknown;
    process.env.PATH = `${siblingBinDir}:${savedPath}`;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    } finally {
      process.env.PATH = savedPath;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    const payload = typed.envelope;
    const preparation = payload.preparation as {
      ready?: unknown;
      gateBins?: Array<{ name: string; source: string; path?: string }>;
    };
    // The same observation strict mode uses — the receipt names the foreign
    // source and withholds readiness; the fresh gate changes the consequence.
    expect(preparation.ready).toBe(false);
    expect(preparation.gateBins).toEqual([
      { name: "native-gate-dep", source: "path", path: join(siblingBinDir, "native-gate-dep") },
    ]);
    const claimCommit = payload.claimCommit as Record<string, unknown>;
    expect(claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
      reason: "fresh-worktree install gate refused",
    });
    const message = String((payload.error as Record<string, unknown>).message);
    expect(message).toContain(
      `native-gate-dep: resolves only via PATH from ${join(siblingBinDir, "native-gate-dep")}`,
    );
    expect(itemData(dir, "task-rate-limit", String(payload.worktreePath))).toMatchObject({
      status: "todo",
    });
  });

  it("keeps the npm ci remedy and the preparation log inside the clipped fresh-worktree refusal when the named-bin list is at its worst case (bug-native-refusal-advice-clipped-by-head-clip)", async () => {
    const dir = seedGitTree();
    const devDependencies: Record<string, string> = {};
    const names: string[] = [];
    for (let index = 0; index < MAX_GATE_BINS; index += 1) {
      const name = `worktree-gate-binary-number-${index}-with-a-very-long-name-for-the-clip`;
      devDependencies[name] = "1.0.0";
      names.push(name);
    }
    addNativeManifest(dir, { name: "fixture", devDependencies });
    // The FULL MAX_GATE_BINS list (every gate-bin name the kernel can report;
    // every other test here names one bin, which can never trip the 2048-char
    // head clip) of PATH-masked shims under a deep sibling. Each entry costs
    // ~270 chars (long name + the deep sibling path), so this is the reachable
    // worst case — the acceptance's 10 long paths is the write gate's
    // `MAX_CLAIM_WRITE_NAMES` cap, not a bin cap — and it overruns the cap by
    // several entries. `startFailure` clips the composed message at
    // MAX_NATIVE_ERROR_CHARS = 2048 and keeps the HEAD, so advice APPENDED
    // after the kernel refusal — or the remedy the refusal itself tails — is
    // exactly what the clip eats. The remedies must therefore lead.
    const siblingBinDir = join(
      dirname(dir),
      "deeply",
      "nested",
      "module",
      "path",
      "number",
      "with",
      "a",
      "long",
      "sibling",
      "checkout",
      "node_modules",
      ".bin",
    );
    mkdirSync(siblingBinDir, { recursive: true });
    for (const name of names) {
      writeFileSync(join(siblingBinDir, name), "#!/bin/sh\nexit 0\n", "utf8");
      chmodSync(join(siblingBinDir, name), 0o755);
    }
    setNativePreCommitHook(dir, "#!/bin/sh\nexit 1\n");
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const savedPath = process.env.PATH ?? "";
    process.env.PATH = `${siblingBinDir}:${savedPath}`;
    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    } finally {
      process.env.PATH = savedPath;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    const payload = typed.envelope;
    const claimCommit = payload.claimCommit as Record<string, unknown>;
    expect(claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
      reason: "fresh-worktree install gate refused",
    });
    const message = String((payload.error as { message?: unknown }).message);
    const sorted = [...names].sort();
    const firstEntry = `${sorted[0]}: resolves only via PATH from ${join(siblingBinDir, sorted[0])}`;
    // The actionable advice survives the clip: the prep log and the `npm ci`
    // remedy come FIRST (with the native worktree-kept/attach re-run ahead of
    // the kernel refusal entirely), so the head-clip keeps them.
    expect(message).toContain("The worktree was kept at");
    expect(message).toContain("npm ci");
    expect(message).toContain("Preparation ran:");
    const firstNamedIndex = message.indexOf(firstEntry);
    expect(firstNamedIndex).toBeGreaterThan(-1);
    expect(message.indexOf("The worktree was kept at")).toBeLessThan(firstNamedIndex);
    expect(message.indexOf("npm ci")).toBeLessThan(firstNamedIndex);
    expect(message.indexOf("Preparation ran:")).toBeLessThan(firstNamedIndex);
    // Negative control: the message is pinned at the cap and the LAST named
    // entry is gone — the test cannot pass on a merely longer message.
    expect(message.length).toBe(2048);
    expect(message).not.toContain(sorted[sorted.length - 1]);
  });

  /**
   * Arm `x-tracker.strict-gate-bins` (task-start-gate-strict-mode) on the
   * seeded tree. Committed: a dirty tracker tree would trip start's stale
   * canonical-claim guard instead of exercising the flag.
   */
  function armStrictGateBins(dir: string): void {
    const config = join(dir, "ArggonManager", ".convention.yml");
    writeFileSync(
      config,
      `${readFileSync(config, "utf8")}x-tracker:\n  strict-gate-bins: true\n`,
      "utf8",
    );
    git(dir, ["add", "ArggonManager/.convention.yml"]);
    git(dir, ["commit", "-qm", "test: arm the strict gate-bin gate"]);
  }

  /** Install one bin-bearing package (plus its `.bin` shim) into an install dir. */
  function installGateDepBin(modulesDir: string): void {
    const dep = join(modulesDir, "native-gate-dep");
    mkdirSync(dep, { recursive: true });
    writeFileSync(
      join(dep, "package.json"),
      JSON.stringify({
        name: "native-gate-dep",
        version: "1.0.0",
        bin: { "native-gate-dep": "./index.js" },
      }),
    );
    const binDir = join(modulesDir, ".bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "native-gate-dep"), "#!/bin/sh\nexit 0\n", "utf8");
    chmodSync(join(binDir, "native-gate-dep"), 0o755);
  }

  it("refuses the claim before the claim update when strict-gate-bins is armed and the bin resolves outside the worktree (task-start-gate-strict-mode)", async () => {
    // The same sibling-PATH masking shape as the report-only test above, but
    // with the flag armed: the resolution must HARD-FAIL the claim instead of
    // only withholding readiness — and the item copy must stay untouched.
    const dir = seedGitTree();
    addNativeManifest(dir, { name: "fixture", devDependencies: { "native-gate-dep": "1.0.0" } });
    armStrictGateBins(dir);
    setNativePreCommitHook(dir, "#!/bin/sh\ncommand -v native-gate-dep >/dev/null 2>&1 || exit 1\n");
    const siblingModules = join(dirname(dir), "sibling-strict", "node_modules");
    installGateDepBin(siblingModules);
    const siblingBinDir = join(siblingModules, ".bin");
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const savedPath = process.env.PATH ?? "";
    process.env.PATH = `${siblingBinDir}:${savedPath}`;
    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    } finally {
      process.env.PATH = savedPath;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    const payload = typed.envelope;
    const preparation = payload.preparation as {
      gateBins?: Array<{ name: string; source: string; path?: string }>;
    };
    expect(preparation.gateBins).toEqual([
      { name: "native-gate-dep", source: "path", path: join(siblingBinDir, "native-gate-dep") },
    ]);
    // Refused BEFORE the claim update: not-attempted receipt, item copy todo.
    expect(payload.claimCommitted).toBe(false);
    const claimCommit = payload.claimCommit as Record<string, unknown>;
    expect(claimCommit).toMatchObject({ status: "not-attempted", committed: false });
    expect(claimCommit.reason).toBe("strict gate-bin gate refused");
    const error = payload.error as Record<string, unknown>;
    const message = String(error.message);
    expect(message).toContain("x-tracker.strict-gate-bins is set");
    expect(message).toContain("refusing the claim commit");
    expect(message).toContain(
      `native-gate-dep: resolves only via PATH from ${join(siblingBinDir, "native-gate-dep")}`,
    );
    expect(message).toContain("npm ci");
    const worktreePath = String(payload.worktreePath);
    expect(message).toContain(worktreePath);
    expect(existsSync(worktreePath)).toBe(true);
    const claimed = itemData(dir, "task-rate-limit", worktreePath);
    expect(claimed.status).toBe("todo");
    expect(claimed.assignee).toBeUndefined();

    // The documented remediation loop: a worktree-local install (the `npm ci`
    // shape) flips the resolution to the worktree — the module walk prefers it
    // over the sibling still on PATH — and the attach re-run commits the claim.
    installGateDepBin(join(worktreePath, "node_modules"));
    process.env.PATH = `${join(worktreePath, "node_modules", ".bin")}:${savedPath}`;
    let retryOutput: Record<string, unknown>;
    try {
      const retry = await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
      retryOutput = retry.output as Record<string, unknown>;
    } finally {
      process.env.PATH = savedPath;
    }
    const retryPreparation = retryOutput.preparation as {
      gateBins?: Array<{ name: string; source: string; path?: string }>;
    };
    expect(retryOutput.worktreeCreated).toBe(false);
    expect(retryOutput.claimCommitted).toBe(true);
    expect(retryPreparation.gateBins).toEqual([
      {
        name: "native-gate-dep",
        source: "worktree",
        path: join(worktreePath, "node_modules", ".bin", "native-gate-dep"),
      },
    ]);
  });

  it("keeps the named bins and the attach re-run inside the clipped strict gate-bin refusal when the named-bin list is at its worst case (bug-native-refusal-advice-clipped-by-head-clip)", async () => {
    const dir = seedGitTree();
    const devDependencies: Record<string, string> = {};
    const names: string[] = [];
    for (let index = 0; index < MAX_GATE_BINS; index += 1) {
      const name = `worktree-gate-binary-number-${index}-with-a-very-long-name-for-the-clip`;
      devDependencies[name] = "1.0.0";
      names.push(name);
    }
    addNativeManifest(dir, { name: "fixture", devDependencies });
    armStrictGateBins(dir);
    setNativePreCommitHook(dir, "#!/bin/sh\nexit 1\n");
    // Same worst-case shape as the fresh-worktree refusal's test: the full
    // MAX_GATE_BINS list of PATH-masked shims under a deep sibling, so
    // `MAX_NATIVE_ERROR_CHARS` (2048) clips the composed message HEAD-first and
    // only the leading advice and the first named bins survive.
    const siblingBinDir = join(
      dirname(dir),
      "deeply",
      "nested",
      "module",
      "path",
      "number",
      "with",
      "a",
      "long",
      "sibling",
      "checkout",
      "node_modules",
      ".bin",
    );
    mkdirSync(siblingBinDir, { recursive: true });
    for (const name of names) {
      writeFileSync(join(siblingBinDir, name), "#!/bin/sh\nexit 0\n", "utf8");
      chmodSync(join(siblingBinDir, name), 0o755);
    }
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const savedPath = process.env.PATH ?? "";
    process.env.PATH = `${siblingBinDir}:${savedPath}`;
    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    } finally {
      process.env.PATH = savedPath;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    const payload = typed.envelope;
    const claimCommit = payload.claimCommit as Record<string, unknown>;
    expect(claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
      reason: "strict gate-bin gate refused",
    });
    const message = String((payload.error as { message?: unknown }).message);
    const sorted = [...names].sort();
    const firstEntry = `${sorted[0]}: resolves only via PATH from ${join(siblingBinDir, sorted[0])}`;
    // The actionable advice survives the clip: the attach re-run FIRST, then
    // the named bins (the evidence the clip starts eating last).
    expect(message).toContain("The worktree was kept at");
    expect(message).toContain("it attaches to the existing worktree and retries the claim commit");
    const firstNamedIndex = message.indexOf(firstEntry);
    expect(firstNamedIndex).toBeGreaterThan(-1);
    expect(message.indexOf("it attaches to the existing worktree and retries the claim commit")).toBeLessThan(
      firstNamedIndex,
    );
    // Negative control: pinned at the cap, last named entry gone.
    expect(message.length).toBe(2048);
    expect(message).not.toContain(sorted[sorted.length - 1]);
  });

  it("claims normally when strict-gate-bins is armed and the bin resolves from the worktree (task-start-gate-strict-mode)", async () => {
    // Strict mode never invents a violation: a worktree-resolved gate bin
    // commits exactly as it does with the flag unset.
    const dir = seedGitTree();
    addNativeGateDependency(dir);
    installGateDepBin(join(dir, "node_modules"));
    addNativeManifest(dir, { name: "fixture", devDependencies: { "native-gate-dep": "1.0.0" } });
    armStrictGateBins(dir);
    setNativePreCommitHook(dir, "#!/bin/sh\nexit 0\n");
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const started = await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    const output = started.output as Record<string, unknown>;
    const worktreePath = String(output.worktreePath);
    const preparation = output.preparation as {
      gateBins?: Array<{ name: string; source: string; path?: string }>;
    };
    expect(preparation.gateBins).toEqual([
      {
        name: "native-gate-dep",
        source: "worktree",
        path: join(worktreePath, "node_modules", ".bin", "native-gate-dep"),
      },
    ]);
    expect(output.claimCommitted).toBe(true);
  });

  /** Arm `x-tracker.strict-worktree-writes` on the seeded tree (committed). */
  function armStrictWorktreeWrites(dir: string): void {
    const config = join(dir, "ArggonManager", ".convention.yml");
    writeFileSync(
      config,
      `${readFileSync(config, "utf8")}x-tracker:\n  strict-worktree-writes: true\n`,
      "utf8",
    );
    git(dir, ["add", "ArggonManager/.convention.yml"]);
    git(dir, ["commit", "-qm", "test: arm the strict worktree-write gate"]);
  }

  /** The worktree's git dir, where the kernel writes the claim stamp. */
  function worktreeGitDir(dir: string, worktreePath: string): string {
    return gitOut(
      worktreePath,
      ["rev-parse", "--absolute-git-dir"],
    ).trim();
  }

  /** A tracked write inside the claimed worktree, after the stamp (the F12 signature). */
  function foreignWrite(worktreePath: string): void {
    const itemFile = join(
      worktreePath,
      "ArggonManager",
      "launch-mvp",
      "auth",
      "story-login",
      "task-rate-limit.md",
    );
    writeFileSync(itemFile, readFileSync(itemFile, "utf8") + "\n<!-- foreign edit -->\n", "utf8");
    const when = new Date(Date.now() + 60_000);
    utimesSync(itemFile, when, when);
  }

  /** The claim stamp file as the kernel wrote it. */
  function readStamp(dir: string, worktreePath: string): Record<string, unknown> {
    return JSON.parse(
      readFileSync(join(worktreeGitDir(dir, worktreePath), "arggon-claim.json"), "utf8"),
    ) as Record<string, unknown>;
  }

  /**
   * Claim the seeded item and return the worktree path — the state every
   * single-writer/take-over test starts from (one stamped owner, no newer
   * writes yet).
   */
  async function startAndStamp(
    defs: ArgonToolDefinition[],
    sessionID: string,
  ): Promise<string> {
    const first = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke" },
      { sessionID },
    );
    return String((first.output as { worktreePath?: unknown }).worktreePath);
  }

  it("stamps the worktree with the calling session and warns (report-only) when a foreign session attaches over newer writes (task-single-writer-worktree-enforcement)", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    // First session claims and stamps the worktree.
    const first = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke" },
      { sessionID: "ses_a" },
    );
    const firstOutput = first.output as Record<string, unknown>;
    const worktreePath = String(firstOutput.worktreePath);
    const firstPreparation = firstOutput.preparation as {
      claim?: { stamped: boolean; foreignWrites?: unknown };
    };
    expect(firstPreparation.claim?.stamped).toBe(true);
    expect(firstPreparation.claim?.foreignWrites).toBeUndefined();
    const gitDir = worktreeGitDir(dir, worktreePath);
    const stamp = JSON.parse(readFileSync(join(gitDir, "arggon-claim.json"), "utf8")) as {
      identity: string;
      item: string;
      surface: string;
    };
    expect(stamp.identity).toBe("ses_a");
    expect(stamp.surface).toBe("native");
    expect(stamp.item).toBe("task-rate-limit");

    // A foreign session's tracked write inside the claimed worktree, after
    // the stamp (the F12 signature).
    const itemFile = join(worktreePath, "ArggonManager", "launch-mvp", "auth", "story-login", "task-rate-limit.md");
    const foreignContent = readFileSync(itemFile, "utf8") + "\n<!-- foreign edit -->\n";
    writeFileSync(itemFile, foreignContent, "utf8");
    const when = new Date(Date.now() + 60_000);
    utimesSync(itemFile, when, when);

    // The foreign session's own start attach: report-only default, so the
    // detection rides the receipt and the claim still lands.
    const second = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke" },
      { sessionID: "ses_b" },
    );
    const secondOutput = second.output as Record<string, unknown>;
    const secondPreparation = secondOutput.preparation as {
      claim?: {
        stamped: boolean;
        foreignWrites?: { owner: string; files: string[]; total: number };
      };
    };
    expect(secondOutput.worktreeCreated).toBe(false);
    expect(secondPreparation.claim?.foreignWrites?.owner).toBe("ses_a");
    expect(secondPreparation.claim?.foreignWrites?.total).toBe(1);
    expect(secondPreparation.claim?.foreignWrites?.files).toEqual([
      "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md",
    ]);
    expect(secondOutput.claimCommitted).toBe(true);
  });

  it("keeps the single-writer flow byte-identical by default: the owner's own attach never fires (task-single-writer-worktree-enforcement)", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke" },
      { sessionID: "ses_a" },
    );
    const retry = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke" },
      { sessionID: "ses_a" },
    );
    const output = retry.output as Record<string, unknown>;
    const preparation = output.preparation as {
      claim?: { stamped: boolean; foreignWrites?: unknown; warning?: string };
    };
    expect(output.worktreeCreated).toBe(false);
    expect(preparation.claim).toEqual({ stamped: true });
    expect(output.claimCommitted).toBe(true);
  });

  it("refuses the attach before the claim update under strict-worktree-writes when a foreign session's window saw newer writes (task-single-writer-worktree-enforcement)", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke" },
      { sessionID: "ses_a" },
    );
    armStrictWorktreeWrites(dir);
    const worktreePath = join(dirname(dir), `${basename(dir)}-task-rate-limit`);
    const itemFile = join(worktreePath, "ArggonManager", "launch-mvp", "auth", "story-login", "task-rate-limit.md");
    writeFileSync(itemFile, readFileSync(itemFile, "utf8") + "\n<!-- foreign edit -->\n", "utf8");
    const when = new Date(Date.now() + 60_000);
    utimesSync(itemFile, when, when);

    let caught: unknown;
    try {
      await tool(defs, "start").execute(
        { id: "task-rate-limit", assignee: "smoke" },
        { sessionID: "ses_b" },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    const payload = typed.envelope;
    const claimCommit = payload.claimCommit as Record<string, unknown>;
    expect(claimCommit).toMatchObject({ status: "not-attempted", committed: false });
    expect(claimCommit.reason).toBe("strict worktree-write gate refused");
    const message = String((payload.error as { message?: unknown }).message);
    expect(message).toContain("x-tracker.strict-worktree-writes is set");
    expect(message).toContain("refusing the claim");
    expect(message).toContain("ses_a");
    expect(message).toContain(worktreePath);
    // The claim never mutated the item copy in the worktree.
    const claimed = itemData(dir, "task-rate-limit", worktreePath);
    expect(claimed.assignee).toBe("smoke");
    expect(readFileSync(itemFile, "utf8")).toContain("<!-- foreign edit -->");
    // The refusal names the take-over hatch, NOT a plain re-run: a retry
    // cannot succeed while the fired detection stands (the anti-unlock rule
    // keeps the previous stamp, so every retry re-detects).
    expect(message).toContain("A plain re-run cannot clear this");
    expect(message).toContain("takeOverWorktree: true");
    expect(message).toContain("confirming no live writer");
    expect(message).not.toContain("assignee: \"smoke\" }) —");
  });

  it("keeps both remedies inside the clipped refusal message when the dirty-path list is at its worst case (task-native-start-take-over-input review finding: the clip ate the advice)", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const worktreePath = await startAndStamp(defs, "ses_a");
    armStrictWorktreeWrites(dir);
    // The kernel names up to 10 dirty paths, and `startFailure` clips the
    // composed message HEAD-first at 2048 chars. Ten ~60-char paths are the
    // case where advice APPENDED after the refusal disappears: one short file
    // (every other test here) can never see the clip, which is exactly how the
    // ordering defect survived review.
    const paths: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      const name = `deeply/nested/module/path/number-${index}/with-a-long-file-name-here.md`;
      const file = join(worktreePath, name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `dirty ${index}\n`, "utf8");
      git(worktreePath, ["add", name]);
      paths.push(name);
    }
    for (const name of paths) {
      const file = join(worktreePath, name);
      const when = new Date(Date.now() + 60_000);
      utimesSync(file, when, when);
    }

    let caught: unknown;
    try {
      await tool(defs, "start").execute(
        { id: "task-rate-limit", assignee: "smoke" },
        { sessionID: "ses_b" },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const message = String(((caught as ArgonToolError).envelope.error as { message?: unknown }).message);
    // Both remedies survive the clip.
    expect(message).toContain("takeOverWorktree: true");
    expect(message).toContain("arggon-claim.json");
    expect(message).toContain("confirming no live writer");
    // The kernel's own diagnosis survives too: it leads the message now, so the
    // stamped owner and the file count are never what gets clipped.
    expect(message).toContain("x-tracker.strict-worktree-writes is set");
    expect(message).toContain("ses_a");
    expect(message).toContain("10 tracked files were modified after that claim");
    // ORDER is the pinned contract, not the prose: every actionable clause
    // precedes the named-file list, which is the only thing allowed to clip.
    const firstFile = message.indexOf(paths[0]);
    expect(firstFile).toBeGreaterThan(-1);
    for (const clause of [
      "takeOverWorktree: true",
      "arggon-claim.json",
      "A plain re-run cannot clear this",
    ]) {
      expect(message.indexOf(clause)).toBeLessThan(firstFile);
    }
    // The clip really did bite (otherwise this test would pass vacuously on a
    // message that simply got longer).
    expect(message.length).toBeLessThanOrEqual(2048);
    expect(message).not.toContain(paths[paths.length - 1]);
  });

  it("takes over a presumed-dead stamped owner on the native seam: the claim lands and the stamp carries the chain (task-strict-attach-dead-owner-hatch)", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    // One stamped owner (ses_a) whose session is presumed dead, then a
    // foreign tracked write inside its window — the F12 signature.
    const worktreePath = await startAndStamp(defs, "ses_a");
    const previous = readStamp(dir, worktreePath);
    foreignWrite(worktreePath);
    // The gate is ARMED: without the take-over input this attach refuses.
    armStrictWorktreeWrites(dir);

    const taken = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke", takeOverWorktree: true },
      { sessionID: "ses_b" },
    );
    const output = taken.output as Record<string, unknown>;
    expect(output.worktreeCreated).toBe(false);
    // The armed strict gate is resolved BY the kernel's take-over: the fired
    // evidence moved out of `foreignWrites`, so the unchanged gate never fires.
    expect(output.claimCommitted).toBe(true);
    const preparation = output.preparation as {
      claim?: {
        stamped: boolean;
        foreignWrites?: unknown;
        takeOver?: {
          at: string;
          by: string;
          replacedIdentity: string;
          replacedClaimedAt: string;
          replaced: Record<string, unknown>;
          files: string[];
          total: number;
        };
      };
    };
    expect(preparation.claim?.foreignWrites).toBeUndefined();
    const takeOver = preparation.claim?.takeOver;
    expect(takeOver?.by).toBe("ses_b");
    expect(takeOver?.replacedIdentity).toBe("ses_a");
    expect(takeOver?.replacedClaimedAt).toBe(previous.claimedAt);
    expect(Date.parse(String(takeOver?.at))).not.toBeNaN();
    // The replaced stamp is reported in FULL, and the evidence the detection
    // saw moved here (never dropped — the bounded mapping is a whitelist).
    expect(takeOver?.replaced).toEqual({
      identity: "ses_a",
      item: "task-rate-limit",
      branch: "feat/task-rate-limit",
      claimedAt: previous.claimedAt,
      assignee: "smoke",
      surface: "native",
    });
    expect(takeOver?.total).toBe(1);
    expect(takeOver?.files).toEqual([
      "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md",
    ]);
    // The worktree is re-stamped with the new identity, and the chain is the
    // persisted audit trail of who replaced whose dead claim.
    const after = readStamp(dir, worktreePath);
    expect(after.identity).toBe("ses_b");
    expect(after.item).toBe("task-rate-limit");
    expect(after.takeovers).toEqual([
      {
        at: takeOver?.at,
        by: "ses_b",
        replacedIdentity: "ses_a",
        replacedClaimedAt: previous.claimedAt,
      },
    ]);
    // The item's copy in the worktree really is claimed by the taker.
    expect(itemData(dir, "task-rate-limit", worktreePath)).toMatchObject({
      status: "in_progress",
      assignee: "smoke",
    });
  });

  it("keeps the take-over byte-identical when no detection fired (default identity, task-strict-attach-dead-owner-hatch)", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    // A clean attach by the SAME owner: nothing to take over from, so the flag
    // must change NOTHING — not even a chain entry in the stamp.
    await startAndStamp(defs, "ses_a");
    const worktreePath = join(dirname(dir), `${basename(dir)}-task-rate-limit`);
    const before = readStamp(dir, worktreePath);

    const retry = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke", takeOverWorktree: true },
      { sessionID: "ses_a" },
    );
    const preparation = (retry.output as Record<string, unknown>).preparation as {
      claim?: Record<string, unknown>;
    };
    expect(preparation.claim).toEqual({ stamped: true });
    // Same identity, refreshed claim time only: no `takeovers` key anywhere.
    const after = readStamp(dir, worktreePath);
    expect(after.identity).toBe("ses_a");
    expect(after.takeovers).toBeUndefined();
    expect(after.claimedAt).not.toBe(before.claimedAt);
  });

  it("keeps the take-over a no-op on a fired detection without the input, and never silently ignores the input (task-strict-attach-dead-owner-hatch)", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const worktreePath = await startAndStamp(defs, "ses_a");
    foreignWrite(worktreePath);
    const before = readStamp(dir, worktreePath);

    // No input: the default is byte-identical to the CLI's — the detection
    // still rides `foreignWrites` and the previous stamp is left alone.
    const plain = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke" },
      { sessionID: "ses_b" },
    );
    const claim = (plain.output as Record<string, unknown>).preparation as {
      claim?: { stamped: boolean; foreignWrites?: { owner: string }; takeOver?: unknown };
    };
    expect(claim.claim?.stamped).toBe(true);
    expect(claim.claim?.takeOver).toBeUndefined();
    expect(claim.claim?.foreignWrites?.owner).toBe("ses_a");
    expect(readStamp(dir, worktreePath)).toEqual(before);

    // The take-over input WITHOUT a worktree is rejected rather than ignored:
    // a silently dropped flag is how a recovery step gets believed to have run.
    let caught: unknown;
    try {
      await tool(defs, "start").execute({
        id: "task-rate-limit",
        assignee: "smoke",
        worktree: false,
        takeOverWorktree: true,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    const message = String((typed.envelope.error as { message?: unknown }).message);
    expect(message).toContain("takeOverWorktree requires worktree");
  });

  it("bounds the take-over evidence: an over-cap named-file list and the replaced stamp's chain both fold into `truncated` (task-strict-attach-dead-owner-hatch)", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const worktreePath = await startAndStamp(defs, "ses_a");
    // Twelve tracked writes in the stamped owner's window: the kernel names at
    // most 10, so `total > files.length` and the count must not read as the
    // whole set.
    for (let index = 0; index < 12; index += 1) {
      const file = join(worktreePath, `dirty-${String(index).padStart(2, "0")}.md`);
      writeFileSync(file, `dirty ${index}\n`, "utf8");
      git(worktreePath, ["add", `dirty-${String(index).padStart(2, "0")}.md`]);
    }
    const stampPath = join(worktreeGitDir(dir, worktreePath), "arggon-claim.json");
    // An attacker-shaped stamp: a huge free-text identity and a chain far
    // above the kernel's own 5-entry cap, read back out of the git dir.
    const hostile = JSON.parse(readFileSync(stampPath, "utf8")) as Record<string, unknown>;
    hostile.identity = "x".repeat(5_000);
    hostile.takeovers = Array.from({ length: 40 }, (_unused, index) => ({
      at: `2020-01-0${(index % 9) + 1}T00:00:00.000Z`,
      by: `taker-${index}`,
      replacedIdentity: `owner-${index}`,
      replacedClaimedAt: "2019-01-01T00:00:00.000Z",
    }));
    writeFileSync(stampPath, `${JSON.stringify(hostile)}\n`, "utf8");

    const taken = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke", takeOverWorktree: true },
      { sessionID: "ses_b" },
    );
    const preparation = (taken.output as Record<string, unknown>).preparation as {
      claim?: {
        takeOver?: {
          replacedIdentity: string;
          replaced: {
            identity: string;
            takeovers?: Array<{ by: string }>;
          };
          files: string[];
          total: number;
        };
      };
      truncated?: boolean;
    };
    const takeOver = preparation.claim?.takeOver;
    expect(takeOver?.total).toBeGreaterThan(takeOver?.files.length ?? 0);
    expect(takeOver?.files.length).toBeLessThanOrEqual(32);
    // Free text is bounded, and the replaced stamp's chain is capped by the
    // mapping's own list cap rather than passed through wholesale.
    expect(String(takeOver?.replacedIdentity).length).toBeLessThanOrEqual(200);
    expect(String(takeOver?.replaced.identity).length).toBeLessThanOrEqual(200);
    expect(takeOver?.replaced.takeovers?.length).toBeLessThanOrEqual(32);
    // A capped list is never passed off as the whole set.
    expect(preparation.truncated).toBe(true);
  });

  it("folds CHARACTER clipping of the take-over's free text into `truncated`, not just the list caps (task-native-start-take-over-input review finding)", async () => {
    const dir = seedGitTree();
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const worktreePath = await startAndStamp(defs, "ses_a");
    // Exactly ONE dirty path, and it is over `MAX_NATIVE_PREPARATION_VALUE_CHARS`
    // (200): the list cap and `total > files.length` cannot fire here, so the
    // only honest signal that the value was shortened is `truncated` itself.
    const longPath = `deep/${"segment-".repeat(28)}end.md`;
    expect(longPath.length).toBeGreaterThan(200);
    const longFile = join(worktreePath, longPath);
    mkdirSync(dirname(longFile), { recursive: true });
    writeFileSync(longFile, "dirty\n", "utf8");
    git(worktreePath, ["add", longPath]);
    const when = new Date(Date.now() + 60_000);
    utimesSync(longFile, when, when);
    // A replaced identity over the same per-value cap, and a chain the kernel's
    // own reader accepts (5 entries) so the length-cap branch stays out of it.
    const stampPath = join(worktreeGitDir(dir, worktreePath), "arggon-claim.json");
    const hostile = JSON.parse(readFileSync(stampPath, "utf8")) as Record<string, unknown>;
    hostile.identity = "y".repeat(600);
    hostile.branch = "z".repeat(600);
    hostile.takeovers = Array.from({ length: 5 }, (_unused, index) => ({
      at: `2020-01-0${index + 1}T00:00:00.000Z`,
      by: `taker-${index}`,
      replacedIdentity: `owner-${index}`,
      replacedClaimedAt: "2019-01-01T00:00:00.000Z",
    }));
    writeFileSync(stampPath, `${JSON.stringify(hostile)}\n`, "utf8");

    const taken = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke", takeOverWorktree: true },
      { sessionID: "ses_b" },
    );
    const preparation = (taken.output as Record<string, unknown>).preparation as {
      claim?: {
        takeOver?: {
          replaced: { identity: string; branch: string };
          files: string[];
          total: number;
        };
      };
      truncated?: boolean;
    };
    const takeOver = preparation.claim?.takeOver;
    // Nothing was DROPPED here: one path named, the count honest. Only the
    // characters were clipped.
    expect(takeOver?.total).toBe(1);
    expect(takeOver?.files).toHaveLength(1);
    expect(String(takeOver?.files[0]).length).toBeLessThanOrEqual(200);
    expect(String(takeOver?.replaced.identity).length).toBeLessThanOrEqual(200);
    expect(String(takeOver?.replaced.branch).length).toBeLessThanOrEqual(200);
    // …and that is exactly why the receipt must SAY so.
    expect(preparation.truncated).toBe(true);
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
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
    });
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

  it("start refuses a stale canonical copy WITHOUT deleting a pre-existing branch (W4 review S1)", async () => {
    const dir = seedGitTree();
    // A pre-existing, unmerged branch the run did not create.
    git(dir, ["branch", "feat/task-rate-limit"]);
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
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
    });
    expect(String((typed.envelope.error as { message?: unknown }).message)).toContain(
      "uncommitted tracker changes",
    );
    // The worktree this run created is gone; the branch it did NOT create stays.
    expect(calls.remove).toHaveLength(1);
    expect(existsSync(join(dirname(dir), `${basename(dir)}-task-rate-limit`))).toBe(false);
    expect((typed.envelope.rollback as Record<string, unknown>).branchDeleted).toBeNull();
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toContain(
      "feat/task-rate-limit",
    );
  });

  it("start refuses a claim steal WITHOUT deleting a pre-existing branch (W4 review S1)", async () => {
    const dir = seedGitTree();
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    // Claim through the tool so the claim commit lands (realistic setup), then
    // create the item branch at that claim commit: the run only switches to it.
    await tool(defs, "update").execute({
      id: "task-rate-limit",
      status: "in_progress",
      assignee: "someone",
    });
    git(dir, ["branch", "feat/task-rate-limit"]);

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "intruder" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    expect((caught as ArgonToolError).code).toBe("START_FAILED");
    expect((caught as ArgonToolError).envelope.claimCommitted).toBe(false);
    expect((caught as ArgonToolError).envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
    });
    // The worktree (checked out on the pre-existing branch) is removed; the
    // branch survives because this run only switched to it.
    expect(calls.remove).toHaveLength(1);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toContain(
      "feat/task-rate-limit",
    );
    expect(itemData(dir, "task-rate-limit")).toMatchObject({
      status: "in_progress",
      assignee: "someone",
    });
  });

  it("removes only the start-owned link farm before rolling back a refused claim", async () => {
    const dir = seedGitTree();
    const sibling = join(dirname(dir), `${basename(dir)}-sibling`);
    git(dir, ["worktree", "add", "--detach", sibling]);

    // Commit a local workspace copy so the shared preparation chooses a
    // link farm, rather than a bare node_modules symlink.
    const local = join(dir, "lib");
    mkdirSync(local, { recursive: true });
    writeFileSync(
      join(local, "package.json"),
      JSON.stringify({ name: "@arggondev/lib", main: "index.js" }),
      "utf8",
    );
    writeFileSync(join(local, "index.js"), "module.exports = 'primary';\n", "utf8");
    git(dir, ["add", "lib"]);
    git(dir, ["commit", "-qm", "test: local workspace"]);
    const primaryModules = join(dir, "node_modules");
    mkdirSync(join(primaryModules, "@arggondev"), { recursive: true });
    mkdirSync(join(primaryModules, "ordinary-dependency"), { recursive: true });
    writeFileSync(
      join(primaryModules, "ordinary-dependency", "package.json"),
      JSON.stringify({ name: "ordinary-dependency" }),
      "utf8",
    );
    symlinkSync(local, join(primaryModules, "@arggondev", "lib"), "dir");

    // The canonical claim is already owned by another assignee, so native
    // start reaches preparation and update refusal rather than stopping early.
    runUpdate({ cwd: dir, id: "task-rate-limit", status: "in_progress", assignee: "owner" });
    git(dir, ["add", "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md"]);
    git(dir, ["commit", "-qm", "test: commit owner claim"]);
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "intruder" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    expect(typed.code).toBe("START_FAILED");
    const payload = typed.envelope;
    const rollback = payload.rollback as Record<string, unknown>;
    const worktreePath = String(payload.worktreePath);
    expect(payload.claimCommitted).toBe(false);
    expect(payload.claimCommit).toMatchObject({ status: "not-attempted", committed: false });
    expect(payload.preparation).toMatchObject({
      install: "linked",
      linkedNodeModules: true,
      linkedWorkspaces: [],
    });
    expect(rollback).toMatchObject({
      preparationRemoved: true,
      worktreeRemoved: true,
      branchDeleted: true,
    });
    expect(calls.remove).toHaveLength(1);
    expect(existsSync(worktreePath)).toBe(false);
    expect(gitOut(dir, ["worktree", "list", "--porcelain"])).not.toContain(worktreePath);
    expect(existsSync(sibling)).toBe(true);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toBe("");
    // The primary install and its workspace link are untouched.
    expect(existsSync(join(primaryModules, "ordinary-dependency", "package.json"))).toBe(true);
    expect(lstatSync(join(primaryModules, "@arggondev", "lib")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(primaryModules, "@arggondev", "lib"))).toBe(resolve(local));
  });

  it("does not claim rollback success when domain removal leaves the worktree behind", async () => {
    const dir = seedGitTree();
    const sibling = join(dirname(dir), `${basename(dir)}-sibling`);
    git(dir, ["worktree", "add", "--detach", sibling]);
    const { domain, calls } = fakeDomain(dir);
    const failingDomain = {
      ...domain,
      remove: async (input: { projectID: string; directory: string; force?: boolean }) => {
        calls.remove.push(input);
        // Break the worktree registration before rejecting the domain call;
        // the compatibility git fallback must also fail and be observed.
        rmSync(join(input.directory, ".git"), { force: true });
        throw new Error("domain remove unavailable");
      },
    };
    const defs = worktreeDefinitions(dir, failingDomain);
    runUpdate({ cwd: dir, id: "task-rate-limit", status: "in_progress", assignee: "owner" });
    git(dir, ["add", "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md"]);
    git(dir, ["commit", "-qm", "test: commit owner claim"]);

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "intruder" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ArgonToolError);
    const typed = caught as ArgonToolError;
    const payload = typed.envelope;
    const message = String((payload.error as { message?: unknown }).message);
    expect(typed.code).toBe("START_FAILED");
    expect(message).toContain("rollback incomplete");
    expect(message).not.toContain("removed again");
    expect(payload.claimCommitted).toBe(false);
    expect(payload.claimCommit).toMatchObject({ status: "not-attempted", committed: false });
    expect(calls.remove).toHaveLength(1);
    expect(existsSync(String(payload.worktreePath))).toBe(true);
    expect(existsSync(sibling)).toBe(true);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toContain(
      "feat/task-rate-limit",
    );
    // No primary-install removal is attempted as part of a failed rollback.
    expect(existsSync(join(dir, "node_modules"))).toBe(false);
  });

  it("rolls back through the same observed removal when the domain lies (git --force fallback)", async () => {
    const dir = seedGitTree();
    const { domain, calls } = fakeDomain(dir);
    // The domain resolves without removing: the rollback must observe the
    // leftover and fall through to the same git fallback the cleanup prune
    // uses, only forced (the worktree is seconds old).
    domain.remove = async (input) => {
      calls.remove.push(input);
    };
    const defs = worktreeDefinitions(dir, domain);
    // The canonical claim is owned by another assignee, so native start reaches
    // the rollback instead of completing.
    runUpdate({ cwd: dir, id: "task-rate-limit", status: "in_progress", assignee: "owner" });
    git(dir, ["add", "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md"]);
    git(dir, ["commit", "-qm", "test: commit owner claim"]);

    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "intruder" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ArgonToolError);
    const payload = (caught as ArgonToolError).envelope;
    const worktreePath = String(payload.worktreePath);
    expect(payload.rollback).toMatchObject({ worktreeRemoved: true, branchDeleted: true });
    // One domain call; the removal itself is only claimed because the
    // directory AND the git inventory agree it is gone.
    expect(calls.remove).toEqual([
      { projectID: "project-id", directory: worktreePath, force: true },
    ]);
    expect(existsSync(worktreePath)).toBe(false);
    expect(gitOut(dir, ["worktree", "list", "--porcelain"])).not.toContain(worktreePath);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toBe("");
  });

  it("start refuses a recorded worktree_path that is not a worktree of this repo (W4 review S2)", async () => {
    const dir = seedGitTree();
    // A foreign git repository at the recorded path (not a worktree of `dir`).
    const foreign = join(dirname(dir), `${basename(dir)}-foreign`);
    mkdirSync(foreign, { recursive: true });
    git(foreign, ["init", "-q"]);
    git(foreign, ["config", "maintenance.auto", "false"]);
    git(foreign, ["config", "user.email", "foreign@example.com"]);
    git(foreign, ["config", "user.name", "foreign"]);
    writeFileSync(join(foreign, "README.md"), "foreign\n", "utf8");
    git(foreign, ["add", "-A"]);
    git(foreign, ["commit", "-qm", "foreign"]);
    runUpdate({ cwd: dir, id: "task-rate-limit", worktreePath: foreign });

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
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
    });
    expect(String((typed.envelope.error as { message?: unknown }).message)).toContain(
      "not a git worktree",
    );
    // Nothing was created or switched in the foreign repository.
    expect(calls.create).toHaveLength(0);
    expect(gitOut(foreign, ["branch", "--list", "feat/task-rate-limit"])).toBe("");
    expect(gitOut(foreign, ["branch", "--show-current"])).toBe("master");
  });

  it("start refuses a foreign repo at the deterministic default path (W4 review S2)", async () => {
    const dir = seedGitTree();
    const foreign = join(dirname(dir), `${basename(dir)}-task-rate-limit`);
    mkdirSync(foreign, { recursive: true });
    git(foreign, ["init", "-q"]);
    git(foreign, ["config", "maintenance.auto", "false"]);
    git(foreign, ["config", "user.email", "foreign@example.com"]);
    git(foreign, ["config", "user.name", "foreign"]);
    writeFileSync(join(foreign, "README.md"), "foreign\n", "utf8");
    git(foreign, ["add", "-A"]);
    git(foreign, ["commit", "-qm", "foreign"]);

    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    let caught: unknown;
    try {
      await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    expect((caught as ArgonToolError).envelope.claimCommitted).toBe(false);
    expect((caught as ArgonToolError).envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
    });
    expect(String(((caught as ArgonToolError).envelope.error as { message?: unknown }).message)).toContain(
      "not a git worktree",
    );
    expect(calls.create).toHaveLength(0);
    expect(gitOut(foreign, ["branch", "--list", "feat/task-rate-limit"])).toBe("");
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
    expect((caught as ArgonToolError).envelope.claimCommitted).toBe(false);
    expect((caught as ArgonToolError).envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
    });
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
    expect(typed.envelope.claimCommitted).toBe(false);
    expect(typed.envelope.claimCommit).toMatchObject({
      status: "not-attempted",
      committed: false,
    });
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

  it("cleanup unlinks a start-created node_modules link before removing (CLI parity, W4 review)", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs, calls } = await completedWorktree(dir);
    // The CLI links the primary checkout's install into fresh worktrees; git
    // refuses to remove a worktree carrying that untracked symlink, so cleanup
    // must unlink it first (only a symlink pointing at the canonical install).
    mkdirSync(join(dir, "node_modules"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "marker.txt"), "install\n", "utf8");
    symlinkSync(join(dir, "node_modules"), join(worktreePath, "node_modules"), "dir");

    const output = await tool(defs, "cleanup").execute({ prune: true });
    const envelope = output.output as Record<string, unknown>;
    expect(envelope.failures).toEqual([]);
    expect(JSON.stringify(envelope.pruned)).toContain(`removed worktree ${worktreePath}`);
    expect(calls.remove).toEqual([
      { projectID: "project-id", directory: worktreePath, force: false },
    ]);
    expect(existsSync(worktreePath)).toBe(false);
    // The canonical install is untouched (the link is removed, never followed).
    expect(existsSync(join(dir, "node_modules", "marker.txt"))).toBe(true);
  });

  it("cleanup prune observes the domain removal and falls back to git when the domain lies", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs, calls } = await completedWorktree(
      dir,
      "task-rate-limit",
      ({ domain, calls: seen }) => {
        // The reported defect: the domain resolves without removing anything.
        domain.remove = async (input) => {
          seen.remove.push(input);
        };
      },
    );

    const output = await tool(defs, "cleanup").execute({ prune: true });
    const envelope = output.output as Record<string, unknown>;
    expect(envelope.ok).toBe(true);
    expect(envelope.failures).toEqual([]);
    // The removal is reported once, and only because it was observed: the git
    // fallback removed what the domain left behind.
    expect(envelope.pruned).toEqual([
      { id: "task-rate-limit", action: `removed worktree ${worktreePath}` },
      { id: "task-rate-limit", action: "deleted branch feat/task-rate-limit" },
      { id: "task-rate-limit", action: "cleared worktree_path" },
    ]);
    expect(calls.remove).toEqual([
      { projectID: "project-id", directory: worktreePath, force: false },
    ]);
    expect(existsSync(worktreePath)).toBe(false);
    expect(gitOut(dir, ["worktree", "list", "--porcelain"])).not.toContain(worktreePath);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toBe("");
    expect(itemData(dir, "task-rate-limit").worktree_path).toBeUndefined();
    expect(envelope.commit).toMatchObject({ message: "chore(tasks): pruned task-rate-limit" });
  });

  it("cleanup prune keeps the record and the branch when a lying domain and git both fail", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs, calls } = await completedWorktree(
      dir,
      "task-rate-limit",
      ({ domain, calls: seen }) => {
        domain.remove = async (input) => {
          seen.remove.push(input);
          // Break the registration so the git fallback fails too: nothing
          // observed this worktree as removed.
          rmSync(join(input.directory, ".git"), { force: true });
        };
      },
    );

    const output = await tool(defs, "cleanup").execute({ prune: true });
    const envelope = output.output as Record<string, unknown>;
    const actions = envelope.pruned as Array<Record<string, unknown>>;
    // No removal, no branch deletion, no record clearing — ever.
    expect(actions.map((action) => action.action)).toEqual(["failed"]);
    const failed = actions[0];
    expect(failed).toMatchObject({
      id: "task-rate-limit",
      leftoverPath: worktreePath,
      leftoverBranch: "feat/task-rate-limit",
    });
    // Bounded, per-candidate, honest about both failed steps.
    const message = String(failed.error);
    expect(message).toContain("resolved without removing the worktree");
    expect(message).toContain("git worktree removal failed");
    expect(message.length).toBeLessThanOrEqual(500);
    expect(envelope.failures).toEqual([`task-rate-limit: ${message}`]);
    // No tracker commit: nothing was cleared.
    expect(envelope.commit).toBeUndefined();
    // The state stays recoverable through the normal cleanup path.
    expect(existsSync(worktreePath)).toBe(true);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toContain(
      "feat/task-rate-limit",
    );
    expect(itemData(dir, "task-rate-limit").worktree_path).toBe(worktreePath);
    expect(calls.remove).toEqual([
      { projectID: "project-id", directory: worktreePath, force: false },
    ]);
  });

  it("cleanup prune falls back to git when the domain throws", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs, calls } = await completedWorktree(
      dir,
      "task-rate-limit",
      ({ domain, calls: seen }) => {
        // The domain fails outright (it cannot remove): the git fallback is
        // the documented compatibility path, and its removal is observed.
        domain.remove = async (input) => {
          seen.remove.push(input);
          throw new Error("worktree domain unavailable");
        };
      },
    );

    const output = await tool(defs, "cleanup").execute({ prune: true });
    const envelope = output.output as Record<string, unknown>;
    expect(envelope.failures).toEqual([]);
    expect(envelope.pruned).toEqual([
      { id: "task-rate-limit", action: `removed worktree ${worktreePath}` },
      { id: "task-rate-limit", action: "deleted branch feat/task-rate-limit" },
      { id: "task-rate-limit", action: "cleared worktree_path" },
    ]);
    expect(calls.remove).toEqual([
      { projectID: "project-id", directory: worktreePath, force: false },
    ]);
    expect(existsSync(worktreePath)).toBe(false);
    expect(gitOut(dir, ["worktree", "list", "--porcelain"])).not.toContain(worktreePath);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toBe("");
    expect(itemData(dir, "task-rate-limit").worktree_path).toBeUndefined();
    expect(envelope.commit).toMatchObject({ message: "chore(tasks): pruned task-rate-limit" });
  });

  it("cleanup prune keeps the record and the branch when a throwing domain and git both fail", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs, calls } = await completedWorktree(
      dir,
      "task-rate-limit",
      ({ domain, calls: seen }) => {
        domain.remove = async (input) => {
          seen.remove.push(input);
          // Break the registration so the git fallback fails too, then reject:
          // the reported failure is the domain one, and nothing is removed.
          rmSync(join(input.directory, ".git"), { force: true });
          throw new Error("worktree domain unavailable");
        };
      },
    );

    const output = await tool(defs, "cleanup").execute({ prune: true });
    const envelope = output.output as Record<string, unknown>;
    const actions = envelope.pruned as Array<Record<string, unknown>>;
    expect(actions.map((action) => action.action)).toEqual(["failed"]);
    const failed = actions[0];
    expect(failed).toMatchObject({
      id: "task-rate-limit",
      leftoverPath: worktreePath,
      leftoverBranch: "feat/task-rate-limit",
    });
    // The OBSERVED domain failure and the observed git failure, both named.
    const message = String(failed.error);
    expect(message).toContain("worktree domain removal failed: worktree domain unavailable");
    expect(message).toContain("git worktree removal failed");
    expect(message).toContain(`worktree remains at ${worktreePath}`);
    expect(message.length).toBeLessThanOrEqual(500);
    expect(envelope.failures).toEqual([`task-rate-limit: ${message}`]);
    expect(envelope.commit).toBeUndefined();
    // Preserved state: the next cleanup can retry.
    expect(existsSync(worktreePath)).toBe(true);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toContain(
      "feat/task-rate-limit",
    );
    expect(itemData(dir, "task-rate-limit").worktree_path).toBe(worktreePath);
    expect(calls.remove).toEqual([
      { projectID: "project-id", directory: worktreePath, force: false },
    ]);
  });

  it("cleanup prune never force-removes a foreign node_modules install and keeps the record", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs } = await completedWorktree(dir);
    // A real install start never created (no link, no link-farm marker) is not
    // ours to delete: the unlink helper leaves it alone, git still refuses the
    // dirty worktree, and the candidate is reported instead of forced.
    const foreign = join(worktreePath, "node_modules", "foreign-dep");
    mkdirSync(foreign, { recursive: true });
    writeFileSync(join(foreign, "package.json"), '{"name":"foreign-dep"}\n', "utf8");

    const output = await tool(defs, "cleanup").execute({ prune: true });
    const envelope = output.output as Record<string, unknown>;
    const actions = envelope.pruned as Array<Record<string, unknown>>;
    expect(actions.map((action) => action.action)).toEqual(["failed"]);
    expect(actions[0]).toMatchObject({
      id: "task-rate-limit",
      leftoverPath: worktreePath,
      leftoverBranch: "feat/task-rate-limit",
    });
    expect(String(actions[0].error)).toContain("git worktree removal failed");
    expect(envelope.failures).toHaveLength(1);
    expect(envelope.commit).toBeUndefined();
    // The foreign install, the worktree, the branch and the record all survive.
    expect(existsSync(join(foreign, "package.json"))).toBe(true);
    expect(existsSync(worktreePath)).toBe(true);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toContain(
      "feat/task-rate-limit",
    );
    expect(itemData(dir, "task-rate-limit").worktree_path).toBe(worktreePath);
  });

  it("cleanup prune keeps the rest of the run honest when one removal cannot be observed", async () => {
    const dir = seedGitTree();
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    runCreate({ cwd: dir, type: "task", title: "Second task", parent: "story-login", id: "second" });
    tickAcceptance(dir, "task-second");

    // Candidate A: removed through the domain, end to end.
    const started = await tool(defs, "start").execute({ id: "task-rate-limit", assignee: "smoke" });
    const healthyPath = String((started.output as { worktreePath?: unknown }).worktreePath);
    writeFileSync(join(healthyPath, "work.txt"), "work\n", "utf8");
    git(healthyPath, ["add", "work.txt"]);
    git(healthyPath, ["commit", "-qm", "feat: work"]);
    git(dir, ["merge", "--no-ff", "feat/task-rate-limit", "-m", "Merge PR (stubbed)"]);
    await tool(defs, "update").execute({ id: "task-rate-limit", status: "done" });

    // Candidate B: done, merged and recorded, but its removal is unobservable.
    const brokenPath = join(dirname(dir), `${basename(dir)}-task-second`);
    git(dir, ["worktree", "add", "--detach", brokenPath]);
    writeFileSync(join(brokenPath, "other.txt"), "other\n", "utf8");
    git(brokenPath, ["add", "other.txt"]);
    git(brokenPath, ["commit", "-qm", "feat: other work"]);
    git(brokenPath, ["branch", "feat/task-second"]);
    git(dir, ["merge", "--no-ff", "feat/task-second", "-m", "Merge PR (stubbed)"]);
    runUpdate({ cwd: dir, id: "task-second", status: "in_progress", assignee: "smoke" });
    runUpdate({
      cwd: dir,
      id: "task-second",
      status: "done",
      branch: "feat/task-second",
      worktreePath: brokenPath,
    });
    domain.remove = async (input) => {
      calls.remove.push(input);
      if (input.directory === brokenPath) {
        rmSync(join(input.directory, ".git"), { force: true });
        return;
      }
      git(dir, ["worktree", "remove", input.directory]);
    };

    const output = await tool(defs, "cleanup").execute({ prune: true });
    const envelope = output.output as Record<string, unknown>;
    const actions = envelope.pruned as Array<Record<string, unknown>>;
    // One honest failure for B, with the remaining path and the kept branch.
    const failed = actions.filter((action) => action.action === "failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({
      id: "task-second",
      leftoverPath: brokenPath,
      leftoverBranch: "feat/task-second",
    });
    // A is still pruned end to end, and the run keeps ONE commit for the
    // single cleared record.
    expect(actions).toContainEqual({
      id: "task-rate-limit",
      action: `removed worktree ${healthyPath}`,
    });
    expect(actions).toContainEqual({
      id: "task-rate-limit",
      action: "deleted branch feat/task-rate-limit",
    });
    expect(actions).toContainEqual({ id: "task-rate-limit", action: "cleared worktree_path" });
    expect(envelope.commit).toMatchObject({ message: "chore(tasks): pruned task-rate-limit" });
    expect(existsSync(healthyPath)).toBe(false);
    // B keeps its worktree, branch and record: still recoverable.
    expect(existsSync(brokenPath)).toBe(true);
    expect(gitOut(dir, ["branch", "--list", "feat/task-second"])).toContain("feat/task-second");
    expect(itemData(dir, "task-second").worktree_path).toBe(brokenPath);
  });

  it("cleanup prune reports a branch-delete failure on both surfaces and keeps pruning", async () => {
    // The reported defect (bug-native-cleanup-branch-delete-missing-failure):
    // a branch delete that failed after the worktree was gone appeared in
    // `pruned` but never in `failures`, so the flat list read as a clean run.
    // No worktree domain at all here: both candidates carry a stale record
    // (path already gone), which classification prunes without a removal, and
    // the branch delete is the only failing step.
    const dir = seedGitTree();
    const base = gitOut(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const missing = (id: string) => join(dirname(dir), `${basename(dir)}-${id}-gone`);
    const branches = ["feat/task-rate-limit", "feat/task-second"] as const;
    for (const branch of branches) {
      git(dir, ["checkout", "-q", "-b", branch]);
      writeFileSync(join(dir, `${branch.replace("/", "-")}.txt`), "work\n", "utf8");
      git(dir, ["add", "-A"]);
      git(dir, ["commit", "-qm", `feat: ${branch}`]);
      git(dir, ["checkout", "-q", base]);
      git(dir, ["merge", "--no-ff", branch, "-m", "Merge PR (stubbed)"]);
    }
    runCreate({ cwd: dir, type: "task", title: "Second task", parent: "story-login", id: "second" });
    tickAcceptance(dir, "task-second");
    for (const [id, branch] of [
      ["task-rate-limit", branches[0]],
      ["task-second", branches[1]],
    ] as const) {
      runUpdate({ cwd: dir, id, status: "in_progress", assignee: "smoke" });
      runUpdate({ cwd: dir, id, status: "done", branch, worktreePath: missing(id) });
    }
    // Deterministic branch-delete failure for ONE candidate (the race between
    // classification and the delete, the case the record is cleared for): both
    // primitives refuse, so the assertion holds for `-d` and the squash-merge
    // `-D` alike. The other candidate still deletes, so continuation is real.
    const refused = `refusing to delete branch: ${"detail ".repeat(120)}`;
    const real = kernel.defaultCleanupGit();
    const fails = (branch: string) => branch === "feat/task-rate-limit";
    const failing = {
      ...real,
      deleteBranch: (cwd: string, branch: string) => {
        if (fails(branch)) throw new Error(refused);
        real.deleteBranch(cwd, branch);
      },
      deleteBranchForce: (cwd: string, branch: string) => {
        if (fails(branch)) throw new Error(refused);
        real.deleteBranchForce(cwd, branch);
      },
    };
    const defs = argonToolDefinitions({ ...kernel, defaultCleanupGit: () => failing } as ArgonKernel, {
      cwd: dir,
      templatesDir: pluginTemplatesDir(),
    });

    const output = await tool(defs, "cleanup").execute({ prune: true, no_gh: true });
    const envelope = output.output as Record<string, unknown>;
    const actions = envelope.pruned as Array<Record<string, unknown>>;

    // Both failure surfaces, same bounded message: the structured action (with
    // the leftover branch named) and the flat `<id>: <error>` entry.
    const failed = actions.find((action) => action.action === "failed")!;
    expect(failed).toMatchObject({ id: "task-rate-limit", leftoverBranch: "feat/task-rate-limit" });
    const message = String(failed.error);
    expect(message).toContain("refusing to delete branch");
    expect(message.length).toBe(500);
    expect(envelope.failures).toEqual([`task-rate-limit: ${message}`]);
    const flat = String((envelope.failures as string[])[0]);
    expect(flat.length).toBeLessThanOrEqual(500 + "task-rate-limit: ".length);

    // Continuation and record clearing are unchanged: the stale record of the
    // failed candidate is still cleared (its worktree is gone) and the healthy
    // candidate is pruned end to end, in ONE shared tracker commit.
    // Candidates are processed in id order, so the run continues AFTER the
    // failure instead of stopping on it.
    expect(actions).toEqual([
      { id: "task-rate-limit", action: "failed", error: message, leftoverBranch: "feat/task-rate-limit" },
      { id: "task-rate-limit", action: "cleared worktree_path" },
      { id: "task-second", action: "deleted branch feat/task-second" },
      { id: "task-second", action: "cleared worktree_path" },
    ]);
    expect(envelope.commit).toMatchObject({ message: "chore(tasks): pruned task-rate-limit, task-second" });
    expect(itemData(dir, "task-rate-limit").worktree_path).toBeUndefined();
    expect(itemData(dir, "task-second").worktree_path).toBeUndefined();
    // The leftover branch survives for the next run; the deleted one does not.
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toContain("feat/task-rate-limit");
    expect(gitOut(dir, ["branch", "--list", "feat/task-second"])).toBe("");
  });

  it("cleanup prune bounds every per-candidate failure at the shared cap", async () => {
    // The reported defect (bug-native-cleanup-worktree-failure-unbounded): the
    // OUTER per-candidate catch pushed the raw `detail(error)`, so one cleanup
    // envelope could carry the 500-char branch-delete message next to an
    // arbitrarily long one on the sibling surface. Both failure surfaces of one
    // envelope now carry the same bounded text, for every failure kind.
    const dir = seedGitTree();
    const { domain, calls } = fakeDomain(dir);
    const lifecycle = worktreeDefinitions(dir, domain);
    runCreate({ cwd: dir, type: "task", title: "Second task", parent: "story-login", id: "second" });
    tickAcceptance(dir, "task-second");

    // Candidate A: removable end to end. Its removal is OBSERVED, and the step
    // that follows (the branch lookup) has no catch of its own, so a failure
    // there reaches the outer catch — the surface that was unbounded.
    const started = await tool(lifecycle, "start").execute({
      id: "task-rate-limit",
      assignee: "smoke",
    });
    const removedPath = String((started.output as { worktreePath?: unknown }).worktreePath);
    writeFileSync(join(removedPath, "work.txt"), "work\n", "utf8");
    git(removedPath, ["add", "work.txt"]);
    git(removedPath, ["commit", "-qm", "feat: work"]);
    git(dir, ["merge", "--no-ff", "feat/task-rate-limit", "-m", "Merge PR (stubbed)"]);
    await tool(lifecycle, "update").execute({ id: "task-rate-limit", status: "done" });

    // Candidate B: recorded and terminal, but its removal is unobservable, so
    // the worktree-REMOVAL surface reports the refusal instead.
    const stuckPath = join(dirname(dir), `${basename(dir)}-task-second`);
    git(dir, ["worktree", "add", "--detach", stuckPath]);
    writeFileSync(join(stuckPath, "other.txt"), "other\n", "utf8");
    git(stuckPath, ["add", "other.txt"]);
    git(stuckPath, ["commit", "-qm", "feat: other work"]);
    git(stuckPath, ["branch", "feat/task-second"]);
    git(dir, ["merge", "--no-ff", "feat/task-second", "-m", "Merge PR (stubbed)"]);
    runUpdate({ cwd: dir, id: "task-second", status: "in_progress", assignee: "smoke" });
    runUpdate({
      cwd: dir,
      id: "task-second",
      status: "done",
      branch: "feat/task-second",
      worktreePath: stuckPath,
    });

    // Over-cap but still plausible git/domain prose: a git listing failure that
    // carries a whole ref-store diagnosis, and a domain rejection carrying a
    // whole message (the two producers the item names).
    const listingFailure =
      "fatal: could not read from the repository: " +
      "resolving refs/heads failed against a locked shared ref store; ".repeat(12);
    const domainFailure =
      "worktree domain unavailable: " +
      "its registration outlived the worktree it names and git no longer lists it; ".repeat(11);
    domain.remove = async (input) => {
      calls.remove.push(input);
      if (input.directory === stuckPath) {
        // Break the registration so the git fallback fails too, then reject.
        rmSync(join(input.directory, ".git"), { force: true });
        throw new Error(domainFailure);
      }
      git(dir, ["worktree", "remove", input.directory]);
    };
    const real = kernel.defaultCleanupGit();
    const failing = {
      ...real,
      branchExists: (cwd: string, branch: string) => {
        if (branch === "feat/task-rate-limit") throw new Error(listingFailure);
        return real.branchExists(cwd, branch);
      },
    };
    const defs = argonToolDefinitions({ ...kernel, defaultCleanupGit: () => failing } as ArgonKernel, {
      cwd: dir,
      templatesDir: pluginTemplatesDir(),
      worktree: { projectID: "project-id", canonical: dir, domain },
    });

    const output = await tool(defs, "cleanup").execute({ prune: true, no_gh: true });
    const envelope = output.output as Record<string, unknown>;
    const actions = envelope.pruned as Array<Record<string, unknown>>;
    const failed = actions.filter((action) => action.action === "failed");
    expect(failed).toHaveLength(2);

    // A: the uncaught surface. Capped at the shared 500, and the truncation is
    // VISIBLE (head kept, elision marked) so a reader can tell a clipped error
    // from a short one. `pruned[].error` and `failures[]` carry the same text.
    const listed = String(failed[0].error);
    expect(listed).toContain("fatal: could not read from the repository:");
    expect(listed.length).toBe(500);
    expect(listed.endsWith("\u2026")).toBe(true);

    // B: the worktree-removal surface, from the same over-cap prose. The joined
    // refusal list is capped by the same helper, so B's head survives and the
    // later steps in the join fall off the cap (unchanged: the join is what
    // the inner catch has always bounded).
    const stuck = String(failed[1].error);
    expect(failed[1]).toMatchObject({
      id: "task-second",
      leftoverPath: stuckPath,
      leftoverBranch: "feat/task-second",
    });
    expect(stuck).toContain("worktree domain removal failed: worktree domain unavailable");
    expect(stuck.length).toBe(500);
    expect(stuck.endsWith("\u2026")).toBe(true);

    // Both flat entries are `<id>` + separator + the SAME capped text, so the
    // whole entry is bounded too, not just the message.
    const flat = envelope.failures as string[];
    expect(flat).toEqual([`task-rate-limit: ${listed}`, `task-second: ${stuck}`]);
    expect(flat[0].length).toBeLessThanOrEqual(500 + "task-rate-limit: ".length);
    expect(flat[1].length).toBeLessThanOrEqual(500 + "task-second: ".length);

    // The run continued past A's failure into B (id order), and A's worktree
    // removal was observed before the throw, so the worktree is gone while the
    // record and the branch survive: nothing is cleared, nothing is committed.
    expect(actions).toEqual([
      { id: "task-rate-limit", action: `removed worktree ${removedPath}` },
      { id: "task-rate-limit", action: "failed", error: listed },
      {
        id: "task-second",
        action: "failed",
        error: stuck,
        leftoverPath: stuckPath,
        leftoverBranch: "feat/task-second",
      },
    ]);
    expect(envelope.commit).toBeUndefined();
    expect(existsSync(removedPath)).toBe(false);
    expect(existsSync(stuckPath)).toBe(true);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toContain("feat/task-rate-limit");
    expect(itemData(dir, "task-rate-limit").worktree_path).toBe(removedPath);
    expect(itemData(dir, "task-second").worktree_path).toBe(stuckPath);
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

/**
 * Native release of a dropped claim (bug-unclaim-leaves-worktree-record-without-reaper):
 * the inverse of `start`, the other arm of the worktree domain, sharing the CLI's
 * kernel rule (`classifyReleaseEntry`) and reporting in its own action family.
 * `update` cannot release (it is frontmatter-only, and it is the same call that
 * clears the record), so the native `update` envelope must NAME this path — that
 * is the parity under test, together with the refusal that protects a live
 * writer.
 */
describe("native release of a dropped claim (bug-unclaim-leaves-worktree-record-without-reaper)", () => {
  /** A tracked write inside the claimed worktree, newer than the stamp. */
  function foreignWriteIn(worktreePath: string): void {
    const itemFile = join(
      worktreePath,
      "ArggonManager",
      "launch-mvp",
      "auth",
      "story-login",
      "task-rate-limit.md",
    );
    writeFileSync(itemFile, `${readFileSync(itemFile, "utf8")}\n<!-- foreign edit -->\n`, "utf8");
    const when = new Date(Date.now() + 60_000);
    utimesSync(itemFile, when, when);
  }

  /** Claim with a worktree and merge the claim so the canonical copy sees it. */
  async function claimedAndMerged(
    dir: string,
  ): Promise<{ worktreePath: string; defs: ArgonToolDefinition[]; calls: ReturnType<typeof fakeDomain>["calls"] }> {
    const { domain, calls } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const started = await tool(defs, "start").execute(
      { id: "task-rate-limit", assignee: "smoke" },
      { sessionID: "ses_a" },
    );
    const worktreePath = String((started.output as { worktreePath?: unknown }).worktreePath);
    git(dir, ["merge", "--no-ff", "feat/task-rate-limit", "-m", "Merge claim (stubbed)"]);
    return { worktreePath, defs, calls };
  }

  it("release removes the worktree through the domain, reaps the stamp, clears the record", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs, calls } = await claimedAndMerged(dir);
    const stamp = join(
      gitOut(worktreePath, ["rev-parse", "--absolute-git-dir"]).trim(),
      "arggon-claim.json",
    );
    expect(existsSync(stamp)).toBe(true);

    // The unclaim goes through the same native `update` any agent would call;
    // it must report the footprint and name the release tool.
    const unclaimed = await tool(defs, "update").execute(
      { id: "task-rate-limit", status: "todo" },
      { sessionID: "ses_a" },
    );
    const footprint = (unclaimed.output as Record<string, unknown>).claimFootprint as
      | Record<string, unknown>
      | undefined;
    expect(footprint).toMatchObject({
      worktreePath: resolve(worktreePath),
      release: { native: 'tools.arggon.cleanup({ release: "task-rate-limit" })' },
    });

    const output = await tool(defs, "cleanup").execute(
      { release: "task-rate-limit" },
      { sessionID: "ses_a" },
    );
    const envelope = output.output as Record<string, unknown>;
    expect(envelope.failures).toEqual([]);
    expect(envelope.release).toMatchObject({
      id: "task-rate-limit",
      releasable: true,
      branch: "feat/task-rate-limit",
    });
    expect(envelope.released).toEqual([
      { id: "task-rate-limit", action: "reaped arggon-claim.json stamp" },
      { id: "task-rate-limit", action: `removed worktree ${worktreePath}` },
      { id: "task-rate-limit", action: "deleted branch feat/task-rate-limit" },
      { id: "task-rate-limit", action: "cleared worktree_path" },
    ]);
    // Domain removal (never a bare git call in the plugin path), and the
    // unforced policy: only the take-over hatch forces.
    expect(calls.remove).toEqual([
      { projectID: "project-id", directory: worktreePath, force: false },
    ]);
    expect(existsSync(worktreePath)).toBe(false);
    expect(existsSync(stamp)).toBe(false);
    expect(gitOut(dir, ["worktree", "list"]).includes("task-rate-limit")).toBe(false);
    expect(gitOut(dir, ["branch", "--list", "feat/task-rate-limit"])).toBe("");
    expect(itemData(dir, "task-rate-limit").worktree_path).toBeUndefined();
    // A distinct family, never mixed into prune's.
    expect(envelope.pruned).toEqual([]);
    expect(envelope.candidates).toEqual([]);
  });

  it("refuses to release a worktree another live session holds, and takes over only when armed", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs, calls } = await claimedAndMerged(dir);
    await tool(defs, "update").execute(
      { id: "task-rate-limit", status: "todo" },
      { sessionID: "ses_a" },
    );
    // A different session's tracked write after the stamp: the F12 signature of
    // a live writer, which a release must never rob.
    foreignWriteIn(worktreePath);

    const refused = await tool(defs, "cleanup").execute(
      { release: "task-rate-limit" },
      { sessionID: "ses_b" },
    );
    const envelope = refused.output as Record<string, unknown>;
    expect((envelope.release as Record<string, unknown>).releasable).toBe(false);
    expect(String((envelope.release as Record<string, unknown>).reason)).toContain(
      "refusing to release the worktree",
    );
    expect(envelope.failures).toHaveLength(1);
    expect(calls.remove).toEqual([]);
    expect(existsSync(worktreePath)).toBe(true);
    expect(itemData(dir, "task-rate-limit").worktree_path).toBe(worktreePath);

    // The audited hatch for a presumed-dead owner releases it (and forces the
    // removal, since the dead owner's uncommitted work is the point).
    const taken = await tool(defs, "cleanup").execute(
      { release: "task-rate-limit", take_over_worktree: true },
      { sessionID: "ses_b" },
    );
    expect((taken.output as Record<string, unknown>).failures).toEqual([]);
    expect((taken.output as Record<string, unknown>).release).toMatchObject({
      takeOver: { replacedIdentity: "ses_a" },
    });
    expect(calls.remove).toEqual([
      { projectID: "project-id", directory: worktreePath, force: true },
    ]);
    expect(existsSync(worktreePath)).toBe(false);
  });

  it("refuses a release under a live claim, and refuses release together with prune", async () => {
    const dir = seedGitTree();
    const { worktreePath, defs } = await claimedAndMerged(dir);

    const refused = await tool(defs, "cleanup").execute(
      { release: "task-rate-limit" },
      { sessionID: "ses_a" },
    );
    expect(String((refused.output.release as Record<string, unknown>).reason)).toContain(
      "still claimed by smoke",
    );
    expect(existsSync(worktreePath)).toBe(true);

    let caught: unknown;
    try {
      await tool(defs, "cleanup").execute({ release: "task-rate-limit", prune: true });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArgonToolError);
    expect((caught as ArgonToolError).code).toBe("CLEANUP_FAILED");
    expect(String((caught as ArgonToolError).envelope.error.message)).toContain(
      "either release or prune",
    );
  });
});

/**
 * Native `cleanup` reaps declared per-worktree Compose projects (ADR 0019 layer
 * 2, task-native-cleanup-compose-parity) exactly like `arggon cleanup --prune`
 * (task-cleanup-declared-services, PR #569): one `docker compose -p <project>
 * down -v --remove-orphans` per removable entry, BEFORE the worktree removal,
 * with the same no-op, degradation and bounded-failure semantics.
 *
 * The executor seam is the real one on purpose — the plugin has no injectable
 * dep — so a recording `docker` shim on PATH drives BOTH surfaces (the native
 * tool in-process, the CLI in a spawned child), which is what makes the
 * same-fixture parity assertions below possible without a fake.
 */
describe("native cleanup reaps declared Compose projects (ADR 0019 layer 2, task-native-cleanup-compose-parity)", () => {
  /** Commit an `x-worktree.services` declaration onto the fixture. */
  function declareServices(dir: string, services: string): void {
    const config = join(dir, "ArggonManager", ".convention.yml");
    writeFileSync(
      config,
      `${readFileSync(config, "utf8")}x-worktree:\n  services: ${services}\n`,
      "utf8",
    );
    git(dir, ["add", "ArggonManager/.convention.yml"]);
    git(dir, ["commit", "-qm", "config: x-worktree.services"]);
  }

  /** One `docker` invocation as the shim recorded it. */
  type DockerCall = { cwd: string; argv: string[]; worktree: "present" | "absent" };

  /**
   * A recording `docker` shim on a fresh PATH dir (no daemon in CI). The record
   * target and the observed worktree come from the caller's environment, so one
   * shim can serve both surfaces; `selfDelete` makes it remove itself on the
   * first call, so the NEXT spawn hits the real ENOENT — the absent-docker
   * signal a report-only run degrades on. `fail` makes it exit non-zero with
   * that stderr, like a real `docker compose down` failure.
   */
  function fakeDocker(options: { fail?: string; selfDelete?: boolean } = {}): string {
    const bin = hermeticBin("arggon-fake-docker-");
    const shim = join(bin, "docker");
    writeFileSync(
      shim,
      [
        "#!/bin/sh",
        'log="$ARGGON_FAKE_DOCKER_LOG"',
        'if [ -d "$ARGGON_FAKE_DOCKER_WT" ]; then state=present; else state=absent; fi',
        'printf \'cwd %s\\nworktree %s\\n\' "$PWD" "$state" >> "$log"',
        'for arg in "$@"; do printf \'arg %s\\n\' "$arg" >> "$log"; done',
        'printf -- "---\\n" >> "$log"',
        // The absolute path, not `$0`: a PATH-resolved exec does not guarantee
        // the script path in `$0`, and a silent no-op delete would leave the
        // shim answering every later spawn.
        ...(options.selfDelete === true ? ['rm -f "$ARGGON_FAKE_DOCKER_SHIM"'] : []),
        ...(options.fail === undefined
          ? []
          : [`printf '%s\\n' ${JSON.stringify(options.fail)} >&2`, "exit 1"]),
        "",
      ].join("\n"),
      "utf8",
    );
    chmodSync(shim, 0o755);
    return bin;
  }

  /** A fresh empty log file for the shim to append to. */
  function dockerLog(): string {
    return join(mkdtemp("arggon-docker-log-"), "docker.log");
  }

  /**
   * The environment a surface's Compose teardown sees: the shim's hermetic PATH
   * plus the keys the shim reads — where it records (`log`), which worktree it
   * must still find (`wt`, the proof the reap precedes the removal) and its own
   * path (the self-delete).
   */
  function dockerEnv(bin: string, log: string, wt: string): Record<string, string> {
    return {
      PATH: bin,
      ARGGON_FAKE_DOCKER_LOG: log,
      ARGGON_FAKE_DOCKER_WT: wt,
      ARGGON_FAKE_DOCKER_SHIM: join(bin, "docker"),
    };
  }

  /** A spawned CLI's env: the patch on top of this process's own environment. */
  function spawnEnv(patch: Record<string, string>): NodeJS.ProcessEnv {
    return { ...process.env, ...patch };
  }

  /** A PATH with git but no docker: the spawn hits the real ENOENT. */
  function gitOnlyBin(): string {
    return hermeticBin("arggon-fake-nodocker-");
  }

  /**
   * A PATH holding ONLY git (and `rm`, which the self-deleting shim needs), so
   * the Compose teardown resolves `docker` in that directory and nowhere else:
   * a shim there is the whole story, its absence is the real ENOENT, and the
   * host's own `/usr/bin/docker` can never answer (which would make a "no
   * docker" test pass for the wrong reason — a real `compose down` on an unknown
   * project exits 0 with a "No resource found" warning).
   */
  function hermeticBin(prefix: string): string {
    const bin = mkdtemp(prefix);
    for (const tool of ["git", "rm"]) {
      const real = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" }).stdout.trim();
      symlinkSync(real, join(bin, tool));
    }
    return bin;
  }

  /** Parse the shim's log into per-invocation records (one block, `---` ended). */
  function dockerCalls(log: string): DockerCall[] {
    if (!existsSync(log)) return [];
    const calls: DockerCall[] = [];
    let current: { cwd: string; argv: string[]; worktree: "present" | "absent" } | null = null;
    for (const line of readFileSync(log, "utf8").split("\n")) {
      if (line === "---") {
        if (current !== null) calls.push(current);
        current = null;
        continue;
      }
      if (line.startsWith("cwd ")) {
        current = { cwd: line.slice("cwd ".length), argv: [], worktree: "absent" };
      } else if (current === null) {
        continue;
      } else if (line.startsWith("worktree ")) {
        current.worktree = line.slice("worktree ".length) as "present" | "absent";
      } else if (line.startsWith("arg ")) {
        current.argv.push(line.slice("arg ".length));
      }
    }
    return calls;
  }

  /**
   * Run `body` with `env` patched onto THIS process (the native tool spawns in
   * process, so PATH is the only seam), restoring every key afterwards.
   */
  async function withEnv<T>(env: Record<string, string>, body: () => Promise<T>): Promise<T> {
    const saved = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(env)) {
      saved.set(key, process.env[key]);
      process.env[key] = value;
    }
    try {
      return await body();
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  /** Add the extra terminal items the reap-per-candidate cases need. */
  function addItems(dir: string, ids: string[]): void {
    for (const id of ids) {
      runCreate({ cwd: dir, type: "task", title: `Task ${id}`, parent: "story-login", id });
      tickAcceptance(dir, `task-${id}`);
    }
  }

  /**
   * N removable entries on one shared domain: claim → worktree → commit →
   * merge (stub PR) → done, per id. The reap loop must run once per entry.
   */
  async function completedWorktrees(
    dir: string,
    ids: string[],
  ): Promise<{ defs: ArgonToolDefinition[]; paths: string[] }> {
    const { domain } = fakeDomain(dir);
    const defs = worktreeDefinitions(dir, domain);
    const paths: string[] = [];
    for (const id of ids) {
      const started = await tool(defs, "start").execute({ id, assignee: "smoke" });
      const worktreePath = String((started.output as { worktreePath?: unknown }).worktreePath);
      // Content unique per item: a later worktree branches off a main that
      // already carries the previous item's file, so a shared body would make
      // its commit empty.
      writeFileSync(join(worktreePath, "work.txt"), `work ${id}\n`, "utf8");
      git(worktreePath, ["add", "work.txt"]);
      git(worktreePath, ["commit", "-qm", "feat: work"]);
      git(dir, ["merge", "--no-ff", `feat/${id}`, "-m", "Merge PR (stubbed)"]);
      await tool(defs, "update").execute({ id, status: "done" });
      paths.push(worktreePath);
    }
    return { defs, paths };
  }

  it("reaps `<repo>-<item-id>` for services: true, before the worktree removal", async () => {
    const dir = seedGitTree();
    declareServices(dir, "true");
    const { defs, paths } = await completedWorktrees(dir, ["task-rate-limit"]);
    const log = dockerLog();
    const bin = fakeDocker();

    const output = await withEnv(dockerEnv(bin, log, paths[0]), () =>
      tool(defs, "cleanup").execute({ prune: true, no_gh: true }),
    );
    const envelope = output.output as Record<string, unknown>;

    // The ADR 0019 command shape, as an argv array, with the repo root as cwd.
    const project = basename(paths[0]).toLowerCase();
    expect(dockerCalls(log)).toEqual([
      {
        cwd: dir,
        argv: ["compose", "-p", project, "down", "-v", "--remove-orphans"],
        worktree: "present",
      },
    ]);
    // The stack dies with the worktree: reap FIRST, removal after.
    expect(envelope.pruned).toEqual([
      { id: "task-rate-limit", action: `reaped compose project ${project}` },
      { id: "task-rate-limit", action: `removed worktree ${paths[0]}` },
      { id: "task-rate-limit", action: "deleted branch feat/task-rate-limit" },
      { id: "task-rate-limit", action: "cleared worktree_path" },
    ]);
    expect(envelope.compose).toEqual({ declared: "true" });
    expect(envelope.failures).toEqual([]);
    expect(existsSync(paths[0])).toBe(false);
  });

  it("derives `<base>-<repo>-<item-id>` from a declared base name, lowercased", async () => {
    const dir = seedGitTree();
    declareServices(dir, "MyApp");
    const { defs, paths } = await completedWorktrees(dir, ["task-rate-limit"]);
    const log = dockerLog();
    const bin = fakeDocker();

    const output = await withEnv(dockerEnv(bin, log, paths[0]), () =>
      tool(defs, "cleanup").execute({ prune: true, no_gh: true }),
    );
    const envelope = output.output as Record<string, unknown>;

    // The adopter pattern's `name: "MyApp${WORKTREE_SUFFIX:-}"`; Compose
    // lowercases project names, so the whole derivation is lowercased.
    const project = `myapp-${basename(paths[0])}`.toLowerCase();
    expect(dockerCalls(log).map((call) => call.argv[2])).toEqual([project]);
    expect(envelope.compose).toEqual({ declared: "MyApp" });
    expect(envelope.failures).toEqual([]);
  });

  it("never invokes Docker when the repo declares nothing (report-only path)", async () => {
    const dir = seedGitTree();
    addItems(dir, ["second"]);
    const { defs, paths } = await completedWorktrees(dir, ["task-rate-limit", "task-second"]);
    const log = dockerLog();
    const bin = fakeDocker();

    const output = await withEnv(dockerEnv(bin, log, paths[0]), () =>
      tool(defs, "cleanup").execute({ prune: true, no_gh: true }),
    );
    const envelope = output.output as Record<string, unknown>;

    // Not a single docker invocation, and no compose report at all.
    expect(dockerCalls(log)).toEqual([]);
    expect("compose" in envelope).toBe(false);
    expect(envelope.failures).toEqual([]);
    const actions = (envelope.pruned as Array<Record<string, unknown>>).map((a) => String(a.action));
    expect(actions.filter((action) => action.includes("compose"))).toEqual([]);
    for (const path of paths) expect(existsSync(path)).toBe(false);
  });

  it("reaps every removable entry, one project each, before that entry's removal", async () => {
    const dir = seedGitTree();
    declareServices(dir, "true");
    addItems(dir, ["second"]);
    const { defs, paths } = await completedWorktrees(dir, ["task-rate-limit", "task-second"]);
    const log = dockerLog();
    const bin = fakeDocker();

    const output = await withEnv(dockerEnv(bin, log, paths[0]), () =>
      tool(defs, "cleanup").execute({ prune: true, no_gh: true }),
    );
    const envelope = output.output as Record<string, unknown>;

    // Ids sort task-rate-limit before task-second, so the reap order is that.
    const projects = [basename(paths[0]).toLowerCase(), basename(paths[1]).toLowerCase()];
    expect(dockerCalls(log).map((call) => call.argv[2])).toEqual(projects);
    const actions = (envelope.pruned as Array<Record<string, unknown>>).map((a) => String(a.action));
    expect(actions).toEqual([
      `reaped compose project ${projects[0]}`,
      `removed worktree ${paths[0]}`,
      "deleted branch feat/task-rate-limit",
      "cleared worktree_path",
      `reaped compose project ${projects[1]}`,
      `removed worktree ${paths[1]}`,
      "deleted branch feat/task-second",
      "cleared worktree_path",
    ]);
    expect(envelope.failures).toEqual([]);
  });

  it("reports a reap failure on BOTH surfaces and never wedges the removal", async () => {
    const dir = seedGitTree();
    declareServices(dir, "true");
    addItems(dir, ["second"]);
    const { defs, paths } = await completedWorktrees(dir, ["task-rate-limit", "task-second"]);
    const log = dockerLog();
    const bin = fakeDocker({ fail: "Cannot connect to the Docker daemon" });

    const output = await withEnv(dockerEnv(bin, log, paths[0]), () =>
      tool(defs, "cleanup").execute({ prune: true, no_gh: true }),
    );
    const envelope = output.output as Record<string, unknown>;

    // The CLI's message shape verbatim (same prefix, same stderr fallback), so
    // both prune envelopes stay comparable.
    const errors = [basename(paths[0]), basename(paths[1])].map(
      (id) =>
        `docker compose -p ${id.toLowerCase()} down -v --remove-orphans failed: Cannot connect to the Docker daemon`,
    );
    expect(envelope.failures).toEqual([
      `task-rate-limit: ${errors[0]}`,
      `task-second: ${errors[1]}`,
    ]);
    const actions = envelope.pruned as Array<Record<string, unknown>>;
    expect(actions.filter((action) => action.action === "failed")).toEqual([
      { id: "task-rate-limit", action: "failed", error: errors[0] },
      { id: "task-second", action: "failed", error: errors[1] },
    ]);
    // Non-fatal: every worktree, branch and record is still reaped.
    for (const path of paths) expect(existsSync(path)).toBe(false);
    for (const branch of ["feat/task-rate-limit", "feat/task-second"]) {
      expect(gitOut(dir, ["branch", "--list", branch])).toBe("");
    }
    expect(itemData(dir, "task-second").worktree_path).toBeUndefined();
  });

  it("an absent docker CLI degrades the whole run to report-only and still prunes", async () => {
    const dir = seedGitTree();
    declareServices(dir, "true");
    addItems(dir, ["second"]);
    const { defs, paths } = await completedWorktrees(dir, ["task-rate-limit", "task-second"]);
    const bin = gitOnlyBin();

    const output = await withEnv({ PATH: bin }, () =>
      tool(defs, "cleanup").execute({ prune: true, no_gh: true }),
    );
    const envelope = output.output as Record<string, unknown>;

    // The absence is reported once, never as a failure, and the prune completes
    // (the worktree removal does not wait for Docker).
    expect(envelope.compose).toEqual({ declared: "true", dockerUnavailable: true });
    expect(envelope.failures).toEqual([]);
    expect((envelope.pruned as Array<Record<string, unknown>>).map((a) => String(a.action))).toEqual([
      `removed worktree ${paths[0]}`,
      "deleted branch feat/task-rate-limit",
      "cleared worktree_path",
      `removed worktree ${paths[1]}`,
      "deleted branch feat/task-second",
      "cleared worktree_path",
    ]);
    for (const path of paths) expect(existsSync(path)).toBe(false);
  });

  it("one ENOENT degrades the REST of the run: no later entry ever reaches Docker", async () => {
    const dir = seedGitTree();
    declareServices(dir, "true");
    addItems(dir, ["second", "third"]);
    const { defs, paths } = await completedWorktrees(dir, [
      "task-rate-limit",
      "task-second",
      "task-third",
    ]);
    const log = dockerLog();
    // The shim fails its first call and then deletes itself: entry two hits the
    // real ENOENT (the report-only signal), entry three must never spawn.
    const bin = fakeDocker({ fail: "Cannot connect to the Docker daemon", selfDelete: true });

    const output = await withEnv(dockerEnv(bin, log, paths[0]), () =>
      tool(defs, "cleanup").execute({ prune: true, no_gh: true }),
    );
    const envelope = output.output as Record<string, unknown>;

    // Exactly one spawn: the ENOENT that followed it is the run-wide switch.
    expect(dockerCalls(log)).toHaveLength(1);
    expect(envelope.compose).toEqual({ declared: "true", dockerUnavailable: true });
    // Only the real (non-ENOENT) failure is a failure; the rest is silent.
    expect(envelope.failures).toEqual([
      `task-rate-limit: docker compose -p ${basename(paths[0]).toLowerCase()} down -v --remove-orphans failed: Cannot connect to the Docker daemon`,
    ]);
    // Every entry is still removed, cleared and branch-deleted.
    for (const path of paths) expect(existsSync(path)).toBe(false);
    expect(itemData(dir, "task-third").worktree_path).toBeUndefined();
  });

  it("native prune is byte-identical to `cleanup --prune --json` on the same fixture (declared, reaped)", async () => {
    // The parity harness: two twin fixtures (same repo basename, same layout,
    // completed the same way), then the SAME recording docker shim on both
    // surfaces — the native tool in-process and the CLI in a spawned child, so
    // "the same fixture" means the same bytes of scenario, not one shared
    // directory (a prune mutates). `--no-commit` keeps the tracker-commit
    // payload the same deterministic skip on both sides.
    const cliDir = seedGitTree("arggon-w4-parity-");
    const nativeDir = seedGitTree("arggon-w4-parity-");
    for (const dir of [cliDir, nativeDir]) {
      declareServices(dir, "true");
      addItems(dir, ["second"]);
    }
    const cli = await completedWorktrees(cliDir, ["task-rate-limit", "task-second"]);
    const native = await completedWorktrees(nativeDir, ["task-rate-limit", "task-second"]);
    const bin = fakeDocker();
    const cliLog = dockerLog();
    const nativeLog = dockerLog();

    // The local runCli takes the env MAP (not an options object).
    const expected = runCli(
      ["cleanup", "--prune", "--no-gh", "--no-commit"],
      cliDir,
      spawnEnv(dockerEnv(bin, cliLog, cli.paths[0])),
    );
    expect(expected.status, expected.stderr).toBe(0);
    const output = await withEnv(dockerEnv(bin, nativeLog, native.paths[0]), () =>
      tool(native.defs, "cleanup").execute({ prune: true, no_gh: true, no_commit: true }),
    );

    // Both surfaces reaped the same projects, in the same order, from the repo
    // root, while their own worktree was still on disk.
    const projects = native.paths.map((path) => basename(path).toLowerCase());
    expect(dockerCalls(cliLog).map((call) => call.argv[2])).toEqual(projects);
    expect(dockerCalls(nativeLog).map((call) => call.argv[2])).toEqual(projects);
    expect(dockerCalls(nativeLog).every((call) => call.cwd === nativeDir)).toBe(true);
    // Each entry's own reap ran while THAT entry's worktree was still on disk.
    expect(dockerCalls(nativeLog).map((call) => call.worktree)).toEqual(["present", "absent"]);
    // The envelopes are the same bytes (fixture root normalized).
    expect(normalize(expected.stdout, cliDir)).toBe(normalize(`${JSON.stringify(output.output)}\n`, nativeDir));
  });

  it("native prune matches `cleanup --prune --json` on the absent-docker degradation", async () => {
    // The report-only shape (ADR 0019 layer 2): both surfaces report
    // `compose.dockerUnavailable` once, fail nothing, and prune everything.
    const cliDir = seedGitTree("arggon-w4-parity-");
    const nativeDir = seedGitTree("arggon-w4-parity-");
    for (const dir of [cliDir, nativeDir]) {
      declareServices(dir, "true");
      addItems(dir, ["second"]);
    }
    // The CLI fixture must reach the same state, so it runs the same lifecycle.
    await completedWorktrees(cliDir, ["task-rate-limit", "task-second"]);
    const native = await completedWorktrees(nativeDir, ["task-rate-limit", "task-second"]);
    const bin = gitOnlyBin();

    const expected = runCli(
      ["cleanup", "--prune", "--no-gh", "--no-commit"],
      cliDir,
      spawnEnv({ PATH: bin }),
    );
    expect(expected.status, expected.stderr).toBe(0);
    const output = await withEnv({ PATH: bin }, () =>
      tool(native.defs, "cleanup").execute({ prune: true, no_gh: true, no_commit: true }),
    );
    const envelope = output.output as Record<string, unknown>;
    expect(envelope.compose).toEqual({ declared: "true", dockerUnavailable: true });
    expect(envelope.failures).toEqual([]);
    expect(normalize(expected.stdout, cliDir)).toBe(normalize(`${JSON.stringify(output.output)}\n`, nativeDir));
    for (const path of native.paths) expect(existsSync(path)).toBe(false);
  });
});
