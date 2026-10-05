---
type: task
status: in_progress
id: task-cli-start-remediation-tail-clipped-on-human-channel
title: "CLI channel: `startNotAttempted`/worktreeRemediation appends the remedy AFTER the kernel detail, so MAX_HUMAN_ERROR_CHARS head-clip still eats it at worst case"
assignee: arggon-delivery-lead
branch: feat/task-cli-start-remediation-tail-clipped-on-human-channel
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cli, native-seam]
created: "2026-10-02"
updated: "2026-10-05"
claimed_at: "2026-10-05T18:29:40.885Z"
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
  - Round 1 ticked this at FOUR sites and was wrong: `worktreeRemediation`'s `committing the claim` branch was a live instance the sweep missed. Re-ticked only after F1 landed (fifth site) and the four "same shape" deferrals were corrected to NOT clip-reachable. The list is in Notes; a future site needs the `indexOf` presence-guard idiom, not a new one-line reorder.
  - Round 3: the evidence each site bounds must not become lossy either. The readiness clause is budget-filled rather than constant-capped, and the complete observation rides the `--json` failure envelope as `readiness` — so the rule is "cap + count + array", and a bound on a human line is only acceptable when a machine surface still enumerates what did not fit.

## Notes

### Class sweep — the full surface, closed or explicitly deferred

The defect class: a human-channel CLI error whose ONLY actionable clause is composed AFTER an unbounded detail, so the head-kept `MAX_HUMAN_ERROR_CHARS` (2000) clip eats the fix and the reader keeps only the diagnosis.

**Fixed in `cli/src/start.ts` (five sites — four found in round 1, the `committing the claim` branch found in round 2 and listed below):**

| site | before | after |
| --- | --- | --- |
| `worktreeFailureMessage` | kernel detail, then `worktreeRemediation(...)` + the `To discard it instead` hint | kept-worktree note -> remediation -> discard hint -> kernel detail |
| `gh()` | ``gh <args> failed: <stderr> (check `gh auth status`)`` | ``Check `gh auth status`. gh <args> failed: <stderr>`` |
| `commitFile()` | ``<git commit detail> (if this is an identity error, set `git config user.name` / `git config user.email`)`` | ``If this is an identity error, set `git config user.name` / `git config user.email`. <git commit detail>`` |
| `runPostStart()`'s `failure()` | ``post-start failed: <cmd> -> <stderr tail> (hint: hooks inherit ...)`` | ``(hint: hooks inherit ...) post-start failed: <cmd> -> <stderr tail>`` |
| `worktreeRemediation`'s `committing the claim` branch (round 2) | ``<generic fix> …<uncapped readiness bin list>… Exact fix: run `npm ci` in <worktree>`` | ``<generic fix>… Exact fix: run `npm ci` in <worktree>. <budget-filled readiness list>`` |

Only clause ORDER moved — every clause is verbatim, none added or dropped. `worktreeFailureMessage` is the single funnel every worktree-start refusal passes through, so the one reorder also covers `strictWorktreeWriteFailure`, `strictGateBinFailure` and `freshWorktreeInstallRefusal` (each of which keeps its own remedy-first internal order from #573/#597).

**Swept, already compliant (deliberately not changed):**

- `assertStartableTree` — cause first, evidence list last, no trailing remedy.
- `git()` — detail only, no trailing advice at all.
- The plain (non-worktree) start flow — composes no remedy, so there is nothing to reorder.
- `cli/src/cleanup.ts` refusals — clamped at `MAX_ENVELOPE_DETAIL_CHARS` (500) on a machine surface before any advice could be clipped.
- `cli/src/mcp-server.ts` `spawnedOutcome` — the raw stderr is already the LAST clause, and `clipTail` keeps the tail.

**CORRECTION (round-2 review F5 + coordinator): NOT part of this class.** The four sites this sweep originally deferred were reported as "same shape", which was wrong, and the record is corrected here rather than left standing:

- `cli/src/board.ts:141`, `lib/src/get-open-prs.ts:67`, `lib/src/import-issues.ts:187`, `lib/src/cleanup.ts:259` — all four run `gh` with `stdio: ["ignore","pipe","ignore"]`, so the interpolated `err.message` is a bounded `Command failed: gh … <argv>` echo, NOT an unbounded stderr tail. They are therefore **not clip-reachable**: no amount of remedy-after-detail ordering can push a remedy off a 2000-char head-clip that the detail cannot reach. They are a CONSISTENCY question, tracked as such in `task-clip-class-sweep-remaining-sites`; nothing here needed to change, and no future auditor should re-audit them as clip sites.
- `cli/src/branch.ts:127`, `lib/src/comment.ts:236-239`, `lib/src/show.ts:184`, `cli/src/layout-migrate.ts:83` — advice after a BOUNDED short clause (a branch name, a filename); no realistic clip exposure. Verified by the reviewer on reading.

**Correction to the "Fixed (4 sites)" count above: it was five, not four.** `worktreeRemediation`'s `committing the claim` branch (from #517) was a live instance of the same rule that the first sweep missed — see the round-2 section below.

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

### handoff 2026-10-03 @Arggon — next: Review+merge PR #608 (draft): 4 CLI start error paths reordered so the remedy leads; item stays in_progress
- branch: feat/task-cli-start-remediation-tail-clipped-on-human-channel
- open questions: cli/src/board.ts:141 has the same violation but is owned by the concurrent item — file a follow-up?; kernel-side gh auth-status wrappers in lib (get-open-prs/import-issues/cleanup) deferred — want th…
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

### Round 2 — `worktreeRemediation`'s `committing the claim` branch (F1), the site the first sweep missed

The first sweep of this item enumerated four sites and called the class closed. It was not: `worktreeRemediation`'s `committing the claim` branch (`cli/src/start.ts`, from #517 `fb3b186e`) composed `<generic fix>` + `<readiness bin list, UNCAPPED>` + `Exact fix: run \`npm ci\` in <worktree>`, so the exact fix trailed the evidence and the head-kept clip ate the only clause naming the command to run. It is the MOST COMMON start failure — the one that actually creates the worktree. Five PRs (#573, #579, #595, #597, #608) each fixed the site they were looking at; this one was found only by a reviewer.

Fixed here with TWO changes, because one was not enough:

- **the exact fix leads the readiness evidence** — its position is now a function of the remediation clauses alone, so no bin list can push it past the clip. Measured on the committed worst-case fixture: exact fix at **3202 pre-fix** (clipped away entirely) and **584 post-fix**.
- **the readiness list is bounded** (`MAX_HUMAN_GATE_BIN_NAMES = 2`, remainder counted as `and N more bins`, the same shape as `MAX_MISSING_DEPENDENCIES`/`MAX_CLAIM_WRITE_NAMES` and `strictWorktreeWriteFailure`'s `(and N more)`). Reordering alone left the caller's `To discard it instead` hint past the clip. Two and not three because at three the discard hint's tail was still cut: the guarantee is that every ACTIONABLE clause survives the clip WHOLE.

Net at that worst case: the composed message is 1831 chars, under the 2000 cap, so nothing is elided at all.

**On the numbers this item records (F4).** The `459 < 355` quoted in round 1 is NOT a stable fact and should not be read as one: both indices are `$TMPDIR`-length-dependent, because the worktree path appears twice in the composition (the kept-worktree note and the kernel's `npm ci in <path>`). Reproduced on the same commit: default `/tmp` gives `expected 459 to be less than 355`; the same test with `TMPDIR=/tmp/opencode/a-longer-tmpdir-prefix` gives `expected 523 to be less than 419` — both indices shift by the same 64. What reproduces everywhere is the ORDER: pre-fix the remedy index always exceeds the named-bin index, because the composition was lead -> detail -> remediation. That is now a pinned assertion, not a quoted number.

**Doc drift fixed in the same PR (F2).** `docs/convention.md` and `docs/json-output.md` documented the post-start report with the hint TRAILING while this PR ships it leading; both carriers now describe shipped output and say WHY the order is what it is.

**One vacuous assertion repaired, four guarded (F3).** The pre-commit-gate ordering test searched lowercase `if this is an identity error` against a message that now capitalizes it, so `indexOf` returned -1 and `-1 < n` passed unconditionally. All four substring-ordering assertions in this PR are now presence-checked before comparison.

### 2026-10-03 @Arggon
## Round 2 — all five review findings addressed, CI green, smoke run

Branch `feat/task-cli-start-remediation-tail-clipped-on-human-channel` (merged `origin/main` in — the item-body conflict resolved as a UNION, this branch's evidence plus the reviewer's verdict block). Item left `in_progress`.

**F1 — the class WAS not closed; fifth site fixed.** `worktreeRemediation`'s `committing the claim` branch composed `<generic fix>` + `<readiness bin list, uncapped>` + `Exact fix: run \`npm ci\` in <worktree>`. Two changes, both needed: the exact fix now LEADS the evidence (index 3202 -> 584 on the committed worst-case fixture; it was clipped away entirely), and the readiness list is bounded (`MAX_HUMAN_GATE_BIN_NAMES = 2`, remainder counted as `and N more bins`) so the caller's discard hint survives too. Composed length at that worst case: 3687 (over the cap) -> 1831, nothing elided. Proven failing against the pre-fix code: `expected 3202 to be less than 584` / `expected 'start failed while committing the cla…' to contain 'Exact fix for the observed resolution'` / `expected 969 to be 1607`.

**F2 — docs travel with the change.** `docs/convention.md` + `docs/json-output.md` now describe the shipped post-start shape (hint leading) and say why, so the next reader does not "tidy" it back.

**F3 — the vacuous assertion repaired, and the three that could have been.** The pre-commit-gate test searched lowercase `if this is an identity error` against a capitalized message -> `indexOf` = -1 -> `-1 < n` always passed. All four substring-ordering assertions in this PR are now presence-checked before comparison.

**F4 — my own evidence corrected, not defended.** `459 < 355` is `$TMPDIR`-dependent (the worktree path appears twice in the composition): same commit, default `/tmp` gives `459 < 355`, `TMPDIR=/tmp/opencode/a-longer-tmpdir-prefix` gives `523 < 419` — both shift by 64. The reproducible claim is the ORDER, now a pinned assertion. The item's Notes carry the correction instead of the old number.

**F5 — the deferred four are corrected out of the class** in the Notes: stderr is `ignore`d there, so `err.message` is a bounded argv echo and not clip-reachable. My round-1 "same shape" label was wrong; the record now says so.

**F6 — CI.** `cli` **pass** on this head: run 37094336430, job 111121055514, 5m40s (122 files / 2280 tests). The requested rerun of the old job 111115828164 (old head `9bec17b9`) failed again with the known flake — `mcp-parity` -> `SpawnHarnessError: kernel artifact drift: the repo's built artifacts were REWRITTEN while this child ran` + `SyntaxError: './frontmatter.js' does not provide an export named 'numberField'`, 1 failed / 2276 passed: a parallel lane rebuilding `lib/dist` mid-run, not this diff (nothing in `lib/src`, no bundle change).

**Smoke probe (engineering.md SSmoke).** Disposable fixture, real built CLI, human stderr read top-down; pre-fix (`start.ts` from `2f688024`) vs post-fix on the same probe for the `committing the claim (pre-commit gate)` step:

```
pre-fix : …attaches to the existing worktree.
          Readiness: the gate binaries do not resolve inside the worktree — smoke-gate-dep: …
          Exact fix for the observed resolution: run `npm ci` in <worktree>, then …   <-- trails
          To discard it instead: `git worktree remove --force <worktree>`.

post-fix: …attaches to the existing worktree.
          Exact fix for the observed resolution: run `npm ci` in <worktree>, then …   <-- leads
          Readiness: the gate binaries do not resolve inside the worktree — smoke-gate-dep: …
          To discard it instead: `git worktree remove --force <worktree>`.
          If this is an identity error, set `git config user.name` / `git config user.email`.
          git commit -m claim: task-smoke failed: gate: deliberate failure
```

Every actionable clause leads; all evidence trails. `--json` keeps the full raw message (1092 chars, no elision) — the `--json` contract is unchanged.

**Gates** (build BEFORE test): `npm run build` (bundle byte-identical) · `npm test` 122 files / 2280 tests · `npm run lint` · `npm run arggon -- validate` ok · `npm run check:plugin` no drift · `npm run test:structure` 3 passed · `npm run lint:structure` clean.

**Acceptance #4** stays ticked but is annotated: round 1 ticked it at four sites and was wrong. It is re-ticked only now that the fifth site is fixed and the four non-reachable deferrals are corrected — with a note that a future site needs the `indexOf` presence-guard idiom, not another one-line reorder.

### handoff 2026-10-03 @Arggon — next: Re-review+merge PR #608: F1 fifth site fixed, docs+tests repaired, cli job green (run 37094336430)
- branch: feat/task-cli-start-remediation-tail-clipped-on-human-channel
- open questions: Acceptance #4 is ticked with an annotation saying round 1 got it wrong — re-tick or leave?; MAX_HUMAN_GATE_BIN_NAMES=2 is my bound choice (3 still cut the discard hint) — sanity-check that trade-off?

### Round 3 — the readiness bound is derived, and the failure envelope carries the array

Round 2 approved the approach and the invariant but rejected the constant: `MAX_HUMAN_GATE_BIN_NAMES = 2` was an arbitrary discount, not the minimum needed to buy the invariant. The ruling was right, and the fix replaced the constant with a budget.

**The budget.** `worktreeRemediation` now returns remedy ONLY. `worktreeFailureMessage` composes every mandatory clause (kept-worktree note, generic fix, exact fix, attach re-run, discard hint, raw detail), reserves their lengths plus the separator against `MAX_HUMAN_ERROR_CHARS`, and hands the remainder to `gateBinFailureReport(readiness, budget)`, which fills names until they stop fitting and counts the rest. At least one name whenever there is evidence; the budget can never reach a mandatory clause, because those were reserved first.

**Measured on this item's own fixtures (8 broken bins):**

| entry shape | chars/entry | names the budget fills | the constant-2 form showed | composed length |
| --- | --- | --- | --- | --- |
| deep sibling path (pathological) | ~317 | **2 of 8** | 2 (identical) | 1795, nothing elided |
| ordinary checkout (`…/ArggonManager-main/node_modules/.bin`) | ~117 | **7 of 8** | 2 (five hidden that fitted) | 1980, nothing elided |

**Why the hidden names were not cosmetic** — the same 8-bin fixture, run through the real built CLI before and after:

| | constant-2 form | budget form |
| --- | --- | --- |
| names in `error.message` | 2 (`ast-grep`, `c8`) | 7 + `and 1 more bin not resolving inside it` |
| flavors visible | `missing missing` | `missing missing path missing path path path` |
| all 8 enumerable from a CLI surface | **no** — `readiness` absent | yes — `readiness.gateBins` carries all 8 with sources |

The flavor line is failure mode #2 exactly: under the constant the two visible entries were both `missing`, so a reader would conclude "nothing resolves here" and never see that five bins resolve from a sibling `.bin` on PATH — a different diagnosis and a different first action. And the third piece of the `missingDependencies` / `missingDependenciesTotal` precedent that round 2 lacked is now real: the `--json` failure envelope gained an additive `readiness: { hasInstall, gateBins }` (`failEnvelope` takes an optional payload, the reason `successEnvelope` already did), carrying the COMPLETE observation, because `gateBins` rides the success envelope only.

**F4 residual — the reviewer's arithmetic does not reproduce either, and here is the measurement.** The claim was that the gap between the two quoted indices is invariant at 183, so no `$TMPDIR` produces the 104 the evidence shows. Measured on the same composition the test builds (one `missing` bin, step `enforcing x-tracker.strict-gate-bins`, id `task-rate-limit`), sweeping `$TMPDIR`:

| `$TMPDIR` | worktree path length | attach re-run index | named-bin index | gap |
| --- | --- | --- | --- | --- |
| `/tmp` | 40 | 459 | 355 | **104** |
| `/tmp/x` | 42 | 463 | 359 | **104** |
| `/tmp/a-longer-tmpdir-prefix` | 63 | 505 | 401 | **104** |

So the gap is 104 for THIS composition at every path length, not 183 — both quoted numbers were real measurements of one run, and both move together with the path (the path appears twice, so +1 path char moves each index by 2). 183 does appear in the POST-fix composition of the same fixture (attach 203, named bin 622), which is the shape the reviewer may have measured. Nothing is dropped here because nothing was unreproducible; the order claim remains a pinned assertion rather than a quoted number.

**Also folded in:** the tautological `expect([firstEntry, lastEntry]).toHaveLength(2)` is deleted (an array literal is always length 2; the surrounding `toContain` / `not.toContain` / derived-count assertions are the real guards); the bound is documented in words — not as a constant, because it is data-dependent — in `docs/convention.md` next to the `x-tracker.strict-gate-bins` bullet, which also reconciles the "names each offending bin" promise with what the readiness clause now does (the two kernel refusals are NOT bounded: their remedy is inside the message and the evidence is its tail); `docs/json-output.md` gains the `readiness` row.

**One defect the round-3 smoke probe found that reading did not:** the wrapper takes a readiness snapshot for EVERY step, so appending the clause unconditionally grew a push failure a `Readiness: the gate binaries do not resolve …` list — and its exact fix — that had nothing to do with a push. The clause now hangs off the same condition the exact fix does, pinned per step.
### 2026-10-03 @ses_f003caa48ffeGSthQJfGGpwkog
### 2026-10-03 @Reviewer (round 2)
verdict: request-changes (narrow: one required change — the readiness bound must be budget-derived, not the constant 2 — plus a doc line for it. F1/F2/F3/F5/F6 are closed and accepted; the approach and the invariant you chose are right.)

Read the branch as it stands (`9bec17b9..88cb4984`), the item's Notes + both evidence comments, the coordinator's note, run 37094336430's job list, and the item file's round-2 sweep corrections. My numbers below are string arithmetic on the committed fixtures (no project imports), so they are independent of your probe.

#### Closed since round 1 — verified

- **F1 (fifth site) — accepted.** I reproduced it on your fixture: the pre-fix composition puts `Exact fix for the observed resolution` at **3202** (sanitized clip: **-1**, gone), the reorder-only form puts it at **584** but leaves the caller's `To discard it instead` clause cut mid-way, and the shipped bounded form is **1795** chars, under the cap, with the whole discard clause and the raw detail arriving. (Your 1831 vs my 1795 is the detail string; the test pins `length <= MAX_HUMAN_ERROR_CHARS` and `length + newlines`, not a magic number, which is the robust form.) The structural test (`same index at 1, 3 and 8 bins`) is the right guard for the invariant — it is what makes this site safe against any future list, not just this fixture.
- **F2 — accepted.** `docs/convention.md:544` and `docs/json-output.md:475` now describe the shipped hint-leading shape and say why (head-kept 2000 clip, unbounded stderr tail). Both carriers, both with the reason.
- **F3 — accepted and complete.** The needle is now the message's own capitalization (`If this is an identity error`, `cli/src/worktree.test.ts:561`), and all four substring-ordering sites presence-check with `toBeGreaterThanOrEqual(0)` before comparing (`worktree.test.ts` pre-commit + post-start, `cli.test.ts` gh, `start.test.ts` strict-gate + both worst-case blocks). An absent needle now fails instead of passing through -1. This is the idiom future sites need, and the acceptance note records it.
- **F5 — accepted.** The Notes now say the four deferred sites are NOT part of the class (bounded argv echo, stderr `ignore`d) and that round 1's "same shape" label was wrong. That is the right correction to leave behind; the follow-up item stays a consistency question.
- **F6 — accepted.** Run 37094336430: `cli` success (122 files / 2280 tests, every step green incl. `check:plugin` drift gate, `smoke:native-start-cold`), `ui-smoke` success. The rerun of the old head failing again with `kernel artifact drift` + `frontmatter.js`/`priorityRank` confirms the known flake item, not this diff.
- **Smoke — accepted as recorded.** The pre/post human-line probe on a disposable fixture with the real built bin is the right shape and matches my arithmetic (generic fix -> exact fix -> readiness -> discard -> identity hint -> raw git output). One gap, folded into the probes below: that fixture has ONE broken bin, so the new bounded-list shape (the count marker) has no executed evidence on the real CLI.

#### The judgement call: the fixed `MAX_HUMAN_GATE_BIN_NAMES = 2` is the wrong trade

I agree with your invariant — *every actionable clause must survive the clip WHOLE, not merely its first words* — and with the reorder that makes it hold structurally. I dispute only the constant. `2` is not the minimum necessary to buy your invariant; it is an arbitrary discount that bites hardest in the case users actually hit.

Two measurements on your own composition (`lead + generic fix + exact fix + readiness + discard + detail`, 8 broken bins):

| bin entries | names that fit whole under 2000 | shipped cap shows |
| --- | --- | --- |
| your pathological fixture (~330 chars/entry: 64-char name + deep sibling path) | 2 (k=3 -> 2114, does not fit) | 2 — identical |
| a typical checkout (`/home/arggon/Projects/ArggonManager-main/node_modules/.bin`, real bin names `tsx`, `vitest`, `prettier`, …, ~124 chars/entry) | **6** (k=6 -> 1903 fits; k=8 -> 2120 does not) | 2 — four names discarded that provably fit |

So a budget-driven fill (compose the mandatory clauses, measure the remainder against `MAX_HUMAN_ERROR_CHARS`, include as many entries as fit, count the rest) gives **byte-identical behavior in your worst case and 3x the names in the typical case**. That is strictly better at the same guarantee — there is no reading of the bar under which the fixed 2 wins.

**Concrete failure mode of the fixed cap** — what a reader cannot conclude from "gate binaries do not resolve inside the worktree — a: …; b: …; and 6 more bins not resolving inside it" that they could with the names shown:

1. **You cannot tell whether the binary your failing pre-commit gate actually invoked is one of the six hidden.** The remedy (`npm ci` in the worktree) is generic and survives either way, but the *diagnosis* is what tells the reader which of three different first actions applies. And I checked where the rest of the list could live: the failure envelope carries only `error.message` — `cli/src/cli.ts:2330-2337` and `:2528-2535` call `failJson({ command, message, code, conventionVersion })`, no `gateBins`, no `readiness` array. `gateBins` rides the envelope only on success. So on this path the six hidden names are unreachable from **every shipped CLI surface**; the user has to re-derive them by hand (`ls node_modules/.bin`, `which <tool>`). Before this PR the same reader saw all eight.
2. **The flavor mix can be lost entirely.** The three entry shapes are semantically distinct — `not resolvable from the worktree` (nothing installed: `npm ci`), `resolves only via PATH from <sibling>/.bin` (a foreign install is silently masking the broken worktree), `resolves from <path>, above the worktree` — and `gateBinFailureReport` keeps list order. With 8 broken bins the two shown can both be `path`-source while every `missing` entry is hidden; the reader then concludes "my install resolves from PATH" and never sees "nothing resolves from the worktree". Different conclusion, different first action. "6 more bins" carries magnitude, not attribution.
3. **An undocumented asymmetry between the two gates.** The strict-gate refusal still names every offending bin — `docs/convention.md:489` promises exactly that ("names each offending bin with its observed source") and the kernel list is uncapped. The pre-commit-gate step now names 2 of the same evidence. Same underlying `gateBins`, two reporting depths, one of them contractual.

**On `--json` and the contract.** No field/additivity conflict: the bound lives inside the composed message string, `error.message` is still the raw composed text, and nothing is added or removed under `schemaVersion: 1`; your smoke already shows a 1092-char unelided `--json` message. But the `missingDependencies` / `missingDependenciesTotal` precedent you cite is instructive against the fixed cap: that pattern is **cap + full count + a structured array that machine consumers can still enumerate**, precisely so a truncated list is never mistaken for the whole set. This implementation delivers cap + count (2 of the 3) and, on the failure path, no structured array at all — which is why the loss is unrecoverable rather than merely inconvenient.

**Required to land this (all small):**

1. Replace the constant with a budget-derived bound: keep the mandatory clauses first, then include as many named entries as fit inside `MAX_HUMAN_ERROR_CHARS` (min 1, max `MAX_GATE_BINS`), counting the remainder as you do now. Equivalent and cheaper if you prefer: stop composing the readiness clause inside `worktreeRemediation` and append it at the composition TAIL in `worktreeFailureMessage` (after the kernel detail) — the head-clip then naturally shows as many names as fit and `--json` keeps them all. Either keeps your invariant; neither reintroduces a remedy behind unbounded evidence. Keep the structural test (fix index invariant across list lengths) and add one that pins "≥ the number that fits" rather than a magic number.
2. One doc line for the bound where the other two carriers now describe the shipped text (`docs/json-output.md:485` and/or the `x-tracker.strict-gate-bins` bullet in `docs/convention.md`), so the next reader does not "tidy" the count marker away or assume parity with the kernel's uncapped list. If the bound stays data-dependent, say so in words rather than naming a constant.
3. Delete `expect([firstEntry, lastEntry]).toHaveLength(2)` (`cli/src/start.test.ts:626`) — an array literal always has length 2; the surrounding `toContain(firstEntry)` / `not.toContain(lastEntry)` / count-marker assertion are the real guards.

If you decide against the budget-driven form for a reason I cannot see from here, the fallback is the DoD §6 path — file it under the same story and record the information loss (2 of 8 on the pre-commit-gate path, unrecoverable from any CLI surface) in this item's Notes. What I will not accept is the reduction landing silently as a side effect of a reorder PR with the trade recorded only in a code comment.

#### F4 residual (non-blocking)

The correction is the right instinct and the ORDER claim is now pinned by an assertion rather than a number, which is what matters. The values still do not reconcile: for that fixture the gap between the two indices is **invariant** under path length (183 with `id = task-rate-limit`, independent of `$TMPDIR`), because the detail length and the lead both carry the path. So no `$TMPDIR` produces a 104-char gap — at most one index of each quoted pair (459/355, 523/419) can be a real measurement of that composition. Paste the raw vitest output into the item (probe 4) and drop the reconstructed numbers.

#### Non-blocking nits

- The Notes still head the fixed-sites table "(4 sites)" before correcting it to five below. Fold the correction into the heading.
- If the bound survives as a constant, `MAX_HUMAN_GATE_BIN_NAMES` would sit more naturally in `lib/src/sanitize.ts` beside `MAX_HUMAN_ERROR_CHARS`: it is a human-channel cap, not a start-specific one, and that is where the next site will look for it.

## Probes needed

cwd for probes 1–2 and 4: /home/arggon/Projects/ArggonManager-task-cli-start-remediation-tail-clipped-on-human-channel

1. **Real-CLI probe of the bounded readiness clause, ≥3 broken gate bins, pre-commit-gate step.** Disposable fixture whose manifest declares 6+ bin-bearing devDependencies, none installed in the fresh worktree, plus a failing `pre-commit` hook; run `arggon start <id> --worktree` and capture both the human stderr line and `--json`. Expected on the current head: the readiness clause names exactly 2 and appends `and N more bins not resolving inside it`, and `--json error.message` shows the same 2 (no `gateBins` on the failure path). This is the executed evidence for the required change — it makes the loss observable and is what the budget-driven version must beat.
2. **Same probe after the change.** Expected: as many names as fit inside 2000 (≥ the current 2; ~6 in a typical checkout), the remainder counted, and every actionable clause — kept-worktree note, generic fix, exact `npm ci` fix, discard hint — present and whole; `--json error.message` unelided. Also re-run the pathological deep-sibling-path variant: expected 2 names with the full clauses whole (your current worst case must not regress).
3. **Gates on the amended head.** `npm run build && npm test && npm run lint` plus a green `cli` job. Expected: 122 files / 2280+ tests, lint clean, `check:plugin` no drift. The branch will move, so the earlier green run does not carry.
4. **F4 numbers from an observed run.** `git stash push -- cli/src/start.ts && npx vitest run cli/src/start.test.ts -t "refuses the claim commit when the flag is set"; git stash pop` and paste the raw failure into the item. Expected: the attach re-run index strictly greater than the named-bin index (I compute ~537 vs ~356 for a 40-char `$TMPDIR` path), never a 104-char gap.


### 2026-10-03 @Arggon
## Round 3 — the bound is derived, and the bound is no longer lossy

Branch merged `origin/main` (PR was DIRTY against the coordinator's concurrent commits; item-body conflict resolved as a UNION — this branch's blocks and both verdict blocks all kept). Item left `in_progress`.

### The constant is gone; the budget replaces it

`worktreeRemediation` returns **remedy only**. `worktreeFailureMessage` composes every mandatory clause — kept-worktree note, generic fix, exact fix, attach re-run, discard hint, raw detail — reserves their lengths plus the separator against `MAX_HUMAN_ERROR_CHARS`, and hands the remainder to `gateBinFailureReport(readiness, budget)`, which fills names until they stop fitting and counts the rest. At least one name whenever there is evidence; the budget can never reach a mandatory clause, because those are reserved first.

**Measured on this item's own fixtures (8 broken bins), both shapes as asked:**

| entry shape | chars/entry | budget fills | constant-2 showed | composed length |
| --- | --- | --- | --- | --- |
| deep sibling path (pathological) | ~317 | **2 of 8** | 2 (identical) | 1795, nothing elided |
| ordinary checkout (`…/ArggonManager-main/node_modules/.bin`) | ~117 | **7 of 8** | 2 (five hidden that fitted) | 1980, nothing elided |

### The three failure modes, on the real built CLI, same 8-bin fixture, before vs after

| | constant-2 form | budget form |
| --- | --- | --- |
| names in `error.message` | 2 (`ast-grep`, `c8`) | 7 + `and 1 more bin not resolving inside it` |
| flavors visible | `missing missing` | `missing missing path missing path path path` |
| all 8 enumerable from a CLI surface | **no** — no `readiness` field | yes — `readiness.gateBins` = all 8 with sources |

The flavor row is failure mode #2 exactly: under the constant the two visible entries were both `missing`, so a reader concludes "nothing resolves here" and never sees that five bins resolve from a sibling `.bin` on PATH — a different diagnosis, a different first action.

I verified the envelope claim before relying on it: the `start` failure path did carry only `{command, message, code, conventionVersion}` (`cli/src/cli.ts`, both `failJson` calls), and `gateBins` rides the success envelope only — so the hidden names were genuinely unreachable. Hence the third piece of the `missingDependencies` / `missingDependenciesTotal` precedent: **`failEnvelope` now takes an optional additive `payload`** (the reason `successEnvelope` already did), and `start` forwards `readiness: { hasInstall, gateBins }` with the COMPLETE observation. The bound is now a human-channel bound only.

### F4 residual — settled by measurement, and the reviewer's arithmetic does not reproduce either

Claim under test: the gap between the quoted indices is invariant at 183, so no `$TMPDIR` yields the 104 the evidence shows. Measured on the exact composition that test builds (one `missing` bin, step `enforcing x-tracker.strict-gate-bins`, id `task-rate-limit`), sweeping `$TMPDIR`:

| `$TMPDIR` | path length | attach index | named-bin index | gap |
| --- | --- | --- | --- | --- |
| `/tmp` | 40 | 459 | 355 | **104** |
| `/tmp/x` | 42 | 463 | 359 | **104** |
| `/tmp/a-longer-tmpdir-prefix` | 63 | 505 | 401 | **104** |

The gap is **104 at every path length for this composition**, not 183 — so both quoted numbers were real measurements of a single run, and both move together (+1 path char moves each index by 2, the path appearing twice). 183 does appear in the POST-fix composition of the same fixture (attach 203, named bin 622), which is plausibly what was measured. Nothing was dropped because nothing was unreproducible; the load-bearing claim remains a pinned assertion, not a quoted number.

### Also in this round

- The tautological `expect([firstEntry, lastEntry]).toHaveLength(2)` is deleted; the overflow count is derived from the fixture (`names.filter(...)`) so it cannot pass by naming nothing.
- A mandatory clause cannot be eaten: an entry long enough to blow the whole budget (1200-char path segment) still yields a report with the generic fix, exact fix, attach re-run and discard hint intact. Min-1 rule pinned at budget 0.
- Docs: `docs/convention.md` gains the bound stated **in words** (it is data-dependent), plus reconciliation of the "names each offending bin" promise — the two kernel refusals are NOT bounded (their remedy is inside the message, the evidence is its tail); `docs/json-output.md` gains the `readiness` row.
- **One defect the probe found that reading did not:** the wrapper takes a readiness snapshot for EVERY step, so appending the clause unconditionally grew a *push* failure a `Readiness: the gate binaries do not resolve …` list and its exact fix. Now scoped to the committing-claim step and pinned per step.

### Gates (build BEFORE test)

`npm run build` (bundle regenerated, 457609 → 457642 bytes — `lib/src/json.ts` is inlined into the plugin; not hand-edited) · `npm test` **122 files / 2289 tests** · `npm run lint` · `npm run arggon -- validate` ok · `npm run check:plugin` no drift · `npm run test:structure` 3 passed · `npm run lint:structure` clean. CI on the merged head: `cli` pass 5m2s (run 37097168986, job 111129346900), `tasks-validate` pass, `ui-smoke` pass.

### handoff 2026-10-03 @Arggon — next: Re-review+merge PR #608: bound now budget-derived (7/8 typical, 2/8 worst), readiness array on the failure envelope, cli green
- branch: feat/task-cli-start-remediation-tail-clipped-on-human-channel
- open questions: Is failEnvelope's new optional payload acceptable surface-wise, or should the readiness receipt be CLI-only?; F4: my measurement contradicts the review's 183 — accept the measured 104 table?

### 2026-10-03 @Reviewer (round 3)
verdict: approve (the review findings are closed and verified; merge is still gated on one green `cli` run — the latest head `b0b9f93d` is red)

Read `88cb4984..HEAD` (the budget refactor, the `--json` payload, the new tests, the docs rows and the bundle line), the item's round-3 evidence, and the CI log of run 37097542576. My numbers are string arithmetic on the committed fixtures (no project imports), so they are independent of the probes.

#### 1. The budget cannot starve a mandatory clause — verified, with the two residual edges named

The reservation is sound and I can show it arithmetically. Composed length is `lead + remedy + discardClause + detail + 4 separators`, and `mandatory` counts exactly those four separators, so `composed = mandatory + readiness.length`; with `budget = MAX_HUMAN_ERROR_CHARS − mandatory` and a fill that respects `budget`, `composed ≤ MAX` by construction. Two things I checked rather than assumed:

- The separator accounting inside the fill is **off by up to 2 chars**: the comparison is `used + entry.length > budget`, but the entry about to be pushed also costs `'; '` when it is not the first. The bound is `used ≤ budget + 2` (only the last push can overshoot, because the next comparison runs on the inflated `used`), and the residue lands in `detail` — the LAST clause — never in a remedy. Your typical fixture lands 20 chars under budget, so it does not bite there. Nit below.
- The `≥1 when there is evidence` rule deliberately overrides the budget for the first entry. With the reserve in place that is safe in the ordinary case, and I confirmed the general bound: the discard clause ends at `mandatory − detail − 1 + readiness`, so as long as the reserved block itself fits the line, every actionable clause survives whole **whatever** the fill does — including a single entry far larger than the whole remainder. It only stops holding when the RESERVED block alone exceeds 2000, which needs a ~700+ char absolute path (your own `ONE entry cannot fit` test sits there: `worktreePath` ≈ 1250 chars, so `mandatory` alone is over the line, and the assertions pass because the exact-fix phrase starts at ~1815 < 2000, not because the reserve absorbed anything). Both edges are pre-existing inputs, not introduced here; the reserve is what makes the common cases safe.

#### 2. `failEnvelope`'s `payload` is genuinely optional and additive — verified

`lib/src/json.ts` adds one optional field and one spread, `...(opts.payload ?? {})`, placed BEFORE `error`: nothing removed, nothing retyped, `ok: false` and every existing failure envelope byte-identical when no payload is passed (`{} `spread adds no keys), and `error` cannot be shadowed by a payload key. Additivity holds under `schemaVersion: 1`, and the `readiness` row plus the `json-output.md` start paragraph now document the field and say why it exists. The end-to-end wire test (`cli/src/worktree.test.ts:594`) checks the real spawned `--json` output: message raw and unelided, `readiness.gateBins` complete with `source: "missing"`, `hasInstall: false`. MCP forwards the parsed envelope verbatim (`spawnedOutcome` → `{ ok: false, envelope, exitCode }`), so the payload rides through unchanged; the native/plugin path never passes `payload` (the two bundle call sites at `:8711`/`:9179` pass command/code/message only, and `startFailure` merges its own pre-existing payload mechanism), so native behavior is unchanged.

#### 3. The `≥1` rule never implies a single cause — verified

When one name fits and seven do not, the marker still rides the clause: `readinessOverflow` is called with `broken.length − shown.length`, so the line reads `… — tsx: …; and 7 more bins not resolving inside it.` The count is reserved for the FULL overflow before the loop runs (the worst-case marker), so the count is never the thing that gets cut. `hasReadinessEvidence` also gates the exact fix on evidence existing, so a fix never points at nothing.

#### 4. The per-step scoping is right, and it is pinned — verified

`reports the readiness evidence on the claim-commit step ONLY` pins claim-commit (clause present) against push / draft-PR / read-back (no `Readiness:`, no `Exact fix`) — the leak your multi-bin smoke probe caught. Losing the clause on a push failure is **right**, not merely acceptable: a push failure's cause and remedy are remote access and the manual `git push -u`, so the gate-bin observation was noise in the message; and it is not lost from the machine surface, because the readiness snapshot still rides `readiness` on every post-worktree failure (`cli.ts` forwards it whenever the wrapper threw it). Strict-gate and fresh-install steps correctly keep the kernel's own uncapped list instead of a duplicate — which is exactly what the new `convention.md` bullet says.

#### 5. F4 — my round-2 claim was wrong; retracting it precisely

You are right about the mechanism and I was wrong about the number. What IS path-independent is the gap, because the worktree path appears twice in the pre-fix composition — that part of my finding was right. But I measured the wrong pair: I computed the distance from the named bin to the END of the remediation clause instead of to the `arggon start <id> --worktree` needle inside it, which is why I got 183 and declared the reported pairs impossible. Derived properly, the strict-gate composition's gap is `bin.length + 2 + remPrefix.length` = `49 + 2 + 66` = **117**, id-independent and path-independent — and I get (471, 354) at a 39-char path, (473, 356) at 40, (519, 402) at 63, all gap 117. So the `+64` shift you measured is real and my "structurally impossible" verdict is withdrawn. One residual, for honesty: 104 (your figure) is not 117 either, so the recorded pairs are still not fully explained by one composition — but the ORDER claim, which is what the item actually asserts, is now pinned by an assertion rather than a quoted number, and the numbers are historical. Nothing to do beyond dropping the pair from the item if you prefer.

#### 6. Bundle — verified

`git diff --numstat` on `opencode/plugins/arggon/index.bundle.ts` is `1 0`: a single added line, `...(opts.payload ?? {}),` inside the inlined `failEnvelope` — 8 spaces + 24 chars + newline = exactly the +33 bytes (457609 → 457642). Nothing else in the bundle moved, and the plugin's own call sites pass no payload, so the delta is inert on the native seam.

#### Headline numbers reproduced independently

- pathological (~317 chars/entry): **2 of 8** named, total **1795** ≤ 2000, nothing elided, exact fix @584, readiness @834, discard @1579 — byte-identical to the old constant-2 form, as claimed.
- ordinary checkout (~117 chars/entry): **7 of 8** named, total **1980** ≤ 2000, nothing elided — versus 2 under the constant. My round-2 prediction was 6; 7 is better.
- mixed flavors (`missing missing path missing path path path path`): all eight flavors are visible under the budget; the constant-2 form showed only the two leading `missing`. My round-2 failure mode #2 is closed.

#### Non-blocking nits (no gate attached)

1. `gateBinFailureReport`'s comparison should include the `'; '` it is about to add (`used + entry.length + (shown.length > 0 ? 2 : 0)`), so the invariant is exact rather than "budget + 2 that happens to land in `detail`".
2. `docs/convention.md`'s readiness bullet ends with "while every actionable clause always survives whole". True whenever the RESERVED block fits the line (i.e. except a ~700+ char absolute path or a ~900+ char raw gate output). Worth one clause of precision, since this sentence is the citation a future site will read before adding a list.
3. `failEnvelope`'s `payload` type allows a future caller to shadow `ok` / `schemaVersion` / `conventionVersion` / `command` (`error` is safe — the spread precedes it). A reserved-key filter or a `payload` namespace would close it; one caller today, so advisory.
4. For `bug-cli-spawn-suites-exit-1-flake`: the missing export name varies per occurrence (`priorityRank`, `numberField`, now `MAX_CLAIM_WRITE_NAMES`) — always a half-written `lib/dist` module, never an assertion failure. Useful signature for whoever fixes the writer.

## Probes needed

1. **Green `cli` run on the final head.** `gh run rerun --job 111130448518` (or `npm run build && npm test` in the worktree). This is the only thing between the review and merge. Note the premise I was given ("CI green on the merged head") is stale: `gh pr checks 608` on head `b0b9f93d` shows `cli` **fail** (run 37097542576) — `cli/src/cli.test.ts` → `SpawnHarnessError … child-boot-failed` with `kernel artifact drift … another suite lane rebuilt lib/dist or dist in place` and `SyntaxError: './worktree.js' does not provide an export named 'MAX_CLAIM_WRITE_NAMES'`; 1 failed file, 2288 passed. Nothing in this diff touches `lib/src/worktree.ts`, and the drift detector names the writer itself, so it is the tracked flake class — but green CI is necessary, so land one green run on the final head before merging.
2. **Real-CLI probe of the budget fill (≥3 broken bins, pre-commit-gate step).** Disposable fixture with 6+ bin-bearing devDependencies installed nowhere, failing `pre-commit` hook; run `arggon start <id> --worktree`, read the human stderr line, and capture `--json`. Expected: the readiness clause names as many bins as fit in that checkout's entry shape and counts the rest (`; and N more bins not resolving inside it.`), every actionable clause whole, and `--json` carrying BOTH the bounded message and the complete `readiness.gateBins`. This is the executed evidence for the behavior my round-2 verdict asked for.
3. **Deep-path probe (edge, optional).** A sibling `.bin` path of ~700+ chars: expected — the reserved block itself exceeds the line, so the trailing discard/detail tail is elided while the generic fix and the exact fix's opening survive. Confirms the nit-2 wording before it ships.
4. **F4 raw output (optional).** `git stash push -- cli/src/start.ts && npx vitest run cli/src/start.test.ts -t "refuses the claim commit when the flag is set"; git stash pop` and paste the raw failure, if you want the item's numbers observed rather than reconstructed. My derivation says the pre-fix gap is 117 at any path length (471/354 at a 39-char `$TMPDIR` path).

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Coordinator note while #616 (bug-vacuous-substring-ordering-assertions) waits to merge: its shared helper `assertOrder(haystack, ...needles)` exists to prevent exactly the vacuity your four inline presence-checks guard against, and its ast-grep rule (`ordering-assertions-use-assert-order`) will flag your `const hint = message.indexOf(...)` form as the documented variable-form blind spot.

So: once #616 merges, your four sites should be swapped to `assertOrder`. Do not do it in this PR — merge order matters here, and a change here now would collide with #616's own edits to `cli/src/worktree.test.ts` (both items touch the same assertions).

Also for the record, from that item: the `- [ ] x`-style lesson generalises. An ordering assertion passes vacuously whenever the searched substring is ABSENT, because `indexOf` returns -1 and `-1 < any-positive` is always true — which is how your lowercase needle stopped matching when the message was reworded to capitalised, and the guard went quiet at the moment the behavior changed.

### 2026-10-05 @arggon-delivery-lead
verdict: approve (delivery-lead merge verification + one required gate fix applied during it)

This item was sitting at `todo` with no assignee, branch or `worktree_path` while its work sat in a worktree and an open PR (#608) — the tracker-blindness of `bug-native-arggon-tools-resolve-tracker-root-to-session-cwd`. Reconciliation was the prerequisite to merging.

**Blocking gate failure found and fixed here.** The branch was 341 commits behind. `git merge origin/main` was clean, but it brought in `tools/ast-grep/rules/ordering-assertions-use-assert-order.yml` — a rule that did not exist when this branch was cut — and `npm run lint:structure` **failed** at `cli/src/start.test.ts:554` and `:623`: both sites used bare `expect(text.indexOf(needle)).toBeLessThan(...)`. That is precisely the vacuous-ordering defect `test/assert-order.ts` documents, and **that helper's own doc comment names PR #608 as the live instance** — so the branch was still carrying the defect the helper was written for. Both sites now call `assertOrder`; the inline presence-check loop at the second site is removed, because it proved presence and then re-derived the order with the same bare `indexOf` comparisons, i.e. a weaker local copy of the guard rather than a substitute. Without this, #608 cannot merge.

**Acceptance verified by reading the code, not the maker's summary:**
- box 1 — ordering is load-bearing and commented as such in `cli/src/start.ts` ("hint LEADS", "ORDERING is load-bearing", "Hint FIRST, hook output last") with the `READINESS_LEAD` constant; the composition leads with the remediation and keeps the kernel detail last.
- box 2 — the worst-case fixture builds the list at `{ length: MAX_GATE_BINS }` and names the tail (`lastEntry: entry(names[MAX_GATE_BINS - 1]!)`); the clip length is pinned exactly to `MAX_HUMAN_ERROR_CHARS + 1 + escaped`, so a merely-longer message fails; the ordering is asserted by `assertOrder`, not by a hand-copied index pair.
- box 3 — the negative control is real and non-vacuous: `expect(clipped).not.toContain(lastEntry)` together with `expect(message.slice(MAX_HUMAN_ERROR_CHARS)).toContain(lastEntry)`, so the control cannot pass by naming nothing (the tail bin is present in the full message).
- box 4 — the fifth site that arrived with #517 (`worktreeRemediation`'s `committing the claim` branch) was **found and fixed in this PR**, which is what the round-2 reviewer's finding demanded ("either fix it in this PR … or file it"). The four remaining sites (`cli/src/board.ts:141` and the three kernel `gh auth status` wrappers) are **not clip-reachable** — they run `gh` with stderr `ignore`d, so `err.message` is a bounded argv echo — which is the reviewer's accepted F5 correction. They are a consistency follow-up in `task-clip-class-sweep-remaining-sites` (which `depends_on` this item), not an unclosed class. The "class closed" claim is therefore honest as scoped, and the deferral is recorded rather than implied.

**Gates — executed, expected vs observed:**
- `npm run lint:structure` → expected clean; **observed 2 errors** at `cli/src/start.test.ts:554,623` before the fix, **clean after**.
- `npm run lint` → clean. `npx tsc -p tsconfig.json --noEmit` → rc 0. `npx prettier --check cli/src/start.test.ts` → all files use Prettier style.
- `npx vitest run cli/src/{start,cli,worktree}.test.ts` → **3 files / 175 tests passed**.
- `npm test` (full) → **1 failed | 127 passed (128) files; 1 failed | 2679 passed (2680) tests**. The single failure is `cli/src/headless-ci.test.ts:849` and is **not this branch's**: it fails identically in the primary checkout on clean `origin/main`. Filed as `bug-headless-ci-twin-init-nondeterministic` under `tooling-and-environment`. `main` is independently red there.
- Two earlier full runs in this worktree reported 55 failures with `SyntaxError: … does not provide an export named 'containersMissingAcceptance'`. Cause was a stale `lib/dist`, twice over: the worktree was 341 commits behind, and the first rebuild ran *before* the merge so it did not include main's `lib/src`. `npm run build --workspace @arggondev/lib` **after** the merge fixed it. Recorded because the `start` receipt reported `ready: true` with `install: "existing"` and `builtWorkspaces: []` — on an attached worktree a reused install is not rebuilt, so `ready: true` does not mean the gate can boot the CLI. Same signature as `bug-test-suite-lib-dist-rebuild-race`.
- Smoke bar: applicable and covered — the changed surface is the human-channel failure text on the `start`/worktree-gate path, driven end-to-end through the real `runStart` strict-gate path, the real-git pre-commit gate and the spawned-CLI `gh` stub (`cli/src/cli.test.ts:83`), not by string arithmetic on a mirror. No UI/TUI surface touched, so the Playwright lane is not implicated by this diff.
