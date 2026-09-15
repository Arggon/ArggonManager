---
type: bug
status: in_progress
id: bug-budget-adopter-trees
title: doctor --budget measures nothing in adopter trees (resolves cli/src from cwd)
assignee: Arggon
parent: operating-principles
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T23:52:14.977Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/bug-budget-adopter-trees.md
  Leaves live only under a story. id is the filename stem: bug-budget-adopter-trees.
  CLI `arggon create bug budget-adopter-trees` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# doctor --budget measures nothing in adopter trees (resolves cli/src from cwd)

## Context

Found 2026-09-15 running `doctor --json --budget` in the fresh casa-pendiente adopter repo (first real use after PR #227): `budgetError: "budget measurement runs the CLI from source (npm run arggon) — cli/src/cli.ts not found"`, budget null. The measurement resolves the CLI relative to the CURRENT tree — which works in ArggonManager itself but is exactly backwards for adopters: they are the ones who need the ADR 0006 budget report on their generated tree. The vencimientos/casa-pendiente experiments are the target audience of doctor --budget, and it produces nothing there.

## Acceptance

- [ ] The budget measurement resolves the CLI from the RUNNING installation (import.meta.url / dist of the executing arggon), not from the measured tree's cwd — `doctor --budget` works identically in ArggonManager and in any adopter tree
- [ ] Test: doctor --budget run from a non-ArggonManager initialized tree returns a budget section (no budgetError)
- [ ] docs/json-output.md budget documentation corrected if it implied ArggonManager-only

## Notes
