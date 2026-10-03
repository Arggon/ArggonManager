---
type: task
status: in_progress
id: task-adr-index-parity-does-not-check-titles
title: "ADR index parity test does not check titles: the corpus is 17/20 verbatim H1 copies, so a wrong title stays green"
assignee: Arggon
branch: feat/task-adr-index-parity-does-not-check-titles
parent: methodology-improvements
labels: [docs, adr, tests]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T12:48:04.010Z"
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
