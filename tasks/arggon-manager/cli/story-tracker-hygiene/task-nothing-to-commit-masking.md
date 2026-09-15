---
type: task
status: in_progress
id: task-nothing-to-commit-masking
title: "commitTrackerMutation: nothing-to-commit benign skip can mask a lost staged entry under concurrency"
assignee: Arggon
branch: feat/task-nothing-to-commit-masking
parent: story-tracker-hygiene
labels: []
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T16:28:55.709Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/task-nothing-to-commit-masking.md
  Leaves live only under a story. id is the filename stem: task-nothing-to-commit-masking.
  CLI `arggon create task nothing-to-commit-masking` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# commitTrackerMutation: nothing-to-commit benign skip can mask a lost staged entry under concurrency

## Context

Follow-up from the bug-torture-contention-flake2 review (its root-cause analysis proved the CI flake was a git index-clobber race, NOT retry-budget exhaustion): `commitTrackerMutation`'s "nothing to commit" path is a BENIGN quiet skip by design — but under concurrent commits, "nothing to commit" can mean the process's own staged entry was clobbered by another process's index rewrite, i.e. its mutation sits written-but-uncommitted while the command reports ok:true. The skip is in the JSON payload but the benign path does not distinguish "someone else already committed this" from "my staged entry was lost".

Candidate mitigation (from the review): after a "nothing to commit" result, re-check `git status --porcelain -- <paths>`; if the mutated files still show changes, treat it as a REPORTED skip (warning + payload) instead of a benign quiet one — or retry the add+commit once. Keep the genuinely-nothing-to-do case quiet.

## Acceptance

- [x] "nothing to commit" followed by residual changes in the mutated paths is reported as a skip (warning + payload), not silent; genuinely clean trees stay quiet
- [x] Tracker-commit tests cover both branches (residue vs clean); labs/torture contention scenario stays green
- [x] docs/json-output.md skip-reason documentation updated if the reason string changes

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. The residue probe draws the exact line the bug demanded: 'nothing to commit' with residue = lost staged entry = warned, distinct, additive skip reason; genuinely-clean trees keep the quiet benign path. Report-over-retry matches the coordinator preference and the torture lab's existing collection logic needed zero changes. The mocked-commit caveat is honestly noted — the lab covers the real interleaving. Merge follows.
