---
type: task
status: done
id: task-spec-deps-022-no-error-path
title: "spec-deps-022.md publishes no error/failure path — the renumber wave relocated a pre-existing no-error-path finding and main's baseline lane now reads it as NEW"
assignee: arggon-delivery-lead
branch: feat/task-spec-deps-022-no-error-path
parent: story-spec-pipeline
labels: [spec-pipeline, docs]
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-deps-022-no-error-path.md
  Leaves live only under a story. id is the filename stem: task-spec-deps-022-no-error-path.
  CLI `arggon create task spec-deps-022-no-error-path` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec-deps-022.md publishes no error/failure path — the renumber wave relocated a pre-existing no-error-path finding and main's baseline lane now reads it as NEW

## Context

After the renumber wave (PR #680) and the decision-pending fix (PR #679) landed, `spec analyze --baseline ArggonManager/spec-analyze-baseline.json` on clean main reads **1 new, 2 resolved, 4 unchanged, exit 1**. The single NEW finding is a _relocation_, not a new defect: the pre-existing `no-error-path` finding recorded against `spec-deps-001.md` (resolved by the rename) reappears against the renamed `spec-deps-022.md`, which still published no error/failure path. This task fixes the spec, so re-baselining records a clean state instead of hiding one (`task-release-pipeline-baseline-new-collisions`).

## Acceptance

- [x] `spec analyze` (fresh, no `--baseline`) no longer reports `no-error-path` for `docs/specs/spec-deps-022.md` (before/after evidence in the PR)
- [x] The fix is a real failure-path section describing the spec's error/failure behavior — §5 `Especificación de errores` (table + caller obligations), matching the `spec-sync-001.md` house idiom and citing `lib/src/update.ts`, `lib/src/validate.ts`, `lib/src/filter.ts`, `ArggonManager/docs/convention.md` and `ArggonManager/docs/json-output.md`
- [x] No changes to either baseline JSON and no renumber-style renames (diff is the single spec file: §5 added, the old §5/§6 renumbered to §6/§7, plus the dated renumber-note amendment)
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok

## Notes

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** After the renumber wave landed (PR #680) and the decision-pending fix (PR #679), `spec analyze --baseline ArggonManager/spec-analyze-baseline.json` on clean main reads: **1 new, 2 resolved, 4 unchanged, exit 1**. The single NEW finding is a _relocation_, not a new defect: the same pre-existing `no-error-path` finding recorded against `spec-deps-001.md` (now resolved by the rename) reappears against the renamed `spec-deps-022.md` — the spec still publishes no error/failure path anywhere.

This finding must be FIXED (or explicitly justified as not applicable), not baselined: `task-release-pipeline-baseline-new-collisions` re-saves both baselines after this lands, and its recorded rule is that re-baselining must record a clean state, never hide one.

Acceptance:

- [x] `spec analyze` (fresh, no --baseline) no longer reports `no-error-path` for `docs/specs/spec-deps-022.md` (before/after evidence in the PR)
- [x] The fix is a real failure-path section describing the spec's error/failure behavior, OR an explicit, cited justification that the spec's domain has no failure path (check how sibling specs satisfy this rule and match that idiom — do not write theater text)
- [x] No changes to either baseline JSON (owned by the baseline item) and no renumber-style renames
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok

### 2026-10-11 @arggon-maker

Maker evidence (branch feat/task-spec-deps-022-no-error-path, commit 58c0e4fc, PR https://github.com/Arggon/ArggonManager/pull/686).

CHANGE — ArggonManager/docs/specs/spec-deps-022.md only (+44/-3):

1. New "## 5. Especificación de errores": a per-surface table (superficie / condicion / mensaje + error.code / exit code) plus "lo que ve y debe hacer el caller". Every row is grounded in the shipped code, not theater:
   - update: empty --add-depends-on and an unknown depends_on id fail BEFORE the item file is mutated (lib/src/update.ts:483 throws `depends_on id '<id>' does not resolve to an existing item`; UPDATE_FAILED; exit 1 via lib/src/operations.ts fail()).
   - validate: SELF_DEPENDENCY / UNKNOWN_DEPENDENCY / DEPENDENCY_CYCLE arrive in errors[] ({path,message,code}) with ok:false and error.code VALIDATE_FAILED, exit 1 (lib/src/validate.ts:166-236); each cycle is reported once, anchored at its lexicographically smallest member, plus the documented caveat that WHICH cycles a report names is traversal-order dependent (docs/convention.md "Dependency graph (v3)") — consumers rely on the verdict and the per-cycle chains.
   - list: malformed filter tokens fail with `bad filter token ...` / `unknown filter field ...` / `empty value in filter token ...`, LIST_FAILED, exit 1 (lib/src/filter.ts:84-106).
   - Prose on the near-misses: advisory blocking never fails update; an unknown dep counts as open so next degrades instead of breaking (the inverse passes downstreamWeight / blocked-by index are cycle-safe); an empty pool is suggestion:null with ok:true; a v0-v2 tree without the field validates clean.
2. Sections renumbered in kind (JSON contract 5->6, acceptance 6->7); the renumber note is amended with a dated Update (2026-10-11) so "Spec content unchanged" stays honest; one new acceptance row in section 7 covers section 5.
3. House idiom matched to the Spanish sibling spec-sync-001.md ("## 7. Especificación de errores" table). No other file touched: both baselines untouched, no renames, no code change.

BEFORE/AFTER — `npm run arggon -- spec analyze` (fresh, no --baseline, in the worktree):

    before: warn ArggonManager/docs/specs/spec-deps-022.md: no error/failure path mentioned anywhere in the spec [no-error-path]
            arggon spec analyze: 5 finding(s) across 23 spec(s) — report only, nothing was edited
    after:  arggon spec analyze: 4 finding(s) across 23 spec(s) — report only, nothing was edited   (exit 0; no spec-deps-022 finding)

Bonus lane evidence: `npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json` on this branch reads "0 new, 2 resolved, 4 unchanged, 4 total" (exit 0) instead of the relocated "1 new ... exit 1" — so task-release-pipeline-baseline-new-collisions can re-baseline a clean state.

GATES (worktree; npm run build ran first because headless-ci asserts dist/ exists):

    npm test ............ 134 files / 2858 tests passed, 5 skipped. The first run (before build) failed ONLY on the pre-existing headless-ci "run `npm run build` first" assertion; green after the build.
    npm run build ....... ok (incl. build:plugin — 43 modules, index.bundle.ts byte-identical)
    npm run check:plugin  ok
    npm run lint ........ ok (eslint, no findings)
    arggon validate ..... ok (0 warning(s), convention v5)

Item not flipped to done — completion is the delivery lead's call after merge.

### handoff 2026-10-11 @arggon-maker — next: Merge PR #686, then let task-release-pipeline-baseline-new-collisions re-save both baselines: spec analyze now reads 0 new / 2 resolved / 4 unchanged (exit 0) instead of 1 new.

- branch: feat/task-spec-deps-022-no-error-path
- open questions: Does the delivery lead want an acceptance row added in spec-deps-022 §7 for the filter-token row too, or is the §5 reference row enough?;Should spec-opencode-seam-010.md (the other no-error-path surv…

### 2026-10-11 @arggon-maker

Out-of-scope observation for the delivery lead (NOT filed as an item, NOT fixed here): spec-opencode-seam-010.md is the other surviving no-error-path finding on spec analyze (spec-opencode2-009.md and spec-spec-import-openspec-005.md carry the 3 vague-quantifier warnings). Fixing it is separate work — the delivery lead decides whether it becomes its own item under story-spec-pipeline. Also note the handoff open-questions field capped at 200 chars, so the truncated tail was: "Should spec-opencode-seam-010.md (the other no-error-path survivor) get its own follow-up item?"

### 2026-10-11 @arggon-maker

Out-of-scope observation for the delivery lead (NOT filed as an item, NOT fixed here): spec-opencode-seam-010.md is the other surviving no-error-path finding on spec analyze (spec-opencode2-009.md and spec-spec-import-openspec-005.md carry the 3 vague-quantifier warnings). Fixing it is separate work — the delivery lead decides whether it becomes its own item under story-spec-pipeline. Also note the handoff open-questions field capped at 200 chars, so the truncated tail was: "Should spec-opencode-seam-010.md (the other no-error-path survivor) get its own follow-up item?"

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merged (PR #686)

Reviewed against engineering.md §Review bar: scope stayed on the item (one spec + its own body); the fix is a real, code-grounded error-handling section (per-surface error.code table citing update/validate/list implementations), matching the house idiom found in spec-sync-001.md, and the renumber note was amended with a dated Update so "Spec content unchanged" stays honest — the docs travel with the change; evidence travels with it (spec analyze before: the no-error-path finding, 5 findings, exit 1; after: 4 findings, exit 0; bonus: the --baseline lane on this branch reads 0 new); gates + CI green; baselines untouched per constraint.
