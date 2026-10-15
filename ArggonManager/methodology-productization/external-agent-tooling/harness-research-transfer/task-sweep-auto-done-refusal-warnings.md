---
type: task
status: done
id: task-sweep-auto-done-refusal-warnings
title: Sweep auto-done logs for merge-time done-gate refusal rate
assignee: arggon-delivery-lead
branch: feat/task-sweep-auto-done-refusal-warnings
parent: harness-research-transfer
labels: []
created: "2026-10-11"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-sweep-auto-done-refusal-warnings.md
  Leaves live only under a story. id is the filename stem: task-sweep-auto-done-refusal-warnings.
  CLI `arggon create task sweep-auto-done-refusal-warnings` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Sweep auto-done logs for merge-time done-gate refusal rate

## Context

Follow-up proposed as text in `task-measure-kernel-refusal-rate` (PR #726), which found 0 recorded kernel refusals per 1,224 lifecycle transitions over 2026-08-16→2026-10-11 and closed AutoHarness's thesis as unmeasurable-and-observably-zero — except for the one rule with an event-level source: `.github/workflows/auto-done.yml` emits `::warning::` for done-gate refusals, unexpected update failures, and illegal `todo`/`blocked → done` flips at merge time. The 497-run read (2026-09-11→2026-10-11) did not finish in-session (spot sample 0/19); pattern set and per-run command lineage live in that session's `/tmp/opencode/autodone-runs.txt` (ephemeral — reconstruct with `gh run list --workflow auto-done.yml` + `gh run view <id> --log`).

## Acceptance

- [x] Sweeps the 497 auto-done run logs for executed `::warning::` refusal / illegal-transition lines (bounded read of an existing source, ~15 min, no new surface)
- [x] Reports the done-gate merge-time refusal rate with flip attempts as denominator, with the same honest limits as the parent item
- [x] If that rate is also ~0, links the parent report from exploration-021's Recommendation and closes the AutoHarness question for this repo; if high, files the substrate follow-up (do not scope it here)
- [x] `arggon validate` green; PR opened. Advisory unless a surface is added

## Notes

### 2026-10-13 @ses_eca4ef96effeP7GhkMP8PrO6xn
### 2026-10-13 @ses_eca4ef96effeP7GhkMP8PrO6xn — sweep result: the parent's zero is REFUTED

**Verdict: the done-gate merge-time refusal rate is not ~0. In the parent's own window it is 42 refusals / 262 kernel flip attempts = 16.0% (reported: 0/220).** Full window 52/288 = 18.1%.

#### Method (both directions, bounded read of an existing source)

- Enumerate runs: `gh api --paginate "repos/Arggon/ArggonManager/actions/workflows/auto-done.yml/runs?per_page=100"` → **534 runs**, 2026-09-11T18:53Z → 2026-10-13T14:16Z (522 success / 7 skipped / 5 failure).
- Raw logs, the source the item names: `gh run view -R Arggon/ArggonManager <id> --log` → **534/534 logs downloaded**.
- Second, independent source: the check-run annotations API per run job (`GET /repos/.../check-runs/<job>/annotations`) → **534/534**. Executed workflow commands become annotations, so this reads the same events through a different pipeline.
- **Cross-check: annotations vs raw logs agree exactly — 239 step-level warnings each, 0 runs disagreeing.**

Executed-line classification: the runner renders an executed `::warning::` command as `##[warning]<msg>` in the raw log. The workflow's own script echo keeps the literal `echo "::warning::…"` but is ANSI-colored inside the `##[group]Run …` block, so requiring the payload to start with `##[warning]` excludes every echo, comment and heredoc. (`grep -c 'flip refused by the done gate'` over the 534 logs returns 504 lines: **52 executed, 452 script echoes**.)

#### Counts (executed lines only)

| bucket | parent window (500 runs ≤ 2026-10-11) | full window (534 runs ≤ 2026-10-13) |
| --- | --- | --- |
| done-gate refusals (`flip refused by the done gate`) | **42** | **52** |
| success flips (`in_progress -> done`) | 220 (+2 redo) | 234 (+2 redo) |
| illegal `todo → done` warn-and-skips (`is todo: … not a legal v0 transition`) | 138 | 152 |
| unexpected update failures | 0 | 0 |
| `skip <id>: not found in the tracker` | 100 | 103 |
| `could not self-merge … after 3 attempts` | 29 | 29 |
| redo status-not-flipped | 5 | 5 |
| runs with no flips to commit | 281 | 299 |

Denominator = **kernel flip attempts** = success flips + gate refusals + unexpected failures (an attempt is a call to `update <id> --status done` on an `in_progress` id; the redo path can re-attempt the same id, so events and distinct items differ — 52 events over **49 distinct items**, 51 runs). Refusal rate: **42/262 = 16.0%** (parent window), **52/288 = 18.1%** (full). Post-2026-10-11 only: 10/26 = 38.5%.

The parent's `220` success flips reproduces exactly; every warning bucket does not. Its "5 merge-time skips" equals my `redo status-not-flipped` bucket (5) alone — the main-loop buckets were not detected.

#### Root cause of the reported zero (demonstrable, not inferred)

The literal `::warning::` occurs **3,369 times** across these same logs and **never as executed output** — always as script echo/comment text. A pattern keyed on `::warning::` therefore cannot match an executed warning, and a `$variable` echo-filter (the parent's stated exclusion) removes the only lines that would match it. I could not recover the parent session's exact pipeline, so I state the mechanism I can reproduce rather than the pipeline I cannot.

#### Semantic verification (a refused flip must not have flipped)

Sampled: `task-exploration-decision-records` refused in run 36717332625 (2026-09-30T12:49:51Z, PR "exploration-decision-records-cleanup"; confirmed by the annotations API independently). Git history: `e3218b3a drop empty template checkbox blocking the done gate` → `5a9763ef chore(tasks): done task-exploration-decision-records` at 13:00Z — a human completed the contract and marked it done manually ~11 min later; the auto-done run never flipped it.

#### Limits (same honesty as the parent)

- Only merge-time flips routed through CI are counted. Refusals are ephemeral by design (`fail()` returns an envelope with no commit), so a refusal attempted anywhere else — local CLI, direct edit — is invisible. Zero-by-construction of the old number does not mean the true attempt rate is exactly this.
- Window is the workflow's whole life (2026-09-11 → 2026-10-13, ~4.6 weeks), not the parent's 8 weeks.
- The 152 illegal `todo → done` events **never reach the kernel**: the workflow checks `list` first and warns-and-skips, so they are client-side merge hygiene, NOT refusals. They are reported separately and are excluded from the rate's numerator and denominator.
- Detection depends on the workflow's own annotation coverage (classifier `cli/auto-done-refusal.mjs`, unit-tested); a refusal the workflow did not annotate would be invisible. Both sources read the same annotations, so they are independent pipelines over one coverage surface, not two coverage surfaces.
- 26 `##[error]` runner lines (6 in the 5 failed runs, 20 inside green runs — vitest `AssertionError` output) are counted but not classified: out of scope here.
- Interpretation: a refused flip means a merged PR whose item's live `## Acceptance` was not a complete contract. The workflow tolerates it (warning, run stays green), so the item stays `in_progress` until completed by hand. Magnitude is consistent with ADR 0025's static 117/482 (24.3%) whole-tree estimate.

#### Deliverable / lead call

- Acceptance row 3 resolves to the **high** branch, not the ~0 branch: P1's thesis has a target here, so the AutoHarness question must **not** be closed. Filing the substrate follow-up is a lead call — as a maker I do not file tracker items.
- The exploration edit landed anyway, as a correction rather than a closure: exploration-021's 2026-10-11 closure note asserted "0 recorded kernel refusals" and pinned this item; the note now carries the corrected numbers, the refutation mechanism and the explicit "not closed" verdict. Docs-only change, commit 63752cc1.
- `task-measure-kernel-refusal-rate` (done, PR #726) carries the refuted 0/220 in its report and its one-line verdict; correcting a `done` item is outside maker scope — flagged for the lead.

Gates: `npm run arggon -- validate` → ok (0 warnings, convention v5); `npx prettier --check` on the touched file → clean. `npm test` not run and not required: this is a docs/analysis-only change with no code surface (the sweep scripts live in `/tmp/opencode/sweep`, deliberately not committed).

### handoff 2026-10-13 @ses_eca4ef96effeP7GhkMP8PrO6xn (session: ses_eca4ef96effeP7GhkMP8PrO6xn) — next: Lead: verify PR #779 (docs correction) + evidence comment, file the substrate follow-up, decide correcting done item task-measure-kernel-refusal-rate, tick Acceptance
- branch: feat/task-sweep-auto-done-refusal-warnings
- open questions: Parent's 0/220 is refuted (16.0%/18.1%) so AutoHarness is not closed; follow-up item unfiled (maker boundary); is 16-18% high enough to reclassify P1 per exploration-021 item 4?

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as 97a8ffcb (PR #779); flipped manually — the maker left the rows unticked, and the lead ticked them after filing the substrate follow-up the item's own row 3 required (task-done-gate-refusal-rate-substrate).
The sweep refuted its parent: the done-gate merge-time refusal rate is **16.0% (42/262)** in the parent's window and **18.1% (52/288)** full-window — the parent's 0 was a pattern artifact (literal `::warning::` vs the executed `##[warning]` render); raw logs and check-run annotations agree exactly (239 step-level warnings each). exploration-021's closure note corrected to "not closed"; refutation recorded on the done parent item.
