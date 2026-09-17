---
type: task
status: in_progress
id: task-version-channel-discipline
title: "Version channel: bump + tag discipline so arggonVersion stamps mean something"
assignee: Arggon
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
