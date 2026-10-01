---
type: task
status: in_progress
id: task-release-spec
title: "Spec + plan: release pipeline (release PR + OIDC publish + exact pin + tarballs)"
assignee: Arggon
branch: feat/task-release-spec
parent: story-release-pipeline
labels: [delivery, spec]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T14:37:01.475Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-release-spec
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-release-spec.md
  Leaves live only under a story. id is the filename stem: task-release-spec.
  CLI `arggon create task release-spec` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec + plan: release pipeline (release PR + OIDC publish + exact pin + tarballs)

## Context

Implements the spec-first gate (ADR 0017) for [ADR 0018](../../../../docs/adr/0018-update-delivery-and-distribution-channel.md)
§1–2 and §4: the release-please-style release PR flow, the OIDC publish
workflow, the exact kernel pin, and the tarball assets. Inputs: ADR 0018,
[exploration-update-delivery-016](../../../../docs/explorations/exploration-update-delivery-016.md),
`release.md` (current manual runbook + gotchas), `ArggonManager/docs/ci.md`
(drift gate + pinned install interplay), `task-ci-seam-pin-tracks-release`
(lands with/before the pipeline; repo's own `arggon.yml` pin becomes derived).

## Acceptance

- [ ] Spec at `ArggonManager/docs/specs/spec-release-pipeline-NNN.md` (next free number via `arggon spec new release-pipeline --plan`) with purpose, surfaces (workflow inputs/triggers, manifest files), invariants, and acceptance criteria. Invariants must include: never publish without tag↔version agreement; no stored `NPM_TOKEN` (OIDC only, `id-token: write`); lib-first publish order with propagation retry; exact kernel pin written in lockstep; both tarballs attached to the GitHub Release; the publish workflow file is named `release.yml` (trusted-publisher binding).
- [ ] Settles with rationale, exactly one choice each: how the exact pin is written (release-please `node-workspace` plugin vs `extra-files` JSON updater); how a release is proposed given non-conventional commit history (e.g. manual manifest-version bump trigger) — the flow must not depend on adopting conventional commits; what triggers `release.yml` (tag push vs release published); the CHANGELOG section format (must match the existing Keep-a-Changelog style; hand-editable in the release PR).
- [ ] Documents the interplay: CI version guard (tags), drift gate + `ARGGON_VERSION` pin, `task-ci-seam-pin-tracks-release`, and the one-time human step (npmjs.com trusted publishers for `arggon-manager` + `@arggondev/lib`, workflow file `release.yml`, direct publish allowed).
- [ ] Plan at `ArggonManager/docs/plans/plan-release-pipeline-NNN.md` linked to the spec; ordered tasks each with verifiable acceptance criteria; the implementation task `task-release-workflow` updated to mirror them.
- [ ] `arggon spec validate` ok; `spec analyze --baseline <file>` reports no NEW findings (baseline committed beside the spec work); `arggon validate` ok.
- [ ] Non-goals recorded: auto-publish on push to main; standalone binaries; `whatsnew`; non-npm package managers.

## Notes
