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
§1–2 and §4 per the spec from `task-release-spec` (hard gate: spec exists and
`spec analyze` reports no NEW findings before this item is claimed). Gated
also on `task-ci-seam-pin-tracks-release` (the seam pin must be derived, not
literal, when this lands). The publish workflow file MUST be named
`release.yml` — the npmjs.com trusted-publisher configuration (human,
one-time) binds to that filename.

## Acceptance

- [ ] Release-proposal flow per the spec (release-please manifest root + lib; exact-pin lockstep via the spec's chosen mechanism; usable with this repo's non-conventional commit history).
- [ ] `.github/workflows/release.yml`: OIDC trusted publishing only (no `NPM_TOKEN`; `id-token: write`; npm ≥ 11.5.1 on the runner), publishes **lib first then the CLI** with propagation-lag retry, verifies tag ↔ shipped version agreement, attaches both packed tarballs to the GitHub Release; provenance on.
- [ ] Manifest-maintenance workflow (e.g. `release-please.yml`) running with the default `GITHUB_TOKEN`, creating/updating the release PR + tag + GitHub release notes.
- [ ] `release.md` shrunk to the operator's exception manual: the one-time npmjs.com trusted-publisher setup (human), rebase-over-release-commit gotcha, from-source-install shadow, propagation-lag retry rationale; the old manual bump/pack/publish steps removed (replaced by the flow).
- [ ] `ArggonManager/docs/ci.md` gains the install-from-release-asset variant (ADR §4) alongside the registry one-liner.
- [ ] Smoke evidence: workflow YAML linted (actionlint or equivalent), publish steps exercised offline as far as possible (`npm pack` both + tarball inspection per the old runbook §2), and the spec's acceptance criteria ticked. CI lanes green on the PR.
- [ ] PR notes explicitly that publishing stays inert until the human completes the npmjs.com trusted-publisher setup.

## Notes
