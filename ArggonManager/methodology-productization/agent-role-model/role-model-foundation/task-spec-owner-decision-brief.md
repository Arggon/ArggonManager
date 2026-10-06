---
type: task
status: todo
id: task-spec-owner-decision-brief
title: "Spec: the decision-brief convention, its answer grammar, and the unanswered-brief report-only finding (exploration 025 edge cases as acceptance criteria)"
parent: role-model-foundation
labels: [methodology, roles, spec]
priority: p0
created: "2026-10-06"
updated: "2026-10-06"
depends_on: [task-adr-0026-owner-decision-brief]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-spec-owner-decision-brief.md
  Leaves live only under a story. id is the filename stem: task-spec-owner-decision-brief.
  CLI `arggon create task spec-owner-decision-brief` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec: the decision-brief convention, its answer grammar, and the unanswered-brief report-only finding (exploration 025 edge cases as acceptance criteria)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG
Gated behind `task-adr-0026-owner-decision-brief` (the ADR decides; this specifies it). **ADR 0017 hard gate: this spec must pass `arggon spec analyze` with no NEW findings before any implementation task is claimed** — including `task-wire-decision-brief-carriers`.

Every row of exploration 025's edge-case table becomes an acceptance criterion, so nothing stays "unknown". The non-obvious ones:

- **Routing rule** — briefs owed only for the ADR 0021 §2 rows and hard-to-reverse calls; a one-option question is **not** a brief (the lead decides it and records why).
- **Unanswered** — the stated default executes and the brief records that it did. This is the mechanism that makes escalation cheap rather than blocking.
- **Concurrency** — one canonical item per decision; a second brief links to it. No cross-item dedupe scanner in v0: **explicit non-goal**, the volume does not justify a surface.
- **Never a gate** — report-only, inherited from ADR 0021 §4: no transition consults it, no command refuses because of it, CI never fails on it.
- **Time** — absolute ISO dates only; never a relative deadline.
- **Domain neutrality** — every field named in the project's own terms; software is the worked example, never the vocabulary (ADR 0021 §6.2).
- **Upgrade** — `init --propose` delivers it; both skill copies stay byte-equal in the same PR.

## Acceptance

- [ ] `ArggonManager/docs/specs/spec-<owner-decision-brief>-NNN.md` written from `templates/spec.md`, with the six brief fields, the answer grammar, and the routing rule specified
- [ ] **Every** row of exploration 025's edge-case table appears as an acceptance criterion, an explicit non-goal, or a tracked spike — an adversarial re-pass finds no "unknown"
- [ ] The report-only finding specified: a `decide:` header with no later `decided:`, mirroring `MISSING-PRODUCT-ACCEPTANCE`; **opt-in under `x-tracker.product-acceptance`, never CI-failing**
- [ ] Spec states the promotion-policy tiers are unchanged, so product-owner touchpoints per shipped change do not rise
- [ ] `arggon spec validate` green and `arggon spec analyze` reports **no NEW findings** — the gate for `task-wire-decision-brief-carriers`
- [ ] Plan filed with ordered tasks and `depends_on`, per `references/methodology.md`

### 2026-10-06 @ses_eee50c3c2ffea91lEKg6KhytwM
Spec landed as `ArggonManager/docs/specs/spec-owner-decision-brief-021.md` (NNN 021: 020 is the highest existing spec, so 021 is the next free number — verified with `ls | sort`, not assumed). PR #660, one commit `2451727e`, no squash. Branch `feat/task-spec-owner-decision-brief`.

**The two questions ADR 0026 left open, answered**

1. *Which read-only surface reports an unanswered brief* → `show <id> --json` gains an additive `decision_brief` field (`none｜open｜decided｜self-decided`) and `spec analyze` gains one report-only finding `UNANSWERED-DECISION-BRIEF`, mirroring `MISSING-PRODUCT-ACCEPTANCE` under the **existing** `x-tracker.product-acceptance` arming (no new config key). `report --json` and `sync --json` stay byte-identical: `sync` classifies only items reconciled with an open PR (`lib/src/sync-command.ts:81–83`) — the same correction ADR 0021's dated amendment records at 0021:323–347 — and `report` aggregates per container (`lib/src/report.ts:13`) while a brief is item-level and often lives on a leaf. Justified in the spec's §"The read-only surface".
2. *Where the carrier text lives* → `task-wire-decision-brief-carriers`; the spec's §"Boundary with the carriers item" lists what that item will do and what it must not re-decide.

**Gates (command → expected → observed)**

- `npm run arggon -- validate --json` → `ok:true` → `{"ok":true,...,"errors":[],"warnings":[]}`
- `npm run arggon -- spec validate` → ok → `arggon spec: ok (37 doc(s), 5 warning(s))`; the 5 are pre-existing `DOC_NUMBER_COLLISION` warnings in other files, unchanged from before my file (36 docs → 37 docs)
- `npm run arggon -- spec analyze` → no NEW findings → **10 findings before, 10 after**, none in this spec. Before: 2 `no-error-path`, 3 `vague-quantifier`, 5 `duplicate-doc-number`. After: identical counts and kinds. `spec analyze --spec ArggonManager/docs/specs/spec-owner-decision-brief-021.md` → `scanned 1`, zero findings in every bucket.
- `npx prettier --check <file>` → clean → "All matched files use Prettier code style!" (run once before the commit, re-run after the final edit — this repo's Markdown formatter has non-idempotent cases, so the post-edit re-check is the one that counts)
- `npm run test:structure` → green → "test result: ok. 5 passed; 0 failed"
- `npm run lint:structure` → clean → no rule hits
- `npm run --silent arggon -- validate` (the pre-commit hook body, run manually) → ok → "arggon validate: ok (0 warning(s), convention v5)"

**Edge-case coverage.** All twelve rows of exploration 025 §Edge cases are carried: hostile input/no product owner (non-goal + default-executes), one option / options with no consequence (AC 9, AC 12), concurrency (AC 11 + no-dedupe-scanner non-goal), no answer by the date (§Synopsis default rule), forgery / self-answer (`self-decided` state reported never blocked + auth non-goal), rubber-stamping (routing rule bounds volume), relative deadlines (AC 12), existing trees (nothing-migrates non-goal), unanswered observability (AC 4), hostile brief text (AC 13), non-software adopters (AC 14), upgrade (AC 15).

**Ambiguity found in ADR 0026, reported not resolved by invention**

- The ADR names the surface question but does not say whether the *classification* also rides `report`. I chose `show` + `spec analyze` and left `report` unchanged, with the reasoning stated in the spec. A maker could reasonably have added a container row; that is now a documented choice, not an open question.
- `self-decided` is **my** state name. ADR 0026 §2 mandates attribution-only but never names a state; I mirrored `self-accepted` because the sibling precedent is exactly this case. Flagged in the spec's §States as mirroring, so a reviewer can reject the name without unpicking the design.
- ADR 0026 §8's two reversal limbs are **not computable** from anything this spec adds: limb (a) needs answer latency (a comment-date difference) and limb (b) needs a count of decisions made outside briefs, which no surface records. Recorded as an explicit "not established" non-answer in the spec rather than a metric invented here.

**Not done (yours):** item not flipped to `done`, PR not merged. `task-wire-decision-brief-carriers` remains `todo` and gated — its `depends_on` already lists this item.

### 2026-10-06 @ses_eee50c3c2ffea91lEKg6KhytwM
Spec landed as `ArggonManager/docs/specs/spec-owner-decision-brief-021.md` (NNN 021: 020 is the highest existing spec, so 021 is the next free number — verified with `ls | sort`, not assumed). PR #660, one commit `2451727e`, no squash. Branch `feat/task-spec-owner-decision-brief`.

**The two questions ADR 0026 left open, answered**

1. *Which read-only surface reports an unanswered brief* → `show <id> --json` gains an additive `decision_brief` field (`none｜open｜decided｜self-decided`) and `spec analyze` gains one report-only finding `UNANSWERED-DECISION-BRIEF`, mirroring `MISSING-PRODUCT-ACCEPTANCE` under the **existing** `x-tracker.product-acceptance` arming (no new config key). `report --json` and `sync --json` stay byte-identical: `sync` classifies only items reconciled with an open PR (`lib/src/sync-command.ts:81–83`) — the same correction ADR 0021's dated amendment records at 0021:323–347 — and `report` aggregates per container (`lib/src/report.ts:13`) while a brief is item-level and often lives on a leaf. Justified in the spec's §"The read-only surface".
2. *Where the carrier text lives* → `task-wire-decision-brief-carriers`; the spec's §"Boundary with the carriers item" lists what that item will do and what it must not re-decide.

**Gates (command → expected → observed)**

- `npm run arggon -- validate --json` → `ok:true` → `{"ok":true,...,"errors":[],"warnings":[]}`
- `npm run arggon -- spec validate` → ok → `arggon spec: ok (37 doc(s), 5 warning(s))`; the 5 are pre-existing `DOC_NUMBER_COLLISION` warnings in other files, unchanged (36 docs → 37 docs)
- `npm run arggon -- spec analyze` → no NEW findings → **10 findings before, 10 after**, none in this spec. Before: 2 `no-error-path`, 3 `vague-quantifier`, 5 `duplicate-doc-number`. After: identical counts and kinds. `spec analyze --spec ArggonManager/docs/specs/spec-owner-decision-brief-021.md` → `scanned 1`, zero findings in every bucket.
- `npx prettier --check <file>` → clean → "All matched files use Prettier code style!" (run before the commit, re-run after the final edit — this repo's Markdown formatter has non-idempotent cases, so the post-edit re-check is the one that counts)
- `npm run test:structure` → green → "test result: ok. 5 passed; 0 failed"
- `npm run lint:structure` → clean → no rule hits
- `npm run --silent arggon -- validate` (the pre-commit hook body, run manually) → ok → "arggon validate: ok (0 warning(s), convention v5)"

**Edge-case coverage.** All twelve rows of exploration 025 §Edge cases are carried: hostile input / no product owner (non-goal + default-executes), one option / options with no consequence (AC 9, AC 12), concurrency (AC 11 + no-dedupe-scanner non-goal), no answer by the date (§Synopsis default rule), forgery / self-answer (`self-decided` reported never blocked + auth non-goal), rubber-stamping (routing rule bounds volume), relative deadlines (AC 12), existing trees (nothing-migrates non-goal), unanswered observability (AC 4), hostile brief text (AC 13), non-software adopters (AC 14), upgrade (AC 15).

**Ambiguity found in ADR 0026, reported not resolved by invention**

- The ADR names the surface question but does not say whether the *classification* also rides `report`. I chose `show` + `spec analyze` and left `report` unchanged, with the reasoning stated in the spec. A maker could reasonably have added a container row; that is now a documented choice, not an open question.
- `self-decided` is **my** state name. ADR 0026 §2 mandates attribution-only but never names a state; I mirrored `self-accepted` because the sibling precedent is exactly this case. Flagged in the spec's §States as mirroring, so a reviewer can reject the name without unpicking the design.
- ADR 0026 §8's two reversal limbs are **not computable** from anything this spec adds: limb (a) needs answer latency (a comment-date difference) and limb (b) needs a count of decisions made outside briefs, which no surface records. Recorded as an explicit "not established" non-answer in the spec rather than a metric invented here.
- ADR 0026 §1 says the `decide:` header "may carry a short scope in parentheses" but does not give a brief example; the `decided:` example at §2:113–117 is the only worked header. My §Synopsis brief example therefore follows the ADR's own non-software vocabulary (§7:243–244) rather than reconstructing a form the ADR never wrote down.

**Not done (yours):** item not flipped to `done`, PR not merged. `task-wire-decision-brief-carriers` remains `todo` and gated — its `depends_on` already lists this item.

### handoff 2026-10-06 @ses_eee50c3c2ffea91lEKg6KhytwM (session: ses_eee50c3c2ffea91lEKg6KhytwM) — next: Review + merge PR #660 (spec owner-decision-brief-021), then claim task-wire-decision-brief-carriers
- branch: feat/task-spec-owner-decision-brief
- open questions: Report-or-show for report? (chose show+analyze, report unchanged); 'self-decided' state name is mine, ADR 0026 names no state; ADR 0026 §8 reversal limbs not computable from this spec's fields

### 2026-10-06 @arggon-standards-reviewer
verdict: request-changes

Reviewed read-only in `/home/arggon/Projects/ArggonManager-task-spec-owner-decision-brief` at `2451727e` (one file, +416). All four reported defects are real; three are blocking, the fourth (register) I rule **not a defect**. I found four more in the same class. Gates are green and the spec introduces no NEW analyze finding, so the ADR 0017 gate for `task-wire-decision-brief-carriers` is satisfied on its own terms — but the convention this spec specifies is taught wrongly in the one example every reader will copy, and that has to be right before carriers propagate it into `agents.md`/`engineering.md`/both skill copies.

# Gates — re-run by me in the worktree (at your instruction)

| Command (cwd = worktree) | Expected | Observed |
| --- | --- | --- |
| `npm run arggon -- validate --json` | `ok:true`, no errors/warnings | `{"ok":true,…,"errors":[],"warnings":[]}` — convention v5 |
| `npm run arggon -- spec validate` | ok, no new warnings | `arggon spec: ok (37 doc(s), 5 warning(s))` — all 5 are pre-existing `DOC_NUMBER_COLLISION` in `exploration-cheap-path-to-prod-001`, `plan-deps-001`, `plan-release-pipeline-015`, `spec-deps-001`, `spec-release-pipeline-015`. Main reads **36 docs / 5 warnings**, so this file adds one doc and zero warnings |
| `npm run arggon -- spec analyze` (worktree) | no NEW findings | **10 findings across 23 specs** — 5 `duplicate-doc-number`, 2 `no-error-path`, 3 `vague-quantifier` |
| same, on `main` (baseline) | 10 | **10 findings across 22 specs** — identical kinds and counts. **10 → 10, no NEW finding, none in this file.** The hard gate for `task-wire-decision-brief-carriers` is cleared |
| `… spec analyze --spec ArggonManager/docs/specs/spec-owner-decision-brief-021.md` | clean | `arggon spec analyze: clean (1 spec(s) scanned)` |
| `npx prettier --check <file>` | clean | `All matched files use Prettier code style!` |
| `npm run test:structure` | green | `test result: ok. 5 passed; 0 failed` |
| `npm run lint:structure` | clean | no rule hits |
| extra: `npx vitest run spec-doc-numbers spec-analyze adr-index-parity adr-status-doc-contract init-docs prose-format` (not in your list — the docs-reading tests, the real risk for a new numbered doc) | green | 6 files, 91 tests passed |

Every claim in your brief about the maker's evidence is confirmed. I ran these myself rather than routing them to the verifier, which is outside my role's remit — treat them as reviewer-observed, not verifier-grade; say the word and I'll hand the list to the verifier instead.

# Blocking

**B1 — the brief is attributed to the product owner, and the prose never corrects it (line 80).** Your finding #1 is *worse* than you stated, and that makes it more blocking, not less. `### 2026-10-06 @gonzalo` heads the `decide:` brief. ADR 0026 §Decision (0026:71–73) is explicit — "a bounded, plain-language **decision brief**, written by the **delivery lead** **on the item** as a comment headed `decide:`, answered by the product owner with a comment headed `decided:`". I grepped the whole file for any other statement of authorship: **there is none.** Line 130 says field 5 is "written by the lead", line 132 the default is "what the lead will do", line 143 "the lead's own recommended option", line 222 the lead decides everything else — but nothing anywhere says the brief comment itself is authored by the lead. So line 80 is not contradicted by the prose; it is the spec's *only* statement of who writes a brief, and it states the inverse. Fix both: attribute the brief to the lead (the repo's lead handle is `@Arggon` — `verdict.ts`/`acceptance.ts` fixtures and every `### handoff … @Arggon` heading use it), and add one clause to §The record (line 105) — "written by the delivery lead for one reader whose vocabulary is not assumed; answered by the product owner" — so the example is not the sole carrier of the rule.
Note the second-order damage: with both blocks authored by `@gonzalo`, the synopsis either shows the owner authoring her own brief (inverting the convention) **or** the owner answering a question she asked — which is exactly the case `self-decided` exists to flag. Both readings are wrong, so the example cannot be read charitably.

**B2 — `decided: option B (the second wave)` names an option the brief never offered (line 93).** Confirmed. The brief's options (line 84–85) are "A keep one supplier" / "B add a second supplier". "The second wave" appears nowhere in the file. Root cause is visible: lines 91–95 are a verbatim copy of ADR 0026 §2:113–117, where the fragment floats unmoored above no question and the mismatch is invisible; pasted under a concrete brief it becomes a lesson in the wrong answer grammar — a scope note that resolves to nothing. Fix by writing an answer that answers *this* brief, and treat the ADR's §2 fragment as what it is: an illustration of header shape, not a model answer.

**B3 — the answer's reasoning contradicts option B's stated consequence (line 94).** Confirmed, and no charitable reading rescues it. Option B is "we pay more each year" (line 85); the answer says B "is the only option that does not spend the thing we are short of". Nothing in the brief names what we are short of, so the clause is unanchored too — and under any reading of "spend", A is the option that adds no spend. Either the answer is wrong or the brief is; as written it teaches a brief whose recommendation contradicts its own reasoning.

**B4 — the default contradicts the recommendation with nothing that licenses it (lines 86, 88).** New, same class, same fix pass. The brief recommends **B** and defaults to **A**. That is only legal under ADR 0026 §3's direction constraint (restated at spec lines 139–144: for a hard-to-reverse call the default is the reversible option), which the example never signals — a supplier contract is hard to undo, but the brief does not say so. A reader copying this shape concludes the default is free to differ from the recommendation, which is the opposite of the rule and is the rule that keeps auto-execution safe. One clause fixes it ("hard to reverse: a supplier contract is not something we can undo this year").

**Non-negotiable as a set:** fix B1–B4 together. A partial fix ships a spec whose worked example still contradicts its own normative prose.

# Non-blocking — cheap, same file, fix in this PR

1. **AC 5 (line 302) omits `self-decided` from the ungated list** — "still reports `none`/`open`/`decided` unconditionally" against the four-state table at line 153 and against lines 209–210 ("`self-decided` still reports as a state on `show`"). An implementer coding from AC 5 alone could gate it. Add the fourth token.
2. **AC 14 / §Domain neutrality claim a software worked example this file does not contain** (lines 246–252). The only software phrases in the file are inside the sentence that quotes ADR 0026 §7; there is no software worked brief anywhere. So "the software case appears once, as a worked example" is false about the spec and silent about the carriers. Say explicitly "in the carriers", the way AC 9 and AC 10 name their owner.
3. **Four dead relative links** — `../lib/src/convention.ts` (55), `../lib/src/sync-command.ts` (167), `../lib/src/report.ts` (182), `../cli/src/spec.ts` (197, 198, 203, 206) resolve to `ArggonManager/docs/lib/…` and `ArggonManager/docs/cli/…`, which do not exist. No other doc in the repo links source this way (every other spec cites it as inline code) and **no gate catches it** — I checked, there is no link checker. Citations are the point of those lines; make them resolve or drop the parens.
4. **§8 reversal limbs: the conclusion is right, the stated reason for limb (a) is wrong** (lines 401–409). "Neither is computable from the fields this spec adds" — but AC 1 mandates a parser mirroring the siblings, and both `verdict.ts` and `acceptance.ts` already carry `date` and `order` on every parsed comment. Answer latency is a comment-date difference the spec itself mandates capturing, and the answered-brief ratio follows from the per-item state. Limb (b) is genuinely not computable (no surface records chat decisions). So: keep "no detector now", fix the reason, or you have told a future reader the ADR's own revisit trigger cannot be checked when this spec made it checkable. **On your third declaration: it smuggles nothing, it just misstates.**
5. **The brief-header grammar row does not describe the example** (line 113 vs line 81). The row says `decide:` "optionally followed by a short scope in parentheses"; the example is `decide: <free sentence> (scope: …)` — free text before the parens, plus a `scope:` label neither ADR 0026 §1 nor either sibling uses (`verdict: approve (smoke evidence missing)`, unlabelled). Harmless to the parser (`decide:` is token-bounded), but it teaches a form the prose does not describe. Either widen the row or unlabel the example.
6. **AC 2 never says the classifier receives the assignee** (line 285). `self-decided` is defined against "the item's own assignee" (line 153) but AC 2 only requires capturing the author; `classifyAcceptance(body, assignee)` takes it as a second argument. One clause closes it.
7. **AC 4 does not state the item-type/status scope, and the mirror it cites suggests the opposite** (line 296). `MISSING-PRODUCT-ACCEPTANCE` is story-only **and terminal-only** (`acceptance.ts:176–183`, `spec.ts:1046–1053`) precisely to stay low-noise. The new finding as specified fires on **any** item in **any** status while `open` — which is right (exploration 025's row 9 is "a brief was sent and never answered, and nobody notices", and a live brief sits `open` for its whole default window), but an implementer carrying the sibling's shape over by analogy would silence the one case the finding exists for. State the scope explicitly.
8. **The "no answer by the named date" row has no owner** (exploration 025 row 4 → prose at line 88 and 132, but no AC, unlike rows 3 and 6 which AC 9 owns). The item's own AC asks for "an acceptance criterion, an explicit non-goal, or a tracked spike". Add it to AC 9's carriers list or give it its own line.

# Non-blocking — real, but file as tracked items, do not hold this PR

9. **Two obligations the spec assigns to `task-wire-decision-brief-carriers` have no counterpart in that item's filed acceptance.** Its ACs (already written) cover the carriers prose, the generated contract, both skill copies, the finding with tests, and the three live cases — but **not** the dated ADR 0026 amendment the spec assigns it at line 268, and **not** the software worked example §Domain neutrality places there. Add both lines when you claim that item, or the ADR amendment and the one software example quietly drop.
10. **`self-decided` can false-positive on an owner-assigned item.** The state compares the answer's author to `item.assignee` (line 153). For a story the assignee is the delivery lead, so the comparison catches the right case (the lead answering his own question — ADR 0026 §Alternatives rejects exactly that). But `create --assignee` is human-writable, and an adopting project that assigns a container to the product owner would have every legitimate `decided:` read `self-decided`. Harm is bounded (reported, never blocked) and the exposure is latent — **no item in this tree is assigned to `gonzalo` today** (I checked: zero). Worth a clause or a follow-up item, not this PR.
11. **Item AC 6 (`plan` filed, per `references/methodology.md`:10) is unmet** — no plan exists for `owner-decision-brief-021`. Correct at this stage (the spec is merged before its plan per the same table), but the maker's handoff reads "review + merge, then claim the carriers", which would leave AC 6 open. File the plan or strike AC 6 **before** flipping the item to `done`; don't merge-and-done in one step.

# Your ruling request #4 — the register is **not** a defect. Accept it.

Deciding with the ADR's words, not taste. ADR 0026 §7 has three separate sentences doing three jobs: the **rule** (0026:241) is "every field is named in the project's own terms"; the **model of that rule** (0026:242–244) is the supplier phrasing — "'a second supplier for the same part', 'the price we pay each year', 'what a customer sees if it is wrong'"; and the **constraint on the software example** (0026:245–247) is about *where it may appear* — "it appears in carriers as an example only, never as the convention's own language". Nothing in §7 requires the software register to be the spec's synopsis, and "the convention's own language" is the six field names plus the `decide:`/`decided:` tokens — all of which this spec keeps neutral. A brief's *content* is not the convention's language. So a supplier-register worked example is consistent with §7's letter, and §Domain neutrality (246–252) declares the choice in the ADR's own words, which is the rejectable form §7 asks for. Your instinct was right and the maker's counter-argument holds in substance: the software case is owed **in the carriers**, exactly as ADR 0026 §7:246 says. The one thing wrong here is not the choice but the claim — see non-blocking #2. (The maker's note that ADR 0026 §1 never gave a brief-example header is accurate: §2:113–117 is the only worked header in the ADR, and it is the defective fragment in B2/B3. That is worth a dated amendment to the ADR too, or the defect propagates.)

# Does the spec re-decide anything ADR 0026 decided?

No. It specifies, and on the three points it did choose it declared itself, gave the reason, and kept the record amendable. Specifically: (a) the `show`-vs-`report` surface choice — declared as a choice at line 185 ("Choosing `show` over `report` is the decision this section exists to record"), reasoned, with the dated amendment assigned to the PR that makes the record complete; adding a `report` container row was a live alternative and the reasoning forecloses it on stated grounds, which is what "specify, do not decide" looks like when the ADR handed it over. (b) `self-decided` — named as the maker's own, mirroring `self-accepted`, rejectable by renaming alone. (c) §8's limbs — no detector invented; the conclusion is right, one reason is wrong (non-blocking #4). `report` staying byte-identical is the sibling spec's reached conclusion re-derived from the same code, not a re-decision. The `UNANSWERED-DECISION-BRIEF` finding does not violate ADR 0026 §6's "no new surface": §6:235 means no new command/tool/MCP surface, and §6:233 plus Consequences:284 already contemplate a report-only finding.

# Technical claims — I read every one. All check out except the links.

- `sync` skips `no_pr` — **confirmed**: `lib/src/sync-command.ts:81` is `if (match.status === "no_pr") continue;` inside the verdict-map loop over `reported` (79–84). The spec's `81–83` and its consequence (containers carry no branch, so they never enter that map) both follow.
- `report` aggregates per container — **confirmed**: `ReportContainer` is defined at `lib/src/report.ts:13`; `aggregateReport` builds one row per **story under an epic** (`report.ts:98–101`), leaves are excluded by construction (`report.ts:103–104`). The spec's "one entry per story under an epic" is exactly right, and the cited sibling row (`promotion-policy-018` AC 3) is the `report` AC.
- Parsing rules from `verdict.ts`/`acceptance.ts` — **confirmed line for line**: `COMMENT_HEADING` `/^###\s+(\d{4}-\d{2}-\d{2})\s+@/` (`verdict.ts:38`, `acceptance.ts:77`) is what `lib/src/comment.ts:110` writes (`### ${date} @${author}`), so the Heading row is accurate and handoff headings cannot match; bounded token `(?=$|[ \t(])` (`verdict.ts:48`) is what the spec's "end-of-line, space or `(`" describes; first-match-only per comment (`verdict.ts:84`), append-order tiebreak (`verdict.ts:106`), later-supersedes (`verdict.ts:100–112`) all as written. AC 1's "the boundaries the siblings pin" is honest: `acceptance-convention.test.ts:191` pins the header-token prefix (`accepted:`/`acceptance:` vs `accept:`), which is the class `decides:` belongs to.
- AC 2's "today `VerdictComment` does not [carry author]" — **confirmed**: `verdict.ts:23–31` has `date/order/value/scope`, no author; `acceptance.ts:60–65` records the same gap as "NEW data relative to the verdict parser". The cited `promotion-policy-018` AC 2 says the same.
- `show` can carry an additive field — **confirmed**: `acceptance` is additive within `schemaVersion: 1` (`json-output.md:592`), ungated by the arming (`convention.md:560`, `report.ts:26–30`), and AC 3's "human view gains no field line" is exactly how it ships today (`json-output.md:607`). AC 3's parenthetical "`create` has no `--body` flag" is confirmed against `cli/src/cli.ts:553–586`.
- No new config key — **confirmed**: `productAcceptance: boolean | null` is the existing field (`lib/src/convention.ts:115`, doc comment 106–114), armed by `x-tracker.product-acceptance` (`docs/convention.md:560`, `spec.ts:1010/1060–1061`), and the two behaviours the spec leans on are real: unparseable `.convention.yml` → UNARMED (`spec.ts:1018–1020`) and a deterministic, clock-free message (`spec.ts:1030–1035`).
- AC 7's "capability matrix needs no row change" — **confirmed**: `adapters/capability-matrix.json` has 5 invariants (`same-rules`, `state-in-git`, `discipline-enforceable`, `docs-travel-with-code`, `claim-integrity`) × 3 agents. None is per-convention, and `same-rules`'s mechanism (one kernel classifier, every surface reads it) is unchanged.
- AC 15's `npm run skills:sync` + `cli/src/skill-copy.test.ts` — both exist.
- Edge-case coverage: exploration 025 §Edge cases has exactly 12 rows and all 12 land (bar non-blocking #8 on one of them).
- Cross-references into `promotion-policy-018` (`§States`, `§Surfaces`, `§The promotion policy`, AC 2, AC 3), `docs/agents.md` §Documentation maintenance (457) and §MCP server (444), and `docs/engineering.md` 72/89/137–143/186 all resolve to what the spec says they are. ADR 0021 §2's five product-owner rows match the spec's enumeration in order. Section shape mirrors `spec-promotion-policy-018` exactly (`##` Acceptance/Non-goals with `###` children under Synopsis), so the h3 nesting is the sibling pattern, not a defect.

# Domain neutrality (ADR 0021 §6.2, ADR 0026 §7)

**No software noun is load-bearing in the convention.** The convention's own language in this spec is the `decide:`/`decided:` tokens, the six field names (119–134), the routing rule, and the four state tokens — all neutral, all comparable to `verdict:`/`accept:` and `accepted｜changes-noted｜none｜self-accepted`. The synopsis's *content* is supplier/customer and survives the non-technical reader; the `arggon …` lines at 97–101 name this project's surfaces, which is what a surface list is. Two things to know rather than fix:

- **Line 216–218 and 225 are the one project-relative element**: the routing rule's content is defined by reference to *this* project's ADR 0021 §2 rows and names `priority`, `accept:`, the ADR 0015 waiver, the claim-takeover gate and the human-pushed release. An adopting project has no ADR 0021 §2, so the rule needs restating per adopter — which is why §Boundary line 263 and the carriers item's AC 1 both require the authority map to be restated as unchanged. Inherited verbatim from ADR 0026 §5:197–210, so nothing new is broken here, but it is the spot a non-software adopter will trip on.
- **`CI` at 307 and 266, `repository` at 307/334** are software-flavoured in AC text where the Invariants say it neutrally ("no automated check fails on one", line 44). Nits; not worth a round trip on their own.

# Verified by reading vs. not verified

Verified by reading: the full 416-line spec against ADR 0026 (all 20+ line citations spot-checked, all resolve), ADR 0021 §2, `verdict.ts`, `acceptance.ts`, `sync-command.ts`, `report.ts`, `spec.ts`'s product-acceptance detector, `convention.ts`, `comment.ts`, `cli.ts`, the capability matrix, `json-output.md`, `convention.md`, `engineering.md`, `agents.md`, exploration 025, `promotion-policy-018`, `templates/spec.md`, the item, the carriers item, and `references/methodology.md`. Verified by execution: the nine gate rows above.

Not verified: `npm test` in full (I ran the six docs-reading test files, which are the ones a new numbered doc can move; the maker's AC 18 defers full `npm test` to the implementation PR). Nothing in this review depends on it.

# Probes needed

None for this verdict — it rests on reading plus the gate observations above, and the evidence ships with the change (the spec file) rather than needing a separate artifact. One post-fix confirmation, and the delivery lead should own it:

```
cd /home/arggon/Projects/ArggonManager-task-spec-owner-decision-brief
npm run arggon -- spec validate     # expect: ok, 37 docs, still exactly 5 DOC_NUMBER_COLLISION
npm run arggon -- spec analyze      # expect: 10 findings, unchanged, none in spec-owner-decision-brief-021.md
npx prettier --check ArggonManager/docs/specs/spec-owner-decision-brief-021.md
```

What it changes: if B1–B4's fixes shift the finding count above 10, the ADR 0017 gate for `task-wire-decision-brief-carriers` closes again and that item stays unclaimable. If a hand-rolled link is introduced while fixing non-blocking #3, `spec analyze` will not catch it — re-run the dead-link check by hand (`cd ArggonManager/docs/specs` and test each `(`..`)` target).

**Merge recommendation: no-merge.** Blocking B1–B4 plus non-blocking 1–5 are all in the single file this PR adds; the fix is one editing pass and no re-design. Re-review after that pass is a diff read, not a re-analysis.
