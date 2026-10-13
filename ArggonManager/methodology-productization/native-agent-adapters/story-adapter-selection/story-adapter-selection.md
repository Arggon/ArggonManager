---
type: story
status: todo
id: story-adapter-selection
title: Adapter selection flags + doctor (spec S2)
parent: native-agent-adapters
labels: []
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/story-adapter-selection.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Adapter selection flags + doctor (spec S2)

## Context

Setup should install only the seams the adopter asked for, and the status report
should say plainly what setup would do with every seam file. A fresh scaffold
carries no marker of any helper, so a literal "every detected helper" default
would silently ship no seam at all on the very first run; an existing tree
narrows through an explicit flag, and a name nobody ships is refused by name
with nothing written.

This story carries the selection flags and the status report: which rule fired,
per file what was written or skipped with honest counts, and per helper the gap
rows from the shipped matrix — all in one shared vocabulary for file states.
(Spec-methodology-adapters-017 §S2.)

## Acceptance

- [ ] Setup materializes exactly the chosen seams (and none with the no-helpers option), never removes or overwrites a helper-edited file, and a fresh scaffold with no marker selects every known helper rather than silently shipping none (spec §S2)
- [ ] The machine-readable selection report states which rule fired and per file what was written or skipped with honest counts; an unknown helper name is refused by name with nothing written
- [ ] The status report lists every seam file by what setup would do with it and carries that helper's gap rows from the shipped matrix in one shared vocabulary for file states (spec §S2)
- [ ] The project's verification gates and `arggon validate` stay green with no new finding naming this story

## Notes
