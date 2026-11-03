---
type: task
status: in_progress
id: task-revision-bound-verdicts
title: Bind verdicts to reviewed revisions
assignee: arggon-delivery-lead
branch: agent/revision-bound-verdicts-cdec590a668b
parent: story-self-improvement
labels: []
created: "2026-11-03"
updated: "2026-11-03"
claimed_at: "2026-11-03T22:20:52.946Z"
worktree_path: /home/arggon/.dsh/state/superagent/work/revision-bound-verdicts-cdec590a668b
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-self-improvement/task-revision-bound-verdicts.md
  Leaves live only under a story. id is the filename stem: task-revision-bound-verdicts.
  CLI `arggon create task revision-bound-verdicts` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Bind verdicts to reviewed revisions

## Context

Follow-up to [methodology review #872](https://github.com/Arggon/ArggonManager/issues/872): chronological approvals currently survive later code changes. Bind verdicts to reviewed commits and report freshness without gating merges. Preserve the existing chronological `verdicts` map; expose effective review state separately so stale or unverifiable approvals are never presented as current.

## Acceptance

- [ ] Parse bounded reviewed revisions alongside verdicts; legacy comments stay unbound.
- [ ] Sync fetches PR heads and reports revisions, freshness and effective reassessment state without changing matching or exit codes.
- [ ] Code changes invalidate approval; tracker-only commits do not; a new approval restores freshness.
- [ ] Document the JSON contract, relevant-change rule and unavailable-history behavior.
- [ ] Regression tests, CLI fixture smoke, build, lint and tracker validation pass; independent review recorded.

## Notes
