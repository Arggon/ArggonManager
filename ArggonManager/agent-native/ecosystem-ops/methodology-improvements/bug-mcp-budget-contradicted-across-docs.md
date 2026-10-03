---
type: bug
status: todo
id: bug-mcp-budget-contradicted-across-docs
title: "MCP `tools/list` budget is documented as ≤12,288 B / 9,040 B baseline in README + json-output.md while `cli/src/measure.ts` says 16,384 / 15,701 — and MCP is the only one of the three bounds that is advisory, not CI-gated"
parent: methodology-improvements
labels: [context-budget, docs]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-mcp-budget-contradicted-across-docs.md
  Leaves live only under a story. id is the filename stem: bug-mcp-budget-contradicted-across-docs.
  CLI `arggon create bug mcp-budget-contradicted-across-docs` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# MCP `tools/list` budget is documented as ≤12,288 B / 9,040 B baseline in README + json-output.md while `cli/src/measure.ts` says 16,384 / 15,701 — and MCP is the only one of the three bounds that is advisory, not CI-gated

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] One source of truth for the MCP bound and its baseline: \`cli/src/measure.ts\` owns both, and README + \`docs/json-output.md\` are corrected to match (or the docs cite it and stop restating the number)
- [ ] Decide whether the MCP bound becomes a CI gate like its two siblings, or stays advisory with that status stated explicitly in the docs — a bound nobody checks is a wish
- [ ] The \`npx arggon doctor --budget\` output and \`npm run context:report\` agree on the figure and the owner (same lesson as the baseline-date mismatch: every surface that prints a number must print the right one)
- [ ] A test asserts the documented figure equals \`measure.ts\`'s constant, so the docs cannot drift from the code again

## Notes
