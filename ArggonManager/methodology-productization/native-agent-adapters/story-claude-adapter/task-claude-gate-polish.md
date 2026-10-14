---
type: task
status: todo
id: task-claude-gate-polish
title: "Claude seam: gate wording for argon_handoff + narrower PreToolUse matcher (post-#821 standards nits)"
parent: story-claude-adapter
labels: []
created: "2026-10-14"
updated: "2026-10-14"
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/task-claude-gate-polish.md
  Leaves live only under a story. id is the filename stem: task-claude-gate-polish.
  CLI `arggon create task claude-gate-polish` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Claude seam: gate wording for argon_handoff + narrower PreToolUse matcher (post-#821 standards nits)

## Context

The PR #821 standards pass (`task-claude-plugin-seam`) returned no blockers and no
should-fix items; two optional nits are actionable and tracked here so they are not lost:

1. **`arggon_handoff` is a tracker-append mutation the gate neither denies nor lists as an
   exception.** `templates/docs/claude/arggon/hooks/gate.mjs` denies the mutating MCP set
   (`arggon_create/update/start/branch/cleanup/priority/sync/import_issues`) and its header
   names only `arggon_comment` as open; `arggon_handoff` (a handoff comment append) sits in
   neither list, exactly like the ZCode gate. Exposure is nil today — the reviewer agent's
   allowlist grants neither handler — but spec 024 §Hook gates reads broader ("the mutating
   `mcp__arggon__*` tools"), so the wording/decision gap should close deliberately.
2. **The PreToolUse matcher is broader than needed.** `hooks.json` matches `mcp__.*`, so every
   unrelated MCP tool call in a session spawns the gate; the two arggon registration prefixes
   (`mcp__arggon__` + `mcp__plugin_arggon_arggon__`) are the whole set the gate can deny.

Recorded, not actioned here (context from the same pass): the repo-self marker-loss durability
gap (pre-existing across seams — the parity test compares marker-stripped bytes, so an absent
marker still passes), two expectations that re-derive from the same classifier (mitigated by the
literal `TIER1_DOCS` list), and one historical comment's file count.

## Acceptance

- [ ] The gate's deny set and its header state the same, complete rule: decide whether `arggon_handoff` is denied with the other mutating MCP tools or explicitly allowed as a verdict/read channel — implement the decision in `hooks/gate.mjs` and pin it in `cli/src/init-claude.test.ts` (a test that fails if the tool silently moves between the two sides)
- [ ] `hooks.json` PreToolUse matcher narrows from `mcp__.*` to the two arggon registration prefixes (bare + plugin-scoped), with a test pinning both prefixes in the matcher
- [ ] The seam README and the gate header name the same deny set the matcher/script implement
- [ ] `arggon validate`, the focused suite and prettier green; the decision recorded on the item (why denied or allowed), since it changes the backstop's documented surface

## Notes

- Optional polish from the #821 standards pass; no user-visible defect today. This bundle is a
  port of the ZCode gate — if the decision diverges from ZCode, record why.
