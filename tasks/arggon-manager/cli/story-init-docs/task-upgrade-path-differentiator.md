---
type: task
status: in_progress
id: task-upgrade-path-differentiator
title: document the upgrade-path differentiator (never-overwrite + adopter-owned + re-run refresh)
assignee: Arggon
branch: feat/task-upgrade-path-differentiator
parent: story-init-docs
labels: [p3]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T22:23:20.226Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-upgrade-path-differentiator.md
  Leaves live only under a story. id is the filename stem: task-upgrade-path-differentiator.
  CLI `arggon create task upgrade-path-differentiator` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# document the upgrade-path differentiator (never-overwrite + adopter-owned + re-run refresh)

## Context

Candidate #2 of the product-discovery research round (2026-09-15): OpenSpec's main differentiator is the CLEANEST UPGRADE PATH — it separates user content from tool files — while Spec Kit "has known upgrade issues that overwrite customization files" (ranthebuilder.cloud, 2026-09-15). ArggonManager already implements a stronger version (init/adopt never overwrite; adopter-owned the moment they exist; x-generated checksums; re-run refreshes untouched docs silently; --backup archives) — but the differentiator is undocumented, so adopters evaluating tools never see it. Docs-only, effort S.

## Acceptance

- [x] README (Why ArggonManager section): a short upgrade-path paragraph — never overwrites, adopter-owned docs, re-run refreshes untouched docs, --backup archives — the Spec Kit/OpenSpec comparison implicit, no vendor bashing
- [x] docs/agents.md or docs/convention.md: the same guarantee stated where adopters look for upgrade behavior (one place, no duplication)
- [x] doctor/init tests unchanged and green (docs-only)

## Notes
