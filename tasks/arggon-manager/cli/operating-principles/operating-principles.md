---
type: story
status: in_progress
id: operating-principles
title: "Operating principles: architecture-first, cheap infra, token/context efficiency"
assignee: Arggon
parent: cli
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T21:04:27.510Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/operating-principles.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Operating principles: architecture-first, cheap infra, token/context efficiency

## Context

Three operating principles for ArggonManager's modus operandi, set 2026-09-14.
They bind the tool itself AND every project that adopts it:

1. **Architecture-first (code is cheap):** writing code is cheap, so following
   good practices and keeping a sound software architecture is ALWAYS
   important — in ArggonManager and in the projects that adopt it. Speed never
   justifies structural debt.
2. **Cheap infra (infrastructure is expensive):** infrastructure costs real
   money, so there is always an investigation into the most accessible way to
   get an ArggonManager-generated project to production, minimizing ongoing
   maintenance cost.
3. **Token/context efficiency:** agent tokens and context windows are a
   priority; ArggonManager must investigate and optimize how it manages agent
   work so agents spend the least tokens and context possible.

Landing plan: principle 1 institutionalizes now (governing docs + templates);
principles 2 and 3 are research-first (exploration with dated sources + ADR
Proposed), their recommendations shape the product afterwards.

## Acceptance

- [x] Principle 1 institutionalized in governing docs and templates (task-architecture-first-principle)
- [x] Principle 2 researched: cheapest path-to-prod exploration + ADR (task-cheap-infra-research)
- [x] Principle 3 researched: token/context optimization exploration + proposal (task-token-context-research)

## Notes
