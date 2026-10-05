/**
 * ArggonManager OpenCode V2 plugin — native-first surface: `arggon` tools,
 * session context, correlation and hygiene.
 *
 * `arggon init` vendors the **single-file, dependency-free bundle** built from
 * this source into `.opencode/plugins/arggon/index.ts`, where OpenCode V2
 * discovers it with zero configuration (ADR 0011 §5/§6, ADR 0013; the bundle
 * inlines `@arggondev/lib`, so the adopter tree needs no `node_modules`). This
 * file stays the single source: `npm run build:plugin` regenerates the bundle
 * deterministically and `cli/src/plugin-copy.test.ts` drift-gates the committed
 * bytes (assert-before-write; `npm run check:plugin` in CI). Ambient behavior and the native tool namespace only,
 * never rule logic:
 *
 *   1. MCP is **out of the default path** (ADR 0011 §5/§6): W3 drops the
 *      `mcp.servers.arggon` stanza from the generated config, so the plugin no
 *      longer auto-registers the server either. `arggon mcp` and the generated
 *      `.mcp.json` stay for non-OpenCode clients that configure it
 *      explicitly; the plugin never touches `ctx.mcp`.
 *   2. Native `arggon` tool namespace (ADR 0011 §1, plan-native-first-011 W2):
 *      register list/create/update/show/next/report/validate/comment/handoff/
 *      priority/sync/import_issues with `ctx.tool.transform`, namespaced
 *      `arggon` and `options.codemode: true` (Code Mode: `tools.arggon.<name>`).
 *      Every tool calls the kernel **in-process** through `@arggondev/lib` — the
 *      same `*Operation` the CLI's `--json` path uses — and returns the
 *      documented envelope. Kernel failures throw `ArgonToolError` (a typed
 *      tool error carrying the failure code and envelope), never a throw
 *      through a hook; the session continues.
 *   2b. Worktree domain tools (W4, task-native-permissions-worktrees): `start`
 *      (claim + branch record + item worktree through `ctx.worktree.create`,
 *      `worktree_path` recorded in the worktree copy so the claim commit lands
 *      on the feature branch), `branch` (convention branch bookkeeping) and
 *      `cleanup` (kernel classification + `ctx.worktree.remove` + one tracker
 *      commit). The kernel stays the authority (claim rules, records,
 *      classification); the `gh` PR step and push stay explicit agent steps,
 *      and the CLI (`arggon start --worktree` / `arggon cleanup --prune`) is
 *      the documented fallback when the domain is unavailable.
 *   3. Session ↔ work-item correlation (ADR 0010 W3): remember the item id of
 *      every observed `arggon` invocation per session (`ctx.storage`), fall
 *      back to the VCS branch (`feat/<id>` / `fix/<id>`), and honor the
 *      explicit `ARGON_ITEM` environment override. Nothing resolves → no-op.
 *      Observed calls cover shell invocations of the CLI **and** Code Mode
 *      native tool calls (`tools.arggon.<name>(…)`), so correlation survives
 *      MCP leaving the default path (W3).
 *   4. Bounded context injection (ADR 0010 W3): `ctx.session.hook("context")`
 *      appends a small advisory system part built from
 *      `arggon show <id> --meta --json`, cached for a few seconds. Per-call
 *      injection means the block is present again after compaction. Hard bound:
 *      ITEM_BLOCK_MAX_BYTES (1 KiB).
 *   5. Session ergonomics + hygiene (ADR 0010 W3): rename the session to a
 *      claimed item id (`ctx.session.rename`, or `ctx.session.update` on 2.0.7
 *      where rename is absent); after a shell `git commit`, run
 *      `arggon validate --json` and log a warning when it fails. The warning
 *      never blocks anything — pre-commit and CI stay authoritative.
 *
 * Contract (ADR 0010, ADR 0011, ADR 0013, plan-native-first-011):
 * - Optional and failure-isolated: every path is feature-detected and wrapped,
 *   a failure logs once and no-ops; the plugin must never break a session, the
 *   CLI or the MCP server. The kernel import is guarded and cached: the source
 *   loaded directly in a tree without `@arggondev/lib` registers no tools, while
 *   the vendored **bundle** inlines the kernel and always registers.
 * - Thin: no rules. State transitions go through the kernel
 *   (`@arggondev/lib` in-process), the CLI (`execFile` with argument arrays) or
 *   the MCP server.
 * - Dependency-free: only Node builtins (`node:child_process`, `node:fs`,
 *   `node:path`, `node:url`). `@arggondev/lib` is resolved with a guarded,
 *   **literal** dynamic import: the bundle rewrites it to the inlined kernel,
 *   and this repo resolves the workspace package. `@opencode/plugin` is not
 *   imported at all: the documented static import fails to load an
 *   auto-discovered plugin in a dependency-less tree on 2.0.7, 2.0.8, 2.0.10
 *   and 2.0.12 (A/B re-probes 2026-09-18, 2026-09-20 and 2026-09-21;
 *   task-opencode-v2-plugin-import-gotcha; research record in
 *   docs/playbooks/opencode.md), and the optional `Plugin.define` sugar is not
 *   worth a top-level await in the bundle. The plain default export below is a
 *   valid V2 plugin definition and loads on 2.0.x without it.
 *
 * Pure helpers are exported for unit tests
 * (opencode/plugins/arggon/index.test.ts); `onToolAfter` is exported so its
 * tree-guard order can be tested with a fake context. The helpers contain no
 * OpenCode dependency.
 */

import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

/** Minimal structural typing: the generated file must not import plugin types. */
type StorageContext = {
  get?(key: string): Promise<unknown>
  set?(key: string, value: unknown): Promise<unknown>
  remove?(key: string): Promise<unknown>
}

type VcsContext = {
  get?(input?: unknown): Promise<unknown>
}

/**
 * Structural shape of the V2 worktree domain (`ctx.worktree`): every operation
 * requires the project id, `create` loads the canonical checkout's
 * configuration and returns the actual directory, `list` reads saved inventory
 * (call `refresh` first to discover worktrees created outside the domain).
 * Deliberately structural — the vendored file must not import plugin types.
 */
type WorktreeDomainLike = {
  create?(input: {
    projectID: string
    name: string
    directory?: string
    branch?: string
  }): Promise<unknown>
  list?(input: { projectID: string }): Promise<unknown>
  refresh?(input: { projectID: string }): Promise<unknown>
  remove?(input: { projectID: string; directory: string; force?: boolean }): Promise<unknown>
}

/** `ctx.location.project` (id + canonical checkout) as the domain requires it. */
type ProjectLike = { id?: unknown; canonical?: unknown; directory?: unknown }

type SessionContext = {
  get?(input: { sessionID: string }): Promise<unknown>
  rename?(input: { sessionID: string; title: string }): Promise<unknown>
  update?(input: { sessionID: string; title?: string }): Promise<unknown>
  hook?(name: string, callback: (event: unknown) => unknown): Promise<unknown>
}

/**
 * Structural shape of the V2 `ctx.tool` editor (Build a plugin → Tools): the
 * namespace description plus `add` for one tool definition. Deliberately
 * structural, like every other context type here — the vendored file must not
 * import plugin types (`@opencode/plugin` is deliberately absent from adopter
 * trees, see Conventions "Vendored plugin imports").
 */
type ToolEditorLike = {
  namespace?(input: { name: string; description: string }): void
  add?(tool: ArgonToolRegistration): void
}

type ToolContext = {
  hook?(name: string, callback: (event: unknown) => unknown): Promise<unknown>
  transform?(callback: (editor: ToolEditorLike) => void): Promise<unknown>
}

type PluginContext = {
  location?: { directory?: unknown; project?: ProjectLike }
  storage?: StorageContext
  vcs?: VcsContext
  session?: SessionContext
  tool?: ToolContext
  worktree?: WorktreeDomainLike
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

/** Explicit override read per resolution: wins over storage and branch. */
export const ITEM_ENV = "ARGON_ITEM"

/** Hard upper bound of one injected item block, in UTF-8 bytes (~256 tokens). */
export const ITEM_BLOCK_MAX_BYTES = 1024

/** How long a resolved item/block is reused before the CLI is asked again. */
export const CACHE_TTL_MS = 5_000

/** Upper bound of each in-memory cache; the oldest entry is evicted first. */
export const CACHE_MAX_ENTRIES = 256

/** Branch prefixes correlated to an item id (arggon branch <id> defaults). */
export const BRANCH_PREFIXES = ["feat/", "fix/"] as const

const ITEM_MARKER = "<arggon-item>"
const STORAGE_PREFIX = "arggon/session/"
const MAX_CLI_OUTPUT = 256 * 1024
const MAX_VALUE_CHARS = 200
const MAX_NATIVE_PREPARATION_NAMES = 32
const MAX_NATIVE_PREPARATION_VALUE_CHARS = 200
const MAX_NATIVE_DETAIL_CHARS = 500
const MAX_NATIVE_ERROR_CHARS = 2048

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested; no I/O)
// ---------------------------------------------------------------------------

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/** Bound and flatten untrusted git/package text before it enters a receipt. */
function boundedNativeText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value : String(value)
  return clip(text.replace(/[\u0000-\u001f\u007f]/g, " "), max)
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/** True when a token can be an item id: no leading dash, plain path-safe text. */
export function isArggonItemId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
}

const ARGON_ITEM_SUBCOMMANDS = new Set(["update", "show", "comment", "handoff", "branch", "start"])

/** Package runners whose `<launcher> arggon` form may launch the arggon CLI. */
const COMMAND_RUNNERS = new Set(["npm", "pnpm", "yarn", "bun"])
const RUNNER_LAUNCHERS = new Set(["run", "exec", "dlx"])

/** Wrappers that run the next command (`npx arggon …`, `sudo arggon …`). */
const WRAPPERS = new Set(["npx", "bunx", "sudo", "env", "command", "time"])

/** Wrapper options that consume the following token (best effort, common forms). */
const WRAPPER_VALUE_OPTIONS: Record<string, ReadonlySet<string>> = {
  sudo: new Set([
    "-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-C", "--close-from",
    "-T", "--command-timeout", "-R", "--chroot", "-D", "--chdir", "-r", "--role", "-t", "--type",
  ]),
  env: new Set(["-u", "--unset", "-C", "--chdir", "-S", "--split-string"]),
  npx: new Set(["-p", "--package", "--cache", "--userconfig", "--node-options", "--prefix"]),
  bunx: new Set(["-p", "--package"]),
  time: new Set(["-o", "--output", "-f", "--format"]),
  command: new Set(),
}

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

/** Bare (unquoted) grouping tokens (`( cmd`, `$( cmd`) skipped before the command. */
const SHELL_OPENERS = new Set(["(", "$("])

/**
 * Shell-ish segment splitter: `;`/`&`/`|` runs and newlines split commands only
 * outside single/double quotes (`echo "&& arggon show task-x"` stays ONE
 * segment, F2) and `#` comments are dropped. Quotes stay in the text for
 * `splitTokens`. Best effort: not a full shell lexer (no heredocs, no `$'…'`).
 */
function splitSegments(command: string): string[] {
  const segments: string[] = []
  let current = ""
  let quote: '"' | "'" | null = null
  let escaped = false
  let wordStart = true
  let comment = false
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i]
    if (comment) {
      if (ch === "\n") {
        comment = false
        segments.push(current)
        current = ""
        wordStart = true
      }
      continue
    }
    if (quote === "'") {
      current += ch
      if (ch === "'") {
        quote = null
        wordStart = false
      }
      continue
    }
    if (escaped) {
      current += ch
      escaped = false
      wordStart = false
      continue
    }
    if (ch === "\\") {
      current += ch
      escaped = true
      continue
    }
    if (ch === '"' || ch === "'") {
      current += ch
      if (quote === ch) {
        quote = null
        wordStart = false
      } else if (quote === null) {
        quote = ch
      }
      continue
    }
    if (quote === null && ch === "#" && wordStart) {
      comment = true
      continue
    }
    if (quote === null && (ch === ";" || ch === "&" || ch === "|" || ch === "\n" || ch === "\r")) {
      segments.push(current)
      current = ""
      wordStart = true
      continue
    }
    current += ch
    wordStart =
      ch === " " || ch === "\t" || ch === "(" || ch === ")" || ch === "{" || ch === "}"
  }
  segments.push(current)
  return segments
}

/**
 * One whitespace token: unquoted text plus whether the token is a plain shell
 * word rather than a syntax construct. A token is a word when it began inside
 * a quoted span, begins with an escaped `\$(`/`\(`, or pairs an escaped
 * backslash with an adjacent `(` (`\\(`), so it can never be a grouping opener
 * and `commandHead` must not strip grouping prefixes from it (F-A/F-B/F2/F3:
 * `"(" arggon …` runs a command named `(`, `\$(arggon …`, `\(arggon …` and
 * `\\(arggon …` syntax-error).
 */
type ShellToken = { text: string; word: boolean }

/**
 * Whitespace tokens of one segment. Quoted spans stay one token (quotes
 * stripped, inner whitespace included) so `echo "arggon show task-x"` is
 * `["echo", "arggon show task-x"]` — a mention, never a command — and
 * `x="a b" arggon show task-x` keeps the assignment ahead of the real command
 * (F1). Quote handling is stateful like `splitSegments`: a `'` inside an open
 * double quote (and vice versa) is a literal character, never a toggle (F-C).
 * Backslashes escape the next character outside single quotes; an escaped
 * `$(` is kept literal and marks the token a word (F-A), a token that
 * *starts* with an escaped `\(` is likewise a word, never an opener (F2), and
 * an escaped backslash is a word of its own when it starts the token
 * (`\\arggon …` names a command literally starting with a backslash) or is
 * followed by `(` (`\\(arggon …`, `\\\(arggon …`, `\\\\\(arggon …`): bash
 * ends a word on the literal backslash, so the adjacent `(` can never be a
 * grouping opener and the run must not reduce to `arggon` (F3, review F2).
 */
function splitTokens(segment: string): ShellToken[] {
  const tokens: ShellToken[] = []
  let current = ""
  let quote: '"' | "'" | null = null
  let escaped = false
  let escapedAtStart = false
  let started = false
  let word = false
  const push = (): void => {
    tokens.push({ text: current, word })
    current = ""
    started = false
    word = false
  }
  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i]
    if (quote === "'") {
      if (ch === "'") quote = null
      else current += ch
      continue
    }
    if (escaped) {
      escaped = false
      if (ch === "$" && segment[i + 1] === "(") {
        current += "$(" // literal `$(`: bash syntax-errors, never a group (F-A)
        i += 1
        word = true
      } else if (ch === "(" && escapedAtStart) {
        current += "(" // a token starting with literal `\(` is a word (F2)
        word = true
      } else if (ch === "\\" && (escapedAtStart || segment[i + 1] === "(")) {
        // Escaped backslash at the word start (`\\arggon …` names `\arggon`)
        // or before `(` (`\\(arggon …`, `\\\(arggon …`): bash ends the word
        // on the literal backslash and syntax-errors at the unescaped `(` (F3).
        current += ch
        word = true
      } else {
        current += ch
      }
      started = true
      continue
    }
    if (ch === "\\") {
      escaped = true
      escapedAtStart = !started
      started = true
      continue
    }
    if (ch === '"') {
      if (quote === '"') quote = null
      else if (quote === null) {
        quote = '"'
        if (!started) word = true
      }
      started = true
      continue
    }
    if (ch === "'") {
      if (quote === null) {
        quote = "'"
        if (!started) word = true
      } else {
        current += ch // literal `'` inside an open double quote (F-C)
      }
      started = true
      continue
    }
    if (quote === null && /\s/.test(ch)) {
      if (started) push()
      continue
    }
    current += ch
    started = true
  }
  if (started) push()
  return tokens
}

/** Assignment token (`VAR=value`) that does not itself hide a substitution. */
function isEnvAssignment(token: string): boolean {
  return ENV_ASSIGNMENT.test(token) && !token.includes("$(")
}

/** `true` for text bash resolves as a path: `/…`, `./…`, `../…` or `~…`. */
function isPathLike(text: string): boolean {
  return (
    text.startsWith("/") ||
    text.startsWith("./") ||
    text.startsWith("../") ||
    text.startsWith("~")
  )
}

/**
 * Shell syntax that keeps a slash-bearing word from being a plain path.
 * Deliberately narrow (PR #358 review F1): only characters that change how
 * bash parses the word — quotes/backslashes, whitespace from a quoted span
 * (ambiguous with a fused command word, F1), expansions (`$`, backtick),
 * grouping (`()`, `{}`), redirection (`<`, `>`) and control operators that
 * only occur escaped or quoted inside a word (`;`, `|`, `&`): the token text
 * no longer distinguishes an escaped operator from a quoted one, so such a
 * word is conservatively kept out of the path rule — bash does exec
 * `dir\;x/arggon` (and `"dir;x/arggon"`) when that relative path exists, a
 * documented miss. `#`, `!` and glob characters (`*?[]`) are literal inside
 * a word — any glob expansion still ends in the pattern's final `/arggon`
 * component — so they stay plain path text.
 */
const SHELL_SYNTAX_IN_PATH = /[\s\\"'`$(){}<>;|&]/

/**
 * `true` when every `/`-separated component is plain path text (no quotes,
 * expansions, grouping, redirection or whitespace; empty components collapse,
 * so `a//b/arggon` is a plain path). `(/usr/local/bin/arggon` is not a path
 * bash resolves to the binary: the quoted word starts with a literal `(` and
 * execs a pathname (127), so it must not reduce to `arggon` (F3). Literal
 * `#`/`!`/glob characters and `//` keep a word path-like (PR #358 review F1).
 */
function isPlainPath(text: string): boolean {
  return text.split("/").every((part) => !SHELL_SYNTAX_IN_PATH.test(part))
}

/**
 * Command name of one token text. Path text keeps the last segment
 * (`/usr/local/bin/arggon` → `arggon`). Text that is neither path-like nor a
 * plain path — a fused quoted span such as `"echo /usr/bin/arggon"` (bash:
 * ONE command word looked up as a whole, 127) or a word starting with shell
 * syntax such as `(/usr/local/bin/arggon` (F3) — is kept whole, so it can
 * never reduce to `arggon`; `"/opt/my tools/arggon"` is a real path to the
 * binary and still correlates.
 */
function commandName(text: string): string {
  if (!isPathLike(text) && !isPlainPath(text)) return text
  return text.split("/").pop() ?? ""
}

/**
 * Command head of one token: quotes/escapes and a leading `VAR=` assignment
 * stripped, `$(`/`(`/`{` grouping openers removed (so `x=$(arggon`, `(arggon`
 * and `$(arggon` all yield `arggon`), trailing group closers dropped, then the
 * path rule of `commandName` applied. A word token (started in quotes, or
 * starting with a literal escaped `$(`/`\(`/`\\(`) keeps grouping prefixes
 * and assignments in its text literal.
 */
function commandHead(token: ShellToken): string {
  if (token.word) return commandName(token.text)
  return commandName(
    token.text
      .replace(/^["'\\]+/, "")
      .replace(/^[A-Za-z_][A-Za-z0-9_]*=/, "")
      .replace(/^\$?\(+/, "")
      .replace(/^\{+/, "")
      .replace(/[)}]+$/, ""),
  )
}

/** Skip `-x`/`--long` wrapper options; known value options eat their value. */
function skipWrapperOptions(tokens: ShellToken[], index: number, wrapper: string): number {
  const valueOptions = WRAPPER_VALUE_OPTIONS[wrapper]
  let at = index
  while (at < tokens.length && tokens[at].text.startsWith("-")) {
    const option = tokens[at].text
    at += 1
    if (valueOptions !== undefined && valueOptions.has(option)) at += 1
  }
  return at
}

/**
 * True when `command` only prints names (`command -v arggon`, `command -V …`):
 * the builtin queries the following tokens instead of running one. Short
 * options combine (`command -pv arggon`); `--` ends the options (execution).
 */
function commandQueriesName(tokens: ShellToken[], index: number): boolean {
  let at = index
  while (at < tokens.length && tokens[at].text.startsWith("-")) {
    const option = tokens[at].text
    if (option === "--") break
    if (!option.startsWith("--") && /[vV]/.test(option.slice(1))) return true
    at += 1
  }
  return false
}

/**
 * Index of the `arggon` binary when it is in command position, or -1.
 *
 * Anchored to the command: the first token of a `;`/`&`/`|`/newline segment,
 * after leading `VAR=value` assignments and wrapper prefixes
 * (`npx`/`bunx`/`sudo`/`env`/`command`/`time`, with their options; a
 * `command -v`/`-V` name query runs nothing), or the script slot of
 * `npm|pnpm|yarn|bun (run|exec|dlx) arggon …`. Tokens that merely *mention*
 * arggon — `grep -rn "arggon show task-x"`, `echo "arggon update task-fake"`,
 * `git commit -m "arggon handoff task-x"` — are arguments, not commands. Best
 * effort: indirect invocations (`sh -c "arggon …"`, `timeout 5 arggon …`,
 * `xargs arggon …`, backticks) are not detected; misses are harmless, false
 * positives are not.
 */
function argCommandIndex(tokens: ShellToken[]): number {
  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]
    if (!token.word && SHELL_OPENERS.has(token.text)) {
      index += 1
      continue
    }
    if (!token.word && isEnvAssignment(token.text)) {
      index += 1
      continue
    }
    const head = commandHead(token)
    if (head === "arggon") return index
    if (COMMAND_RUNNERS.has(head)) {
      return tokens[index + 1] !== undefined &&
        RUNNER_LAUNCHERS.has(tokens[index + 1].text) &&
        tokens[index + 2]?.text === "arggon"
        ? index + 2
        : -1
    }
    if (WRAPPERS.has(head)) {
      if (head === "command" && commandQueriesName(tokens, index + 1)) return -1
      index = skipWrapperOptions(tokens, index + 1, head)
      continue
    }
    return -1
  }
  return -1
}

/** Item id from an `arggon <subcommand> <id>` token stream at the binary index. */
function itemFromTokens(tokens: ShellToken[], at: number): string | undefined {
  let j = at + 1
  while (j < tokens.length && (tokens[j].text === "--" || tokens[j].text.startsWith("-"))) j += 1
  const subcommand = tokens[j]?.text
  if (subcommand === undefined || !ARGON_ITEM_SUBCOMMANDS.has(subcommand)) return undefined
  // CLI grammar: `<id>` is the positional immediately after the subcommand.
  // A trailing group closer (`$(arggon show task-x)`) is not part of the id.
  const candidate = tokens[j + 1]?.text.replace(/[)}]+$/, "")
  if (candidate !== undefined && !candidate.startsWith("-") && isArggonItemId(candidate)) {
    return candidate
  }
  return undefined
}

/**
 * Contents of command substitutions (`$(…)`) and subshells (`(…)`) in one
 * segment, in source order. Quote-aware: `$(…)` inside double quotes runs,
 * everything inside single quotes is inert, escaped openers (`\$(…)` and
 * `\\(`) are skipped. Best effort: not a full shell lexer (documented limits
 * in the docstring of `parseArggonItemFromCommand`).
 */
function findCommandGroups(text: string): string[] {
  const groups: string[] = []
  let quote: '"' | "'" | null = null
  let escaped = false
  let escapedDollar = false
  let escapedBackslash = false
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quote === "'") {
      if (ch === "'") quote = null
      continue
    }
    if (escaped) {
      escaped = false
      escapedDollar = ch === "$"
      escapedBackslash = ch === "\\"
      continue
    }
    if (escapedDollar) {
      escapedDollar = false
      // `\$(…)` is a literal `$` followed by `(`: bash syntax-errors on it,
      // nothing executes, so the `(` must not open a group (F-A).
      if (ch === "(") continue
    }
    if (escapedBackslash) {
      escapedBackslash = false
      // `\\(` ends a word on the escaped backslash and bash syntax-errors at
      // the adjacent `(`: nothing executes, so it opens no group (F3).
      if (ch === "(") continue
    }
    if (ch === "\\") {
      escaped = true
      continue
    }
    if (ch === '"') {
      if (quote === '"') quote = null
      else if (quote === null) quote = '"'
      continue
    }
    if (ch === "'" && quote === null) {
      quote = "'"
      continue
    }
    const dollarParen = ch === "$" && text[i + 1] === "("
    if (dollarParen || (ch === "(" && quote === null)) {
      if (depth === 0) start = i + (dollarParen ? 2 : 1)
      depth += 1
      if (dollarParen) i += 1
      continue
    }
    if (ch === ")" && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) {
        groups.push(text.slice(start, i))
        start = -1
      }
    }
  }
  return groups
}

/** Items deeper than this many nested substitution levels are not followed. */
export const MAX_SUBSTITUTION_DEPTH = 3

/** One command text: command-position match per segment, then `$(…)`/`(…)` contents. */
function parseCommandText(command: string, depth: number): string | undefined {
  for (const segment of splitSegments(command)) {
    const tokens = splitTokens(segment)
    const at = argCommandIndex(tokens)
    if (at !== -1) {
      const id = itemFromTokens(tokens, at)
      if (id !== undefined) return id
    }
    if (depth < MAX_SUBSTITUTION_DEPTH) {
      for (const group of findCommandGroups(segment)) {
        const id = parseCommandText(group, depth + 1)
        if (id !== undefined) return id
      }
    }
  }
  return undefined
}

/**
 * Extract the item id of an `arggon <subcommand> <id>` shell invocation that
 * occurs in command position (see `argCommandIndex`).
 *
 * Recognized: `VAR=1 arggon …`, absolute/relative binary paths, wrapper
 * prefixes (`npx`/`bunx`/`sudo`/`env`/`command`/`time`, including common
 * options; a `command -v`/`-V` name query runs nothing), `npm|pnpm|yarn|bun
 * (run|exec|dlx) arggon …`, `$(…)` command substitutions and `(…)` subshells,
 * and `;`/`&`/`|`/newline-separated commands. Quoted text is inert:
 * `grep -rn "arggon show task-x"`, `echo "&& arggon show task-x"` and
 * `echo '(arggon show task-x)'` do not correlate, and a multi-word quoted
 * mention (`"arggon show task-x"`, `command "arggon show task-x"`,
 * `npm run "arggon show task-x"`, `x="line1\narggon show task-x"`) is one
 * word, never a command, while `echo "$(arggon show task-x)"` does correlate
 * (the substitution runs) and a quoted grouping word (`"(" arggon …`) is a
 * command name, never an opener. A whitespace-bearing word reduces to its
 * last path segment only when path-like: `"echo /usr/bin/arggon" show task-x`
 * is a command literally named `echo /usr/bin/arggon` (127) and stays inert,
 * while `"/opt/my tools/arggon" show task-x` names the binary and correlates.
 * A token starting with an escaped `\(` is likewise a literal word (F2),
 * while a quoted assignment before the command (`x="a b" arggon show task-x`)
 * stays an assignment and the command runs (F1). An escaped backslash word
 * (`\\arggon …`: command name `\arggon`, exit 127), a quoted word that
 * begins with shell syntax (`'(/usr/local/bin/arggon' show task-x`, bash 127)
 * and the 3/5/7-backslash `\(` forms (`\\\(arggon …`, `\\\\\(arggon …`,
 * `\\\\\\\(arggon …`) all reduce to no command, never to `arggon`: the first
 * two are name lookups (bash 127), the `\(` forms syntax-error on the trailing
 * unescaped `)` (exit 2) (F3, PR #358 review F2). A slash-bearing word keeps
 * its last component when every component is plain path text: literal `#`/`!`
 * and glob characters are fine (`dir#x/arggon`, `'dir*x/arggon'`,
 * `dir!x/arggon`), as are collapsed empty components (`a//b/arggon`), because
 * bash execs those paths (PR #358 review F1). Best effort residual: a bare `(`
 * in argument position (`\\( (arggon …)`) syntax-errors in bash but is still
 * followed as a group, like any unquoted `(` outside command position
 * (`echo (arggon …)`, `\\((arggon …))`); pinned by tests.
 *
 * Best effort, misses are harmless and false positives are not: aliases,
 * backticks, `sh -c "arggon …"`, `timeout 5 arggon …` and `xargs arggon …`
 * are not detected; `#` comments are dropped, escaped `\$(…)`, `\(` and
 * `\\(` are literal (F-A/F2/F3), while heredoc bodies and nested quoting
 * inside a group are not modeled. The `arggon_*` Code Mode regex (see `parseArggonItemFromCode`)
 * stays a raw-source best effort of its own.
 */
export function parseArggonItemFromCommand(command: unknown): string | undefined {
  if (typeof command !== "string" || command === "") return undefined
  return parseCommandText(command, 0)
}

/**
 * `command: "<cmd>"` string argument of a Code Mode shell call, e.g.
 * `tools.shell({ command: "…" })`. Best effort: the first such property in the
 * source wins; a `command:` key in unrelated data can over-correlate.
 */
const COMMAND_ARG_PATTERN = /\bcommand\s*:\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/

/**
 * Tool names whose `id` argument may correlate the session: all the
 * item-scoped mutations/reads (both MCP `arggon_<name>` and native
 * `tools.arggon.<name>` spellings).
 */
const CORRELATION_CALL_PATTERNS = [
  /arggon_(update|show|comment|handoff|start)\s*\(([\s\S]*?)\)/g,
  /tools\.arggon\.(update|show|comment|handoff|start)\s*\(([\s\S]*?)\)/g,
] as const

/** Item id from the argument text of one observed call. */
function itemIdFromCallArgs(args: string): string | undefined {
  const named = /\bid\s*:\s*["'`]([^"'`]+)["'`]/.exec(args)
  if (named !== null && isArggonItemId(named[1])) return named[1]
  // Positional form only for bare args: object args must carry an explicit `id`.
  if (!/[:=]/.test(args)) {
    const positional = /["'`]([^"'`]+)["'`]/.exec(args)
    if (positional !== null && isArggonItemId(positional[1])) return positional[1]
  }
  return undefined
}

/**
 * Extract the item id from Code Mode source calling an arggon tool — MCP
 * (`tools.arggon.arggon_update({ id: "task-x" })`) or the native namespace
 * (`tools.arggon.update({ id: "task-x" })`) — or embedding a shell invocation
 * of the CLI (command-position parsing only).
 *
 * Best effort: the call regex scans raw source text, so an `arggon_*` call
 * written inside a string literal or comment can still correlate an id. That
 * over-correlation is deliberately bounded — an unrelated but existing id can
 * win for the session, while a stale id self-heals in `onContext`; a full
 * lexer is out of scope here. The embedded-shell fallback is anchored to
 * command position, so quoted text alone no longer correlates.
 */
export function parseArggonItemFromCode(code: unknown): string | undefined {
  if (typeof code !== "string" || code === "") return undefined
  for (const callPattern of CORRELATION_CALL_PATTERNS) {
    // Module-level global regexes: reset the cursor so an early return in a
    // previous call can never skip a match on the next one.
    callPattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = callPattern.exec(code)) !== null) {
      const id = itemIdFromCallArgs(match[2] ?? "")
      if (id !== undefined) return id
    }
  }
  // A Code Mode shell call carries its command as a string argument
  // (`tools.shell({ command: "arggon show task-x" })`): parse that command in
  // command position instead of scanning the wrapping source.
  const shellCommand = COMMAND_ARG_PATTERN.exec(code)
  if (shellCommand !== null) {
    const command = (shellCommand[2] ?? "").replace(/\\(["'`\\])/g, "$1")
    const id = parseArggonItemFromCommand(command)
    if (id !== undefined) return id
  }
  return parseArggonItemFromCommand(code)
}

/** Extract the item id of an observed tool execution (shell, execute, arggon_*). */
export function parseArggonItemFromTool(tool: unknown, input: unknown): string | undefined {
  if (typeof tool !== "string") return undefined
  const record = input !== null && typeof input === "object" ? (input as Record<string, unknown>) : undefined
  if (
    /arggon_(update|show|comment|handoff|start)$/.test(tool) ||
    /^(?:tools\.)?arggon[._](update|show|comment|handoff|start)$/.test(tool)
  ) {
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
  for (const segment of splitSegments(command)) {
    const tokens = splitTokens(segment)
    const gitAt = tokens.findIndex((token) => token.text.split("/").pop() === "git")
    if (gitAt === -1) continue
    if (tokens.slice(gitAt + 1).some((token) => token.text === "commit" || token.text.startsWith("commit-"))) {
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

/**
 * Enforce a UTF-8 byte bound on generated text. Multi-line input is cut back to
 * the last complete line in range; single-line input is cut mid-line at a
 * code-point boundary — an incomplete multibyte sequence is never decoded into
 * a replacement character that could overshoot the bound.
 */
export function boundText(
  text: string,
  max = ITEM_BLOCK_MAX_BYTES,
): { text: string; bytes: number; truncated: boolean } {
  const bytes = byteLength(text)
  if (bytes <= max) return { text, bytes, truncated: false }
  const marker = "\n… (truncated)"
  const markerBytes = byteLength(marker)
  // Degenerate bound smaller than the marker: the byte bound is the contract,
  // so return an empty truncated block rather than overshoot.
  if (max < markerBytes) return { text: "", bytes: 0, truncated: true }
  const budget = max - markerBytes
  const encoded = new TextEncoder().encode(text)
  let cut = ""
  for (let keep = budget; keep > 0; keep -= 1) {
    try {
      cut = new TextDecoder("utf-8", { fatal: true }).decode(encoded.subarray(0, keep))
      break
    } catch {
      // `keep` bytes end inside a multibyte sequence: try one byte shorter.
    }
  }
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

/**
 * `ArgonToolOptions.sessionDirectory` from the V2 plugin context: the calling
 * session's own location directory, read through `ctx.session.get` (V2 gives a
 * plugin tool no directory — only the session id, see
 * {@link ArgonToolCallContext}). `Session.Info.location.directory` is what
 * `session_move` updates, so this follows the session into a worktree; the bare
 * `directory` field is accepted as a fallback for a host that reports it
 * without the location wrapper. Feature-detected: a context without
 * `ctx.session.get` yields undefined and every call keeps using `options.cwd`.
 */
export function sessionDirectoryResolver(
  ctx: PluginContext,
): ((sessionID: string) => Promise<string | undefined>) | undefined {
  const get = ctx?.session?.get
  if (typeof get !== "function") return undefined
  return async (sessionID: string) => {
    const session = (await get({ sessionID })) as
      | { location?: { directory?: unknown }; directory?: unknown }
      | undefined
    return asString(session?.location?.directory) ?? asString(session?.directory)
  }
}

/** No-op outside ArggonManager trees: no tracker root, nothing to do. */
function hasTasksTree(directory: string): boolean {
  try {
    return existsSync(join(directory, "ArggonManager")) || existsSync(join(directory, "tasks"))
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
// Per-server in-memory caches. `opencode serve` is long-lived and can host many
// projects and sessions, so each cache is bounded (CACHE_MAX_ENTRIES, oldest
// first) on top of the 5 s TTL, and the item cache is keyed by project
// directory + item id: two projects that happen to share an id must never
// share a cached `arggon show` view (F5).
const itemCache = new Map<string, CacheEntry>()
const branchCache = new Map<string, { at: number; branch?: string }>()
const renamedSessions = new Map<string, string>()

/** Project-scoped cache key for one item view. */
export function itemCacheKey(directory: string, id: string): string {
  return `${directory}\u0000${id}`
}

/** Insert into a bounded cache: re-inserted keys refresh; the oldest evicts. */
export function setBounded<T>(map: Map<string, T>, key: string, value: T, max = CACHE_MAX_ENTRIES): void {
  map.delete(key)
  map.set(key, value)
  while (map.size > max) {
    const oldest = map.keys().next()
    if (oldest.done === true) break
    map.delete(oldest.value)
  }
}

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
  setBounded(branchCache, directory, { at: now, branch })
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
  const key = itemCacheKey(directory, id)
  const cached = itemCache.get(key)
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
  setBounded(itemCache, key, { at: now, item })
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
    setBounded(renamedSessions, sessionID, id)
    return
  }
  if (typeof ctx.session?.get === "function") {
    try {
      const current = (await ctx.session.get({ sessionID })) as Record<string, unknown> | undefined
      if (asString(current?.title) === id) {
        setBounded(renamedSessions, sessionID, id)
        await storageSet(ctx, renamedKey(sessionID), id)
        return
      }
    } catch {
      // Optional read surface: a failed title check never blocks the rename.
    }
  }
  if (await renameSession(ctx, sessionID, id)) {
    setBounded(renamedSessions, sessionID, id)
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

/** Handles one `execute.after` event (exported so the guard order is testable). */
export async function onToolAfter(ctx: PluginContext, event: ToolEvent): Promise<void> {
  try {
    if (event.status !== undefined && event.status !== "completed") return
    // Tree guard first: outside ArggonManager trees nothing is written or run,
    // so the "no-op outside trees" claim covers storage too.
    const directory = locationDirectory(ctx)
    if (directory === undefined || !hasTasksTree(directory)) return
    const sessionID = asString(event.sessionID)
    if (sessionID !== undefined) {
      const id = parseArggonItemFromTool(event.tool, event.input)
      if (id !== undefined) await storageSet(ctx, sessionKey(sessionID), id)
    }
    if (isShellTool(event.tool)) {
      const input =
        event.input !== null && typeof event.input === "object"
          ? (event.input as Record<string, unknown>)
          : undefined
      if (looksLikeCommitCommand(input?.command)) {
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
    // `block=` carries the exact injected text so the smoke can measure its
    // bytes independently instead of trusting the reported count (F8).
    console.error(
      `[arggon] context: injected item ${asString(item.id) ?? resolved.id} (${block.bytes} bytes) block=${JSON.stringify(block.text)}`,
    )
  } catch (error) {
    logOnce("context", "context injection failed", error)
  }
}

// ---------------------------------------------------------------------------
// Native arggon tool namespace (W2, plan-native-first-011)
// ---------------------------------------------------------------------------

/** Code Mode namespace the native kernel tools register under (ADR 0011 §1). */
export const ARGON_TOOL_NAMESPACE = "arggon"

/**
 * Namespace description shown in the Code Mode catalog. Keep it one short line:
 * the catalog pays for it on every model request (ADR 0006).
 */
export const ARGON_TOOL_NAMESPACE_DESCRIPTION =
  "ArggonManager tracker tools (in-process): documented `--json` envelopes; failures are typed tool errors."

/**
 * Core workflow tools pinned into the Code Mode catalog (W3, `options.pinned`,
 * an undocumented 2.0.10 runtime option — see the playbook). The runtime draws
 * a subset of the catalog under its own ~2000-token budget; pinning keeps the
 * tools the native commands depend on always rendered. W4 adds `start` (the
 * claim → worktree entry point `/arggon-start` drives); the maintenance tools
 * (`report`, `priority`, `sync`, `import_issues`, `branch`, `cleanup`) stay
 * unpinned and reachable through `search`. Measured by
 * `nativeToolsCatalogBytes` and `smoke/context-report.ts`.
 */
export const PINNED_TOOL_NAMES: readonly string[] = [
  "list",
  "create",
  "update",
  "show",
  "next",
  "validate",
  "comment",
  "handoff",
  "start",
]

/** Bound of the envelope JSON appended to a typed tool error (see ArgonToolError). */
const TOOL_ERROR_DETAIL_MAX_BYTES = 8192

/** Bound of a runtime-provided session id used as the default author/session. */
const SESSION_TOKEN_MAX_CHARS = 64

/** Kernel surface the native tools consume (the `@arggondev/lib` stable subset). */
export type ArgonKernel = typeof import("@arggondev/lib")

/**
 * Second `execute` argument V2 passes to a tool.
 *
 * The runtime builds it as `{ sessionID, agent, messageID, id, progress, signal }`
 * — deliberately structural, like every other context type here. `sessionID` is
 * BOTH the comment/handoff attribution token and the **tracker-root key**: V2 hands
 * a plugin tool no directory, so the session id is the only per-call signal of
 * where the calling session works (bug-native-tools-commit-to-primary-checkout).
 */
export type ArgonToolCallContext = { sessionID?: unknown }

export type ArgonToolResult = { output: Record<string, unknown> }

/** One tool definition as the editor receives it, minus `options`. */
export type ArgonToolDefinition = {
  name: string
  description: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  execute: (
    input: Record<string, unknown>,
    tool?: ArgonToolCallContext,
  ) => Promise<ArgonToolResult>
}

/** What `editor.add` receives (definitions + the namespace/codemode options). */
export type ArgonToolRegistration = ArgonToolDefinition & {
  options: { namespace: string; codemode: boolean }
}

export type ArgonToolOptions = {
  /**
   * Fallback working directory for calls that carry no calling session: the
   * plugin instance's own `ctx.location.directory`. A call made by a session
   * never uses it — see {@link resolveToolCwd}.
   */
  cwd: string
  /**
   * Resolve the **calling session's** own location directory (the worktree a
   * `session_move` landed in) from the session id V2 hands every tool call.
   * Feature-detected at setup: absent (a host without `ctx.session.get`) every
   * call falls back to `cwd`. Resolving this per call is what keeps a committing
   * tool off the primary checkout once the session has moved
   * (bug-native-tools-commit-to-primary-checkout): V2 documents `ctx.location` as
   * "the plugin instance's location, not the location of every session it can
   * access or event it receives", so a value captured at `setup` is stale by
   * construction after a move.
   */
  sessionDirectory?: (sessionID: string) => Promise<string | undefined>
  /**
   * Fallback item-templates dir for `create`/`import-issues` (ADR 0013: the
   * kernel embeds no templates). The repo's own `templates/` always wins.
   */
  templatesDir?: string
  /**
   * Worktree-domain wiring for `start`/`branch`/`cleanup` (W4): the V2
   * `ctx.worktree` domain plus the project id/canonical checkout every domain
   * operation requires (`ctx.location.project`). Feature-detected at setup:
   * when absent, the worktree tools fail with a typed error and the CLI
   * (`arggon start --worktree` / `arggon cleanup --prune`) stays the fallback.
   */
  worktree?: ArgonWorktreeOptions
}

export type ArgonWorktreeOptions = {
  /** `ctx.location.project.id` — required by every domain operation. */
  projectID?: string
  /** `ctx.location.project.canonical` — the domain's configuration root. */
  canonical?: string
  /** The V2 worktree domain (`create`/`list`/`refresh`/`remove`). */
  domain?: WorktreeDomainLike
}

/**
 * Typed tool error for a kernel failure (ADR 0011: kernel failures surface as
 * tool errors, never as throws through hooks).
 *
 * The V2 tool boundary carries only an error message to the model — the
 * runtime wraps any thrown error into its own `Tool.Error` — so the kernel's
 * `error.code` is prefixed to the message and the complete `ok: false`
 * envelope rides behind it on the next line (bounded): a Code Mode script that
 * catches the error still sees the documented payload. The typed fields
 * (`code`, `command`, `envelope`) are what the unit contract tests assert on.
 */
export class ArgonToolError extends Error {
  readonly code: string
  readonly command: string
  readonly envelope: Record<string, unknown>

  constructor(envelope: Record<string, unknown>) {
    const error =
      envelope.error !== null && typeof envelope.error === "object"
        ? (envelope.error as { message?: unknown; code?: unknown })
        : undefined
    const code =
      typeof error?.code === "string" && error.code !== "" ? error.code : "ARGON_TOOL_FAILED"
    const message =
      typeof error?.message === "string" && error.message !== ""
        ? error.message
        : "unknown kernel failure"
    super(`${code}: ${message}\n${boundedEnvelopeJson(envelope)}`)
    this.name = "ArgonToolError"
    this.code = code
    this.command = asString(envelope.command) ?? ""
    this.envelope = envelope
  }
}

/** Envelope JSON for the error message, bounded so a huge payload stays sane. */
function boundedEnvelopeJson(envelope: Record<string, unknown>): string {
  let json: string
  try {
    json = JSON.stringify(envelope) ?? ""
  } catch {
    return "<unserializable envelope>"
  }
  return json.length <= TOOL_ERROR_DETAIL_MAX_BYTES
    ? json
    : `${json.slice(0, TOOL_ERROR_DETAIL_MAX_BYTES)}… (envelope truncated)`
}

/** Shared envelope fields every kernel operation emits (json-output.md). */
const ENVELOPE_SCHEMA_PROPERTIES: Record<string, unknown> = {
  ok: { type: "boolean" },
  schemaVersion: { type: "number" },
  conventionVersion: { type: "number" },
  command: { type: "string" },
}

/**
 * Loose output schema for one tool: the shared envelope fields are required and
 * command-specific payload fields are declared for the model's benefit — the
 * kernel envelope is the contract, this schema never rejects a valid envelope.
 * An absent `additionalProperties` already means `true` in JSON Schema, so the
 * keyword is omitted deliberately: the definitions payload sits at the ADR 0006
 * advisory bound and the redundant text costs 336 B across the twelve kernel
 * tools (W7 task-native-dogfood-release).
 */
function envelopeSchema(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "object",
    properties: { ...ENVELOPE_SCHEMA_PROPERTIES, ...extra },
    required: ["ok", "schemaVersion", "conventionVersion", "command"],
  }
}

/** One CSV field from an array input (`update` labels/depends_on take CSV). */
export function csvList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined
  const parts = value.filter((entry): entry is string => typeof entry === "string")
  return parts.join(",")
}

/** Copy of a string-array tool input (undefined when absent or not an array). */
function arrayOfStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((entry): entry is string => typeof entry === "string")
}

/**
 * Runtime-provided session id usable as the default comment author / handoff
 * session: a conservative single-line token (no whitespace, no control
 * characters) of at most SESSION_TOKEN_MAX_CHARS. Anything else is dropped so
 * the plugin never feeds an odd runtime value into a body heading — the
 * explicit tool arguments keep their kernel semantics either way.
 */
export function sessionToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const token = value.trim()
  if (token === "" || token.length > SESSION_TOKEN_MAX_CHARS) return undefined
  return /^[A-Za-z0-9._:-]+$/.test(token) ? token : undefined
}

/**
 * `error.code` for a call whose session directory cannot be resolved
 * (bug-native-tools-commit-to-primary-checkout). Native-surface only: the CLI
 * resolves the same root by walking up from its own cwd, so it can never reach
 * this. The code exists because the native seam has a caller-side root to
 * resolve and must refuse rather than write to the wrong checkout.
 */
export const SESSION_ROOT_UNRESOLVED = "SESSION_ROOT_UNRESOLVED"

/**
 * Working directory for ONE native tool call. The tracker root is resolved from
 * the **calling session's own directory**, re-read on every call, so a session
 * that moved into a worktree commits there and never to the checkout the plugin
 * instance was loaded from. The kernel then walks up from it exactly as the CLI
 * walks up from its own cwd (one logic path, ADR 0011).
 *
 * The order, and why each rung is where it is:
 *
 *   1. a session that is known and resolvable \u2192 that session's directory. This
 *      is the rule the repo's one-branch-per-item model needs: the branch the
 *      session moved onto is the branch its commit must land on.
 *   2. no session on the call (an ambient/headless invocation, or an `execute` the
 *      host ran without one) \u2192 the plugin instance's location, the only directory
 *      this file knows.
 *   3. a session that is known but whose directory cannot be resolved \u2192 a typed
 *      failure, deliberately NOT the case-2 fallback: committing to the primary
 *      because a lookup failed is the exact defect this exists to stop, and a
 *      silent `ok: true` on the wrong branch is worse than a refused call.
 *
 * `process.cwd()` is not a candidate: it is the host process's launch directory
 * (a background `opencode serve` carries its own), never the session's. The
 * item's recorded `worktree_path` cannot be one either — reading it needs the
 * tracker root this function is resolving.
 */
export async function resolveToolCwd(
  kernel: ArgonKernel,
  command: string,
  options: ArgonToolOptions,
  tool?: ArgonToolCallContext,
): Promise<{ cwd: string } | { error: ArgonToolError }> {
  const sessionID = sessionToken(tool?.sessionID)
  if (sessionID === undefined || options.sessionDirectory === undefined) {
    return { cwd: options.cwd }
  }
  let directory: string | undefined
  let failure: string | undefined
  try {
    directory = asString(await options.sessionDirectory(sessionID))
  } catch (error) {
    failure = detail(error)
  }
  if (directory === undefined) {
    const cause = failure === undefined ? "" : ` (${boundedNativeText(failure, MAX_NATIVE_DETAIL_CHARS)})`
    return {
      error: new ArgonToolError(
        kernel.failEnvelope({
          command,
          code: SESSION_ROOT_UNRESOLVED,
          message:
            `could not resolve the working directory of session ${sessionID}${cause}; refusing ` +
            `to fall back to the plugin location ${options.cwd}, which would commit to the ` +
            "checkout this plugin was loaded from instead of the session's own",
        }),
      ),
    }
  }
  return { cwd: directory }
}

type ArgonToolSpec = {
  name: string
  description: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  run: (
    kernel: ArgonKernel,
    input: Record<string, unknown>,
    options: ArgonToolOptions,
    tool?: ArgonToolCallContext,
  ) => { ok: boolean; envelope: Record<string, unknown> } | Promise<{ ok: boolean; envelope: Record<string, unknown> }>
}

const ID = { type: "string" }
const STRINGS = { type: "array", items: { type: "string" } }
const OBJECT = { type: "object" }
const BOOLEAN = { type: "boolean" }
const NUMBER = { type: "number" }

/**
 * The twelve kernel tools (spec-native-first-011 §Tools), each one a thin
 * adapter over its kernel operation. Inputs mirror the CLI/MCP option surface
 * (arrays where the kernel takes lists); outputs are the documented envelopes.
 *
 * Schemas stay deliberately lean: the Code Mode catalog renders each tool
 * signature (descriptions become comments) and the runtime caps the whole
 * catalog at its own ~2000-token budget, dropping entries past it — so
 * property descriptions are kept only where the name is not self-evident.
 * `nativeToolsCatalogBytes()` keeps the payload measurable (ADR 0006).
 */
const TOOL_SPECS: ArgonToolSpec[] = [
  {
    name: "list",
    description:
      "List tracker work items (filters compose with AND). Returns the `list --json` envelope (compact WorkItems, ADR 0006).",
    input: {
      type: "object",
      properties: {
        status: { type: "string" },
        type: { type: "string" },
        assignee: {
          type: "string",
          description: "Login; @me resolves via env/gh.",
        },
        parent: { type: "string" },
        filter: {
          type: "string",
          description: 'e.g. "status:todo !label:security".',
        },
        view: {
          type: "string",
          description: "Saved view name (x-views in the tracker config).",
        },
        stale: { type: "boolean" },
        older_than: {
          type: "string",
          description: "Stale threshold <number><d|h|m>, e.g. 7d.",
        },
        full: BOOLEAN,
      },
      additionalProperties: false,
    },
    output: envelopeSchema({ items: { type: "array" } }),
    run: (kernel, input, options) =>
      kernel.listOperation({
        cwd: options.cwd,
        status: asString(input.status),
        type: asString(input.type),
        assignee: asString(input.assignee),
        parent: asString(input.parent),
        filter: asString(input.filter),
        view: asString(input.view),
        stale: input.stale === true,
        olderThan: asString(input.older_than),
        full: input.full === true,
      }),
  },
  {
    name: "create",
    description:
      "Create a work item under a parent container. Returns the `create --json` envelope (path, item).",
    input: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "initiative|epic|story|task|bug.",
        },
        title: { type: "string" },
        parent: {
          type: "string",
          description: "Required except for initiatives.",
        },
        id: { type: "string", description: "Optional explicit id stem." },
        assignee: { type: "string" },
        labels: STRINGS,
        status: {
          type: "string",
          description: "todo|in_progress|blocked|cancelled.",
        },
        blocked_reason: {
          type: "string",
          description: "Required with status blocked.",
        },
        priority: { type: "string", description: "p0|p1|p2|p3." },
        issue: { type: "number", description: "Linked GitHub issue number." },
        full: BOOLEAN,
      },
      required: ["type", "title"],
      additionalProperties: false,
    },
    output: envelopeSchema({
      path: { type: "string" },
      item: OBJECT,
      commit: OBJECT,
    }),
    run: (kernel, input, options) =>
      kernel.createOperation({
        cwd: options.cwd,
        type: asString(input.type) ?? "",
        title: asString(input.title) ?? "",
        parent: asString(input.parent),
        id: asString(input.id),
        assignee: asString(input.assignee),
        labels: arrayOfStrings(input.labels),
        status: asString(input.status),
        blockedReason: asString(input.blocked_reason),
        priority: asString(input.priority),
        issue: typeof input.issue === "number" ? input.issue : undefined,
        templatesDir: options.templatesDir,
        full: input.full === true,
      }),
  },
  {
    name: "update",
    description:
      "Update one item's frontmatter (status, claim, parent, labels, priority, depends_on); agents never reopen or steal.",
    input: {
      type: "object",
      properties: {
        id: ID,
        title: { type: "string" },
        status: { type: "string" },
        assignee: {
          type: "string",
          description: "Required when the new status is in_progress.",
        },
        unassign: { type: "boolean" },
        branch: { type: "string", description: "Empty string clears." },
        parent: {
          type: "string",
          description: "Reparent (same edge validation as the CLI).",
        },
        type: {
          type: "string",
          description: "Only 'story': promote a task to a story.",
        },
        labels: STRINGS,
        priority: {
          type: "string",
          description: "p0|p1|p2|p3; empty string clears.",
        },
        depends_on: STRINGS,
        add_depends_on: { type: "string" },
        issue: { type: "number", description: "0 clears." },
        blocked_reason: {
          type: "string",
          description: "Required with, and only with, status blocked.",
        },
        no_cascade: {
          type: "boolean",
          description: "Skip automatic container completion.",
        },
        full: BOOLEAN,
      },
      required: ["id"],
      additionalProperties: false,
    },
    output: envelopeSchema({
      item: OBJECT,
      autoCompleted: { type: "array" },
      cascadeLevels: { type: "array" },
      cascadeSkipped: { type: "array" },
    }),
    run: (kernel, input, options) =>
      kernel.updateOperation({
        cwd: options.cwd,
        id: asString(input.id) ?? "",
        title: asString(input.title),
        status: asString(input.status),
        assignee: asString(input.assignee),
        branch: asString(input.branch),
        parent: asString(input.parent),
        type: asString(input.type),
        unassign: input.unassign === true,
        labels: csvList(input.labels),
        priority: asString(input.priority),
        dependsOn: csvList(input.depends_on),
        addDependsOn: asString(input.add_depends_on),
        issue: typeof input.issue === "number" ? input.issue : undefined,
        blockedReason: asString(input.blocked_reason),
        cascade: input.no_cascade !== true,
        full: input.full === true,
        // Native tools act for an agent: the playbook invariants apply (no
        // reopen, no steal) exactly as they do through the MCP server.
        agent: true,
      }),
  },
  {
    name: "show",
    description:
      "Read one work item bounded (ADR 0006): frontmatter plus the last comments; `body: true` is the opt-in. Pure read.",
    input: {
      type: "object",
      properties: {
        id: ID,
        meta: {
          type: "boolean",
          description: "Frontmatter only (no body, no comments).",
        },
        body: {
          type: "boolean",
          description: "Full body including ALL comments.",
        },
        tail_comments: {
          type: "number",
          description: "Compact view tail size.",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    output: envelopeSchema({
      item: OBJECT,
      path: { type: "string" },
      comments: { type: "array" },
      body: { type: "string" },
    }),
    run: (kernel, input, options) =>
      kernel.showOperation({
        cwd: options.cwd,
        id: asString(input.id) ?? "",
        meta: input.meta === true,
        body: input.body === true,
        tailComments: typeof input.tail_comments === "number" ? input.tail_comments : undefined,
      }),
  },
  {
    name: "next",
    description:
      "Suggest the next claimable item (next-first, priority-major). Pure read; `suggestion` is null when the pool is empty.",
    input: {
      type: "object",
      properties: {
        ready: {
          type: "boolean",
          description: "Only ready items (all depends_on terminal).",
        },
        include_stories: {
          type: "boolean",
          description: "Include unclaimed stories in the pool.",
        },
      },
      additionalProperties: false,
    },
    output: envelopeSchema({ suggestion: { type: ["object", "null"] } }),
    run: (kernel, input, options) =>
      kernel.nextOperation({
        cwd: options.cwd,
        ready: input.ready === true,
        includeStories: input.include_stories === true,
      }),
  },
  {
    name: "report",
    description:
      "Aggregate leaf statuses per story, grouped by epic; `trend: true` mines git history. Pure read — never writes.",
    input: {
      type: "object",
      properties: {
        trend: { type: "boolean" },
        since: { type: "string", description: "YYYY-MM-DD; requires trend." },
      },
      additionalProperties: false,
    },
    output: envelopeSchema({ groups: { type: "array" }, trend: OBJECT }),
    run: (kernel, input, options) =>
      kernel.reportOperation({
        cwd: options.cwd,
        trend: input.trend === true,
        since: asString(input.since),
      }),
  },
  {
    name: "validate",
    description:
      "Validate tracker frontmatter and tree integrity. Pure read; errors raise a typed tool error carrying the envelope.",
    input: { type: "object", properties: {}, additionalProperties: false },
    output: envelopeSchema({
      layout: { type: "string" },
      errors: { type: "array" },
      warnings: { type: "array" },
    }),
    run: (kernel, _input, options) => kernel.validateOperation({ cwd: options.cwd }),
  },
  {
    name: "comment",
    description:
      "Append a comment to an item body (history, not a reopen: frontmatter and `updated` are untouched).",
    input: {
      type: "object",
      properties: {
        id: ID,
        text: {
          type: "string",
          description: "Multiline supported; non-empty.",
        },
        author: {
          type: "string",
          description: "Defaults to the calling session id.",
        },
      },
      required: ["id", "text"],
      additionalProperties: false,
    },
    output: envelopeSchema({
      id: { type: "string" },
      path: { type: "string" },
      comment: OBJECT,
      commit: OBJECT,
    }),
    run: (kernel, input, options, tool) =>
      kernel.commentOperation({
        cwd: options.cwd,
        id: asString(input.id) ?? "",
        text: asString(input.text) ?? "",
        author: asString(input.author) ?? sessionToken(tool?.sessionID),
      }),
  },
  {
    name: "handoff",
    description:
      "Append a structured, bounded session-end handoff (branch, next step, open questions) to an item body.",
    input: {
      type: "object",
      properties: {
        id: ID,
        next: {
          type: "string",
          description: "First step for the resuming agent (capped at 200 chars).",
        },
        branch: {
          type: "string",
          description: "Auto-detected from git when omitted.",
        },
        open_questions: {
          type: "string",
          description: "Semicolon-separated (capped at 200 chars).",
        },
        session: {
          type: "string",
          description: "Defaults to the calling session id.",
        },
        author: {
          type: "string",
          description: "Defaults to the calling session id.",
        },
      },
      required: ["id", "next"],
      additionalProperties: false,
    },
    output: envelopeSchema({
      id: { type: "string" },
      path: { type: "string" },
      comment: OBJECT,
      handoff: OBJECT,
      commit: OBJECT,
    }),
    run: (kernel, input, options, tool) => {
      const fallback = sessionToken(tool?.sessionID)
      return kernel.handoffOperation({
        cwd: options.cwd,
        id: asString(input.id) ?? "",
        next: asString(input.next) ?? "",
        branch: asString(input.branch),
        openQuestions: asString(input.open_questions),
        session: asString(input.session) ?? fallback,
        author: asString(input.author) ?? fallback,
      })
    },
  },
  {
    name: "priority",
    description:
      "Move legacy pN labels into the priority field (highest label wins, idempotent, never auto-commits).",
    input: {
      type: "object",
      properties: {
        dry_run: {
          type: "boolean",
          description: "Report the changes and write NOTHING.",
        },
      },
      additionalProperties: false,
    },
    output: envelopeSchema({
      dryRun: BOOLEAN,
      scanned: NUMBER,
      changed: NUMBER,
      entries: { type: "array" },
    }),
    run: (kernel, input, options) =>
      kernel.priorityOperation({
        cwd: options.cwd,
        dryRun: input.dry_run === true,
      }),
  },
  {
    name: "sync",
    description:
      "Reconcile item branch fields with open GitHub PRs; check by default, `write: true` fills empty branches.",
    input: {
      type: "object",
      properties: {
        check: {
          type: "boolean",
          description: "Report matches without modifying (default).",
        },
        write: {
          type: "boolean",
          description: "Fill empty branch fields from PRs.",
        },
        repo: {
          type: "string",
          description: "owner/name; default from origin.",
        },
      },
      additionalProperties: false,
    },
    output: envelopeSchema({
      mode: { type: "string" },
      matched: { type: "array" },
      unmatched: { type: "array" },
      pending: { type: "array" },
      errors: { type: "array" },
    }),
    run: (kernel, input, options) =>
      kernel.syncOperation({
        cwd: options.cwd,
        check: input.check === true,
        write: input.write === true,
        repo: asString(input.repo),
      }),
  },
  {
    name: "import_issues",
    description:
      "Import GitHub issues into the tracker as task/bug items (idempotent; `dry_run: true` plans without writing).",
    input: {
      type: "object",
      properties: {
        repo: { type: "string", description: "owner/name; default from gh." },
        parent: {
          type: "string",
          description: "Target story (default story-imported-issues).",
        },
        dry_run: { type: "boolean" },
        no_commit: {
          type: "boolean",
          description: "Skip the tracker auto-commit.",
        },
      },
      additionalProperties: false,
    },
    output: envelopeSchema({
      dryRun: BOOLEAN,
      story: OBJECT,
      entries: { type: "array" },
      created: NUMBER,
      skipped: NUMBER,
      commit: OBJECT,
    }),
    run: (kernel, input, options) =>
      kernel.importIssuesOperation({
        cwd: options.cwd,
        repo: asString(input.repo),
        parent: asString(input.parent),
        dryRun: input.dry_run === true,
        commit: input.no_commit === true ? false : undefined,
        templatesDir: options.templatesDir,
      }),
  },
]

// ---------------------------------------------------------------------------
// Worktree domain (W4, task-native-permissions-worktrees)
// ---------------------------------------------------------------------------

/**
 * The worktree lifecycle tools (`start`, `branch`, `cleanup`) use the V2
 * worktree domain (`ctx.worktree.create/list/remove`) instead of shelling out
 * `git worktree`: item worktrees are named `<repo>-<id>`, created next to the
 * canonical checkout (`../<repo>-<id>`, the `arggon start --worktree`
 * convention) and removed through the domain on cleanup. The kernel stays the
 * authority for everything it owns — claim rules, the branch and
 * `worktree_path` records, cleanup classification — and the `gh` PR step stays
 * an explicit agent tool call, never part of `start`.
 *
 * Probes on 2.0.10 (docs/playbooks/opencode.md):
 * - every domain operation requires `projectID` (`ctx.location.project.id`)
 *   and loads configuration from the project's saved `canonical` checkout
 * - `create({ projectID, name, directory })` treats `directory` as the parent
 *   and returns the actual directory; the Git strategy checks out a DETACHED
 *   worktree at the start ref, so creating/switching the item branch is ours
 *   (`git switch -c`, exactly what `git worktree add -b` does for the CLI)
 * - `list` reads saved inventory only — `refresh` first discovers worktrees
 *   created outside the domain; `remove` works for any worktree of the project
 *   (force required for dirty ones).
 *
 * Fallback: when the domain (or the project id) is unavailable the tools fail
 * with a typed error naming the CLI path that predates the domain
 * (`arggon start --worktree`, `arggon cleanup --prune`).
 *
 * Ownership rules (W4 review): an attach — the recorded `worktree_path` or the
 * deterministic default — only ever adopts a directory registered as a
 * worktree of THIS repo (a foreign repository at that path is refused before
 * any branch is created or switched); a rollback removes only the worktree
 * this run created and deletes only the branch this run created (a
 * pre-existing branch survives a refused claim); `cleanup` unlinks a
 * start-created `node_modules` link before removing, like the CLI.
 */

/** Worktree wiring resolved from the plugin context at setup. */
export function worktreeOptions(ctx: PluginContext): ArgonWorktreeOptions {
  const project = ctx.location?.project
  const projectID = asString(project?.id)
  const canonical = asString(project?.canonical)
  return {
    ...(projectID !== undefined ? { projectID } : {}),
    ...(canonical !== undefined ? { canonical } : {}),
    ...(ctx.worktree !== undefined ? { domain: ctx.worktree } : {}),
  }
}

/** Typed failure envelope for a worktree tool (never a throw through hooks). */
function worktreeFail(
  kernel: ArgonKernel,
  command: string,
  code: string,
  message: string,
  conventionVersion?: number,
): { ok: false; envelope: Record<string, unknown> } {
  return {
    ok: false,
    envelope: kernel.failEnvelope({
      command,
      code,
      message,
      ...(conventionVersion !== undefined ? { conventionVersion } : {}),
    }),
  }
}

/** A start failure with the bounded preparation/commit receipt attached. */
function startFailure(
  kernel: ArgonKernel,
  message: string,
  conventionVersion: number | undefined,
  payload: Record<string, unknown>,
): { ok: false; envelope: Record<string, unknown> } {
  const failure = worktreeFail(
    kernel,
    "start",
    "START_FAILED",
    boundedNativeText(message, MAX_NATIVE_ERROR_CHARS),
    conventionVersion,
  )
  return { ...failure, envelope: { ...failure.envelope, ...payload } }
}

/** Failure before a claim commit is attempted, with a consistent receipt. */
function startNotAttempted(
  kernel: ArgonKernel,
  message: string,
  conventionVersion: number | undefined,
  payload: Record<string, unknown>,
  reason: string,
): { ok: false; envelope: Record<string, unknown> } {
  return startFailure(kernel, message, conventionVersion, {
    ...payload,
    claimCommitted: false,
    claimCommit: claimCommitNotAttempted(reason),
  })
}

/** The kernel's coverage union (`ManifestCoverage` in `lib/src/worktree.ts`). */
type NativeManifestCoverage = "satisfied" | "stale" | "unknown"

/** The kernel's gate-bin source union (`GateBinSource` in `lib/src/worktree.ts`). */
type NativeGateBinSource = "worktree" | "external" | "path" | "missing"

/** One gate binary's observed resolution, as the kernel reports it. */
type NativeGateBinResolution = {
  name: string
  source: NativeGateBinSource
  path?: string
}

type NativePreparationReceipt = {
  ready: boolean
  install: string
  linkedNodeModules: boolean
  builtWorkspaces: string[]
  linkedWorkspaces: string[]
  /**
   * Whether the install provides what the worktree's own `package.json`
   * declares, and which declared names it does not provide
   * (bug-worktree-readiness-misses-stale-primary-install). Forwarded from the
   * kernel receipt, which owns the check and the list cap: a native caller
   * reading only `ready: false` would have to shell out to the CLI to learn
   * WHICH declared dependency the mirrored install is missing.
   */
  manifestCoverage: NativeManifestCoverage
  missingDependencies: string[]
  missingDependenciesTotal: number
  /**
   * Which node_modules the project gate's binaries resolve from, relative to
   * the worktree (bug-start-worktree-npm-ci-claim). Forwarded from the kernel
   * receipt, which owns discovery and the `MAX_GATE_BINS` cap: a `path`
   * source here is the silent-masking flavor — the claim commit can pass on a
   * sibling checkout's binary while the worktree's own install is broken or
   * absent, and without this report the resolution stays invisible.
   */
  gateBins: NativeGateBinResolution[]
  /** Bounded preparation log (bug-start-install-ordering), as reported by the kernel. */
  steps?: NativePrepStep[]
  /**
   * The kernel's own "entries were dropped" decision for that log, MIRRORED
   * verbatim (bug-native-steps-truncated-flag-dropped). The kernel caps the log
   * at `MAX_PREP_STEPS = 16`, so a longer run reaches this surface ALREADY
   * shortened; re-deriving the flag from a cap of this surface's own could
   * never fire through the kernel's smaller one, and the shortened list was
   * handed over as if it were the whole log. It also folds into the shared
   * `truncated` flag, so a capped log is never read as complete on either flag.
   */
  stepsTruncated?: true
  /**
   * Worktree env contract receipt (spec worktree-env-contract-016), forwarded
   * from the kernel when the caller requested env preparation (every
   * `start --worktree` run does).
   */
  env?: NativeEnvReceipt
  /**
   * Claim-stamp receipt (task-single-writer-worktree-enforcement), forwarded
   * from the kernel when the caller requested stamping (every `start
   * --worktree` run does).
   */
  claim?: NativeClaimReceipt
  truncated?: boolean
}

/** One bounded entry of the native preparation log (bug-start-install-ordering). */
type NativePrepStep = {
  /** Same bounded phases the kernel log uses (structurally a `WorktreePrepStep`). */
  step: "link" | "build" | "gate-bins"
  outcome: string
  pkg?: string
}

/**
 * The worktree env contract receipt (spec worktree-env-contract-016),
 * structurally the kernel's `WorktreeEnvReceipt`: `written: false` guarantees
 * only `warning` (opt-out, write failure, or an existing file left
 * byte-identical on attach) — it never blocks the claim.
 */
type NativeEnvReceipt = {
  written: boolean
  path?: string
  keys?: string[]
  seededDotenv?: string
  gitignored?: boolean
  warning?: string
}

/** The claim-stamp detection a start attaches with (`WorktreeForeignWriteReport`). */
type NativeClaimWriteReport = {
  owner: string
  claimedAt: string
  files: string[]
  total: number
}

/**
 * One persisted take-over chain entry (`WorktreeClaimTakeoverRecord`): who took
 * a worktree over, when, and which stamp it replaced. Deliberately narrow (four
 * fields) so the chain in the stamp file cannot grow with a chatty history.
 */
type NativeClaimTakeoverRecord = {
  at: string
  by: string
  replacedIdentity: string
  replacedClaimedAt: string
}

/**
 * The replaced ownership stamp (`WorktreeClaimStamp`), reported in full on a
 * take-over so the audit trail names the presumed-dead owner, their item and
 * branch — not just an opaque id.
 */
type NativeClaimStamp = {
  identity: string
  item: string
  branch: string
  claimedAt: string
  assignee?: string
  surface?: string
  takeovers?: NativeClaimTakeoverRecord[]
}

/**
 * A deliberate take-over of a presumed-dead stamped owner
 * (task-strict-attach-dead-owner-hatch), structurally the kernel's
 * `WorktreeClaimTakeover`. The kernel moves the fired evidence OUT of
 * `foreignWrites` into this field, so exactly one of the two is ever present
 * and an authorized take-over resolves the armed strict gate unchanged. The
 * evidence is MOVED, never dropped — this mapping is a whitelist, so a field
 * missing here would make the take-over resolve the gate AND vanish from the
 * tool result.
 */
type NativeClaimTakeover = {
  at: string
  by: string
  replacedIdentity: string
  replacedClaimedAt: string
  replaced: NativeClaimStamp
  files: string[]
  total: number
}

/**
 * The claim-stamp receipt (task-single-writer-worktree-enforcement),
 * structurally the kernel's `WorktreeClaimReceipt`: `stamped` reports the
 * rolling ownership stamp; a fired `foreignWrites` report is a WARNING by
 * default and an attach refusal under `x-tracker.strict-worktree-writes`;
 * `takeOver` is the authorized replacement of a presumed-dead stamp
 * (task-strict-attach-dead-owner-hatch), reported instead of `foreignWrites`.
 */
type NativeClaimReceipt = {
  stamped: boolean
  foreignWrites?: NativeClaimWriteReport
  takeOver?: NativeClaimTakeover
  warning?: string
}

type NativeClaimCommitReceipt = {
  status: "committed" | "already-committed" | "not-needed" | "not-attempted" | "failed"
  committed: boolean
  hash?: string
  message?: string
  skipped?: string
  reason?: string
  ignored?: string[]
}

type NativeCommitResult = {
  committed: boolean
  skipReason?: string
  hash?: string
  message?: string
  ignored?: string[]
}

/**
 * Keep a receipt bounded even when an install or git error is attacker-shaped.
 *
 * The dependency-coverage fields are PROJECTED, never re-derived: the kernel
 * receipt (`prepareWorktreeDependencies`) owns the manifest check and already
 * caps `missingDependencies` at `MAX_MISSING_DEPENDENCIES` (10) — below this
 * function's own list cap, so there is nothing left to re-slice. Only the
 * per-name character bound is re-applied, like every other name in the receipt,
 * and a kernel-side truncation is folded into the shared `truncated` flag so a
 * capped list is never passed off as the whole set.
 *
 * The one flag the kernel SETS is mirrored, never recomputed
 * (bug-native-steps-truncated-flag-dropped): `stepsTruncated` says the kernel's
 * own `MAX_PREP_STEPS` (16) log dropped entries. Deriving it here from a cap of
 * this function's own (32) cannot fire through the kernel's smaller one, so the
 * shortened list was reported as complete; the mirror keeps both surfaces on the
 * kernel's decision, and the fold into `truncated` is additive on top of it.
 */
function boundedPreparation(input: {
  ready: boolean
  install: string
  linkedNodeModules: boolean
  builtWorkspaces: string[]
  linkedWorkspaces: string[]
  manifestCoverage: NativeManifestCoverage
  missingDependencies: string[]
  missingDependenciesTotal: number
  gateBins?: NativeGateBinResolution[]
  steps?: NativePrepStep[]
  /** The kernel's own log-truncation decision; mirrored, never re-derived. */
  stepsTruncated?: true
  env?: NativeEnvReceipt
  claim?: NativeClaimReceipt
}): NativePreparationReceipt {
  const built = input.builtWorkspaces
    .slice(0, MAX_NATIVE_PREPARATION_NAMES)
    .map((name) => boundedNativeText(name, MAX_NATIVE_PREPARATION_VALUE_CHARS))
  const linked = input.linkedWorkspaces
    .slice(0, MAX_NATIVE_PREPARATION_NAMES)
    .map((name) => boundedNativeText(name, MAX_NATIVE_PREPARATION_VALUE_CHARS))
  const missing = input.missingDependencies.map((name) =>
    boundedNativeText(name, MAX_NATIVE_PREPARATION_VALUE_CHARS),
  )
  // The kernel receipt owns discovery and the MAX_GATE_BINS cap (8, below this
  // function's own list cap), so there is nothing to re-slice — only the
  // per-name/per-path character bound is re-applied.
  const gateBins = (input.gateBins ?? []).map((bin) => {
    const bounded: NativeGateBinResolution = {
      name: boundedNativeText(bin.name, MAX_NATIVE_PREPARATION_VALUE_CHARS),
      source: bin.source,
    }
    if (bin.path !== undefined) {
      bounded.path = boundedNativeText(bin.path, MAX_NATIVE_PREPARATION_VALUE_CHARS)
    }
    return bounded
  })
  // The kernel owns discovery and its own cap (MAX_PREP_STEPS = 16, below this
  // function's MAX_NATIVE_PREPARATION_NAMES); only the per-string bound is
  // re-applied. The 32-name slice stays as defense in depth — a hand-built
  // receipt is the only way it can fire through the kernel — while the
  // kernel's OWN decision about dropping entries is mirrored, never recomputed
  // from that slice (below): the length comparison cannot see a kernel-side
  // drop, so deriving the flag from it is what let a shortened log be read as
  // the whole log.
  const steps = (input.steps ?? []).slice(0, MAX_NATIVE_PREPARATION_NAMES).map((entry) => {
    const bounded: NativePrepStep = {
      // A kernel-produced phase token from a fixed three-value set: passed
      // through, not re-bounded as free text.
      step: entry.step,
      outcome: boundedNativeText(entry.outcome, MAX_NATIVE_PREPARATION_VALUE_CHARS),
    }
    if (entry.pkg !== undefined) {
      bounded.pkg = boundedNativeText(entry.pkg, MAX_NATIVE_PREPARATION_VALUE_CHARS)
    }
    return bounded
  })
  // The kernel's own "the log was capped" decision (bug-native-steps-truncated-flag-dropped).
  // Mirrored verbatim, and only ever true when the kernel set it: a flag invented
  // here would be a second, disagreeing account of the same event.
  const kernelDroppedSteps = input.stepsTruncated === true
  // Env contract fragment (spec worktree-env-contract-016): projected, not
  // re-derived — the kernel owns the check and the six-key shape.
  const env = input.env === undefined ? undefined : boundedEnvReceipt(input.env)
  // Claim-stamp fragment (task-single-writer-worktree-enforcement): projected,
  // not re-derived — the kernel owns detection and the MAX_CLAIM_WRITE_NAMES
  // cap, which is below this function's own list cap, so only the per-string
  // bound is re-applied and an over-cap file list folds into `truncated`.
  const claim =
    input.claim === undefined ? undefined : boundedClaimReceipt(input.claim)
  const truncated =
    // The kernel's capped log folds in here too, so a caller watching only the
    // shared flag still learns the log is not the whole log (additive on top of
    // the named `stepsTruncated` mirror, never a replacement for it).
    kernelDroppedSteps ||
    input.builtWorkspaces.length > MAX_NATIVE_PREPARATION_NAMES ||
    input.linkedWorkspaces.length > MAX_NATIVE_PREPARATION_NAMES ||
    (input.steps?.length ?? 0) > steps.length ||
    input.missingDependenciesTotal > input.missingDependencies.length ||
    (input.gateBins?.length ?? 0) > gateBins.length ||
    (claim?.foreignWrites !== undefined &&
      claim.foreignWrites.total > claim.foreignWrites.files.length) ||
    (claim !== undefined && claimTakeoverTruncated(claim, input.claim)) ||
    built.some((name, index) => name !== input.builtWorkspaces[index]) ||
    linked.some((name, index) => name !== input.linkedWorkspaces[index]) ||
    missing.some((name, index) => name !== input.missingDependencies[index]) ||
    gateBins.some(
      (bin, index) =>
        input.gateBins?.[index] === undefined ||
        bin.name !== input.gateBins[index].name ||
        bin.path !== input.gateBins[index].path,
    ) ||
    (env !== undefined && envTruncated(env, input.env))
  return {
    ready: input.ready,
    install: input.install,
    linkedNodeModules: input.linkedNodeModules,
    builtWorkspaces: built,
    linkedWorkspaces: linked,
    manifestCoverage: input.manifestCoverage,
    missingDependencies: missing,
    missingDependenciesTotal: input.missingDependenciesTotal,
    gateBins,
    ...(steps.length > 0 ? { steps } : {}),
    ...(kernelDroppedSteps ? { stepsTruncated: true as const } : {}),
    ...(env !== undefined ? { env } : {}),
    ...(claim !== undefined ? { claim } : {}),
    ...(truncated ? { truncated: true } : {}),
  }
}

/**
 * Bound one claim-stamp receipt fragment: only the free-text fields (`owner`,
 * `claimedAt`, each `files` entry, `warning`) are re-bounded; `stamped` and
 * `total` are honest counts the kernel owns.
 *
 * `takeOver` (task-strict-attach-dead-owner-hatch) is PROJECTED with the same
 * bounds, never dropped: it carries the fired evidence the kernel moved out of
 * `foreignWrites`, so dropping it here would resolve the armed strict gate AND
 * lose the audit record of who replaced whose dead claim. `replaced` is a stamp
 * read out of the worktree's git dir, so it is attacker-shaped like every other
 * free-text surface here — each of its strings is re-bounded and its nested
 * `takeovers` chain is capped, with the kernel's own `MAX_CLAIM_TAKEOVERS` cap
 * (5) below this function's list cap as the reason nothing is left to re-slice
 * beyond the fold below.
 */
function boundedClaimReceipt(input: NativeClaimReceipt): NativeClaimReceipt {
  const bounded: NativeClaimReceipt = { stamped: input.stamped }
  if (input.foreignWrites !== undefined) {
    bounded.foreignWrites = {
      owner: boundedNativeText(input.foreignWrites.owner, MAX_NATIVE_PREPARATION_VALUE_CHARS),
      claimedAt: boundedNativeText(
        input.foreignWrites.claimedAt,
        MAX_NATIVE_PREPARATION_VALUE_CHARS,
      ),
      files: input.foreignWrites.files
        .slice(0, MAX_NATIVE_PREPARATION_NAMES)
        .map((file) => boundedNativeText(file, MAX_NATIVE_PREPARATION_VALUE_CHARS)),
      total: input.foreignWrites.total,
    }
  }
  if (input.takeOver !== undefined) {
    bounded.takeOver = boundedClaimTakeover(input.takeOver)
  }
  if (input.warning !== undefined) {
    bounded.warning = boundedNativeText(input.warning, MAX_NATIVE_PREPARATION_VALUE_CHARS)
  }
  return bounded
}

/** Bound one take-over receipt: free text and the replaced stamp's strings. */
function boundedClaimTakeover(input: NativeClaimTakeover): NativeClaimTakeover {
  return {
    at: boundedNativeText(input.at, MAX_NATIVE_PREPARATION_VALUE_CHARS),
    by: boundedNativeText(input.by, MAX_NATIVE_PREPARATION_VALUE_CHARS),
    replacedIdentity: boundedNativeText(input.replacedIdentity, MAX_NATIVE_PREPARATION_VALUE_CHARS),
    replacedClaimedAt: boundedNativeText(
      input.replacedClaimedAt,
      MAX_NATIVE_PREPARATION_VALUE_CHARS,
    ),
    replaced: boundedClaimStamp(input.replaced),
    files: input.files
      .slice(0, MAX_NATIVE_PREPARATION_NAMES)
      .map((file) => boundedNativeText(file, MAX_NATIVE_PREPARATION_VALUE_CHARS)),
    total: input.total,
  }
}

/** Bound one replaced ownership stamp: every string re-bounded, chain capped. */
function boundedClaimStamp(input: NativeClaimStamp): NativeClaimStamp {
  const bounded: NativeClaimStamp = {
    identity: boundedNativeText(input.identity, MAX_NATIVE_PREPARATION_VALUE_CHARS),
    item: boundedNativeText(input.item, MAX_NATIVE_PREPARATION_VALUE_CHARS),
    branch: boundedNativeText(input.branch, MAX_NATIVE_PREPARATION_VALUE_CHARS),
    claimedAt: boundedNativeText(input.claimedAt, MAX_NATIVE_PREPARATION_VALUE_CHARS),
  }
  if (input.assignee !== undefined) {
    bounded.assignee = boundedNativeText(input.assignee, MAX_NATIVE_PREPARATION_VALUE_CHARS)
  }
  if (input.surface !== undefined) {
    bounded.surface = boundedNativeText(input.surface, MAX_NATIVE_PREPARATION_VALUE_CHARS)
  }
  if (input.takeovers !== undefined) {
    bounded.takeovers = input.takeovers
      .slice(0, MAX_NATIVE_PREPARATION_NAMES)
      .map((entry) => ({
        at: boundedNativeText(entry.at, MAX_NATIVE_PREPARATION_VALUE_CHARS),
        by: boundedNativeText(entry.by, MAX_NATIVE_PREPARATION_VALUE_CHARS),
        replacedIdentity: boundedNativeText(
          entry.replacedIdentity,
          MAX_NATIVE_PREPARATION_VALUE_CHARS,
        ),
        replacedClaimedAt: boundedNativeText(
          entry.replacedClaimedAt,
          MAX_NATIVE_PREPARATION_VALUE_CHARS,
        ),
      }))
  }
  return bounded
}

/**
 * True when bounding shortened the take-over's evidence: an over-cap named-file
 * list, a string clipped at `MAX_NATIVE_PREPARATION_VALUE_CHARS`, or an over-cap
 * chain inside the replaced stamp.
 *
 * The length fold is the honest "you are not seeing all of it" signal (the
 * kernel owns both counts, so this never re-derives the evidence). The string
 * fold is the same discipline the `built`/`linked`/`missingDependencies`
 * projections already apply: a path or identity silently shortened to 200 chars
 * and then reported as if it were the whole value is exactly the failure this
 * flag exists to name — and a dirty tracked path over 200 chars is ordinary in
 * any deep repo.
 *
 * The chain-cap term below is defense in depth: the kernel's stamp reader
 * already caps `takeovers` at `MAX_CLAIM_TAKEOVERS` (5) before this mapper
 * ever sees it, so through the kernel it cannot fire. It stays because the
 * input is a file in the worktree's git dir, and an unreachable-but-harmless
 * branch is cheaper than a silent assumption.
 */
function claimTakeoverTruncated(
  bounded: NativeClaimReceipt,
  input: NativeClaimReceipt | undefined,
): boolean {
  if (input === undefined) return true
  const takeOver = bounded.takeOver
  const source = input.takeOver
  if (takeOver === undefined || source === undefined) return false
  const replaced = source.replaced
  const clipped =
    takeOver.at !== source.at ||
    takeOver.by !== source.by ||
    takeOver.replacedIdentity !== source.replacedIdentity ||
    takeOver.replacedClaimedAt !== source.replacedClaimedAt ||
    takeOver.replaced.identity !== replaced.identity ||
    takeOver.replaced.item !== replaced.item ||
    takeOver.replaced.branch !== replaced.branch ||
    takeOver.replaced.claimedAt !== replaced.claimedAt ||
    takeOver.replaced.assignee !== replaced.assignee ||
    takeOver.replaced.surface !== replaced.surface ||
    takeOver.files.some((file, index) => file !== source.files[index])
  return (
    clipped ||
    takeOver.total > takeOver.files.length ||
    (replaced.takeovers?.length ?? 0) > (takeOver.replaced.takeovers?.length ?? 0)
  )
}

/**
 * Bound one env receipt fragment: only the free-text fields (`path`,
 * `seededDotenv`, `warning`, each `keys` entry) are re-bounded; `written` and
 * `gitignored` are booleans. The kernel owns the six-key set (`keys` is never
 * longer than that), so the list cap is a formality here.
 */
function boundedEnvReceipt(input: NativeEnvReceipt): NativeEnvReceipt {
  const bounded: NativeEnvReceipt = { written: input.written }
  if (input.path !== undefined) {
    bounded.path = boundedNativeText(input.path, MAX_NATIVE_PREPARATION_VALUE_CHARS)
  }
  if (input.keys !== undefined) {
    bounded.keys = input.keys
      .slice(0, MAX_NATIVE_PREPARATION_NAMES)
      .map((key) => boundedNativeText(key, MAX_NATIVE_PREPARATION_VALUE_CHARS))
  }
  if (input.seededDotenv !== undefined) {
    bounded.seededDotenv = boundedNativeText(input.seededDotenv, MAX_NATIVE_PREPARATION_VALUE_CHARS)
  }
  if (input.gitignored !== undefined) {
    bounded.gitignored = input.gitignored
  }
  if (input.warning !== undefined) {
    bounded.warning = boundedNativeText(input.warning, MAX_NATIVE_PREPARATION_VALUE_CHARS)
  }
  return bounded
}

/** True when bounding changed (or dropped) anything in the env fragment. */
function envTruncated(bounded: NativeEnvReceipt, input: NativeEnvReceipt | undefined): boolean {
  if (input === undefined) return true
  return (
    bounded.path !== input.path ||
    bounded.seededDotenv !== input.seededDotenv ||
    bounded.warning !== input.warning ||
    (input.keys?.length ?? 0) > (bounded.keys?.length ?? 0) ||
    (bounded.keys ?? []).some((key, index) => key !== input.keys?.[index])
  )
}

function boundedNames(names: string[] | undefined): string[] | undefined {
  if (names === undefined) return undefined
  return names
    .slice(0, MAX_NATIVE_PREPARATION_NAMES)
    .map((name) => boundedNativeText(name, MAX_NATIVE_PREPARATION_VALUE_CHARS))
}

/** Project the shared commit result into a bounded native `commit` payload. */
function boundedCommitPayload(result: NativeCommitResult): Record<string, unknown> {
  const ignored = boundedNames(result.ignored)
  if (result.committed) {
    return {
      ...(result.hash !== undefined
        ? { hash: boundedNativeText(result.hash, MAX_NATIVE_DETAIL_CHARS) }
        : {}),
      ...(result.message !== undefined
        ? { message: boundedNativeText(result.message, MAX_NATIVE_DETAIL_CHARS) }
        : {}),
      ...(ignored !== undefined ? { ignored } : {}),
    }
  }
  return {
    skipped: boundedNativeText(result.skipReason ?? "skipped", MAX_NATIVE_DETAIL_CHARS),
    ...(ignored !== undefined ? { ignored } : {}),
  }
}

function claimCommitFailure(skipped: string): NativeClaimCommitReceipt {
  return {
    status: "failed",
    committed: false,
    skipped: boundedNativeText(skipped || "claim commit failed", MAX_NATIVE_DETAIL_CHARS),
  }
}

function claimCommitNotAttempted(reason: string): NativeClaimCommitReceipt {
  return {
    status: "not-attempted",
    committed: false,
    reason: boundedNativeText(reason, MAX_NATIVE_DETAIL_CHARS),
  }
}

function envelopeMessage(envelope: Record<string, unknown>, fallback: string): string {
  const error =
    envelope.error !== null && typeof envelope.error === "object"
      ? (envelope.error as Record<string, unknown>)
      : undefined
  return boundedNativeText(asString(error?.message) ?? fallback, MAX_NATIVE_DETAIL_CHARS)
}

/**
 * Commit the claim file explicitly after the kernel update writes its fields.
 * `updateOperation`'s generic auto-commit is intentionally disabled here: it is
 * best-effort, and a failed pre-commit hook would otherwise be hidden behind an
 * `ok:true` update envelope. The tracker-commit helper still owns surgical
 * staging and the normal git/pre-commit path; native start owns when it runs.
 */
function commitNativeClaim(
  kernel: ArgonKernel,
  cwd: string,
  id: string,
): {
  receipt: NativeClaimCommitReceipt
  payload?: Record<string, unknown>
} {
  const shown = kernel.showOperation({ cwd, id, meta: true })
  if (!shown.ok) {
    return { receipt: claimCommitNotAttempted(envelopeMessage(shown.envelope, "claim item lookup failed")) }
  }
  const path = asString(shown.envelope.path)
  if (path === undefined) return { receipt: claimCommitNotAttempted("claim item path unavailable") }

  const result = kernel.commitTrackerMutation(cwd, [resolve(cwd, path)], {
    // Keep the native tracker convention used by updateOperation; only the
    // explicitness and failure handling change here.
    message: kernel.trackerCommitMessage("claimed", [id]),
    commit: true,
  })
  const ignored = boundedNames(result.ignored)
  if (result.committed) {
    return {
      receipt: {
        status: "committed",
        committed: true,
        ...(result.hash !== undefined
          ? { hash: boundedNativeText(result.hash, MAX_NATIVE_DETAIL_CHARS) }
          : {}),
        ...(result.message !== undefined
          ? { message: boundedNativeText(result.message, MAX_NATIVE_DETAIL_CHARS) }
          : {}),
        ...(ignored !== undefined ? { ignored } : {}),
      },
      payload: boundedCommitPayload(result),
    }
  }
  if (result.skipReason === "nothing to commit") {
    // The item was already committed (or this invocation was a true no-op).
    // No second commit is claimed, and the kernel's benign skip is not exposed
    // as a misleading `commit` payload.
    return {
      receipt: {
        status: "not-needed",
        committed: true,
        ...(ignored !== undefined ? { ignored } : {}),
      },
    }
  }
  return {
    receipt: {
      ...claimCommitFailure(result.skipReason ?? "git commit failed"),
      ...(ignored !== undefined ? { ignored } : {}),
    },
    payload: boundedCommitPayload(result),
  }
}

/**
 * Run a worktree tool body with the plugin's failure-isolation contract: an
 * unexpected exception (a kernel throw, a broken domain promise) becomes a
 * typed failure envelope instead of a raw throw through the tool boundary.
 */
async function guarded(
  kernel: ArgonKernel,
  command: string,
  code: string,
  body: () => Promise<{ ok: boolean; envelope: Record<string, unknown> }>,
): Promise<{ ok: boolean; envelope: Record<string, unknown> }> {
  try {
    return await body()
  } catch (error) {
    logOnce(`worktree-${command}`, `${command} failed unexpectedly`, error)
    if (command === "start") {
      // This catch only sees throws from BEFORE nativeStart's progress handler
      // is installed (id/root/item/assignee resolution), where no claim commit
      // can exist yet — a not-attempted receipt is truthful. Every phase after
      // that is wrapped by nativeStart itself and reports its observed state,
      // so a landed claim commit is never downgraded here (review R2).
      return startNotAttempted(
        kernel,
        detail(error),
        undefined,
        {},
        "unexpected start failure before claim setup",
      )
    }
    return worktreeFail(kernel, command, code, detail(error))
  }
}

/** Re-label a kernel failure envelope for the calling tool (command + code). */
function remapFailure(
  envelope: Record<string, unknown>,
  command: string,
  code: string,
): { ok: false; envelope: Record<string, unknown> } {
  const error =
    envelope.error !== null && typeof envelope.error === "object"
      ? (envelope.error as Record<string, unknown>)
      : {}
  return { ok: false, envelope: { ...envelope, command, error: { ...error, code } } }
}

/** Repo root for a session directory (throws outside a tracker tree). */
function sessionRoot(kernel: ArgonKernel, cwd: string): string {
  return kernel.repoRootFromTasks(kernel.findTasksDir(cwd))
}

/**
 * Branch name for an item: explicit input > recorded `branch` field > the
 * convention's `branch_patterns` pattern for its type.
 */
function itemBranch(
  kernel: ArgonKernel,
  root: string,
  item: Record<string, unknown>,
  explicit: unknown,
): string {
  const requested = asString(explicit) ?? asString(item.branch)
  if (requested !== undefined) return requested
  const type = asString(item.type) as keyof typeof kernel.DEFAULT_BRANCH_PATTERNS | undefined
  const config = kernel.readConventionConfig(root)
  const pattern =
    (type !== undefined ? config.branchPatterns[type] : undefined) ??
    (type !== undefined ? kernel.DEFAULT_BRANCH_PATTERNS[type] : undefined) ??
    "feat/{id}"
  return kernel.resolveBranchName(pattern, {
    id: asString(item.id) ?? "",
    type: (type ?? "task") as (typeof kernel.ITEM_TYPES)[number],
  })
}

/** Canonical checkout root: `ctx.location.project.canonical`, else the repo root. */
function canonicalRoot(options: ArgonToolOptions, fallback: string): string {
  return asString(options.worktree?.canonical) ?? fallback
}

/**
 * Create the item worktree through the domain: parent `../<repo>-<id>` next to
 * the canonical checkout, name `<repo>-<id>`. Returns the actual directory or
 * an actionable error (the CLI fallback when the domain is unavailable).
 */
async function createItemWorktree(
  options: ArgonToolOptions,
  repoRoot: string,
  id: string,
): Promise<{ directory?: string; error?: string }> {
  const domain = options.worktree?.domain
  const projectID = asString(options.worktree?.projectID)
  if (domain?.create === undefined || projectID === undefined) {
    return {
      error:
        "the OpenCode worktree domain is unavailable (ctx.worktree.create/project id missing); " +
        "use the CLI fallback `arggon start --worktree`",
    }
  }
  const canonical = canonicalRoot(options, repoRoot)
  const name = `${basename(canonical)}-${id}`
  try {
    const created = (await domain.create({
      projectID,
      name,
      directory: resolve(canonical, ".."),
    })) as { directory?: unknown } | undefined
    const directory = asString(created?.directory)
    if (directory === undefined) {
      return { error: "the worktree domain returned no directory for " + name }
    }
    return { directory }
  } catch (error) {
    return { error: `worktree domain create failed for '${name}': ${detail(error)}` }
  }
}

/** The one observed removal rule every worktree remover in this plugin shares. */
type WorktreeRemovalObservation = {
  /**
   * True only when the directory is gone AND `git worktree list` no longer
   * reports it. Never inferred from a resolved promise or a zero exit code.
   */
  removed: boolean;
  /** Which step actually removed it (null when nothing did). */
  via: "domain" | "git" | null;
  /** Why the removal did not complete (empty when it did). */
  errors: string[];
};

/**
 * Force policy for a removal attempt chain. It is a policy input, not a second
 * rule: the observation below is identical for every caller, so the start
 * rollback and the cleanup prune can never disagree what "removed" means.
 */
type WorktreeRemovalPolicy = {
  /**
   * Applies to the domain call AND the git fallback. The start rollback forces
   * (it discards a worktree this run just created); the cleanup prune does not,
   * so git keeps refusing dirty worktrees exactly like `arggon cleanup --prune`.
   */
  force: boolean;
};

/**
 * Remove one worktree and OBSERVE the result — the single removal/observation
 * implementation shared by the native `start` rollback ({@link discardWorktree})
 * and the native `cleanup` prune ({@link nativeCleanup}).
 *
 * The domain is the preferred path, but a resolved promise is not a removal: a
 * domain that fails, or that leaves the worktree in place, falls through to the
 * literal `git worktree remove` fallback, and the directory plus the git
 * inventory are checked after every step. Callers gate every consequential
 * action (branch deletion, `worktree_path` clearing) on `removed`.
 */
async function removeWorktreeObserved(
  options: ArgonToolOptions,
  directory: string,
  root: string,
  policy: WorktreeRemovalPolicy,
): Promise<WorktreeRemovalObservation> {
  const errors: string[] = [];
  const domain = options.worktree?.domain;
  const projectID = asString(options.worktree?.projectID);
  // Physical state AND git inventory: a removal is complete only when both agree.
  const gone = async (): Promise<boolean> =>
    !existsSync(directory) && !(await isRegisteredWorktree(root, directory));
  let via: WorktreeRemovalObservation["via"] = null;

  if (domain?.remove !== undefined && projectID !== undefined) {
    try {
      await domain.remove({ projectID, directory, force: policy.force });
      if (await gone()) via = "domain";
      else errors.push("the worktree domain resolved without removing the worktree");
    } catch (error) {
      errors.push(`worktree domain removal failed: ${detail(error)}`);
    }
  }

  if (via === null) {
    const removed = await run(
      "git",
      ["worktree", "remove", ...(policy.force ? ["--force"] : []), directory],
      root,
      30_000,
    );
    if (removed.code !== 0) {
      errors.push(
        `git worktree removal failed: ${removed.stderr.trim() || `exit ${removed.code ?? "unknown"}`}`,
      );
    } else if (await gone()) {
      via = "git";
    } else {
      // A zero exit is not proof either: report the leftover, not the success.
      errors.push(`git worktree remove exited 0 but the worktree remains at ${directory}`);
    }
  }

  const removed = via !== null;
  if (!removed) errors.push(`worktree remains at ${directory}`);
  return { removed, via, errors };
}

type DiscardWorktreeResult = {
  worktreeRemoved: boolean;
  /** null means this run did not own a branch, so no branch deletion was due. */
  branchDeleted: boolean | null;
  error?: string;
};

/**
 * Remove a worktree this run created and observe the result with the same
 * primitive the cleanup prune uses (forced: the worktree is seconds old and
 * holds nothing but this run's scaffolding). The directory and git inventory
 * are checked before a branch is deleted: a rollback is never described as
 * successful from an unobserved promise.
 */
async function discardWorktree(
  options: ArgonToolOptions,
  directory: string,
  branch?: string,
): Promise<DiscardWorktreeResult> {
  const canonical = canonicalRoot(options, options.cwd);
  const observation = await removeWorktreeObserved(options, directory, canonical, { force: true });
  const errors = [...observation.errors];
  const worktreeRemoved = observation.removed;

  let branchDeleted: boolean | null = branch === undefined ? null : false;
  if (branch !== undefined) {
    // Never delete the branch until the worktree is observably gone.
    if (!worktreeRemoved) {
      errors.push(`branch ${branch} was kept because its worktree remains`);
    } else {
      const deleted = await run("git", ["branch", "-D", branch], canonical, 10_000);
      branchDeleted = deleted.code === 0;
      if (!branchDeleted) {
        errors.push(
          `git branch deletion failed: ${deleted.stderr.trim() || `exit ${deleted.code ?? "unknown"}`}`,
        );
      }
    }
  }

  return {
    worktreeRemoved,
    branchDeleted,
    ...(errors.length > 0
      ? { error: boundedNativeText(errors.join("; "), MAX_NATIVE_DETAIL_CHARS) }
      : {}),
  };
}

type ClaimCleanupResult = {
  preparationRemoved: boolean;
  discard?: DiscardWorktreeResult;
};

async function cleanupClaimArtifacts(
  options: ArgonToolOptions,
  kernel: ArgonKernel,
  primaryRoot: string,
  worktreePath: string | undefined,
  worktreeCreated: boolean,
  branchCreated: boolean,
  branch: string,
  preparation: NativePreparationReceipt | undefined,
): Promise<ClaimCleanupResult> {
  const preparationRemoved =
    preparation?.linkedNodeModules !== true || worktreePath === undefined
      ? true
      : kernel.unlinkNodeModulesLink(primaryRoot, worktreePath);
  const discard =
    worktreeCreated && worktreePath !== undefined
      ? await discardWorktree(options, worktreePath, branchCreated ? branch : undefined)
      : undefined;
  return { preparationRemoved, ...(discard !== undefined ? { discard } : {}) };
}

function cleanupDescription(
  cleanup: ClaimCleanupResult,
  worktreeCreated: boolean,
  worktreePath: string | undefined,
  branch: string,
): string {
  if (!worktreeCreated) {
    return cleanup.preparationRemoved
      ? ""
      : `the start-owned dependency link could not be removed from ${worktreePath ?? "the worktree"}`;
  }
  const discard = cleanup.discard;
  if (
    cleanup.preparationRemoved &&
    discard?.worktreeRemoved === true &&
    (discard.branchDeleted === true || discard.branchDeleted === null)
  ) {
    return "the worktree created by this run was removed again";
  }
  const details = [
    cleanup.preparationRemoved ? undefined : "the start-owned dependency link remains",
    discard?.worktreeRemoved === false ? `the worktree remains at ${worktreePath ?? "the created path"}` : undefined,
    discard?.branchDeleted === false ? `the branch remains: ${branch}` : undefined,
    discard?.error,
  ].filter((value): value is string => value !== undefined);
  return `rollback incomplete: ${details.join("; ")}`;
}

/**
 * Check out the item branch inside a fresh worktree. The domain creates a
 * DETACHED worktree, so a new branch is created from its HEAD (`switch -c`)
 * an existing branch is switched to. Never force: a branch checked out in
 * another worktree fails with git's own message.
 */
async function ensureWorktreeBranch(
  worktreePath: string,
  branch: string,
): Promise<{ ok: boolean; created: boolean; error?: string }> {
  const exists = await run(
    "git",
    ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
    worktreePath,
    10_000,
  )
  if (exists.code === 0) {
    const switched = await run("git", ["switch", branch], worktreePath, 10_000)
    return switched.code === 0
      ? { ok: true, created: false }
      : { ok: false, created: false, error: switched.stderr.trim() || `git switch ${branch} failed` }
  }
  const created = await run("git", ["switch", "-c", branch], worktreePath, 10_000)
  return created.code === 0
    ? { ok: true, created: true }
    : { ok: false, created: false, error: created.stderr.trim() || `git switch -c ${branch} failed` }
}

/**
 * True when `path` is a worktree registered with the repo at `canonical`
 * (the deterministic-attach guard: an existing directory that is NOT a
 * worktree of this repo is never adopted).
 */
async function isRegisteredWorktree(canonical: string, path: string): Promise<boolean> {
  const listed = await run("git", ["worktree", "list", "--porcelain"], canonical, 10_000)
  if (listed.code !== 0) return false
  const target = resolve(path)
  return listed.stdout
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => resolve(line.slice("worktree ".length).trim()))
    .includes(target)
}

/**
 * Claim-relevant fields that differ between the canonical working tree and the
 * fresh worktree copy (HEAD). A non-undefined result means the canonical copy
 * carries uncommitted tracker changes the worktree cannot see, so the kernel
 * would validate a stale claim state — the native `start` refuses instead.
 */
async function staleClaimFields(
  kernel: ArgonKernel,
  canonicalCwd: string,
  worktreePath: string,
  id: string,
): Promise<string | undefined> {
  const fields = ["status", "assignee", "branch", "worktree_path"] as const
  const read = (cwd: string): Record<string, unknown> | undefined => {
    const shown = kernel.showOperation({ cwd, id, meta: true })
    return shown.ok ? ((shown.envelope.item ?? {}) as Record<string, unknown>) : undefined
  }
  const canonical = read(canonicalCwd)
  const worktree = read(worktreePath)
  if (canonical === undefined || worktree === undefined) return undefined
  const differing = fields.filter((field) => {
    const left = canonical[field] ?? null
    const right = worktree[field] ?? null
    return left !== right
  })
  return differing.length === 0 ? undefined : differing.join(", ")
}

/** Preflight the branch switch and clean-tree conditions for plain start. */
async function preflightPlainBranch(
  kernel: ArgonKernel,
  options: ArgonToolOptions,
  root: string,
  branch: string,
): Promise<string | undefined> {
  const ref = await run("git", ["check-ref-format", "--branch", branch], options.cwd, 10_000)
  if (ref.code !== 0) {
    return `branch '${branch}' is not a valid git branch (${ref.stderr.trim() || `git exit ${ref.code ?? "unknown"}`})`
  }
  const worktrees = await run("git", ["worktree", "list", "--porcelain"], options.cwd, 10_000)
  if (worktrees.code !== 0) {
    return `could not inspect git worktrees before branch setup (${worktrees.stderr.trim() || `git exit ${worktrees.code ?? "unknown"}`})`
  }
  let worktreePath: string | undefined
  for (const line of worktrees.stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      worktreePath = line.slice("worktree ".length).trim()
    } else if (line.trim() === `branch refs/heads/${branch}`) {
      if (worktreePath !== undefined && resolve(worktreePath) !== resolve(options.cwd)) {
        return `branch '${branch}' is already checked out at ${worktreePath}; detach it before plain start`
      }
    }
  }
  const status = await run("git", ["status", "--porcelain", "--untracked-files=all"], options.cwd, 10_000)
  if (status.code !== 0) {
    return `could not inspect the canonical working tree before branch setup (${status.stderr.trim() || `git exit ${status.code ?? "unknown"}`})`
  }
  const tracker = relative(root, kernel.findTasksDir(root)).split(sep).join("/")
  const blocked = status.stdout.split("\n").filter((line) => {
    if (line.trim().length === 0) return false
    const code = line.slice(0, 2)
    const path = line.slice(3).replace(/^"|"$/g, "")
    return !(code === "??" && !path.startsWith(`${tracker}/`))
  })
  if (blocked.length > 0) {
    return "the canonical working tree has tracked or tracker changes; commit/stash them before plain start"
  }
  return undefined
}

/**
 * State observed SO FAR by a native start. Every phase records into this
 * object, so an unexpected throw can report what actually happened instead of
 * a blanket "nothing was attempted" — a claim commit that already landed must
 * stay reported as committed (review R2).
 */
type NativeStartProgress = {
  id: string
  branch: string
  version: number
  /** Coarse phase label used in unexpected-failure messages. */
  stage: string
  worktreePath?: string
  worktreeCreated: boolean
  branchCreated: boolean
  preparation?: NativePreparationReceipt
  item?: unknown
  claim?: { receipt: NativeClaimCommitReceipt; payload?: Record<string, unknown> }
  pushed?: boolean
}

/** Bounded payload projection of the observed start state. */
function startProgressPayload(progress: NativeStartProgress): Record<string, unknown> {
  return {
    id: progress.id,
    branch: progress.branch,
    worktreePath: progress.worktreePath ?? null,
    worktreeCreated: progress.worktreeCreated,
    branchCreated: progress.branchCreated,
    ...(progress.preparation !== undefined ? { preparation: progress.preparation } : {}),
    ...(progress.item !== undefined ? { item: progress.item } : {}),
    ...(progress.claim !== undefined
      ? { claimCommitted: progress.claim.receipt.committed, claimCommit: progress.claim.receipt }
      : {}),
    ...(progress.claim?.payload !== undefined ? { commit: progress.claim.payload } : {}),
    ...(progress.pushed !== undefined ? { pushed: progress.pushed } : {}),
  }
}

/**
 * Unexpected throw inside the start body. Before the claim commit is attempted
 * this keeps the not-attempted receipt; AFTER the commit landed it reports the
 * real committed outcome (status + hash) so a late failure can never claim
 * that no commit happened.
 */
function unexpectedStartFailure(
  kernel: ArgonKernel,
  error: unknown,
  progress: NativeStartProgress,
): { ok: false; envelope: Record<string, unknown> } {
  const observed = startProgressPayload(progress)
  const where = boundedNativeText(progress.stage, MAX_NATIVE_DETAIL_CHARS)
  const cause = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)
  if (progress.claim !== undefined) {
    const committed = progress.claim.receipt.committed
    return startFailure(
      kernel,
      committed
        ? `start failed unexpectedly after ${where}, but the claim commit already landed ` +
            `(${progress.claim.receipt.hash ?? "committed"}); the branch and claim were kept. ${cause}. ` +
            "Re-run tools.arggon.start to attach and confirm the recorded state."
        : `start failed unexpectedly after ${where}; the claim commit was attempted and did not land. ` +
            `${cause}. Fix the reported cause, then re-run tools.arggon.start to attach and retry.`,
      progress.version,
      observed,
    )
  }
  return startNotAttempted(
    kernel,
    `start failed unexpectedly after ${where}; no claim commit was attempted. ${cause}`,
    progress.version,
    observed,
    `unexpected start failure after ${where}`,
  )
}

/** Never-throwing wrapper: even a broken failure path still names the phase. */
function safeUnexpectedStartFailure(
  kernel: ArgonKernel,
  error: unknown,
  progress: NativeStartProgress | undefined,
  fallback: { id: string; version: number },
): { ok: false; envelope: Record<string, unknown> } {
  const message = boundedNativeText(
    `start failed unexpectedly: ${detail(error)}`,
    MAX_NATIVE_ERROR_CHARS,
  )
  try {
    if (progress === undefined) {
      return startNotAttempted(
        kernel,
        message,
        fallback.version,
        { id: fallback.id },
        "unexpected start failure before branch setup",
      )
    }
    return unexpectedStartFailure(kernel, error, progress)
  } catch {
    return {
      ok: false,
      envelope: {
        ok: false,
        schemaVersion: 1,
        conventionVersion: fallback.version,
        command: "start",
        error: { code: "START_FAILED", message },
        id: fallback.id,
        ...(progress === undefined
          ? { claimCommitted: false, claimCommit: claimCommitNotAttempted("unexpected start failure") }
          : startProgressPayload(progress)),
      },
    }
  }
}

type PlainBranchRollback = {
  /** null = this run did not create the branch, so nothing was owned. */
  branchDeleted: boolean | null
  restoredBranch?: string
  error?: string
}

/**
 * Roll back ONLY a branch this run created in the canonical checkout: leave the
 * branch first (a checked-out branch cannot be deleted), then delete it. A
 * pre-existing/attached branch is never touched, and both steps are observed so
 * the caller never claims a rollback that did not happen (review R1).
 */
async function rollbackOwnedPlainBranch(
  options: ArgonToolOptions,
  branch: string,
  branchCreated: boolean,
  previousBranch: string | undefined,
): Promise<PlainBranchRollback> {
  if (!branchCreated) return { branchDeleted: null }
  const errors: string[] = []
  const detached = previousBranch === undefined || previousBranch === "HEAD"
  const back = detached
    ? await run("git", ["switch", "--detach"], options.cwd, 10_000)
    : await run("git", ["switch", previousBranch], options.cwd, 10_000)
  if (back.code !== 0) {
    errors.push(
      `could not leave branch ${branch}: ${back.stderr.trim() || `git switch exit ${back.code ?? "unknown"}`}`,
    )
  }
  let branchDeleted = false
  if (back.code === 0) {
    const deleted = await run("git", ["branch", "-D", branch], options.cwd, 10_000)
    branchDeleted = deleted.code === 0
    if (!branchDeleted) {
      errors.push(
        `git branch deletion failed: ${deleted.stderr.trim() || `git exit ${deleted.code ?? "unknown"}`}`,
      )
    }
  } else {
    errors.push(`branch ${branch} was kept because the checkout could not leave it`)
  }
  return {
    branchDeleted,
    ...(back.code === 0 ? { restoredBranch: detached ? "HEAD" : previousBranch } : {}),
    ...(errors.length > 0
      ? { error: boundedNativeText(errors.join("; "), MAX_NATIVE_DETAIL_CHARS) }
      : {}),
  }
}

/** Human summary of a plain-branch rollback, never claiming more than observed. */
function plainRollbackDescription(rollback: PlainBranchRollback, branch: string): string {
  if (rollback.branchDeleted === null) return ""
  if (rollback.branchDeleted) {
    return (
      "the branch created by this run was removed again and the checkout was restored to " +
      `${rollback.restoredBranch ?? "its previous HEAD"}`
    )
  }
  return `rollback incomplete: ${rollback.error ?? `the branch remains: ${branch}`}`
}

/**
 * `start` (native): claim + branch record + worktree through the domain, with
 * every rule enforced by the kernel (`updateOperation` with `agent: true` —
 * never steal a claim, never reopen). The claim/`branch`/`worktree_path`
 * records are written INSIDE the worktree so the claim commit lands on the
 * feature branch and the canonical checkout stays untouched, exactly like
 * `arggon start --worktree`. The PR step (`gh`) is deliberately not part of
 * the tool.
 *
 * Ordering: branch ownership is settled (create/attach/switch) BEFORE the claim
 * mutation, so a failed switch leaves the item untouched; a later claim refusal
 * rolls back only a branch this run created and reports what was observed.
 */
async function nativeStart(
  kernel: ArgonKernel,
  input: Record<string, unknown>,
  options: ArgonToolOptions,
  tool?: ArgonToolCallContext,
): Promise<{ ok: boolean; envelope: Record<string, unknown> }> {
  const id = asString(input.id)
  if (id === undefined) {
    return startNotAttempted(kernel, "id is required", undefined, {}, "invalid id")
  }
  let root: string
  try {
    root = sessionRoot(kernel, options.cwd)
  } catch (error) {
    return startNotAttempted(
      kernel,
      detail(error),
      undefined,
      { id },
      "session root unavailable",
    )
  }
  const version = kernel.readConventionVersion(root)
  const show = kernel.showOperation({ cwd: options.cwd, id, meta: true })
  if (!show.ok) {
    return startNotAttempted(
      kernel,
      envelopeMessage(show.envelope, "item lookup failed"),
      version,
      { id },
      "item lookup failed",
    )
  }
  const item = (show.envelope.item ?? {}) as Record<string, unknown>
  const assignee =
    asString(input.assignee) ?? asString(kernel.resolveCurrentLogin()) ?? undefined
  if (assignee === undefined) {
    return startNotAttempted(
      kernel,
      "could not resolve assignee (pass assignee, or set GITHUB_USER/GITHUB_ACTOR, or authenticate gh)",
      version,
      { id },
      "assignee unavailable",
    )
  }
  // Everything past this point runs under the progress handler: an unexpected
  // throw reports the state observed so far, so a claim commit that already
  // landed is never downgraded to "not attempted".
  let progress: NativeStartProgress | undefined
  try {
    progress = {
      id,
      branch: itemBranch(kernel, root, item, input.branch),
      version,
      stage: "branch setup",
      worktreeCreated: false,
      branchCreated: false,
    }
    return await nativeStartBody(kernel, input, options, progress, item, root, assignee, tool)
  } catch (error) {
    return safeUnexpectedStartFailure(kernel, error, progress, { id, version })
  }
}

/** The claim/branch/worktree phases of native start, after item resolution. */
async function nativeStartBody(
  kernel: ArgonKernel,
  input: Record<string, unknown>,
  options: ArgonToolOptions,
  progress: NativeStartProgress,
  item: Record<string, unknown>,
  root: string,
  assignee: string,
  tool?: ArgonToolCallContext,
): Promise<{ ok: boolean; envelope: Record<string, unknown> }> {
  const { id, branch, version } = progress
  const primaryRoot = canonicalRoot(options, root)
  // Calling-session identity for the claim stamp
  // (task-single-writer-worktree-enforcement): the session id when the host
  // hands one over, else the assignee — the same rolling stamp the CLI writes
  // with its assignee identity.
  const claimIdentity = sessionToken(tool?.sessionID) ?? assignee

  const wantWorktree = input.worktree !== false
  // Deliberate take-over of a presumed-dead stamped owner
  // (task-strict-attach-dead-owner-hatch), the CLI's `--take-over-worktree`:
  // forwarded to the kernel claim request so an attach whose single-writer
  // detection fired re-stamps the worktree and records a dated take-over.
  // Default OFF, and then nothing changes; the kernel only records a take-over
  // when a detection FIRES, so a clean attach is a no-op, not a re-stamp.
  const takeOverWorktree = input.takeOverWorktree === true
  // `worktree: false` is an explicit branch-only mode. Do not attach to (or
  // prepare) a stale `worktree_path` left by an earlier run; the canonical
  // checkout is the target and the result must report no worktree for this
  // invocation. The existing record is preserved, matching the CLI's plain
  // start path, which never clears an unrelated worktree record implicitly.
  let worktreePath = wantWorktree ? asString(item.worktree_path) : undefined
  if (worktreePath !== undefined && !existsSync(worktreePath)) worktreePath = undefined
  progress.worktreePath = worktreePath
  /** Branch we were on before a plain start; needed to undo an owned branch. */
  let plainPreviousBranch: string | undefined

  const context = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...startProgressPayload(progress),
    ...extra,
  })
  const failBeforeClaim = (
    message: string,
    reason: string,
    extra: Record<string, unknown> = {},
  ): { ok: false; envelope: Record<string, unknown> } =>
    startNotAttempted(kernel, message, version, context(extra), reason)

  // The take-over is worktree-scoped (same rule and same reason as the CLI):
  // without a worktree there is no claim stamp to take over, and a silently
  // ignored input is exactly how a recovery step gets believed to have
  // happened. Refused before any branch or claim mutation.
  if (takeOverWorktree && !wantWorktree) {
    return failBeforeClaim(
      "takeOverWorktree requires worktree (it takes over a claimed worktree's ownership " +
        "stamp; a plain start writes no stamp)",
      "invalid input",
    )
  }

  if (wantWorktree) {
    const canonical = primaryRoot
    if (worktreePath === undefined) {
      // Deterministic attach (CLI parity): a previous start's records live on
      // its feature branch, so the canonical copy cannot see them — the fixed
      // `../<repo>-<id>` path is what makes a second start attach to the
      // existing worktree instead of claiming a fresh one.
      const defaultPath = join(resolve(canonical, ".."), `${basename(canonical)}-${id}`)
      if (existsSync(defaultPath)) worktreePath = defaultPath
    }
    // The canonical copy never sees the worktree record (it lives on the
    // feature branch), so the deterministic attach path found above is the
    // only place `worktreePath` becomes known for a re-run.
    progress.worktreePath = worktreePath
    if (worktreePath !== undefined) {
      // Attach guard for BOTH paths (recorded `worktree_path` and the
      // deterministic default): a directory that is not a worktree of THIS
      // repo is never adopted — otherwise `start` would create/switch branches
      // inside a foreign repository that happens to sit at that path.
      if (!(await isRegisteredWorktree(canonical, worktreePath))) {
        return failBeforeClaim(
          `${worktreePath} exists but is not a git worktree of this repo ` +
            "(move or remove the path first, or use the CLI fallback `arggon start --worktree`)",
          "foreign worktree refused",
        )
      }
    } else {
      const created = await createItemWorktree(options, root, id)
      if (created.directory === undefined) {
        return failBeforeClaim(
          created.error ?? "worktree creation failed",
          "worktree creation failed",
        )
      }
      worktreePath = created.directory
      progress.worktreePath = worktreePath
      progress.worktreeCreated = true
      // The fresh worktree reflects HEAD; the canonical working tree may be
      // ahead (an uncommitted claim would be invisible here and the kernel
      // would re-claim a stale copy). Refuse instead of guessing.
      const stale = await staleClaimFields(kernel, options.cwd, worktreePath, id)
      if (stale !== undefined) {
        const cleanup = await cleanupClaimArtifacts(
          options,
          kernel,
          primaryRoot,
          worktreePath,
          progress.worktreeCreated,
          progress.branchCreated,
          branch,
          progress.preparation,
        )
        const rollback = cleanup.discard !== undefined
          ? { rollback: { preparationRemoved: cleanup.preparationRemoved, ...cleanup.discard } }
          : { rollback: { preparationRemoved: cleanup.preparationRemoved } }
        return failBeforeClaim(
          `the canonical checkout has uncommitted tracker changes for '${id}' (${stale}); ` +
            "commit or discard them, or use the CLI fallback `arggon start --worktree`. " +
            cleanupDescription(cleanup, progress.worktreeCreated, worktreePath, branch),
          "stale canonical claim refused",
          rollback,
        )
      }
    }
    progress.stage = "branch setup"
    const ensured = await ensureWorktreeBranch(worktreePath, branch)
    if (!ensured.ok) {
      // `ensured.created` is false whenever setup failed, so this run never
      // created the branch: never delete it on rollback.
      const cleanup = await cleanupClaimArtifacts(
        options,
        kernel,
        primaryRoot,
        worktreePath,
        progress.worktreeCreated,
        false,
        branch,
        progress.preparation,
      )
      const rollback = cleanup.discard !== undefined
        ? { rollback: { preparationRemoved: cleanup.preparationRemoved, ...cleanup.discard } }
        : { rollback: { preparationRemoved: cleanup.preparationRemoved } }
      return failBeforeClaim(
        `branch setup failed in ${worktreePath}: ${ensured.error ?? "unknown git error"}. ` +
          cleanupDescription(cleanup, progress.worktreeCreated, worktreePath, branch),
        "branch setup failed",
        rollback,
      )
    }
    progress.branchCreated = ensured.created
  } else {
    // Match the CLI plain-start ownership rule before any mutation: an existing
    // generated branch with no matching recorded branch is a conflict, not an
    // implicit attach. An explicit branch or a recorded matching branch may
    // attach.
    const branchCheck = await run(
      "git",
      ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
      options.cwd,
      10_000,
    )
    if (branchCheck.code !== 0 && branchCheck.code !== 1) {
      return failBeforeClaim(
        `could not inspect branch '${branch}': ${branchCheck.stderr.trim() || `git exit ${branchCheck.code ?? "unknown"}`}`,
        "branch ownership preflight failed",
      )
    }
    if (
      branchCheck.code === 0 &&
      asString(input.branch) === undefined &&
      asString(item.branch) !== branch
    ) {
      return failBeforeClaim(
        `branch '${branch}' already exists but the item has no matching recorded branch; ` +
          "record it explicitly or choose another branch",
        "branch ownership conflict",
      )
    }
    const preflight = await preflightPlainBranch(kernel, options, root, branch)
    if (preflight !== undefined) {
      return failBeforeClaim(preflight, "plain-start preflight failed")
    }
    // Order matters: settle branch ownership (create/attach/switch) BEFORE the
    // claim mutation. A switch that fails here therefore leaves the item
    // untouched instead of a claimed-but-dirty file plus a not-attempted
    // receipt (review R1).
    const previous = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"], options.cwd, 10_000)
    plainPreviousBranch = previous.code === 0 ? previous.stdout.trim() || undefined : undefined
    const ensured = await ensureWorktreeBranch(options.cwd, branch)
    if (!ensured.ok) {
      return failBeforeClaim(
        `branch setup failed in ${options.cwd}: ${ensured.error ?? "unknown git error"}; ` +
          "the item was not modified",
        "branch setup failed",
      )
    }
    progress.branchCreated = ensured.created
  }

  if (worktreePath !== undefined) {
    progress.stage = "dependency preparation"
    try {
      // The shared kernel receipt runs before the claim write/commit. A false
      // `ready` value remains explicit; the claim commit below is the final
      // authority for whether a project gate actually required it. The env
      // contract (spec worktree-env-contract-016) rides the same receipt:
      // `x-worktree.env: false` opts out; unset/true keep the default.
      progress.preparation = boundedPreparation(
        kernel.prepareWorktreeDependencies(primaryRoot, worktreePath, {
          env: {
            identity: { itemId: id, branch },
            enabled: kernel.readConventionConfig(root).worktree.env !== false,
          },
          claim: {
            identity: claimIdentity,
            assignee,
            itemId: id,
            branch,
            surface: "native",
            // Deliberate take-over (task-strict-attach-dead-owner-hatch): only
            // recorded when a detection FIRES, so passing the flag on a clean
            // attach is a no-op rather than a re-stamp. The kernel moves the
            // fired evidence out of `foreignWrites` into `claim.takeOver`, so
            // the strict gate below — unchanged — treats the authorized
            // replacement as resolved and no surface change is needed here.
            ...(takeOverWorktree ? { takeOver: true } : {}),
          },
        }),
      )
    } catch (error) {
      const preparationError = boundedPreparation({
        ready: false,
        install: "unavailable",
        linkedNodeModules: false,
        builtWorkspaces: [],
        linkedWorkspaces: [],
        // A preparation that threw was never compared against the manifest:
        // `unknown`, never a `satisfied` claim (same rule as the kernel), and
        // no gate-bin resolution was observed either.
        manifestCoverage: "unknown",
        missingDependencies: [],
        missingDependenciesTotal: 0,
        gateBins: [],
      })
      const preparationRemoved = kernel.unlinkNodeModulesLink(primaryRoot, worktreePath)
      return failBeforeClaim(
        `dependency preparation failed in ${worktreePath}: ${boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)}; ` +
          (preparationRemoved
            ? "the start-owned dependency link was removed and the worktree was kept"
            : "the worktree and any start-owned dependency link were kept"),
        "dependency preparation failed",
        { preparation: preparationError, rollback: { preparationRemoved } },
      )
    }
  }

  // Opt-in strict gate (task-start-gate-strict-mode): with
  // `x-tracker.strict-gate-bins: true` the preparation receipt's foreign
  // gate-bin resolution is no longer report-only — the claim is refused before
  // any item mutation, naming each offending bin, its observed source and the
  // `npm ci` fix. Unset (the default) keeps the documented honest-receipt
  // behavior byte-identical: readiness stays informational and the claim
  // commit remains authoritative.
  if (worktreePath !== undefined) {
    const strictRefusal =
      kernel.readConventionConfig(root).tracker.strictGateBins === true
        ? kernel.strictGateBinFailure(progress.preparation?.gateBins ?? [], worktreePath)
        : null
    if (strictRefusal !== null) {
      // ORDER IS LOAD-BEARING, same contract the strict worktree-write gate
      // below documents: `startFailure` clips the composed message HEAD-first
      // at MAX_NATIVE_ERROR_CHARS (2048), and the worst case is the named-bin
      // list at its MAX_GATE_BINS cap (~270 chars an entry). Advice APPENDED
      // after the kernel refusal is then the first thing the clip eats — and it
      // used to vanish whole, leaving only bin names with no way forward. So
      // every remedy goes FIRST (the worktree-kept note + the attach re-run)
      // and the kernel refusal closes the message: its lead sentence and the
      // first named bins survive the clip, exactly the ordering #579 landed
      // for strict worktree-write gate.
      return failBeforeClaim(
        `The worktree was kept at ${worktreePath} (nothing was rolled back). ` +
          "Then re-run " +
          `tools.arggon.start({ id: ${JSON.stringify(id)}, assignee: ${JSON.stringify(assignee)} }) — ` +
          "it attaches to the existing worktree and retries the claim commit. " +
          strictRefusal,
        "strict gate-bin gate refused",
      )
    }
  }

  // Single-writer enforcement (task-single-writer-worktree-enforcement): with
  // `x-tracker.strict-worktree-writes: true` a fired attach-time detection —
  // the worktree stamped by a DIFFERENT session, with tracked files modified
  // after that claim — refuses the claim BEFORE any item mutation, naming the
  // stamped owner and the newer files. Unset (the default) keeps the
  // documented report-only behavior byte-identical: the detection rides the
  // preparation receipt (`claim.foreignWrites`) and the claim commit remains
  // authoritative.
  //
  // A `takeOverWorktree` run (task-strict-attach-dead-owner-hatch) is NOT here:
  // the kernel reports the fired evidence as `claim.takeOver` instead of
  // `claim.foreignWrites`, so this gate — unchanged — treats the authorized
  // replacement of a presumed-dead stamp as resolved.
  if (worktreePath !== undefined) {
    const foreignWrites = progress.preparation?.claim?.foreignWrites
    const strictWriteRefusal =
      kernel.readConventionConfig(root).tracker.strictWorktreeWrites === true &&
      foreignWrites !== undefined
        ? kernel.strictWorktreeWriteFailure(foreignWrites)
        : null
    if (strictWriteRefusal !== null) {
      // A plain re-run CANNOT succeed here: the anti-unlock rule keeps the
      // previous stamp, so every retry re-detects against the SAME evidence
      // (task-single-writer-worktree-enforcement). Advertising one would be a
      // retry that cannot succeed. Name the designed hatch instead, plus the
      // manual recovery the CLI's refusal also names — the caller must confirm
      // the stamped session is dead first.
      //
      // ORDER IS LOAD-BEARING, not style. `startFailure` clips the composed
      // message at MAX_NATIVE_ERROR_CHARS (2048) HEAD-first, and the kernel
      // refusal ENDS with its own tail — up to 10 named dirty paths, ~57
      // chars each in this very repo. Advice APPENDED after it is the first
      // thing the clip eats, so the remedies used to vanish exactly when the
      // evidence was long enough to matter. Every remedy therefore goes FIRST
      // and the kernel refusal — its lead sentence naming the stamped owner,
      // the claim time and the file count — closes the message, exactly the
      // ordering #573's round 2 applied on the CLI for this same reason. The
      // path list is evidence to scroll back for, never the instruction to act
      // on.
      const recovery =
        "A plain re-run cannot clear this: the fired detection is unchanged while the previous " +
        "stamp stands. The worktree was kept at " +
        `${worktreePath} (nothing was rolled back). If the stamped session is really dead, take ` +
        "the worktree over explicitly with " +
        `tools.arggon.start({ id: ${JSON.stringify(id)}, assignee: ${JSON.stringify(assignee)}, takeOverWorktree: true }) — ` +
        "it records a dated take-over naming the replaced owner (the same hatch as " +
        "`arggon start --worktree --take-over-worktree`). Otherwise, with a live writer, do NOT " +
        "take over; remove the stamp by hand after confirming no live writer: " +
        `rm "$(git -C ${worktreePath} rev-parse --absolute-git-dir)/arggon-claim.json". `
      return failBeforeClaim(
        `${recovery}${strictWriteRefusal}`,
        "strict worktree-write gate refused",
      )
    }
  }

  // Fresh-worktree install gate (bug-start-install-ordering): a start that
  // CREATED the worktree must leave a gate-usable install — or fail BEFORE any
  // claim commit with the named cause (the offending bins, the preparation
  // log, the `npm ci` fix). This closes the eight-incident record's root
  // defect: the preparation steps used to degrade silently (a primary install
  // missing or mid-install, a failed farm, a PATH-masked resolution) and the
  // claim commit then died at the gate with a bare `tsx: command not found`.
  // Attach re-runs keep the report-only receipt (or the armed strict gate
  // above), so the documented `npm ci` then attach remedy stays possible.
  if (worktreePath !== undefined && progress.worktreeCreated) {
    const refusal = kernel.freshWorktreeInstallRefusal(
      progress.preparation?.gateBins ?? [],
      worktreePath,
      progress.preparation?.steps ?? [],
    )
    if (refusal !== null) {
      // ORDER IS LOAD-BEARING, same contract the strict worktree-write gate
      // above documents: `startFailure` clips the composed message HEAD-first
      // at MAX_NATIVE_ERROR_CHARS (2048), and the worst case is the named-bin
      // list at full length (`freshWorktreeInstallRefusal` puts that list —
      // evidence, not instruction — last, so only it clipped). Advice
      // APPENDED after the kernel refusal is the first thing the clip eats,
      // so every remedy goes FIRST (the worktree-kept note + the attach
      // re-run) and the kernel refusal — its lead sentence, the preparation
      // log and the `npm ci` fix — tells the rest, exactly the ordering #579
      // landed for strict worktree-write gate.
      return failBeforeClaim(
        `The worktree was kept at ${worktreePath} (nothing was rolled back). ` +
          "Then re-run " +
          `tools.arggon.start({ id: ${JSON.stringify(id)}, assignee: ${JSON.stringify(assignee)} }) — ` +
          "it attaches to the existing worktree and retries the claim commit. " +
          refusal,
        "fresh-worktree install gate refused",
      )
    }
  }

  progress.stage = "claim update"
  const target = worktreePath ?? options.cwd
  const update = kernel.updateOperation({
    cwd: target,
    id,
    status: "in_progress",
    assignee,
    // The branch is always recorded by the same claim write now that plain
    // start settles branch ownership first.
    branch,
    ...(wantWorktree ? { worktreePath } : {}),
    // The native surface commits the claim explicitly below so a failed
    // pre-commit gate cannot be hidden by updateOperation's best-effort commit.
    commit: false,
    agent: true,
  })
  if (!update.ok) {
    if (wantWorktree) {
      const cleanup = await cleanupClaimArtifacts(
        options,
        kernel,
        primaryRoot,
        worktreePath,
        progress.worktreeCreated,
        progress.branchCreated,
        branch,
        progress.preparation,
      )
      const rollback = cleanup.discard !== undefined
        ? { rollback: { preparationRemoved: cleanup.preparationRemoved, ...cleanup.discard } }
        : { rollback: { preparationRemoved: cleanup.preparationRemoved } }
      return failBeforeClaim(
        `${envelopeMessage(update.envelope, "claim update failed")}. ` +
          cleanupDescription(cleanup, progress.worktreeCreated, worktreePath, branch),
        "claim update refused",
        rollback,
      )
    }
    // Plain start: roll back ONLY the branch this run created, restoring the
    // checkout first, and report exactly what was observed.
    const rollback = await rollbackOwnedPlainBranch(
      options,
      branch,
      progress.branchCreated,
      plainPreviousBranch,
    )
    return failBeforeClaim(
      `${envelopeMessage(update.envelope, "claim update failed")}. ` +
        plainRollbackDescription(rollback, branch),
      "claim update refused",
      { rollback },
    )
  }
  progress.item = update.envelope.item

  progress.stage = "claim commit"
  let claim: { receipt: NativeClaimCommitReceipt; payload?: Record<string, unknown> }
  try {
    claim = commitNativeClaim(kernel, target, id)
  } catch (error) {
    claim = { receipt: claimCommitFailure(detail(error)) }
  }
  progress.claim = claim
  const claimPayload: Record<string, unknown> = {
    ...context(),
    item: update.envelope.item,
    claimCommitted: claim.receipt.committed,
    claimCommit: claim.receipt,
    ...(claim.payload !== undefined ? { commit: claim.payload } : {}),
  }
  if (!claim.receipt.committed) {
    const reason = claim.receipt.skipped ?? "claim commit failed"
    const kept = worktreePath !== undefined
      ? `the worktree was kept at ${worktreePath} (nothing was rolled back)`
      : "the claim file was left in place for inspection"
    // Name the observed gate-binary resolution and the exact remediation
    // (bug-start-worktree-npm-ci-claim): a bare `tsx: command not found` used
    // to leave the worker to diagnose the install state alone, and a foreign
    // resolution (a sibling checkout's .bin on PATH) used to stay invisible.
    const foreignBins = (progress.preparation?.gateBins ?? []).filter(
      (bin) => bin.source !== "worktree",
    )
    const resolution =
      foreignBins.length > 0
        ? ` Gate binaries do not resolve inside the worktree — ${foreignBins
            .map((bin) =>
              bin.source === "missing"
                ? `${bin.name}: not resolvable from the worktree`
                : bin.source === "path"
                  ? `${bin.name}: resolves only via PATH from ${bin.path} (outside the worktree)`
                  : `${bin.name}: resolves from ${bin.path}, above the worktree`,
            )
            .join("; ")}.`
        : ""
    const install = progress.preparation?.install ?? "unknown"
    const installNote =
      install === "missing" || install === "unavailable"
        ? ` The worktree has no usable install of its own (${install}).`
        : ""
    const fix =
      resolution !== "" || installNote !== ""
        ? " Run `npm ci` in the worktree for a worktree-local install, then re-run."
        : ""
    return startFailure(
      kernel,
      `start failed while committing the claim; ${kept}. ` +
        `${reason}.${resolution}${installNote}${fix} Otherwise re-run ` +
        `tools.arggon.start({ id: ${JSON.stringify(id)}, assignee: ${JSON.stringify(assignee)} }) — ` +
        "it attaches to the existing worktree and retries the claim commit.",
      version,
      claimPayload,
    )
  }

  progress.stage = "push"
  let pushed = false
  const pushEligible = claim.receipt.status === "committed" || progress.branchCreated
  if (input.push === true && pushEligible) {
    const push = await run("git", ["push", "-u", "origin", branch], target, 60_000)
    if (push.code !== 0) {
      progress.pushed = false
      return startFailure(
        kernel,
        `push failed (${push.stderr.trim() || `git push exit ${push.code}`}); the branch and claim were kept`,
        version,
        { ...claimPayload, pushed: false },
      )
    }
    pushed = true
  }
  progress.pushed = pushed

  // A throw here (e.g. a broken envelope builder) is caught by nativeStart and
  // reported with the committed claim receipt intact.
  progress.stage = "response"
  return {
    ok: true,
    envelope: kernel.successEnvelope("start", { ...claimPayload, pushed }, version),
  }
}

/** `branch` (native): record the convention branch name on an item (kernel bookkeeping; the worktree owns the git branch). */
function nativeBranch(
  kernel: ArgonKernel,
  input: Record<string, unknown>,
  options: ArgonToolOptions,
): { ok: boolean; envelope: Record<string, unknown> } {
  const id = asString(input.id)
  if (id === undefined) return worktreeFail(kernel, "branch", "BRANCH_FAILED", "id is required")
  let root: string
  try {
    root = sessionRoot(kernel, options.cwd)
  } catch (error) {
    return worktreeFail(kernel, "branch", "BRANCH_FAILED", detail(error))
  }
  const version = kernel.readConventionVersion(root)
  const show = kernel.showOperation({ cwd: options.cwd, id, meta: true })
  if (!show.ok) return remapFailure(show.envelope, "branch", "BRANCH_FAILED")
  const branch = itemBranch(kernel, root, (show.envelope.item ?? {}) as Record<string, unknown>, input.branch)
  const update = kernel.updateOperation({ cwd: options.cwd, id, branch, agent: true })
  if (!update.ok) return remapFailure(update.envelope, "branch", "BRANCH_FAILED")
  return {
    ok: true,
    envelope: kernel.successEnvelope(
      "branch",
      {
        id,
        branch,
        item: update.envelope.item,
        ...(update.envelope.commit !== undefined ? { commit: update.envelope.commit } : {}),
      },
      version,
    ),
  }
}

/** Domain-backed worktree inventory (refresh first: `list` reads saved state only). */
async function domainWorktrees(options: ArgonToolOptions): Promise<string[]> {
  const domain = options.worktree?.domain
  const projectID = asString(options.worktree?.projectID)
  if (domain?.list === undefined || projectID === undefined) return []
  try {
    if (domain.refresh !== undefined) await domain.refresh({ projectID })
    const entries = await domain.list({ projectID })
    if (!Array.isArray(entries)) return []
    return entries
      .map((entry) => asString((entry as { directory?: unknown } | undefined)?.directory))
      .filter((directory): directory is string => directory !== undefined)
  } catch (error) {
    logOnce("worktree-list", "worktree domain inventory failed", error)
    return []
  }
}

/** `docker compose down` timeout (the CLI's bound, so both surfaces wait alike). */
const COMPOSE_DOWN_TIMEOUT_MS = 120_000

/**
 * One Compose teardown for the native cleanup prune — the twin of the CLI's
 * `ComposeDown` seam (`cli/src/cleanup.ts`), same command shape (ADR 0019
 * layer 2): `docker compose -p <project> down -v --remove-orphans` as an argv
 * array, cwd = the repo root (no Compose file is needed — `down` resolves the
 * project through the containers' `com.docker.compose.project` labels, so an
 * already-gone project exits 0 with only a "No resource found to remove"
 * warning: the no-op needs no probing).
 *
 * Contract, deliberately identical to the CLI's: a rejection whose `code` is
 * `"ENOENT"` means the docker CLI is absent and degrades the WHOLE run to
 * report-only; every other rejection is a per-item reap failure that never
 * blocks the worktree removal. The message text matches the CLI's byte for
 * byte (same prefix, same `stderr`-then-`(message)` fallback) so both prune
 * envelopes stay comparable.
 */
function nativeComposeDown(project: string, cwd: string): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = execFile(
      "docker",
      ["compose", "-p", project, "down", "-v", "--remove-orphans"],
      {
        cwd,
        encoding: "utf8",
        timeout: COMPOSE_DOWN_TIMEOUT_MS,
        // execFileSync's 1 MiB default, stated explicitly: an oversized stderr
        // must truncate the same way on both surfaces.
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
      (error, _stdout, stderr) => {
        if (error === null) {
          resolvePromise()
          return
        }
        // Absent docker CLI: reject untouched — the ENOENT `code` IS the
        // report-only signal the prune loop keys on.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          rejectPromise(error)
          return
        }
        const detailText = String(stderr ?? "").trim()
        const message = error instanceof Error ? error.message : String(error)
        rejectPromise(
          new Error(
            `docker compose -p ${project} down -v --remove-orphans failed` +
              (detailText ? `: ${detailText}` : ` (${message})`),
          ),
        )
      },
    )
    // `down` never reads stdin; ending the pipe right away keeps a stray read
    // from parking the teardown until the timeout (what the CLI's
    // `stdio: ["ignore", …]` buys there).
    child.stdin?.end()
  })
}

/**
 * `cleanup` (native): classify every item with a `worktree_path` record with
 * the shared kernel rule (`classifyCleanupEntry`, the same one the CLI uses)
 * and, with `prune: true`, reap each removable entry's declared per-worktree
 * Compose project (ADR 0019 layer 2 — only when the repo's convention declares
 * `x-worktree.services`), remove removable worktrees through the domain
 * (observed, with a git fallback — the same primitive the start rollback uses),
 * then delete their merged branches and clear the records in ONE tracker commit.
 * A removal that is not observably complete reports a per-candidate failure
 * and preserves both the branch and the record.
 * Skips (non-terminal item, unmerged branch, missing/foreign path) are
 * reported, never touched.
 *
 * `release: <id>` takes the OTHER arm of the worktree domain: the inverse of
 * `start` for a claim that was dropped (bug-unclaim-leaves-worktree-record-
 * without-reaper). It classifies ONE item with the shared release rule
 * (`classifyReleaseEntry`, the same one the CLI uses), removes the worktree
 * through the domain, deletes its branch, reaps the start-created env file and
 * the claim stamp, and clears the record — reported as its own `release` /
 * `released` action family, never mixed into `pruned`. Refused with the same
 * evidence and remedy order the CLI reports: unconditionally while the item is
 * still claimed (a re-claimed item has a live owner; the hatch does not bypass
 * it), and for a stamp held by another identity whose window shows a live writer
 * or for removal-blocking content. `take_over_worktree` is the audited hatch for
 * a presumed-dead stamped owner — the mirror of `start`'s, and the only thing
 * that forces the removal; without a `release` it is refused (m5). The identity
 * is the calling session — exactly what `start` stamped — so the ordinary path
 * is never refused.
 */
async function nativeCleanup(
  kernel: ArgonKernel,
  input: Record<string, unknown>,
  options: ArgonToolOptions,
  tool?: ArgonToolCallContext,
): Promise<{ ok: boolean; envelope: Record<string, unknown> }> {
  let root: string
  try {
    root = sessionRoot(kernel, options.cwd)
  } catch (error) {
    return worktreeFail(kernel, "cleanup", "CLEANUP_FAILED", detail(error))
  }
  const version = kernel.readConventionVersion(root)
  const git = kernel.defaultCleanupGit()
  if (!git.isRepo(root)) {
    return worktreeFail(kernel, "cleanup", "CLEANUP_FAILED", `not a git repository (${root}); cleanup needs git`, version)
  }
  let base: string
  try {
    base = git.defaultBranch(root)
  } catch (error) {
    return worktreeFail(kernel, "cleanup", "CLEANUP_FAILED", detail(error), version)
  }

  const tasksDir = kernel.findTasksDir(options.cwd)
  const byId = kernel.itemsById(kernel.loadItems(tasksDir))
  const tracked = [...byId.values()]
    .filter((item) => (item.worktreePath ?? null) !== null)
    .sort((a, b) => a.id.localeCompare(b.id))

  const releaseId = asString(input.release)
  if (releaseId !== undefined && input.prune === true) {
    // Same refusal as the CLI: two reapers (an abandoned claim vs finished
    // work), never one item in one run.
    return worktreeFail(
      kernel,
      "cleanup",
      "CLEANUP_FAILED",
      "pass either release or prune, not both",
      version,
    )
  }
  if (releaseId === undefined && input.take_over_worktree === true) {
    // The hatch authorizes a release; without one it is a silent no-op (m5).
    // `start` already refuses its twin without `worktree`, and so does this.
    return worktreeFail(
      kernel,
      "cleanup",
      "CLEANUP_FAILED",
      "take_over_worktree requires release (it authorizes a release of a worktree whose stamped owner is presumed dead)",
      version,
    )
  }

  const inventory = await domainWorktrees(options)
  const runner = {
    ...git,
    // The domain inventory is the native source; git's list is the fallback
    // (e.g. a worktree the domain has not refreshed yet).
    worktreeList: (cwd: string): string[] =>
      inventory.length > 0 ? inventory : git.worktreeList(cwd),
  }
  // A release run classifies ONE item (the named one): the survey path stays
  // out of it, so `candidates` keeps meaning "prunable work".
  const entries =
    releaseId === undefined
      ? tracked.map((item) =>
          kernel.classifyCleanupEntry(item, root, base, runner, { noGh: input.no_gh === true }),
        )
      : []

  const pruned: Array<Record<string, unknown>> = []
  const failures: string[] = []
  const clearedPaths: string[] = []
  const clearedIds: string[] = []
  // Compose reaping declaration (ADR 0019 layer 2), read once with the CLI's
  // discipline: a malformed convention file degrades to the report-only path
  // (no declaration), because never reaping is always safe and validate/start
  // already report the tree's convention error loudly.
  let services: string | null = null
  try {
    services = kernel.readConventionConfig(root).worktree.services
  } catch {
    services = null
  }
  const compose: { declared: string; dockerUnavailable?: boolean } | undefined = services
    ? { declared: services }
    : undefined
  let composeUnavailable = false
  if (input.prune === true) {
    for (const entry of entries.filter((candidate) => candidate.removable)) {
      // Reap BEFORE the worktree removal — the stack that lives only for the
      // run dies with the worktree (exploration 017 F8). Only a repo whose
      // convention declares services ever reaches Docker; the kernel never
      // probes for or invokes Docker the convention did not declare.
      if (compose !== undefined && entry.path !== "" && !composeUnavailable) {
        // The worktree id is the worktree directory's basename
        // (`<repo>-<item-id>` — the value `ARGGON_WORKTREE_ID` carries), so the
        // derivation needs no repo-name resolution of its own.
        const project = kernel.worktreeComposeProject(compose.declared, basename(entry.path))
        try {
          await nativeComposeDown(project, root)
          pruned.push({ id: entry.id, action: `reaped compose project ${project}` })
        } catch (error) {
          if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
            // Absent docker CLI: report once, degrade the whole run to the
            // report-only path. Not a failure — the ADR's graceful no-op.
            composeUnavailable = true
            compose.dockerUnavailable = true
          } else {
            // Non-fatal, and reported on BOTH surfaces (the structured `pruned`
            // action AND the flat `failures` list, which would otherwise read
            // as a clean run): a failed reap never wedges the removal below.
            const message = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)
            failures.push(`${entry.id}: ${message}`)
            pruned.push({ id: entry.id, action: "failed", error: message })
          }
        }
      }
      try {
        if (entry.action?.startsWith("remove worktree")) {
          // CLI parity: a start-created `node_modules` link is untracked and
          // git refuses to remove a worktree that carries it, so unlink it
          // first — the kernel helper only removes a symlink pointing at the
          // canonical (or current) checkout's install, never a real directory.
          const canonical = canonicalRoot(options, root)
          kernel.unlinkNodeModulesLink(canonical, entry.path)
          if (resolve(canonical) !== resolve(root)) {
            kernel.unlinkNodeModulesLink(root, entry.path)
          }
          // Same parity for the env contract file (spec
          // worktree-env-contract-016): untracked, blocks the removal, and
          // only start-created shape (the six KEY=value lines) is removed.
          kernel.unlinkWorktreeEnv(entry.path)
          // The SAME observed removal the start rollback uses, without its force
          // policy: a dirty worktree must still be refused by git (bug-native-
          // cleanup-unverified-worktree-removal).
          const removal = await removeWorktreeObserved(options, entry.path, root, {
            force: false,
          })
          if (!removal.removed) {
            // A domain that resolves without removing (or a failing domain plus
            // a failing git fallback) is never reported as a removal: keep the
            // branch, keep the record, and name the leftover path.
            const message = boundedNativeText(removal.errors.join("; "), MAX_NATIVE_DETAIL_CHARS)
            failures.push(`${entry.id}: ${message}`)
            pruned.push({
              id: entry.id,
              action: "failed",
              error: message,
              leftoverPath: entry.path,
              ...(entry.branch !== null ? { leftoverBranch: entry.branch } : {}),
              ...(entry.via !== undefined ? { via: entry.via } : {}),
            })
            continue
          }
          pruned.push({
            id: entry.id,
            action: `removed worktree ${entry.path}`,
            ...(entry.via !== undefined ? { via: entry.via } : {}),
          })
        }
        if (entry.branch !== null && git.branchExists(root, entry.branch)) {
          try {
            // Squash-merged entries need -D: their tip is not an ancestor of
            // base (that is why the PR lookup ran).
            if (entry.via !== undefined) git.deleteBranchForce(root, entry.branch)
            else git.deleteBranch(root, entry.branch)
            pruned.push({
              id: entry.id,
              action: `deleted branch ${entry.branch}`,
              ...(entry.via !== undefined ? { via: entry.via } : {}),
            })
          } catch (error) {
            // A branch delete that fails after the worktree is gone is still a
            // failure the caller must see, on BOTH surfaces: the structured
            // `pruned` action AND the flat `failures` list, which would
            // otherwise read as a clean run
            // (bug-native-cleanup-branch-delete-missing-failure).
            const message = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)
            failures.push(`${entry.id}: ${message}`)
            pruned.push({
              id: entry.id,
              action: "failed",
              error: message,
              leftoverBranch: entry.branch,
            })
          }
        }
        const cleared = kernel.updateOperation({
          cwd: root,
          id: entry.id,
          worktreePath: "",
          commit: false,
          agent: true,
        })
        if (!cleared.ok) throw new Error(kernelError(cleared.envelope))
        pruned.push({ id: entry.id, action: "cleared worktree_path" })
        clearedPaths.push(byId.get(entry.id)!.filePath)
        clearedIds.push(entry.id)
      } catch (error) {
        // Same bound as the branch-delete catch above, on BOTH surfaces
        // (bug-native-cleanup-worktree-failure-unbounded).
        const message = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)
        failures.push(`${entry.id}: ${message}`)
        pruned.push({ id: entry.id, action: "failed", error: message })
      }
    }
  }

  // The release arm (bug-unclaim-leaves-worktree-record-without-reaper): the
  // inverse of `start --worktree` for a dropped claim. It shares the Compose
  // declaration and the cleared-record commit with prune and NOTHING else —
  // different premise, different safety, different action family.
  const release =
    releaseId === undefined
      ? undefined
      : await nativeRelease(kernel, {
          id: releaseId,
          root,
          byId,
          git,
          runner,
          input,
          options,
          sessionID: tool?.sessionID,
          compose,
          isComposeUnavailable: () => composeUnavailable,
          failures,
        })

  // One tracker commit for every cleared record (surgical staging; the kernel
  // resolves `x-tracker.auto-commit`), exactly like `cleanup --prune` — and the
  // release's OWN commit wins when it has one (review M3: letting the run-level
  // commit re-stage the path the release already committed reported
  // `skipped: "nothing to commit"` for a commit it had just made). CLI parity.
  let commit: unknown = release?.commit
  if (commit === undefined && clearedPaths.length > 0) {
    commit = kernel.commitTrackerMutation(root, clearedPaths, {
      message: kernel.trackerCommitMessage("pruned", clearedIds),
      commit: kernel.resolveAutoCommit(
        input.no_commit === true ? false : undefined,
        kernel.readAutoCommitConfig(root),
      ),
    })
  }

  return {
    ok: true,
    envelope: kernel.successEnvelope(
      "cleanup",
      {
        base,
        candidates: entries,
        pruned,
        ...(release !== undefined ? { release: release.entry, released: release.actions } : {}),
        failures,
        ...(compose !== undefined ? { compose } : {}),
        ...(commit !== undefined ? { commit: kernel.commitPayload(commit as never) } : {}),
      },
      version,
    ),
  }
}

/** What `nativeRelease` needs from the run it hangs off. */
type NativeReleaseRun = {
  id: string
  root: string
  byId: ReturnType<ArgonKernel["itemsById"]>
  git: ReturnType<ArgonKernel["defaultCleanupGit"]>
  runner: CleanupGitShape
  input: Record<string, unknown>
  options: ArgonToolOptions
  /** The calling session id — the identity `start` stamped (sessionToken-form). */
  sessionID?: unknown
  compose: { declared: string; dockerUnavailable?: boolean } | undefined
  isComposeUnavailable: () => boolean
  failures: string[]
}

/** The `CleanupGit` shape the native runner supplies (git plus the domain list). */
type CleanupGitShape = ReturnType<ArgonKernel["defaultCleanupGit"]>

/**
 * Native release of one item's claim footprint
 * (bug-unclaim-leaves-worktree-record-without-reaper) — the CLI twin of
 * `cli/src/cleanup.ts`'s `releaseClaimedWorktree`, step for step: same kernel
 * classification (`classifyReleaseEntry`), same Compose-first ordering, same
 * ownership-scoped reaping (install link, start-shaped env file, claim stamp),
 * same observed domain removal, same force branch delete, same record clear and
 * same both-surfaces failure reporting. The identity is the calling session —
 * what `start` stamped — with the item's assignee as the fallback when the
 * runtime supplies no session id.
 */
async function nativeRelease(
  kernel: ArgonKernel,
  run: NativeReleaseRun,
): Promise<{
  entry: Record<string, unknown>
  actions: Array<Record<string, unknown>>
  /** The cleared-record commit this run owns (review M3) — never re-committed by the caller. */
  commit?: unknown
}> {
  const { id, root, byId, git, runner, input, options, failures } = run
  const actions: Array<Record<string, unknown>> = []
  const refuse = (reason: string, entry: Record<string, unknown>) => {
    // Clamped like every sibling failure path (m9): the refusals embed paths and
    // the envelope is a machine surface.
    const message = boundedNativeText(reason, MAX_NATIVE_DETAIL_CHARS)
    failures.push(`${id}: ${message}`)
    actions.push({ id, action: "failed", error: message })
    return { entry: { ...entry, reason: message }, actions }
  }
  const item = byId.get(id)
  if (item === undefined) {
    const reason = `id '${id}' not found under the tracker`
    return refuse(reason, {
      id,
      status: "unknown",
      branch: null,
      path: "",
      releasable: false,
      reason,
      action: null,
    })
  }
  const identity = sessionToken(run.sessionID) ?? asString(item.assignee) ?? ""
  const classified = kernel.classifyReleaseEntry(item, root, runner, {
    identity,
    ...(input.take_over_worktree === true ? { takeOver: true } : {}),
  })
  const entry = classified as unknown as Record<string, unknown>
  if (classified.releasable !== true) {
    return refuse(asString(classified.reason) ?? "release refused", entry)
  }
  const path = classified.path
  // Every git call below runs from the canonical (main) worktree: `git worktree
  // list` puts it first, and the native root is the SESSION's location — which
  // is the worktree being released whenever the claiming session works in it.
  const gitRoot = resolve(git.worktreeList(root)[0] ?? root)
  // The record outlives the removal exactly when this run's tracker copy is not
  // the worktree being released (a claim made through `start` is recorded in
  // THAT worktree copy, so releasing it disposes the record with the directory —
  // nothing to write, and no commit could outlive the removal).
  const recordHome = resolve(root) !== resolve(path)

  try {
    if (classified.action !== "clear stale worktree_path record (path missing on disk)") {
      // Compose first (ADR 0019 layer 2, exploration 017 F8); an absent docker
      // CLI degrades the run report-only, exactly as in the prune loop.
      if (run.compose !== undefined && !run.isComposeUnavailable()) {
        const project = kernel.worktreeComposeProject(run.compose.declared, basename(path))
        try {
          await nativeComposeDown(project, root)
          actions.push({ id, action: `reaped compose project ${project}` })
        } catch (error) {
          if ((error as NodeJS.ErrnoException | null)?.code !== "ENOENT") throw error
          run.compose.dockerUnavailable = true
        }
      }
      // CLI parity: the start-created install link and the start-shaped env
      // file are untracked and block the removal; ownership-scoped removal only
      // (never a real directory, never an adopter's own file). The env contract
      // has to go BEFORE the removal or git refuses the worktree.
      kernel.unlinkNodeModulesLink(gitRoot, path)
      if (gitRoot !== resolve(root)) kernel.unlinkNodeModulesLink(root, path)
      kernel.unlinkWorktreeEnv(path)
      // Did this worktree carry a claim stamp? Read BEFORE the removal:
      // `git worktree remove` takes the worktree's git dir (and the stamp in it)
      // with it, so only the post-removal reap below matters for a DOMAIN
      // removal (it never touches `.git/worktrees/<name>`). CLI parity.
      const hadStamp = kernel.readWorktreeClaimStamp(path) !== null
      // Uncommitted work is never discarded silently. The classification already
      // refused removal-blocking content unless the take-over hatch was armed
      // (the dirty gate, CLI parity), so forcing here is exactly the caller's
      // "that owner is dead and that work is disposable" — the only case.
      // Uncommitted work is never discarded silently. The classification already
      // refused removal-blocking content unless the take-over hatch was armed
      // (the dirty gate, CLI parity), so forcing here is exactly the caller's
      // "that owner is dead and that work is disposable" — the only case.
      const removal = await removeWorktreeObserved(options, path, gitRoot, {
        force: input.take_over_worktree === true,
      })
      if (!removal.removed) {
        const message = boundedNativeText(removal.errors.join("; "), MAX_NATIVE_DETAIL_CHARS)
        failures.push(`${id}: ${message}`)
        actions.push({ id, action: "failed", error: message, leftoverPath: path })
        return { entry, actions }
      }
      actions.push({ id, action: `removed worktree ${path}` })
      // AFTER the observed removal, never before (CLI parity): the claim stamp is
      // the single-writer evidence, and a failed removal must leave it standing.
      // A domain removal never touches the git dir, so the stamp is reaped
      // explicitly here — an OBSERVABLE step, not an accident of git's
      // bookkeeping.
      // Both outcomes are reported, because both are the invariant "no stamp
      // survives a release": either this run removed the file, or the removal
      // took it with the worktree.
      if (kernel.unlinkWorktreeClaimStamp(path)) {
        actions.push({ id, action: "reaped arggon-claim.json stamp" })
      } else if (hadStamp) {
        actions.push({ id, action: "arggon-claim.json stamp gone with the worktree" })
      }
      if (classified.branch !== null && git.branchExists(gitRoot, classified.branch)) {
        try {
          // Force, never the safe delete: an abandoned claim's branch is by
          // definition not provably merged (that is prune's eligibility), and
          // the release is already an explicit, refusal-gated discard.
          git.deleteBranchForce(gitRoot, classified.branch)
          actions.push({ id, action: `deleted branch ${classified.branch}` })
        } catch (error) {
          const message = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)
          failures.push(`${id}: ${message}`)
          actions.push({
            id,
            action: "failed",
            error: message,
            leftoverBranch: classified.branch,
          })
        }
      }
    }
    if (recordHome) {
      // The record outlives the removal here: cleared AFTER the worktree is
      // observably gone (prune's invariant), in ONE tracker commit — which this
      // run OWNS and RETURNS (review M3: committing here and then letting the
      // run-level commit stage the same path reported `skipped: "nothing to
      // commit"` for a commit it had just made).
      const cleared = kernel.updateOperation({
        cwd: root,
        id,
        worktreePath: "",
        commit: false,
        agent: true,
      })
      if (!cleared.ok) throw new Error(kernelError(cleared.envelope))
      actions.push({ id, action: "cleared worktree_path" })
      const commit = kernel.commitTrackerMutation(root, [item.filePath], {
        message: kernel.trackerCommitMessage("released", [id]),
        commit: kernel.resolveAutoCommit(
          input.no_commit === true ? false : undefined,
          kernel.readAutoCommitConfig(root),
        ),
      })
      return { entry, actions, commit }
    }
    // The record lived inside the removed copy: disposed with it, nothing to
    // write (a commit here could not outlive the removal).
    actions.push({ id, action: "disposed worktree_path record with the worktree" })
    return { entry, actions }
  } catch (error) {
    const message = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)
    failures.push(`${id}: ${message}`)
    actions.push({ id, action: "failed", error: message })
    return { entry, actions }
  }
}

/** Error message of a kernel failure envelope (for the cleanup failure list). */
function kernelError(envelope: Record<string, unknown>): string {
  const error =
    envelope.error !== null && typeof envelope.error === "object"
      ? (envelope.error as { message?: unknown })
      : undefined
  return asString(error?.message) ?? "unknown kernel failure"
}

/**
 * Worktree-domain tools (W4): `start`, `branch`, `cleanup`. Inputs mirror the
 * CLI surface where the native path supports it; outputs are `--json`-shaped
 * envelopes with the native fields documented in the agent playbook and
 * OpenCode playbook (the dependency contract in `ArggonManager/docs/agents.md`
 * and `ArggonManager/docs/playbooks/opencode.md`).
 */
const WORKTREE_TOOL_SPECS: ArgonToolSpec[] = [
  {
    name: "start",
    description:
      "Claim an item and create its worktree through the worktree domain, recording branch + worktree_path. Never steals a claim.",
    input: {
      type: "object",
      properties: {
        id: ID,
        assignee: { type: "string" },
        branch: { type: "string" },
        worktree: BOOLEAN,
        push: BOOLEAN,
        takeOverWorktree: {
          type: "boolean",
          description:
            "Take over a presumed-dead stamped owner (CLI --take-over-worktree). Default OFF; requires worktree; acts only when the single-writer detection fired.",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    // Bare output schema on purpose: the definitions payload sits at the
    // ADR 0006 advisory bound (`context:report --strict`) and the runtime drops
    // catalog entries past its own ~2000-token budget, so the three worktree
    // tools stay as lean as their contract allows. Their payload fields are
    // documented in ArggonManager/docs/agents.md + playbooks/opencode.md and
    // asserted by the contract tests; the loose envelope never rejects a valid payload.
    output: OBJECT,
    run: (kernel, input, options, tool) =>
      guarded(kernel, "start", "START_FAILED", () => nativeStart(kernel, input, options, tool)),
  },
  {
    name: "branch",
    description:
      "Record the convention branch name (branch_patterns) on an item; the item worktree owns the git branch.",
    input: {
      type: "object",
      properties: { id: ID, branch: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    output: OBJECT,
    run: (kernel, input, options) =>
      guarded(kernel, "branch", "BRANCH_FAILED", async () => nativeBranch(kernel, input, options)),
  },
  {
    name: "cleanup",
    description:
      "List (prune: true removes) worktrees of done/cancelled items whose branches are merged; clears worktree_path. release: <id> instead releases one dropped claim (inverse of start).",
    input: {
      type: "object",
      properties: {
        prune: BOOLEAN,
        release: ID,
        take_over_worktree: BOOLEAN,
        no_gh: {
          type: "boolean",
          description: "Ancestry-only (skip the squash-merged PR lookup).",
        },
        no_commit: BOOLEAN,
      },
      additionalProperties: false,
    },
    output: OBJECT,
    run: (kernel, input, options, tool) =>
      guarded(kernel, "cleanup", "CLEANUP_FAILED", () =>
        nativeCleanup(kernel, input, options, tool),
      ),
  },
]

/** Kernel tools + worktree-domain tools (the complete `arggon` namespace). */
const ALL_TOOL_SPECS: ArgonToolSpec[] = [...TOOL_SPECS, ...WORKTREE_TOOL_SPECS]

/** Name/description/schemas of every native tool (kernel-free; measurement/tests). */
export function nativeToolSchemas(): Array<{
  name: string
  description: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  pinned: boolean
}> {
  return ALL_TOOL_SPECS.map((spec) => ({
    name: spec.name,
    description: spec.description,
    input: spec.input,
    output: spec.output,
    pinned: PINNED_TOOL_NAMES.includes(spec.name),
  }))
}

/**
 * Tool-definition payload the Code Mode catalog is built from, as JSON bytes:
 * the namespace entry plus one definition per tool. `smoke/context-report.ts`
 * re-measures the ADR 0006 tool-schema surface with it — the runtime renders
 * these definitions as catalog lines (one per tool, description clipped to its
 * first 120 characters), so this is the stable, runtime-free measurement.
 */
export function nativeToolsCatalogBytes(): number {
  return byteLength(
    JSON.stringify({
      namespace: { name: ARGON_TOOL_NAMESPACE, description: ARGON_TOOL_NAMESPACE_DESCRIPTION },
      tools: nativeToolSchemas(),
    }),
  )
}

/**
 * Build the executable tool definitions over one loaded kernel. Failure
 * mapping lives here, once: a kernel `ok: false` becomes an `ArgonToolError`
 * (typed tool error) and a success returns the envelope as the tool output so
 * a Code Mode script receives the contract object.
 */
export function argonToolDefinitions(
  kernel: ArgonKernel,
  options: ArgonToolOptions,
): ArgonToolDefinition[] {
  return ALL_TOOL_SPECS.map((spec) => ({
    name: spec.name,
    description: spec.description,
    input: spec.input,
    output: spec.output,
    execute: async (input, tool) => {
      // The tracker root is resolved per CALL from the calling session, so a
      // session that moved into a worktree reads and commits there. A value
      // captured at setup would stay pinned to the plugin instance's location
      // and land every commit on the primary checkout's branch
      // (bug-native-tools-commit-to-primary-checkout).
      const resolved = await resolveToolCwd(kernel, spec.name, options, tool)
      if ("error" in resolved) throw resolved.error
      const callOptions =
        resolved.cwd === options.cwd ? options : { ...options, cwd: resolved.cwd }
      const outcome = await spec.run(kernel, input ?? {}, callOptions, tool)
      const envelope = outcome.envelope as Record<string, unknown>
      if (!outcome.ok) throw new ArgonToolError(envelope)
      return { output: envelope }
    },
  }))
}

/**
 * Fallback item-templates dir for `create`/`import-issues` (ADR 0013),
 * resolved from the plugin file itself: `opencode/plugins/arggon/index.ts` in
 * this repo and `.opencode/plugins/arggon/index.ts` in an adopter tree both
 * walk up three levels to the package/repo root, where `templates/` lives. The
 * W3 single-file bundle keeps the same layout. A missing dir is harmless — the
 * kernel prefers the repo's own `templates/` first.
 */
export function pluginTemplatesDir(moduleUrl: string = import.meta.url): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..", "..", "..", "templates")
}

let kernelPromise: Promise<ArgonKernel | undefined> | undefined

/** Registration log dedupe: the editor callback replays on every rebuild. */
let toolsRegistrationLogged = false

/**
 * Guarded, cached kernel import (ADR 0013). The specifier is literal on
 * purpose: the W3 bundle build rewrites it to the **inlined** kernel module
 * (`cli/src/plugin-bundle.ts`), so the vendored single file needs no
 * `node_modules`; loading this source directly from this repo resolves the
 * workspace package. Without either, it logs once, returns undefined and the
 * ambient paths keep working. Never cached on rejection.
 */
export function loadArgonKernel(): Promise<ArgonKernel | undefined> {
  kernelPromise ??= import("@arggondev/lib").then(
    (module) => module as ArgonKernel,
    (error: unknown) => {
      logOnce("kernel-import", "@arggondev/lib unavailable (native tools idle)", error)
      return undefined
    },
  )
  return kernelPromise
}

/**
 * Register the native namespace with `ctx.tool.transform` (feature-detected,
 * failure-isolated). Returns the number of definitions submitted, or 0 when
 * the kernel or the transform surface is unavailable.
 *
 * The editor callback is replayed by the runtime on every registry rebuild
 * (observed on 2.0.10: `await transform(...)` resolves before the callback
 * runs), so per-add success is only known when it runs — failures are logged
 * once and never propagate, and the one-time registration log fires on the
 * first successful replay.
 */
export async function registerArgonTools(
  ctx: PluginContext,
  options: ArgonToolOptions,
): Promise<number> {
  const kernel = await loadArgonKernel()
  if (kernel === undefined) return 0
  const transform = ctx?.tool?.transform
  if (typeof transform !== "function") return 0
  const definitions = argonToolDefinitions(kernel, options)
  await transform((editor) => {
    if (typeof editor.namespace !== "function" || typeof editor.add !== "function") return
    try {
      editor.namespace({
        name: ARGON_TOOL_NAMESPACE,
        description: ARGON_TOOL_NAMESPACE_DESCRIPTION,
      })
    } catch (error) {
      logOnce("tools-namespace", "native namespace registration failed", error)
    }
    let added = 0
    for (const definition of definitions) {
      try {
        editor.add({
          ...definition,
          options: {
            namespace: ARGON_TOOL_NAMESPACE,
            codemode: true,
            ...(PINNED_TOOL_NAMES.includes(definition.name) ? { pinned: true } : {}),
          },
        })
        added += 1
      } catch (error) {
        logOnce("tools-add", `native tool registration failed (${definition.name})`, error)
      }
    }
    if (added > 0 && !toolsRegistrationLogged) {
      toolsRegistrationLogged = true
      console.error(
        `[arggon] tools: registered ${added} native ${ARGON_TOOL_NAMESPACE} tools ` +
          `(namespace="${ARGON_TOOL_NAMESPACE}": ${ARGON_TOOL_NAMESPACE_DESCRIPTION})`,
      )
    }
  })
  return definitions.length
}

// ---------------------------------------------------------------------------
// V2 plugin definition
// ---------------------------------------------------------------------------

const definition: PluginDefinition = {
  id: "arggon",
  async setup(ctx) {
    const disposers: Array<() => void> = []
    try {
      // Native tools (W2) + worktree domain tools (W4): the namespace is
      // registered per plugin instance, bound to this instance's location
      // directory and (feature-detected) its worktree domain + project id.
      const directory = locationDirectory(ctx)
      if (directory !== undefined) {
        await registerArgonTools(ctx, {
          cwd: directory,
          sessionDirectory: sessionDirectoryResolver(ctx),
          templatesDir: pluginTemplatesDir(),
          worktree: worktreeOptions(ctx),
        })
      }
    } catch (error) {
      logOnce("tools", "native tool registration unavailable", error)
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

// W5 (task-native-tui): the board/status surface is kernel-backed display data
// (`board.ts`, inlined into this bundle like the rest of the kernel) and the
// TUI entry (`tui.tsx`) consumes it through these named exports. The TUI loads
// the VENDORED copy of this file (`./index.ts` in `.opencode/plugins/arggon/`),
// so the bundle must re-export the board surface — see `tui.tsx` and
// `cli/src/plugin-bundle.ts` (the emitted wrapper forwards every named export).
export {
  ARGON_BOARD_PANEL,
  BOARD_DETAIL_MAX_LINE_CHARS,
  BOARD_DETAIL_MAX_ROWS,
  BOARD_SELECTION_MARK,
  BOARD_SELECTION_PAGE,
  BOARD_STATUS_MARKS,
  BOARD_STATUS_ORDER,
  BOARD_TYPE_BADGES,
  activeBoardId,
  boardCountsLine,
  boardDetailLines,
  boardHeaderLine,
  boardItemDetail,
  boardItemLine,
  boardRoot,
  boardSnapshot,
  boardTreeEntries,
  boardTreeLines,
  clipBoardLine,
  countBoardStatuses,
  emptyBoardSelection,
  emptyBoardSnapshot,
  moveBoardSelection,
  resolveBoardSelection,
  selectBoardItem,
  sidebarStatusLine,
} from "./board.js"
export type {
  BoardActiveInput,
  BoardItem,
  BoardItemDetail,
  BoardSelection,
  BoardSelectionMove,
  BoardSnapshot,
  BoardTreeEntry,
  BoardTreeOptions,
} from "./board.js"

// `Plugin.define` from `@opencode/plugin` is deliberately not imported: a
// static import fails to load an auto-discovered plugin in a dependency-less
// adopter tree (probes on 2.0.7/2.0.8/2.0.10/2.0.12, docs/playbooks/opencode.md), and
// the guarded sugar needed a top-level await the single-file bundle cannot
// carry. The plain definition object is a valid V2 plugin definition and loads
// identically.
export default definition
