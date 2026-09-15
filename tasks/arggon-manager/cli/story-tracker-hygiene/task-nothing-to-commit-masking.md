---
type: task
status: todo
id: task-nothing-to-commit-masking
title: "commitTrackerMutation: nothing-to-commit benign skip can mask a lost staged entry under concurrency"
parent: story-tracker-hygiene
labels: []
created: "2026-09-15"
updated: "2026-09-15"
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

- [ ] "nothing to commit" followed by residual changes in the mutated paths is reported as a skip (warning + payload), not silent; genuinely clean trees stay quiet
- [ ] Tracker-commit tests cover both branches (residue vs clean); labs/torture contention scenario stays green
- [ ] docs/json-output.md skip-reason documentation updated if the reason string changes

## Notes
