---
type: task
status: done
id: task-done-gate-refusal-rate-substrate
title: "Done-gate merge-time refusal rate is 16–18%, not 0: classify the substrate with the corrected measurement"
assignee: arggon-delivery-lead
branch: feat/task-done-gate-refusal-rate-substrate
parent: harness-research-transfer
labels: [methodology, telemetry]
created: "2026-10-13"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-done-gate-refusal-rate-substrate.md
  Leaves live only under a story. id is the filename stem: task-done-gate-refusal-rate-substrate.
  CLI `arggon create task done-gate-refusal-rate-substrate` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Done-gate merge-time refusal rate is 16–18%, not 0: classify the substrate with the corrected measurement

## Context

The sweep `task-sweep-auto-done-refusal-warnings` (PR #779, merged) refuted its parent's zero. The done-gate merge-time refusal rate is **16.0% (42 refusals / 262 kernel flip attempts)** in `task-measure-kernel-refusal-rate`'s own window (500 auto-done runs <= 2026-10-11) and **18.1% (52/288)** over the full 534-run window (<= 2026-10-13) — 52 events across 49 distinct items. The parent reported 0/220 because its pattern keyed on the literal `::warning::`, which never appears as executed output: the runner renders an executed warning as `##[warning]<msg>`. Both the raw logs and the check-run annotations APIs agree on the corrected counts (239 step-level warnings each, 0 runs disagreeing). Separately, 138-152 illegal `todo -> done` warn-and-skips never reach the kernel (the workflow checks `list` first) and are excluded from the rate. Refusals are ephemeral by design (the flip `fail()` returns no commit), so merge-time CI is the only surface. For scale: ADR 0025's static done-gate refusal figure is 117/482 (24.3%).

## Acceptance

- [x] the 52 refusal events are classified (top causes) with the corrected method, and the ephemeral design is accounted for in what can be measured
- [x] decide and record whether the substrate needs work (pre-check on the flip path, message quality, or the rate is acceptable noise) and link exploration-021
- [x] the measurement correction is captured where future sweeps find it (the `##[warning]` render vs the literal `::warning::` trap)
- [x] reconciled with ADR 0025's 117/482 if the two are the same population
- [x] `arggon validate` green; PR opened. Advisory unless a surface is added

## Notes

### 2026-10-13 @ses_ec8e84464ffeN0V05xDVKlh804
### 2026-10-13 — analysis: the 52 refusals classified; substrate decision recorded

**Method (corrected; two sources; exact trees).** Window re-derived from the Actions API: 534 `auto-done` runs <= 2026-10-13T14:16:37Z (543 exist now; the 9 later runs are excluded). Two independent reads of the one surface that records refusals: executed `##[warning]` lines in the raw logs — **52** — and check-run annotations (`actions/runs/{id}/jobs` -> `check-runs/{job_id}/annotations`) — **52**; per-run identical, 0 runs disagreeing. The workflow's warning text does not distinguish the gate's two reasons, so each event was classified by running the kernel's own `acceptanceGate` (`lib/dist/items.js`) over the item body at the exact tree the run checked out, read from the run's own `HEAD is now at <sha>` line (the flip step resets to `origin/main` first). Note: `git rev-list --before=<time>` mis-classified 3 events on the first pass — a flip commit's committer date can precede its arrival on `main` — the run-log sha is the only reliable source.

**Counts — 52 events / 49 items / 51 runs.**

| cause (gate reason under today's predicate) | events | items | pre-ADR-0025 | after |
| --- | --- | --- | --- | --- |
| `no-live-contract` — live contract never authored (exact `create` scaffold in all 26) | 26 | 25 | 21 | 5 |
| `unchecked-live-criteria` — authored, own boxes unticked at merge | 22 | 20 | 7 | 15 |
| would pass today's gate — pre-scoping whole-body scan | 4 | 4 | 4 | 0 |

- **Cause 1 (50%): no live contract.** All 26 carry the scaffold placeholder `<!-- The real acceptance criteria; tick each box when met. -->`; 8 of the 21 pre-ADR-0025 also carry the blank `- [ ]` row. The PR merged while the item had no contract at all. Examples: `task-exploration-decision-records` (run 36717332625, 2026-09-30; completed by hand ~11 min later) and `bug-done-gate-counts-checkboxes-inside-comment-blocks` (run 37467043887 — the ADR 0025 merge run itself, whose own live section was still the template).
- **Cause 2 (42%): authored but unticked.** 16 events have **every** row unticked (`task-implement-decision-brief-kernel`, run 37510422471, 11/11, recovered 20.4 h); 6 are partially ticked, and **5 of those miss exactly one row** (`bug-release-lockfile-sync-step-cannot-run`, runs 38292422503 + 38294417626, 1/6, refused twice 18 min apart, recovered 0.4 h). Two near-miss rows are *post-merge observations* ("Verified on a real `release-please.yml` run after the fix lands"; "Live surface (needs the install + one restart)") and one is explicitly "not mine to make" — structurally unticked at merge; their remedy is contract phrasing or the waiver, not hygiene.
- **Cause 3 (8%): pre-ADR-0025 whole-body scan.** Live section complete and fully ticked; the old gate counted unticked boxes in dated comment blocks (`task-tui-filter-language`, run 36783495530: live 4/4 ticked, a 2026-09-22 comment quoting all four unticked) and in rejected-alternative rows (`bug-harness-config-churn`). All 4 on 2026-09-30 -> 10-02; **zero after ADR 0025** — the scoped gate's new warning text appears first in run 37467043887 (the ADR 0025 merge run).

**Recovery.** All 49 items are `done` today. Refusal -> first `main` commit with `status: done`: median **0.18 h**, mean 4.0 h; 39 <= 1 h, 45 <= 6 h, **48/49 <= 24 h**; one outlier 5.9 d (`bug-convention-md-links-nonexistent-adr-0015`). Commit-date based, so the fastest bucket includes same-merge-wave flips.

**Decision: the substrate needs no work; the rate is the gate's designed tolerance, and the levers are authoring-side and already tracked.** Against the three options:

- *pre-check on the flip path* — no: the kernel already is the check, and the cause is upstream of the flip (contract never authored or never completed before merge). A CI pre-check cannot see more than the update call does.
- *message quality* — adequate: it names the live section and both remedies, and every refusal was acted on within 24 h. Optional gaps for the lead (not needed for correctness): the annotation does not carry the kernel's reason/rows (so CI alone cannot distinguish the two causes — this analysis had to reconstruct), the envelope is not logged for expected refusals, and 3 items were refused twice.
- *acceptable noise* — yes: 26/52 are "no contract authored at merge", whose remedy is the already-filed `task-create-needs-a-body-flag-to-author-a-live-contract`; the never-authored population is `task-migrate-7-leaves-with-no-live-acceptance-contract`; containers stay `task-cascade-whole-body-acceptance-defers-this-defect`. Filing anything new is the lead's call; I recommend none.

**Reconciliation with ADR 0025's 117/482.** **Not the same population**: 117/482 is a static leaf count at 2026-10-06 (would-refuse-if-consulted, including `done` leaves), not an event rate; 52/288 counts merge-time attempts over 4.6 weeks (a repeated attempt counts twice — `task-wire-role-model-carriers`, `task-zcode-live-verification` and `bug-release-lockfile-sync-step-cannot-run` each appear twice). The mechanisms map 1:1 against ADR 0025's corrected 5/56/56 split: the 4 scoping-artifact events <-> the 5 unblocked leaves; the 21 pre-ADR-0025 no-contract events <-> the 56 relabeled; the 7 old + 15 new unticked events <-> the 56 unchanged. Both say the gate has teeth when consulted; neither derives from the other.

**Where the correction lives.** `ArggonManager/docs/labs/telemetry-mining.md` gained a `## CI workflow logs` source section — the `##[warning]` render vs the literal `::warning::` trap, the annotations path, the coverage-retry trap, the `HEAD is now at` reconstruction rule, and the first-pass result + this decision. Carrier choice: the mining protocol is where a future CI-log sweep starts; exploration-021 already carries the refutation's numbers and mechanism, so the trap would be buried in an exploration about papers. Question context: [exploration-021](../../../docs/explorations/exploration-harness-research-transfer-021.md) (Recommendation item 4 / the 2026-10-13 correction note).

**Limits / what the data cannot show.** Refusals are ephemeral by design (`fail()` returns an envelope with no commit), so only attempts routed through `auto-done` are observable; local CLI attempts, direct edits and manual flips leave no trace, and the true illegal-attempt rate outside CI is unmeasurable — the CI slice can only understate it. The 152 `todo -> done` warn-and-skips never reach the kernel (excluded). Reason classification reconstructs the gate's input at the run's reset sha; a concurrent write between reset and refusal is theoretically invisible; 0 `unexpected` update failures in-window left no third cause. Post-cutoff, 2 further refusals (`task-sweep-auto-done-refusal-warnings` 15:15Z, `bug-kernel-pin-never-exact` 17:16Z) are both all-rows-unticked — the pattern continues and is not included in the 52.

Gates: `npm run arggon -- validate` -> ok (0 warnings, convention v5); `npx prettier --check` on the touched doc -> clean. `npm test` not run and not required: docs/analysis-only, no code surface. Acceptance rows evidenced above; left unticked — merge/done are the lead's.

### handoff 2026-10-13 @ses_ec8e84464ffeN0V05xDVKlh804 (session: ses_ec8e84464ffeN0V05xDVKlh804) — next: Lead: review PR #797 + the item comment (classification + decision); tick the 5 Acceptance rows; merge. No gate/substrate change recommended; done flip stays the lead's.
- branch: feat/task-done-gate-refusal-rate-substrate
- open questions: Optional follow-up: annotate the kernel's refusal reason/rows (CI can't distinguish the two causes). 2 post-cutoff refusals excluded from the 52. Filing new items is the lead's call.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as c6475d0c (PR #797); flipped by the lead (rows verified and ticked). The 52 refusals are classified with the corrected method: 26 (50%) no live contract authored (all 26 still the exact `create` scaffold), 22 (42%) authored but unticked at merge, 4 (8%) pre-scoping (09-30→10-02); per-run log and annotation sources agree, 0 disagreements. Decision recorded: no gate or substrate change — the refusals are the gate tolerating an incomplete contract exactly as ADR 0015/0025 designed; the levers are authoring-side and already tracked. Measurement correction captured in `docs/labs/telemetry-mining.md` (the `##[warning]` vs `::warning::` trap, annotation path, sha-reconstruction rule). ADR 0025's 117/482 confirmed a different population, mechanism-mapped to its corrected 5/56/56 split. All 49 items are done today; median refusal→recovery 0.18 h.
