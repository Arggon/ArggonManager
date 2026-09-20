---
type: task
status: done
id: task-self-host-convention-v3
title: Convention v3 upgrade + x-tracker auto-commit + pre-commit hook
assignee: Arggon
parent: story-dogfood-self-host
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-dogfood-self-host/task-self-host-convention-v3.md
  Leaves live only under a story. id is the filename stem: task-self-host-convention-v3.
  CLI `arggon create task self-host-convention-v3` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Convention v3 upgrade + x-tracker auto-commit + pre-commit hook

## Context

tasks/.convention.yml upgrades 0 -> 3 (additive, backward-compatible by design) and enables the extensions this repo now ships: x-tracker.auto-commit: true (kills the dirty-tree dance after every create/comment in this repo), branch_patterns declared explicitly (v2 feature, documents the defaults). Plus the pre-commit hook from docs/agents.md Reference integrations (.git/hooks/pre-commit running arggon validate — local-only, not committed, but installed and verified).

## Acceptance

- [x] .convention.yml: version 3 + branch_patterns + x-tracker.auto-commit: true; envelopes report conventionVersion: 3
- [x] create/comment here self-commit (verified live); pre-commit hook installed and rejects an invalid tree (verified by attempt)
- [x] Full suite green on the upgraded tree

### 2026-09-13 @Arggon
dogfood: x-tracker.auto-commit enabled — this comment self-committed via the tracker auto-commit path (create/comment/adopt/cleanup). Handoff note: pre-commit hook verification follows in this task.
