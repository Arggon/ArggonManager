---
type: task
status: todo
id: task-strictgatebinfailure-tail-clipped-by-head-clip
title: "`strictGateBinFailure` still appends its own \"Fix:\" line at the message tail, so worst-case head-clip eats the remedy"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam]
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-methodology-carriers/task-strictgatebinfailure-tail-clipped-by-head-clip.md
  Leaves live only under a story. id is the filename stem: task-strictgatebinfailure-tail-clipped-by-head-clip.
  CLI `arggon create task strictgatebinfailure-tail-clipped-by-head-clip` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `strictGateBinFailure` still appends its own "Fix:" line at the message tail, so worst-case head-clip eats the remedy

## Context

Found while reviewing PR #595 (bug-native-refusal-advice-clipped-by-head-clip): that PR reordered the two native refusals so the actionable advice leads and the kernel refusal trails, but `strictGateBinFailure` composes its own trailing "Fix: run npm ci ..." line AFTER the kernel text — so at worst case (8 named bins, MAX_GATE_BINS) the head-clip at MAX_NATIVE_ERROR_CHARS still eats that line, leaving the agent without the remedy. The item acceptance for #595 did not cover it (it only required named bins + attach re-run for the gate-bin gate), so the worker correctly left it out rather than widening the PR.

## Acceptance

- [ ] `strictGateBinFailure` composes its "Fix:" remedy before the kernel refusal text (same shape #579/#595 landed), keeping every existing clause verbatim
- [ ] A test with the full `MAX_GATE_BINS` worst-case list asserts the `npm ci` remedy survives the clip, with ordering pinned
- [ ] Negative control: message at the cap and the last named bin absent

## Notes
