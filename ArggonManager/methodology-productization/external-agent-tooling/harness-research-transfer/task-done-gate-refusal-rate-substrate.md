---
type: task
status: todo
id: task-done-gate-refusal-rate-substrate
title: "Done-gate merge-time refusal rate is 16–18%, not 0: classify the substrate with the corrected measurement"
parent: harness-research-transfer
labels: [methodology, telemetry]
created: "2026-10-13"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-done-gate-refusal-rate-substrate.md
  Leaves live only under a story. id is the filename stem: task-done-gate-refusal-rate-substrate.
  CLI `arggon create task done-gate-refusal-rate-substrate` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Done-gate merge-time refusal rate is 16–18%, not 0: classify the substrate with the corrected measurement

## Context

The sweep `task-sweep-auto-done-refusal-warnings` (PR #779, merged) refuted its parent's zero. The done-gate merge-time refusal rate is **16.0% (42 refusals / 262 kernel flip attempts)** in `task-measure-kernel-refusal-rate`'s own window (500 auto-done runs <= 2026-10-11) and **18.1% (52/288)** over the full 534-run window (<= 2026-10-13) — 52 events across 49 distinct items. The parent reported 0/220 because its pattern keyed on the literal `::warning::`, which never appears as executed output: the runner renders an executed warning as `##[warning]<msg>`. Both the raw logs and the check-run annotations APIs agree on the corrected counts (239 step-level warnings each, 0 runs disagreeing). Separately, 138-152 illegal `todo -> done` warn-and-skips never reach the kernel (the workflow checks `list` first) and are excluded from the rate. Refusals are ephemeral by design (the flip `fail()` returns no commit), so merge-time CI is the only surface. For scale: ADR 0025's static done-gate refusal figure is 117/482 (24.3%).

## Acceptance

- [ ] the 52 refusal events are classified (top causes) with the corrected method, and the ephemeral design is accounted for in what can be measured
- [ ] decide and record whether the substrate needs work (pre-check on the flip path, message quality, or the rate is acceptable noise) and link exploration-021
- [ ] the measurement correction is captured where future sweeps find it (the `##[warning]` render vs the literal `::warning::` trap)
- [ ] reconciled with ADR 0025's 117/482 if the two are the same population
- [ ] `arggon validate` green; PR opened. Advisory unless a surface is added

## Notes
