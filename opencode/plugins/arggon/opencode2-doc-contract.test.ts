/**
 * `docs/opencode2.md` §Payload contract ↔ the shipped native `start` payload
 * (task-opencode2-payload-contract-preparation-fields).
 *
 * The payload contract in `ArggonManager/docs/opencode2.md` is the only place
 * a native-caller author can learn what `start` answers, and it had silently
 * fallen behind the code: the `preparation` receipt's `steps` log and its two
 * additive fragments — `preparation.claim` (the claim-stamp / take-over
 * receipt, task-single-writer-worktree-enforcement) and `preparation.env` (the
 * worktree env contract, spec worktree-env-contract-016) — all shipped for
 * months without a row, so a take-over receipt was invisible to every reader
 * of the architecture doc. Nothing links the doc to the code, which is why it
 * could rot twice.
 *
 * So this suite runs the REAL seam and reads the REAL corpus — the same posture
 * as `cli/src/prose-format.test.ts` and `cli/src/adr-index-parity.test.ts`, both
 * of which pin the repository's own docs instead of a fixture that drifts:
 *
 *   1. COVERAGE, both directions — every field the shipped payload carries is
 *      a row in the doc's field table, and every row was observed in a real
 *      run. The first half is the gate the item asks for (a new
 *      `preparation.*` field cannot ship undocumented); the second half keeps
 *      the table from documenting a field the code cannot produce.
 *   2. STRUCTURE — each row's `Type` cell must accept every runtime value kind
 *      observed at that path, and the literal unions it states must equal the
 *      kernel's own union (`WorktreeInstallState`, `ManifestCoverage`), read
 *      from `lib/src/worktree.ts`. A name-only grep would pass on a wrong type
 *      or a renamed vocabulary member.
 *   3. BOUNDS — each capped list's `Bound` cell must name the kernel constant
 *      that caps it AND its value, and the real runs must respect the cap: the
 *      over-cap scenario reports the exact `total` beside a 10-name
 *      `files` list with `truncated: true`. A wrong bound fails.
 *   4. ENTRY SHAPES — the `{ … }` shapes the `object[]` rows carry in their
 *      notes must match the kernel's struct fields, so renaming a receipt field
 *      cannot leave a stale shape behind.
 *
 * The scenarios walk one fixture through every branch that adds a field:
 * fresh claim (env written, keys, seeded `.env`, gitignore probe, stamp),
 * the owner's own attach (env left byte-identical → `warning`), a foreign
 * attach (`foreignWrites`), the audited take-over, a SECOND take-over (so the
 * replaced stamp carries a persisted `takeovers` chain), an over-cap detection
 * (`truncated`), and an unwritable stamp (`claim.warning`). A second fixture
 * then overflows the preparation log itself, so the kernel's own
 * `MAX_PREP_STEPS` cap and the mirrored `stepsTruncated` are observed on a real
 * run (bug-native-steps-truncated-flag-dropped) — without it the documented row
 * would read as a field no run ever carried. Arrays are the one documented
 * granularity the walker treats as terminal: a `string[]`/`object[]` cell
 * describes its entries, so entries are not walked as paths.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  MAX_CLAIM_TAKEOVERS,
  MAX_GATE_BINS,
  MAX_MISSING_DEPENDENCIES,
  MAX_PREP_STEPS,
  WORKTREE_ENV_KEYS,
  runCreate,
} from "@arggondev/lib";
import { runInit } from "../../../cli/src/init.js";
import {
  argonToolDefinitions,
  loadArgonKernel,
  pluginTemplatesDir,
  type ArgonKernel,
  type ArgonToolDefinition,
} from "./index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const docPath = join(repoRoot, "ArggonManager/docs/opencode2.md");
const kernelSourcePath = join(repoRoot, "lib/src/worktree.ts");

/** One observed path: every runtime kind and every string value seen there. */
type PathObservation = { kinds: Set<string>; strings: Set<string>; value?: unknown };

/** One documented row of the `preparation` field table. */
type Row = { path: string; declared: string; values: string[]; bound: string; notes: string };

const observed = new Map<string, PathObservation>();
/** The over-cap detection's `preparation` receipt, kept for the bound assertions. */
let overCap: Record<string, unknown> = {};
/** Absorbs the per-worktree state/cache dirs the env contract creates. */
const tmpDirs: string[] = [];

const stateHomeBefore = {
  XDG_STATE_HOME: process.env.XDG_STATE_HOME,
  XDG_CACHE_HOME: process.env.XDG_CACHE_HOME,
};

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

afterAll(() => {
  for (const [name, value] of Object.entries(stateHomeBefore)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function mkdtemp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

function git(dir: string, args: string[]): string {
  const proc = spawnSync("git", args, { cwd: dir, encoding: "utf8", timeout: 30_000 });
  expect(proc.status, proc.stderr).toBe(0);
  return (proc.stdout ?? "").trim();
}

/** Initialized tracker in a git repo (the worktree tools need both). */
function seed(): string {
  const parent = mkdtemp("arggon-doc-parent-");
  const dir = join(parent, "repo");
  mkdirSync(dir);
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
  git(dir, ["init", "-q"]);
  git(dir, ["config", "maintenance.auto", "false"]);
  git(dir, ["config", "user.email", "doc-contract@example.com"]);
  git(dir, ["config", "user.name", "doc-contract"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", "fixture"]);
  // The env contract seeds the worktree `.env` copy-if-absent from the
  // primary, and `preparation.env.seededDotenv` is a field under contract. It
  // stays UNTRACKED and lands AFTER the commit: a committed `.env` would
  // already exist in the fresh worktree and copy-if-absent would (correctly)
  // skip it.
  writeFileSync(join(dir, ".env"), "TOKEN=fixture\n", "utf8");
  return dir;
}

/** `ctx.worktree` backed by real git (the same fake the W4 suite drives). */
function fakeDomain(dir: string) {
  return {
    async create(input: { name: string; directory?: string }): Promise<unknown> {
      const target = join(String(input.directory ?? dir), input.name);
      git(dir, ["worktree", "add", "--detach", target]);
      return { directory: target };
    },
    async list(): Promise<unknown> {
      return git(dir, ["worktree", "list", "--porcelain"])
        .split("\n")
        .filter((line) => line.startsWith("worktree "))
        .map((line) => ({ directory: line.slice("worktree ".length).trim() }));
    },
    async refresh(): Promise<unknown> {
      return undefined;
    },
    async remove(input: { directory: string; force?: boolean }): Promise<void> {
      git(dir, ["worktree", "remove", ...(input.force === true ? ["--force"] : []), input.directory]);
    },
  };
}

function tool(defs: ArgonToolDefinition[], name: string): ArgonToolDefinition {
  const found = defs.find((entry) => entry.name === name);
  expect(found, `tool '${name}' is registered`).toBeDefined();
  return found as ArgonToolDefinition;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function kindOf(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "array[]";
    return value.every((entry) => typeof entry === "string")
      ? "string[]"
      : value.every(isPlainObject)
        ? "object[]"
        : "mixed[]";
  }
  if (isPlainObject(value)) return "object";
  if (value === null) return "null";
  return typeof value;
}

/**
 * Record one payload path. Arrays are terminal: a `string[]`/`object[]` cell
 * documents its own entries, so a nested key never becomes a path here.
 */
function observe(path: string, value: unknown): void {
  const entry = observed.get(path) ?? { kinds: new Set<string>(), strings: new Set<string>() };
  if (entry.value === undefined) entry.value = value;
  entry.kinds.add(kindOf(value));
  if (typeof value === "string") entry.strings.add(value);
  observed.set(path, entry);
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) observe(`${path}.${key}`, child);
  }
}

/**
 * Link `count` committed workspace packages into the primary's install, so the
 * kernel's preparation log records one build decision per package
 * (bug-native-steps-truncated-flag-dropped). Discovery goes through install
 * symlinks that resolve into the checkout, so the packages must be committed
 * AND the links (uncommitted) present. Each package declares no entry file and
 * no `build` script: the decision is still recorded (`no-build-script`) without
 * a build ever running, so the log overflows on the package COUNT.
 */
function addWorkspacePackages(dir: string, count: number): void {
  const scope = join(dir, "node_modules", "@scope");
  mkdirSync(scope, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    const pkgDir = join(dir, "packages", `pkg-${index}`);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      `${JSON.stringify({ name: `@scope/pkg-${index}`, version: "1.0.0", private: true }, null, 2)}\n`,
      "utf8",
    );
    symlinkSync(pkgDir, join(scope, `pkg-${index}`), "dir");
  }
  git(dir, ["add", "packages"]);
  git(dir, ["commit", "-qm", "test: workspace packages"]);
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
  writeFileSync(itemFile, `${readFileSync(itemFile, "utf8")}\n<!-- foreign edit -->\n`, "utf8");
  const when = new Date(Date.now() + 60_000);
  utimesSync(itemFile, when, when);
}

function worktreeGitDir(worktreePath: string): string {
  return git(worktreePath, ["rev-parse", "--absolute-git-dir"]);
}

beforeAll(async () => {
  // The env contract creates the per-worktree state/cache dirs under the
  // per-OS bases; keep them inside the fixture instead of the real home.
  const stateHome = mkdtemp("arggon-doc-state-");
  process.env.XDG_STATE_HOME = stateHome;
  process.env.XDG_CACHE_HOME = stateHome;

  const kernel = (await loadArgonKernel()) as ArgonKernel;
  const dir = seed();
  const defs = argonToolDefinitions(kernel, {
    cwd: dir,
    templatesDir: pluginTemplatesDir(),
    worktree: { projectID: "project-id", canonical: dir, domain: fakeDomain(dir) },
  });
  const start = tool(defs, "start");
  const run = async (
    input: Record<string, unknown>,
    sessionID: string,
  ): Promise<{ worktreePath: string; preparation: Record<string, unknown> }> => {
    const executed = await start.execute(
      { id: "task-rate-limit", assignee: "smoke", ...input },
      { sessionID },
    );
    const output = executed.output as Record<string, unknown>;
    expect(output.ok, `start (${sessionID}) succeeded`).toBe(true);
    const preparation = isPlainObject(output.preparation) ? output.preparation : {};
    observe("preparation", preparation);
    return { worktreePath: String(output.worktreePath ?? ""), preparation };
  };

  // 1. Fresh claim: the worktree is created, the env file is written, the claim
  //    stamp is laid down. Every always-present field is observed here.
  const fresh = await run({}, "ses_a");
  const worktreePath = fresh.worktreePath;
  expect(existsSync(join(worktreePath, ".arggon.env"))).toBe(true);
  // 2. The owner's own attach: the env file is left byte-identical, so
  //    `preparation.env.written: false` rides a `warning`.
  await run({}, "ses_a");
  // 3. A foreign session attaches over newer writes: the detection fires and is
  //    reported (report-only unless `x-tracker.strict-worktree-writes`).
  //    Every scenario below writes again first: the previous attach COMMITTED
  //    the item file, so its tree is clean again and a detection only fires on
  //    tracked writes newer than the stamp.
  foreignWrite(worktreePath);
  await run({}, "ses_b");
  // 4. The audited take-over of the presumed-dead stamped owner.
  foreignWrite(worktreePath);
  await run({ takeOverWorktree: true }, "ses_b");
  // 5. A second take-over, so the REPLACED stamp carries a persisted chain.
  foreignWrite(worktreePath);
  await run({ takeOverWorktree: true }, "ses_c");
  // 6. Over-cap evidence: twelve staged tracked writes name ten, so the receipt
  //    reports the exact total beside the cap and folds `truncated`.
  for (let index = 0; index < 12; index += 1) {
    const name = `dirty-${String(index).padStart(2, "0")}.md`;
    writeFileSync(join(worktreePath, name), `dirty ${index}\n`, "utf8");
    git(worktreePath, ["add", name]);
  }
  overCap = (await run({}, "ses_d")).preparation;
  // 7. An unwritable stamp degrades to `stamped: false` plus a `warning`: a
  //    directory where the stamp file belongs makes the write fail on any path.
  const stampPath = join(worktreeGitDir(worktreePath), "arggon-claim.json");
  rmSync(stampPath, { force: true });
  // `mkdirSync` has no `force`; `recursive` is the idempotent form (recreating
  // over an existing directory must not throw EEXIST).
  mkdirSync(stampPath, { recursive: true });
  await run({}, "ses_c");
  // 8. Over-cap PREPARATION LOG (bug-native-steps-truncated-flag-dropped): a
  //    second fixture whose primary install links MAX_PREP_STEPS workspace
  //    packages, so more preparation decisions than the kernel's own log cap
  //    exist and the mirrored `stepsTruncated` is observed on a real run.
  const logDir = seed();
  addWorkspacePackages(logDir, MAX_PREP_STEPS);
  const logDefs = argonToolDefinitions(kernel, {
    cwd: logDir,
    templatesDir: pluginTemplatesDir(),
    worktree: { projectID: "project-id", canonical: logDir, domain: fakeDomain(logDir) },
  });
  const logOutput = (await tool(logDefs, "start").execute(
    { id: "task-rate-limit", assignee: "smoke" },
    { sessionID: "ses_e" },
  )).output as Record<string, unknown>;
  const logPreparation = isPlainObject(logOutput.preparation) ? logOutput.preparation : {};
  const logSteps = Array.isArray(logPreparation.steps) ? logPreparation.steps : [];
  expect(logSteps, "the kernel's own cap bounds the log").toHaveLength(MAX_PREP_STEPS);
  expect(logPreparation.stepsTruncated, "the kernel's decision is mirrored").toBe(true);
  expect(logPreparation.truncated, "the mirrored flag also folds into `truncated`").toBe(true);
  observe("preparation", logPreparation);
}, 300_000);

// ---------------------------------------------------------------------------
// The documented corpus
// ---------------------------------------------------------------------------

/** One `| … |` row, split on UNESCAPED pipes (a `\|` lives inside type cells). */
function tableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  return trimmed
    .slice(1, trimmed.endsWith("|") ? trimmed.length - 1 : undefined)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

const isDelimiterRow = (cells: string[]): boolean =>
  cells.every((cell) => /^:?-{3,}:?$/.test(cell));

/** `` `preparation.claim.takeOver.by` `` / `…?` → the bare payload path. */
function parseFieldPath(cell: string): string | null {
  return /^`(preparation(?:\.[A-Za-z0-9_]+)*)\??`$/.exec(cell)?.[1] ?? null;
}

/** The row's `Type` cell: a base type, or a literal union to compare exactly. */
function parseType(cell: string): { declared: string; values: string[] } {
  const inner = cell.replace(/`/g, "");
  const values = [...inner.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  return { declared: values.length > 0 ? "enum" : inner, values };
}

const docLines = readFileSync(docPath, "utf8").split("\n");

/**
 * The payload-contract table's `start` row, as a raw line: that cell quotes
 * literal unions with UNESCAPED pipes, so it is deliberately not read as
 * pipe-split cells (GFM would cut it into pieces).
 */
const startRowLine: string = (() => {
  const rows = docLines
    .map((line) => line.trim())
    .filter((line) => /^\|\s*`start`\s*\|/.test(line));
  expect(rows, "the payload contract table still has exactly one `start` row").toHaveLength(1);
  return rows[0] ?? "";
})();

/** Every `preparation` field row of the field-by-field table. */
const rows: Map<string, Row> = (() => {
  const parsed: Array<Row> = [];
  for (const cells of docLines.map(tableCells)) {
    if (cells === null || cells.length !== 4 || isDelimiterRow(cells)) continue;
    const path = parseFieldPath(cells[0] ?? "");
    if (path === null) continue;
    const { declared, values } = parseType(cells[1] ?? "");
    parsed.push({ path, declared, values, bound: cells[2] ?? "", notes: cells[3] ?? "" });
  }
  return new Map(parsed.map((row) => [row.path, row]));
})();

/** The paragraph that introduces the table (the prose a reader reaches first). */
const introCell: string = (() => {
  const tableStart = docLines.findIndex((line) => tableCells(line)?.[0] === "Field");
  expect(tableStart, "the preparation field table exists").toBeGreaterThan(-1);
  const collected: string[] = [];
  for (let at = tableStart - 1; at >= 0; at -= 1) {
    const line = docLines[at] ?? "";
    if (line.trim() === "") {
      if (collected.length > 0) break;
      continue;
    }
    collected.unshift(line);
  }
  return collected.join("\n");
})();

const kernelSource = readFileSync(kernelSourcePath, "utf8");

/** Every `export const MAX_X = <digits>` the kernel declares. */
function kernelConstants(): Map<string, number> {
  const found = new Map<string, number>();
  for (const match of kernelSource.matchAll(/export const (MAX_[A-Z_]+) = (\d+);/g)) {
    found.set(match[1] ?? "", Number(match[2]));
  }
  return found;
}

/** The literal union of a kernel `export type X = "a" | "b";` declaration. */
function kernelUnion(name: string): string[] {
  const declaration = new RegExp(`export type ${name} =([^;]+);`).exec(kernelSource)?.[1] ?? "";
  return [...declaration.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
}

/** The body of a kernel struct type, for the `{ … }` entry-shape comparison. */
function kernelStructBody(name: string): string {
  const start = kernelSource.indexOf(`export type ${name} = {`);
  if (start === -1) return "";
  const end = kernelSource.indexOf("\n};", start);
  return kernelSource.slice(start, end === -1 ? undefined : end);
}

/** Each `preparation` field's bound: the constant that caps it and its value. */
const BOUNDS: Record<string, string> = {
  "preparation.missingDependencies": "MAX_MISSING_DEPENDENCIES",
  "preparation.gateBins": "MAX_GATE_BINS",
  "preparation.steps": "MAX_PREP_STEPS",
  "preparation.claim.foreignWrites.files": "MAX_CLAIM_WRITE_NAMES",
  "preparation.claim.takeOver.files": "MAX_CLAIM_WRITE_NAMES",
  "preparation.claim.takeOver.replaced.takeovers": "MAX_CLAIM_TAKEOVERS",
};

/** The `object[]` rows and the kernel struct whose fields their notes name. */
const ENTRY_SHAPES: Record<string, { kernel: string; unionField?: string; union?: string }> = {
  "preparation.gateBins": { kernel: "GateBinResolution", unionField: "source", union: "GateBinSource" },
  "preparation.steps": { kernel: "WorktreePrepStep", unionField: "step" },
  "preparation.claim.takeOver.replaced.takeovers": { kernel: "WorktreeClaimTakeoverRecord" },
};

/** The union a row's notes spell out, read from its first multi-member code span. */
function documentedUnion(notes: string): string[] {
  for (const span of notes.matchAll(/`([^`]+)`/g)) {
    const values = [...(span[1] ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
    if (values.length > 1) return values;
  }
  return [];
}

/**
 * The union of a struct member, resolved through a named alias when the
 * declaration names one (`source: GateBinSource`) instead of inline literals
 * (`step: "link" | "build" | "gate-bins"`).
 */
function kernelMemberUnion(body: string, field: string): string[] {
  const member = new RegExp(`\\n\\s{2}${field}\\??: ([^;]+);`).exec(body)?.[1]?.trim() ?? "";
  if (member.includes('"')) return [...member.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
  return kernelUnion(member);
}

/** Does a declared type accept a runtime kind? An empty list is any list. */
function accepts(declared: string, kind: string): boolean {
  if (kind === "array[]") return declared.endsWith("[]");
  return declared === kind;
}

/** The `{ a, b?, c }` entry shape a row's notes carry, in order. */
function entryShape(notes: string): string[] {
  const braces = /\{([^}]*)\}/.exec(notes)?.[1] ?? "";
  return braces
    .split(",")
    .map((field) => field.trim().replace(/\?$/, ""))
    .filter((field) => /^[A-Za-z0-9_]+$/.test(field));
}

describe("docs/opencode2.md payload contract vs the shipped native start payload", () => {
  it("names every field the shipped payload carries, both directions", () => {
    // Non-vacuity: the suite observed real payloads and real rows.
    expect(observed.size).toBeGreaterThan(20);
    expect(rows.size).toBeGreaterThan(20);
    // The receipt itself is documented by the payload row's `preparation?`.
    expect(startRowLine, "the `start` row still documents the `preparation` receipt").toContain(
      "`preparation?`",
    );

    const undocumented = [...observed.keys()].filter((path) => path !== "preparation" && !rows.has(path)).sort();
    expect(
      undocumented,
      `these fields ship in \`preparation\` with no row in ${docPath} — add a row`,
    ).toEqual([]);

    const phantom = [...rows.keys()].filter((path) => !observed.has(path)).sort();
    expect(phantom, "these rows document a field no real run ever carried").toEqual([]);
  });

  it("types every documented field the way the payload carries it", () => {
    const wrong: string[] = [];
    for (const [path, entry] of [...observed.entries()].sort()) {
      const row = rows.get(path);
      if (row === undefined) continue; // reported by the coverage test above
      for (const kind of [...entry.kinds].sort()) {
        const ok = row.declared === "enum" ? kind === "string" : accepts(row.declared, kind);
        if (!ok) wrong.push(`${path}: documented ${row.declared}, payload carried ${kind}`);
      }
      if (row.declared === "enum") {
        for (const value of entry.strings) {
          if (!row.values.includes(value)) {
            wrong.push(`${path}: documented union omits the shipped value "${value}"`);
          }
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("states the kernel's own vocabularies, not a remembered copy", () => {
    const install = rows.get("preparation.install");
    const coverage = rows.get("preparation.manifestCoverage");
    expect(install?.declared, "`preparation.install` documents a literal union").toBe("enum");
    expect(coverage?.declared, "`preparation.manifestCoverage` documents a literal union").toBe(
      "enum",
    );
    expect(kernelUnion("WorktreeInstallState").sort()).toEqual([...(install?.values ?? [])].sort());
    expect(kernelUnion("ManifestCoverage").sort()).toEqual([...(coverage?.values ?? [])].sort());
  });

  it("binds every capped list to the kernel constant that caps it, and the caps hold", () => {
    const constants = kernelConstants();
    // The source parse is only a reader for a constant the package root does
    // not export; tie the two together so the regex cannot drift.
    expect(constants.get("MAX_MISSING_DEPENDENCIES")).toBe(MAX_MISSING_DEPENDENCIES);
    expect(constants.get("MAX_GATE_BINS")).toBe(MAX_GATE_BINS);
    expect(constants.get("MAX_PREP_STEPS")).toBe(MAX_PREP_STEPS);
    expect(constants.get("MAX_CLAIM_TAKEOVERS")).toBe(MAX_CLAIM_TAKEOVERS);
    expect(constants.get("MAX_CLAIM_WRITE_NAMES")).toBe(10);

    const wrong: string[] = [];
    for (const [path, constant] of Object.entries(BOUNDS)) {
      const row = rows.get(path);
      if (row === undefined) {
        wrong.push(`${path}: no row documents this capped list`);
        continue;
      }
      const value = constants.get(constant);
      if (value === undefined) {
        wrong.push(`${constant} is not declared in ${kernelSourcePath}`);
        continue;
      }
      if (!row.bound.includes(constant)) wrong.push(`${path}: Bound does not name ${constant}`);
      if (!row.bound.includes(String(value))) {
        wrong.push(`${path}: Bound does not state ${constant} = ${value}`);
      }
    }
    expect(wrong).toEqual([]);

    // Observed behaviour: the env keys are exactly the documented six, and the
    // over-cap detection names ten files beside the exact total.
    const keys = observed.get("preparation.env.keys")?.value;
    expect(keys).toEqual([...WORKTREE_ENV_KEYS]);
    expect(rows.get("preparation.env.keys")?.bound).toContain(String(WORKTREE_ENV_KEYS.length));

    const cap = constants.get("MAX_CLAIM_WRITE_NAMES") ?? 0;
    const foreignWrites = overCap.claim as { foreignWrites?: { files?: unknown; total?: unknown } };
    expect(overCap.truncated, "an over-cap detection folds into `truncated`").toBe(true);
    expect(foreignWrites.foreignWrites?.files).toHaveLength(cap);
    expect(foreignWrites.foreignWrites?.total).toBeGreaterThan(cap);
  });

  it("keeps the documented entry shapes and the prose that introduces them honest", () => {
    const wrong: string[] = [];
    for (const [path, shape] of Object.entries(ENTRY_SHAPES)) {
      const row = rows.get(path);
      if (row === undefined) {
        wrong.push(`${path}: no row documents this list`);
        continue;
      }
      const body = kernelStructBody(shape.kernel);
      if (body === "") {
        wrong.push(`${shape.kernel} is not a struct in ${kernelSourcePath}`);
        continue;
      }
      const documented = entryShape(row.notes);
      if (documented.length === 0) {
        wrong.push(`${path}: the row documents no { … } entry shape`);
        continue;
      }
      for (const field of documented) {
        if (!new RegExp(`\\n\\s{2}${field}\\??:`).test(body)) {
          wrong.push(`${path}.${field}? is not a field of the kernel's ${shape.kernel}`);
        }
      }
      for (const field of [...body.matchAll(/\n\s{2}([A-Za-z0-9_]+)\??:/g)].map((m) => m[1] ?? "")) {
        if (!documented.includes(field)) {
          wrong.push(`${shape.kernel}.${field} is missing from ${path}'s documented shape`);
        }
      }
      if (shape.unionField !== undefined && shape.union !== undefined) {
        const shipped = kernelMemberUnion(body, shape.unionField);
        expect(shipped.sort(), `${path}.${shape.unionField}'s union`).toEqual(
          documentedUnion(row.notes).sort(),
        );
      }
    }
    expect(wrong).toEqual([]);

    // Every documented field is discoverable in the prose around the contract:
    // a depth-1 field must be named outright in the `start` row or the
    // paragraph introducing the table, and a nested one must hang off a NAMED
    // namespace (`preparation.claim`, `preparation.env`) or name its own last
    // segment there. A row nobody can find is as invisible as a missing one.
    const named = new Set<string>();
    for (const span of `${startRowLine}\n${introCell}`.matchAll(/`([^`]+)`/g)) {
      const text = (span[1] ?? "").replace(/[{}]/g, "").replace(/\?$/, "");
      named.add(text);
      for (const part of text.split(".")) named.add(part);
      for (let cut = text.indexOf("."); cut !== -1; cut = text.indexOf(".", cut + 1)) {
        named.add(text.slice(0, cut));
      }
    }
    expect(named.size).toBeGreaterThan(0);
    const anchors = (path: string): boolean => {
      if (named.has(path.split(".").pop() ?? "")) return true;
      // A named namespace of at least two segments (`preparation.claim`).
      return path
        .split(".")
        .slice(1, -1)
        .some((_segment, at) => named.has(path.split(".").slice(0, at + 2).join(".")));
    };
    const invisible = [...rows.keys()].filter((path) => !anchors(path)).sort();
    expect(invisible, "these rows are named neither in the `start` row nor in the intro").toEqual(
      [],
    );
  });
});