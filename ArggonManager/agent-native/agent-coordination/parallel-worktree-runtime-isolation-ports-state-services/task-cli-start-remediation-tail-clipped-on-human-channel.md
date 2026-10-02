---
type: task
status: todo
id: task-cli-start-remediation-tail-clipped-on-human-channel
title: "CLI channel: `startNotAttempted`/worktreeRemediation appends the remedy AFTER the kernel detail, so MAX_HUMAN_ERROR_CHARS head-clip still eats it at worst case"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cli, native-seam]
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-cli-start-remediation-tail-clipped-on-human-channel.md
  Leaves live only under a story. id is the filename stem: task-cli-start-remediation-tail-clipped-on-human-channel.
  CLI `arggon create task cli-start-remediation-tail-clipped-on-human-channel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CLI channel: `startNotAttempted`/worktreeRemediation appends the remedy AFTER the kernel detail, so MAX_HUMAN_ERROR_CHARS head-clip still eats it at worst case

## Context

Found by the reviewer of PR #597 (task-strictgatebinfailure-tail-clipped-by-head-clip, finding F1), 2026-10-02 — the same head-clip defect the kernel channel just had fixed, still live on the CLI/human channel.

`cli/src/start.ts:815-822` composes its failure message as kernel detail FIRST, then appends `worktreeRemediation(...)` and the discard hint LAST. The human channel clips head-kept at `MAX_HUMAN_ERROR_CHARS = 2000`, so at the worst case (the full MAX_GATE_BINS = 8 named bins, each ~330 chars) the trailing remedy is again the first thing lost, and a human following the CLI gets the diagnosis without the fix. PR #597 fixed only the native/kernel path (2048-char clip); this is the CLI twin that was left behind — the same ordering violation, same shape as #573's round-2 fix which already reordered the CLI equivalents then.

## Acceptance

- [ ] The CLI failure composition puts the actionable remediation (worktreeRemediation + attach/discard hint) BEFORE the kernel detail, keeping every existing clause verbatim — matching the shape PRs #573/#579/#595 landed
- [ ] A test at the full MAX_GATE_BINS worst case asserts the remedy survives the MAX_HUMAN_ERROR_CHARS=2000 head-clip, with ordering pinned (remedy index precedes the first named bin)
- [ ] Negative control: message at the cap and the last named bin absent
- [ ] Every CLI error path that appends a remedy after kernel detail is swept for the same violation — this must be a class fix, not a single call site

## Notes
