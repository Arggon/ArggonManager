---
type: task
status: in_progress
id: task-adr-status-housekeeping
title: adr-status-housekeeping
assignee: Arggon
branch: feat/task-adr-status-housekeeping
parent: methodology-improvements
labels: []
priority: p3
created: "2026-09-29"
updated: "2026-09-29"
claimed_at: "2026-09-29T23:27:20.106Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-status-housekeeping
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr-status-housekeeping.md
  Leaves live only under a story. id is the filename stem: task-adr-status-housekeeping.
  CLI `arggon create task adr-status-housekeeping` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# adr-status-housekeeping

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon
### Context — ADR housekeeping (exploration-methodology-improvements-014 F3)

ADRs 0002/0003/0004 are stuck `Proposed`. Resolve the statuses honestly, per the never-rewrite rule (status changes are appended updates, never silent edits of history):
- **0002** board viewer v0: the board shipped (engineering.md credits it) → `Accepted` with a dated one-line note.
- **0003 / 0004** milestone field / convention v3: check `docs/convention.md` first. If the milestone model is not part of convention v5, mark `Superseded by <the ADR that actually replaced it — identify it from the 0009/0012 chain>` with a dated note; if milestones still exist in v5, mark `Accepted` with a dated note instead.

### Acceptance checklist
- [ ] Each of the three ADRs carries a correct, dated status line + one-line rationale.
- [ ] No other content rewritten.
- [ ] Docs-only PR; `arggon validate` ok.
