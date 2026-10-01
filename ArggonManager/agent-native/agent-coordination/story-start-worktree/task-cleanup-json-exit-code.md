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

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: approve (lead-architect review; merge blocked ONLY by the red tasks-validate lane, which is coordinator-owned main drift, not this change)
- Decision ENDORSED: keep exit 0 for --json with failures[] — payload is the machine surface (failures[]/pruned[].action), per-item failures are designed partial-success, #515's shipped test already pins 0, human-path exit-1 divergence documented with rationale. Reviewer verified the code path (json early-return before exitCode=1), doc consistency (exit-tied-to-ok rule + gate-mode exceptions), and that the new human-path test discriminates in both directions with #515's proven failure mechanics.
- Scope exact (4 files; §cleanup-only hunk at L447; no bundle drift — comment-only cli.ts). Ticks honest; conventions clean. The reviewer's two suspicions (handoff ellipsis = documented 200-char cap; prettier instability pre-existing repo-wide) cleared.
- The red lane is the init regeneration (7b846f89) shipping 0.4.1-shaped opencode.jsonc while arggon.yml still pins ARGGON_VERSION 0.4.0 — my drift, fixing now by re-pinning CI to the shipped version; then reconcile + merge.
