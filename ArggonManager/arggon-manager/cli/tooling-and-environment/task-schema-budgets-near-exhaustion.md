---
type: task
status: todo
id: task-schema-budgets-near-exhaustion
title: ADR 0006 tool-schema budgets are within 99 B (native) / 88 B (MCP) of their caps after cleanup --force — the next schema addition needs a trim first
parent: tooling-and-environment
labels: [context-budget, native-seam, cli]
created: "2026-10-12"
updated: "2026-10-12"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-schema-budgets-near-exhaustion.md
  Leaves live only under a story. id is the filename stem: task-schema-budgets-near-exhaustion.
  CLI `arggon create task schema-budgets-near-exhaustion` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0006 tool-schema budgets are within 99 B (native) / 88 B (MCP) of their caps after cleanup --force — the next schema addition needs a trim first

## Context

Recorded by the standards review of PR #751 (`bug-cleanup-prune-untracked-artifacts-no-force`),
2026-10-12: adding the bare `force` boolean to the cleanup surface consumed most of
the remaining headroom under the ADR 0006 tool-schema budgets —

- native `tools/list`: **12,189 B / 12,288 B** (99 B left)
- live MCP `tools/list`: **16,296 B / 16,384 B** (88 B left)

`force` shipped bare (no description text) on both surfaces because of this. The
next schema addition (a parameter, a tool, a description line) needs a trim
first — or a deliberate budget decision — rather than silently blowing the cap.

## Acceptance

- [ ] Measure the current headroom fresh — `npm run context:report` for the
      native catalog figure and `npm run arggon -- doctor --budget` for the MCP
      figure (doctor prints no native line; context:report is the owning
      command) — and record the numbers here; identify the largest schema-text
      contributors (tool descriptions, parameter descriptions, enum spellings)
- [ ] Decide and implement one: trim (shorten the heaviest descriptions /
      dedupe repeated parameter docs) until the next plausible addition fits;
      raise the budget with the ADR 0006 reasoning recorded; or a named
      first-to-cut list the next author uses before adding schema text
- [ ] If trimmed: the surfaces stay behaviourally identical (schema text only),
      `doctor --budget` reports the new figures, and the budget-contract tests
      (native + MCP) stay green
- [ ] The decision is written where the next author reads it (`docs/opencode2.md`
      or `engineering.md` §Non-functional bar) so "budget near exhaustion" is
      discoverable before the change, not after a red test

## Notes
