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
- [ ] T3 `release.yml` (name fixed): push-main trigger with the spec C3 guard (untagged version → release; tag at HEAD → idempotent complete; tag elsewhere → loud failure; unchanged version → exit 0), concurrency group, `contents: write` + `id-token: write`; creates annotated tag `v(V)` + GitHub Release with the merged CHANGELOG section as notes (spec AC A5/A10).
- [ ] T4 release.yml build → pack → inspect BEFORE any publish: fresh `lib/dist` + build info, pack dir created first (ENOENT gotcha), extract-and-inspect both tarballs (kernel exports, root artifacts, zero test-helper leaks, versions) per old runbook §2 (spec AC A11).
- [ ] T5 release.yml OIDC publish: no `NPM_TOKEN`, npm ≥ 11.5.1 installed on the runner, Node ≥ 22.14; lib first with bounded `npm view` propagation poll; both publishes idempotent ("already at `V`" = success, never re-publish); tag↔version + root==lib assertion before publishing; provenance automatic (spec AC A7/A8/A9).
- [ ] T6 both packed tarballs attached to the GitHub Release (spec AC A10).
- [ ] T7 `release.md` shrunk to the operator's exception manual (one-time npmjs.com trusted-publisher setup for both packages bound to `release.yml` with direct publish allowed; publish-time misconfig recovery; partial-failure re-run; propagation-lag rationale; rebase-over-release-commit; from-source-install shadow; pack-dir ENOENT; manual bump/pack/publish removed — the re-pin step stays, made guard-enforced by `task-ci-seam-pin-tracks-release` ("a stale pin is a red test, not a silent outage")); `ArggonManager/docs/ci.md` gains the install-from-release-asset variant (spec AC A14/A15).
- [ ] T8 Evidence: both workflow YAMLs linted (actionlint or equivalent); offline-as-possible smoke (guard paths, pack + inspect, release-please dry-run) with expected-vs-observed in the PR; CI lanes green; spec ACs A1–A17 re-checked and ticked before merge; PR notes publishing stays inert (fails closed) until the human completes the npmjs.com trusted-publisher setup, and that renaming `release.yml` is a breaking ops change (spec AC A16/A17).

## Notes
