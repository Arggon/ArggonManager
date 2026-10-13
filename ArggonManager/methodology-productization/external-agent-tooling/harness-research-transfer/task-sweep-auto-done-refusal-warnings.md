---
type: task
status: in_progress
id: task-sweep-auto-done-refusal-warnings
title: Sweep auto-done logs for merge-time done-gate refusal rate
assignee: arggon-delivery-lead
branch: feat/task-sweep-auto-done-refusal-warnings
parent: harness-research-transfer
labels: []
created: "2026-10-11"
updated: "2026-10-13"
claimed_at: "2026-10-13T14:34:54.960Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-sweep-auto-done-refusal-warnings
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-sweep-auto-done-refusal-warnings.md
  Leaves live only under a story. id is the filename stem: task-sweep-auto-done-refusal-warnings.
  CLI `arggon create task sweep-auto-done-refusal-warnings` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Sweep auto-done logs for merge-time done-gate refusal rate

## Context

Follow-up proposed as text in `task-measure-kernel-refusal-rate` (PR #726), which found 0 recorded kernel refusals per 1,224 lifecycle transitions over 2026-08-16→2026-10-11 and closed AutoHarness's thesis as unmeasurable-and-observably-zero — except for the one rule with an event-level source: `.github/workflows/auto-done.yml` emits `::warning::` for done-gate refusals, unexpected update failures, and illegal `todo`/`blocked → done` flips at merge time. The 497-run read (2026-09-11→2026-10-11) did not finish in-session (spot sample 0/19); pattern set and per-run command lineage live in that session's `/tmp/opencode/autodone-runs.txt` (ephemeral — reconstruct with `gh run list --workflow auto-done.yml` + `gh run view <id> --log`).

## Acceptance

- [ ] Sweeps the 497 auto-done run logs for executed `::warning::` refusal / illegal-transition lines (bounded read of an existing source, ~15 min, no new surface)
- [ ] Reports the done-gate merge-time refusal rate with flip attempts as denominator, with the same honest limits as the parent item
- [ ] If that rate is also ~0, links the parent report from exploration-021's Recommendation and closes the AutoHarness question for this repo; if high, files the substrate follow-up (do not scope it here)
- [ ] `arggon validate` green; PR opened. Advisory unless a surface is added

## Notes
