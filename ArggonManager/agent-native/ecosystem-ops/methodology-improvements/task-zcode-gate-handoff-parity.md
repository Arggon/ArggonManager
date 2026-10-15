---
type: task
status: todo
id: task-zcode-gate-handoff-parity
title: "ZCode gate: align the reviewer window with the Claude seam's arggon_handoff decision (MCP + shell routes)"
parent: methodology-improvements
labels: []
created: "2026-10-14"
updated: "2026-10-14"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-zcode-gate-handoff-parity.md
  Leaves live only under a story. id is the filename stem: task-zcode-gate-handoff-parity.
  CLI `arggon create task zcode-gate-handoff-parity` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ZCode gate: align the reviewer window with the Claude seam's arggon_handoff decision (MCP + shell routes)

## Context

The Claude seam's gate-polish task (`task-claude-gate-polish`, PR #823) decided that
`arggon_handoff` — a tracker-append mutation — is denied inside the reviewer dispatch
window on **both** routes: the MCP tool set (`mcp__arggon__arggon_handoff` and the
plugin-scoped spelling) and the shell words (`arggon handoff …`). The ZCode gate
(`templates/docs/zcode/arggon/hooks/gate.mjs`) still leaves `arggon_handoff` unlisted on
both routes: neither denied nor documented as allowed, so a reviewer dispatch could append
a handoff while every neighbouring mutation is denied. That divergence was deliberate and
recorded when the Claude decision landed; this task closes it on the ZCode seam.

## Acceptance

- [ ] The ZCode gate decides `arggon_handoff` with the same reasoning (deny it with the mutating set; `arggon_comment` stays the verdict channel) — or records why ZCode keeps it open; the header states the chosen rule either way
- [ ] The shell route matches the MCP decision (`MUTATING_ARGGON_WORDS` parity with the MCP set), pinned in `cli/src/init-zcode.test.ts` (a test that fails if the word moves between the sides)
- [ ] This repo's own `.zcode-marketplace/**` copy is refreshed (`npm run arggon -- init --agents zcode`), with the x-generated rows updated
- [ ] `arggon validate`, the focused zcode tests, the full suite, lint, structure and prettier are green

## Notes

- Mirror `task-claude-gate-polish`'s wording so the two gates stay comparable; the Claude
  change is the decision record (spec-claude-code-adapter-024 §Hook gates: "the mutating
  `mcp__arggon__*` tools are denied for that session; `arggon_comment` stays open").
- Defense-in-depth polish, non-blocking: the kernel remains the enforcement of record.
