---
type: task
status: done
id: task-release-pipeline-baseline-new-collisions
title: "`story-release-pipeline` baseline reads the 5 new duplicate-doc-number findings as NEW, so its next `--baseline` wave would exit 1"
assignee: arggon-delivery-lead
branch: feat/task-release-pipeline-baseline-new-collisions
parent: story-release-pipeline
labels: [spec-pipeline]
created: "2026-10-03"
updated: "2026-10-11"
depends_on: [task-renumber-colliding-doc-numbers]
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-release-pipeline-baseline-new-collisions.md
  Leaves live only under a story. id is the filename stem: task-release-pipeline-baseline-new-collisions.
  CLI `arggon create task release-pipeline-baseline-new-collisions` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `story-release-pipeline` baseline reads the 5 new duplicate-doc-number findings as NEW, so its next `--baseline` wave would exit 1

## Context

<!-- Why this task exists. -->

## Acceptance

- [x] Decide: re-baseline AFTER the corpus renumber lands (preferred — the findings become resolved rather than baselined away), or pin `--no-fail-on-new` for the affected runs with a recorded reason — **decided: re-baseline.** The renumber (#680), the decision fixes (#679 via `task-decision-pending-methodology-improvements-014` + `bug-aged-exploration-decisions`) and the spec-deps error path (#686) all landed, so both baselines now carry only genuinely-resolved entries as `resolved`. No `--no-fail-on-new` pin was used anywhere.
- [x] If re-baselined: the commit message names which findings were baselined and why, so a future reader can tell a real regression from a known-clean state — see the commit body's per-entry table.
- [x] Both baselines are handled, not just the story-scoped one — both `ArggonManager/spec-analyze-baseline.json` (repo root, the shared ADR 0017 gate) and `ArggonManager/docs/specs/spec-analyze-baseline-release-pipeline-015.json` (story-scoped) re-saved in the same run.
- [x] Never a blanket refresh: the whole per-file diff is a removal of exactly the two entries the fixes closed (`spec-deps-001.md` no-error-path, `exploration-ui-improvements-012.md` DECISION-PENDING-EXPLORATION); the 4 surviving entries are byte-identical, so nothing was absorbed or hidden.
- [x] `spec analyze --baseline ArggonManager/spec-analyze-baseline.json` exits **0** on a clean `main` — today it exits 1, which is a red gate on the default branch — both lanes read `0 new, 2 resolved, 4 unchanged, 4 total` pre-re-save and `0 new, 0 resolved, 4 unchanged, 4 total` after; exit 0 in both cases (the pre-re-save run already exited 0 — it was 1 only between PR #603 and the renumber landing).
- [x] All 5 `duplicate-doc-number` findings are gone (via `task-renumber-colliding-doc-numbers`), not absorbed by re-saving the baseline. Widening the baseline makes the gate green without fixing anything — verified: the 5 pairs were never baseline entries; the renumber (#680) removed the findings from the corpus, the re-save only records that.
- [x] Whether `main` exiting 1 on this lane is surfaced anywhere a human sees before merge — **no.** Evidence on the item; the option that would have caught it is named there.
- [x] The cross-story coupling is recorded where it bites: the ADR 0017 zero-NEW gate is global, so any story's stale baseline entry blocks any other story's implementation tasks — the coupling note is recorded on this item (2026-10-11 comment, §Cross-story coupling); writing it onto `task-friction-capture-command` itself is a one-line note on a file outside this item's scope, so it is raised as a follow-up for the delivery lead rather than smuggled into this diff.
- [x] If re-saving the baseline is ever chosen, record the decision and its reason — the current temptation is to make the gate green by widening the net — the decision and its reason are recorded on this item (see the 2026-10-11 comment), together with the explanation of why this is not "widening the net".

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Knock-on of PR #603 (bug-spec-analyze-does-not-detect-duplicate-doc-numbers), found by that PR's worker and confirmed by its reviewer, 2026-10-03.

**TWO committed baselines read the five new duplicate-doc-number findings as NEW**, so both `--baseline` wave gates would exit 1 on pre-existing findings rather than regressions:

1. `story-release-pipeline`'s own baseline, `spec-analyze-baseline-release-pipeline-015.json`
2. **the repo-root baseline `ArggonManager/spec-analyze-baseline.json`** — the reviewer's correction; the PR and its follow-up item named only the first

Both PR #603's worker and its reviewer left them untouched, for the same sound reason: refreshing a baseline erases the record that findings existed. The recorded lesson (PR #599) is exactly this — `findingKey` embeds the age, so baselining away a finding hides it rather than closing it. That call belongs here, not in either PR.

Acceptance:

- [x] Decide: re-baseline AFTER the corpus renumber lands (preferred — the findings become resolved rather than baselined away), or pin `--no-fail-on-new` for the affected runs with a recorded reason
- [x] If re-baselined: the commit message names which findings were baselined and why, so a future reader can tell a real regression from a known-clean state
- [x] Both baselines are handled, not just the story-scoped one
- [x] Never a blanket refresh: `agents.md` documents `--baseline` as the NEW-findings wave gate
- [x] Depends on task-renumber-colliding-doc-numbers, not on the detector landing

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q

### 2026-10-06 @arggon-delivery-lead — reproduction on `main`, and a second consequence

The item's title frames this as a **future** wave exiting 1. It is stronger than that: **`main` exits 1 today.**

Reproduction on a clean `main`:

```
$ npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json
5 new, 1 resolved, 5 unchanged, 10 total
real exit code: 1
```

All 5 NEW are `[duplicate-doc-number]`, and they are exactly the 5 pairs this item names:

| doc                                     | collision                                       |
| --------------------------------------- | ----------------------------------------------- |
| `exploration-cheap-path-to-prod-001.md` | ↔ `exploration-token-context-efficiency-001.md` |
| `plan-deps-001.md`                      | ↔ `plan-sync-001.md`                            |
| `spec-deps-001.md`                      | ↔ `spec-sync-001.md`                            |
| `plan-release-pipeline-015.md`          | ↔ `plan-update-channel-015.md`                  |
| `spec-release-pipeline-015.md`          | ↔ `spec-update-channel-015.md`                  |

The same 5 surface as `DOC_NUMBER_COLLISION` warnings from `spec validate`, so the two surfaces agree — this is one defect seen twice, not two defects.

### The second consequence, not recorded here before

This baseline failure is now **blocking an unrelated chain**. The ADR 0017 gate requires zero NEW findings before an implementation task is claimed, so the 5 NEW findings gate `task-friction-capture-command` (T1) in `story-adopter-feedback`, whose own PR #586 merged clean. A `story-release-pipeline` doc-number collision is holding an `adopter-feedback` implementation task hostage, and neither story records the link.

That is the argument for treating this as more than bookkeeping: the baseline is a shared gate, so a stale entry in one story's corpus silently blocks another.

### Acceptance additions

- [x] `spec analyze --baseline ArggonManager/spec-analyze-baseline.json` exits **0** on a clean `main` — today it exits 1, which is a red gate on the default branch
- [x] All 5 `duplicate-doc-number` findings are gone (via `task-renumber-colliding-doc-numbers`), not absorbed by re-saving the baseline. Widening the baseline makes the gate green without fixing anything
- [x] Whether `main` exiting 1 on this lane is surfaced anywhere a human sees before merge. A required-check failure would have caught it; `spec analyze` evidently is not one
- [x] The cross-story coupling is recorded where it bites: the ADR 0017 zero-NEW gate is global, so any story's stale baseline entry blocks any other story's implementation tasks
- [x] If re-saving the baseline is ever chosen, record the decision and its reason — the current temptation is to make the gate green by widening the net

### 2026-10-11 @arggon-maker

### 2026-10-11 @arggon-maker (task-release-pipeline-baseline-new-collisions, branch feat/task-release-pipeline-baseline-new-collisions)

Re-saved BOTH committed spec-analyze baselines with `npm run arggon -- spec analyze --save-baseline <file>`. The mechanism is deterministic and idempotent (re-saving twice produced the identical sha256 `6b011739…` on both files), and no `--no-fail-on-new` pin was used anywhere.

## Decision: re-baseline after the corpus was made clean, rather than pin `--no-fail-on-new`

Reason: `--no-fail-on-new` would have silenced the ADR 0017 zero-NEW gate for the affected runs while leaving every pre-existing finding in the corpus. That is the "make the gate green by widening the net" outcome this item warned about. The prerequisite items (the renumber `task-renumber-colliding-doc-numbers` = PR #680, the decision fixes PR #679 / `bug-aged-exploration-decisions`, the error path `task-spec-deps-022-no-error-path` = PR #686) have all merged, so the honest state is now recordable: re-save the snapshots so they describe the corpus as it actually is.

Important scope correction: **the re-save is not what fixes the gate, and it is not a widening.** It only rewrites two files that had drifted behind the corpus. Both `--baseline` lanes already read `0 new` on a clean `main` BEFORE this change (verified: `0 new, 2 resolved, 4 unchanged, 4 total`, exit 0). The 5 `duplicate-doc-number` findings were never baseline entries — they are findings that existed in the corpus and were removed by the renumber (#680). The re-save records that removal; it did not cause it.

## Entry-by-entry before/after (both baselines — they were byte-identical before and are byte-identical after)

Before (`count: 6`, sha256 `0847f354…`, both files) → after (`count: 4`, sha256 `6b011739…`, both files). The whole diff is 2 deletions, 0 insertions:

| #   | Entry (before)                                                                                                                            | After                   | Why                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `ArggonManager/docs/explorations/exploration-ui-improvements-012.md:165` — `DECISION-PENDING-EXPLORATION`, "…no decision after 9 day(s)…" | **dropped as RESOLVED** | `bug-aged-exploration-decisions` (#679) recorded the refrain: the Decision section now carries `No ADR required — the recommendation was an **execution plan inside the packages that already exist**…` (with a rationale, so it cannot be a bare marker). Genuine resolution.                                                                               |
| 2   | `ArggonManager/docs/specs/spec-deps-001.md` — `no-error-path`, no line                                                                    | **dropped as RESOLVED** | PR #680 renumbered the doc to `spec-deps-022.md` and PR #686 (`task-spec-deps-022-no-error-path`) added section 5 `Especificación de errores` with per-surface error conditions, `error.code` and exit codes. The spec now publishes an error/failure path. Genuine resolution, not a rename hiding it (verified by reading §5, not just by the key change). |
| 3   | `ArggonManager/docs/specs/spec-opencode-seam-010.md` — `no-error-path`                                                                    | **unchanged, kept**     | Still a real, open finding, still baselined.                                                                                                                                                                                                                                                                                                                 |
| 4   | `ArggonManager/docs/specs/spec-opencode2-009.md:14` — `vague-quantifier` 'efficient'                                                      | **unchanged, kept**     | Still a real, open finding, still baselined.                                                                                                                                                                                                                                                                                                                 |
| 5   | `ArggonManager/docs/specs/spec-spec-import-openspec-005.md:117` — `vague-quantifier` 'several'                                            | **unchanged, kept**     | Still a real, open finding, still baselined.                                                                                                                                                                                                                                                                                                                 |
| 6   | `ArggonManager/docs/specs/spec-spec-import-openspec-005.md:131` — `vague-quantifier` 'several'                                            | **unchanged, kept**     | Still a real, open finding, still baselined.                                                                                                                                                                                                                                                                                                                 |

Every entry is accounted for: no unexplained appearance, no unexplained disappearance. Nothing was covertly absorbed into the baseline — the 2 removed entries are the 2 findings the merged fix items closed, and the 4 survivors are the 4 findings that are genuinely still open. A regression against this state (a 5th, NEW finding) still exits 1 — proved with a negative control: dropping one entry into a scratch copy and comparing against it gave `1 new, 0 resolved, 3 unchanged, 4 total`, exit 1.

Note on the item's expectation: it also predicted drops for `exploration-methodology-improvements-014`. That exploration's DECISION-PENDING-EXPLORATION finding is likewise now resolved (`bug-aged-exploration-decisions`; its Decision links ADR 0015 and ADR 0025), but it was **never a baseline entry** — it surfaced as NEW only on 2026-10-11 (`after 12 day(s)`), after both snapshots were taken. So it needs no baseline edit; it appears in neither before nor after, which is consistent with the table above.

## Verification runs

Pre-re-save, on the clean tree (worktree == `origin/main` for `ArggonManager/docs` + the baseline file, confirmed by `git diff --stat origin/main`):

```
$ npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json
resolved warn ArggonManager/docs/specs/spec-deps-001.md: no error/failure path mentioned anywhere in the spec [no-error-path]
resolved warn ArggonManager/docs/explorations/exploration-ui-improvements-012.md:165: Decision section records no decision after 9 day(s) … [DECISION-PENDING-EXPLORATION]
arggon spec analyze vs baseline …/ArggonManager/spec-analyze-baseline.json: 0 new, 2 resolved, 4 unchanged, 4 total
real exit code: 0
```

The same output and exit code on the story-scoped lane (`docs/specs/spec-analyze-baseline-release-pipeline-015.json`), and the identical `resolved` pair.

Post-re-save, both lanes: `0 new, 0 resolved, 4 unchanged, 4 total`, exit 0. Both baselines were re-verified byte-stable across a second `--save-baseline` run (deterministic).

Cross-scan sanity: a bare `spec analyze` (no baseline) reports exactly those 4 findings across 23 specs — so the baseline is a faithful record of the current corpus and not a truncated view of it.

## Is `main` exiting 1 on this lane surfaced anywhere a human sees before merge? — No.

Evidence, no code changed (this item is docs-only):

- `spec analyze` appears in **no** GitHub workflow: `grep -rn "spec analyze" .github/` returns nothing. `.github/workflows/ci.yml` runs `npm ci`, a version guard, `npm run build`, `npm run check:plugin`, `npm test`, `npm run lint`, `npm run test:structure`, `npm run lint:structure`, `npm run smoke:native-start-cold`, `npm run smoke:worktree-playwright`, and a separate `ui-smoke` job — the zero-NEW spec lane is not among them.
- The only **required** status check on `main` is `cli` (`gh api repos/{owner}/{repo}/branches/main/protection` → `required_status_checks.contexts: ["cli"]`). Since `spec analyze --baseline` is not a step in the `cli` job, nothing makes it required.
- There is no pre-commit hook (`.husky` / `core.hooksPath` absent), so it is not caught locally either.
- The 2026-10-06 note in this item is a human/agent manual reproduction — that is the only surface that ever saw it.

**The option that would have caught it:** add a blocking step to the existing `cli` job in `.github/workflows/ci.yml` — e.g. `- run: npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json` next to `npm run lint`. The job is already required on `main`, so it would have failed the check on the PR that merged PR #603 (the PR whose detector change made the 5 findings visible). That is a workflow change, outside this item's two-file scope, so it is recorded here as the recommendation rather than done.

Alternative, weaker: promote `spec analyze` to the `arggon` workflow's validate job, which is also model-free and headless. But that job runs a _released_ install of the bin, not this checkout's build, so a detector change cannot be gated there until it ships — the `cli` job is the correct home.

## Cross-story coupling — record where it bites

The repo-root baseline `ArggonManager/spec-analyze-baseline.json` is the **global** ADR 0017 zero-NEW gate: any agent claiming any implementation task in any story runs it, and `--baseline` is the shared snapshot for the whole `docs/` corpus, not one story's specs. There is no per-story segmentation in the file. So a stale entry — or a NEW finding produced by a doc-number change in **any** story — blocks implementation tasks in **every** other story.

That already happened, as this item records: a `story-release-pipeline` doc-number collision blocked `task-friction-capture-command` (T1) in `story-adopter-feedback`, whose own PR #586 merged clean. Neither story recorded the link. Practical consequence: **any story that renames or renumbers a doc must re-check both baselines before claiming an implementation task in another story.**

Where it bites: `task-friction-capture-command` (the item that was held hostage) still carries no note of this coupling, because writing it there would edit a file outside this item's scope. It is the right one-line home for the note and is raised here as a follow-up for the delivery lead.

## Gates (run in the worktree, all green)

- `npm run build` — exit 0 (`43 modules inlined, 481091 bytes` plugin bundle rebuilt)
- `npm run check:plugin` — exit 0 (committed bundle matches source)
- `npm test` — exit 0
- `npm run lint` — exit 0
- `npm run arggon -- validate --json` — `ok: true`, 0 errors, 0 warnings

## Scope

Only the two baseline JSONs changed, plus this item's own body for the acceptance boxes. No other file, no renames, no `--no-fail-on-new` anywhere. Findings that outlive this item (the CI wiring recommendation, the note on `task-friction-capture-command`) are recorded above for the delivery lead to file, not grown into this diff.

### handoff 2026-10-11 @arggon-maker (session: ses_ed6473c63ffeEVG02Y7n4bB9MS) — next: Review + merge PR #690 (both baselines re-saved, 2 resolved entries dropped). Then file the 2 out-of-scope follow-ups recorded on the item: the CI lane step in .github/workflows/ci.yml, and the cross…

- branch: feat/task-release-pipeline-baseline-new-collisions
- open questions: Should the CI wiring follow-up be a task or a bug under story-spec-pipeline? Does the delivery lead want the note on task-friction-capture-command, or is recording it here enough?
- [x] `spec analyze --baseline ArggonManager/spec-analyze-baseline.json` exits **0** on a clean `main` — today it exits 1, which is a red gate on the default branch
- [x] All 5 `duplicate-doc-number` findings are gone (via `task-renumber-colliding-doc-numbers`), not absorbed by re-saving the baseline. Widening the baseline makes the gate green without fixing anything
- [x] Whether `main` exiting 1 on this lane is surfaced anywhere a human sees before merge. A required-check failure would have caught it; `spec analyze` evidently is not one
- [x] The cross-story coupling is recorded where it bites: the ADR 0017 zero-NEW gate is global, so any story's stale baseline entry blocks any other story's implementation tasks
- [x] If re-saving the baseline is ever chosen, record the decision and its reason — the current temptation is to make the gate green by widening the net

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merge (PR #690)

Reviewed against engineering.md §Review bar: the change is exactly the recorded decision (re-baseline after the corpus was made clean, not a blanket refresh, not `--no-fail-on-new` pinning); the entry-by-entry before/after shows 2 deletions and 0 insertions — the 2 findings the fixes actually closed (exploration-ui-improvements-012 DECISION-PENDING via PR #679, spec-deps-001 no-error-path via #680 renumber + #686 §5) — while the 4 genuinely-open findings persist; the deviation from my predicted diff was REPORTED rather than committed away (the 5 duplicate-doc-number keys and the 014 key were never baseline entries — they were NEWs that the renumber/decision fixes removed, and both lanes already read 0 new before the re-save); verification includes a negative control (a removed entry reads back as 1 new, exit 1 — the gate still bites); gates green. The recorded answer to the surfacing question (no workflow runs spec analyze; only `cli` is required) is filed as task-ci-required-check-missing-spec-analyze-baseline.
