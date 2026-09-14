---
type: task
status: done
id: task-adr0006-compact-next
title: "ADR 0006 quick wins: compact JSON envelopes + next-first agent guidance"
assignee: Arggon
branch: feat/task-adr0006-compact-next
parent: operating-principles
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-adr0006-compact-next.md
  Leaves live only under a story. id is the filename stem: task-adr0006-compact-next.
  CLI `arggon create task adr0006-compact-next` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0006 quick wins: compact JSON envelopes + next-first agent guidance

## Context

Implements the two quick wins of accepted [ADR 0006](../../../docs/adr/0006-token-context-efficiency.md) (token/context efficiency). Measured 2026-09-14: `list --json` costs ~15.2k tokens over 136 items and always-emitted null/empty fields are ~15-20% of the payload; `next --json` is 67x smaller than `list` but agent guidance does not steer there.

## Acceptance

- [x] Compact envelopes by default: `list`/`create`/`update`/`comment` `--json` payloads omit null/empty optional fields (blocked_reason, milestone, worktree_path, issue, depends_on when empty, labels when empty); `--full` restores the complete shape; schemaVersion unchanged (omission documented as the default in docs/json-output.md); contract/parity tests updated
- [x] next-first guidance: SKILL.md + generated AGENTS.md steer agents to `arggon next --json` for "what should I work on" instead of `list --json`; copy synced to .agents + re-acked

## Notes

## Implementation notes (2026-09-14)

- Shared omission helper `compactWorkItem` in cli/src/json.ts; `toContractWorkItem` gains `{ full?: boolean }` (default full; list/create/update pass `full: !--full` in CLI + MCP).
- `comment` envelope carries no WorkItem and already omits `commit` when skipped, so no compact change / no `--full` needed there.
- Payload measured on this tree (same code, before/after): `list --json` 62,735 -> 48,683 bytes (-22.4%); `next --json` 909 bytes (~69x smaller than full list, matching the item's 67x estimate).
- SKILL.md source edited; .agents copy regenerated; checksum re-acked in tasks/.convention.yml (doctor: 0 modified / 0 drifted). templates/docs/AGENTS.md got the one-line next-first steer.
