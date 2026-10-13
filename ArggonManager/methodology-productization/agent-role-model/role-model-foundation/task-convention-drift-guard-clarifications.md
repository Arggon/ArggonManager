---
type: task
status: done
id: task-convention-drift-guard-clarifications
title: "Convention option-drift guard clarifications: marker scoping, mismatch message, duplicate-dispatch hazard"
assignee: arggon-delivery-lead
branch: feat/task-convention-drift-guard-clarifications
parent: role-model-foundation
labels: [tests, docs, cli]
created: "2026-10-13"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-convention-drift-guard-clarifications.md
  Leaves live only under a story. id is the filename stem: task-convention-drift-guard-clarifications.
  CLI `arggon create task convention-drift-guard-clarifications` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Convention option-drift guard clarifications: marker scoping, mismatch message, duplicate-dispatch hazard

## Context

Three non-blocking notes from the standards review of `bug-x-tracker-option-list-has-no-doc-drift-guard` (merged as PR #759): (a) the `undocumented-by-design` marker is line-scoped (`line.includes(marker)`) rather than branch-scoped — the doc says "on its parse branch" without saying the branch's first line; (b) a marked-but-doc-mismatched boolean reads as a kernel mismatch, so the failure message can misattribute; (c) `readKernelSections` keys sections by name and `sections.set` overwrites, so a future duplicate dispatch would drop the first block's keys — currently fail-loud via the one-branch-per-option assertion.

## Acceptance

- [x] convention.md + the suite message state the marker's exact scope (line-level, and which line)
- [x] the mismatch message distinguishes "kernel has an extra option" from "doc names an option the kernel lacks"
- [x] the duplicate-dispatch hazard is impossible or pinned by an explicit test/comment
- [x] `npx vitest run cli/src/convention-option-doc-contract.test.ts` green; `arggon validate` ok

## Notes

### 2026-10-13 @ses_eca4ef96fffetnKma4I21dSuAY
## Delivery evidence (arggon-maker)

Change on branch `feat/task-convention-drift-guard-clarifications` (PR #780): one test file (`cli/src/convention-option-doc-contract.test.ts`) + one doc clause (`ArggonManager/docs/convention.md` §Tracker hygiene).

### Decisions
1. Marker scope: DESCRIBED as line-scoped, not tightened. `undocumented-by-design` is read off the same source line as the option's `key === "…"` / `key !== "…"` comparison; a marker elsewhere in the block does not exempt and rule 2 fails loud. A branch-scoped walk would need block-structure parsing in a line walker and would silently widen the exemption.
2. Mismatch message: rule 3 classifies each mismatched name by side — kernel boolean missing from the sentence; kernel boolean that is exempt (the sentence must not name it); a sentence name the kernel does not validate as a boolean (or reads not at all). Rule 2's message now names the marker's exact line.
3. Duplicate dispatch: made impossible by merging a repeated section's blocks into ONE bucket (split handlers read all keys; a key re-listed in both blocks stays visible to the one-branch-per-option assertion), and pinned by a premise test that fails against the old overwrite.

### Gates (worktree)
- `npx vitest run cli/src/convention-option-doc-contract.test.ts`: 19/19 (18 original + 1 new premise test).
- `arggon validate`: ok, 0 warnings, convention v5.
- `npm run build`: ok (postbuild plugin bundle byte-identical, `git status` unchanged besides the two files).
- `npm test`: 153 files / 3332 tests, 0 failed.
- `npm run lint`: exit 0; `npm run test:structure`: exit 0; `npx prettier --check` on both touched files: clean.

### Negative controls (both reverted; kernel unmodified in the final diff, sha256 verified)
1. Synthetic `future-marked` (marked boolean, wrongly named by the doc's boolean sentence) + `future-open` (unmarked, omitted), added to all three kernel faces: exactly the two doc rules failed. Rule 2's message named the exact marker line; rule 3 distinguished `future-open` ("validated as a boolean by the kernel but missing from the sentence") from `future-marked` ("validated as a boolean by the kernel but exempt — its `key === "…"` line carries `undocumented-by-design`, so the sentence must not name it").
2. Walker reverted to the old `sections.set` overwrite: the new premise test failed on the dropped `first-option`; restored byte-identical.

Derivation property kept: no option name added to the test — literals remain the SECTIONS table (structure) and the marker string.

### handoff 2026-10-13 @ses_eca4ef96fffetnKma4I21dSuAY (session: ses_eca4ef96fffetnKma4I21dSuAY) — next: Delivery lead: review + merge PR #780; maker work complete (gates green, controls reverted, checklist ticked).
- branch: feat/task-convention-drift-guard-clarifications
- open questions: Marker stays line-scoped by decision (documented, not tightened): a marker off the comparison line does not exempt and fails rule 2; templates/docs/** + README bug-note out of scope as in #759

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as 99e51db5 (PR #780); auto-done flip landed. Marker scope documented as line-level with a misplaced-marker premise case; the mismatch message classifies kernel-extra vs doc-extra; duplicate section dispatch is impossible (blocks merged; re-listed keys still fail the one-branch-per-option assertion) and pinned by a new premise test. Focused 19/19, full suite green (CI-equivalent), negative controls reverted and verified.
