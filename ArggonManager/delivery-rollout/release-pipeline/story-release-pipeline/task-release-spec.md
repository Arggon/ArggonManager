---
type: task
status: todo
id: task-release-spec
title: "Spec + plan: release pipeline (release PR + OIDC publish + exact pin + tarballs)"
parent: story-release-pipeline
labels: [delivery, spec]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
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

### handoff 2026-10-01 @ses_f081ac611ffemv23pwZefY9f10 (session: ses_f081ac611ffemv23pwZefY9f10) — next: Coordinator review of PR #545 (spec+plan only). On merge, task-release-workflow may claim after task-ci-seam-pin-tracks-release lands plan T0 semantics.
- branch: feat/task-release-spec
- open questions: C3 trigger deviation from old checklist wording (push-main guarded vs tag/release events) needs coordinator sign-off; repository field missing in both package.jsons is a one-time prereq in plan T1

### 2026-10-01 @ses_f081ac611ffemv23pwZefY9f10
Spec + plan delivered — PR #545 (branch feat/task-release-spec, worktree ArggonManager-task-release-spec).

Artifacts: ArggonManager/docs/specs/spec-release-pipeline-015.md; ArggonManager/docs/plans/plan-release-pipeline-015.md (T0–T8); baseline ArggonManager/docs/specs/spec-analyze-baseline-release-pipeline-015.json committed beside the spec; task-release-workflow checklist mirrored to plan T1–T8.

Settled choices (rationale + dated sources in the spec):
1. Exact pin via release-please extra-files JSON updater — node-workspace's newVersionWithRange preserves the caret (src/updaters/node/package-json.ts, accessed 2026-10-01), so it cannot write the exact pin.
2. Proposal without conventional commits: Release-As: X.Y.Z trailer on a (possibly empty) commit to main — release-please README documented override; forces both manifest packages in lockstep.
3. release.yml trigger: push to main, self-guarded to release commits. NOT tag push / release published: release-please creates tag+release with the default GITHUB_TOKEN and GitHub's recursion rule suppresses those events (docs.github.com, Triggering a workflow, accessed 2026-10-01); and npm trusted publishing validates the CALLING workflow filename under workflow_call (docs.npmjs.com/trusted-publishers, accessed 2026-10-01), so a reusable release.yml would break the release.yml naming invariant. Ownership consequence: release-please.yml = PR maintenance only (skip-github-release: true); release.yml owns tag + GitHub Release + publish + assets.
4. CHANGELOG: house Keep-a-Changelog style, hand-edited in the release PR; generator output is a draft; hand edits persist (manifest-driven prepend).

Gates + evidence (expected vs observed):
- arggon spec validate → expected ok / observed {"ok":true, errors:[], warnings:[]}.
- spec analyze --save-baseline <file> → 6 corpus findings snapshotted; spec analyze --baseline <file> → expected no NEW findings / observed "0 new, 0 resolved, 6 unchanged", exit 0. Zero findings target the new spec itself.
- arggon validate (pre-commit hook) → ok (0 warnings, convention v5). Commit 74749bbf, staged explicit paths only.
- PR: https://github.com/Arggon/ArggonManager/pull/545 with task-release-spec in title+body.

Findings for the coordinator (not filed as items per subagent rules):
- task-release-workflow checklist deviation: original wording had release-please.yml creating "release PR + tag + GitHub release notes"; under C3 the tag + release notes move to release.yml (recursion + npm-calling-workflow rules). Mirrored checklist reconciled; sign-off requested.
- "Auto-publish on push to main" non-goal: the settled trigger IS push-to-main but fires only on a merged release PR (version bump beyond latest v* tag); spec argues this preserves ADR 0018's constraint — human comfort check requested.
- Both package.json files lack repository.url — required by npm trusted publishing; added as one-time plan T1 (AC A13).
- task-ci-seam-pin-tracks-release now has concrete required semantics (release-window drift-gate skip) in the spec Interplay section — its claiming agent should implement to that contract.
