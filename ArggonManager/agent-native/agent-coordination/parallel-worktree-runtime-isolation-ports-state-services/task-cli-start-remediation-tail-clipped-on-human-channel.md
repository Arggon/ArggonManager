---
type: task
status: in_progress
id: task-cli-start-remediation-tail-clipped-on-human-channel
title: "CLI channel: `startNotAttempted`/worktreeRemediation appends the remedy AFTER the kernel detail, so MAX_HUMAN_ERROR_CHARS head-clip still eats it at worst case"
assignee: Arggon
branch: feat/task-cli-start-remediation-tail-clipped-on-human-channel
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cli, native-seam]
created: "2026-10-02"
updated: "2026-10-03"
claimed_at: "2026-10-03T02:49:57.042Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-cli-start-remediation-tail-clipped-on-human-channel
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-cli-start-remediation-tail-clipped-on-human-channel.md
  Leaves live only under a story. id is the filename stem: task-cli-start-remediation-tail-clipped-on-human-channel.
  CLI `arggon create task cli-start-remediation-tail-clipped-on-human-channel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CLI channel: `startNotAttempted`/worktreeRemediation appends the remedy AFTER the kernel detail, so MAX_HUMAN_ERROR_CHARS head-clip still eats it at worst case

## Context

Found by the reviewer of PR #597 (task-strictgatebinfailure-tail-clipped-by-head-clip, finding F1), 2026-10-02 — the same head-clip defect the kernel channel just had fixed, still live on the CLI/human channel.

`cli/src/start.ts:815-822` composes its failure message as kernel detail FIRST, then appends `worktreeRemediation(...)` and the discard hint LAST. The human channel clips head-kept at `MAX_HUMAN_ERROR_CHARS = 2000`, so at the worst case (the full MAX_GATE_BINS = 8 named bins, each ~330 chars) the trailing remedy is again the first thing lost, and a human following the CLI gets the diagnosis without the fix. PR #597 fixed only the native/kernel path (2048-char clip); this is the CLI twin that was left behind — the same ordering violation, same shape as #573's round-2 fix which already reordered the CLI equivalents then.

## Acceptance

- [x] The CLI failure composition puts the actionable remediation (worktreeRemediation + attach/discard hint) BEFORE the kernel detail, keeping every existing clause verbatim — matching the shape PRs #573/#579/#595 landed
- [x] A test at the full MAX_GATE_BINS worst case asserts the remedy survives the MAX_HUMAN_ERROR_CHARS=2000 head-clip, with ordering pinned (remedy index precedes the first named bin)
- [x] Negative control: message at the cap and the last named bin absent
- [x] Every CLI error path that appends a remedy after kernel detail is swept for the same violation — this must be a class fix, not a single call site

## Notes

### Class sweep — the full surface, closed or explicitly deferred

The defect class: a human-channel CLI error whose ONLY actionable clause is composed AFTER an unbounded detail, so the head-kept `MAX_HUMAN_ERROR_CHARS` (2000) clip eats the fix and the reader keeps only the diagnosis.

**Fixed in `cli/src/start.ts` (4 sites, the whole CLI start channel):**

| site | before | after |
| --- | --- | --- |
| `worktreeFailureMessage` | kernel detail, then `worktreeRemediation(...)` + the `To discard it instead` hint | kept-worktree note -> remediation -> discard hint -> kernel detail |
| `gh()` | ``gh <args> failed: <stderr> (check `gh auth status`)`` | ``Check `gh auth status`. gh <args> failed: <stderr>`` |
| `commitFile()` | ``<git commit detail> (if this is an identity error, set `git config user.name` / `git config user.email`)`` | ``If this is an identity error, set `git config user.name` / `git config user.email`. <git commit detail>`` |
| `runPostStart()`'s `failure()` | ``post-start failed: <cmd> -> <stderr tail> (hint: hooks inherit ...)`` | ``(hint: hooks inherit ...) post-start failed: <cmd> -> <stderr tail>`` |

Only clause ORDER moved — every clause is verbatim, none added or dropped. `worktreeFailureMessage` is the single funnel every worktree-start refusal passes through, so the one reorder also covers `strictWorktreeWriteFailure`, `strictGateBinFailure` and `freshWorktreeInstallRefusal` (each of which keeps its own remedy-first internal order from #573/#597).

**Swept, already compliant (deliberately not changed):**

- `assertStartableTree` — cause first, evidence list last, no trailing remedy.
- `git()` — detail only, no trailing advice at all.
- The plain (non-worktree) start flow — composes no remedy, so there is nothing to reorder.
- `cli/src/cleanup.ts` refusals — clamped at `MAX_ENVELOPE_DETAIL_CHARS` (500) on a machine surface before any advice could be clipped.
- `cli/src/mcp-server.ts` `spawnedOutcome` — the raw stderr is already the LAST clause, and `clipTail` keeps the tail.

**Swept, same shape, DEFERRED to the coordinator (out of this item's files):**

- `cli/src/board.ts:141` — ``GitHub overlay unavailable: <gh detail> (or run plain `arggon board` for the offline snapshot)``: the identical ordering violation, but `cli/src/board.ts` + `cli/src/board.test.ts` are owned by the concurrently worked `bug-three-acceptance-parsers-diverging`, so this fix must not touch them. Worth one small follow-up.
- `lib/src/get-open-prs.ts:67`, `lib/src/import-issues.ts:187`, `lib/src/cleanup.ts:259` — the ``gh <args> failed (<stderr>; check `gh auth status`)`` kernel wrappers: same shape (unbounded gh stderr, then the auth hint), one line each, kernel-side. Reported rather than fixed here to keep this diff on the CLI start channel.
- `cli/src/branch.ts:127`, `lib/src/comment.ts:236-239`, `lib/src/show.ts:184`, `cli/src/layout-migrate.ts:83` — advice after a BOUNDED short clause (a branch name, a filename); no realistic clip exposure.

### 2026-10-03 @Arggon
## Evidence — PR #608 (`feat/task-cli-start-remediation-tail-clipped-on-human-channel`)

### Pre-fix failure is real, on the real `runStart` path

`git stash push -- cli/src/start.ts` (tests kept), then:

```
$ npx vitest run cli/src/start.test.ts -t "refuses the claim commit when the flag is set"
AssertionError: expected 459 to be less than 355
 ❯ cli/src/start.test.ts:327  expect(message.indexOf(`arggon start ${id} --worktree`))
```
The attach re-run sat at index 459, the kernel's named bin at 355 — the remedy trailed the evidence, exactly the defect.

### Observed pre-fix text at the MAX_GATE_BINS worst case

Composed through the real `sanitizeHumanError` (what `printHumanError` calls), full 8-bin list with long sibling paths:

```
full length: 3309
clipped length: 2002 (cap 2000)
remedy idx in clipped: -1      <-- `re-run arggon start <id> --worktree` GONE
discard idx in clipped: -1     <-- `To discard it instead: …` GONE
first bin idx in clipped: 392
last bin absent from clip: true

start failed while enforcing x-tracker.strict-gate-bins; the worktree was kept at
home/dev/projects/ArggonManager-task-cli-start-remediation (nothing was rolled back).
Fix: run `npm ci` in ... for a worktree-local install. x-tracker.strict-gate-bins is set:
refusing the claim commit — gate binaries do not resolve inside the worktree:
worktree-gate-binary-number-0-...: resolves only via PATH from .../node_modules/.bin/…
```

Diagnosis, no fix — at the cap, with three of the eight named bins already gone. Post-fix the same probe keeps `re-run arggon start …`, `To discard it instead` and `Fix: run npm ci` inside the kept window.

### Gates (worktree cwd, build BEFORE test)

```
$ npm run build          # ok — bundle rebuilt byte-identical (CLI-only change)
$ npm test               # Test Files 122 passed (122) · Tests 2277 passed (2277)
$ npm run lint           # clean
$ npm run arggon -- validate
arggon validate: ok (0 warning(s), convention v5)
$ npm run check:plugin   # build:plugin + git diff --exit-code — no drift
```

`git status` after `npm run build` shows only the four intended source/test files — `opencode/plugins/arggon/index.bundle.ts` is NOT among them, confirming the CLI-only change leaves the generated bundle untouched (proved, not assumed). No template or skill file touched, so the seam needed no regeneration.

### Class sweep

Four sites in `cli/src/start.ts` fixed together: `worktreeFailureMessage` (the named defect; the single funnel for `strictWorktreeWriteFailure`, `strictGateBinFailure`, `freshWorktreeInstallRefusal`), `gh()`, `commitFile()`, `runPostStart()`'s failure report. Full swept list — compliant sites and the three deferred siblings (`cli/src/board.ts:141` owned by the concurrent `bug-three-acceptance-parsers-diverging`; the kernel-side `gh auth status` wrappers in `lib/src/get-open-prs.ts:67`, `lib/src/import-issues.ts:187`, `lib/src/cleanup.ts:259`) — is recorded in the item's Notes section.

Item left `in_progress` for coordinator review.
