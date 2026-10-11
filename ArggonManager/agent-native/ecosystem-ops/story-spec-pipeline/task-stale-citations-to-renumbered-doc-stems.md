---
type: task
status: done
id: task-stale-citations-to-renumbered-doc-stems
title: Residual stale citations to the five renumbered doc stems in other work-item bodies and comment-only code refs
assignee: arggon-delivery-lead
branch: feat/task-stale-citations-to-renumbered-doc-stems
parent: story-spec-pipeline
labels: [spec-pipeline, docs]
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/task-stale-citations-to-renumbered-doc-stems.md
  Leaves live only under a story. id is the filename stem: task-stale-citations-to-renumbered-doc-stems.
  CLI `arggon create task stale-citations-to-renumbered-doc-stems` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Residual stale citations to the five renumbered doc stems in other work-item bodies and comment-only code refs

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** Task-renumber-colliding-doc-numbers (PR #680) renamed 5 documents and updated 6 citation files, but ~40 files across the repo cited those stems. The residual stale references sit in files the renumber's own acceptance barred ("do not touch other work items' files"): other tracker work-item bodies, and comment-only code refs flagged by the renumber maker: `board`/`filter`/`list`/`next` tests, `cli/src/commands/next.ts:32`, `cli/src/commands/spec.ts:309`, and `adopt.test.ts` fixtures. The 5 old stems now dangling: `exploration-cheap-path-to-prod-001`, `spec-deps-001`, `plan-deps-001`, `spec-update-channel-015`, `plan-update-channel-015`.

**Why now.** A dangling citation in a work-item body is future-friction fuel — the exact defect class this repo's reverse-feedback channel exists to capture. Cheap to fix while the rename is fresh.

Acceptance:
- [x] Every file under `ArggonManager/` (tracker item bodies) and `cli/` that references one of the 5 old stems is updated to the renamed target, or recorded as harmless fixture data with a reason (fixtures that never assert on the stem)
- [x] The renamed targets are the ones that landed: exploration-cheap-path-to-prod-026.md, spec-deps-022.md, plan-deps-019.md, spec-update-channel-023.md, plan-update-channel-020.md
- [x] Baseline JSONs are NOT touched (owned by task-release-pipeline-baseline-new-collisions)
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok
- [x] Verification evidence (grep counts before → after, per stem) committed as a comment on this item

### 2026-10-11 @ses_ed6739347ffeW6uEKPbGppaiXb
## Verification — task-stale-citations-to-renumbered-doc-stems

**Per-stem occurrence counts** (non-protected, non-generated; .git/node_modules/dist/build + both baseline JSONs excluded):

| old stem | before | after | updated |
|---|--:|--:|--:|
| `exploration-cheap-path-to-prod-001` | 13 | 8 | 5 |
| `spec-deps-001` | 21 | 13 | 8 |
| `plan-deps-001` | 7 | 7 | 0 |
| `spec-update-channel-015` | 10 | 7 | 3 |
| `plan-update-channel-015` | 10 | 6 | 4 |

20 occurrences updated across 12 files (18 lines; `task-update-channel-spec` lines 61/65 each carry both a spec and a plan stem). Diff is stem-only (git diff --stat = 18+/18-, no formatting churn).

**Decision rule applied.** Update a single-name pointer/citation (a reference to a doc's current location/content — following the rename keeps the statement true). Preserve a record of a property that depended on the old name (collision pairs, rename logs, renumber provenance, resolved-collision snapshots) — swapping one side would fabricate a falsehood — and decorative fixtures.

**Updated (live pointers):** story-deps-schema (spec-deps-001 §2 → spec-deps-022); bug-parity-invariant (spec-deps-001.md:19 → spec-deps-022.md:19); task-explore-agent-primary-role-model (the no-error-path finding relocated WITH the rename to spec-deps-022); bug-engineering-doc-stale-adr-statuses ×3 and task-engineering-doc-restates-more-drifted-facts ×2 (exploration-…-001.md:16 → -026.md:16); bug-spec-analyze cross-pointer docs/plans/plan-update-channel-015.md:100 → 020 (its collision-table rows preserved); task-update-channel-spec (spec→023, plan→020 across Spec:/Plan:/scope-check/handoff); lib/src/next.ts comment (per spec-deps-001 §5 → spec-deps-022); describe titles in cli/src/board.test.ts, lib/src/filter.test.ts, lib/src/list.test.ts, lib/src/next.test.ts (spec-deps-001 → spec-deps-022).

**Deliberate no-ops (kept, with reason):**
1. Renumber provenance in the 5 renamed docs themselves ("originally filed as OLD") — canonical rename record.
2. task-renumber-colliding-doc-numbers body — IS the old→new rename log; rewriting erases it.
3. task-spec-deps-022-no-error-path — narrates spec-deps-001 → spec-deps-022 relocation; both names load-bearing.
4. Collision-pair / collision-snapshot records (bug-spec-analyze list+table, task-release-pipeline-baseline table, task-explore-adopter-feedback table, task-spec-owner-decision-brief "5 pre-existing DOC_NUMBER_COLLISION"): the collisions are now resolved; flipping one side of "X <-> Y" would invent a non-collision. The reviewer's own note in bug-spec-analyze sets the precedent (renumbered incident numbers are "consistent, not a discrepancy").
5. cli/src/spec.ts:309 — comment shows a SAME-number collision EXAMPLE (spec-deps-001.md + spec-sync-001.md, both -001); swapping one side to 022 breaks the equal-number premise. The neutral 0020-alpha/0020-beta pair carries the concept; left as history.
6. cli/src/adopt.test.ts:364,409 — decorative fixture data: writes a tmpdir file and asserts only corpora file COUNT/format; the stem is never asserted and the tmpdir file is unrelated to the real repo doc (per the objective's fixture rule — do not churn).
7. This item's own Context line enumerates the dangling stems as the problem statement — left as written.

**Path correction.** The objective cited cli/src/commands/next.ts:32 and cli/src/commands/spec.ts:309; those command modules no longer exist at that path on this branch. The live refs are lib/src/next.ts:32 (updated) and cli/src/spec.ts:309 (same-number example, preserved); the filter/list/next dependency suites also live under lib/src/.

**Baselines.** Both protected JSONs still carry spec-deps-001 once each (ArggonManager/spec-analyze-baseline.json, ArggonManager/docs/specs/spec-analyze-baseline-release-pipeline-015.json) — NOT touched (owned by task-release-pipeline-baseline-new-collisions); excluded from the sweep.

**Line-number caveat.** Updated file:line refs (e.g. exploration-cheap-path-to-prod-026.md:16) — the renumber prepended a note to each renamed file, so intra-file line numbers may have shifted a few lines. Stems updated per scope; exact line re-derivation deferred to the owning drift item.

**Gates (all green):** arggon validate ok (0 err/0 warn); npm run lint (eslint) clean; npm run build ok; npm run check:plugin exit 0 (bundle unchanged — comments stripped); npm test -> 134 files / 2858 tests passed (run after build; headless-ci requires dist/). Note: the edit tool runs prettier-on-save, which reformatted untouched code/markdown during the first pass — reverted with git checkout and re-applied via raw text edit so the PR stays stem-only.

**Forward-friction found (flag only, not in scope):** task-spec-owner-decision-brief + task-explore-agent-primary-role-model still assert that 5 pre-existing collisions / duplicate-doc-number exist — those snapshots are now stale beyond the stem rename. Left to their owning items.

### handoff 2026-10-11 @ses_ed6739347ffeW6uEKPbGppaiXb (session: ses_ed6739347ffeW6uEKPbGppaiXb) — next: Delivery lead: review branch, open/merge PR for feat/task-stale-citations-to-renumbered-doc-stems (20 stale citations updated, all gates green). Do NOT flip to done until merged.
- branch: feat/task-stale-citations-to-renumbered-doc-stems
- open questions: Accept documented no-ops (spec.ts:309 same-number example; adopt.test.ts decorative fixtures; preserved collision-snapshot bodies)?; some file:line refs may have shifted on renumber.

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merged (PR #688)

Reviewed against engineering.md §Review bar: scope stayed on the item (stem-only updates, no formatter churn — the maker reverted a prettier-on-save sweep and re-applied raw); the judgment calls are documented per-file under a stated decision rule — live single-name pointers updated to follow the rename; records of properties that depended on the old name (collision pairs, renumber provenance, resolved-collision snapshots) preserved because swapping one side fabricates a falsehood; decorative fixtures preserved with reasons. That is the right reading of "update every citation" against "keep the record honest", and the maker corrected my stale paths (lib/src/next.ts:32; cli/src/commands/* no longer exist). Evidence travels with the change (per-stem before→after counts on the item); gates green. The maker also flagged forward-friction: some file:line numbers may have shifted post-renumber, and two items still assert "5 pre-existing collisions" now stale beyond the stem — left to their owning items, acceptable as historical record.
