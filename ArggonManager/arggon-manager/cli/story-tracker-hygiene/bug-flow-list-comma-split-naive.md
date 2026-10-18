---
type: bug
status: todo
id: bug-flow-list-comma-split-naive
title: "parseValue splits a flow list on a comma naively, so a quoted element containing a comma does not round-trip"
parent: story-tracker-hygiene
labels: [tracker-schema, cli]
created: "2026-10-18"
updated: "2026-10-18"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-flow-list-comma-split-naive.md
  Leaves live only under a story. id is the filename stem: bug-flow-list-comma-split-naive.
  CLI `arggon create bug flow-list-comma-split-naive` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# parseValue splits a flow list on a comma naively, so a quoted element containing a comma does not round-trip

## Context

Filed by the delivery lead from the standards review of PR #862
(`bug-update-depends-on-multiline-rejected`, finding F3). That PR widened the
frontmatter reader to accept a list value continued over following physical
lines; the reviewer confirmed the widening itself is scoped and correctly
deferred this separate defect.

`parseValue` (`lib/src/frontmatter.ts`) splits the inside of a flow sequence on
`","` without honouring quoting, so an element that itself contains a comma
becomes two elements. Reproduce by reading a shape the writer's own quoting
(`formatValue`) can produce:

```yaml
labels: ["a, b"]
```

round-trips as **two** labels (`a` and ` b`) instead of one (`a, b`).

Unreachable through the CLI today: `assertLabels` (`lib/src/ids.ts:72`) and the
id/label patterns forbid `,`, and no CLI path builds a list element containing a
comma — which is exactly why the reviewer deferred it instead of widening the
scope of PR #862. It is filed rather than dropped because the writer's quoting
and the reader's splitting disagree in principle; the review bar requires
deferred findings to become items.

## Acceptance

- [ ] `parseValue` splits a flow list respecting quoting, so a quoted element containing a comma yields ONE element — matching what `formatValue` can emit
- [ ] A regression test pins `labels: ["a, b"]` single-line AND the wrapped form round-tripping to one element `a, b`; the test fails against the pre-fix naive split
- [ ] If the fix is deliberately NOT made, the checklist is replaced by a recorded decision on this item naming the guard that keeps it unreachable (`assertLabels`/id patterns forbid `,`) and the residual risk accepted
- [ ] `arggon validate` green; `npm test` green for the touched surface; PR opened

## Notes
