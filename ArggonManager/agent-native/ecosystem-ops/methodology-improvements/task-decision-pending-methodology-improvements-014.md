---
type: task
status: in_progress
id: task-decision-pending-methodology-improvements-014
title: "exploration-methodology-improvements-014 Decision section still records no landed ADR after 12 days — DECISION-PENDING-EXPLORATION is a sixth NEW finding on main's baseline lane"
assignee: arggon-delivery-lead
branch: feat/task-decision-pending-methodology-improvements-014
parent: methodology-improvements
labels: [spec-pipeline, docs]
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T04:19:07.201Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-decision-pending-methodology-improvements-014
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-decision-pending-methodology-improvements-014.md
  Leaves live only under a story. id is the filename stem: task-decision-pending-methodology-improvements-014.
  CLI `arggon create task decision-pending-methodology-improvements-014` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# exploration-methodology-improvements-014 Decision section still records no landed ADR after 12 days — DECISION-PENDING-EXPLORATION is a sixth NEW finding on main's baseline lane

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** `spec analyze --baseline ArggonManager/spec-analyze-baseline.json` on clean `main` today (2026-10-11) reports, as NEW: `docs/explorations/exploration-methodology-improvements-014.md:163: Decision section records no decision after 12 day(s) (threshold 7) [DECISION-PENDING-EXPLORATION]`. Run totals: 6 new, 1 resolved, 5 unchanged, exit 1. The finding's remedy menu: link `docs/adr/<NNNN>-<slug>.md`, record "No ADR required — <reason>", or supersede the exploration.

ADR 0015 (`docs/adr/0015-done-gate-acceptance-waiver.md`) landed 2026-09-29 via `task-done-gate-acceptance-waiver` and its own frontmatter declares the programme "C1 of exploration-methodology-improvements-014" — C1's ADR exists; the Decision section simply never links it (it still carries the 0000 placeholder comment). This finding was not in the ADR 0017 lane on 2026-10-06 (5 new then); it aged across the 7-day threshold since, and it now keeps the lane red independently of the 5 duplicate-doc-number findings, so both must land before the baseline re-save item runs.

**Why it is blocked-work.** The repo-root baseline is the shared ADR 0017 zero-NEW gate: while it is red, no implementation task anywhere may be claimed — it is what holds `task-friction-capture-command` (T1 of the adopter-friction story) hostage.

Acceptance:
- [ ] The Decision section of `docs/explorations/exploration-methodology-improvements-014.md` links `docs/adr/0015-done-gate-acceptance-waiver.md` for C1, and the landing spec/ADR for C3's `spec-spec-analyze` follow-up if one has landed (verify — do not assume; if none, record "No ADR required — <reason>" explicitly)
- [ ] The `0000-<slug>` placeholder comment is gone; any remaining peril without a landed ADR records an explicit "No ADR required — <reason>" line (the documented remedy), not a placeholder
- [ ] `spec analyze` no longer reports DECISION-PENDING-EXPLORATION for this file (echo before/after evidence in the PR description)
- [ ] No citation to a file renamed by the in-flight renumber wave is introduced (the 10 renamed stems are listed in `task-renumber-colliding-doc-numbers`; verify your citation targets exist at merge time)
- [ ] `npm test`, `npm run build`, `npm run check:plugin` and `npm run lint` green
- [ ] Do not touch either baseline JSON (`ArggonManager/spec-analyze-baseline.json`, `ArggonManager/spec-analyze-baseline-release-pipeline-015.json`) — re-baselining is owned by `task-release-pipeline-baseline-new-collisions` AFTER this lands
