---
type: bug
status: done
id: bug-cli-cleanup-branch-delete-missing-failure
title: "CLI cleanup reports a branch-delete failure in pruned but not in failures[]"
assignee: Arggon
branch: fix/bug-cli-cleanup-branch-delete-missing-failure
parent: story-start-worktree
labels: [opencode-seam, review-followup]
priority: p3
created: "2026-09-28"
updated: "2026-10-01"
worktree_path: /home/arggon/Projects/ArggonManager-bug-cli-cleanup-branch-delete-missing-failure
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

- [x] Every CLI branch-delete failure appends a bounded `<id>: <error>` entry to `failures[]` as well as the structured `pruned` failure, with the SAME message on both surfaces.
- [x] The record is still cleared after a failed branch delete (the worktree is gone) and the run still continues with the next candidate — unchanged.
- [x] Replace the `expect(result.failures).toEqual([])` assertion in `cli/src/worktree.test.ts` with one that pins the new entry, and cover the bounded message.
- [x] `docs/json-output.md` §`cleanup` stays accurate (no change expected — it already documents both surfaces).
- [x] Full test, lint, build and validate remain green.

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

### 2026-10-01 @Arggon — CLI fix implemented

Both surfaces fixed in `cli/src/cleanup.ts` (the only source file touched):

1. **Headline (branch-delete catch):** now bounds the message with a new
   envelope-shaped helper and pushes `${entry.id}: ${message}` to `failures[]`
   as well as the structured `pruned` failure — SAME message on both, matching
   the native twin's shape in `opencode/plugins/arggon/index.ts` (its
   `boundedNativeText` + `MAX_NATIVE_DETAIL_CHARS` catch blocks).
2. **Second surface (outer per-candidate catch):** the same bound applied to
   both `failures[]` and `pruned[].error`.
3. **The helper:** `boundedEnvelopeText` + `MAX_ENVELOPE_DETAIL_CHARS = 500`,
   exported from `cli/src/cleanup.ts`: control characters (`U+0000–U+001F`,
   `U+007F`) each become ONE space, then clip at 500 chars including the `…`
   elision mark. Deliberately NOT `sanitizeHumanError`/`clipHumanValue` —
   those are the human channel (2000 chars + escaping) per the 2026-09-29 note.

Tests (`cli/src/worktree.test.ts` only; the direct `spawnSync`/tsx calls were
left exactly as-is — no spawn-helper migration):

- The old `expect(result.failures).toEqual([])` in "clears the record and
  reports leftoverBranch when branch -d fails after removal" now pins
  `["task-alpha: refusing to delete branch"]` + same message on `pruned[].error`.
- New: over-long stderr (1000+ chars) + `\r`/`\t` in the branch-delete error →
  both surfaces bounded at exactly 500 chars, elision mark, no control chars.
- New: non-Error throw (`throw "raw\r\nthrow"`) → `task-alpha: raw  throw`
  (per-char replacement, native-consistent).
- New: outer-catch bounding via a throwing `removeWorktree` fake → both
  surfaces bounded; record kept (worktree still exists).
- New: real-git end-to-end envelope test — candidate worktree detached, branch
  checked out in a second worktree so `git branch -d` refuses ("used by
  worktree"); asserts `failures == ["task-alpha: <error>"]` mirroring
  `pruned[].error`, `leftoverBranch` set, record cleared, exit 0.

Fixture probe (`cleanup --prune --json` on a temp repo; before = a detached
`origin/main` checkout, after = this branch — expected vs observed):

- BEFORE: `pruned` carries `action: "failed"` + `leftoverBranch` but
  `"failures":[]` — the documented-contract violation, reproduced.
- AFTER: identical `pruned` entry AND `"failures":["task-alpha: git branch -d
  feat/task-alpha failed: error: cannot delete branch 'feat/task-alpha' used
  by worktree at '…/fx-holder'"]`; record still cleared, auto-commit still
  `chore(tasks): pruned task-alpha`, run continued.

Gates: `npm test` 1961 passed (110 files), `npm run lint` clean,
`npm run build` ok, `npm run check:plugin` ok (bundle byte-identical — cleanup
is CLI-side, nothing regenerated), `arggon validate` `ok: true`.

Finding (not fixed here — out of scope, no drive-by): the `--json` path of
`cleanup` returns before the `process.exitCode = 1` rule that the human output
path applies to non-empty `failures[]` (`cli/src/cli.ts` ~2401 vs ~2438), so
`cleanup --prune --json` exits 0 even when `failures[]` is non-empty. Confirmed
identical BEFORE and AFTER this fix (pre-existing); changing it would alter the
machine contract, so it is reported for the coordinator to track if wanted.
### handoff 2026-10-01 @ses_f0aa6a0b6ffe8unSBPZxBWEaLS (session: ses_f0aa6a0b6ffe8unSBPZxBWEaLS) — next: Review + merge PR #515 (both catch surfaces fixed, tests pin bounds); coordinate with sibling spawn-helper sweep before touching worktree.test.ts
- branch: fix/bug-cli-cleanup-branch-delete-missing-failure
- open questions: JSON cleanup exits 0 even with non-empty failures[] (pre-existing, cli.ts json early-return vs human exitCode=1); track separately if wanted

### 2026-10-01 @Arggon
CLI side fixed in worktree branch fix/bug-cli-cleanup-branch-delete-missing-failure, PR #515 (open, not merged).

Fix (cli/src/cleanup.ts is the only source file touched; worktree item file carries the full evidence section):
1. Branch-delete catch now pushes the SAME bounded message to BOTH failures[] (<id>: <error>) and pruned[].error — mirrors the native twin's shape (boundedNativeText catch blocks in opencode/plugins/arggon/index.ts).
2. Outer per-candidate catch: same 500-char envelope bound (control-char strip + elision mark) on both surfaces, via new exported boundedEnvelopeText + MAX_ENVELOPE_DETAIL_CHARS. sanitize.ts helpers deliberately NOT reused (human channel, 2000 chars + escaping).

Evidence, expected vs observed — fixture probe forcing a REAL git branch -d refusal (branch checked out in a second worktree):
- BEFORE (detached origin/main checkout): pruned carries action:"failed" + leftoverBranch but "failures":[] — the contract violation reproduced.
- AFTER (this branch): identical pruned entry AND "failures":["task-alpha: git branch -d feat/task-alpha failed: error: cannot delete branch 'feat/task-alpha' used by worktree at '…/fx-holder'"]; record still cleared, run continued, auto-commit unchanged.

Gates (all in the worktree): npm test 1961 passed (110 files); npm run lint clean; npm run build ok; npm run check:plugin ok — bundle byte-identical, nothing regenerated, so no chore(regen) commit needed; arggon validate ok:true. Commit 5f9c2c0e, 3 files staged explicitly (cleanup.ts, worktree.test.ts, item file).

Notes for the reviewer:
- The test file's direct spawnSync/tsx calls were left exactly as-is (sibling spawn-helper sweep is a different item — no migration done here).
- Pre-existing, NOT fixed (out of scope): the --json path of cleanup exits 0 even when failures[] is non-empty (json early-return sits before the human-path process.exitCode = 1 in cli.ts). Identical before/after this fix; recorded in the handoff open questions.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: approve (lead-architect review, PR #515)
- Architecture: one bounded envelope helper (boundedEnvelopeText + MAX_ENVELOPE_DETAIL_CHARS = 500, control chars -> space then clip with elision) applied to BOTH catches; branch-delete failures now reach failures[] AND pruned[].error, mirroring the native twin's dual-push shape. Human channel (sanitize.ts, 2000 chars) correctly not leaked into the machine envelope; reviewer verified CLI readers lose nothing (human path re-sanitizes).
- Scope: exactly 3 files; no bundle drift; spawn-helper fence obeyed (4 pre-existing wrapper spawns untouched — the parallel migration item owns those).
- Tests travel with behavior: reviewer hand-traced every new assertion to fail on pre-fix code (pinned failures entry, 500-char/control-char bounds, non-Error throws, outer catch, real-git e2e with exit-0 caveat documented); coordinator independent run: worktree.test.ts 50/50.
- Smoke: worker's real-git refusal fixture probe (expected vs observed: failures [] -> populated, record cleared, run continued) on the item.
- Pre-existing exit-0-with-failures contract finding documented, not drive-by fixed — filed as task-cleanup-json-exit-code (p3).
- Reviewer bars 1-5 pass; merge pending CI.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Merged: PR #515 squash -> main (CI cli/tasks-validate/ui-smoke green). Item flipped done. Follow-up filed: task-cleanup-json-exit-code (exit-0-with-failures contract decision).
