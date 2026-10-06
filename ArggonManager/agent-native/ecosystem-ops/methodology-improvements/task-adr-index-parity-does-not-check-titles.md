---
type: task
status: done
id: task-adr-index-parity-does-not-check-titles
title: "ADR index parity test does not check titles: the corpus is 17/20 verbatim H1 copies, so a wrong title stays green"
assignee: Arggon
branch: feat/task-adr-index-parity-does-not-check-titles
parent: methodology-improvements
labels: [docs, adr, tests]
created: "2026-10-03"
updated: "2026-10-06"
depends_on: [task-adr-readme-index-missing-adr-0020]
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-index-parity-does-not-check-titles
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr-index-parity-does-not-check-titles.md
  Leaves live only under a story. id is the filename stem: task-adr-index-parity-does-not-check-titles.
  CLI `arggon create task adr-index-parity-does-not-check-titles` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR index parity test does not check titles: the corpus is 17/20 verbatim H1 copies, so a wrong title stays green

## Context

Found by the reviewer of PR #602 (task-adr-readme-index-missing-adr-0020), 2026-10-03, and scoped deliberately OUT of that PR.

The new ADR index parity test checks membership both ways, numbering, status class, label/link/heading agreement and row order — but deliberately NOT titles. The worker's reasoning was that index titles are editorial summaries (0018's heading carries a parenthetical; 0002 appends "(static + serve)"; 0003 is a rewrite rather than an abbreviation), so pinning them would assert a convention the corpus does not follow.

The reviewer checked that claim and found it true of exactly three rows, not of the corpus: the index is **17/20 verbatim H1 copies**. So the honest reading is "three rows deviate", and the real consequence is that a WRONG title on any ADR stays green — the index could misname a decision and the gate would not notice.

That is follow-up-grade, not merge-grade: fixing it in the same PR would either force an editorial convention on three rows or weaken the other six assertions. The decision is whether to converge the three rows onto verbatim H1 copies (then the test can assert titles) or to accept titles as editorial and document that the index may paraphrase.

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

- [x] **The corpus is measured, not assumed.** 20 indexed ADRs, 17 index titles byte-equal to their own `# NNNN Title` heading minus the number prefix, 3 deviating: 0002 and 0018 append a parenthetical gloss, 0003 is a near-rewrite (`Milestone field for convention v3` → `Milestone field (folded into v3)`). The rule follows that measurement.
- [x] **A deliberate divergence must be DECLARED, not merely allowed.** The row copies the ADR's H1 byte for byte unless the ADR declares otherwise with a `- Index title:` line in its own metadata list. 0002/0003/0018 carry that declaration; the other 17 rows are unchanged and stay verbatim. No correct row was edited.
- [x] **A wrong title is red, proven by mutation, with a readable message.** Mutating a README row title, an ADR's H1, and each way of abusing the declaration all fail; each message names the ADR file and both titles. 16 mutations, run against a copy-backed baseline (no `git stash`, which is shared across worktrees), with a preflight that refuses to run on an already-red baseline and a post-run byte comparison proving the corpus was restored.
- [x] **The count/name checks cannot go vacuous.** Presence is asserted explicitly in both directions (`every ADR file has exactly one row` / `every row resolves to a file`), each guarded against its own empty-side case. The title check iterates ROWS and diagnoses an unresolvable target itself, so no row can skip it by pointing at a missing file; a missing or demoted H1 is reported, not skipped.
- [x] **ADR 0020 (amended by merged PR #610) and ADR 0021 (renumbered, PR #605) both survive.** 0020's amendment is body-only, so the H1 and the row still agree. 0021's renumber is unaffected: the rule reads titles, not numbers. Its editorial row title needs the one-line declaration the failure message prints verbatim, which is the gate working, not a rejection of the renumber.
- [x] **The flip rule is not weakened.** A status flip still lands in the ADR and the row in one commit (proven: flip + row green, flip alone red). The title rule adds no new coupling to a flip — it only means that if a flip commit ALSO retitles an ADR, the H1/row pair must land with it, which is the same rule.
- [x] **Gates green:** `npm run build` before `npm test` (126 files / 2586 tests), `npm run lint`, `npm run arggon -- validate`, `npm run check:plugin`, `npm run test:structure`, `npm run lint:structure`.

## Notes

**Methodology impact class: Advisory.** `docs/adr/README.md` is a
methodology carrier, and this PR changes what it promises (the Title column now
has a rule) without changing what any agent or contributor must _do_ beyond
copying the heading: the declared-divergence escape hatch means an editorial row
is still legal, and 3 of 20 rows are already legal under it unchanged. It is not
Behavioral — no ADR status, no convention field, no CLI surface and no agent
workflow changes, and `skills/arggon-cli/` + `.agents/skills/` therefore need no
re-sync (`npm run skills:sync` is a no-op here; no generated command or flag
moved). Reasoning for the class choice: the trigger for Behavioral is a rule
agents must follow differently after the merge; after this merge an agent
indexing a new ADR does the same thing it did before (write the row), and only
gains a check that catches it when the title is wrong.

**Rule documentation.** `docs/engineering.md` §ADR process does not mention the
index at all (another worker owns that file this wave, so it was not edited).
The rule is documented in the two places a contributor actually reads it: the
index itself (`docs/adr/README.md`, above the table) and the test header. If the
engineering.md owner wants it canonical, the one paragraph to add is under
§ADR process → **Location & naming**.

**Pre-existing flake, not caused by this PR.** On one full-suite run
`cli/src/prose-format.test.ts > prettier never rewrites a code span's source
text` failed with `Test timed out in 30000ms`; it passes alone (~30s for that
one test, against a 30s per-test limit) and the full suite was green on
re-run. Left alone as out of scope — worth its own item if the coordinator wants
the limit raised or the parse cached.

### 2026-10-03 @Arggon
**Measured corpus (the item's ask, done before choosing a rule).** 20 indexed ADRs, comparing each `docs/adr/README.md` row title with its own `# NNNN Title` heading minus the `NNNN ` prefix:

- **17 byte-equal to the H1** — the item's 17/20 claim is confirmed.
- **3 deviate**: 0002 appends `(static + serve)`; 0018 appends `(release pipeline, update channel, skew, tarballs)`; 0003 is a near-rewrite (`Milestone field for convention v3` → `Milestone field (folded into v3)`). None differ by punctuation, whitespace, or status suffix — every deviation is an added gloss (0003 swaps the clause after the shared `Milestone field` prefix).

So the original reasoning was true of exactly three rows, not of the corpus, and the consequence was that **the Title column was decorative**: any text stayed green.

**Rule landed** (PR #620): the row copies the ADR's H1 byte for byte **unless the ADR declares otherwise with a `- Index title:` line in its own metadata list**. A deliberate divergence must be declared; an accidental one fails. 0002/0003/0018 carry the declaration, the other 17 rows are untouched (no correct row churned), and the index README states the rule in six lines of prose above the table. The alternative — pinning verbatim bytes outright — would have forced an editorial convention onto three rows no maintainer asked for.

**ADR 0020 (amended by merged PR #610):** unaffected — the amendment is body-only (a multi-line `- Amendment (…):` bullet plus two blockquotes), so H1 and row still agree. Its multi-line metadata bullet is also why the declaration parser joins continuation lines instead of truncating at the first.

**ADR 0021 (renumbered, PR #605):** the **renumber is not rejected** — the rule reads titles, not numbers, and its number/heading/row-label checks already pass. What it needs is the one-line declaration its own parity failure prints verbatim, because its row carries the editorial title `Adopter friction channel: local capture, stable-fields dedupe, human-gated publish` against a bare H1 `Adopter friction channel`. That is a fourth editorial row meeting a real gate, not the renumber being refused. Verified by replaying #605's ADR 0021 and row against the suite: RED without the declaration, green with it. Flagged to that PR's author in the #620 body.

**Flip rule unchanged and proven both ways:** ADR 0021's `Accepted` flip plus its row in one commit → green; the flip alone → RED on `mirrors each ADR's own status`. The title rule adds no coupling to a flip — it only means a commit that both flips a status *and* retitles an ADR must land the H1/row pair too, which is the rule the row already had.

**Mutation proof** (16 mutations, copy-backed baseline, no `git stash` since stashes are shared across worktrees, preflight refuses an already-red baseline, each mutation asserted to have applied, post-run byte comparison proves the corpus came back): row-title typo RED, H1 retitle RED, demoted H1 RED, deleted row RED, dangling row RED, duplicate/empty/redundant declaration RED, half-landed amendment RED; continuation-line wrapping and the complete amendment green. Each RED message names the ADR file and both titles. Presence is explicit in both directions with an empty-side guard on each, and the title check iterates rows and diagnoses unresolvable targets itself, so no row can skip it by pointing at a missing file.

**Gates:** build before test (126 files / 2586 tests), lint, `arggon validate`, check:plugin, test:structure, lint:structure — all green. Prettier: formatted twice with pass-2 vs pass-3 byte-identical, and the residual reformat diff is identical to the churn prettier already wanted at HEAD (2 / 18 / 4 / 0 lines), so this PR adds no new formatting drift; every line it adds is byte-identical after formatting.

**Methodology impact class: Advisory.** Reasoning: `docs/adr/README.md` is a methodology carrier and this changes what it *promises*, but not what anyone must *do* beyond copy the heading — the declared-divergence hatch keeps every legal editorial row legal (3 of 20 already are, unchanged). The trigger for Behavioral is a rule agents must follow differently after the merge; an agent indexing a new ADR does exactly what it did before and gains a check that catches a wrong title. No ADR status, convention field, CLI surface or agent workflow moves, so `skills/arggon-cli/` + `.agents/skills/` need no re-sync (`npm run skills:sync` is a no-op — no generated command or flag changed).

**Left for another owner, deliberately:** `docs/engineering.md` §ADR process does not mention the index at all, and that file is owned by another worker this wave, so it was not edited. The one paragraph to add is under §ADR process → **Location & naming**.

**Observed pre-existing flake, out of scope:** on one full-suite run `cli/src/prose-format.test.ts > prettier never rewrites a code span's source text` failed with `Test timed out in 30000ms`; it passes alone (~30s for that single test against a 30s per-test limit) and the suite was green on re-run. Flagging for the coordinator rather than widening this diff — it wants its own item if anyone wants the limit raised or the parse cached.

### handoff 2026-10-03 @Arggon — next: Review PR #620: confirm the declared-divergence rule and the 16-mutation proof; the three ADR - Index title: lines are the only corpus edit.
- branch: feat/task-adr-index-parity-does-not-check-titles
- open questions: Should docs/engineering.md ADR process canonically document - Index title:? That file is owned by another worker this wave. Will PR #605's author add the declaration for ADR 0021's editorial row? Is …

### 2026-10-06 @reviewer
verdict: approve (mergeable; two follow-ups required, and the mutation proof is routed to the verifier because I ran no gates)

Reviewed by reading only. Commands run, all in `/home/arggon/Projects/ArggonManager-task-adr-index-parity-does-not-check-titles`, all three-dot against `origin/main`:

- `git diff --name-status origin/main...HEAD` → 6 files, exactly the ones the item names: the three ADRs, `docs/adr/README.md`, `cli/src/adr-index-parity.test.ts`, the item file. `git diff --numstat` → `+70/-1` item, `+1/-0` each ADR, `+6/-0` README, `+170/-25` test. Nothing crept in.
- `git diff origin/main...HEAD -- <each file>` read end to end.
- Every ADR's H1, `- Status:` and (new) `- Index title:` line, and every README row, read and compared by hand.
- `grep` for `arggon:generated` across `docs/adr/` → no matches. `grep` for a writer of `docs/adr/README.md` across `cli/src/` → only `adopt.test.ts` fixtures writing into a temp dir.
- `agents.md:471-478`, `engineering.md:62-131` (§Review bar), `:150-195` (§ADR process), `cli/src/docs.ts:516-524` (`TIER2_DESTS`).
- `git diff --name-status origin/main...HEAD` + full diff in `/home/arggon/Projects/ArggonManager-bug-engineering-doc-stale-adr-statuses` (#618) for the cross-PR question.
- `arggon list --status todo` (84 items) to check the named deferral is actually filed.

**First: the carrier summary I was handed was wrong on the substance, and the real change is the better one.** It is not "adds the missing H1 title lines" — every one of the 20 ADRs already had its `# NNNN Title` heading at line 1, including 0002, 0003 and 0018. The three one-line ADR edits are `- Index title: …` metadata bullets, and the README's +6 is rule prose, not Title-column values (the column already existed). Nothing here is a heading being invented; the rule landed is "verbatim unless the ADR declares otherwise".

**The assertion discriminates.** `readAdr` reads the ADR file itself and takes its own H1 (`source.match(/^#\s+(.+)$/m)`, `adr-index-parity.test.ts` in `readAdr`), strips `^\d{4}\s+`, and `expected = declared ?? adr.title` is compared against `row.title`. The README is never compared against itself and no title is hardcoded in the test, so mutating any of the 17 undeclared ADRs' H1, or their rows, is red. The declaration-hygiene test is file-driven and pins a declaration from both sides (redundant / empty / duplicate / no-row / row-disagrees), so a declaration cannot accumulate into being the silent default. The count/name checks genuinely cannot go vacuous: each direction asserts its own side is non-empty, and the title test iterates rows and diagnoses an unresolvable target itself, so no row escapes the check by pointing at a missing file.

**I hand-verified the whole corpus rather than trusting the gate.** All 20 ADRs have the H1 at line 1 and a `- Status:` at line 3. Against the 20 README rows: 17 byte-equal to their H1 (the item's 17/20 claim is confirmed), 3 declared and matching — `Board viewer v0 (static + serve)`, `Milestone field (folded into v3)`, `Update delivery and distribution channel (release pipeline, update channel, skew, tarballs)`. Every declaration is non-empty, unique, and genuinely divergent from its H1, so the hygiene test passes on the real corpus. Numbering is 0001–0020 gapless ascending, 20 rows for 20 files, every target resolves to a real filename, and every row's status class agrees with its file's `- Status:` (0002/0008/0009/0011 carry parentheticals over an `Accepted` class, 0010 `Partially superseded`, 0019 `Proposed`). No row was added, reordered or reflowed: in the README hunk the table header and all 20 rows appear as context lines, so **no column-width or table churn**, and the three ADR hunks are `+1/-0` inside the metadata list with no status, meaning or lifecycle change.

**Not generated.** `docs/adr/README.md` carries no `<!-- arggon:generated -->` marker, nothing in the build writes it, and the suite's own header calls it "a hand-maintained index". The hand-edit is the right surface.

**Impact class: Advisory is correct, and I checked it against the same bar that forced #618 to Behavioral.** `agents.md:473` enumerates the carriers as `agents.md`, `engineering.md`, `convention.md`, `skills/arggon-cli/**` — `docs/adr/README.md` and the ADR files are not among them, and `docs.ts:516-524` shows `TIER2_DESTS` materializes neither the ADR index nor the ADRs into adopting repos, so the new row-title rule does not reach an adopter's agents. That is the fact #618 lacked (it edited `engineering.md`, which is both an enumerated carrier and materialized), and it is why the two classifications differ rather than contradicting each other.

## Findings, in severity order — none blocking

**F1 (should fix; must be filed before merge closes).** The rule's canonical home is unwritten and the deferral is unfiled. `engineering.md:164-171` (§ADR process → Location & naming) and the template at `:175-189` are where the ADR metadata shape lives, and neither mentions `- Index title:` or the index row's title. The rule does travel with the change — to `docs/adr/README.md:7-11` (the surface where a row is actually written) and the suite header — and `agents.md:476`'s "update every doc statement the change makes false" is not triggered because the template is a *minimum*. But you named the exact paragraph to add and then did not file it: I listed all 84 `todo` items and there is no item for it. Per `AGENTS.md` a review finding becomes an item, not a comment, and this one currently lives only in this verdict. This also has a merge-order consequence — see below.

**F2 (should fix; one stale reference, owned by #618).** #618's new `cli/src/adr-status-doc-contract.test.ts` justifies its vocabulary as "the same word list `adr-index-parity.test.ts` classifies index rows with", citing `adr-index-parity.test.ts:125-131`. This PR moves `STATUS_CLASSES` from `:125` to `:191` (239 → 384 lines). The claim still holds — #620 does not touch `STATUS_CLASSES` — but the line reference is now wrong in a file #620 does not own. Free to fix by dropping the line numbers; hand it to #618's author rather than widening this diff.

**F3 (note; closing the defect class).** A *declared* row title is self-certified: for 0002/0003/0018, and for any future ADR that adds a declaration, a genuinely wrong title is still green. So the item's harm — "a wrong title stays green" — is closed by default for 17 of 20, not for the corpus. That is a real residual, and I want it recorded rather than discovered later. It is not blocking because the item posed exactly this decision, the maker chose a defensible third option over the two it offered, the trade-off is documented in three places, and the hygiene test is a genuine guard against the escape hatch expanding silently. Worth one line in the item so the boundary is stated by its owner.

**F4 (hardening; same precedent as #618's F2).** Both new tests run over a corpus that is currently clean, so `expect(problems).toEqual([])` would still pass if the `row.title !== expected` comparison were deleted outright. #618's suite header names this exact hazard and its round-2 verdict *required* extending the premise guards for the unpinned half of a region. One synthetic assertion over `readIndexTitles`/title resolution would make a deleted comparison loud instead of merely undiscovered. The maker's 16 mutations are real evidence that the assertions bite, but they are out-of-band and not encoded, so the next editor gets no signal.

**F5 (nit, latent).** `readAdr` takes the first `/^#\s+(.+)$/m` match as the H1. Safe for all 20 today (I verified each is at line 1), but an ADR whose first `#`-prefixed line sits inside a fenced code block would have its title read out of the block. The template mandates the heading, so this is a one-line hardening at most.

**F6 (nit, prose).** `docs/adr/README.md:7` leads "The Title column is the ADR's own `# NNNN Title` heading, verbatim" and the qualification arrives at `:8-9`. Correct as a paragraph, overstating as a first line in a table README.

## Merge order against #618: **#620 first, then #618**

No textual conflict — the two branches share **zero files** (#618: its item file, `docs/engineering.md`, new `adr-status-doc-contract.test.ts`; #620: its item file, three ADRs, `docs/adr/README.md`, `adr-index-parity.test.ts`), and the suites are green in either order because #620's reads only `docs/adr/**` while #618's carriers are `engineering.md`/`agents.md`/`convention.md`. Specifically, the question asked: **#620's `0003-milestone-field.md` does not collide with #618 on ADR 0003.** #618 touches no ADR file at all — its ADR-0003 subject is the *restatement* at `engineering.md:230` (`milestone field (Proposed): [ADR 0003](…)`), which it deletes; `0003-milestone-field.md`'s own `- Status: Accepted` is untouched, and #620's line 7 addition is disjoint.

Order on ownership grounds, not on conflict: `engineering.md` §ADR process is the paragraph that should carry the title rule (F1), and #618 is the PR actively authoring that section — it adds a paragraph there describing `adr-index-parity.test.ts`'s coverage and ships a test asserting that sentence matches its code constants. #620's maker has twice declared `engineering.md` out of scope as "owned by another worker this wave", so if #618 merges first, the canonical sentence ships describing that suite's coverage while omitting the title rule, with no owner left to fix it. Merging #620 first hands that one clause to #618's author, who is mid-iteration in exactly that file. Note for them: `adr-status-doc-contract.test.ts`'s coverage-parity test parses backticked **`.md`** names out of the `**Coverage: …**` clause, so naming `adr-index-parity.test.ts` there is safe (a `.ts` reference is not read as a carrier). #620 is also 391 commits behind `origin/main` and must rebase it regardless, so it is the natural side to absorb a rebase first.

## Probes needed

I ran no gates — read-only, and I did not perturb any file. All of the following are for the `arggon-verifier` in a named worktree, cwd `/home/arggon/Projects/ArggonManager-task-adr-index-parity-does-not-check-titles`, each edit reverted afterwards with `git status --porcelain` clean.

1. **Discrimination on the default rule (the load-bearing one).** Change `docs/adr/0005-cheap-path-to-prod.md:1` to `# 0005 Cheap path to prod, cheaply`. Expected: `mirrors each ADR's own title, or the title that ADR declares` FAILS with `index title "…" does not match the ADR's own title "…"`. Observed if it passes: the rule is decorative and this verdict is wrong.
2. **Discrimination on the row side.** Change the 0005 row's Title cell in `docs/adr/README.md` by one word. Expected: same test FAILS naming the ADR file and both titles.
3. **The escape hatch, stated honestly.** Add `- Index title: Anything at all` to `0005-cheap-path-to-prod.md` *and* set its row title to `Anything at all`. Expected: **PASSES** — this is F3, the residual, not a defect to fix. Recorded so the boundary is observed rather than assumed.
4. **The declaration-hygiene test discriminates.** Give `0016-adopter-upgrade-channel.md` `- Index title: Adopter upgrade channel` (identical to its H1). Expected: `declares an index title only where it deliberately diverges` FAILS with the "repeats the `# NNNN …` heading" message.
5. **The mutation proof as claimed.** Re-run the maker's 16 mutations, or at minimum: dangling row target, deleted row, second `- Index title:` declaration, empty `- Index title:` value, and a `#` comment inside a fenced block above a demoted H1. Expected: RED with the recorded messages for the first four; for F5, expect the title to be read from inside the fence — confirms the nit is real.
6. **Gates on the head that merges.** After rebasing onto `origin/main`: `npm run build && npm test`, `npm run lint`, `npm run arggon -- validate`, `npm run check:plugin`, `npm run test:structure`, `npm run lint:structure`. Smoke is exempt (`engineering.md:94`, docs + one additive test, no CLI/UI/TUI/native change). If #618 has merged first, `npm test` must additionally carry `adr-status-doc-contract.test.ts` green.

Unverified by me: every execution claim, including the maker's 16-mutation proof, the 126-file/2586-test count, the prettier-convergence claim, and `gh pr checks` on any head other than the one reported. The one that would change this verdict is probe 1.
