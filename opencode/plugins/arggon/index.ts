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
 * Pure helpers are exported for unit tests
 * (opencode/plugins/arggon/index.test.ts); `onToolAfter` is exported so its
 * tree-guard order can be tested with a fake context. The helpers contain no
 * OpenCode dependency.
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

/** Upper bound of each in-memory cache; the oldest entry is evicted first. */
export const CACHE_MAX_ENTRIES = 256

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
 * survive escaped/quoted (`;`, `|`, `&`: `x\;arggon` is one word, never a
 * path lookup). `#`, `!` and glob characters (`*?[]`) are literal inside a
 * word — any glob expansion still ends in the pattern's final `/arggon`
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
 * (`\\arggon …`, `\\\(arggon …`, `\\\\\(arggon …`) and a quoted word that
 * begins with shell syntax (`'(/usr/local/bin/arggon' show task-x`, bash 127)
 * are syntax-error shapes too: all reduce to no command, never to `arggon`
 * (F3, PR #358 review F2). A slash-bearing word keeps its last component when
 * every component is plain path text: literal `#`/`!` and glob characters are
 * fine (`dir#x/arggon`, `'dir*x/arggon'`, `dir!x/arggon`), as are collapsed
 * empty components (`a//b/arggon`), because bash execs those paths (PR #358
 * review F1). Best effort residual: a bare `(` in argument position
 * (`\\( (arggon …)`) syntax-errors in bash but is still followed as a group,
 * like any unquoted `(` outside command position (`echo (arggon …)`,
 * `\\((arggon …))`); pinned by tests.
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
 * Extract the item id from Code Mode source calling an arggon MCP tool
 * (`tools.arggon.arggon_update({ id: "task-x" })`) or embedding a shell
 * invocation of the CLI (command-position parsing only).
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
