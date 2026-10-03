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

## Notes
