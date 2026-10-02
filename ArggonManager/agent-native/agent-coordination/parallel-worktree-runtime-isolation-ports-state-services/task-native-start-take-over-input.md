---
type: task
status: todo
id: task-native-start-take-over-input
title: "Native tools.arggon.start: accept a take-over input so the dead-owner hatch is reachable from the OpenCode seam"
branch: feat/task-native-start-take-over-input
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, opencode-seam, parity]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-native-start-take-over-input.md
  Leaves live only under a story. id is the filename stem: task-native-start-take-over-input.
  CLI `arggon create task native-start-take-over-input` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native tools.arggon.start: accept a take-over input so the dead-owner hatch is reachable from the OpenCode seam

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
REFILED after a loss: the first filing was wiped by a coordinator `git reset --hard` on the primary before it was pushed (the same class lost `bug-handoff-cli-spawn-lib-dist-import-race`, refiled as bug-cli-spawn-suites-exit-1-flake). The implementation is already delivered on `feat/task-native-start-take-over-input` / PR #579 — this body exists so the PR has an item to reference and so the acceptance is tracked honestly.

Context: PR #573 shipped the dead-owner hatch as `arggon start <id> --worktree --take-over-worktree` (kernel-owned `WorktreeClaimRequest.takeOver`, default OFF, bounded `takeovers` chain). The native seam had no take-over input, so a crashed session id there still needs the manual `rm <git-dir>/arggon-claim.json` recovery — the same parity gap class as task-native-cleanup-compose-parity.

## Acceptance

- [x] `tools.arggon.start` takes a take-over input, forwarded to the kernel claim request; the worktree-scoped parity (input without `worktree` is refused, not ignored) and the schema property are in. Evidence: `opencode/plugins/arggon/index.ts` 3387/3587 (boolean threaded into `deps.claim`), 4216 (schema property), 3414 (refusal without `--worktree`), 3660-3680 (the trailing retry advice that could never succeed while a fired detection stands now names the take-over input, the CLI hatch and the manual recovery).
- [x] The bounded `preparation.claim` mapping forwards the take-over evidence with the CLI's bounds — including the review's silent-loss trap. Evidence: `NativeClaimReceipt` whitelist + `boundedClaimTakeover` / `boundedClaimStamp` (types 2235-2290, mapper 2448), `truncated` fold including `takeOver.total > files.length` and the over-cap chain inside `replaced` (2389, 2513), every free-text field through `boundedNativeText`. Verified failing pre-fix: with `index.ts` reverted and the tests kept, the bounding test fails with `takeOver` undefined — exactly the silent evidence loss the whitelist edit prevents.
- [x] Native tests mirror the CLI's and prove the effect end-to-end on real git. Evidence: `seedGitTree` harness (real kernel + real git): foreign stamp + newer tracked write + armed `x-tracker.strict-worktree-writes` + `takeOverWorktree: true` → claim committed, `foreignWrites` absent, `takeOver` names the replaced owner/stamp and the file, and the stamp is re-stamped with a one-entry chain. Default identity: no input → `foreignWrites` reported, `takeOver` absent, stamp bytes unchanged; input with nothing fired → `claim` is exactly `{ stamped: true }` with no `takeovers` key written; live-owner refusal keeps its code, reason and item bytes.
- [x] Gates on the merged head: 2146 green / 117 files, lint, build, check:plugin exit 0, validate ok:true, CI green on the branch.

Coordinator notes for the record: the worker reported that its first code edits landed in the PRIMARY checkout; it captured them as a patch, restored the primary and reapplied them in the worktree (primary verified clean at its own main). The json-output.md diff is 38 lines but `git diff -w` shows 2 real lines (prettier re-padded the table). The nested `NativeClaimStamp` / `NativeClaimTakeover` types duplicate kernel-exported types — left to task-plugin-test-type-coverage's call, not folded here.
