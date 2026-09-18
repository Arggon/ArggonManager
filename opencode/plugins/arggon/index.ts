/**
 * ArggonManager OpenCode V2 plugin — W2 scope: MCP auto-registration only.
 *
 * `arggon init` bundles this file to `.opencode/plugins/arggon/index.ts`, where
 * OpenCode V2 discovers it with zero configuration. The plugin contributes one
 * ambient behavior: when no MCP server named `arggon` is configured, it
 * registers `{ type: "local", command: ["arggon", "mcp"] }` through
 * `ctx.mcp.transform`. A server already configured by the adopter (or by the
 * generated `opencode.jsonc` seam) is never touched.
 *
 * Contract (ADR 0010, plan-opencode2-009 T6–T8):
 * - Optional and failure-isolated: every path is feature-detected and wrapped,
 *   a failure logs once and no-ops; the plugin must never break a session, the
 *   CLI or the MCP server.
 * - Thin: no rules, no tools, no commands, no session hooks. Session↔item
 *   context is W3 scope, deliberately not implemented here.
 * - Dependency-free: `Plugin.define` from `@opencode/plugin` is optional sugar.
 *   A local `node_modules` (or a runtime that resolves the package) is NOT
 *   required — the plain default export below is a valid V2 plugin definition
 *   and loads on OpenCode 2.0.7 without it. The guarded dynamic import keeps
 *   the documented `Plugin.define` form on runtimes that provide it.
 */

/** Minimal structural typing: the generated file must not import plugin types. */
type McpLocalServer = { type: "local"; command: string[] }

type McpEditor = {
  get(name: string): unknown
  set(name: string, config: McpLocalServer): void
}

type PluginDefinition = {
  id: string
  setup(ctx: {
    mcp?: { transform?: (callback: (editor: McpEditor) => void) => Promise<unknown> }
  }): Promise<void>
}

const ARGGON_SERVER = "arggon"
const ARGGON_MCP: McpLocalServer = { type: "local", command: ["arggon", "mcp"] }

/** Log at most once per process: a broken plugin must stay quiet and inert. */
let logged = false
function logOnce(message: string, error: unknown): void {
  if (logged) return
  logged = true
  const detail = error instanceof Error ? error.message : String(error)
  console.error(`[arggon] ${message}: ${detail}`)
}

const definition: PluginDefinition = {
  id: "arggon",
  async setup(ctx) {
    try {
      const transform = ctx?.mcp?.transform
      if (typeof transform !== "function") return // older runtime: nothing to do
      await transform((editor) => {
        try {
          if (typeof editor?.get !== "function" || typeof editor?.set !== "function") return
          if (editor.get(ARGGON_SERVER) !== undefined) return // never clobber
          editor.set(ARGGON_SERVER, ARGGON_MCP)
        } catch (error) {
          logOnce("MCP registration failed", error)
        }
      })
    } catch (error) {
      logOnce("MCP auto-registration unavailable", error)
    }
  },
}

// Optional `Plugin.define` sugar, resolved defensively: a missing
// `@opencode/plugin` (no local node_modules) or a throwing runtime falls back
// to the plain definition object, which OpenCode V2 loads identically.
let define: ((input: PluginDefinition) => PluginDefinition) | undefined
try {
  const mod = (await import("@opencode/plugin")) as {
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
