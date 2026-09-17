---
type: task
status: in_progress
id: task-version-channel-discipline
title: "Version channel: bump + tag discipline so arggonVersion stamps mean something"
assignee: Arggon
branch: feat/task-version-channel-discipline
parent: story-adoption-state
labels: [p3]
created: "2026-09-16"
updated: "2026-09-17"
claimed_at: "2026-09-17T00:06:24.481Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-version-channel-discipline.md
  Leaves live only under a story. id is the filename stem: task-version-channel-discipline.
  CLI `arggon create task version-channel-discipline` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Version channel: bump + tag discipline so arggonVersion stamps mean something

## Context

Exploration adopter-upgrade-experience-007 (option D, approved 2026-09-16): every generated doc stamps `arggonVersion` (from package.json via `arggon --version`), but the value has been 0.1.0 forever, so "which upgrades did my docs miss?" is unanswerable and init --propose's `proposed-<version>` suffix carries no information. This establishes the release discipline (no npm publishing — that is option E, deferred behind its own ADR).

## Acceptance

- [ ] Release runbook documented (docs/runbooks/): bump rules — major for convention/schema breaks, minor for new commands/templates/methodology changes, patch for fixes; tag `vX.Y.Z` on the release commit; CHANGELOG.md section per release listing what templates/methodology changed (the adopter-facing "what's new")
- [ ] package.json bumped to 0.2.0 with a CHANGELOG entry recording 2026-09-16 changes (non-functional review bar + smoke gate ADR 0008, spec import/analyze-baseline/audit commands, adopt corpus body injection) and tagged v0.2.0
- [ ] `arggon --version`, doctor and x-generated stamps keep working unchanged (arggonVersion() reads package.json — existing tests prove it)
- [ ] Optional (only if trivial): CI step that fails a release PR when package.json version == last tag

### 2026-09-17 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #300.

Verified: full diff read (release runbook with bump rules + tag-on-main + adopter-facing changelog discipline; 0.2.0 bump in package.json/lock; CHANGELOG 0.2.0 section absorbing Unreleased with the 2026-09-16 adopter-facing changes; x-generated stamps refreshed to 0.2.0 via sanctioned adopt --ack after the CHANGELOG/runbook edits tripped ack-drift — the ack workflow doing its job, flagged transparently by the implementer). Gates mine: suite 1012/1012 on the rebased branch (combined with #301/#302), lint/build clean, validate ok, arggon --version prints 0.2.0, doctor 0 modified / 0 drifted.

Review fix (my commit, b3117ed on the branch): the version-tag CI guard ran on every CI event — once v0.2.0 was tagged, main would stay red until the next bump, wedging tracker commits and auto-done flips. Now guarded to pull_request events only, which matches the acceptance intent (fail a release PR that forgot to bump). Coordinator follows up post-merge: tag v0.2.0 on the release commit per the runbook.
