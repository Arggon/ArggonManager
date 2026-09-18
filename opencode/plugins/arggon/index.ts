/**
 * ArggonManager OpenCode V2 plugin — W2 MCP auto-registration + W3 session context.
 *
 * `arggon init` bundles this file to `.opencode/plugins/arggon/index.ts`, where
 * OpenCode V2 discovers it with zero configuration. Ambient behavior only
 * (ADR 0010), never rule logic:
 *
 *   1. MCP auto-registration (W2): when no MCP server named `arggon` is
 *      configured, register `{ type: "local", command: ["arggon", "mcp"] }`
 *      through `ctx.mcp.transform`. A server already configured by the adopter
 *      (or by the generated `opencode.jsonc` seam) is never touched.
 *   2. Session ↔ work-item correlation (W3): remember the item id of every
 *      observed `arggon` invocation per session (`ctx.storage`), fall back to
 *      the VCS branch (`feat/<id>` / `fix/<id>`), and honor the explicit
 *      `ARGON_ITEM` environment override. Nothing resolves → no-op.
 *   3. Bounded context injection (W3): `ctx.session.hook("context")` appends a
 *      small advisory system part built from `arggon show <id> --meta --json`,
 *      cached for a few seconds. Per-call injection means the block is present
 *      again after compaction. Hard bound: ITEM_BLOCK_MAX_BYTES (1 KiB).
 *   4. Session ergonomics + hygiene (W3): rename the session to a claimed item
 *      id (`ctx.session.rename`, or `ctx.session.update` on 2.0.7 where rename
 *      is absent); after a shell `git commit`, run `arggon validate --json` and
 *      log a warning when it fails. The warning never blocks anything —
 *      pre-commit and CI stay authoritative.
 *
 * Contract (ADR 0010, plan-opencode2-009 T6–T10):
 * - Optional and failure-isolated: every path is feature-detected and wrapped,
 *   a failure logs once and no-ops; the plugin must never break a session, the
 *   CLI or the MCP server.
 * - Thin: no rules, no native tools, no commands. State transitions go through
 *   the CLI (`execFile` with argument arrays) or the MCP server.
 * - Dependency-free: only Node builtins (`node:child_process`, `node:fs`,
 *   `node:path`); `Plugin.define` from `@opencode/plugin` is optional sugar and
 *   is resolved with a guarded dynamic import. The documented static import
 *   still fails to load an auto-discovered plugin in a dependency-less tree on
 *   2.0.8, exactly as on 2.0.7 (A/B re-probe 2026-09-18,
 *   task-opencode-v2-plugin-import-gotcha; details in docs/playbooks/opencode.md),
 *   so the import stays dynamic, non-fatal and computed (editors/tsc must not
 *   flag a package that is deliberately absent from adopter trees). The plain
 *   default export below is a valid V2 plugin definition and loads on 2.0.x
 *   without it.
 *
 * The pure helpers are exported for unit tests (cli/src/plugin-context.test.ts):
 * they contain no OpenCode or filesystem dependency.
 */

import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

/** Minimal structural typing: the generated file must not import plugin types. */
type McpLocalServer = { type: "local"; command: string[] }

type McpEditor = {
  get(name: string): unknown
  set(name: string, config: McpLocalServer): void
}

type StorageContext = {
  get?(key: string): Promise<unknown>
  set?(key: string, value: unknown): Promise<unknown>
  remove?(key: string): Promise<unknown>
}

type VcsContext = {
  get?(input?: unknown): Promise<unknown>
}

type SessionContext = {
  get?(input: { sessionID: string }): Promise<unknown>
  rename?(input: { sessionID: string; title: string }): Promise<unknown>
  update?(input: { sessionID: string; title?: string }): Promise<unknown>
  hook?(name: string, callback: (event: unknown) => unknown): Promise<unknown>
}

type ToolContext = {
  hook?(name: string, callback: (event: unknown) => unknown): Promise<unknown>
}

type PluginContext = {
  location?: { directory?: unknown }
  storage?: StorageContext
  vcs?: VcsContext
  session?: SessionContext
  tool?: ToolContext
  mcp?: { transform?: (callback: (editor: McpEditor) => void) => Promise<unknown> }
}

type PluginDefinition = {
  id: string
  setup(ctx: PluginContext): Promise<(() => void) | void>
}

type ContextEvent = {
  sessionID?: unknown
  system?: unknown
}

type ToolEvent = {
  tool?: unknown
  sessionID?: unknown
  input?: unknown
  status?: unknown
}

// ---------------------------------------------------------------------------
// Constants (documented in docs/playbooks/opencode.md)
// ---------------------------------------------------------------------------

const ARGGON_SERVER = "arggon"
const ARGGON_MCP: McpLocalServer = { type: "local", command: ["arggon", "mcp"] }

/** Explicit override read per resolution: wins over storage and branch. */
export const ITEM_ENV = "ARGON_ITEM"

/** Hard upper bound of one injected item block, in UTF-8 bytes (~256 tokens). */
export const ITEM_BLOCK_MAX_BYTES = 1024

/** How long a resolved item/block is reused before the CLI is asked again. */
export const CACHE_TTL_MS = 5_000

/** Branch prefixes correlated to an item id (arggon branch <id> defaults). */
export const BRANCH_PREFIXES = ["feat/", "fix/"] as const

const ITEM_MARKER = "<arggon-item>"
const STORAGE_PREFIX = "arggon/session/"
const MAX_CLI_OUTPUT = 256 * 1024
const MAX_VALUE_CHARS = 200

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested; no I/O)
// ---------------------------------------------------------------------------

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/** True when a token can be an item id: no leading dash, plain path-safe text. */
export function isArggonItemId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
}

const ARGON_ITEM_SUBCOMMANDS = new Set(["update", "show", "comment", "handoff", "branch", "start"])

/**
 * Extract the item id of an `arggon <subcommand> <id>` shell invocation.
 * Handles `npm run arggon -- show <id>` and absolute/relative binary paths.
 */
export function parseArggonItemFromCommand(command: unknown): string | undefined {
  if (typeof command !== "string" || command === "") return undefined
  for (const segment of command.split(/[;&|]+/)) {
    const tokens = segment
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => token.replace(/^["']|["']$/g, ""))
    for (let i = 0; i < tokens.length; i += 1) {
      const base = tokens[i]?.split("/").pop()
      if (base !== "arggon") continue
      let j = i + 1
      while (j < tokens.length && (tokens[j] === "--" || tokens[j].startsWith("-"))) j += 1
      const subcommand = tokens[j]
      if (subcommand === undefined || !ARGON_ITEM_SUBCOMMANDS.has(subcommand)) continue
      // CLI grammar: `<id>` is the positional immediately after the subcommand.
      const candidate = tokens[j + 1]
      if (candidate !== undefined && !candidate.startsWith("-") && isArggonItemId(candidate)) {
        return candidate
      }
    }
  }
  return undefined
}

/**
 * Extract the item id from Code Mode source calling an arggon MCP tool
 * (`tools.arggon.arggon_update({ id: "task-x" })`) or embedding a shell
 * invocation of the CLI.
 */
export function parseArggonItemFromCode(code: unknown): string | undefined {
  if (typeof code !== "string" || code === "") return undefined
  const callPattern = /arggon_(update|show|comment|handoff|start)\s*\(([\s\S]*?)\)/g
  let match: RegExpExecArray | null
  while ((match = callPattern.exec(code)) !== null) {
    const args = match[2] ?? ""
    const named = /\bid\s*:\s*["'`]([^"'`]+)["'`]/.exec(args)
    if (named !== null && isArggonItemId(named[1])) return named[1]
    // Positional form only for bare args: object args must carry an explicit `id`.
    if (!/[:=]/.test(args)) {
      const positional = /["'`]([^"'`]+)["'`]/.exec(args)
      if (positional !== null && isArggonItemId(positional[1])) return positional[1]
    }
  }
  return parseArggonItemFromCommand(code)
}

/** Extract the item id of an observed tool execution (shell, execute, arggon_*). */
export function parseArggonItemFromTool(tool: unknown, input: unknown): string | undefined {
  if (typeof tool !== "string") return undefined
  const record = input !== null && typeof input === "object" ? (input as Record<string, unknown>) : undefined
  if (/arggon_(update|show|comment|handoff|start)$/.test(tool)) {
    return isArggonItemId(record?.id) ? (record?.id as string) : undefined
  }
  if (tool === "shell" || tool.endsWith(".shell") || tool.endsWith("_shell")) {
    return parseArggonItemFromCommand(record?.command)
  }
  if (tool === "execute" || tool.endsWith(".execute") || tool.endsWith("_execute")) {
    return parseArggonItemFromCode(record?.code)
  }
  return undefined
}

/** `feat/<id>` / `fix/<id>` → item id (exact rest of the branch, no guessing). */
export function itemIdFromBranch(branch: unknown): string | undefined {
  if (typeof branch !== "string") return undefined
  for (const prefix of BRANCH_PREFIXES) {
    if (branch.startsWith(prefix)) {
      const rest = branch.slice(prefix.length)
      return isArggonItemId(rest) ? rest : undefined
    }
  }
  return undefined
}

/** True when a shell command looks like a git commit (best effort). */
export function looksLikeCommitCommand(command: unknown): boolean {
  if (typeof command !== "string" || command === "") return false
  for (const segment of command.split(/[;&|]+/)) {
    const tokens = segment
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => token.replace(/^["']|["']$/g, ""))
    const gitAt = tokens.findIndex((token) => token.split("/").pop() === "git")
    if (gitAt === -1) continue
    if (tokens.slice(gitAt + 1).some((token) => token === "commit" || token.startsWith("commit-"))) {
      return true
    }
  }
  return false
}

/** Item block for `ctx.session.hook("context")`, bounded to ITEM_BLOCK_MAX_BYTES. */
export function buildItemBlock(
  item: Record<string, unknown>,
  options: { currentDirectory?: string } = {},
): { text: string; bytes: number; truncated: boolean } {
  const lines = [
    ITEM_MARKER,
    "arggon: tracked work item (advisory; pre-commit/CI stay authoritative)",
  ]
  const fields: Array<[string, unknown]> = [
    ["id", item.id],
    ["type", item.type],
    ["status", item.status],
    ["title", item.title],
    ["parent", item.parent],
    ["branch", item.branch],
    ["assignee", item.assignee],
    ["priority", item.priority],
  ]
  for (const [label, value] of fields) {
    const text = asString(value)
    if (text !== undefined) lines.push(`${label}: ${clip(text, MAX_VALUE_CHARS)}`)
  }
  const labels = Array.isArray(item.labels)
    ? item.labels.filter((label): label is string => typeof label === "string" && label !== "").join(", ")
    : ""
  if (labels !== "") lines.push(`labels: ${clip(labels, 120)}`)
  const worktree = asString(item.worktree_path)
  if (worktree !== undefined && worktree !== asString(options.currentDirectory)) {
    lines.push(`worktree: ${clip(worktree, MAX_VALUE_CHARS)} (session_move available)`)
  }
  lines.push("</arggon-item>")
  return boundText(lines.join("\n"))
}

/** Enforce a UTF-8 byte bound on a generated text block, cutting on a line end. */
export function boundText(
  text: string,
  max = ITEM_BLOCK_MAX_BYTES,
): { text: string; bytes: number; truncated: boolean } {
  const bytes = byteLength(text)
  if (bytes <= max) return { text, bytes, truncated: false }
  const marker = "\n… (truncated)"
  const budget = Math.max(0, max - byteLength(marker))
  const encoded = new TextEncoder().encode(text).subarray(0, budget)
  let cut = new TextDecoder().decode(encoded)
  const lastLine = cut.lastIndexOf("\n")
  if (lastLine > 0) cut = cut.slice(0, lastLine)
  const bounded = `${cut}${marker}`
  return { text: bounded, bytes: byteLength(bounded), truncated: true }
}

/** Validate JSON failure → bounded warning detail (undefined when ok / unparsable). */
export function parseValidateFailure(stdout: unknown): string | undefined {
  if (typeof stdout !== "string" || stdout.trim() === "") return undefined
  try {
    const payload = JSON.parse(stdout) as { ok?: unknown; errors?: unknown }
    if (payload.ok !== false) return undefined
    const errors = Array.isArray(payload.errors) ? payload.errors : []
    const first = errors.find(
      (entry): entry is { message?: unknown } => entry !== null && typeof entry === "object",
    )
    const message = first !== undefined ? asString(first.message) : undefined
    return `${errors.length} error(s)${message !== undefined ? `; first: ${clip(message, 160)}` : ""}`
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Runtime helpers (feature-detected, failure-isolated)
// ---------------------------------------------------------------------------

const loggedErrors = new Set<string>()

function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Log at most once per key: a broken plugin must stay quiet and inert. */
function logOnce(key: string, message: string, error: unknown): void {
  if (loggedErrors.has(key)) return
  loggedErrors.add(key)
  console.error(`[arggon] ${message}: ${detail(error)}`)
}

type CliResult = { code: number | null; stdout: string; stderr: string }

/** Run a local binary with an argument array (never a shell string). */
function run(bin: string, args: string[], cwd: string, timeout: number): Promise<CliResult> {
  return new Promise((resolve) => {
    try {
      execFile(bin, args, { cwd, timeout, maxBuffer: MAX_CLI_OUTPUT, windowsHide: true }, (error, stdout, stderr) => {
        const code =
          error !== null && typeof (error as { code?: unknown }).code === "number"
            ? (error as { code: number }).code
            : error !== null
              ? null
              : 0
        resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") })
      })
    } catch (error) {
      logOnce("cli-spawn", "CLI invocation failed", error)
      resolve({ code: null, stdout: "", stderr: "" })
    }
  })
}

function locationDirectory(ctx: PluginContext): string | undefined {
  return asString(ctx.location?.directory)
}

/** No-op outside ArggonManager trees: no `tasks/` directory, nothing to do. */
function hasTasksTree(directory: string): boolean {
  try {
    return existsSync(join(directory, "tasks"))
  } catch {
    return false
  }
}

function sessionKey(sessionID: string): string {
  return `${STORAGE_PREFIX}${sessionID}`
}

function renamedKey(sessionID: string): string {
  return `${STORAGE_PREFIX}${sessionID}/renamed`
}

async function storageGet(ctx: PluginContext, key: string): Promise<unknown> {
  try {
    return typeof ctx.storage?.get === "function" ? await ctx.storage.get(key) : undefined
  } catch (error) {
    logOnce("storage-get", "storage read failed", error)
    return undefined
  }
}

async function storageSet(ctx: PluginContext, key: string, value: unknown): Promise<void> {
  try {
    if (typeof ctx.storage?.set === "function") await ctx.storage.set(key, value)
  } catch (error) {
    logOnce("storage-set", "storage write failed", error)
  }
}

async function storageRemove(ctx: PluginContext, key: string): Promise<void> {
  try {
    if (typeof ctx.storage?.remove === "function") await ctx.storage.remove(key)
  } catch (error) {
    logOnce("storage-remove", "storage removal failed", error)
  }
}

type CacheEntry = { at: number; item?: Record<string, unknown> }
const itemCache = new Map<string, CacheEntry>()
const branchCache = new Map<string, { at: number; branch?: string }>()
const renamedSessions = new Map<string, string>()

/** Read the current branch: `ctx.vcs` first, `git` fallback (probe: 2.0.7 vcs.get is empty). */
async function readBranch(ctx: PluginContext, directory: string): Promise<string | undefined> {
  const cached = branchCache.get(directory)
  const now = Date.now()
  if (cached !== undefined && now - cached.at < CACHE_TTL_MS) return cached.branch
  let branch: string | undefined
  try {
    if (typeof ctx.vcs?.get === "function") {
      const info = (await ctx.vcs.get()) as Record<string, unknown> | undefined
      const data = (info?.data ?? info) as Record<string, unknown> | undefined
      const value = data?.branch
      branch =
        asString(value) ??
        (value !== null && typeof value === "object"
          ? asString((value as Record<string, unknown>).current)
          : undefined)
    }
  } catch {
    // Feature-detected optional surface: fall through to git.
  }
  if (branch === undefined) {
    const result = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"], directory, 2_000)
    const value = result.stdout.trim()
    if (result.code === 0 && value !== "" && value !== "HEAD") branch = value
  }
  branchCache.set(directory, { at: now, branch })
  return branch
}

type ResolvedItem = { id: string; source: "env" | "storage" | "branch" }

async function resolveItemId(
  ctx: PluginContext,
  sessionID: string,
  directory: string,
): Promise<ResolvedItem | undefined> {
  const env = asString(process.env[ITEM_ENV])
  if (env !== undefined && isArggonItemId(env)) return { id: env, source: "env" }
  const stored = await storageGet(ctx, sessionKey(sessionID))
  if (isArggonItemId(stored)) return { id: stored, source: "storage" }
  const branch = itemIdFromBranch(await readBranch(ctx, directory))
  if (branch !== undefined) return { id: branch, source: "branch" }
  return undefined
}

/** `arggon show <id> --meta --json` — the bounded frontmatter view, cached briefly. */
async function loadItem(
  ctx: PluginContext,
  directory: string,
  id: string,
): Promise<Record<string, unknown> | undefined> {
  const cached = itemCache.get(id)
  const now = Date.now()
  if (cached !== undefined && now - cached.at < CACHE_TTL_MS) return cached.item
  const result = await run(ARGGON_SERVER, ["show", id, "--meta", "--json"], directory, 5_000)
  let item: Record<string, unknown> | undefined
  try {
    const payload = JSON.parse(result.stdout) as { ok?: unknown; item?: unknown }
    if (payload.ok === true && payload.item !== null && typeof payload.item === "object") {
      item = payload.item as Record<string, unknown>
    }
  } catch {
    // Non-JSON stdout (arggon absent, older CLI): nothing to inject.
  }
  itemCache.set(id, { at: now, item })
  return item
}

async function renameSession(ctx: PluginContext, sessionID: string, title: string): Promise<boolean> {
  try {
    if (typeof ctx.session?.rename === "function") {
      await ctx.session.rename({ sessionID, title })
      return true
    }
    // Probe (2.0.7): ctx.session.rename is absent; ctx.session.update({sessionID,title}) renames.
    if (typeof ctx.session?.update === "function") {
      await ctx.session.update({ sessionID, title })
      return true
    }
  } catch (error) {
    logOnce("rename", "session rename failed", error)
  }
  return false
}

/** Rename the session to a claimed item id, at most once per id per session. */
async function maybeRename(
  ctx: PluginContext,
  sessionID: string,
  item: Record<string, unknown>,
): Promise<void> {
  const id = asString(item.id)
  const status = asString(item.status)
  const assignee = asString(item.assignee)
  if (id === undefined || status !== "in_progress" || assignee === undefined) return
  if (renamedSessions.get(sessionID) === id) return
  if ((await storageGet(ctx, renamedKey(sessionID))) === id) {
    renamedSessions.set(sessionID, id)
    return
  }
  if (typeof ctx.session?.get === "function") {
    try {
      const current = (await ctx.session.get({ sessionID })) as Record<string, unknown> | undefined
      if (asString(current?.title) === id) {
        renamedSessions.set(sessionID, id)
        await storageSet(ctx, renamedKey(sessionID), id)
        return
      }
    } catch {
      // Optional read surface: a failed title check never blocks the rename.
    }
  }
  if (await renameSession(ctx, sessionID, id)) {
    renamedSessions.set(sessionID, id)
    await storageSet(ctx, renamedKey(sessionID), id)
    console.error(`[arggon] session renamed to ${id}`)
  }
}

async function checkTrackerHygiene(directory: string): Promise<void> {
  const result = await run(ARGGON_SERVER, ["validate", "--json"], directory, 10_000)
  const failure = parseValidateFailure(result.stdout)
  if (failure !== undefined) {
    console.error(`[arggon] validate failed after git commit: ${failure}`)
  }
}

function isShellTool(tool: unknown): boolean {
  return tool === "shell" || (typeof tool === "string" && (tool.endsWith(".shell") || tool.endsWith("_shell")))
}

async function onToolAfter(ctx: PluginContext, event: ToolEvent): Promise<void> {
  try {
    if (event.status !== undefined && event.status !== "completed") return
    const sessionID = asString(event.sessionID)
    if (sessionID !== undefined) {
      const id = parseArggonItemFromTool(event.tool, event.input)
      if (id !== undefined) await storageSet(ctx, sessionKey(sessionID), id)
    }
    if (isShellTool(event.tool)) {
      const directory = locationDirectory(ctx)
      const input = event.input !== null && typeof event.input === "object" ? (event.input as Record<string, unknown>) : undefined
      if (directory !== undefined && hasTasksTree(directory) && looksLikeCommitCommand(input?.command)) {
        await checkTrackerHygiene(directory)
      }
    }
  } catch (error) {
    logOnce("tool-observe", "tool observation failed", error)
  }
}

async function onContext(ctx: PluginContext, event: ContextEvent): Promise<void> {
  try {
    const sessionID = asString(event.sessionID)
    const directory = locationDirectory(ctx)
    if (sessionID === undefined || directory === undefined || !hasTasksTree(directory)) return
    const resolved = await resolveItemId(ctx, sessionID, directory)
    if (resolved === undefined) return
    const item = await loadItem(ctx, directory, resolved.id)
    if (item === undefined) {
      // Stale storage entry (item moved/renamed): forget it, branch may resolve next call.
      if (resolved.source === "storage") await storageRemove(ctx, sessionKey(sessionID))
      return
    }
    await maybeRename(ctx, sessionID, item)
    const system = event.system
    if (!Array.isArray(system)) return
    const marker = system.some(
      (part) =>
        part !== null &&
        typeof part === "object" &&
        typeof (part as { text?: unknown }).text === "string" &&
        (part as { text: string }).text.includes(ITEM_MARKER),
    )
    if (marker) return
    const block = buildItemBlock(item, { currentDirectory: directory })
    system.push({ type: "text", text: block.text })
    console.error(`[arggon] context: injected item ${asString(item.id) ?? resolved.id} (${block.bytes} bytes)`)
  } catch (error) {
    logOnce("context", "context injection failed", error)
  }
}

// ---------------------------------------------------------------------------
// V2 plugin definition
// ---------------------------------------------------------------------------

const definition: PluginDefinition = {
  id: "arggon",
  async setup(ctx) {
    const disposers: Array<() => void> = []
    try {
      const transform = ctx?.mcp?.transform
      if (typeof transform === "function") {
        await transform((editor) => {
          try {
            if (typeof editor?.get !== "function" || typeof editor?.set !== "function") return
            if (editor.get(ARGGON_SERVER) !== undefined) return // never clobber
            editor.set(ARGGON_SERVER, ARGGON_MCP)
          } catch (error) {
            logOnce("mcp-register", "MCP registration failed", error)
          }
        })
      }
    } catch (error) {
      logOnce("mcp", "MCP auto-registration unavailable", error)
    }
    try {
      const hook = ctx?.session?.hook
      if (typeof hook === "function") {
        const registration = await hook("context", (event) => onContext(ctx, event as ContextEvent))
        disposers.push(() => dispose(registration))
      }
    } catch (error) {
      logOnce("context-hook", "session context hook unavailable", error)
    }
    try {
      const hook = ctx?.tool?.hook
      if (typeof hook === "function") {
        const registration = await hook("execute.after", (event) => onToolAfter(ctx, event as ToolEvent))
        disposers.push(() => dispose(registration))
      }
    } catch (error) {
      logOnce("tool-hook", "tool execute hook unavailable", error)
    }
    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch (error) {
          logOnce("dispose", "hook cleanup failed", error)
        }
      }
    }
  },
}

function dispose(registration: unknown): void {
  const candidate = registration as { dispose?: unknown } | null
  if (candidate !== null && typeof candidate.dispose === "function") {
    void Promise.resolve((candidate.dispose as () => unknown).call(candidate)).catch(() => {})
  }
}

// Optional `Plugin.define` sugar, resolved defensively: a missing
// `@opencode/plugin` (no local node_modules) or a throwing runtime falls back
// to the plain definition object, which OpenCode V2 loads identically.
// Computed specifier: the package is deliberately absent from adopter trees
// (and from this repo's dependency graph), so a literal specifier makes
// editors/tsc flag the guarded, always-caught import.
const OPENCODE_PLUGIN_PACKAGE = "@opencode/plugin"
let define: ((input: PluginDefinition) => PluginDefinition) | undefined
try {
  const mod = (await import(OPENCODE_PLUGIN_PACKAGE)) as {
    Plugin?: { define?: (input: PluginDefinition) => PluginDefinition }
  }
  define = typeof mod?.Plugin?.define === "function" ? mod.Plugin.define : undefined
} catch {
  define = undefined
}

function exportDefinition(): PluginDefinition {
  if (define === undefined) return definition
  try {
    return define(definition)
  } catch {
    return definition
  }
}

export default exportDefinition()
