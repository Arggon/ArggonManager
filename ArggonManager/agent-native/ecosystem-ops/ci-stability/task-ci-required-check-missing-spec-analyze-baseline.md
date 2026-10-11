---
type: task
status: done
id: task-ci-required-check-missing-spec-analyze-baseline
title: No required check runs `spec analyze --baseline` — main exited 1 on the shared ADR 0017 lane for 5 days with zero human-visible signal before merge
assignee: arggon-delivery-lead
branch: feat/task-ci-required-check-missing-spec-analyze-baseline
parent: ci-stability
labels: [ci, spec-pipeline]
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-ci-required-check-missing-spec-analyze-baseline.md
  Leaves live only under a story. id is the filename stem: task-ci-required-check-missing-spec-analyze-baseline.
  CLI `arggon create task ci-required-check-missing-spec-analyze-baseline` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# No required check runs `spec analyze --baseline` — main exited 1 on the shared ADR 0017 lane for 5 days with zero human-visible signal before merge

## Context

`spec analyze --baseline ArggonManager/spec-analyze-baseline.json` — the shared ADR 0017 zero-NEW gate — ran nowhere a human sees before merge. It appeared in **no** GitHub workflow (`grep -rn "spec analyze" .github/` was empty), there is no pre-commit hook, and the only required check on `main` is the `cli` job, which did not run it. The repo-root lane therefore exited 1 on `main` from 2026-10-06 to 2026-10-11 and the only thing that noticed was a manual reproduction in a work-item comment (task-release-pipeline-baseline-new-collisions, whose re-save of both baselines — PR #690 — is what made the lane green on main again).

This item lands the lane as a **blocking step in the already-required `cli` job** of `.github/workflows/ci.yml`, so a NEW finding reddens the check that gates the merge instead of a log nobody reads.

## Acceptance

- [x] A blocking step in the already-required `cli` job of .github/workflows/ci.yml runs `npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json` (the repo-root gate; the release-pipeline-scoped baseline belongs to that story's lane if at all — decide and record why, don't wire both blind)
- [x] The step is verified to bite: a deliberately-removed baseline entry (or a fresh no-error-path style finding) fails the job in a test PR — evidence pasted in the PR description
- [x] Verify the gate uses THIS checkout's build (the released-bin validate job cannot gate detector changes — record why the cli job is the right home)
- [x] No other workflow behavior changed; `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green
- [x] Record on the item what the gate should do when a finding is genuinely pre-existing (the --no-fail-on-new escape needs a recorded reason per the baseline item's rule)

## Notes

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** Recorded by the baseline re-save maker (PR #690): `spec analyze` appears in no workflow (grep over .github/ is empty), there is no pre-commit hook, and the only required check on main is `cli` — which does not run it. So the repo-root baseline lane (the shared ADR 0017 zero-NEW gate) exited 1 on main from 2026-10-06 to 2026-10-11 and the only thing that noticed was a manual reproduction in a work-item comment. This is the "surfaced anywhere a human sees before merge" box of task-release-pipeline-baseline-new-collisions, answered: no.

The renumber item's box 5 deliberately deferred making the duplicate-doc-number finding blocking in ITS PR ("land the gate after the corpus is clean") — the corpus is clean now (0 new on both baselines, PR #690), so landing the gate is the follow-through, not a violation of that call.

Acceptance:

- [x] A blocking step in the already-required `cli` job of .github/workflows/ci.yml runs `npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json` (the repo-root gate; the release-pipeline-scoped baseline belongs to that story's lane if at all — decide and record why, don't wire both blind)
- [x] The step is verified to bite: a deliberately-removed baseline entry (or a fresh no-error-path style finding) fails the job in a test PR — evidence pasted in the PR description
- [x] Verify the gate uses THIS checkout's build (the released-bin validate job cannot gate detector changes — record why the cli job is the right home)
- [x] No other workflow behavior changed; `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green
- [x] Record on the item what the gate should do when a finding is genuinely pre-existing (the --no-fail-on-new escape needs a recorded reason per the baseline item's rule)

## Notes

### 2026-10-11 @arggon-maker — the gate is landed in `.github/workflows/ci.yml`

**What changed.** One additive step in the `cli` job of `.github/workflows/ci.yml`, after `npm run lint:structure` and before the smoke steps:

```yaml
- name: "Spec pipeline: zero NEW findings vs the ADR 0017 baseline"
  run: npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json
```

(the step carries a comment block recording the placement reasoning below). Whole diff: +43 lines, workflow file only. No baseline JSON touched, no `package.json` change (the script already existed), no `arggon.yml` change.

**Why the `cli` job and not `arggon.yml`'s `tasks-validate` job.** That job installs the **released** bin — `npm install -g "arggon-manager@$ARGGON_VERSION"` — so a detector change in this checkout cannot fail a gate until the release carrying it ships. That lag is exactly what hid this lane: the PR whose detector change made 5 findings visible merged green, and the lane only went red days later when someone ran the command by hand. `cli` runs `npm run arggon` = `tsx cli/src/cli.ts`, i.e. **this checkout's source**, so the gate bites on the very commit that moved the detector or the corpus, with no release window in between. `cli` is also the job that is already required on `main`, and the step needs nothing it does not already provide (`npm ci`, `npm run build`); it is offline, model-free, and ~0.3 s locally.

**Blocking, on purpose.** The job shell is `bash -e`, so the gate's exit code (>= 1 NEW finding, or a structural `SPEC_FAILED`) fails the step and the job. No `continue-on-error`, no `|| true`, no advisory `if:` — asserted programmatically over the parsed workflow (step index 10 of 13 in `cli`; `continue-on-error: None`, `if: None`).

**Only the repo-root baseline is wired.** The release-pipeline story's `ArggonManager/docs/specs/spec-analyze-baseline-release-pipeline-015.json` is a snapshot of the _same whole-corpus scan_ and carries the **identical** finding set (4 entries, field for field — `spec-analyze --baseline` has no per-story segmentation; there is no `--story` scope, only `--spec <one file>`). A second step would re-run one scan and print the same answer: a duplicate lane whose only effect is one more place to go stale. One corpus, one baseline, one lane; the story-scoped file stays owned by that story.

**Bite verification (negative controls, all on scratch copies — nothing committed).**

1. Unmodified gate on this branch: `0 new, 0 resolved, 4 unchanged, 4 total`, **exit 0**.
2. Removed-entry control against a scratch copy in `/tmp/opencode/spec-bite/` (one `vague-quantifier` entry dropped): `1 new, 0 resolved, 3 unchanged`, **exit 1**.
3. Same control run in place against the committed path, then restored: the baseline read `6b011739…` before and after (`git checkout --`), byte-identical — the repo's baseline was never weakened.
4. Fresh-finding control, the stronger one: a scratch spec outside the repo (`/tmp/opencode/spec-bite/scratch-spec.md`, deliberately "efficient"/"several" and error-free) scanned with `--spec … --baseline ArggonManager/spec-analyze-baseline.json` → `2 new` (`no-error-path`, `vague-quantifier`), **exit 1**. A finding the detector produces _today_ on a doc nobody baselined fails the lane, which is the regression this gate exists to catch.

**The real bite is on the PR**: the `cli` CI job on this PR runs the new step against this checkout — its result is the authoritative evidence and is pasted in the PR description.

**Recorded answer — what the gate should do when a finding is genuinely pre-existing.** The lane stays RED; it is never silenced. In order of preference:

1. **Fix the doc.** A pre-existing finding that this PR surfaced is still a finding; the cheap fix is the honest one.
2. **Re-save the baseline in the same PR** (`--save-baseline`), with the commit message naming which entries were dropped/added and why — exactly the discipline task-release-pipeline-baseline-new-collisions recorded for PR #690 (deletions = findings the fixes actually closed; insertions = newly accepted drift, each with a reason). The re-save is visible in the diff, so a reviewer can tell a real regression from a known-clean state.
3. **`--no-fail-on-new`** is a report-only escape for a wave in flight — a _local_ run or a one-off lane where the owner is mid-flight and the item records the reason. It is **never** wired into this workflow: it is the "make the gate green by widening the net" outcome the baseline item warned about, and it would re-create exactly the 5-day silent-red-state this item exists to end. Any use must cite the item and the reason (per the baseline item's rule: a recorded reason, not a flag in a script nobody reads).

Consequence for `main`: because the gate is global (any story's stale entry blocks any other story's implementation tasks), a pre-existing finding now blocks every PR until it is fixed or re-baselined — which is the intended trade of ADR 0017, and the reason the corpus was cleaned before this step landed.

**Gates (expected vs observed).** `npm run build` → 0; `npm test` → 136 files / 2927 tests passed; `npm run check:plugin` → 0; `npm run lint` → 0; `arggon validate` → `ok (0 warning(s), convention v5)`; `actionlint v1.7.12 .github/workflows/ci.yml` → exit 0, same as at `HEAD` (negative control: a deliberately broken job key is flagged by actionlint, so the clean result is real). Working tree after the gates: only `.github/workflows/ci.yml` modified.

### 2026-10-11 @Arggon
**Evidence for the standards reviewer** — the exact step added to `.github/workflows/ci.yml` (`cli` job, after `npm run lint:structure`, before the smoke steps):

```yaml
      - name: "Spec pipeline: zero NEW findings vs the ADR 0017 baseline"
        run: npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json
```

(The step body carries the placement/motivation comment block.) Whole diff: +43 lines in the workflow file + this item's body. No baseline JSON touched, no `package.json` change, no `arggon.yml` change.

**Expected vs observed, in order:**

| Gate | Expected | Observed |
| --- | --- | --- |
| `npm run build` | 0 | 0 |
| `npm test` | all pass | 136 files / 2927 tests passed |
| `npm run check:plugin` | 0 | 0 |
| `npm run lint` | 0 | 0 |
| `arggon validate` | ok | `ok (0 warning(s), convention v5)` |
| `actionlint v1.7.12 .github/workflows/ci.yml` | exit 0 | exit 0 (identical to `HEAD`) |

**Bite verification (all negative controls; nothing weakened was ever committed):**

1. Unmodified gate on this branch — `0 new, 0 resolved, 4 unchanged, 4 total`, **exit 0**.
2. Removed-entry control against a scratch copy in `/tmp/opencode/spec-bite/` (one `vague-quantifier` entry dropped): `1 new, 0 resolved, 3 unchanged, 4 total`, **exit 1**.
3. Same control run in place against the committed path, then restored: baseline sha256 `6b011739…` before AND after — byte-identical, never weakened.
4. Fresh-finding control (the stronger one): scratch spec outside the repo, run with `--spec … --baseline ArggonManager/spec-analyze-baseline.json` → `2 new` (`no-error-path`, `vague-quantifier` "several"), **exit 1**.
5. The real bite: the `cli` CI job on this PR runs the new step against this checkout — its result is pasted in the PR description.

**Placement / duplicate-lane decision.** `arggon.yml`'s `tasks-validate` job installs the RELEASED bin (`npm install -g arggon-manager@$ARGGON_VERSION`), so a detector change in this checkout cannot fail a gate until the release ships — the exact lag that hid this lane. `cli` runs `npm run arggon` = `tsx cli/src/cli.ts`, this checkout's source. Only the repo-root baseline is wired: the story-scoped `spec-analyze-baseline-release-pipeline-015.json` is a snapshot of the same whole-corpus scan with the identical 4-entry finding set, so a second step would print the same answer and add a second place to go stale.
- [x] A blocking step in the already-required `cli` job of .github/workflows/ci.yml runs `npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json` (the repo-root gate; the release-pipeline-scoped baseline belongs to that story's lane if at all — decide and record why, don't wire both blind)
- [x] The step is verified to bite: a deliberately-removed baseline entry (or a fresh no-error-path style finding) fails the job in a test PR — evidence pasted in the PR description
- [x] Verify the gate uses THIS checkout's build (the released-bin validate job cannot gate detector changes — record why the cli job is the right home)
- [x] No other workflow behavior changed; `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green
- [x] Record on the item what the gate should do when a finding is genuinely pre-existing (the --no-fail-on-new escape needs a recorded reason per the baseline item's rule)

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merge (PR #697)

Reviewed against engineering.md §Review bar: scope stayed on the item (one workflow step + the item body); the step is blocking by construction (bash -e job, no continue-on-error/|| true/advisory if — verified in the hunk) and runs THIS checkout's source via `npm run arggon` in the already-required `cli` job, with the released-bin alternative refuted inline (a detector change cannot fail a gate until the release carrying it ships — exactly the lag that hid this lane); only the repo-root baseline is wired, with the duplicate-lane reasoning recorded (the story-scoped baseline is a field-for-field snapshot of the same scan); evidence travels with the change (bite-verification evidence in the PR); CI green on the PR itself — which is the live proof the gate bites in its new home.
