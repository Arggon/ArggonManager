---
type: task
status: todo
id: task-opencode2-claimcommit-subfields-documented
title: "`docs/opencode2.md` start row names only part of `preparation.claimCommit` (committed, hash, message, skipped, ignored[]) — same incompleteness class the sibling item just closed for `preparation`"
parent: methodology-improvements
labels: [docs, json-contract]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-opencode2-claimcommit-subfields-documented.md
  Leaves live only under a story. id is the filename stem: task-opencode2-claimcommit-subfields-documented.
  CLI `arggon create task opencode2-claimcommit-subfields-documented` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/opencode2.md` start row names only part of `preparation.claimCommit` (committed, hash, message, skipped, ignored[]) — same incompleteness class the sibling item just closed for `preparation`

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #609 (task-opencode2-payload-contract-preparation-fields), 2026-10-03, and reported rather than fixed so the sibling change would stay tight.

That item documented the `preparation` receipt field by field and added a doc-contract test that runs the real native seam and reads the doc's table against the actual payloads. It also found:

- **`claimCommit` is still only partly named** in the `start` row — `committed`, `hash`, `message`, `skipped`, `ignored[]` are the real sub-fields, and the row does not enumerate them. Same incompleteness class that item just closed for `preparation`, one level over.
- **`NativeClaimCommitReceipt.status` still lists a dead `"already-committed"` union member** that no code path emits. The doc's enumeration is correct; the TYPE is the thing carrying a value nothing produces.

Both belong here rather than reopening #609. The doc-contract test that now exists makes this cheap: extend its coverage to `claimCommit`'s sub-fields and let it fail on a dead union member, so the type and the doc cannot drift apart again.

Acceptance:
- [ ] `claimCommit` sub-fields enumerated in the doc (committed, hash, message, skipped, ignored[]) with types and bounds, verified against the kernel
- [ ] The dead `"already-committed"` union member removed from `NativeClaimCommitReceipt.status`, or implemented if it was ever meant to exist — decide and record which
- [ ] The doc-contract test from PR #609 extended to cover `claimCommit`, including a check that no documented union member is unreachable and no emitted member is undocumented
- [ ] Depends on PR #609 landing first, so the test is extended rather than duplicated
