---
exploration_id: mcp-2026-07-28-004
title: "MCP specification 2026-07-28 — adoption options for the arggon stdio server"
status: open
created: 2026-09-15
---

# Exploration: MCP specification 2026-07-28 (mcp-2026-07-28-004)

The MCP 2026-07-28 revision is the largest protocol overhaul to date: a
stateless core, an Extensions framework, Tasks for long-running operations,
MCP Apps, multi round-trip requests, cacheable list endpoints, and tightened
authorization. ArggonManager ships a hand-rolled stdio JSON-RPC MCP server
(`cli/src/mcp-server.ts`, 9 synchronous tools, protocol versions
2024-11-05/2025-03-26/2025-06-18) that predates all of it. This exploration
maps each new capability to our surface and picks adopt / partial-adopt /
defer per capability.

## Candidates

The "candidates" here are adoption postures, not libraries:

1. **Full adopt now** — migrate the server to the 2026-07-28 core and the
   official TypeScript SDK, declare Extensions, wrap slow tools in Tasks.
2. **Partial adopt (recommended)** — keep the hand-rolled stdio server;
   add the 2026-07-28 protocol version to `initialize` negotiation; adopt
   cacheable-list hints and deterministic `tools/list` ordering; declare
   compatibility; defer Tasks/Apps/MRTR until a real long-running or
   interactive tool exists.
3. **Defer everything** — stay on 2025-06-18 and revisit when clients stop
   negotiating the old versions.

## Criteria

- **Client pressure**: do current MCP hosts (Claude Code/Codex/ZCode-style
  stdio clients) require 2026-07-28, or do they negotiate down?
- **Fit**: does the capability address a problem our server actually has?
- **Cost**: our server is deliberately hand-rolled with no SDK dependency;
  a core rewrite buys little for a local, single-user transport.
- **Risk**: breaking `initialize`/session semantics on stdio clients that
  still speak 2025-06-18.

## Findings

### What the spec changed

- **Stateless core**: the `initialize`/`initialized` handshake and
  `Mcp-Session-Id` are removed from the core; requests are self-contained
  and carry protocol version, client identity, and capabilities per request;
  an optional `server/discover` call exists for inspection (source:
  https://blog.cloudflare.com/mcp-v2/, 2026-09-15;
  https://modelcontextprotocol.io/specification/2026-07-28, 2026-09-15).
  Primary motivation is HTTP/serverless deployments (no sticky sessions).
- **Extensions framework**: beyond the core, MCP defines optional,
  explicitly negotiated extensions — Tasks, MCP Apps, Skills over MCP,
  Enterprise-Managed Authorization. Formal lifecycle Active/Deprecated/
  Removed with ≥12 months before removal (source:
  https://modelcontextprotocol.io/specification/2026-07-28, 2026-09-15;
  https://blog.cloudflare.com/mcp-v2/, 2026-09-15).
- **Tasks**: the long-running-operations story — asynchronous execution with
  polling, mid-flight input, and durable handles; moved into the Tasks
  extension (source: https://modelcontextprotocol.io/specification/2026-07-28,
  2026-09-15). Core now assumes a tool call finishes within a single
  request's lifetime (source: https://www.getclaudeskills.com/blog/mcp-tasks-extension-explained, 2026-09-15).
- **MCP Apps**: interactive UI elements (charts, forms, video players)
  rendered inline in conversations, as an extension (source:
  https://modelcontextprotocol.io/specification/2026-07-28, 2026-09-15).
- **Multi round-trip requests (MRTR)**: replaces stream-dependent
  elicitations — a server returns `input_required`; the client gathers the
  answer and retries with that input (source:
  https://blog.cloudflare.com/mcp-v2/, 2026-09-15).
- **Cacheable list endpoints**: `ttlMs` and `cacheScope` hints on
  `tools/list`, `prompts/list`, `resources/list`, `resources/read`, plus
  deterministic tool-catalog ordering for stable prompt caching (source:
  https://blog.cloudflare.com/mcp-v2/, 2026-09-15).
- **Auth tightening**: pre-registered clients preferred; Client ID Metadata
  Documents (CIMD) for dynamic registration; DCR deprecated (removal after
  summer 2027); RFC 9207 `iss`; RFC 8707 `resource` audience binding (source:
  https://blog.cloudflare.com/mcp-v2/, 2026-09-15).
- **Deprecations**: Roots, Sampling, Logging, DCR, and the legacy HTTP+SSE
  transport (source: https://blog.cloudflare.com/mcp-v2/, 2026-09-15).
- **SDKs**: updated TypeScript, Python, Go, and C# SDKs shipped with the
  spec; `createMcpHandler` graduated into the official TypeScript SDK,
  replatformed onto Web Standards (Bun/Deno/Workers). No new stdio-specific
  features are called out; the new core is HTTP-oriented, though stdio
  remains a valid transport for local applications (source:
  https://blog.cloudflare.com/mcp-v2/, 2026-09-15).

### Mapping to the arggon stdio server

Our server (cli/src/mcp-server.ts): single long-lived stdio session, fixed
repo root, `initialize` handshake with version negotiation across
2024-11-05/2025-03-26/2025-06-18, `tools/list` (static, deterministic
array), 9 synchronous tools that all complete in milliseconds to low
hundreds of milliseconds.

| Capability | Applies to us? | Honest assessment |
|---|---|---|
| Stateless core | Partially — by architecture, not by wire format | We have no `Mcp-Session-Id`, no session state, no caches: every tool call re-reads `tasks/` from disk against a fixed cwd, so behavior is already request-scoped. But we do keep the `initialize` handshake and connection-bound readline loop, which is exactly what stdio requires. Removing the handshake would break every current stdio client for zero benefit on a local transport. |
| Tasks | No today | All 9 tools are synchronous and fast. The slowest candidates are `arggon_report` with `trend:true` (git history mining — seconds, not minutes) and the future init/adopt flows, which are CLI-only today and interactive. None justify polling, durable handles, or mid-flight input. Revisit when a tool can exceed a client timeout. |
| Extensions | Partial adopt later | The framework is the right future home for declaring arggon-specific capabilities (e.g. an "item cascade" or "handoff" extension) instead of implicit conventions. Nothing to declare yet that clients would negotiate; noting it in the ADR is enough. |
| MCP Apps | No | We return JSON envelope text. An inline UI over work items could exist someday (board viewer is a separate web surface), but there is no conversation-embedded UI need now. |
| MRTR | No | Our tools never need server-initiated follow-up input; all input arrives in one call, and interactive flows live in the CLI, not MCP. |
| Cacheable lists | Cheap to adopt, low value | Our `tools/list` is a static, deterministically ordered array — already ideal for prompt caching. Adding `ttlMs`/`cacheScope` is a few lines but only pays off on hosts that prompt-cache stdio catalogs; harmless and forward-compatible. |
| Auth | N/A | stdio, local, single-user, no HTTP endpoints, no token handling. CIMD/DCR/RFC 8707 are HTTP-transport concerns. Deprecation of Roots/Sampling/Logging costs us nothing — we never implemented them. |
| SDK | Not adopted | The hand-rolled ~680-line server has zero dependencies, full envelope control, and unit tests over raw stdio. Migrating to the official TS SDK would add a dependency and an abstraction for one transport and 9 tools; the SDK's wins (Web Standards, Workers, HTTP) are irrelevant to us. Revisit if we ever add a second transport. |

## Recommendation

**Partial adopt (option 2).** Declare 2026-07-28 compatibility by adding it
to the negotiated protocol versions while keeping stdio and the handshake
(older clients must keep working — negotiation exists precisely for this).
Optionally adopt the cacheable-list hints and keep `tools/list`
deterministic. Defer Tasks, MCP Apps, MRTR, and Extensions declaration until
a concrete tool needs them. Do not migrate to the official SDK now.

The decision lands in ADR-0007: docs/adr/0007-mcp-2026-07-28-adoption.md.

## Decision

- ADR: docs/adr/0007-mcp-2026-07-28-adoption.md (Proposed → accepted at PR
  merge).
