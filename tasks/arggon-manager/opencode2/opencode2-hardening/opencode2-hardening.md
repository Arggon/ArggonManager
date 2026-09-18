---
type: story
status: todo
id: opencode2-hardening
title: OpenCode2 hardening backlog
parent: opencode2
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/opencode2-hardening.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# OpenCode2 hardening backlog

## Context

The OpenCode2 integration program (story-opencode-v2) closed its functional
scope with W7. Every non-blocking finding from the wave reviews was filed as an
item; this story owns that backlog so the program story can reach a terminal
state through the normal cascade **without waiving or losing any finding**
(they were moved, not closed: same bodies, same acceptance).

Items: seam polish (present-skip docs, signature anchoring, tool permissions) ·
doctor polish (sanitize hint keys, parser regression tests, candidate parity) ·
plugin import gotcha (documented workaround + 2.x re-verification) · plugin
hardening (command-position parsing, storage guard order, cache keying) · MCP
meta hardening (normalize/cap meta-derived author, edge tests) · context report
polish (git-history robustness, helper tests, CI gate decision) · wave harness
hardening (probe marker assertions, batching checks, A/B export guard).

## Acceptance

- [ ] Every child item's acceptance checklist is complete and the tree
      validates clean; items are closed only on their own merits (never
      bulk-waived).
- [ ] `arggon validate` green; no finding from the wave reviews is untracked.
- [ ] The V2 playbook records anything learned while closing the backlog (e.g.
      the import gotcha re-verification on the next 2.x).

## Notes

- Priority is p3 by design: the integration is shipped and usable from
  `opencode2`; this backlog improves robustness, not availability.
- If an item grows beyond its current scope, split it rather than expanding the
  story.
