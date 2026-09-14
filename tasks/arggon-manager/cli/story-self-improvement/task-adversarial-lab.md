---
type: task
status: todo
id: task-adversarial-lab
title: "Adversarial lab: experiment scenarios as a permanent suite"
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/task-adversarial-lab.md
  Leaves live only under a story. id is the filename stem: task-adversarial-lab.
  CLI `arggon create task adversarial-lab` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adversarial lab: experiment scenarios as a permanent suite

## Context

The five experiments produced ~20 findings; the highest-value ones came from cross-cutting scenarios (concurrent claim races, gate probes from every entry point, upgrade flows over acked docs, adoption of legacy trees, long MCP sessions). Those scenarios exist only as one-off scripts in experiment repos. Convert them into a permanent lab suite: labs/torture.test.ts (vitest picks it up) — each scenario documented with which experiment/finding it guards. NOT a duplicate of unit tests: the lab covers cross-module flows and real-process concurrency that unit tests don't.

## Acceptance

- [ ] labs/torture.test.ts with the scenario catalog: concurrent claim races (N processes, same/different assignee, mixed ops), gate probes (steal/reopen via CLI non-TTY + MCP), upgrade flows over acked state, synthetic legacy adoption, long MCP session; each test tagged with its origin (experiment/finding)
- [ ] Registered in CI (vitest run includes it); suite green
