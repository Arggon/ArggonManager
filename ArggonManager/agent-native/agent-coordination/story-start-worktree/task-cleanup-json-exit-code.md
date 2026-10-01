---
type: task
status: todo
id: task-cleanup-json-exit-code
title: "cleanup --prune --json exits 0 even with non-empty failures[] (exit-code contract decision)"
parent: story-start-worktree
labels: [opencode-seam, cli]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/task-cleanup-json-exit-code.md
  Leaves live only under a story. id is the filename stem: task-cleanup-json-exit-code.
  CLI `arggon create task cleanup-json-exit-code` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --prune --json exits 0 even with non-empty failures[] (exit-code contract decision)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the bug-cli-cleanup-branch-delete-missing-failure review (PR #515). Pre-existing, confirmed identical before/after: the --json path of cleanup --prune returns before the human path sets process.exitCode = 1 (cli.ts ~2401 vs ~2438), so a prune run with failures[] exits 0.

## Acceptance
- [ ] Decide the machine contract explicitly: does a non-empty failures[] mean non-zero exit for --json consumers? (Contract change -> document in json-output.md in the same PR; keeping 0 is also acceptable if documented.)
- [ ] Implement + test the chosen behavior; human-path behavior unchanged.
- [ ] Note for callers: agents/scripts keying on exit status today.
