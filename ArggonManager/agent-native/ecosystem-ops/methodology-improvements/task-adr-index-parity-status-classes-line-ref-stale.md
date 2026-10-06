---
type: task
status: todo
id: task-adr-index-parity-status-classes-line-ref-stale
title: "PR #618's new test cites `adr-index-parity.test.ts:125-131` for `STATUS_CLASSES`; #620 moved that constant to `:191` — the claim is true but the reference is dead"
parent: methodology-improvements
labels: [docs, adr, tests]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr-index-parity-status-classes-line-ref-stale.md
  Leaves live only under a story. id is the filename stem: task-adr-index-parity-status-classes-line-ref-stale.
  CLI `arggon create task adr-index-parity-status-classes-line-ref-stale` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# PR #618's new test cites `adr-index-parity.test.ts:125-131` for `STATUS_CLASSES`; #620 moved that constant to `:191` — the claim is true but the reference is dead

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
Filed from the PR #620 review (verdict: approve, landed as ed773495). The reviewer's F2.

### Context

PR #618 (`fix/bug-engineering-doc-stale-adr-statuses`) added a test that asserts the ADR index parity suite enforces ADR-status class agreement, and it cites `cli/src/adr-index-parity.test.ts:125-131` as where `STATUS_CLASSES` lives.

PR #620 (`feat/task-adr-index-parity-does-not-check-titles`) rewrote that same file and **moved `STATUS_CLASSES` to `:191`**. The claim #618 makes is still true; only its line reference is dead.

This is a cross-item reference into a file two concurrent PRs are both rewriting. It is small and non-blocking, but it is exactly the class that survives review and misleads a future reader — a citation that looks precise and is not.

### Acceptance

- [ ] The reference in #618's test names `STATUS_CLASSES` **by identifier**, not by line range, so the next rewrite of that file does not silently falsify it — or, if a line range is kept, it matches the post-#620 file
- [ ] `npx vitest run cli/src/adr-index-parity.test.ts cli/src/<the #618 test>` green on a tree containing both #618 and #620
- [ ] Filed against the file that owns the reference (#618's test), not against #620 — #620 did not introduce the error
- [ ] The diff confirms `STATUS_CLASSES` is still exported/present after #620, so this is a citation fix and not a dangling-symbol repair
