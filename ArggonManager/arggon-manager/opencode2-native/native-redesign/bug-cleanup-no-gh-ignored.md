---
type: bug
status: in_progress
id: bug-cleanup-no-gh-ignored
title: cleanup --no-gh ignores the flag (pre-existing)
assignee: Arggon
branch: fix/bug-cleanup-no-gh-ignored
parent: native-redesign
labels: []
priority: p3
created: "2026-09-20"
updated: "2026-09-21"
claimed_at: "2026-09-21T21:39:11.767Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-cleanup-no-gh-ignored
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-cleanup-no-gh-ignored.md
  Leaves live only under a story. id is the filename stem: bug-cleanup-no-gh-ignored.
  CLI `arggon create bug cleanup-no-gh-ignored` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --no-gh ignores the flag (pre-existing)

## Context

Found during the W4 review (`task-native-permissions-worktrees`): `arggon
cleanup --no-gh` (pre-existing in the base, verified empirically) still runs
the `gh` fallback; the flag does not change the classification.

## Acceptance

- [ ] `cleanup --no-gh` skips the `gh` fallback entirely (offline/CI
      semantics) and the behavior is covered by a test.
- [ ] Default `cleanup` keeps the gh fallback.
- [ ] `arggon validate` green; CI green.

## Notes

- Pre-existing, not a W4 regression; filed per the review-findings rule.
