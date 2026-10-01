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
claimed_at: "2026-10-01T21:55:34.972Z"
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

### 2026-10-01 @ses_f0697a26fffdSSbEC0G9eu6TPK
Evidence for review (worktree /home/arggon/Projects/ArggonManager-task-release-action-sha-pin, branch feat/task-release-action-sha-pin):

- Resolution: git ls-remote https://github.com/googleapis/release-please-action refs/tags/v4* → newest tag v4.4.1 = 5c625bfb5d1ff62eadeeb3772007f7f66fdcf071; refs/tags/v4^{} peels to the identical commit (pin == where floating v4 points today).
- Diff: exactly one line — googleapis/release-please-action@v4 → @5c625bfb5d1ff62eadeeb3772007f7f66fdcf071 # v4.4.1. Same step id, same with (config-file, manifest-file), same trigger (push: [main]), same permissions (contents: write, pull-requests: write). actions/checkout@v4 untouched (different action, out of scope).
- actionlint v1.7.12 (available): CLEAN on .github/workflows/release-please.yml.
- YAML parse (js-yaml): name/on/permissions/steps confirmed unchanged; dry evidence the workflow still proposes the release PR — only the action ref changed.
- npm run arggon -- validate: ok (0 warnings, convention v5).
- npm test: 115/115 files, 2053/2053 passed. Note: first run had 1 file failing on the dist/cli.js build-artifact assertion — fresh worktree lacked the gitignored build; npm run build fixed it, second run fully green. Unrelated to this YAML-only diff.
- Commit 22cadcc8 "ci(release): SHA-pin release-please-action to v4.4.1 (task-release-action-sha-pin)"; PR https://github.com/Arggon/ArggonManager/pull/563 (NOT merged; coordinator decides completion).

### handoff 2026-10-01 @ses_f0697a26fffdSSbEC0G9eu6TPK (session: ses_f0697a26fffdSSbEC0G9eu6TPK) — next: Review+merge PR #563; afterwards bump the pin when a newer v4.x ships (re-run git ls-remote, update SHA+comment).
- branch: feat/task-release-action-sha-pin
- open questions: actions/checkout@v4 SHA-pinning is a separate follow-up if the story wants repo-wide pin hygiene.
