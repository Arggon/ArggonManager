---
type: task
status: in_progress
id: task-zcode-plugin-seam
title: "ZCode plugin seam: vendored plugin, reviewer hook backstop, init generation"
assignee: Arggon
branch: feat/task-zcode-plugin-seam
parent: native-zcode-integration
labels: []
created: "2026-09-29"
updated: "2026-09-29"
claimed_at: "2026-09-29T11:26:33.161Z"
depends_on: [task-mcp-full-surface]
worktree_path: /home/arggon/Projects/ArggonManager-task-zcode-plugin-seam
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

- [x] Plugin source under `templates/docs/zcode/`: manifest (name `arggon`),
      11 commands (tool-call references rewritten to `mcp__arggon__*`), 3
      agents (frontmatter converted to ZCode form), `hooks/hooks.json` + the
      `gate.mjs` script (global git gates + reviewer dispatch-scoped backstop)
- [x] Reviewer backstop denies Write/Edit, mutating arggon shell calls and
      mutating `mcp__arggon__*` calls while a reviewer dispatch is active;
      unit-tested against the script contract (stdin JSON → exit codes:
      marker lifecycle, parallel dispatches, Stop clearing, cross-session
      isolation)
- [x] `arggon init` generates `.zcode-marketplace/` (tier-1, matching the
      OpenCode seam's tiering) with provenance headers, never overwrites
      modified files, and re-runs report skipped/regenerated (init tests
      extended: exact tier-1 set includes the 18 seam files)
- [x] Plugin manifest validates against the ZCode schema (name pattern,
      component paths inside the plugin root; marketplace entry name/source
      consistency asserted)
- [x] `docs/agents.md` init section documents the ZCode seam (generation,
      the one manual marketplace-install step, hook semantics, platform gaps)
      in the same PR
- [x] Headless smoke: fresh-init tree + plugin files verified (manifest JSON
      parses, declared paths exist, commands address only the MCP surface).
      Pending live-client checks, documented on the PR: actual marketplace
      add + plugin install + skill/command discovery + a hook firing in a
      real session (needs the ZCode desktop app; unverified here)
- [x] Full test suite + lint/typecheck gates green; `arggon validate --json`
      `ok:true` before every commit

## Notes

Branches off main, not T1's branch: the seam is declarative and shares no
code with the T1 MCP change — merge order is T1 (#436) first, then this PR.
Flipping `spec-zcode-native-seam-012` / the plan to `implemented` happens
when this lands AFTER T1 (the spec files live in T1's branch).

## Notes
