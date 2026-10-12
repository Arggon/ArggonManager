---
type: task
status: done
id: task-decision-pending-methodology-improvements-014
title: "exploration-methodology-improvements-014 Decision section still records no landed ADR after 12 days — DECISION-PENDING-EXPLORATION is a sixth NEW finding on main's baseline lane"
assignee: arggon-delivery-lead
branch: feat/task-decision-pending-methodology-improvements-014
parent: methodology-improvements
labels: [spec-pipeline, docs]
created: "2026-10-11"
updated: "2026-10-11"
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

- [x] The Decision section of `docs/explorations/exploration-methodology-improvements-014.md` links `docs/adr/0015-done-gate-acceptance-waiver.md` for C1 (verified on disk: ADR 0015 frontmatter names this exploration's C1 as its programme; links its 2026-10-06 amendment ADR 0025)
- [x] C3's `spec-spec-analyze` follow-up linked to its landed spec `docs/specs/spec-analyze-decision-gaps-013.md` (`status: implemented`) with an explicit "No ADR required — <reason>" line; the `0000-<slug>` placeholder comment removed; C2/C5 keep "no ADR yet", C4 waits on the landed ADR 0016
- [x] `spec analyze` no longer reports DECISION-PENDING-EXPLORATION for this file — before: 6 new (11 total, exit 1) incl. this finding; after: 5 new (10 total), the 5 survivors are the renumber wave's duplicate-doc-numbers (evidence comment below)
- [x] No citation to any file renamed by the renumber wave introduced
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green (PR #679); tracker `validate` ok
- [x] Baseline JSONs untouched (owned by `task-release-pipeline-baseline-new-collisions`)

> Live-section note: the criteria were dispatched as a comment at filing time; this
> section records them in the live body after merge (ADR 0025 live-Acceptance gate).

## Notes

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** `spec analyze --baseline ArggonManager/spec-analyze-baseline.json` on clean `main` today (2026-10-11) reports, as NEW: `docs/explorations/exploration-methodology-improvements-014.md:163: Decision section records no decision after 12 day(s) (threshold 7) [DECISION-PENDING-EXPLORATION]`. Run totals: 6 new, 1 resolved, 5 unchanged, exit 1. The finding's remedy menu: link `docs/adr/<NNNN>-<slug>.md`, record "No ADR required — <reason>", or supersede the exploration.

ADR 0015 (`docs/adr/0015-done-gate-acceptance-waiver.md`) landed 2026-09-29 via `task-done-gate-acceptance-waiver` and its own frontmatter declares the programme "C1 of exploration-methodology-improvements-014" — C1's ADR exists; the Decision section simply never links it (it still carries the 0000 placeholder comment). This finding was not in the ADR 0017 lane on 2026-10-06 (5 new then); it aged across the 7-day threshold since, and it now keeps the lane red independently of the 5 duplicate-doc-number findings, so both must land before the baseline re-save item runs.

**Why it is blocked-work.** The repo-root baseline is the shared ADR 0017 zero-NEW gate: while it is red, no implementation task anywhere may be claimed — it is what holds `task-friction-capture-command` (T1 of the adopter-friction story) hostage.

Acceptance:

- [x] The Decision section of `docs/explorations/exploration-methodology-improvements-014.md` links `docs/adr/0015-done-gate-acceptance-waiver.md` for C1, and the landing spec/ADR for C3's `spec-spec-analyze` follow-up if one has landed (verify — do not assume; if none, record "No ADR required — <reason>" explicitly)
- [x] The `0000-<slug>` placeholder comment is gone; any remaining peril without a landed ADR records an explicit "No ADR required — <reason>" line (the documented remedy), not a placeholder
- [x] `spec analyze` no longer reports DECISION-PENDING-EXPLORATION for this file (echo before/after evidence in the PR description)
- [x] No citation to a file renamed by the in-flight renumber wave is introduced (the 10 renamed stems are listed in `task-renumber-colliding-doc-numbers`; verify your citation targets exist at merge time)
- [x] `npm test`, `npm run build`, `npm run check:plugin` and `npm run lint` green
- [x] Do not touch either baseline JSON (`ArggonManager/spec-analyze-baseline.json`, `ArggonManager/spec-analyze-baseline-release-pipeline-015.json`) — re-baselining is owned by `task-release-pipeline-baseline-new-collisions` AFTER this lands

### 2026-10-11 @ses_ed6cf4c8dffeBceB5jc5D36KYp

Evidence (maker, 2026-10-11) — Decision-section fix for docs/explorations/exploration-methodology-improvements-014.md, PR #679 (branch feat/task-decision-pending-methodology-improvements-014, commit be4d7639).

What changed (Decision section ONLY — diff is 3 insertions/4 deletions; an unrelated F3 line that drifted in the worktree was restored to HEAD so the diff stays on scope):

- C1: linked [ADR 0015](../adr/0015-done-gate-acceptance-waiver.md) — verified on disk: Status Accepted, Date 2026-09-29, Programme "task-done-gate-acceptance-waiver (C1 of exploration-methodology-improvements-014)"; noted its 2026-10-06 amendment by ADR 0025.
- C3: VERIFIED a landing spec exists — docs/specs/spec-analyze-decision-gaps-013.md (status: implemented) is the detector this exploration proposed. Linked it AND recorded an explicit "No ADR required — it extends the existing report-only scanner under spec-analyze-004's invariants…" line (the documented remedy, not a placeholder).
- Removed the "<!-- ADR reference placeholder: … 0000-<slug> -->" comment. C2/C5 "no ADR yet" + C4 waits on ADR 0016 (linked, already landed) retained in prose; the section now satisfies decisionSectionHasAdrRef/decisionSectionHasNoAdrMarker (cli/src/spec.ts:885-908). None of the 10 renumber-wave stems cited.

spec analyze --baseline ArggonManager/spec-analyze-baseline.json:

- BEFORE: 6 new, 1 resolved, 5 unchanged, 11 total, exit 1 — included "exploration-methodology-improvements-014.md:163 … after 12 day(s) … [DECISION-PENDING-EXPLORATION]".
- AFTER: 5 new, 1 resolved, 5 unchanged, 10 total, exit 1 — the DECISION-PENDING-EXPLORATION finding is GONE. Expected residual: the 5 duplicate-doc-number NEWs are the renumber wave's (task-renumber-colliding-doc-numbers), plus exit 1 until both land.

Gates (all green): npm test 2858 passed (134 files; note: build must run first in this worktree, headless-ci.test.ts asserts dist/cli.js); npm run build 0; npm run check:plugin 0 (bundle diff clean); npm run lint 0; tools.arggon validate ok 0/0; spec validate ok (only the 5 pre-existing renumber warnings).

Baselines untouched; acceptance boxes ticked in the item body (6/6).

### handoff 2026-10-11 @ses_ed6cf4c8dffeBceB5jc5D36KYp (session: ses_ed6cf4c8dffeBceB5jc5D36KYp) — next: Review + merge PR #679 (branch feat/task-decision-pending-methodology-improvements-014); delivery lead flips to done after merge — lanes stay red until the renumber wave lands its 5 duplicate-doc-num…

- branch: feat/task-decision-pending-methodology-improvements-014
- open questions: None from maker: C3 ADR question closed with explicit 'No ADR required' + linked implemented spec-analyze-decision-gaps-013.
