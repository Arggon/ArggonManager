---
type: task
status: in_progress
id: task-handoff-provenance-session-identifier-in-handoff-sections
title: "handoff provenance: session identifier in handoff sections"
assignee: Arggon
branch: feat/task-handoff-provenance-session-identifier-in-handoff-sections
parent: story-item-comments
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T22:23:16.786Z"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-item-comments/task-handoff-provenance-session-identifier-in-handoff-sections.md
  Leaves live only under a story. id is the filename stem: task-handoff-provenance-session-identifier-in-handoff-sections.
  CLI `arggon create task handoff-provenance-session-identifier-in-handoff-sections` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# handoff provenance: session identifier in handoff sections

## Context

Handoff sections identify author+date but not WHICH session produced them — the resuming agent cannot trace the handoff to its origin session (provenance-verified transfer pattern, arxiv.org/html/2605.11032v1, 2026-09-15). Add an optional, bounded session identifier to `arggon handoff` / MCP `arggon_handoff`. Principle: token-context (bounded), audit trail.

Design decision: **explicit flag only** — the CLI cannot reliably know the caller's session id, so callers pass what they have via `--session` / `session`; there is no auto-detection. Capped at 64 chars (`HANDOFF_SESSION_CAP`), rendered in the heading as `### handoff <date> @<author> (session: <id>) — next: <step>`; omitted cleanly (no empty placeholder) when absent.

## Acceptance

- [x] `arggon handoff <id>` gains `--session <id>` (optional, capped at 64 chars), rendered in the heading; absent → omitted cleanly
- [x] MCP `arggon_handoff` tool schema gains the same optional `session` property; parity harness updated (additive)
- [x] Tests in cli/src/handoff.test.ts: with session (rendered), without (omitted), over-cap truncation, through MCP (+ CLI flag passthrough)
- [x] Docs: README handoff section + docs/json-output.md `handoff` envelope table (additive)

## Notes
