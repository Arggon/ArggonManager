# 0014 ZCode native seam: MCP as the full tool surface + declarative plugin

- Status: Accepted
> Status note (2026-10-01): flipped from "Proposed (Accepted on merge)" — landed via PR #436 (commit 0a340798, `task-mcp-full-surface`); the seam is live per `docs/agents.md` §ZCode. The status line had lagged the merge.

- Date: 2026-09-29
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Amends: [ADR 0011](0011-native-first-architecture.md) §5/§6 (MCP scope), extends [ADR 0010](0010-opencode2-native-architecture.md) to a second client
- Programme: `task-mcp-full-surface` + `task-zcode-plugin-seam` (under `native-zcode-integration`)

## Context

The OpenCode V2 program (ADR 0010/0011) made ArggonManager native to a first
client: kernel tools in-process (`tools.arggon.*`), vendored single-file
plugin, commands, agents, permission gates. ADR 0011 deliberately **removed
MCP from the default path** there — native tools replaced it.

Product-owner directive (2026-09-28): the same "as native as possible" bar
for **ZCode**. ZCode's extension model differs on the two points the OpenCode
seam leans on:

1. **No code-mode tool API.** A ZCode plugin is a declarative bundle
   (`.zcode-plugin/plugin.json` carrying `commands`, `skills`, `hooks`,
   `mcpServers`, `agents`); the only typed tool surface a plugin can expose is
   an **MCP server**. There is no in-process kernel-tool mechanism.
2. **No per-agent permission DSL.** Agents are a `tools` allowlist in
   frontmatter; hook input carries `session_id` + `tool_input` but no agent
   identity (verified against the shipped official plugins and the
   zcode-guide skill). OpenCode's agent-frontmatter `permissions` block has
   no equivalent.

Meanwhile `arggon mcp` (ADR 0007 protocol, kernel through
`@arggondev/lib`) exposes only the core nine tools; the worktree lifecycle
(`start`/`branch`/`cleanup`) and maintenance (`priority`/`sync`/
`import_issues`) exist only as OpenCode native tools or CLI commands.

## Decision

1. **MCP is a full-surface client adapter.** `arggon mcp` grows from nine to
   **fifteen tools**: `priority`/`sync`/`import_issues` call their kernel
   operations in-process; `start`/`branch`/`cleanup` spawn the arggon
   CLI itself (argv array, never a shell) and return the CLI's `--json`
   envelopes. One implementation path for worktree ergonomics (the CLI's
   link-farm `start --worktree`, `cleanup --prune`); injection-safe by
   construction; envelope parity is test-enforced
   (`mcp-parity.test.ts` option-surface invariant extends to all fifteen).
   The kernel keeps the only update rules (no reopen, no steal) — the spawned
   CLI inherits them, and none of the six tools adds a bypass.
2. **The ZCode seam is a vendored declarative plugin.** `arggon init --full`
   generates `.zcode-marketplace/` (marketplace catalog + `arggon/` plugin
   dir: manifest, 11 commands, 3 agents, hook gates) with the same
   never-overwrite + provenance semantics as the OpenCode seam. The adopter
   adds that directory as a local marketplace once — the one manual step the
   platform requires. The plugin's `mcpServers` field is the sanctioned
   registration of the stdio server; `init` still writes no MCP stanza into
   `.zcode/config.json` by default (ADR 0011 §5 carries over verbatim: an
   adopter who skips the plugin adds `mcp.servers.arggon` themselves).
3. **The reviewer backstop is a dispatch-scoped hook.** The plugin ships
   PreToolUse/PostToolUse hooks that mark the session while a reviewer
   subagent dispatch is in flight (`tool_input.subagent_type` matching the
   plugin's reviewer) and deny `Write`/`Edit`, mutating `arggon` shell
   invocations and mutating `mcp__arggon__*` calls for its duration —
   replicating the OpenCode reviewer gates (read-only shell, verdict via
   `comment`) on a platform with no per-agent permissions. A second,
   agent-independent gate denies `git push --force`/`-f` and
   `git commit --no-verify` for every session (the W4 seam gates, ported).
   Hooks are best-effort where bash is unavailable, as documented for the
   OpenCode seam's shell-text patterns.

## Consequences

- MCP tool-schema size grows from 9,040 B (9 tools) to 15,701 B (15 tools,
  ~3.9K tok); the advisory `doctor --budget` cap moves 12 KiB → 16 KiB with
  the re-baseline (task-schema-budget semantics: advisory, report-only) —
  accepted, the surface parity is the point.
- ZCode parity is **complete except the TUI board panel**, which has no
  ZCode equivalent (desktop app, no panel/`outputStyles` API — the manifest
  records but does not execute them). The substitute is shipped as the
  `/arggon-board` command (serves `arggon board --serve`, hands back the
  loopback URL). This is a platform limit, not a backlog item.
- Hook scripts are the only imperative code in the ZCode seam; they parse
  stdin JSON and exit 0/2. They must stay dependency-free (no runtime
  guarantee beyond POSIX bash).
- The CLI-spawn tools make `arggon mcp` behavior identical whether the
  adopter registered the server manually or through the plugin — no
  client-conditional tool sets (one surface, one truth).

## Alternatives considered

- **Workspace-config-only seam** (`.zcode/config.json` + workspace
  commands/skills, no plugin): no agents, configuration-file hooks need
  `enabled: true` and ship no state logic; rejected — the reviewer backstop
  and agent set are the seam.
- **Spawn the CLI for all fifteen tools** (uniformity): rejected —
  `priority`/`sync` kernel operations already return envelopes in-process;
  spawning adds process cost and no isolation value.
- **Port `start`/`branch`/`cleanup` flows into `@arggondev/lib`** so MCP
  avoids spawning: right long-term shape, but it drags the worktree link-farm
  and install-mirroring logic out of the CLI for no behavioral change today;
  recorded as a candidate follow-up, not a blocker.
