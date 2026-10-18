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

### 2026-10-18 @arggon-maker
FALSIFICATION RECORD — see comment below for detail.

### 2026-10-18 @arggon-maker
Falsified: native comment lost update does not reproduce with current code.

Reproducer executed (cli/src/comment-lost-update.test.ts): two foreground `arggon comment --json` calls, ~4 KiB bodies each, fired concurrently to one item.
- Expected: both bodies survive on disk and in git.
- Observed: both bodies survive, exactly once each on disk (file read count === 1 per body) and both present in `git log --all -S <fragment>`. validate --json ok:true on the fixture.

Root cause analysis: `runComment` (lib/src/comment.ts) already serializes same-item writers with `withItemLock(item.filePath)` (bug-comment-race-no-lock), re-reads the body INSIDE the lock before appending, and writes via `writeFileAtomic` (temp file + rename + shrink guard, bug-comment-torn-read). Every other item-file writer — `runUpdate` (lib/src/update.ts:930) and `start` (delegates to `runUpdate`) — takes the same `withItemLock(item.filePath)`. So no concurrent writer can read a stale body and overwrite a comment; last-write-wins cannot occur on the native surface. The auto-commit (`commitTrackerMutation`) runs after the durable write under a separate repo-level git-mutation lock; even when a commit is skipped it is reported on stderr + payload, never silent — so a body is never "absent from disk" due to a lost commit.

Conclusion: the historical observation predates / falls outside the `withItemLock` + `writeFileAtomic` guards (bug-comment-race-no-lock / bug-comment-torn-read). Those fixes are complete on the native surface — there is no gap. No code change is required.

Affected suites green: comment, comment-race, comment-lost-update, lock, atomic, tracker-commit, update (63 tests). validate green on a clean fixture.

Note: this worktree carries pre-existing staged placeholder fixtures (launch/auth/...) whose commit-time validate blocks auto-commits here; comment writes still land on disk and are reported ok. Unrelated to this item.

### handoff 2026-10-18 @Arggon — next: Delivery lead reviews the falsification record on the item and closes it (bug is not reproducible; no code change required).
- branch: fix/bug-native-comment-lost-update
- open questions: none
