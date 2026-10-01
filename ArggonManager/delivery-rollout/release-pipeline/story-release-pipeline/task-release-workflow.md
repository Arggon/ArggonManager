---
type: task
status: todo
id: task-release-workflow
title: release.yml + release-please manifest + exact pin + runbook shrink
parent: story-release-pipeline
labels: [delivery, ci]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-release-workflow.md
  Leaves live only under a story. id is the filename stem: task-release-workflow.
  CLI `arggon create task release-workflow` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# release.yml + release-please manifest + exact pin + runbook shrink

## Context

Implements [ADR 0018](../../../../docs/adr/0018-update-delivery-and-distribution-channel.md)
§1–2 and §4 per [spec-release-pipeline-015](../../../../docs/specs/spec-release-pipeline-015.md)
+ [plan-release-pipeline-015](../../../../docs/plans/plan-release-pipeline-015.md)
(hard gate: `spec analyze --baseline` reports no NEW findings before this item
is claimed). Gated on `task-ci-seam-pin-tracks-release` (plan T0: the seam pin
stays **literal** with the lag-guard test — enforced non-divergence, run-time
derivation rejected per the recorded decision on that item, 2026-10-01 —
before this lands). The publish workflow file MUST be named `release.yml` — the npmjs.com
trusted-publisher configuration (human, one-time) binds to that filename.
Ownership per spec C3: `release-please.yml` maintains the release PR only
(default `GITHUB_TOKEN`, `skip-github-release: true`); `release.yml` owns
tag + GitHub Release + publish + tarballs (the GITHUB_TOKEN recursion rule
and npm's calling-workflow validation rule make tag-push / release-published
/ `workflow_call` triggers unusable — spec C3).

## Acceptance

Mirrors plan-release-pipeline-015 T1–T8 (T0 is the
`task-ci-seam-pin-tracks-release` dependency):

- [ ] T1 Manifest scaffold: `repository` field on both `package.json`s; `release-please-config.json` (packages `.` + `lib`, `release-type: node`, `skip-github-release: true`, Keep-a-Changelog `changelog-sections`, root `extra-files` exact-pin JSON updater with bracket-quoted jsonpath) + `.release-please-manifest.json` at current versions; dry-run evidence lists both packages and the exact-pin rewrite (spec AC A2/A3/A4/A13).
- [ ] T2 `release-please.yml` (push main, default `GITHUB_TOKEN`, action v4) with the automated `package-lock.json` sync onto the release PR branch (`npm install --package-lock-only`; release-please does not update lockfiles — issue #1993): release PR touches exactly the five spec files, bumps both packages in lockstep, `npm ci` green on the PR (spec AC A1/A2/A12).
- [ ] T3 `release.yml` (name fixed): push-main trigger with the spec C3 **ordered predicate** — (0) version unchanged from the pushed commit's parent → not a release commit → exit 0 (steady state permanently green); (1) version-changing push, tag `v(V)` absent → this is the release: proceed; (2) tag at HEAD → idempotent complete; (3) tag elsewhere → loud failure — plus concurrency group, `contents: write` + `id-token: write`; creates annotated tag `v(V)` + GitHub Release with the merged CHANGELOG section as notes (spec AC A5/A10).
- [ ] T4 release.yml build → pack → inspect BEFORE any publish: fresh `lib/dist` + build info, pack dir created first (ENOENT gotcha), extract-and-inspect both tarballs (kernel exports, root artifacts, zero test-helper leaks, versions) per old runbook §2 (spec AC A11).
- [ ] T5 release.yml OIDC publish: no `NPM_TOKEN`, npm ≥ 11.5.1 installed on the runner, Node ≥ 22.14; lib first with bounded `npm view` propagation poll; both publishes idempotent ("already at `V`" = success, never re-publish); tag↔version + root==lib assertion before publishing; provenance automatic (spec AC A7/A8/A9).
- [ ] T6 both packed tarballs attached to the GitHub Release (spec AC A10).
- [ ] T7 `release.md` shrunk to the operator's exception manual (one-time npmjs.com trusted-publisher setup for both packages bound to `release.yml` with direct publish allowed; publish-time misconfig recovery; partial-failure re-run; propagation-lag rationale; rebase-over-release-commit; from-source-install shadow; pack-dir ENOENT; manual bump/pack/publish removed — the re-pin step stays, made guard-enforced by `task-ci-seam-pin-tracks-release` ("a stale pin is a red test, not a silent outage")); `ArggonManager/docs/ci.md` gains the install-from-release-asset variant (spec AC A14/A15).
- [ ] T8 Evidence: both workflow YAMLs linted (actionlint or equivalent); offline-as-possible smoke (guard paths, pack + inspect, release-please dry-run) with expected-vs-observed in the PR; CI lanes green; spec ACs A1–A17 re-checked and ticked before merge; PR notes publishing stays inert (fails closed) until the human completes the npmjs.com trusted-publisher setup, and that renaming `release.yml` is a breaking ops change (spec AC A16/A17).

## Notes

### 2026-10-01 @ses_f076f3a7bffeHuhB6MxSetlgSU
Recovery session: verified the previous agent's implementation commit (7230609f) against the item checklist, plan T1–T8, spec C1–C4/A1–A17, ADR 0018 §1–2/§4; fixed two gaps; opened PR; CI green.

Evidence (expected vs observed):
- Gates: prose-format 3/3 ✅; cli/release-guard.test.ts + cli/inspect-tarballs.test.ts 13/13 ✅ (guard rules 0–3 in predicate order on real git fixture clones, offline bare-repo ls-remote; inspector pass fixture + one broken fixture per check; GITHUB_OUTPUT contract; fail-closed exit 2); actionlint clean on both workflows ✅; eslint on the 4 new cli files clean ✅; arggon validate ok on every commit (pre-commit) ✅.
- release-please CLI 17.11.2 dry-run vs this branch (--release-as 0.4.2): both packages listed (.: node, lib: node), both "Setting version ... from release-as configuration" (lockstep), "updating from 0.4.1 to 0.4.2" on root and lib, root package.json = CompositeUpdater (PackageJson + extra-files GenericJson), proposal spans exactly the five spec files.
- GenericJson exact-pin updater exercised directly: caret state ^0.4.0 -> ^0.4.2 (PREFIX PRESERVED); post-bootstrap exact 0.4.1 -> 0.4.2 exact; rest of file byte-identical (A4).
- CI on PR #555: cli pass 4m54s, tasks-validate pass, ui-smoke pass 8m12s.

Fix commits on top of the inherited implementation:
- 8e02c5e1 fix(release): docstrings pointed at cli/src/<t>.test.ts; suites live at cli/<t>.test.ts.
- 2f28e32f fix(release): FINDING — spec C1's "extra-files updater needs no bootstrap" is false for release-please v17.11.2 AND github main (generic-json.ts replaces VERSION_REGEX in-place, preserving the range prefix). As landed, the first release PR would ship "^0.4.2" and fail AC A3/invariant 4. Resolution = the spec's own named escape hatch: one-time hand-unpin inside the FIRST release PR's review (version guard satisfied there by the legitimate bump); machine-owned exact-to-exact from release 2. release.md documents it. Bootstrapping in this PR is guard-blocked by design (dependencies is publish-relevant, v0.4.1 already tagged; bumping here would false-fire the release predicate and squat v0.4.2).
- eec3ce7a chore(tasks): ticked T1–T7 (personally verified). T8 left open: coordinator ticks spec ACs A1–A17 in spec-release-pipeline-015.md at merge verification (spec file outside this item's edit scope); A12's end-to-end approval flow and A2's zero-conventional-commit proposal are runtime evidence of the first real release-PR cycle.

PR: https://github.com/Arggon/ArggonManager/pull/555 (title+body carry task-release-workflow; body has per-T status, gate table, dry-run evidence, A17 ops notes: publishing fails closed until the human npmjs.com trusted-publisher setup for BOTH packages bound to release.yml with direct publish allowed; renaming release.yml is a breaking ops change; never a workflow_call child).

### handoff 2026-10-01 @ses_f076f3a7bffeHuhB6MxSetlgSU (session: ses_f076f3a7bffeHuhB6MxSetlgSU) — next: Review+merge PR #555; tick spec ACs A1–A17 in spec-release-pipeline-015.md at merge verification; flip item done after merge.
- branch: feat/task-release-workflow
- open questions: C1 amendment needed: GenericJson preserves range prefixes (v17.11.2 + main) — one-time hand-unpin in first release PR, machine-owned after; amend the spec sentence.
