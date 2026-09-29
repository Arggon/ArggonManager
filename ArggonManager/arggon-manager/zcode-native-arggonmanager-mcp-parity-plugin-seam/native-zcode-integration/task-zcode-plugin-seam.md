---
type: task
status: todo
id: task-zcode-plugin-seam
title: "ZCode plugin seam: vendored plugin, reviewer hook backstop, init generation"
parent: native-zcode-integration
labels: []
created: "2026-09-29"
updated: "2026-09-29"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/zcode-native-arggonmanager-mcp-parity-plugin-seam/native-zcode-integration/task-zcode-plugin-seam.md
  Leaves live only under a story. id is the filename stem: task-zcode-plugin-seam.
  CLI `arggon create task zcode-plugin-seam` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ZCode plugin seam: vendored plugin, reviewer hook backstop, init generation

## Context

ZCode's extension model is a declarative plugin bundle (`.zcode-plugin/
plugin.json` carrying `commands`, `skills`, `hooks`, `mcpServers`, `agents`)
installed from a marketplace — there is no code-mode tool API like OpenCode
V2's. The ZCode-native seam is therefore: the MCP server as the tool surface
(task-mcp-full-surface), plus a vendored plugin carrying the 11 commands, the
3 agents (coordinator/worker/reviewer) and two PreToolUse hook gates.

Hook design (verified against the shipped plugin hooks + zcode-guide):
ZCode hooks receive `session_id` + `tool_input` only — no agent identity — so
the reviewer backstop cannot be a static per-agent rule. It is a
dispatch-scoped marker: `PreToolUse(Agent)` records a reviewer dispatch
(matching the plugin's reviewer agent id in `tool_input.subagent_type`),
`PostToolUse(Agent)` clears it; while marked, `Write|Edit`, mutating
`arggon` shell invocations and mutating `mcp__arggon__*` calls are denied for
that session. The second hook is agent-independent: deny `git push --force`/
`-f` and `git commit --no-verify` for every session (ports the W4 seam
gates). Hooks are best-effort on shells without bash (documented limits, as
with the OpenCode seam).

`arggon init --full` generates the seam under `.zcode-marketplace/`
(marketplace.json + `arggon/` plugin dir, never-overwrite + provenance
semantics like the OpenCode bundle); the adopter adds that directory as a
local marketplace once (Plugin Marketplace → Add) — the one manual step the
platform requires.

## Acceptance

- [ ] Plugin source under `templates/docs/zcode/`: manifest (name `arggon`),
      11 commands (tool-call references rewritten to `mcp__arggon__*`), 3
      agents (frontmatter converted to ZCode form), `hooks/hooks.json` + gate
      scripts (global git gates + reviewer dispatch-scoped backstop)
- [ ] Reviewer backstop denies Write/Edit, mutating arggon shell calls and
      mutating `mcp__arggon__*` calls while a reviewer dispatch is active;
      unit-tested against the script contract (stdin JSON → exit codes)
- [ ] `arggon init --full` generates `.zcode-marketplace/` with provenance
      headers, never overwrites modified files, and re-runs report skipped/
      regenerated like the OpenCode seam (init tests extended)
- [ ] Plugin manifest validates against the ZCode schema (name pattern,
      component paths inside the plugin root)
- [ ] `docs/agents.md` init section documents the ZCode seam (generation,
      install step, hook semantics) in the same PR
- [ ] Headless smoke: fresh-init tree + plugin files loadable (manifest JSON
      parses, declared paths exist); documented checks that need a live ZCode
      client are explicitly listed as pending
- [ ] Full test suite + lint/typecheck gates green; `arggon validate --json`
      `ok:true` before every commit

## Notes
