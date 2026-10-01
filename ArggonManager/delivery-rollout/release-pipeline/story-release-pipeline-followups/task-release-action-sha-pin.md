---
type: task
status: in_progress
id: task-release-action-sha-pin
title: SHA-pin googleapis/release-please-action@v4 in release-please.yml
assignee: Arggon
branch: feat/task-release-action-sha-pin
parent: story-release-pipeline-followups
labels: [ci, release, supply-chain]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T21:39:41.253Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-release-action-sha-pin
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-release-action-sha-pin.md
  Leaves live only under a story. id is the filename stem: task-release-action-sha-pin.
  CLI `arggon create task release-action-sha-pin` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# SHA-pin googleapis/release-please-action@v4 in release-please.yml

## Context

Reviewer finding F4 from the PR #555 review (informational, deferred by
coordinator): `.github/workflows/release-please.yml` uses the mutable tag ref
`googleapis/release-please-action@v4` in the workflow that writes the release
PR a human merges (merging = the release). Blast radius is PR-content
manipulation, not credential theft (unprivileged default `GITHUB_TOKEN`; the
publish workflow itself has zero third-party actions and owns OIDC).

## Acceptance

- [x] Pin the action by full commit SHA (with a version comment), or replace with the official `release-please-actions` digest reference.
- [x] `actionlint` clean; `release-please.yml` still proposes the release PR (verify on the next proposal or via dry evidence).
- [x] No other workflow regressions; CI green.

## Notes

- Pinned `googleapis/release-please-action@v4` → `@5c625bfb5d1ff62eadeeb3772007f7f66fdcf071 # v4.4.1`
  (newest v4 tag via `git ls-remote … refs/tags/v4*`; `refs/tags/v4^{}` peels to the
  same commit, so the SHA equals where the floating tag points today). Diff is
  exactly one line: same step `id`, same `with` inputs, same trigger
  (`push: [main]`), same permissions. Dry evidence for "still proposes the
  release PR": only the action ref changed. `actions/checkout@v4` (step 2) is a
  different action, explicitly out of scope for this item.
