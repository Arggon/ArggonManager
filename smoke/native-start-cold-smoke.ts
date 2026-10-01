#!/usr/bin/env node
/**
 * task-native-start-cold-smoke: deterministic, model-free cold-start smoke for
 * the native `tools.arggon.start` worktree path
 * (after bug-native-start-worktree-no-install).
 *
 * Why this harness exists
 * -----------------------
 * The native tool path repeatedly produced a cold worktree whose
 * dependency-requiring pre-commit gate could not run: the claim commit never
 * landed while the item looked claimed. The CLI integration tests prove link
 * preparation; this smoke proves the real native seam end to end — offline, no
 * OpenCode runtime, no provider, no quota. `npm run smoke:opencode` and
 * `npm run smoke:opencode:wave` stay the model-driven evidence and are
 * documented as such; this one is the durable, deterministic regression gate.
 *
 * What it drives
 * --------------
 * This checkout's own `opencode/plugins/arggon/index.ts` source (never the
 * vendored bundle — `npm run check:plugin` is what proves the committed bundle
 * is derived from it) with a `ctx.worktree` domain double backed by real
 * `git worktree`, matching the 2.0.10 Git strategy probed for W4: a detached
 * worktree at the start ref, `directory` as the parent, `list` from the git
 * inventory, `remove` with force. The kernel is the workspace build resolved
 * from THIS checkout (`import.meta.resolve`), so a stale primary build can
 * never stand in for the branch's — both paths are printed and asserted. The
 * process is a fresh `tsx` run per invocation, so no long-lived session's
 * module cache can serve a stale plugin build.
 *
 * The scenario
 * ------------
 * 1. a disposable fixture: a git repo whose primary checkout has an initialized
 *    tracker, a project install (`node_modules/native-gate-dep`) and a real,
 *    executable, dependency-requiring `pre-commit` gate that also writes a
 *    marker file;
 * 2. the gate is proven to FAIL in a cold worktree (no `node_modules`) — the
 *    exact failure the bug shipped. Never bypassed: no `--no-verify`, no
 *    skipped hook anywhere in this harness;
 * 3. `tools.arggon.start` on the item: a cold worktree is created through the
 *    domain, its dependencies are prepared, and the claim commit must land with
 *    the gate's marker written inside that worktree — and must contain only the
 *    item file;
 * 4. a second `start` attaches deterministically (no second domain create, no
 *    duplicate claim commit) and every install stays untouched;
 * 5. a second, install-free fixture reproduces BOTH incident flavors of
 *    bug-start-worktree-npm-ci-claim and asserts the readiness report names
 *    them: a sibling checkout's `.bin` on PATH runs the gate while the
 *    worktree resolves nothing (the claim lands, the receipt names the
 *    foreign `path` source and withholds readiness), and a worktree with no
 *    install anywhere fails its claim commit with the error naming the
 *    missing bin and the `npm ci` fix;
 * 6. teardown removes the worktrees, their git registrations and the whole
 *    disposable root, and the bounded receipts are asserted along the way.
 *
 * Exit codes: 0 passed; 1 a check failed (the fixture is kept for inspection);
 * 2 the harness could not run (this checkout's kernel build is missing).
 * `git` is a hard prerequisite. `ARGON_NATIVE_START_SMOKE_KEEP=1` keeps the
 * fixture on success too.
 *
 * Pure helpers (`isInside`, `installFingerprint`, `installDrift`,
 * `claimCommitFaults`, `receiptOverBudget`) are exported for
 * `smoke/native-start-cold-smoke.test.ts`; the scenario only runs when this
 * file is the process entrypoint.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
// Type-only: the runtime import below is deliberately dynamic (see main), so a
// checkout whose kernel was never built gets the actionable "build first" line
// instead of a bare ERR_MODULE_NOT_FOUND stack.
import type { ArgonToolDefinition, ArgonKernel } from "../opencode/plugins/arggon/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The item claimed by the smoke, and the branch the convention generates. */
const ITEM_ID = "task-cold-start-smoke";
/** The only dependency the primary checkout's install carries. */
const GATE_DEP = "native-gate-dep";
/** Marker the pre-commit gate appends to, proving it really ran. */
const GATE_MARKER = ".native-gate-ran";
/**
 * The fixture's project manifest: it declares the gate dependency, so the
 * fixture has the realistic shape where readiness can DISCOVER the gate's
 * binaries (bug-start-worktree-npm-ci-claim) — a manifest declaring nothing
 * gives the gate-bin probe nothing to report.
 */
const FIXTURE_MANIFEST = `${JSON.stringify(
  {
    name: "cold-start-smoke-fixture",
    private: true,
    devDependencies: { [GATE_DEP]: "1.0.0" },
  },
  null,
  2,
)}\n`;
const KEEP = process.env.ARGON_NATIVE_START_SMOKE_KEEP === "1";
const PROJECT_ID = "cold-smoke-project";

/**
 * The gate installed in the fixture's primary checkout. It resolves a package
 * that only that checkout's install carries, so a cold worktree fails the
 * commit — and it records the directory it ran in, which is how the smoke
 * proves the gate executed inside the freshly prepared worktree.
 */
const GATE_SCRIPT = [
  "#!/bin/sh",
  `# task-native-start-cold-smoke: a real, dependency-requiring pre-commit gate.`,
  `if ! node -e "require('${GATE_DEP}')" >/dev/null 2>&1; then`,
  `  echo "cold-start gate: dependency ${GATE_DEP} is not installed" >&2`,
  "  exit 1",
  "fi",
  `printf 'gate ran in %s\\n' "$PWD" >> ${GATE_MARKER}`,
  "",
].join("\n");

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in smoke/native-start-cold-smoke.test.ts)
// ---------------------------------------------------------------------------

/** True when `path` is `root` itself or lives under it. */
export function isInside(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`));
}

/**
 * What an install looks like right now: its entry count, a digest of the
 * entry names and the directory mtime, so comparing two fingerprints of the
 * SAME install is the honest "the primary was not touched" assertion. The count
 * and the digest are the load-bearing signals (an install that was emptied,
 * reified or swapped moves both); the mtime adds the reification case where
 * the same names come back re-linked. Two limits are load-bearing and are
 * asserted by the unit test: an mtime is a coarse-clock signal (Linux stamps a
 * directory from the current tick, so a remove-and-refill inside one tick is
 * caught by the count/digest, not by the mtime), and it only ever compares
 * against another fingerprint of the same path, because an mtime belongs to one
 * directory.
 */
export type InstallFingerprint = {
  path: string;
  entries: number;
  names: string;
  mtimeMs: number;
};

/** Fingerprint of `<dir>/node_modules` (throws when there is no install). */
export function installFingerprint(dir: string): InstallFingerprint {
  const modules = join(dir, "node_modules");
  const stat = statSync(modules);
  const names = readdirSync(modules).sort();
  return {
    path: modules,
    entries: names.length,
    names: createHash("sha256").update(names.join("\n")).digest("hex").slice(0, 16),
    mtimeMs: stat.mtimeMs,
  };
}

/** How an install changed between two fingerprints (empty = untouched). */
export function installDrift(before: InstallFingerprint, after: InstallFingerprint): string[] {
  const drift: string[] = [];
  if (before.entries !== after.entries) {
    drift.push(`entry count ${before.entries} -> ${after.entries}`);
  }
  if (before.names !== after.names) {
    drift.push(`entry set changed (${before.names} -> ${after.names})`);
  }
  // An mtime belongs to one directory: two different installs are never
  // "drifted" by their clocks, only by their contents.
  if (before.path === after.path && before.mtimeMs !== after.mtimeMs) {
    drift.push(`mtime ${before.mtimeMs} -> ${after.mtimeMs}`);
  }
  return drift;
}

/** Faults in a claim commit's file list (empty = exactly the item file). */
export function claimCommitFaults(committed: string[], itemPath: string): string[] {
  const faults: string[] = [];
  const extra = committed.filter((path) => path !== itemPath);
  if (extra.length > 0) {
    faults.push(`stages ${extra.length} non-item path(s): ${extra.join(", ")}`);
  }
  if (!committed.includes(itemPath)) {
    faults.push(`does not stage the item file ${itemPath}`);
  }
  return faults;
}

/**
 * Receipt bounds, mirroring the plugin's own caps (MAX_NATIVE_PREPARATION_*,
 * MAX_NATIVE_DETAIL_CHARS). A `node_modules` report must stay bounded however
 * attacker-shaped the install state is.
 */
export const NATIVE_RECEIPT_LIMITS = {
  maxNames: 32,
  maxNameChars: 200,
  maxValueChars: 500,
  maxBytes: 1024,
} as const;

/** Receipt fields over budget (empty = the receipt is bounded). */
export function receiptOverBudget(
  receipt: unknown,
  limits: {
    maxNames: number;
    maxNameChars: number;
    maxValueChars: number;
    maxBytes: number;
  } = NATIVE_RECEIPT_LIMITS,
): string[] {
  const over: string[] = [];
  const strings: Array<{ path: string; value: string }> = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      strings.push({ path, value });
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > limits.maxNames) {
        over.push(`${path} carries ${value.length} names (max ${limits.maxNames})`);
      }
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        walk(entry, path === "" ? key : `${path}.${key}`);
      }
    }
  };
  walk(receipt, "");
  for (const { path, value } of strings) {
    const max = path.endsWith("]") ? limits.maxNameChars : limits.maxValueChars;
    if (value.length > max) over.push(`${path} is ${value.length} chars (max ${max})`);
  }
  const bytes = Buffer.byteLength(JSON.stringify(receipt) ?? "", "utf8");
  if (bytes > limits.maxBytes) over.push(`receipt is ${bytes} bytes (max ${limits.maxBytes})`);
  return over;
}

// ---------------------------------------------------------------------------
// Fixture plumbing
// ---------------------------------------------------------------------------

type GitResult = { code: number; stdout: string; stderr: string };

function git(cwd: string, args: string[]): GitResult {
  const proc = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 60_000 });
  return { code: proc.status ?? -1, stdout: proc.stdout ?? "", stderr: proc.stderr ?? "" };
}

function gitOrThrow(cwd: string, args: string[]): string {
  const result = git(cwd, args);
  if (result.code !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in ${cwd} (exit ${result.code}): ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return result.stdout;
}

/** The canonical checkout of this repo (the main worktree), for read-only asserts. */
function canonicalCheckout(): string {
  for (const line of gitOrThrow(repoRoot, ["worktree", "list", "--porcelain"]).split("\n")) {
    if (line.startsWith("worktree ")) return resolve(line.slice("worktree ".length).trim());
  }
  return repoRoot;
}

/**
 * `ctx.worktree` domain double backed by real git: the observable contract of
 * the 2.0.10 Git strategy (detached worktree at the start ref, `directory` is
 * the parent, `list` reads the git inventory, `remove` needs force for a dirty
 * tree). Calls are recorded so the smoke can assert the plugin went through the
 * domain instead of shelling out to `git worktree` itself.
 */
function worktreeDomain(repo: string): {
  domain: {
    create(input: { projectID: string; name: string; directory?: string }): Promise<unknown>;
    list(input: { projectID: string }): Promise<unknown>;
    refresh(input: { projectID: string }): Promise<unknown>;
    remove(input: { projectID: string; directory: string; force?: boolean }): Promise<unknown>;
  };
  calls: { create: string[]; remove: string[] };
} {
  const calls = { create: [] as string[], remove: [] as string[] };
  return {
    calls,
    domain: {
      async create(input) {
        const target = join(String(input.directory ?? repo), input.name);
        gitOrThrow(repo, ["worktree", "add", "--detach", target]);
        calls.create.push(target);
        return { directory: target };
      },
      async list() {
        return gitOrThrow(repo, ["worktree", "list", "--porcelain"])
          .split("\n")
          .filter((line) => line.startsWith("worktree "))
          .map((line) => ({ directory: line.slice("worktree ".length).trim() }));
      },
      async refresh() {
        // The Git strategy has no saved inventory to refresh; nothing to do.
      },
      async remove(input) {
        gitOrThrow(repo, [
          "worktree",
          "remove",
          ...(input.force === true ? ["--force"] : []),
          input.directory,
        ]);
        calls.remove.push(input.directory);
      },
    },
  };
}

/** The disposable root: a temp dir holding the primary checkout + worktrees. */
function makeParent(): string {
  return realpathSync(mkdtempSync(join(tmpdir(), "arggon-native-start-cold-")));
}

/** A dependency only the primary checkout's install carries. */
function writeInstall(repo: string): void {
  const dep = join(repo, "node_modules", GATE_DEP);
  mkdirSync(dep, { recursive: true });
  writeFileSync(
    join(dep, "package.json"),
    `${JSON.stringify(
      { name: GATE_DEP, version: "1.0.0", main: "index.js", bin: { [GATE_DEP]: "./index.js" } },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(dep, "index.js"), "module.exports = 'cold-start gate dependency';\n");
  // The .bin shim npm leaves behind for a package with a `bin` field: the
  // readiness probe's resolution target (bug-start-worktree-npm-ci-claim).
  const binDir = join(repo, "node_modules", ".bin");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(binDir, GATE_DEP), `#!/bin/sh\nexit 0\n`, "utf8");
  chmodSync(join(binDir, GATE_DEP), 0o755);
  // The shape npm leaves behind, so the fixture's install is a plausible one.
  writeFileSync(
    join(repo, "node_modules", ".package-lock.json"),
    `${JSON.stringify({ name: GATE_DEP, lockfileVersion: 3, packages: {} }, null, 2)}\n`,
  );
}

/** The fixture's project manifest (declares the gate dependency). */
function writeManifest(repo: string): void {
  writeFileSync(join(repo, "package.json"), FIXTURE_MANIFEST, "utf8");
}

/**
 * The bin-lookup gate: passes ONLY when the `native-gate-dep` binary resolves
 * through the shell's PATH lookup — the lookup a sibling checkout's
 * `node_modules/.bin` on PATH can satisfy even though the worktree's own
 * install resolves nothing (bug-start-worktree-npm-ci-claim, incident 1).
 */
const BIN_GATE_SCRIPT = [
  "#!/bin/sh",
  `# task-native-start-cold-smoke: a PATH-lookup pre-commit gate.`,
  `if ! command -v ${GATE_DEP} >/dev/null 2>&1; then`,
  `  echo "cold-start gate: bin ${GATE_DEP} is not on PATH" >&2`,
  "  exit 1",
  "fi",
  `printf 'bin gate ran in %s\\n' "$PWD" >> ${GATE_MARKER}`,
  "",
].join("\n");

function writePreCommitGate(repo: string, script: string = GATE_SCRIPT): void {
  const hook = join(repo, ".git", "hooks", "pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(hook, script, "utf8");
  chmodSync(hook, 0o755);
}

/**
 * A "sibling worktree": another checkout of the fixture repo with its own
 * install, whose `.bin` lands on PATH for the masking scenario. The absolute
 * path is returned so the receipt's named resolution source can be asserted.
 */
function writeSiblingInstall(parent: string): string {
  const sibling = join(parent, "sibling-checkout");
  const binDir = join(sibling, "node_modules", ".bin");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(binDir, GATE_DEP), `#!/bin/sh\nexit 0\n`, "utf8");
  chmodSync(join(binDir, GATE_DEP), 0o755);
  return join(binDir, GATE_DEP);
}

/** Recursively find `<itemId>.md` under `root` (bounded: a four-item tree). */
function findItemFile(root: string, itemId: string): string | null {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === `${itemId}.md`) return full;
    }
  }
  return null;
}

/** The kernel's frontmatter parser, narrowed to what the smoke needs. */
type FrontmatterParser = (raw: string) => { data: Record<string, unknown> };

/** Frontmatter of an item file, as the kernel parses it. */
function readItemData(parseFrontmatter: FrontmatterParser, file: string): Record<string, unknown> {
  if (file === "" || !existsSync(file)) return {};
  return parseFrontmatter(readFileSync(file, "utf8")).data;
}

type Report = { passed: boolean };

function check(report: Report, name: string, ok: boolean, detail?: string): void {
  const suffix =
    ok || detail === undefined ? "" : `\n      ${detail.split("\n").slice(0, 8).join("\n      ")}`;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${suffix}`);
  if (!ok) report.passed = false;
}

// ---------------------------------------------------------------------------
// The scenario
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("smoke:native-start-cold — native tools.arggon.start cold worktree check");

  // Hermetic git: a machine-global `core.hooksPath` (or signing/identity
  // defaults) would silently move the fixture's pre-commit gate or fail its
  // commits. Set once for this process, so the plugin's own `git` calls inherit
  // it too.
  const nullConfig = process.platform === "win32" ? "NUL" : "/dev/null";
  process.env.GIT_CONFIG_GLOBAL = nullConfig;
  process.env.GIT_CONFIG_SYSTEM = nullConfig;

  const pluginSource = realpathSync(
    fileURLToPath(new URL("../opencode/plugins/arggon/index.ts", import.meta.url)),
  );
  // The plugin, the kernel and the CLI's own `init` are loaded dynamically on
  // purpose: all three resolve `@arggondev/lib` at import time, so a checkout
  // whose kernel was never built would otherwise die with a bare
  // ERR_MODULE_NOT_FOUND stack instead of the actionable line below.
  type PluginModule = typeof import("../opencode/plugins/arggon/index.js");
  let plugin: PluginModule | undefined;
  let kernel: ArgonKernel | undefined;
  let runInit: (input: { dir: string; force: boolean }) => unknown;
  try {
    plugin = await import("../opencode/plugins/arggon/index.js");
    kernel = await plugin.loadArgonKernel();
    if (kernel === undefined) throw new Error("@arggondev/lib is not loadable from this checkout");
    ({ runInit } = await import("../cli/src/init.js"));
  } catch (error) {
    console.error(
      "smoke:native-start-cold FAILED — the kernel build this smoke needs is missing " +
        `(${error instanceof Error ? error.message.split("\n")[0] : String(error)}). ` +
        `Build this checkout first: npm run build (it produces ${join(repoRoot, "lib", "dist")}).`,
    );
    process.exitCode = 2;
    return;
  }
  const { argonToolDefinitions, pluginTemplatesDir } = plugin;
  const { parseFrontmatter, runCreate } = kernel;
  let kernelPath: string;
  try {
    kernelPath = fileURLToPath(import.meta.resolve("@arggondev/lib"));
  } catch {
    console.error(
      "smoke:native-start-cold FAILED — @arggondev/lib is not resolvable from this checkout",
    );
    process.exitCode = 2;
    return;
  }
  const report: Report = { passed: true };
  console.log(`runtime: plugin ${pluginSource}`);
  console.log(`runtime: kernel ${kernelPath}`);
  check(
    report,
    "the runtime is this checkout's own plugin source and kernel build (no stale vendored/primary copy)",
    isInside(repoRoot, pluginSource) && isInside(repoRoot, kernelPath),
    `plugin ${pluginSource}\nkernel ${kernelPath}\ncheckout ${repoRoot}`,
  );

  const canonical = canonicalCheckout();
  const canonicalBefore = installFingerprint(canonical);
  const checkoutBefore = gitOrThrow(repoRoot, ["status", "--porcelain", "--untracked-files=all"]);

  const parent = makeParent();
  const repo = join(parent, "repo");
  mkdirSync(repo);
  let worktree = join(parent, `repo-${ITEM_ID}`);
  /** Worktrees of the failure-flavor fixtures (section 4b), for teardown. */
  const extraWorktrees: string[] = [];
  /** The no-install fixture repo that owns the section-4b worktrees. */
  const repoNoInstall = join(parent, "repo-no-install");
  console.log(`fixture: ${parent}`);
  try {
    // --- 1. the fixture: tracker, primary install, real pre-commit gate ----
    runInit({ dir: repo, force: false });
    const chain: Array<[string, string, string | undefined, string]> = [
      ["initiative", "Native start", undefined, "native-start"],
      ["epic", "Worktree", "native-start", "worktree"],
      ["story", "Cold start", "worktree", "cold-start"],
      ["task", "Native start cold smoke", "cold-start", "cold-start-smoke"],
    ];
    for (const [type, title, parentId, id] of chain) {
      runCreate({
        cwd: repo,
        type: type as "initiative" | "epic" | "story" | "task",
        title,
        ...(parentId !== undefined ? { parent: parentId } : {}),
        ...(id !== "" ? { id } : {}),
      });
    }
    writeFileSync(join(repo, ".gitignore"), "node_modules/\n", "utf8");
    writeManifest(repo);
    gitOrThrow(repo, ["init", "-q"]);
    gitOrThrow(repo, ["config", "user.email", "cold-smoke@example.test"]);
    gitOrThrow(repo, ["config", "user.name", "Cold Start Smoke"]);
    gitOrThrow(repo, ["config", "maintenance.auto", "false"]);
    gitOrThrow(repo, ["add", "-A"]);
    gitOrThrow(repo, ["commit", "-qm", "chore: fixture"]);
    writeInstall(repo);
    writePreCommitGate(repo);
    const itemFile = findItemFile(repo, ITEM_ID);
    if (itemFile === null) throw new Error(`seeded item ${ITEM_ID}.md not found in the fixture`);
    const itemPath = relative(repo, itemFile).split(sep).join("/");
    const fixtureBefore = installFingerprint(repo);
    check(
      report,
      "the fixture primary checkout has a project install and a dependency-requiring pre-commit gate",
      existsSync(join(repo, "node_modules", GATE_DEP, "index.js")) &&
        existsSync(join(repo, ".git", "hooks", "pre-commit")) &&
        // Executable, not merely present: git only runs a hook it can exec.
        (statSync(join(repo, ".git", "hooks", "pre-commit")).mode & 0o111) === 0o111,
      `item: ${itemPath}\ninstall: ${fixtureBefore.path} (${fixtureBefore.entries} entries)\ngate: ${join(repo, ".git", "hooks", "pre-commit")} (mode ${(statSync(join(repo, ".git", "hooks", "pre-commit")).mode & 0o777).toString(8)})`,
    );

    // --- 2. the gate really needs the dependency (the shipped failure) -----
    const probe = join(parent, "cold-probe");
    gitOrThrow(repo, ["worktree", "add", "--detach", probe]);
    writeFileSync(join(probe, "cold-probe.txt"), "cold\n", "utf8");
    gitOrThrow(probe, ["add", "--", "cold-probe.txt"]);
    const coldCommit = git(probe, ["commit", "-qm", "probe: commit in a cold worktree"]);
    check(
      report,
      "a cold worktree has no install, and the gate fails its commit there (no --no-verify)",
      !existsSync(join(probe, "node_modules")) &&
        coldCommit.code !== 0 &&
        coldCommit.stderr.includes(`dependency ${GATE_DEP} is not installed`) &&
        !existsSync(join(probe, GATE_MARKER)),
      `exit ${coldCommit.code}\nstderr: ${coldCommit.stderr.trim()}`,
    );
    gitOrThrow(repo, ["worktree", "remove", "--force", probe]);
    check(report, "the cold-probe worktree is removed again", !existsSync(probe), probe);

    // --- 3. the native start path on a cold worktree ----------------------
    const { domain, calls } = worktreeDomain(repo);
    const defs: ArgonToolDefinition[] = argonToolDefinitions(kernel, {
      cwd: repo,
      templatesDir: pluginTemplatesDir(),
      worktree: { projectID: PROJECT_ID, canonical: repo, domain },
    });
    const start = (): Promise<{ output: Record<string, unknown> }> => {
      const definition = defs.find((candidate) => candidate.name === "start");
      if (definition === undefined) throw new Error("the native namespace has no start tool");
      return definition.execute(
        { id: ITEM_ID, assignee: "cold-smoke" },
        {
          sessionID: "cold-smoke",
        },
      ) as Promise<{ output: Record<string, unknown> }>;
    };

    let first: Record<string, unknown>;
    try {
      first = (await start()).output;
    } catch (error) {
      // A native start failure is a typed tool error carrying the envelope. The
      // bug this smoke guards is exactly this shape (a cold worktree whose gate
      // could not run), so report the receipt fields, never a raw dump.
      const envelope = ((error as { envelope?: unknown }).envelope ?? {}) as Record<
        string,
        unknown
      >;
      const failure = (envelope.error ?? {}) as Record<string, unknown>;
      throw new Error(
        [
          `native start failed (${String(failure.code ?? "no code")}): ${String(failure.message ?? error)}`,
          `preparation: ${JSON.stringify(envelope.preparation ?? null)}`,
          `claimCommitted: ${String(envelope.claimCommitted)}`,
          `claimCommit: ${JSON.stringify(envelope.claimCommit ?? null)}`,
        ].join("\n"),
      );
    }
    worktree = String(first.worktreePath);
    const preparation = (first.preparation ?? {}) as Record<string, unknown>;
    const claimCommit = (first.claimCommit ?? {}) as Record<string, unknown>;
    check(
      report,
      "start creates the cold worktree through the domain and claims the item there",
      first.ok === true &&
        first.worktreeCreated === true &&
        worktree === join(parent, `repo-${ITEM_ID}`) &&
        calls.create.length === 1 &&
        first.branch === `feat/${ITEM_ID}`,
      `worktree: ${worktree}\nbranch: ${String(first.branch)}\ndomain create calls: ${calls.create.length}`,
    );
    check(
      report,
      "the dependency preparation is explicit and ready before the claim commit",
      preparation.ready === true &&
        preparation.install === "linked" &&
        preparation.linkedNodeModules === true &&
        Array.isArray(preparation.linkedWorkspaces) &&
        preparation.linkedWorkspaces.length === 0,
      `preparation: ${JSON.stringify(preparation)}`,
    );
    const gateBins = (preparation.gateBins ?? []) as Array<Record<string, unknown>>;
    check(
      report,
      "the readiness receipt names the gate bin as resolving INSIDE the worktree (bug-start-worktree-npm-ci-claim)",
      gateBins.length === 1 &&
        gateBins[0].name === GATE_DEP &&
        gateBins[0].source === "worktree" &&
        typeof gateBins[0].path === "string" &&
        String(gateBins[0].path).startsWith(worktree),
      `gateBins: ${JSON.stringify(gateBins)}\nworktree: ${worktree}`,
    );
    check(
      report,
      "the readiness/claim-commit receipt stays bounded",
      receiptOverBudget(preparation).length === 0 && receiptOverBudget(first.commit).length === 0,
      `preparation: ${receiptOverBudget(preparation).join("; ")}\ncommit: ${receiptOverBudget(first.commit).join("; ")}`,
    );
    check(
      report,
      "the claim commit landed and the gate ran in the worktree it prepared",
      first.claimCommitted === true &&
        claimCommit.status === "committed" &&
        typeof claimCommit.hash === "string" &&
        existsSync(join(worktree, GATE_MARKER)) &&
        readFileSync(join(worktree, GATE_MARKER), "utf8").trim() === `gate ran in ${worktree}`,
      `claimCommit: ${JSON.stringify(claimCommit)}\nmarker: ${readFileSync(join(worktree, GATE_MARKER), "utf8").trim()}`,
    );
    const committed = gitOrThrow(worktree, ["show", "--name-only", "--pretty=format:", "HEAD"])
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    check(
      report,
      "the claim commit contains only the item file",
      claimCommitFaults(committed, itemPath).length === 0,
      `commit paths: ${committed.join(", ")}\nexpected only: ${itemPath}\nworktree status: ${gitOrThrow(worktree, ["status", "--porcelain"]).trim()}`,
    );
    check(
      report,
      "the worktree's prepared install is untracked and never committed",
      !committed.some((path) => path === "node_modules" || path.startsWith("node_modules/")) &&
        existsSync(join(worktree, "node_modules", GATE_DEP, "index.js")),
      `node_modules -> ${realpathSync(join(worktree, "node_modules"))}`,
    );
    check(
      report,
      "the fixture primary install is untouched by the claim commit",
      installDrift(fixtureBefore, installFingerprint(repo)).length === 0,
      installDrift(fixtureBefore, installFingerprint(repo)).join("; "),
    );
    check(
      report,
      "the canonical checkout's install is untouched (never emptied or reified)",
      installDrift(canonicalBefore, installFingerprint(canonical)).length === 0,
      `${canonicalBefore.path}: ${canonicalBefore.entries} entries before\ndrift: ${installDrift(canonicalBefore, installFingerprint(canonical)).join("; ") || "none"}`,
    );

    // --- 4. re-running start attaches, without a duplicate claim commit ----
    const headAfterFirst = gitOrThrow(worktree, ["rev-parse", "HEAD"]).trim();
    const markerAfterFirst = readFileSync(join(worktree, GATE_MARKER), "utf8").trim().split("\n");
    const second = (await start()).output;
    const headAfterSecond = gitOrThrow(worktree, ["rev-parse", "HEAD"]).trim();
    const claimCommits = gitOrThrow(worktree, ["log", "--format=%s", `refs/heads/feat/${ITEM_ID}`])
      .split("\n")
      .filter((subject) => subject === `chore(tasks): claimed ${ITEM_ID}`).length;
    check(
      report,
      "a second start attaches to the same worktree (one domain create, no re-creation)",
      second.ok === true &&
        second.worktreeCreated === false &&
        second.worktreePath === worktree &&
        calls.create.length === 1,
      `worktree: ${String(second.worktreePath)}\ndomain create calls: ${calls.create.length}`,
    );
    const markerLines = readFileSync(join(worktree, GATE_MARKER), "utf8").trim().split("\n").length;
    check(
      report,
      "the re-run adds no duplicate claim commit",
      second.claimCommitted === true &&
        (second.claimCommit as Record<string, unknown> | undefined)?.status === "not-needed" &&
        headAfterSecond === headAfterFirst &&
        claimCommits === 1,
      `HEAD ${headAfterFirst.slice(0, 8)} -> ${headAfterSecond.slice(0, 8)}\nclaim commits on branch: ${claimCommits}\nclaimCommitted: ${String(second.claimCommitted)}\ngate marker lines: ${markerAfterFirst.length} -> ${markerLines} (git runs the pre-commit hook on the empty attempt too, so a second line proves the gate was never bypassed, not a second commit)\nreceipt: ${JSON.stringify(second.claimCommit)}`,
    );
    const claimed = readItemData(parseFrontmatter, findItemFile(worktree, ITEM_ID) ?? "");
    check(
      report,
      "the claim records live in the worktree copy, not in the canonical checkout",
      claimed.status === "in_progress" &&
        claimed.assignee === "cold-smoke" &&
        claimed.branch === `feat/${ITEM_ID}` &&
        claimed.worktree_path === worktree &&
        readItemData(parseFrontmatter, itemFile).status === "todo",
      `worktree copy: ${JSON.stringify(claimed)}\ncanonical copy: ${JSON.stringify(readItemData(parseFrontmatter, itemFile))}`,
    );
    check(
      report,
      "the canonical checkout's install is still untouched after the re-run",
      installDrift(canonicalBefore, installFingerprint(canonical)).length === 0,
      installDrift(canonicalBefore, installFingerprint(canonical)).join("; "),
    );

    // --- 4b. BOTH failure flavors are named by the readiness report --------
    // bug-start-worktree-npm-ci-claim: two independent incidents. Flavor 1
    // (wrong resolution source): a sibling checkout's `.bin` on PATH ran the
    // gate while the worktree resolved nothing — the claim landed and the
    // broken install stayed invisible. Flavor 2 (missing install): no
    // install anywhere, and the claim commit died with a bare
    // `tsx: command not found`. Both fixtures below have NO install at all;
    // only PATH differs.
    const pathItemId = "task-cold-bin-path";
    const missingItemId = "task-cold-bin-missing";
    const pathWorktree = join(parent, `repo-no-install-${pathItemId}`);
    const missingWorktree = join(parent, `repo-no-install-${missingItemId}`);
    extraWorktrees.push(pathWorktree, missingWorktree);
    {
      runInit({ dir: repoNoInstall, force: false });
      const chain2: Array<[string, string, string | undefined, string]> = [
        ["initiative", "Bin resolution", undefined, "bin-resolution"],
        ["epic", "Cold flavors", "bin-resolution", "cold-flavors"],
        ["story", "Named failures", "cold-flavors", "named-failures"],
        ["task", "Sibling path masking", "named-failures", "cold-bin-path"],
        ["task", "Missing install", "named-failures", "cold-bin-missing"],
      ];
      for (const [type, title, parentId, id] of chain2) {
        runCreate({
          cwd: repoNoInstall,
          type: type as "initiative" | "epic" | "story" | "task",
          title,
          ...(parentId !== undefined ? { parent: parentId } : {}),
          ...(id !== "" ? { id } : {}),
        });
      }
      writeManifest(repoNoInstall);
      gitOrThrow(repoNoInstall, ["init", "-q"]);
      gitOrThrow(repoNoInstall, ["config", "user.email", "cold-smoke@example.test"]);
      gitOrThrow(repoNoInstall, ["config", "user.name", "Cold Start Smoke"]);
      gitOrThrow(repoNoInstall, ["config", "maintenance.auto", "false"]);
      gitOrThrow(repoNoInstall, ["add", "-A"]);
      gitOrThrow(repoNoInstall, ["commit", "-qm", "chore: fixture (no install)"]);
      // The gate looks the binary up through the shell (PATH), like `npm run`
      // resolves `tsx` — never bypassed, no --no-verify anywhere.
      writePreCommitGate(repoNoInstall, BIN_GATE_SCRIPT);

      const { domain: domain2 } = worktreeDomain(repoNoInstall);
      const defs2: ArgonToolDefinition[] = argonToolDefinitions(kernel, {
        cwd: repoNoInstall,
        templatesDir: pluginTemplatesDir(),
        worktree: { projectID: PROJECT_ID, canonical: repoNoInstall, domain: domain2 },
      });
      const start2 = (id: string): Promise<{ output: Record<string, unknown> }> => {
        const definition = defs2.find((candidate) => candidate.name === "start");
        if (definition === undefined) throw new Error("the native namespace has no start tool");
        return definition.execute(
          { id, assignee: "cold-smoke" },
          { sessionID: "cold-smoke" },
        ) as Promise<{ output: Record<string, unknown> }>;
      };
      const preparationOf = (envelope: Record<string, unknown>): Record<string, unknown> =>
        (envelope.preparation ?? {}) as Record<string, unknown>;
      const gateBinsOf = (envelope: Record<string, unknown>): Array<Record<string, unknown>> =>
        (preparationOf(envelope).gateBins ?? []) as Array<Record<string, unknown>>;

      // Flavor 1: the sibling's bin masks the absent worktree install — the
      // gate PASSES and the claim lands, but the receipt must name the
      // foreign resolution and withhold readiness.
      const savedPath = process.env.PATH ?? "";
      const siblingBin = writeSiblingInstall(parent);
      process.env.PATH = `${dirname(siblingBin)}:${savedPath}`;
      let masked: Record<string, unknown>;
      try {
        masked = (await start2(pathItemId)).output;
      } finally {
        process.env.PATH = savedPath;
      }
      const maskedBins = gateBinsOf(masked);
      check(
        report,
        "flavor 1 (wrong resolution source): a sibling .bin on PATH runs the gate, and the receipt names it",
        masked.ok === true &&
          masked.claimCommitted === true &&
          masked.worktreePath === pathWorktree &&
          preparationOf(masked).ready === false &&
          preparationOf(masked).install === "missing" &&
          maskedBins.length === 1 &&
          maskedBins[0].name === GATE_DEP &&
          maskedBins[0].source === "path" &&
          maskedBins[0].path === siblingBin,
        `gateBins: ${JSON.stringify(maskedBins)}\nsibling bin: ${siblingBin}\nmarker: ${existsSync(join(pathWorktree, GATE_MARKER))}`,
      );

      // Flavor 2: no install anywhere, nothing on PATH — the claim commit
      // fails, and the typed failure names the missing bin and the exact fix.
      let missingEnvelope: Record<string, unknown> = {};
      let missingError = "";
      try {
        await start2(missingItemId);
        missingError = "start unexpectedly succeeded";
      } catch (error) {
        missingEnvelope = ((error as { envelope?: unknown }).envelope ?? {}) as Record<
          string,
          unknown
        >;
        const failure = (missingEnvelope.error ?? {}) as Record<string, unknown>;
        missingError = String(failure.message ?? error);
      }
      const missingBins = gateBinsOf(missingEnvelope);
      check(
        report,
        "flavor 2 (missing install): the claim commit fails, and the failure names the missing bin + the npm ci fix",
        missingEnvelope.ok === false &&
          missingEnvelope.claimCommitted === false &&
          missingWorktree !== undefined &&
          existsSync(missingWorktree) &&
          preparationOf(missingEnvelope).install === "missing" &&
          missingBins.length === 1 &&
          missingBins[0].name === GATE_DEP &&
          missingBins[0].source === "missing" &&
          missingBins[0].path === undefined &&
          missingError.includes("not resolvable from the worktree") &&
          missingError.includes("npm ci"),
        `gateBins: ${JSON.stringify(missingBins)}\nerror: ${missingError.split("\n").slice(0, 6).join("\n")}`,
      );
    }
  } catch (error) {
    report.passed = false;
    console.error(`      harness error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // --- 7. teardown: no worktree, no registration, no leftover process ---
    // Every spawn above is synchronous or awaited by the plugin, so nothing of
    // this run is still running here; what teardown owns is the filesystem and
    // git state. Best-effort by design: a harness error must not mask the
    // checks that already failed.
    const teardownErrors: string[] = [];
    const isRepo = existsSync(join(repo, ".git"));
    const isRepoNoInstall = existsSync(join(repoNoInstall, ".git"));
    for (const dir of [worktree, join(parent, "cold-probe"), ...extraWorktrees]) {
      if (!existsSync(dir)) continue;
      // git worktree remove needs the repo the worktree belongs to; a
      // failure-flavor worktree belongs to its own fixture repo.
      const fromRepoNoInstall = extraWorktrees.includes(dir);
      const owner = fromRepoNoInstall ? repoNoInstall : repo;
      if (fromRepoNoInstall && !isRepoNoInstall) {
        // The harness died before the fixture repo existed: fall back to a
        // plain recursive remove so teardown still leaves nothing behind.
        rmSync(dir, { recursive: true, force: true });
        continue;
      }
      const removed = git(owner, ["worktree", "remove", "--force", dir]);
      if (removed.code !== 0)
        teardownErrors.push(`worktree remove ${dir}: ${removed.stderr.trim()}`);
    }
    if (isRepo) {
      const pruned = git(repo, ["worktree", "prune"]);
      if (pruned.code !== 0) teardownErrors.push(`worktree prune: ${pruned.stderr.trim()}`);
    }
    if (isRepoNoInstall) {
      const pruned = git(repoNoInstall, ["worktree", "prune"]);
      if (pruned.code !== 0)
        teardownErrors.push(`worktree prune (no-install): ${pruned.stderr.trim()}`);
    }
    const registered = isRepo
      ? git(repo, ["worktree", "list", "--porcelain"])
          .stdout.split("\n")
          .filter((line) => line.startsWith("worktree "))
          .map((line) => line.slice("worktree ".length).trim())
          .filter((dir) => resolve(dir) !== resolve(repo))
      : [];
    const registeredNoInstall = isRepoNoInstall
      ? git(repoNoInstall, ["worktree", "list", "--porcelain"])
          .stdout.split("\n")
          .filter((line) => line.startsWith("worktree "))
          .map((line) => line.slice("worktree ".length).trim())
          .filter((dir) => resolve(dir) !== resolve(repoNoInstall))
      : [];
    const leftover = [worktree, join(parent, "cold-probe"), ...extraWorktrees].filter((dir) =>
      existsSync(dir),
    );
    // A failed run keeps its fixture for inspection (the age-gated `arggon-*`
    // tmpdir purge in test/teardown-tmp.ts reclaims it later); a passing run
    // leaves nothing behind at all.
    const keep = !report.passed;
    if (!keep) rmSync(parent, { recursive: true, force: true });
    check(
      report,
      "the worktree and its git registration are gone",
      registered.length === 0 &&
        registeredNoInstall.length === 0 &&
        leftover.length === 0 &&
        teardownErrors.length === 0,
      [
        ...teardownErrors,
        ...leftover.map((dir) => `left behind: ${dir}`),
        ...registered.map((dir) => `still registered: ${dir}`),
        ...registeredNoInstall.map((dir) => `still registered (no-install fixture): ${dir}`),
      ].join("; "),
    );
    if (keep) {
      console.log(`      fixture kept for inspection: ${parent}`);
    } else {
      check(report, "the disposable root is removed", !existsSync(parent), parent);
    }
  }

  // --- 8. the harness wrote nothing outside its disposable root ----------
  const checkoutAfter = gitOrThrow(repoRoot, ["status", "--porcelain", "--untracked-files=all"]);
  check(
    report,
    "this checkout is unchanged (the smoke wrote only inside its disposable root)",
    checkoutAfter === checkoutBefore,
    checkoutAfter === checkoutBefore
      ? "working tree identical before/after"
      : `before:\n${checkoutBefore}\nafter:\n${checkoutAfter}`,
  );
  check(
    report,
    "the canonical checkout's install is untouched after teardown",
    installDrift(canonicalBefore, installFingerprint(canonical)).length === 0,
    installDrift(canonicalBefore, installFingerprint(canonical)).join("; "),
  );

  if (report.passed) {
    console.log(
      "\nsmoke:native-start-cold passed — a cold native start prepared its worktree, " +
        "the dependency-requiring gate ran and the claim commit landed with only the item file",
    );
    if (KEEP) console.log(`fixture kept: ${parent}`);
    return;
  }
  console.error(
    `\nsmoke:native-start-cold FAILED — see the failing checks above` +
      (existsSync(parent) ? ` (fixture kept: ${parent})` : ""),
  );
  process.exitCode = 1;
}

// Direct-run guard: the pure helpers stay importable by the unit test wrapper.
const invokedDirectly = ((): boolean => {
  try {
    return (
      process.argv[1] !== undefined &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(
      `smoke:native-start-cold FAILED — ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
