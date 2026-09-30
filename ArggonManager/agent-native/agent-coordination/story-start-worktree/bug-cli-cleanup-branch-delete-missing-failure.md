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

### 2026-09-29 @Arggon
Sibling-surface note from the review of `bug-native-cleanup-worktree-failure-unbounded` (native plugin, PR #432). Not fixing the CLI here — this item is `todo` and unclaimed, and the native PR is scoped to the plugin.

## The CLI `cleanup` outer per-candidate catch is unbounded too

`cli/src/cleanup.ts:197`, the catch that wraps one prune candidate — the same surface `bug-native-cleanup-worktree-failure-unbounded` just bounded on the native side:

```ts
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  failures.push(`${entry.id}: ${message}`)
  pruned.push({ id: entry.id, action: "failed", error: message })
}
```

No clip, no control-character stripping, and it feeds both failure surfaces — `failures[]` and `pruned[].error`. So an over-long `git` stderr or a domain rejection carrying a whole message reaches the `--json` envelope twice, unbounded.

This is a **second, separate surface** from the branch-delete one this item already tracks, and it is worth knowing that the CLI is structurally further behind than the native path was: the native plugin had `boundedNativeText` + `MAX_NATIVE_DETAIL_CHARS` available and had simply not applied them on this catch, whereas the CLI has **no bound helper at all** here. Its nearest tools are `sanitizeHumanError` / `clipHumanValue` in `lib/src/sanitize.ts`, but those are the HUMAN-output path (`MAX_HUMAN_ERROR_CHARS` = 2000) — using them in the JSON envelope would import human-channel escaping into a machine surface, so the fix here is likely a small envelope-shaped clip (the CLI has no `boundedNativeText` equivalent).

Two things confirmed while checking, both of which bear on this item's acceptance box 1:

- `cli/src/cleanup.ts:176` (branch-delete catch) pushes to `pruned` only and never to `failures` — this item's headline defect, still open.
- Both CLI messages are unbounded, so acceptance box 1's "a bounded `<id>: <error>` entry … with the SAME message on both surfaces" needs a bound that the outer catch (line 197) also uses, or the envelope stays mixed.

## Consumer check for the CLI side

- `cli/src/cli.ts:2405-2420` prints `action.error` and each `result.failures` entry through `sanitizeHumanError()`, which clips at 2000 chars and escapes control chars — the human display is already bounded above 500, so an envelope-level 500 cap cannot remove text a CLI reader currently sees. Truncation at 500 would be visible via the elision mark.
- `cli/src/tui.ts` has no cleanup surface; `cli/src/board.ts` renders `worktree_path` as a tracker field and never a cleanup envelope.
- `smoke/opencode-smoke.test.ts:252` asserts `cleanup?.failures` is empty (no text dependence).
- Cleanup CLI/native parity is pinned for **list mode only** (`opencode/plugins/arggon/tools.test.ts:2130`), so bounding (or not bounding) the CLI prune messages breaks no parity test.

No action taken on this item; recording the evidence so the next agent does not have to re-derive it.
