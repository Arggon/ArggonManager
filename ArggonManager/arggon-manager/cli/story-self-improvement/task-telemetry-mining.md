---
type: task
status: done
id: task-telemetry-mining
title: "Telemetry mining protocol: session logs + tracker history"
assignee: Arggon
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/task-telemetry-mining.md
  Leaves live only under a story. id is the filename stem: task-telemetry-mining.
  CLI `arggon create task telemetry-mining` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Telemetry mining protocol: session logs + tracker history

## Context

Two audit findings (dirty-tree dance, lost-push cleanup failure) came from reading session logs and tracker commit history — organic signal from REAL usage that synthetic experiments miss. Protocolize the mining: (a) ZCode session logs (~/.zcode/cli/log/*.jsonl: tool.call sequences, error patterns, retry loops per session id), (b) tracker commit history of the five live experiment repos (reverted operations, fix-of-fix commits, dirty-tree dance patterns), (c) .evidence/ dirs. Output: friction candidates filed as tracker items with evidence links.

## Acceptance

- [x] docs/labs/telemetry-mining.md: the mining procedure (sources, patterns, friction signatures, filing rules)
- [x] First mining pass over the five experiment repos + available session logs executed; friction candidates filed or reported as zero-findings
