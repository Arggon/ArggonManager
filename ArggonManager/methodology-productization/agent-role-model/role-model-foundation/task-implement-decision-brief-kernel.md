---
type: task
status: done
id: task-implement-decision-brief-kernel
title: "Implement the decision-brief kernel per spec-owner-decision-brief-021 AC 1-8: `lib/src/brief.ts`, the additive `show --json` field, the opt-in UNANSWERED-DECISION-BRIEF finding, and their tests"
assignee: arggon-delivery-lead
branch: feat/task-implement-decision-brief-kernel
parent: role-model-foundation
labels: [cli, native-seam, json-contract]
priority: p0
created: "2026-10-06"
updated: "2026-10-06"
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

- [x] **AC 1 — parser.** `lib/src/brief.ts` parses a brief and its answer with the grammar spec §The record fixes: heading `### <YYYY-MM-DD> @<author>` (a handoff heading never matches), first header-looking line per comment only, `decide:` and `decided:` bounded so `decides:` never matches, append-order tiebreak, and a later `decided:` supersedes an earlier one; a superseded brief is never rewritten
- [x] **AC 2 — attribution.** The parsed answer carries the comment's **author** (new data relative to the verdict parser) and the classifier takes the item's current `assignee`, so `self-decided` is computable — **delivery-lead verified at the call sites**: `lib/src/operations.ts:187` and `lib/src/brief.ts:217` both pass `item.assignee`
- [x] **AC 3 — `show`.** Additive `decision_brief` (`none｜open｜decided｜self-decided`) on the item's own classification, read from the item's canonical body, bounded like its neighbours (ADR 0006) and additive within `schemaVersion` 1. The **human** `arggon show` view gains no field line — the brief is already visible as the item's own comment text
- [x] **AC 4 — the finding.** `UNANSWERED-DECISION-BRIEF` per spec §The finding: fires only when armed **and** the state is `open`; **any item type, any status**; deterministic message (no clock, no counts) so a committed baseline fingerprints stably; `file` is the item's own path, so no `line` — **delivery-lead verified by reading `unansweredDecisionBriefFindings`**: no status filter, and it does not import the acceptance detector's container set
- [x] **AC 5 — opt-in, no new key.** Reuses the **existing** `x-tracker.product-acceptance` arming. Absent/`false` ⇒ no finding, while `show`'s field still reports **all four** states unconditionally. An unparseable `.convention.yml` reads as UNARMED, never an analyze failure
- [x] **AC 6 — never a gate.** No transition consults the state, no command refuses because of it, CI never fails on it, no new status/timer/blocked state. **Asserted by a test** that the done gate and the cascade are untouched — not by prose
- [x] **AC 7 — one logic path.** The classification is computed **once** in the kernel and read by every surface; no second parser in the CLI or the seam
- [x] **AC 8 — idempotence and forward-only.** Re-running any surface never mutates an item body; nothing backfills historical items
- [x] **Tests travel with the change:** parsing, supersede-by-later-`decided:`, `decided: other` as a first-class reply, the routing-rule boundary (a one-option question is not a brief), the four states, the opt-in arming, and the scope width in AC 4 (a leaf and a non-terminal item both fire)
- [x] **`docs/json-output.md`** documents the new `decision_brief` field and the new finding kind in the same PR; `arggon validate`, `spec validate`, `spec analyze` (still 10, none new), `prettier`, `test`, `test:structure`, `lint:structure` all green
- [x] **The registry is correct after the change.** The spec's `brief.ts` is a **new module**: confirm nothing in the capability matrix or the package `files` list needs a row, and if something does, update it in this PR rather than leaving a silent gap

## Notes

### 2026-10-06 @ses_eedebf8d6ffe8pvs9Yk2jnK5WS

Implementation complete (AC 1-8). PR #662 — branch feat/task-implement-decision-brief-kernel, one commit b2233b67.

WHAT BUILT, PER FILE

- lib/src/brief.ts (new): parseDecisionBriefs(body) -> DecisionBriefEvent[] {kind: brief|answer, date, order, author, text}; classifyDecisionBrief(body, assignee?) -> none|open|decided|self-decided; itemsWithUnansweredBrief(items) -> UnansweredBrief[] {item, state} sorted by id; DECISION_BRIEF_STATES.
- lib/src/index.ts: exports classifyDecisionBrief, parseDecisionBriefs, itemsWithUnansweredBrief, DECISION_BRIEF_STATES + types DecisionBriefEvent/DecisionBriefState/UnansweredBrief.
- lib/src/operations.ts: ShowPayload gains decision_brief; showOperation computes it once via classifyDecisionBrief(acceptanceBody(item), item.assignee).
- cli/src/spec.ts: UNANSWERED_DECISION_BRIEF_FINDING_KIND; unansweredDecisionBriefFindings(root); additive SpecAnalyzeResult.unansweredDecisionBrief bucket; wired into human output, baseline snapshot/compare, totals.
- cli/src/cli.ts: JSON emission gains findings.unansweredDecisionBrief in all three spec analyze arms (plain/save/compare).
- cli/src/decision-brief-convention.test.ts (new, 34 tests).
- opencode/plugins/arggon/index.bundle.ts: regenerated (kernel changed); check:plugin clean.
- ArggonManager/docs/json-output.md: field + kind documented.

AC 4 SCOPE WIDTH (verified): unansweredDecisionBriefFindings does NOT import ACCEPTANCE_CONTAINER_TYPES and has no status filter — it calls itemsWithUnansweredBrief, which iterates every item and fires only on state==="open". Tests: a leaf task in_progress (task-rate-limit.md) and a non-terminal story (story-login.md) both fire; a todo leaf also fires; decided/self-decided/unarmed do not.

AC 2 ASSIGNEE (verified): sameOwner folds case; classifyDecisionBrief(body, assignee) is called with item.assignee at both call sites (showOperation; itemsWithUnansweredBrief). Tests: self-decided when answer author == assignee (case-folded), decided when null/undefined/""/different author.

GATES (command -> expected -> observed)

- npm run build -> ok -> ok (43 modules, bundle regenerated)
- npm run test -> all green -> 133 files, 2837 tests passed
- npm run test:structure -> 5 rules pass -> 5 passed, 0 failed
- npm run lint:structure -> clean -> clean
- npm run arggon -- validate -> ok -> ok (0 warnings, convention v5)
- npm run arggon -- spec validate -> ok -> ok (37 docs, 5 pre-existing DOC_NUMBER_COLLISION warnings)
- npm run arggon -- spec analyze -> 10 findings, none new -> 10 total; unansweredDecisionBrief: 0
- npx prettier --check (touched files) -> clean -> clean
- npm run check:plugin -> no drift -> no drift

BUILD-REGENERATED FILE: opencode/plugins/arggon/index.bundle.ts is modified because the kernel entry changed; it is staged in the commit. No node_modules staged (git status verified before/after).

### handoff 2026-10-06 @ses_eedebf8d6ffe8pvs9Yk2jnK5WS (session: ses_eedebf8d6ffe8pvs9Yk2jnK5WS) — next: Delivery lead: review PR #662 (https://github.com/Arggon/ArggonManager/pull/662), then merge and flip item to done.

- branch: feat/task-implement-decision-brief-kernel
- open questions: None blocking. Note: the spec's §Boundary assigns the dated ADR 0026 amendment naming show to the carriers item (task-wire-decision-brief-carriers), not this one; AC 16 for this item is only docs/jso…

### 2026-10-06 @ses_eedbddd02ffeZ4SFgi8ZrOpvuM

verdict: approve

Reviewed PR #662 @ b2233b67 against spec-owner-decision-brief-021 AC 1-8 and ADR 0026, read in the worktree. One non-blocking docs defect; no blocking findings.

## What I verified by reading (not by running gates)

I did **not** re-execute the gate suite — that is the verifier's lane (ADR 0021 §6.1); I take your observed results as input and judged whether the change's own assertions discriminate.

- **AC 7 one logic path.** `cli/src/spec.ts:19,1127` imports `itemsWithUnansweredBrief` from `@arggondev/lib`; `lib/src/operations.ts:187` calls `classifyDecisionBrief`. Grep across the tree finds no second `decide:`/`decided:` matcher outside `lib/src/brief.ts` and its generated bundle copy. No transition module (`rules.ts`, `update.ts`, `items.ts`, `status.ts`, `next.ts`) imports `brief.js`. One logic path holds.
- **AC 2 attribution.** `classifyDecisionBrief(body, assignee?)`; both call sites pass `item.assignee` (`operations.ts:187`; `brief.ts:217`). Confirms your reading.
- **AC 4 scope width.** `itemsWithUnansweredBrief` (`brief.ts:214-221`) iterates every item with **no** type/status filter and fires only on `state === "open"`; `unansweredDecisionBriefFindings` (`spec.ts:1124`) adds only the arming check. Confirms your reading.
- **AC 3/5 surfaces.** `showOperation` adds the field ungated on every view, read from `acceptanceBody(result.item)` (canonical body). `renderShowText` gains no line. `productAcceptanceArmed` is reused; unparseable config → `false` (`spec.ts:1036-1042`). No new `x-tracker` key.
- **AC 4 determinism, all arms wired.** Message (`spec.ts:1098-1104`) interpolates only the id — no clock, no counts, brief text deliberately not echoed. The bucket is present in: human output (`1226`), total (`1242`), baseline snapshot (`1311`), compare (`1423`), save-human (`1448`), and all three CLI JSON arms (`cli.ts:1758, 1788, 1819`). No half-wire.
- **AC 6 never a gate.** `decision-brief-convention.test.ts:753-871` drives real `runUpdate`: the cascade result set (`changed`+`autoCompleted`+`cascadeSkipped`) is equal with and without brief/answer comments, and the done-gate refusal string is byte-equal. That assertion would fail if any transition consulted the state. The finding is report-only and armed-only; the repo's `.convention.yml` is **not** armed, and CI (`.github/workflows/ci.yml`) runs no `spec analyze`, so it cannot redden a lane.
- **AC 4/7 report & sync.** `report.ts:120` still classifies only acceptance; `ReportContainer` gains nothing. `decision-brief-convention.test.ts:475-483` asserts `not.toHaveProperty("decision_brief")` (would fail on a regression), and `:508-528` pins the exact `sync` result key set. Meaningful, not vacuous.
- **AC 1 grammar.** Regexes `/^[ \t]*decide:(?=$|[ \t(])/i` and `...decided:...` reject `decides:`/`decidedly:` and mid-sentence mentions; heading regex rejects handoff headings; first-header-only per comment and append-order tiebreak match the `verdict.ts`/`acceptance.ts` precedent.
- **Behavioral edge cases (independent of tests).** Two briefs with only the first answered → `open` (latest brief wins). Answer preceding its brief → not counted → `open`. Same-date tie by body order → correct. `decided: other` → ordinary answer. A brief after an answer re-opens. All match spec §States.
- **Registry.** New module is automatically compiled into `lib/dist` and inlined into the bundle; no capability-matrix row or package `files` entry is owed. `lib/README.md`'s stable-subset table lists neither the acceptance nor the brief exports, so it is consistent, no silent gap.
- **schemaVersion honesty.** I found no exact-shape assertion on the `show` payload that the additive field breaks; the native/MCP output schemas are loose (`additionalProperties` defaults true). The claim holds.

## Non-blocking finding

**F1 — malformed nested code span in the user-facing JSON contract.** `ArggonManager/docs/json-output.md:620`, the new `decision_brief` paragraph:

    ...answers with a comment headed `decided: <the chosen option, or `other``.

Parsing the file with prettier's mdast (the suite's own parser) shows the first code span closes before `other`: the AST yields `inlineCode: "`decided: <the chosen option, or `"`, and the trailing double backticks render literally. The sentence therefore reads `decided: <the chosen option, or other``` with a stray fence instead of showing `other` as code. Fix is to use a longer outer fence: ````````decided: <the chosen option, or \`other\`>`````````. `prose-format.test.ts` does **not** catch it: prettier is byte-stable on the line (I formatted a copy; byte-identical), and rule 2 only checks that the formatter does not rewrite a span, not that a span is well-formed. Fixing it here or filing it are both acceptable; it is editorial, not functional and not behavioral.

## Explicitly not re-reported

The two `arggon: warning: commit skipped: ... native gate: missing dependency` lines in the full suite are pre-existing on `main` (confirmed by the delivery lead), not this change's.

## Verification status

- Verified by reading: AC 1-8 code paths, tests' discriminating power, docs completeness, one-logic-path, report/sync isolation, never-a-gate wiring.
- Taken as input (not re-executed by me, per role): `validate`, `spec validate`, `spec analyze` = 10 none new, prettier, `test:structure`, `lint:structure`, full `test` 133/2837, `check:plugin` no drift. No probe changes my verdict — the one item that would rest on execution (bundle determinism) is covered by `check:plugin`, which the maker reports clean; the bundle diff is a visibly mechanical module-registry regeneration carrying `lib/src/brief.ts`.
- Remaining unverified: none material to the verdict.

## Recommendation

**Merge.** Clean against the project's review bar: architecture/boundaries, conventions, tests-that-discriminate travel with the behavior, docs travel with the code, scope stays on the item, report/sync byte-identical, never-a-gate asserted by a real test. F1 is the only defect and is non-blocking.

Process note (delivery lead's call, not a code finding): the item frontmatter still reads `status: todo`, `assignee: null`, `worktree_path: null` despite the claim commit — flip it on merge per §5.

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG

### 2026-10-06 @arggon-delivery-lead

**verdict: approve — merge when CI is green.**

The standards reviewer returned **approve with no blocking findings**, and I independently verified the two claims I said I would check rather than taking them on trust:

- **AC 4 scope width** — `unansweredDecisionBriefFindings` applies no status filter and does not import the acceptance detector's container set; it delegates to `itemsWithUnansweredBrief`, which fires solely on `state === open`. This was the trap most likely to be copied by analogy from `MISSING-PRODUCT-ACCEPTANCE`, and it was avoided.
- **AC 2 assignee** — `classifyDecisionBrief(body, assignee)` takes the assignee and both call sites pass `item.assignee` (`lib/src/operations.ts:187`, `lib/src/brief.ts:217`).

I also ran the parser directly rather than reading the tests: `decided` / `self-decided` / unassigned classify correctly, a one-option `decide:` reads `open`, `decides:` does not match, and a handoff-style heading does not match.

**Gates I ran myself** (worktree at b2233b67): `validate` ok; `spec analyze` **10 findings, none new**; `test:structure` 5/5; `lint:structure` clean; **full `npm run test` 133 files / 2837 passed**; `check:plugin` no drift. The two `commit skipped: … native gate: missing dependency` warnings are **pre-existing on main** (I ran the suite there: identical warning, 132 files / 2803 tests), so they are not this change's.

**One non-blocking defect fixed here rather than filed:** the reviewer's F1, a nested code span in `docs/json-output.md`'s `decision_brief` row where `decided: <the chosen option, or `other`` closed the span early and rendered a stray double-backtick. `prose-format.test.ts` misses it because prettier is byte-stable on the line. Fixed in d884b8fb — the `other` case is now its own sentence, which also says out loud that it is a first-class reply rather than a footnote.

**Scope discipline confirmed:** `report.ts` and `sync-command.ts` are untouched, so the spec's byte-identity promise holds; the human `arggon show` view gains no field line (AC 3); and the plugin bundle is a mechanical regeneration, enforced by `check:plugin`.

Nothing to file: the reviewer's single non-blocking finding is fixed in this PR, and no finding required a decision ADR 0026 did not make.
