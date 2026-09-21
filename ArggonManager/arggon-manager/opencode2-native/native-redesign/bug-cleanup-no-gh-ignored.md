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

### 2026-09-21 @Arggon
Evidence (worker, branch fix/bug-cleanup-no-gh-ignored @ b5852e9, draft PR #382):

ROOT CAUSE: commander names a --no-gh option `gh` (default true, false when passed); the cleanup action read `opts.noGh` (always undefined), so `noGh: opts.noGh === false` was always false and the squash-merge gh fallback always ran.

REPRO (fixture from cli/src/worktree.test.ts, task-charlie = done + unmerged branch, gh shim on PATH logging invocations):
- before fix, `cleanup --json --no-gh`: task-charlie {removable:true, reason:null, via:"squash-merged PR #12"}; gh shim invoked 1x.
- after fix, `cleanup --json --no-gh`: task-charlie {removable:false, reason:"branch 'feat/task-charlie' is not fully merged into 'main'"}; gh shim invoked 0x.
- after fix, default `cleanup --json`: gh shim invoked 1x, charlie removable via "squash-merged PR #12" (fallback kept).

GATES (all green): npm test (89 files / 1455 tests), npm run lint, npm run build, npm run check:plugin (bundle unchanged), npm run arggon -- validate (ok, convention v5), npm run arggon -- spec validate (ok, 18 docs).

Acceptance checkboxes left unticked for the coordinator: local verification covers all three except the not-yet-run CI and the merge itself. Only touched cli/src/cli.ts and cli/src/worktree.test.ts.
