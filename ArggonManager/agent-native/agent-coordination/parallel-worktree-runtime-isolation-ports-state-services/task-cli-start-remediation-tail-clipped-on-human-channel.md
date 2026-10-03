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

### 2026-10-03 @ses_f003caa48ffeGSthQJfGGpwkog
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
