---
type: bug
status: in_progress
id: bug-native-comment-lost-update
title: "Native comment lost update: two concurrent tools.arggon.comment calls, one body absent from every git object"
assignee: arggon-delivery-lead
branch: fix/bug-native-comment-lost-update
parent: story-self-improvement
labels: [native-tools, concurrency]
created: "2026-10-13"
updated: "2026-10-18"
claimed_at: "2026-10-18T17:03:39.404Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-native-comment-lost-update
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-self-improvement/bug-native-comment-lost-update.md
  Leaves live only under a story. id is the filename stem: bug-native-comment-lost-update.
  CLI `arggon create bug native-comment-lost-update` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native comment lost update: two concurrent tools.arggon.comment calls, one body absent from every git object

## Context

Recorded inside `bug-verifier-cannot-read-the-tracker-no-allow-side` (second finding, 2026-10-11). Two `tools.arggon.comment` calls reported `ok: true`, but one ~4 KB body never reached disk — verified three ways (`grep -rn`, `git log --all -S`, the file's back-to-back headings); absent from every git object. A controlled scratch-item experiment falsified size, fences, default author and nested headings; both failures share only that another `tools.arggon.*` write was in flight in the same session (a branch rebase; a `create` auto-commit landing in the same window) — pointing at a concurrent-writer LOST UPDATE on the native path. Consistent with the DONE `bug-comment-race-no-lock` / `bug-comment-torn-read` fixes, so either that reasoning is wrong or those fixes have a gap on the native surface. Reproducer: two foreground `tools.arggon.comment` calls to the same item fired concurrently, asserting both bodies survive.

## Acceptance

- [ ] the reproducer is executed: two concurrency-shaped `tools.arggon.comment` calls to one item, both bodies asserted on disk (and in git)
- [ ] at least one of: the loss is reproduced with a minimal case, or the failure mode is definitively falsified and the observation explained
- [ ] if real: a fix with a regression test; if not: the item records the falsification and closes
- [ ] evidence expected-vs-observed; `arggon validate` + affected suites green

## Notes
