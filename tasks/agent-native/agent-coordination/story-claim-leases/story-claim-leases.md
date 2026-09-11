---
type: story
status: todo
id: story-claim-leases
title: Claim leases and staleness
parent: agent-coordination
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-claim-leases/story-claim-leases.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Claim leases and staleness

## Context

A claim today is eternal. Adding `claimed_at` (set by `start`/claim updates) makes staleness observable (`list --stale --older-than 7d`) and reclaim safe: humans get a supervised `steal --reason`, agents keep the no-steal rule.

## Acceptance

- [ ] `claimed_at` is additive, set on claim, cleared on unclaim; `--json` exposes it
- [ ] Stale claims are listable; stealing a stale claim requires a human with `--reason`
