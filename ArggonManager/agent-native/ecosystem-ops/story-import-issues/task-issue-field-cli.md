---
type: task
status: done
id: task-issue-field-cli
title: "expose --issue on create/update: round-trip is unreachable for hand-built items"
assignee: Arggon
branch: feat/task-issue-field-cli
parent: story-import-issues
labels: [p2]
created: "2026-09-15"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-import-issues/task-issue-field-cli.md
  Leaves live only under a story. id is the filename stem: task-issue-field-cli.
  CLI `arggon create task issue-field-cli` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# expose --issue on create/update: round-trip is unreachable for hand-built items

## Context

Reported by the casa-pendiente experiment (2026-09-15): the GitHub round-trip (x-github.issue-roundtrip) is UNREACHABLE for hand-built hierarchies. Code-verified: the create kernel supports `opts.issue` (cli/src/create.ts:36-153, validated) but the CLI never wires a `--issue` flag, and `update` only USES the issue field for the round-trip close (cli/src/update.ts) — it cannot SET it. Consequence: items not born from `import-issues` (e.g. the hand-built story hierarchy casa-pendiente needed) can never gain an `issue:` field, so their linked GitHub issues must be closed manually with gh (the agent closed 4 by hand).

## Acceptance

- [x] `arggon create --issue <n>` wires the existing kernel option
- [x] `arggon update --issue <n>` (and a way to clear it) writes the `issue:` field — same validation, additive payload
  - clear semantics: `--issue 0` clears (single mechanism across CLI and MCP; documented in the flag help, README, json-output.md, agents.md §0)
- [x] Parity harness covers --issue for create/update; tests for set, clear, invalid value; docs (README + json-output + convention.md x-github cross-reference, added on review)

## Notes

### 2026-09-16 @Arggon
Lead-architect review: APPROVED (round 2). The convention.md cross-reference completes the loop: import-issues and hand-built items now both reach the round-trip through the documented surface. Clear semantics (--issue 0, one mechanism CLI+MCP), kernel-first implementation (create needed zero changes), and the parity harness covers set/clear through both entry points. Merge follows.
