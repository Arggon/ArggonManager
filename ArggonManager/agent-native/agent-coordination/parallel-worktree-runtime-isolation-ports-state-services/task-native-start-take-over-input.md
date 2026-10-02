---
type: task
status: in_progress
id: task-native-start-take-over-input
title: "Native tools.arggon.start: accept a take-over input so the dead-owner hatch is reachable from the OpenCode seam"
assignee: Arggon
branch: feat/task-native-start-take-over-input
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, opencode-seam, parity]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T15:36:00.167Z"
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

### 2026-10-02 @Arggon
Round-2 review fixes are on the branch and pushed (PR #579, head 87cbe7e8 → +bookkeeping).

**HIGH — the refusal could clip away the advice this PR adds.** The advice was APPENDED after `strictWorktreeWriteFailure`, whose own tail is the up-to-10 named dirty paths, and `startFailure` clips HEAD-first at `MAX_NATIVE_ERROR_CHARS` (2048). Composed ≈ 1487 + 10·L. Measured on the old ordering with ten ~60-char paths: the received message ended `"…confirming no l…"` — the manual `rm` GONE. Pre-PR the window was ~3x narrower (214 chars of advice), so this PR widened it; #573's round 2 had fixed the same class on the CLI by moving the remedies ahead of the named-file list.

Fix: every actionable clause now LEADS (recovery block → kept-worktree note → kernel refusal, whose lead sentence names the stamped owner, claim time and file count). Only the path list — evidence, not instruction — can clip; the kernel's own remedy clauses are superseded by the native ones carrying the same guidance, so nothing is lost. Pinned by ordering, not prose: ten ~60-char dirty paths assert both remedies AND the kernel diagnosis survive, that each remedy's index precedes the first named path, and that the message really did clip (no vacuous pass on a longer message).

**Non-blocking — character clipping folds into `truncated`.** `takeOver.files` entries and `replaced.*` are clipped to 200 chars like every other projection, but a shortened value read as the whole one. Folded, pinned by a test where nothing is DROPPED (one path, honest count) so `truncated` can only come from the clip; verified failing without it (`expected undefined to be true`). The chain-cap term left as defense in depth with a comment saying why the kernel's reader caps it at 5 first.

**Re-merge:** origin/main re-merged at `74be5c5b` — mechanical, zero conflicts (#580, #581, #583 landed; none touch index.ts/tools.test.ts/json-output.md). Bundle regen in its own `chore: regen plugin bundle` commit (443,240 B); `check:plugin` exit 0.

Gates on the pushed head: `npm test` 117 files / **2154 green** (6 plugin files / 189), `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run arggon -- validate` `ok:true`, CI all three jobs green. PR left ready (not draft), NOT merged; item left `todo` — completion is the coordinator's call.

Residual for the record, not fixed here (out of lane): the same character-clipping gap exists for `claim.foreignWrites` (pre-existing, untouched — fixing it would flip `truncated` on default receipts this PR's default-identity invariant pins), and a hostile long string inside a chain entry would still clip silently. The other two native refusals (gate-bin, fresh-worktree install) still append their advice after the kernel refusal and carry the same clip risk — pre-existing, untouched.

### handoff 2026-10-02 @Arggon — next: Review + merge PR #579 (ready, not draft); item left todo for the coordinator
- branch: feat/task-native-start-take-over-input
- open questions: foreignWrites char-clip fold + the other two refusals' clip risk left as residual findings
