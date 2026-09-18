---
type: bug
status: todo
id: bug-atomic-write-followups
title: "atomic-write follow-ups: .convention.yml torn-write exposure + guard/mode nits"
priority: p3
parent: story-self-improvement
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-atomic-write-followups.md
  Leaves live only under a story. id is the filename stem: bug-atomic-write-followups.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# atomic-write follow-ups: .convention.yml torn-write exposure + guard/mode nits

## Context

Findings from the independent review of PR #339 (`bug-comment-torn-read`),
which made every item-file write atomic.

- **F3 — `tasks/.convention.yml` is still written in place** at three sites:
  `cli/src/init.ts:921` (initial write), `cli/src/docs.ts:961-963`
  (`applyDocsPlan` state rewrite), `cli/src/adopt.ts:713-723` (`adopt --ack`).
  Readers that can observe the truncate window: `readConventionConfig` throws
  on a torn/partial file (used by branch/list/view paths) and
  `readConventionVersion` silently degrades to version 0 on an empty read.
  Lower exposure than item writes (deliberate, infrequent mutations) but the
  same defect class — fixable with the same `writeFileAtomic` swap.
- **F1 — shrink guard can misfire under non-locking co-writers.**
  `cli/src/atomic.ts:31-38` re-stats the target after the rename and throws a
  misleading "refusing to leave a truncated doc" when a co-writer replaces the
  same path between rename and stat with a different-size file. Affected
  non-locking writers: the promotion `depends_on` rewrite
  (`cli/src/update.ts:682`), `priority migrate` (`cli/src/priority.ts:134`),
  and concurrent `create` of the same id. Cross-item lock scope is a separate
  pre-existing class; either make the guard tolerant of same-path replacement
  or extend the lock scope where feasible.
- **F2 — replacement resets mode/ownership and severs links.** A `0600` target
  becomes `0644` after `writeFileAtomic` (verified); hard links break. All
  CLI-created item files are default-mode today, so acceptable; optional
  hardening: stat the existing target and `chmod` the tmp before rename.

## Acceptance

- [ ] The three `.convention.yml` writes use `writeFileAtomic`; a torn-read
      probe on the config path shows no partial observation; readers unchanged.
- [ ] F1 decided and implemented: the guard tolerates same-path replacement, or
      the lock scope is extended where feasible (rationale recorded).
- [ ] F2 decided: mode preserved (stat+chmod) or explicitly accepted.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- None of this blocks; item-file writes are already atomic.
