---
type: bug
status: todo
id: bug-docs-ts-stale-example-path
title: cli/src/docs.ts orphan-reaping example path is stale — the example names a destination the rename removed
parent: role-model-foundation
labels: [docs, cli]
priority: p3
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-docs-ts-stale-example-path.md
  Leaves live only under a story. id is the filename stem: bug-docs-ts-stale-example-path.
  CLI `arggon create bug docs-ts-stale-example-path` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cli/src/docs.ts orphan-reaping example path is stale — the example names a destination the rename removed

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

Found reviewing PR #641: `cli/src/docs.ts` (~line 990) carries a stale example path in the
orphan-reaping comment/label — it names a **destination the rename removed**. A worked example
in the code that decides whether a file may be deleted should name a file that exists, or a
reader cannot tell an example from a live value.

## Acceptance

- [ ] The example names a destination that exists in the current templates (the four shipped agent ids are the natural choice)
- [ ] If the string is a **fallback/literal** rather than an example, say so in the comment — ambiguity here is the defect
- [ ] `npm run check:plugin` green if the bundle inlines this file; `npm test` green; prettier clean
