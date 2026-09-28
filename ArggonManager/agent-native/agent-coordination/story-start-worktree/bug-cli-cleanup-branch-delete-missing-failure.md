---
type: bug
status: todo
id: bug-cli-cleanup-branch-delete-missing-failure
title: "CLI cleanup reports a branch-delete failure in pruned but not in failures[]"
parent: story-start-worktree
labels: [opencode-seam, review-followup]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-cli-cleanup-branch-delete-missing-failure.md
  Leaves live only under a story. id is the filename stem: bug-cli-cleanup-branch-delete-missing-failure.
  CLI `arggon create bug cli-cleanup-branch-delete-missing-failure` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CLI cleanup reports a branch-delete failure in pruned but not in failures[]

## Context

`runCleanup` (`cli/src/cleanup.ts`) handles the `git branch -d` failure that
races the pre-flight merge check in an inner `try`/`catch`: it pushes
`{ id, action: "failed", error, leftoverBranch }` into `pruned` and then keeps
going (the worktree is already gone, so the record is still cleared). That
inner catch never touches the `failures: string[]` array, which is only filled
by the OUTER per-candidate catch. `ArggonManager/docs/json-output.md` §`cleanup`
says per-item prune failures "appear in `pruned` (`action: "failed"`, `error`)
AND `failures`", so `arggon cleanup --prune --json` violates the documented
contract: the flat list reads as a clean run even though a branch delete
failed. `cli/src/worktree.test.ts` ("clears the record and reports
leftoverBranch when branch -d fails after removal") currently pins the wrong
behavior with `expect(result.failures).toEqual([])`.

Pre-existing at `origin/main`, independent of the native plugin path. The
twin native defect is `bug-native-cleanup-branch-delete-missing-failure` (fixed
in `opencode/plugins/arggon/index.ts`), which was filed from the PR #421 review
of the native path and carried the assumption that the CLI did the right thing
— it does not. Keep this one scoped to the CLI (`cli/src/cleanup.ts` plus its
tests) so both surfaces are fixed on their own; the shared contract text in
`docs/json-output.md` needs no change.

## Acceptance

- [ ] Every CLI branch-delete failure appends a bounded `<id>: <error>` entry to `failures[]` as well as the structured `pruned` failure, with the SAME message on both surfaces.
- [ ] The record is still cleared after a failed branch delete (the worktree is gone) and the run still continues with the next candidate — unchanged.
- [ ] Replace the `expect(result.failures).toEqual([])` assertion in `cli/src/worktree.test.ts` with one that pins the new entry, and cover the bounded message.
- [ ] `docs/json-output.md` §`cleanup` stays accurate (no change expected — it already documents both surfaces).
- [ ] Full test, lint, build and validate remain green.

## Notes

Found while fixing `bug-native-cleanup-branch-delete-missing-failure`
(2026-09-28). Nothing in the CLI was changed by that PR on purpose: the
instructions for the native fix scope were "do not change what the CLI emits;
file the gap instead".
