---
type: task
status: in_progress
id: task-opencode2-plan
title: "Program plan: OpenCode2 refactor waves"
assignee: Arggon
branch: opencode2
parent: story-opencode-v2
labels: []
priority: p1
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T00:30:56.139Z"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode2-plan.md
  Leaves live only under a story. id is the filename stem: task-opencode2-plan.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Program plan: OpenCode2 refactor waves

## Context

W0 of the OpenCode2 program: turn the research
([exploration-opencode-v2-native-009](../../../../docs/explorations/exploration-opencode-v2-native-009.md))
into a reviewable program contract and a wave-ordered implementation plan, and
restructure the tracker under epic `opencode2`. This task owns the program
documents; the ADR content is task-opencode-v2-adr's deliverable but ships in
the same W0 commit because a plan cannot reference a decision that does not
exist yet.

## Acceptance

- [x] `docs/specs/spec-opencode2-009.md` written: purpose, invariants (I1–I6),
      out-of-scope with revisit triggers, deliverable surface, program
      acceptance; validates with `arggon spec validate`.
- [x] `docs/plans/plan-opencode2-009.md` written: waves T1–T16 with verifiable
      acceptance per task, dependency order, file-disjointness note, risks and
      rollback; validates with `arggon spec validate`.
- [x] Tracker restructure: epic `opencode2` under initiative `arggon-manager`,
      story-opencode-v2 reparented, wave items created with `depends_on` edges
      (`spec`/`playbook`/`plugin`/`methodology`/`orchestration`/`context`/`dogfood`).
- [x] Spec/plan statuses flip to `implemented` in the W7 PR that closes the
      program (not before).

## Notes

- Branch: `opencode2` (integration branch per the product owner's request); wave
  items branch from it and merge back into it; the final promotion to `main` is
  the W7 PR referencing epic `opencode2`.
- The plan is the navigation document: when a wave starts, its items are already
  filed; new discoveries are filed as items, not grown into a wave's scope.
