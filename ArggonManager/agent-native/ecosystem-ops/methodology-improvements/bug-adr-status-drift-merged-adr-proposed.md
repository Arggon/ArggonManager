---
type: bug
status: done
id: bug-adr-status-drift-merged-adr-proposed
title: "Three merged ADRs (0022, 0023, 0025) still read `Status: Proposed` — `engineering.md`'s lifecycle is \"Accepted when merged\", and ADR 0021 already needed a status-fix item for exactly this drift"
assignee: arggon-delivery-lead
branch: fix/bug-adr-status-drift-merged-adr-proposed
parent: methodology-improvements
labels: [docs, adr]
created: "2026-10-06"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-adr-status-drift-merged-adr-proposed.md
  Leaves live only under a story. id is the filename stem: bug-adr-status-drift-merged-adr-proposed.
  CLI `arggon create bug adr-status-drift-merged-adr-proposed` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Three merged ADRs (0022, 0023, 0025) still read `Status: Proposed` — `engineering.md`'s lifecycle is "Accepted when merged", and ADR 0021 already needed a status-fix item for exactly this drift

## Context

Found while running the delivery-lead review of ADR 0026 (PR #659), 2026-10-06.
`ArggonManager/docs/engineering.md` §ADR process declares the lifecycle:

> **Lifecycle:** Proposed in a PR → Accepted when merged (or explicitly recorded) →
> Superseded by a later ADR, never silently rewritten.

Measured on `main` at that moment:

| ADR  | On `main`?       | `- Status:` | Should read          |
| ---- | ---------------- | ----------- | -------------------- |
| 0022 | yes (`8643c32b`) | `Proposed`  | `Accepted`           |
| 0023 | yes (`66035a4a`) | `Proposed`  | `Accepted`           |
| 0024 | yes              | `Accepted`  | `Accepted` — correct |
| 0025 | yes (`6d3bef0c`) | `Proposed`  | `Accepted`           |

So three merged ADRs assert a lifecycle state the declared process says they
left two commits ago. A record that says "Proposed" about a decision already taken
is the same defect class ADR 0021 hit: its own status line lagged its merge, and
`task-adr-0021-status-accepted` fixed it after the fact. ADR 0021's amendment
block now says so explicitly, and its own note names the cause — _"only the
status line lagged the merge"_.

The index row is not the failure: `cli/src/adr-index-parity.test.ts` asserts the
row's status agrees with the ADR's own status line, so row and file agree — both
wrong together, consistently. That is why nothing catches it. A status assertion
that only checks internal consistency cannot detect a status that never moved.

## Acceptance

- [x] ADR 0022, 0023 and 0025 each read `- Status: Accepted`, and each gains a **dated status note** in the house style of ADR 0021's — naming the merge that accepted it, and stating that nothing below the note is rewritten
- [x] `ArggonManager/docs/adr/README.md` status cells for 0022 / 0023 / 0025 updated to `Accepted` so the index agrees
- [x] A **prevention** is recorded, not just the three fixes. Choose one and say why: (a) a check that fails when an ADR is merged while still `Proposed`, (b) a documented convention that the merge commit carries the flip (what ADR 0026 does), or (c) accepting the drift as a known, owned cost — in which case the reason belongs in `engineering.md` §ADR process so the next ADR's author knows not to rely on the status line. **Chosen: (b)**, recorded in `engineering.md` §ADR process; rationale in §Notes
- [x] If (a): **not applicable — (b) was chosen.** No check was added and no fixture exists, because no check can decide the question from the file (see §Notes for the measurement that rules (a) out)
- [x] `npx vitest run cli/src/adr-index-parity.test.ts cli/src/adr-status-doc-contract.test.ts` green (16/16); `npm test` green (134 files / 2858 tests); `npm run build` green; `npm run arggon -- validate` ok (0 warnings); `prettier --check` clean on every file touched
- [x] The fix is a status line plus a dated note. **No ADR body text is rewritten** — supersede, never rewrite (`engineering.md` §ADR process)

## Notes

2026-10-11 — maker (`arggon-maker`), branch `fix/bug-adr-status-drift-merged-adr-proposed`.

**The three fixes.** Each ADR gained a dated status note above its first block of
body prose, naming the merge that accepted it, and a `- Status: Accepted` line. No
body text below any note was touched.

| ADR  | Accepted by                            | Note names                        |
| ---- | -------------------------------------- | --------------------------------- |
| 0022 | PR #642, merge `25fde21a` (2026-10-04) | merge `25fde21a` (PR #642)        |
| 0023 | direct commit `66035a4a` on `main`     | `66035a4a`, a first-parent commit |
| 0025 | PR #656, merge `81828441` (2026-10-06) | merge `81828441` (PR #656)        |

The item's Context table names the _content_ commits (`8643c32b`, `66035a4a`,
`6d3bef0c`); the notes name the **merge** that accepted each record, which is the
house style ADR 0021 and ADR 0026 use. 0023 needed the distinction: it is on
`main`'s first-parent history with no merge commit at all, so its note says so
instead of inventing a merge.

**Prevention: (b), the flip rides the landing commit.** Recorded as a paragraph in
`ArggonManager/docs/engineering.md` §ADR process, immediately after the
`**Lifecycle:**` line, so the convention sits with the lifecycle it belongs to.
(a) was measured and rejected, not dismissed:

1. **A merged-`Proposed` ADR is not always drift.** ADR 0019 is on `main` reading
   `Proposed` and its own amendment (2026-10-02, PRs #573/#579) says the status is
   deliberately unchanged: _"(still Proposed): this closes one decision point's
   open hatch, it does not accept the record."_ A gate that fails an ADR merged
   while `Proposed` would fail ADR 0019 — correct prose, exactly the gate-poisoning
   failure `adr-status-doc-contract.test.ts` documents. The lifecycle's own
   "(or explicitly recorded)" is the escape that makes 0019 legal, so the
   convention needs the explicit record written down, not a gate that cannot see
   it.
2. **Git archaeology has no per-record answer.** ADRs 0001–0012 were all
   introduced by one commit (`e6dfd6b5`), so "the commit that introduced this ADR"
   is not a per-ADR oracle in this repo's own history, and 0023 landed with no
   merge commit.
3. **The backstop already exists and is report-only.** `spec analyze`'s
   `STALE-PROPOSED-ADR` finding fires on a `Proposed` line older than
   `STALE_PROPOSED_DAYS = 14` days (`cli/src/spec.ts:784`) with the message
   "accept, reject, or supersede it". Measured on this branch: 0 findings, exit 0
   — correct, because 0022/0023/0025/0019 are 7/6/5/10 days old. It would have
   flagged ADR 0022 on 2026-10-18. It is a warning by design; promoting it to a
   gate would repeat (1).

(c) was not chosen: the cost is ownable for one line each, and the fix cost is
three status lines — cheaper than documenting why nobody should trust the status
line.

**Methodology impact class: advisory.** No rule, gate, command or schema contract
changes with this item. The `engineering.md` edit adds one convention paragraph to
§ADR process; it names no new carrier, so `adr-status-doc-contract.test.ts`'s
coverage sentence is untouched, and the paragraph carries no ADR link, so rule 1 is
unaffected.

**Out of scope, reported to the delivery lead.** The corpus sweep that measured
the three drifts also found ADR 0019 merged-`Proposed` (correct, see above) and
ADR 0024 whose `- Status: Accepted` sits above three notes in a different order
from every other ADR (a numbering note, then a status note, then the `- Date:`
line) — cosmetic, not drift, and not touched. No new item was filed from here.

### 2026-10-11 @ses_ed6995b8cffePDwIh3viZwoIaR
### 2026-10-11 @arggon-maker

evidence: gates run in worktree `/home/arggon/Projects/ArggonManager-bug-adr-status-drift-merged-adr-proposed` on branch `fix/bug-adr-status-drift-merged-adr-proposed` at commit `97a6a6d0`. PR: https://github.com/Arggon/ArggonManager/pull/683 (not merged, not squashed).

| Command | Expected | Observed (exit) |
| --- | --- | --- |
| `npx vitest run cli/src/adr-index-parity.test.ts cli/src/adr-status-doc-contract.test.ts` | green | 2 files / 16 tests passed (0) |
| `npm test` | 134 files / 2858 tests (main baseline) | 134 files / 2858 tests passed, 93.96 s (0) |
| `npm run build` | exit 0 | exit 0 (0) |
| `npx prettier --check` (3 ADRs, docs/adr/README.md, docs/engineering.md, item file) | clean | "All matched files use Prettier code style!" (0) |
| `npm run arggon -- validate` | ok | `arggon validate: ok (0 warning(s), convention v5)` (0) |

Kernel's own read of the live `## Acceptance` section after the ticks: `acceptanceGate` returns `{"gated":false}` — 6 live criteria, 0 unchecked, so the flip is not gated (checked via `liveAcceptanceCriteria`/`liveAcceptanceUnchecked` over the item body, because `arggon goal` correctly refuses to target a claim held by `arggon-delivery-lead`).

Changed files (5 + item file): `ArggonManager/docs/adr/0022-decline-autoharness-autocontext-autocompact.md`, `0023-ci-wall-clock.md`, `0025-done-gate-live-acceptance-section.md`, `ArggonManager/docs/adr/README.md`, `ArggonManager/docs/engineering.md` (one paragraph in §ADR process). No new test file: the chosen prevention is (b), so the negative-case requirement for (a) does not apply.

prevention: (b) — documented in `engineering.md` §ADR process. (a) is ruled out by measurement, not preference: ADR 0019 is on `main` reading `Proposed` on purpose (its own amendment: "(still Proposed): this closes one decision point's open hatch, it does not accept the record"), and ADRs 0001–0012 share one introducing commit (`e6dfd6b5`), so neither the file nor git history answers "was this ADR accepted on merge". The existing backstop is `spec analyze`'s report-only `STALE-PROPOSED-ADR` (14-day threshold) — measured at 0 findings on this branch, correct because the four `Proposed` ADRs are ≤10 days old.

methodology impact class: advisory — no rule, gate, command, adapter or schema change.

findings for other items (not fixed here, filed by the delivery lead):
1. ADR 0019 is a fourth merged-while-`Proposed` record; it is CORRECT as written (explicitly-recorded `Proposed`), but the item's Context table measured only 0022/0023/0024/0025, so the corpus count behind "three merged ADRs" is now known to include one deliberate case. Worth naming wherever the three are counted.
2. ADR 0024's metadata block orders its notes differently from every other ADR (numbering note, status note, then `- Date:`/`- Deciders:`/`- Input:`), so its `- Status: Accepted` is followed by three blockquote notes before the rest of the list. Cosmetic ordering only — not drift, not touched.
3. `arggon goal <id>` refuses when the claim is held by an agent id rather than the invoking identity, so a maker cannot self-read the goal contract for an item the lead dispatched. Recorded here because it shaped how the acceptance completeness was verified above; a `--as-claim-owner`-style read is not proposed, just noted.

### handoff 2026-10-11 @ses_ed6995b8cffePDwIh3viZwoIaR (session: ses_ed6995b8cffePDwIh3viZwoIaR) — next: Delivery lead: review PR #683 (docs(adr) 97a6a6d0 + docs(tasks) 3a6e4436 + evidence comment 4828027d) and merge; the live Acceptance section is complete (6/6 criteria, gate ungated).
- branch: fix/bug-adr-status-drift-merged-adr-proposed
- open questions: Does the story need a note that ADR 0019 is a fourth merged-Proposed record (correct as written)? Leave ADR 0024's odd metadata note order alone?

### 2026-10-11 @ses_ed6995b8cffePDwIh3viZwoIaR
### 2026-10-11 @arggon-maker (addendum: the prettier gate on the item file)

Precision on the one gate that does not come back clean, because `npx prettier --check` was run over every file I touched:

| File | `prettier --check` |
| --- | --- |
| `ArggonManager/docs/adr/0022-decline-autoharness-autocontext-autocompact.md` | clean |
| `ArggonManager/docs/adr/0023-ci-wall-clock.md` | clean |
| `ArggonManager/docs/adr/0025-done-gate-live-acceptance-section.md` | clean |
| `ArggonManager/docs/adr/README.md` | clean |
| `ArggonManager/docs/engineering.md` | clean |
| `ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-adr-status-drift-merged-adr-proposed.md` | **warn — pre-existing, not introduced here** |

Measured, not assumed: the item file at the claim commit `0b634154` already fails `prettier --check` under the repo's own `.prettierrc.json`, with exactly two hunks — prettier's YAML printer wants the kernel-written frontmatter `title:` single-quoted instead of double-quoted, and a blank line after the closing `---`. My edits add no new class of failure: the appended comment carries an unpadded table and the two consecutive comment blocks sit on adjacent `### 2026-10-11 @…` headings, which is the shape every multi-comment item in this tracker has (measured: 5–36 unpadded table rows across five other item files; adjacent comment headings in at least six more).

`prettier --write` was deliberately NOT run on this file. It rewrites the kernel-written frontmatter, a tracker schema surface this item does not own, and it would re-break on the next `arggon update` / `arggon comment` — the same fight the kernel wins every time. This matches the repo's own recorded position: `cli/src/prose-format.test.ts` excludes the tracker item tree from its prettier invariants ("item bodies are historical records … deliberately left as-is"), `.prettierignore` does not cover the tree, and CI never runs prettier (grep over `.github/workflows/`).

Finding for the delivery lead, not fixed here: **no gate in this repo can require `prettier --check` to pass on a tracker item file**, because the kernel's frontmatter quoting disagrees with prettier's YAML printer on every item the tracker writes. If that is wanted, it is either a kernel change (emit prettier-clean frontmatter) or a `.prettierignore` entry for the tracker tree — both outside this item.

### 2026-10-11 @arggon-delivery-lead
verdict: approve (scope: ADR 0022/0023/0025 status flips + index rows + the §ADR process prevention)

Delivery-lead review of PR #683, delegated to the maker with the full bar; this verdict is mine and is recorded here per `ArggonManager/docs/engineering.md` §Review bar → Review verdicts. Gates run by the lead on the branch, not only reported: `npx vitest run cli/src/adr-index-parity.test.ts cli/src/adr-status-doc-contract.test.ts` → 2 files / 16 tests passed.

What I read: the diff `origin/main...HEAD` (three ADR files, `ArggonManager/docs/adr/README.md`, one paragraph in `ArggonManager/docs/engineering.md` §ADR process), the item's measurement table, and the maker's report on the item. All six live acceptance criteria are ticked, and each tick is honest against the diff.

Why it meets the bar:

- **Architecture / boundaries.** The flip lives exactly where `engineering.md` §ADR process says the record lives: the ADR file's `- Status:` line, the index row, and the landing commit. No carrier restates an ADR's status (the rule the `adr-status-doc-contract.test.ts` gate enforces), so this PR adds no new restatement.
- **Docs travel with code.** The new §ADR process sentence is the only thing that was missing, and it is written for the next author rather than for this fix: it names the precedent (0021, 0024, 0026), states that the flip belongs to the landing commit (because the parity test pins row and file to the same status class, so half a flip turns `main` red), and names the report-only backstop (`spec analyze`'s `STALE-PROPOSED-ADR`).
- **Prevention chosen on evidence, not preference.** (b) — the flip rides the landing commit. The maker measured rather than asserted: ADR 0019 is on `main` reading `Proposed` **on purpose** (its own amendment says the status is deliberately unchanged, using the lifecycle's "(or explicitly recorded)" escape), so a "merged-and-Proposed fails" gate would fail a correct record; and ADRs 0001–0012 share one introducing commit, so git archaeology has no per-record oracle. I agree with (b) and with the reason it is not (a).
- **Supersede, never rewrite.** Each ADR gains a dated status note that says explicitly that nothing below it is rewritten, and the diffs confirm it — three status lines, three notes, three index cells, one paragraph. No body text was touched.
- **Methodology impact class stated.** `engineering.md` is a carrier; the change is **advisory** (it records a convention about when the status flips; no rule, gate, command contract or pipeline step changed), and that class is stated on the item and in the PR.
- **Scope.** Nothing outside the ADR corpus and the one paragraph. The four unrelated drifted facts in `engineering.md` are left to `task-engineering-doc-restates-more-drifted-facts`, which is the right custody.

Verified against the review bar's blocking end-to-end check: CI on PR #683 — `cli` 3m37s SUCCESS, `tasks-validate` 30s SUCCESS, `ui-smoke` 2m21s SUCCESS.

Findings filed by me as follow-ups (not this PR's scope, and they do not block it): ADR 0019 named wherever "three merged ADRs" is counted; the `arggon start` frontmatter-vs-prettier regression; branches cut from a primary checkout with unpushed tracker commits inheriting them.

Merge call: **approved — merge as a merge commit** (tracker auto-commits ride this branch, so no squash).
