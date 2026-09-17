---
type: task
status: in_progress
id: task-init-dry-run-plan
title: "init --dry-run: plan-only upgrade preview (pure read)"
assignee: Arggon
parent: story-adoption-state
labels: [p2]
created: "2026-09-16"
updated: "2026-09-17"
claimed_at: "2026-09-17T00:06:15.194Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-init-dry-run-plan.md
  Leaves live only under a story. id is the filename stem: task-init-dry-run-plan.
  CLI `arggon create task init-dry-run-plan` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init --dry-run: plan-only upgrade preview (pure read)

## Context

Exploration adopter-upgrade-experience-007 (option A, approved 2026-09-16, staged plan B+A -> C -> D): re-running `arggon init` is the designed upgrade path for generated docs, but there is no way to see what it WOULD do without running it — and init writes + auto-commits. Adopters (and their agents) need a pure-read plan before deciding. Computation already exists in runInit; only the write gets gated. Parent decision record: exploration-adopter-upgrade-experience-007.

## Acceptance

- [ ] `arggon init <dir> --dry-run` computes the full per-destination decision (created / would-update / modified-skip / acked-skip / backedUp-if---backup / stale / missing) and writes NOTHING: no file changes, no backup dir, no auto-commit (fs snapshot-verified in tests)
- [ ] Planner logic is a pure function shared with runInit (no duplicated decision code); runInit calls it then applies
- [ ] `--json` payload additive: same envelope + `dryRun: true` and the `plan` array (per-destination decision + reason); human output renders the plan as a table with a "nothing was written" footer
- [ ] `--dry-run` combines cleanly with `--force`/`--full`/`--backup` flags (plan reflects them)
- [ ] Tests: untouched doc whose template changed shows would-update with the new render pending; acked doc shows acked-skip; fs-unchanged invariant; existing init suite stays green
- [ ] Docs: README "Re-running init" section + docs/json-output.md (additive)
