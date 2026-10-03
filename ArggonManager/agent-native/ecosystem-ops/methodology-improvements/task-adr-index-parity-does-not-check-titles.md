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
