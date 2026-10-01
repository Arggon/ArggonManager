---
type: task
status: in_progress
id: task-explore-update-delivery
title: "Exploration: update delivery and adopter install ergonomics"
assignee: Arggon
branch: feat/task-explore-update-delivery
parent: story-update-delivery
labels: [delivery, install, exploration]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T13:07:32.321Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-explore-update-delivery
---

<!--
  Placement (v0): ArggonManager/product-delivery/delivery-updates/story-update-delivery/task-explore-update-delivery.md
  Leaves live only under a story. id is the filename stem: task-explore-update-delivery.
  CLI `arggon create task explore-update-delivery` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Exploration: update delivery and adopter install ergonomics

## Context

ADR 0016 deferred "distribution of the tool itself" behind its own future ADR.
This task runs that exploration: how releases ship from this repo (today a
fully manual runbook) and how adopters learn about + install new versions
(today: nothing in-product). Outcome is the exploration doc
`ArggonManager/docs/explorations/exploration-update-delivery-016.md`, the
input to the distribution ADR.

## Acceptance

- [x] Current mechanics grounded in code/runbook and recorded as facts (release.md, .github/workflows, doctor's outdated bucket, package.json skew surface).
- [x] Candidate bundles compared — pipeline automation (A), in-product update channel (B), kernel↔CLI skew (C), non-npm distribution (D) — with dated external sources (npm trusted publishing GA, release-please workspace support, update-notifier status).
- [x] Frontier interview recorded: users (agents + humans equally), scope (all four bundles), privacy stance (opt-out registry check), rollout (release-please-style CI release, human-triggered merge).
- [x] Edge-case table complete with per-dimension dispositions (spec AC / non-goal), including authn, time/locale, persistence/migration.
- [x] Staged recommendation + explicit non-goals; exploration merged to main (PR #529, reviewer verdict: approve).
- [x] Follow-up ADR task filed on the story.

## Notes
