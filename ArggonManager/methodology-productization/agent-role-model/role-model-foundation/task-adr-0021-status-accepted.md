---
type: task
status: in_progress
id: task-adr-0021-status-accepted
title: "ADR 0021 merged while its own status line still reads `Proposed` — flip file + index row to `Accepted` (ADR lifecycle, engineering.md §ADR process)"
assignee: arggon-coordinator
branch: feat/task-adr-0021-status-accepted
parent: role-model-foundation
labels: [docs, adr]
priority: p2
created: "2026-10-04"
updated: "2026-10-04"
claimed_at: "2026-10-04T17:30:35.977Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-0021-status-accepted
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-adr-0021-status-accepted.md
  Leaves live only under a story. id is the filename stem: task-adr-0021-status-accepted.
  CLI `arggon create task adr-0021-status-accepted` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0021 merged while its own status line still reads `Proposed` — flip file + index row to `Accepted` (ADR lifecycle, engineering.md §ADR process)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR [0021](../../../docs/adr/0021-agents-primary-workers-human-product-owner.md)
merged as `171f43b3` (PR #624, 2026-10-04) carrying `- Status: Proposed` plus the
sentence *"becomes Accepted at PR merge, per the ADR lifecycle in
`engineering.md:191`"*. That lifecycle says **Accepted when merged**, so after the
merge the file contradicts its own text and a binding decision reads as
non-binding.

Same drift class as the open `bug-engineering-doc-stale-adr-statuses` (a status
flip landed in the files but not the docs) and the c0cdd60b incident the ADR parity
suite is built on. Filed rather than silently fixed: a wrong status in a reader's
index is not recoverable from the link.

## Acceptance

- [x] ADR 0021's `- Status:` line reads `Accepted`
- [x] Its header keeps a dated note that acceptance came from the merge of PR #624 (`171f43b3`, 2026-10-04) — an ADR is superseded, never silently rewritten (`engineering.md:191`)
- [x] **The `docs/adr/README.md` index row for 0021 flips in the same change** — `cli/src/adr-index-parity.test.ts` asserts the index status CLASS agrees with the file, so flipping one alone turns the suite red (the mirror image of the failure PR #624 hit)
- [x] `npx vitest run cli/src/adr-index-parity.test.ts` green (7 passed)
- [x] `npx prettier --check` on both files clean
- [x] `arggon validate` + `npm test` green; no other ADR touched, no row reordered (expected: `ok (0 warnings)`; 126 files / 2590 tests passed)
- [x] The exploration `exploration-agent-primary-workers-019` is **not** rewritten: its Decision wording ("Status: Proposed; becomes Accepted at PR merge") is accurate history of what was proposed
