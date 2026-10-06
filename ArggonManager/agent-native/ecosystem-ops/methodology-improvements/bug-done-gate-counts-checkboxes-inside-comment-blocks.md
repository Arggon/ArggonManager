---
type: bug
status: in_progress
id: bug-done-gate-counts-checkboxes-inside-comment-blocks
title: "The done gate counts `- [ ]` anywhere in an item body, so a reporter comment that quotes its acceptance verbatim makes the item impossible to complete"
assignee: arggon-delivery-lead
branch: fix/bug-done-gate-counts-checkboxes-inside-comment-blocks
parent: methodology-improvements
labels: [done-gate, tracker-schema, tests]
created: "2026-10-05"
updated: "2026-10-06"
claimed_at: "2026-10-06T11:00:45.778Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-done-gate-counts-checkboxes-inside-comment-blocks
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-done-gate-counts-checkboxes-inside-comment-blocks.md
  Leaves live only under a story. id is the filename stem: bug-done-gate-counts-checkboxes-inside-comment-blocks.
  CLI `arggon create bug done-gate-counts-checkboxes-inside-comment-blocks` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The done gate counts `- [ ]` anywhere in an item body, so a reporter comment that quotes its acceptance verbatim makes the item impossible to complete

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @arggon-maker
## Gate evidence — the live `## Acceptance` section, and the no-contract refusal

**Rule implemented for "no live criteria" (the decision the brief left open): zero criteria in the live section, and nothing else.** Not "absent", not "empty after trim", not "template-placeholder" as three separate checks — one predicate, `liveAcceptanceCriteria(liveSection).length === 0`, so absent / empty / whitespace-only / `<!-- … -->` placeholder / bare-`- [ ]`-only all reduce to the same refusal. It is the only reading that cannot be satisfied by accident: each of the three plausible definitions has a fourth spelling beside it (a renamed `## Acceptance mapping`; a section holding only `\u00a0`; a section holding only bare boxes), and any of them becomes a free pass. Two further reasons it is the right one, both measured on this tree: a fresh `arggon create` scaffold (the placeholder comment) would otherwise be the *default* flippable item, and 40 open items in this tracker have their real criteria ticked in dated comments — exactly the vacuous-success shape.

**Why "the live body is the contract" rather than "the newest comment is the contract":** there is no timestamp a body carries that distinguishes a comment recording a *past* obligation from one reporting a *new* one. `### <date> @author` is append-only history by format, so the block is history; a comment-supplied `## Acceptance` cannot stand in for a missing live section (tested).

**Where the scan changed:** `lib/src/items.ts` gained `liveAcceptanceRegion` / `liveAcceptanceRows` / `liveAcceptanceCriteria` / `liveAcceptanceUnchecked` / `acceptanceGate` beside `acceptanceRows` (comment blocks stripped BEFORE the section is located, so a `## Acceptance` pasted inside a comment cannot become the contract). `lib/src/update.ts` (the `→ done` rule) consults `acceptanceGate`; `lib/src/import-issues.ts` asks the same predicate before offering its waiver. `acceptanceRows`/`acceptanceCriteria`/`acceptanceComplete` keep their whole-body meaning for the acceptance-aware container cascade and for renderers, so history stays visible. The verdict consumers were re-pointed so none can contradict the gate: the board drawer's `acceptance_complete` and the ZCode goal contract's `gateUnchecked` (+ its criteria rows, and a separate rendered contract for the no-contract case, because "nothing left to loop on" means opposite things for a satisfied contract and a missing one). Containers stay exempt.

### Per-test expected → observed, with mutation counts

Four mutations of `lib/src/items.ts`, each rebuilt with the FULL `npm run build` and run over `done-gate` + `goal-mode` + `acceptance-parity` (347 tests in those three files):

| mutation | failing / total | defect | control | trap | no-criteria shapes | bare-box | comment-filed | nested `###` | live fuzz |
|---|---|---|---|---|---|---|---|---|---|
| baseline (unmutated) | 0 / 347 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **M1** pre-fix gate (whole body) | **237** / 347 | **FAIL** | PASS | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |
| **M2** naive scoping (no no-live-contract half) | **235** / 347 | PASS | PASS | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |
| **M3** bare `- [ ]` counted as a criterion | **33** / 347 | PASS | PASS | PASS | **FAIL** | **FAIL** | PASS | PASS | **FAIL** |
| **M4** comment blocks not excluded | **9** / 347 | **FAIL** | PASS | **FAIL** | PASS | PASS | PASS | **FAIL** | **FAIL** |

Reading of that table, since "a test that passes with and without the fix is not evidence": the **defect** test fails only under M1 and M4 (the two mutations that restore whole-body reading); the **trap** test fails under M1, M2 and M4 — M2 is the naive-scoping false pass this fix exists to prevent; the **negative control** (unticked box in the LIVE section, all comment boxes ticked) passes under EVERY mutation, which is correct: it does not depend on the scoping decision, so it is the control, not evidence. The bare-box carve-out is pinned by M3 alone. The new `acceptance-parity` fuzz compares `acceptanceGate` against an independently written oracle over 40 000 generated bodies (901 allowed / 36 367 no-live-contract / 2 732 unchecked-live-criteria, non-vacuity asserted in all three directions) and it caught a real disagreement while being written — the ORDER of "strip comments, then find the section" — which is now pinned on both sides. The board-drawer test fails under M2 as well (checked separately: 1 / 100).

Expected → observed for the five required cases (all end-to-end through `runUpdate` on a real tracker): ticked live acceptance + unticked dated-comment boxes → pre-fix refusal, **post-flip succeeds**, no waiver recorded, comment block byte-unchanged; unticked box in the live section + fully ticked comment → **still refused** with `…live '## Acceptance' section still has unchecked boxes…`, and the same item flips the moment that one box is ticked; template placeholder + all comment boxes ticked → **still refused** with `…has no acceptance criteria…` (this is the trap); bare `- [ ]` → never in `liveAcceptanceUnchecked`, a section of bare boxes refused as `no-live-contract` and never as an unfinished box, and bare box + ticked criterion flips; negative controls: the live unticked box is caught with the comment record disagreeing, and the section ends at the next `#`/`##` heading (a criterion under `## Notes` prose is not in the contract). CRLF and U+2028/U+2029 bodies are asserted to read like LF.

### Gates (all run in this worktree)

| gate | expected | observed |
|---|---|---|
| `npm run build` (full) | exit 0 | exit 0, `build:plugin` 42 modules / 476 897 bytes |
| `npm run test` | pass | **131 files / 2784 tests passed**, exit 0 |
| `npm run arggon -- validate` | ok | `arggon validate: ok (0 warning(s), convention v5)`, exit 0 |
| `npm run check:plugin` | bundle in sync | exit 0 after the bundle was committed (it exits 1 while the regenerated bundle is uncommitted — that is the gate working) |
| `npm run lint` | clean | exit 0 |
| `npm run skills:sync` | skill copies byte-equal | 7 files synced; no drift |

**Blast radius, measured over the 482 claimable leaves:** pre-fix 117 refused → 5 unblocked (`bug-validate-does-not-check-frontmatter-present`, `bug-engineering-doc-stale-adr-statuses`, plus `bug-harness-config-churn`, `task-done-gate-acceptance-waiver` already `done`, and `bug-seam-drift-gate-blocks-new-generated-seam-content` `todo`) and 189 refused: 133 new `no-live-contract` (47 open, 40 of them the vacuous-success shape) + 56 `unchecked-live-criteria` (29 open). **The cost is real and is the lead's call:** acceptance criteria must now be authored into the live `## Acceptance` section, and `arggon create` still has no `--body` flag, so the first write is a hand-edit of the item file. 121 tests across 17 suites flipped red under the new half; they are arranged through the shared helper `test/acceptance.ts` (`satisfyAcceptance` / `satisfyAllAcceptance`, renamed from `tickAcceptance` because it now also PUBLISHES a live criterion when the section has none) plus three fixtures that needed the arrange call. That churn is the change's honest cost, not a side effect: every done-flip test in the tree now carries an acceptance contract.

**Both blocked items are honest.** `bug-validate-does-not-check-frontmatter-present` (5 ticked live criteria, evidence in a 2026-10-03 block) and `bug-engineering-doc-stale-adr-statuses` (4 ticked, the spec/plan-009 case explicitly decided and recorded) each read `acceptanceGate → { gated: false }` now. I did not flip either status, and did not touch their dated blocks. Note for the lead: **this item's own live `## Acceptance` section is still the template placeholder**, so it is refused as `no-live-contract` until the criteria are transcribed — I did not tick or transcribe any box, per instructions.

### handoff 2026-10-06 @arggon-maker — next: Lead: review + merge; decide whether to accept the no-live-contract half's friction (create --body as follow-up)
- branch: fix/bug-done-gate-counts-checkboxes-inside-comment-blocks
- open questions: Author criteria in the live section now required (create has no --body); container cascade deliberately left whole-body
