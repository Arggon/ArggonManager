---
type: task
status: todo
id: task-audit-protocol
title: Adversarial audit protocol + first recurring audit
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/task-audit-protocol.md
  Leaves live only under a story. id is the filename stem: task-audit-protocol.
  CLI `arggon create task audit-protocol` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adversarial audit protocol + first recurring audit

## Context

The two best bugs of the series (claim race, reopen gate, ack drift promise) were found by adversarial agents attacking invariants and checking doc promises against behavior. Formalize that as a documented protocol so ANY agent can run an audit: (1) invariant-violation checklist (claim exclusivity, never-reopen/steal for agents, never-overwrite, cascade honesty, lost pushes), (2) doc-promise conformance sweep (extract "never/always/requires/only" statements from skill+docs and test each against the built CLI), (3) rotation: every audit picks fresh attack angles. Findings file via the tracker as always.

## Acceptance

- [ ] docs/labs/adversarial-audit.md: the protocol (invariant checklist, conformance sweep, angle rotation, filing rules)
- [ ] First audit executed: task created + findings filed in the tracker (or zero-findings report)
