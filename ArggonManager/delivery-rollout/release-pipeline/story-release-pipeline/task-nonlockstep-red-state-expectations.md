---
type: task
status: done
id: task-nonlockstep-red-state-expectations
title: The non-lockstep guard reds on the ordinary between-releases proposal (root-only accumulation) — set the expected reading or pick a softer signal
assignee: arggon-delivery-lead
branch: feat/task-nonlockstep-red-state-expectations
parent: story-release-pipeline
labels: [release, docs]
created: "2026-10-13"
updated: "2026-10-13"
worktree_path: /home/arggon/Projects/ArggonManager-task-nonlockstep-red-state-expectations
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-nonlockstep-red-state-expectations.md
  Leaves live only under a story. id is the filename stem: task-nonlockstep-red-state-expectations.
  CLI `arggon create task nonlockstep-red-state-expectations` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The non-lockstep guard reds on the ordinary between-releases proposal (root-only accumulation) — set the expected reading or pick a softer signal

## Context

Observed live on the guard's first day (bug-release-proposal-non-lockstep-undetected, PR #782): the check reds the `release-please.yml` run whenever an OPEN release PR is non-lockstep. With `chore` deliberately releasable (release-please-config.json maps it to the Changed section) and lib bumping only when it has commits, a root-only accumulating proposal is the ORDINARY between-releases state — so the maintenance run reds on every push during that window. Evidence: #770 (root 0.9.0 / lib 0.8.0) was a real catch, acted on (owner Release-As → green → released v0.9.0); #786 (root 0.9.1 / lib 0.9.0), opened right after the release from tracker chores, reds the same way and is expected accumulation. The message ("must not merge") is accurate — merging a non-lockstep proposal wedges the release state — but readers can mistake the red run for a pipeline failure, and an always-red run hides other failures in the same workflow.

## Acceptance

- [x] `cli/release-lockstep-check.mjs`'s failure message (and the `release.md` section) state the expected reading: between releases, a root-only accumulating proposal is the normal non-lockstep state; the red run means "do not merge this yet — a Release-As decision is pending", not "the pipeline is broken"
- [x] `release.md` documents the expected red window so a red run on this workflow is not misread
- [x] decide and record whether the check stays failing (current) or uses a softer signal for the ordinary accumulation case — with the merge-time protection (pre-tag assert) unchanged either way
- [x] tests updated; `arggon validate` green; PR opened

## Notes

### 2026-10-13 @ses_ec8e84465ffdKy4ziBWlFDBZQD
### 2026-10-13 — maker evidence (PR #794, branch feat/task-nonlockstep-red-state-expectations)

**Decision recorded — the check KEEPS failing (exit 1); only the reading changed.** The ordinary root-only accumulation and a real catch are the SAME state (an open non-lockstep proposal that must not merge), so the predicate stays: a softer signal (exit 0 with a notice/annotation) would repeat the 2026-10-02 → 2026-10-07 outage shape — a warning inside a run that reported success — and cannot classify intent. Merge-time protection unchanged: release.yml's pre-tag root-lib assert. Recorded in cli/release-lockstep-check.mjs (header), release.md §Exception: the release PR is non-lockstep (root != lib), ArggonManager/docs/runbooks/release.md §Non-lockstep release proposals, and the release-please.yml step comment.

**Files (5, all committed on the branch; PR #794).**
- cli/release-lockstep-check.mjs — FAIL block now prints `EXPECTED READING — between releases a root-only accumulating proposal is the NORMAL non-lockstep state, not a pipeline failure` + `"do not merge this PR yet — a Release-As decision is pending", not "the pipeline is broken"`; header records the window/decision/rejected alternative. Lockstep predicate and the pin guard's wording+behavior untouched.
- cli/release-lockstep-check.test.ts — new red-path test pins the wording on the #786 shape (root 0.9.1 / lib 0.9.0, exact pin): still exit 1 + the concrete 0.9.1 Release-As remedy, with the three key sentences asserted on flattened output; the pin-only red additionally asserts NO expected-reading block.
- release.md — expected red window paragraph + the decision record.
- ArggonManager/docs/runbooks/release.md — the expected red window so a red maintenance run is not misread.
- .github/workflows/release-please.yml — step comment carries the window (no step semantics, order or name changed).

**Witnessed window (read-only gh, while writing this).** #786 at filing: root 0.9.1 / lib 0.9.0 (pin 0.9.1 exact) → lockstep red only, the expected accumulation. #786 now: root 0.10.0 / lib 0.10.0 (pin 0.10.0 exact) → green, closed by the empty `Release-As: 0.10.0` commit (main 12178bad). #770 was the same red as a real catch before v0.9.0. Also verified the rendered message with an injected fake gh: exit 1, new EXPECTED READING block first, remedy/reason blocks intact.

**Gates (expected vs observed).**
- focused `npx vitest run cli/release-lockstep-check.test.ts` → 21/21 pass; with release-label-flip + config-agreement → 48/48.
- `npm test` full → first run failed cli/src/headless-ci.test.ts ('run `npm run build` first': worktree had lib/dist but no root dist) — CI runs `npm run build` before tests; after `npm run build` → **155 files / 3368 tests passed, 0 failed** (provenance-audit.test.ts is CLEAN here, contrary to the dispatch note's stale-ledger expectation).
- `npm run lint` clean; `npm run test:structure` 5/5; `npm run lint:structure` clean; `npm run check:plugin` clean (bundle byte-identical after build).
- `npm run arggon -- validate` → ok (0 warnings, convention v5); `npx prettier --check` on all 5 touched files → clean; `actionlint` v1.7.12 on release-please.yml → clean.

**Scope guard.** No lockstep semantics or pin-check behavior changed; the open release PR branch (#786) was not touched (read-only `gh api` only); no release was triggered.

**Acceptance mapping (maker's claim — delivery lead verifies).** Rows 1–4 implemented; body checkboxes left for the lead per the standing flow.

### handoff 2026-10-13 @ses_ec8e84465ffdKy4ziBWlFDBZQD (session: ses_ec8e84465ffdKy4ziBWlFDBZQD) — next: Standards review of PR #794, then CI; merge + done are the lead's. Check the pinned EXPECTED READING wording and that the pin guard's message/behavior is unchanged.
- branch: feat/task-nonlockstep-red-state-expectations
- open questions: Dispatch's stale-ledger provenance-audit failure did not reproduce (green after build); docs/ci.md left untouched if the window is wanted there too; softer-signal alternative + rejection recorded in …

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as cf42c329 (PR #794); flipped by the lead (rows verified and ticked). Decision recorded: the check keeps failing — the predicate cannot classify intent, and a softer signal would repeat the 2026-10-02 outage shape; the FAIL block now prints the expected reading ("do not merge this PR yet — a Release-As decision is pending", not "the pipeline is broken"), pinned by a new red-path test on the #786 shape, and the runbook documents the red window. Merge-time protection unchanged. Focused 21/21; full suite 3,368 green, 0 failed; actionlint clean; CI green. Live witness: #786 went 0.9.1/0.9.0 (red, pre-trigger) → 0.10.0/0.10.0 (green).
