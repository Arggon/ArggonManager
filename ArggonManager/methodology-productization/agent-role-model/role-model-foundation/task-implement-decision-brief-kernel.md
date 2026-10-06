---
type: task
status: in_progress
id: task-implement-decision-brief-kernel
title: "Implement the decision-brief kernel per spec-owner-decision-brief-021 AC 1-8: `lib/src/brief.ts`, the additive `show --json` field, the opt-in UNANSWERED-DECISION-BRIEF finding, and their tests"
assignee: arggon-delivery-lead
branch: feat/task-implement-decision-brief-kernel
parent: role-model-foundation
labels: [cli, native-seam, json-contract]
priority: p0
created: "2026-10-06"
updated: "2026-10-06"
claimed_at: "2026-10-06T16:37:07.521Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-implement-decision-brief-kernel
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-implement-decision-brief-kernel.md
  Leaves live only under a story. id is the filename stem: task-implement-decision-brief-kernel.
  CLI `arggon create task implement-decision-brief-kernel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Implement the decision-brief kernel per spec-owner-decision-brief-021 AC 1-8: `lib/src/brief.ts`, the additive `show --json` field, the opt-in UNANSWERED-DECISION-BRIEF finding, and their tests

## Context

The **implementation half** of [spec-owner-decision-brief-021](../../docs/specs/spec-owner-decision-brief-021.md) — its AC 1–8. Split out of `task-wire-decision-brief-carriers`, which was filed as one item carrying both the kernel feature and the carrier prose; those are different risks, different verification, and different file sets, so they are now two items in the same wave rather than one oversized one.

[ADR 0026](../../docs/adr/0026-owner-decision-brief.md) is Accepted (PR #659) and the spec merged (PR #660). The ADR 0017 hard gate is clear: `spec analyze` reports 10 findings on `main` and 10 with the spec added, identical kinds, none in the spec.

**This is the first real code in the chain.** Everything before it was a record. A maker implementing from the spec must not re-decide any part of ADR 0026 — if something needs a decision the spec did not make, that is a finding against the ADR (§6), not a call to take at the keyboard.

**Two traps worth naming before the work starts:**

1. **The finding's scope is deliberately wider than the detector it mirrors**, and copying the sibling's shape would silently break it. `MISSING-PRODUCT-ACCEPTANCE` is `story`-container-only and terminal-only (`lib/src/acceptance.ts:184`, `:212`) because an acceptance is due _at closure_. `UNANSWERED-DECISION-BRIEF` must fire on **any item type, any status, while the state is `open`** — a brief is owed while the decision is open, and narrowing it by analogy would silence the one case it exists for (a brief sent and never answered, and nobody notices). The spec states this in two places; do not let the mirror win.
2. **`self-decided` needs data that does not exist yet.** The answer's **author** is not captured today (`lib/src/verdict.ts:23–31` has `date/order/value/scope` and no author — `lib/src/acceptance.ts:60–65` records the same gap for `accept:`). The classifier must also receive the item's current `assignee` as a second argument, as `classifyAcceptance(body, assignee)` already does, because `self-decided` is defined against the item's **own assignee**.

## Acceptance

<!-- The live contract (ADR 0025): the done gate reads THIS section, not the dated comment blocks below. -->

- [ ] **AC 1 — parser.** `lib/src/brief.ts` parses a brief and its answer with the grammar spec §The record fixes: heading `### <YYYY-MM-DD> @<author>` (a handoff heading never matches), first header-looking line per comment only, `decide:` and `decided:` bounded so `decides:` never matches, append-order tiebreak, and a later `decided:` supersedes an earlier one; a superseded brief is never rewritten
- [ ] **AC 2 — attribution.** The parsed answer carries the comment's **author** (new data relative to the verdict parser) and the classifier takes the item's current `assignee`, so `self-decided` is computable
- [ ] **AC 3 — `show`.** Additive `decision_brief` (`none｜open｜decided｜self-decided`) on the item's own classification, read from the item's canonical body, bounded like its neighbours (ADR 0006) and additive within `schemaVersion` 1. The **human** `arggon show` view gains no field line — the brief is already visible as the item's own comment text
- [ ] **AC 4 — the finding.** `UNANSWERED-DECISION-BRIEF` per spec §The finding: fires only when armed **and** the state is `open`; **any item type, any status**; deterministic message (no clock, no counts) so a committed baseline fingerprints stably; `file` is the item's own path, so no `line`
- [ ] **AC 5 — opt-in, no new key.** Reuses the **existing** `x-tracker.product-acceptance` arming. Absent/`false` ⇒ no finding, while `show`'s field still reports **all four** states unconditionally. An unparseable `.convention.yml` reads as UNARMED, never an analyze failure
- [ ] **AC 6 — never a gate.** No transition consults the state, no command refuses because of it, CI never fails on it, no new status/timer/blocked state. **Asserted by a test** that the done gate and the cascade are untouched — not by prose
- [ ] **AC 7 — one logic path.** The classification is computed **once** in the kernel and read by every surface; no second parser in the CLI or the seam
- [ ] **AC 8 — idempotence and forward-only.** Re-running any surface never mutates an item body; nothing backfills historical items
- [ ] **Tests travel with the change:** parsing, supersede-by-later-`decided:`, `decided: other` as a first-class reply, the routing-rule boundary (a one-option question is not a brief), the four states, the opt-in arming, and the scope width in AC 4 (a leaf and a non-terminal item both fire)
- [ ] **`docs/json-output.md`** documents the new `decision_brief` field and the new finding kind in the same PR; `arggon validate`, `spec validate`, `spec analyze` (still 10, none new), `prettier`, `test`, `test:structure`, `lint:structure` all green
- [ ] **The registry is correct after the change.** The spec's `brief.ts` is a **new module**: confirm nothing in the capability matrix or the package `files` list needs a row, and if something does, update it in this PR rather than leaving a silent gap

## Notes
