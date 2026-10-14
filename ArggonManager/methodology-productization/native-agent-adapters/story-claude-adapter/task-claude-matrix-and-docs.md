---
type: task
status: todo
id: task-claude-matrix-and-docs
title: "Claude Code adapter: capability-matrix rows, agents.md seam section, spec resolution (spec S6/024 §Impact)"
parent: story-claude-adapter
labels: []
created: "2026-10-14"
updated: "2026-10-14"
depends_on: [task-claude-plugin-seam]
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/task-claude-matrix-and-docs.md
  Leaves live only under a story. id is the filename stem: task-claude-matrix-and-docs.
  CLI `arggon create task claude-matrix-and-docs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Claude Code adapter: capability-matrix rows, agents.md seam section, spec resolution (spec S6/024 §Impact)

## Context

The behavioral half of the Claude adapter wave
([story-claude-adapter](story-claude-adapter.md),
[spec-claude-code-adapter-024](../../../docs/specs/spec-claude-code-adapter-024.md)
§Impact): after `task-claude-plugin-seam` ships `templates/docs/claude/**` and the init
seam, this task updates the capability matrix to claim exactly what the bundle moves, adds
the Claude Code seam section to `ArggonManager/docs/agents.md` beside §ZCode, resolves spec
024's three open questions with the recorded probes and flips its status, and sweeps
statements the new seam makes false.

Probe outcomes this task records and re-runs (claude 2.1.289, throwaway HOME; transcripts in
the item comments):

- **Q1 (repo-local marketplace root): PASS** — `claude plugin marketplace add .claude-marketplace`
  - `claude plugin install arggon@arggon-local`.
- **Q2 (namespaced names):** `/arggon:<command>` for commands, `arggon:<agent>` for agents,
  `mcp__plugin_arggon_arggon__<tool>` for the plugin-bundled MCP tools (manifest-reference
  rule + `claude plugin details` evidence).
- **Q3 (both `arggon` keys validate): PASS** — the inline manifest key is kept; at runtime
  `claude mcp list` shows both `plugin:arggon:arggon` and the project `arggon` registration.

## Acceptance

- [ ] `adapters/capability-matrix.json` + its byte-equal `templates/docs/adapters/capability-matrix.json` copy: claude `discipline-enforceable` becomes a non-gap `claude:plugin.hooks.PreToolUse` row (note records hooks-fail-open + the kernel as enforcement of record); `docs-travel-with-code` stays a gap (no session-context hook); every note satisfies the matrix lints and the size caps
- [ ] `cli/src/capability-matrix.test.ts` pins updated; `cli/src/adapter-selection.test.ts` snapshot updated (claude file count + gap lines); `cli/src/init-claude.test.ts` doctor clause updated if it pins the pre-wave gap set
- [ ] `ArggonManager/docs/agents.md` gains a Claude Code seam section beside §ZCode naming the marketplace install step, the one-server rule, the two-agent rule and the namespaced component names (`/arggon:<command>`, `arggon:<agent>`), with impact class stated as **Behavioral**; the §ZCode sentence about S6 updated to the shipped state
- [ ] Spec 024: Open questions replaced by the recorded resolutions; `status: implemented`; no new `arggon spec analyze` finding naming the story/spec
- [ ] Doc sweep: every statement the bundle makes false is updated (repo README/docs, seam README)
- [ ] `arggon validate`, full `npm test`, lint, structure, prettier, `arggon spec analyze` green
- [ ] The PR states impact class **Behavioral**

## Notes

- Depends on `task-claude-plugin-seam` (claim only after it is merged — the matrix claims
  ship-state, and the snapshot needs the new destinations on disk).
- `adapters/capability-matrix.json` is hand-authored and byte-mirrored into
  `templates/docs/adapters/capability-matrix.json`; edit the pair together (the byte-equality
  test never hand-divides them). Mirror the zcode rows for shape.
- The story's acceptance boxes 10 and 11 land here; the lead closes the story and flips the
  items after merge verification.
