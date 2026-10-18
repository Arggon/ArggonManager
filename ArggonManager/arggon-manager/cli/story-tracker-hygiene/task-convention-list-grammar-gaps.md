---
type: task
status: todo
id: task-convention-list-grammar-gaps
title: convention.md under-documents the frontmatter list-value read grammar (two accepted shapes and the bracket-leading scalar change)
parent: story-tracker-hygiene
labels: [docs, tracker-schema]
created: "2026-10-18"
updated: "2026-10-18"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-convention-list-grammar-gaps.md
  Leaves live only under a story. id is the filename stem: task-convention-list-grammar-gaps.
  CLI `arggon create task convention-list-grammar-gaps` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# convention.md under-documents the frontmatter list-value read grammar (two accepted shapes and the bracket-leading scalar change)

## Context

Filed by the delivery lead from the standards review of PR #862
(`bug-update-depends-on-multiline-rejected`, finding F4 — advisory,
non-blocking). That PR added the frontmatter list-value grammar to
`ArggonManager/docs/convention.md` §Frontmatter schema, but three behaviours the
implementation actually accepts are unnamed in the contract:

- **(a)** a flow sequence opened on the key's own line and continued below
  (`depends_on: [a,` then an indented `b]`) is accepted;
- **(b)** `parseValue` drops empty parts, so `[a, , b]` drops the empty element
  (it previously became `""`) and a trailing comma is dropped;
- **(c)** a value that merely **starts** with `[` is now read as a flow
  sequence, so a previously-loadable scalar such as `x-note: [TODO` now refuses
  loudly with `BROKEN_YAML`.

(c) is the conservative direction (loud, not silent) and consistent with the
stated rule, but a reader of the contract should not have to discover it from
the parser. One clause each is the whole ask.

## Acceptance

- [ ] `ArggonManager/docs/convention.md` §Frontmatter schema names (a), (b) and (c) above in the list-value grammar
- [ ] The wording is checked against `lib/src/frontmatter.ts` behaviour (`readValue` / `readFlow` / `parseValue`), not restated from this item
- [ ] `templates/docs/docs/convention.md` (the abridged adopter template) is synced only if the adopter-template invariant-drift test requires it — `npm test` decides; do not hand-sync speculatively
- [ ] `arggon validate` green; prettier clean; PR opened

## Notes
