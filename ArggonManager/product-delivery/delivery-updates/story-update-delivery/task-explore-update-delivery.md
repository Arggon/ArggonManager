---
type: task
status: done
id: task-explore-update-delivery
title: "Exploration: update delivery and adopter install ergonomics"
assignee: Arggon
branch: feat/task-explore-update-delivery
parent: story-update-delivery
labels: [delivery, install, exploration]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
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

### 2026-10-01 @ses_f0870e73affeEVvaFZPi9K7NDj
Exploration complete and merged (PR #529, reviewer verdict: approve; rebase-free merge after concurrent tracker commits landed on main).

Outcome — ArggonManager/docs/explorations/exploration-update-delivery-016.md:
- Ground truth: release is a 100% manual runbook (release.md); no release workflow in CI; product has no update channel (doctor's outdated bucket is template-relative only); root pins the kernel with a caret (^0.4.0) — real skew surface under 0.x semver.
- Recommendation (staged): Stage 1 = release-please manifest + release PR (human-merged) publishing lib-then-cli via OIDC trusted publishing (tokenless, automatic provenance), exact kernel pin written by the release PR, packed tarballs attached to the GitHub Release. Stage 2 = bounded, opt-out update check (~50 lines, no new deps): interval-gated cached registry read, TTY-only notice for humans, additive update{} fields on doctor --json / --version for agents, ARGGON_NO_UPDATE_CHECK=1 honored, never in CI, never blocking.
- Non-goals: automatic self-update, standalone binaries, whatsnew (still deferred per ADR 0016), non-npm package managers.
- All edge-case rows typed (spec AC / non-goal) so the future spec can lift them mechanically.

Next: task-adr-update-delivery (filed on the story) lands the ADR; implementation stories/tasks decompose after the ADR.
Related adjacent work: task-ci-seam-pin-tracks-release (tooling-and-environment) removes the manual ARGGON_VERSION re-pin foot-gun.
