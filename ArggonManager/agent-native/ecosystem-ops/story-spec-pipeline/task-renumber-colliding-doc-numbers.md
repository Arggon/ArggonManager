---
type: task
status: done
id: task-renumber-colliding-doc-numbers
title: "Renumber the 5 live doc-number collisions in this corpus (exploration -001 x2, spec -001/-015, plan -001/-015) plus every citation"
assignee: arggon-delivery-lead
branch: feat/task-renumber-colliding-doc-numbers
parent: story-spec-pipeline
labels: [spec-pipeline, docs]
created: "2026-10-03"
updated: "2026-10-11"
depends_on: [bug-spec-analyze-does-not-detect-duplicate-doc-numbers]
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/task-renumber-colliding-doc-numbers.md
  Leaves live only under a story. id is the filename stem: task-renumber-colliding-doc-numbers.
  CLI `arggon create task renumber-colliding-doc-numbers` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Renumber the 5 live doc-number collisions in this corpus (exploration -001 x2, spec -001/-015, plan -001/-015) plus every citation

## Context

Surfaced by PR #603 (bug-spec-analyze-does-not-detect-duplicate-doc-numbers), 2026-10-02 — the detector works and immediately found five live collisions in this repo's own corpus (report-only, exit 0, so nothing was failing before it existed):

- \`docs/explorations/\`: exploration \`-001\` x2
- \`docs/specs/\`: spec \`-001\` x2, spec \`-015\` x2
- \`docs/plans/\`: plan \`-001\` x2, plan \`-015\` x2

Ten files plus every citation. Deliberately NOT in that PR: a detector PR that also renumbers ten documents is two changes, and the renumber is mechanical while the detector is the judgment call. They must land in that order (detector first, so the renumber is verifiable against it) — this item depends on that.

The renumber precedent exists and is painful: ADR 0016 carries a renumber note, ADR 0019 carries a "spec-plan 016 renumber" note, and the coordinator collided two ADR 0020s plus two exploration -018s plus two spec/plan -017 pairs in a single wave. Five hand-renumbers is why this detector exists.

## Acceptance

- [x] Depends on PR #603 landing first, so the renumber is verifiable against the detector (record the dependency in frontmatter via \`depends_on\`)
- [x] All 5 collisions resolved; \`arggon spec validate\` and \`spec analyze --baseline\` report 0 duplicate-doc-number findings
- [x] Every citation updated: ADR cross-references, spec \`spec:\` frontmatter, plan links, exploration Decision sections, and any \`docs/\` reference to a renamed file
- [x] Renumber notes recorded in the affected documents, following the existing ADR 0016 / 0019 idiom, so the history is auditable
- [x] The detector finding is NOT made blocking in this PR (per the reviewer's recommendation: land the gate after the corpus is clean, so it does not fire on every commit meanwhile)

## Notes

### 2026-10-11 @arggon-maker
Gate evidence — task-renumber-colliding-doc-numbers (branch feat/task-renumber-colliding-doc-numbers)

spec validate:
  BEFORE: arggon spec: ok (37 doc(s), 5 warning(s))  [5x DOC_NUMBER_COLLISION]
  AFTER:  arggon spec: ok (37 doc(s), 0 warning(s))

spec analyze:
  BEFORE: 11 finding(s) (5x duplicate-doc-number + 6 other)
  AFTER:   6 finding(s) (0x duplicate-doc-number; the 6 pre-existing non-collision findings remain — DECISION-PENDING-EXPLORATION, no-error-path x2 [one now on renamed spec-deps-022], vague-quantifier x3)

spec analyze --baseline (both committed baselines): 0 duplicate-doc-number in new/resolved/unchanged. Only rename-induced churn = the pre-existing no-error-path finding relocating spec-deps-001 -> spec-deps-022 (1 resolved + 1 new); the DECISION-PENDING churn is unrelated time-drift. Baselines left untouched per constraint (owned by task-release-pipeline-baseline-new-collisions).

Renames (old -> new), spec+plan families paired, lighter-cited renumbered per the ADR 0024 precedent:
  exploration-cheap-path-to-prod-001 -> -026        (keep token-context-001)
  spec-deps-001 -> -022      | plan-deps-001 -> -019
  spec-update-channel-015 -> -023 | plan-update-channel-015 -> -020
  (kept spec/plan-sync-001 and spec/plan-release-pipeline-015)

Citations updated (6 files): docs/adr/0005 (link), docs/plans/plan-deps-019 (spec: frontmatter + prose), docs/plans/plan-update-channel-020 (spec: frontmatter + prose), README (dropped the now-resolved collision example + --file path), cli/src/spec.test.ts (copyRealDocs real-doc names — execution-critical for npm test). Renumber notes added to all 5 renamed docs (ADR 0016/0019 idiom). Detector NOT made blocking (spec.ts untouched).

Repo gates: npm test 2858 pass, npm run build ok, npm run check:plugin exit 0, npm run lint exit 0.

OUT OF SCOPE (reported to delivery lead): stale citations to renamed stems remain in OTHER work-item files (tracker items) and comment-only code refs (board/filter/list/next tests, next.ts:32, spec.ts:309, adopt.test.ts fixtures) — not edited per the "do not touch other work items' files" constraint.

### handoff 2026-10-11 @arggon-maker — next: Merge this renumber PR; then task-release-pipeline-baseline-new-collisions re-baselines both analyze baselines (left untouched here per constraint).
- branch: feat/task-renumber-colliding-doc-numbers
- open questions: Route residual stale citations to renamed stems in OTHER work-item files + comment-only code refs (board/filter/list/next tests, next.ts:32, spec.ts:309, adopt.test.ts fixtures) to a follow-up; confi…

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merged (PR #680)

Reviewed against engineering.md §Review bar: scope stayed on the item (renames + citations + execution-critical test-fixture doc names; the maker reverted an inadvertent formatter sweep to keep the diff clean); conventions honored — renumber notes per the ADR 0016/0019 idiom, next-FREE-number scheme documented, spec:/plan frontmatter citations updated, detector left report-only per acceptance box 5; evidence travels with the change (spec validate 5 warnings → 0; spec analyze 11 findings → 6 with 0 duplicate-doc-number; npm gates + CI green); baselines untouched per constraint.

Out-of-scope finding routed: residual stale citations to the renamed stems in other work-item bodies and comment-only code refs → task-stale-citations-to-renumbered-doc-stems (Wave B).
