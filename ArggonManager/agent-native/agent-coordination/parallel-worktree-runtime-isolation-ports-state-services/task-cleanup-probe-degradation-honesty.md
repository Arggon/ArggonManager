---
type: task
status: todo
id: task-cleanup-probe-degradation-honesty
title: "cleanup's probe-degradation fallback still prints removable: true then fails raw when `git status` cannot run — the classification-honesty rule's last unmigrated path (reviewer N1 on PR #751)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, hygiene, review-followup]
created: "2026-10-12"
updated: "2026-10-12"
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-cleanup-probe-degradation-honesty.md
  Leaves live only under a story. id is the filename stem: task-cleanup-probe-degradation-honesty.
  CLI `arggon create task cleanup-probe-degradation-honesty` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup's probe-degradation fallback still prints removable: true then fails raw when `git status` cannot run — the classification-honesty rule's last unmigrated path (reviewer N1 on PR #751)

## Context

Standards-review finding N1 on PR #751
(`bug-cleanup-prune-untracked-artifacts-no-force`), 2026-10-12: the new
classification-honesty rule ("if the tool will not remove it, it must not print
`removable: true` with a null reason") covers the normal path, but the
**probe-degradation fallback** (`lib/src/cleanup.ts` ~line 430) keeps the old
shape: when the `git status --porcelain` probe cannot run, the entry is still
classified `removable: true` and the removal then fails with a raw git error —
the classify/act mismatch the parent item removed for every other path.

Reachable only for an already-broken worktree (probe failure), which is why it
was not blocking; recorded so the rule does not have a silent exception.

## Acceptance

- [ ] On the degradation path, either classify `removable: false` with a reason
      naming the failed probe and the manual remedy, or carry the same honest
      `action: "failed"` shape with the manual sequence — decide and record why
- [ ] A test pins the degradation path's shape (injected failing probe), so the
      honesty rule is total rather than path-dependent
- [ ] The normal paths and their tests are untouched

## Notes
