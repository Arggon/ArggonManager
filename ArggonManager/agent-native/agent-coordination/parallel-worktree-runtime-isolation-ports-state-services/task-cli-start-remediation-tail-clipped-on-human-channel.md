---
type: task
status: todo
id: task-cli-start-remediation-tail-clipped-on-human-channel
title: "CLI channel: `startNotAttempted`/worktreeRemediation appends the remedy AFTER the kernel detail, so MAX_HUMAN_ERROR_CHARS head-clip still eats it at worst case"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cli, native-seam]
created: "2026-10-02"
updated: "2026-10-02"
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

- [ ] The CLI failure composition puts the actionable remediation (worktreeRemediation + attach/discard hint) BEFORE the kernel detail, keeping every existing clause verbatim — matching the shape PRs #573/#579/#595 landed
- [ ] A test at the full MAX_GATE_BINS worst case asserts the remedy survives the MAX_HUMAN_ERROR_CHARS=2000 head-clip, with ordering pinned (remedy index precedes the first named bin)
- [ ] Negative control: message at the cap and the last named bin absent
- [ ] Every CLI error path that appends a remedy after kernel detail is swept for the same violation — this must be a class fix, not a single call site

## Notes

### 2026-10-03 @ses_f003caa48ffeGSthQJfGGpwkog
### 2026-10-03 @Reviewer
verdict: request-changes (class not yet closed: one live instance of the same rule inside `worktreeRemediation`, doc drift on the post-start contract, one vacuous ordering assertion, CI red)

Reviewed by reading only (no gates run by me): the item + its evidence comment, `git diff origin/main...HEAD` for `cli/src`, `lib/src/sanitize.ts`, `cli/src/start.ts` (call sites), `lib/src/worktree.ts` (the three kernel refusals), `cli/src/cli.ts` (`printHumanError`), the four new/edited test blocks, the deferred + compliant sweep sites, and the `cli` job log of run 37092572191. The arithmetic below is plain string math on the committed fixture shapes (no project imports).

#### Verified good

- **Pure reorder, clause by clause.** `worktreeFailureMessage` (`cli/src/start.ts:845-857`): the lead sentence, `worktreeRemediation(...)`, the `To discard it instead: …` hint and the kernel detail are byte-identical to the pre-fix clauses; only position moved, with the two newline separators reassigned one-for-one. `gh()` (`:313`), `commitFile()` (`:373`) and `runPostStart().failure()` (`:476`) each keep their full clause set; the only rewording is the required sentence-boundary change ((check gh auth status) -> Check `gh auth status`. and (if this is …) -> If this is …. ), and each still reads top-down as instruction-first. Nothing added or dropped.
- **The funnel claim is true** (`cli/src/start.ts:1194-1216` is the single `catch` wrapping everything after the worktree exists): `strictWorktreeWriteFailure` (`:996`), `strictGateBinFailure` (`:1028`), `freshWorktreeInstallRefusal` (`:1045`), the pre-commit `commitFile` (`:1086`), push (`:1104`) and draft PR (`:1112`) all throw inside that `try`; no refusal path composes its own text outside it. The three pre-`try` throws (branch mismatch `:897`/`:1060`, path taken `:913`, `worktreeAdd` `:922`) compose no remedy at all, so there is nothing to reorder.
- **The reorder really rescues the other two refusals**, not just the gate-bin one: at the 10-dirty-path worst case of `strictWorktreeWriteFailure` the composed message is 2575 chars with the CLI remedy at 192, the discard hint at 275 and the kernel's whole recovery sequence ending at 1153 — all inside the 2000-char head; only the evidence list is lost.
- **Tests pin the real clip, not a mirrored copy.** The worst-case test calls the real `sanitizeHumanError` (what `printHumanError` uses) and pins the length exactly (`MAX_HUMAN_ERROR_CHARS + 1 + escaped`), so a merely-longer message FAILS it; the "absent" control is properly guarded by `expect(message.slice(MAX_HUMAN_ERROR_CHARS)).toContain(lastEntry)`. The ordering assertions on the real `runStart` strict-gate path, the real-git pre-commit gate, the spawned-CLI `gh` stub (its stub stderr really is `auth required`, `cli/src/cli.test.ts:83`) and the post-start hook each fail on the pre-fix composition and pass after.
- **Scope hygiene.** Code diff is exactly the four intended files (`start.ts`, `start.test.ts`, `cli.test.ts`, `worktree.test.ts`) plus two tracker files; `worktree.test.ts` is +13/-0 and `git diff --check` is clean, so the prettier drift really was reverted. The two stray `chore(tasks)` commits only add `bug-prover-agent-has-no-x-generated-entry.md` plus comments for another item — harmless, no code, no conflict with this diff; dropping them would need a forbidden force-push, so leave them.

#### F1 (major) — the class is not closed: `worktreeRemediation` still puts the exact fix after an unbounded evidence list

`cli/src/start.ts:762-767` (`committing the claim` branch) composes `<generic fix sentence>` + `${observed}` + `${installFix}`, where `observed = gateBinFailureReport(...)` is an **uncapped** named-bin list (`:728-736` — no `slice`, unlike `assertStartableTree`'s `.slice(0, 10)`) and `installFix` is "Exact fix for the observed resolution: run `npm ci` in <worktree> …". Same head-kept 2000 clip, same file, same helper family, and it is the step this PR's own sibling test drives. Arithmetic on the committed worst-case bin fixture (8 long sibling paths):

- post-PR the message is 3687 chars and `observed` spans 584–3201, so "Exact fix for the observed resolution" lands at ~3201 → **clipped away (index -1)**, and `To discard it instead` with it. Only the generic "install dependencies …" sentence survives.
- moving `installFix` ahead of `observed` keeps the exact fix at 585; the discard hint still needs the evidence list bounded (cap the entries) for the whole composition to fit.

Provenance: this block arrived with #517 (`fb3b186e`) and was never touched by #573/#579/#595/#597, so the item's sweep list misses it and no item exists for it — exactly what acceptance #4 ("must be a class fix, not a single call site") rules out. Either fix it in this PR (reorder and/or bound the list, plus an ordering assertion on the real pre-commit-gate path) or file it under the same story and reword acceptance #4 + the Notes so the "class closed" claim is honest.

#### F2 (major) — docs do not travel with the change

`ArggonManager/docs/convention.md:544` and `ArggonManager/docs/json-output.md:475` both still document the post-start report as `post-start failed: <command> → <stderr tail> (hint: hooks inherit the environment …)` — hint **trailing**. This PR ships the hint leading, so both carriers now misdescribe shipped behavior (`json-output.md` is the `--json` contract carrier named in engineering.md; DoD §4 + Docs bar). The in-code doc at `cli/src/start.ts:226-233` WAS updated, which makes the omission asymmetric. Two-line fix in this PR.

#### F3 (moderate) — the pre-commit-gate ordering assertion is vacuous

`cli/src/worktree.test.ts:557-561` searches lowercase "if this is an identity error", but the new message capitalizes it to `If this is an identity error, set …`. `indexOf` is case-sensitive → **-1**, and `expect(-1).toBeLessThan(<positive index>)` passes unconditionally. It failed pre-fix only because the old text had a lowercase parenthetical; it would still pass if someone restored the old clause order while keeping the capitalized "If". So the one assertion claiming to pin `commitFile`'s order pins nothing, and `commitFile` has no other order coverage. Change the needle to `If this is an identity error`.

#### F4 (minor) — the quoted pre-fix numbers are not reproducible

The item quotes `expected 459 to be less than 355` at `cli/src/start.test.ts:327`. Reconstructing that test's composition arithmetically (step `enforcing x-tracker.strict-gate-bins`, id `task-rate-limit`, worktree path `/tmp/arggon-start-XXXXXX-task-rate-limit`): the named bin sits at **356** for a 40-char path (**355** for 39 — that half reproduces), but the attach re-run sits at **539** (537 for 39), not 459. The qualitative claim is structurally certain (pre-fix order is lead → detail → remediation, so the remedy index always exceeds the bin index and the new assertion cannot pass pre-fix); the numbers should be re-recorded from a real run.

Independently reproduced the rest (string math on the committed fixture): pre-fix full 3308 → clipped 2002, remedy -1, discard -1, first bin 392, last bin absent; post-fix full 3308 → clipped **2003** (2 newlines in the kept head escape to +2), remedy 214, discard 343, `npm ci` fix 536, first bin 759, last bin absent. The worker's "3309" is off by one; the test's computed formula (2003) is right.

#### F5 (info) — the four deferred sites are not clip-reachable (feeds task-clip-class-sweep-remaining-sites)

All three kernel gh wrappers and `board.ts:141`'s detail source run gh with `stdio: ["ignore","pipe","ignore"]`, so `err.message` is the `Command failed: gh … <argv>` echo — bounded, unlike `cli/src/start.ts`'s `gh()`/`git()`, which pipe stderr. The follow-up is a consistency fix, not a clip rescue; record that in the follow-up item so it does not churn. Every compliance claim in the Notes checks out on reading: `assertStartableTree` (cause first, lists `.slice(0, 10)`), `git()` (no trailing advice), the plain non-worktree start (no composed remedy), `cli/src/cleanup.ts` (`MAX_ENVELOPE_DETAIL_CHARS` = 500), `mcp-server` `spawnedOutcome` (`clipTail`, detail last), and the extra bounded sites (`branch.ts:127`, `comment.ts:236-239`, `show.ts:184`, `layout-migrate.ts:83`).

#### F6 (blocking by bar) — CI is red, not pending

`gh pr checks 608`: `cli` **fail** (5m33s), `tasks-validate` pass, `ui-smoke` pass. The failure is `cli/src/mcp-parity.test.ts` → `SpawnHarnessError … child-boot-failed` with `kernel artifact drift: … another suite lane rebuilt lib/dist or dist in place` and `SyntaxError: './priority.js' does not provide an export named 'priorityRank'` (122 files / 2277 tests, 1 file failed). That is the known `bug-cli-spawn-suites-exit-1-flake` class and is unrelated to this diff (nothing in `lib/src`, no bundle change), but green CI is necessary — a green run must be recorded before merge. The PR is also a draft and reports `mergeStateStatus: BEHIND`.

#### Unverified by me

No gates executed, by design. The smoke probe is unrun: the changed behavior is the human failure line of `arggon start` (no new command or flag), and `smoke:native-start-cold` covers the native seam, not the CLI human channel.

## Probes needed

cwd for probes 1–3: /home/arggon/Projects/ArggonManager-task-cli-start-remediation-tail-clipped-on-human-channel

1. **Green `cli` lane.** `gh run rerun --job 111115828164` (or `npm run build && npm test` in the worktree). Expected: 122/122 files, 2277/2277 tests, no `SpawnHarnessError`. Observed now: 1 file failed on the lib/dist rebuild race. Effect on the verdict: a green run clears this axis; the same drift reproduced on `origin/main` too confirms the flake class.
2. **Pre-fix proof re-record.** `git stash push -- cli/src/start.ts && npx vitest run cli/src/start.test.ts -t "refuses the claim commit when the flag is set"; git stash pop`. Expected: the new ordering assertion fails with the attach re-run index AFTER the named-bin index (my arithmetic: ~537 vs ~355 for a 39-char temp path — not 459). Turns F4 into a recorded, reproducible proof.
3. **Worst-case clip numbers through the real sanitizer.** `npx vitest run cli/src/start.test.ts -t "MAX_HUMAN_ERROR_CHARS"`. Expected: both new tests pass with clipped length exactly 2003 and the tail bin absent — confirms the committed length formula on the real code path rather than my string arithmetic.
4. **Smoke probe (blocking per engineering.md §Smoke — CLI behavior change).** On a disposable fixture repo: declare a bin-bearing devDependency, create a worktree with no install, run `arggon start <id> --worktree` and read the human stderr line top-down; repeat with a failing `pre-commit` hook; and capture `--json`. Expected: the human line leads with "start failed while …; the worktree was kept at …", then the remediation and the discard hint, with raw gate/bin output trailing — and for the pre-commit case the "Exact fix: run `npm ci` in <worktree>" clause present at or before the clip (that is F1's observable symptom). `--json` `error.message` must keep the full raw text. Expected-vs-observed goes in the verdict per convention.md.
