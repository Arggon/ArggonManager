---
type: task
status: in_progress
id: task-wire-decision-brief-carriers
title: "Wire the decision-brief convention into the carriers, the generated delivery-lead contract, both skill copies and the ADR 0016 adoption channel"
assignee: arggon-delivery-lead
branch: feat/task-wire-decision-brief-carriers
parent: role-model-foundation
labels: [methodology, seam, adopters]
priority: p0
created: "2026-10-06"
updated: "2026-10-06"
claimed_at: "2026-10-06T16:31:29.059Z"
depends_on: [task-spec-owner-decision-brief]
worktree_path: /home/arggon/Projects/ArggonManager-task-wire-decision-brief-carriers
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-wire-decision-brief-carriers.md
  Leaves live only under a story. id is the filename stem: task-wire-decision-brief-carriers.
  CLI `arggon create task wire-decision-brief-carriers` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Wire the decision-brief convention into the carriers, the generated delivery-lead contract, both skill copies and the ADR 0016 adoption channel

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

- [x] Carriers carry the convention: `docs/agents.md` §Orchestration and `docs/engineering.md` §Roles and authority state the six brief fields, the answer grammar and the routing rule, with the ADR 0021 §2 authority map restated as **unchanged** — the content is fixed by [spec-owner-decision-brief-021](../../docs/specs/spec-owner-decision-brief-021.md), not re-decided here
- [x] The **software worked example** appears in the carriers, labelled as this project's worked example only — never as the convention's own language (ADR 0026 §7, spec AC 14). The spec's own non-software example stays; the carriers carry the software one alongside it
- [x] The generated `arggon-delivery-lead` contract gains the duty, phrased in role language ("what the lead brings to the product owner"), **citing** §Roles and authority rather than duplicating it. Edit the **template** `templates/docs/opencode/agents/arggon-delivery-lead.md` (recorded in `x-generated`: `ArggonManager/.convention.yml:84–85`) and let `arggon init` regenerate the worktree copy — do not hand-edit the generated file
- [x] A **dated amendment to ADR 0026's Consequences** records the chosen surface — `show --json` carries the additive `decision_brief`, `report` and `sync` stay byte-identical — which ADR 0026 §Consequences left to this chain ("Not decided here: which read-only surface reports a brief that was never answered"). Nothing above the amendment note is rewritten
- [x] The skill carrier updated from its **single committed source**: edit `skills/arggon-cli/references/orchestration.md` (and `methodology.md` if the pipeline table needs it), run `npm run skills:sync`, and let `cli/src/skill-copy.test.ts` decide. **Corrected 2026-10-06:** the earlier wording said "both skill copies … `.agents/skills/arggon-cli/` and `skills/arggon-cli/`"; `.agents/skills/` is **gitignored and generated** (`.gitignore:14`) and only `skills/arggon-cli/**` is committed, so there is no second copy to land in the PR — the parity test regenerates it
- [x] The ADR 0016 adoption channel names the change in the release note and `arggon init --propose` delivers the convention to adopters
- [x] **Kernel implementation is NOT this item's job** — the parser, the `show` field, the finding and its tests are `task-implement-decision-brief-kernel` (spec AC 1–8). This item carries the prose and the generated seam; keep the two PRs disjoint
- [x] The three live cases named in exploration 025 are re-briefed or recorded as decided under the new convention, so the convention ships against real input rather than a fixture alone

## Notes

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG

**Blocked by the ADR 0017 hard gate.** Do not claim this until `task-spec-owner-decision-brief` exists and `arggon spec analyze` reports no NEW findings. Implementing the convention before its spec clears the gate is the exact failure the gate exists to prevent.

Behavioral change: it reaches every adopter's tree through the generated seam, so the surfaces are carriers + both skill copies + the generated contract + the ADR 0016 channel. **A Behavioral change must land with both skill copies byte-equal in the same PR** (`.agents/skills/arggon-cli/` and `skills/arggon-cli/`) — run `npm run skills:sync` and let the drift test decide, do not hand-sync.

### Acceptance (superseded — the lead's original filing, kept as history)

<!--
  Demoted from `## Acceptance` on 2026-10-06. Written into a comment as a heading,
  it created a SECOND `## Acceptance` in the body, so the live contract stayed a
  template placeholder while this draft shadowed it — and the done gate reads the
  live section (ADR 0025), so this item could not have been flipped honestly.
  The live section above is authoritative. The two rows this draft is missing are
  in it: the software worked example and the dated ADR 0026 amendment, both of
  which spec-owner-decision-brief-021 assigns to this item.
-->

- [ ] `ArggonManager/docs/agents.md` §Orchestration and `ArggonManager/docs/engineering.md` §Roles and authority carry the convention: brief fields, answer grammar, routing rule, and the unchanged ADR 0021 §2 authority map
- [ ] The generated `arggon-delivery-lead` contract gains the duty, phrased in role language ("what the lead brings to the product owner"), citing §Roles and authority instead of duplicating it
- [ ] Both skill copies updated and **byte-equal**; `npm run skills:sync` run; the skill drift test green
- [ ] The ADR 0016 adoption channel states the change in the release note and `arggon init --propose` delivers the convention to adopters
- [ ] Report-only `spec analyze` finding shipped and tested; **no transition, command or CI lane consults it** — asserted by a test, not by prose
- [ ] Tests travel with the change: brief/answer parsing, supersede-by-later-`decided:`, the routing rule, and the opt-in finding
- [ ] The three live cases named in exploration 025 are re-briefed or recorded as decided under the new convention, so the convention ships against real input rather than a fixture alone

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-06 @arggon-delivery-lead

**Methodology impact class: Behavioral** (ADR 0016; `docs/agents.md` §Changing the methodology itself). Agents must re-learn something — there is a new delivery-lead duty and a new item-level convention — so this ships through the ADR 0016 propose channel, and the release note names it.

**Which carriers move:**

- `docs/agents.md` §Orchestration and `docs/engineering.md` §Roles and authority — the convention and the routing rule, with the ADR 0021 §2 authority map restated as unchanged
- the generated `arggon-delivery-lead` contract, both twins (`templates/docs/opencode/**` and `templates/docs/zcode/**`), regenerated through `arggon init` so the materialized copies and `x-generated` checksums stay honest
- `skills/arggon-cli/references/orchestration.md` — the committed skill source; `npm run skills:sync` and `cli/src/skill-copy.test.ts` regenerate the copy (`.agents/skills/**` is gitignored, so there is no second committed copy)
- a dated amendment to ADR 0026's Consequences naming the surface the kernel implemented

**Impact class on the carrier edit itself:** the carriers state the convention; the enforcing surface is `show --json`'s additive `decision_brief` field and the opt-in `UNANSWERED-DECISION-BRIEF` finding, both shipped in `task-implement-decision-brief-kernel` (merged, PR #662). Nothing here adds a command, a gate, a config key or a frontmatter field.

Row 6 of this item's live contract asked for the release note to name the change. `CHANGELOG.md` is **release-please-generated** from conventional-commit subjects (`.release-please-manifest.json`, `release-please-config.json`), not hand-edited — so the mechanism is the commit type (`docs:` maps to the release "Changed" section) plus this declaration, which is the form ADR 0016 actually asks for. Recorded here rather than by hand-editing a generated file.

### 2026-10-07 @arggon-standards-reviewer
verdict: request-changes

Two findings, both small and both introduced/owned by this change: a **dead cross-reference in the ADR amendment** (the item's central deliverable, and nothing in CI catches it), and **row 8's evidence is uncommitted**. Everything else is clean — see the evidence below.

## Evidence I verified by reading (not by running gates)

**Scope is prose only, no behavior.** `git diff --name-only origin/main...HEAD` contains no `.ts/.js/.json` source; the only code-adjacent file is the generated `x-generated` state (`ArggonManager/.convention.yml`). No new command, flag, frontmatter field, config key or gate. Nothing re-decides ADR 0026 or the promotion tiers; the §Boundary table is respected.

**Restatements match ADR 0026 §§1–7 and the spec, not "almost".**
- Six fields in order, the 2-or-3-options-never-one rule, field 5 mandatory, field 6 absolute date, and the "restate it in their own words" test — all present and matching ADR 0026 §1 / spec §The record.
- Routing rule lists exactly the five authority-map rows (direction and priority, container acceptance, residual risk, claim takeover, release) plus hard-to-reverse calls — matches ADR 0026 §5 and the live authority map in `engineering.md:89`.
- Default-direction constraint (reversible/"hold" for hard-to-reverse) and "a brief can never make an irreversible act happen because nobody replied" — matches ADR 0026 §3.
- Report-only surface: `show`'s additive `decision_brief`, one opt-in finding (same `x-tracker.product-acceptance` arming), `report`/`sync` byte-identical — matches the merged code (below).

**Domain neutrality (ADR 0021 §6.2 / ADR 0026 §7).** Both `engineering.md` §The decision brief and `agents.md` §Decision briefs label the software example explicitly ("This project's worked example — software, an example only"; "software is **this project's** example, never the convention's vocabulary"). The convention's own language — six field names, `decide:`/`decided:`, four states, routing rule — carries no load-bearing software noun. The non-software supplier example stays in the spec.

**The carried statements are true against the merged kernel.** `lib/src/operations.ts:169,187` adds `decision_brief` beside `acceptance`, computed via `acceptanceBody(result.item)` (canonical body, so a comment-filed brief classifies). `lib/src/report.ts` `ReportContainer` carries only `acceptance` — no `decision_brief`. `lib/src/sync-command.ts:81` skips `no_pr`, so a brief on a PR-less item is invisible there. `cli/src/spec.ts:1024,1131` adds `UNANSWERED-DECISION-BRIEF` under the reused `productAcceptanceArmed` gate, unscoped by type/status. `.gitignore:14` confirms `.agents/skills/` is gitignored/generated; `skills/arggon-cli/references/orchestration.md` is the committed source and the committed diff touches only it (generated copy differs by the provenance marker line only — in sync).

**Skill/generated-seam correctness.** The PR edits the committed skill source and the two templates, then lets `arggon init` regenerate the materialized `.opencode/.zcode` copies; `x-generated` checksums moved with them and match the on-disk generated files (I hashed both: `a833e431…` opencode, `d54d4301…` zcode). Nothing relies on a file absent from an adopter tree: the convention reaches adopters through the bundled skill (`BUNDLED_SKILLS` in `cli/src/docs.ts:281`) and the generated contract; `docs/agents.md`/`docs/engineering.md` are this repo's own carriers, not templates.

**ADR 0026 amendment follows house style.** Blockquote, "nothing above this note is rewritten", links spec + merged PR #662. The sibling ADR 0021 amendment correction it cites ("`sync` left byte-identical") is quoted accurately, and choosing `show` over `report` for an item-level record is justified.

## Findings

### Blocking — F1: dead cross-reference in the ADR 0026 amendment
`ArggonManager/docs/adr/0026-owner-decision-brief.md:302` links `[spec `owner-decision-brief-021`](./specs/spec-owner-decision-brief-021.md)`. ADRs live in `docs/adr/`, so `./specs/…` resolves to `docs/adr/specs/`, which does not exist — the link is dead. Every other ADR→spec link uses `../specs/` (`0010:7`, `0019:58`, `0020:19`). This link is **added by this PR** (absent on `main`). No link-checker gate exists, so nothing catches it. Fix: `../specs/spec-owner-decision-brief-021.md`. (Note the same pattern already sits in ADR 0021:327 — pre-existing, not this PR's to fix, but do not propagate it further.)

### Blocking — F2: row 8's routing-decision evidence is uncommitted
The branch commit body and the item comment claim "Routing decisions recorded on the three live cases from exploration 025", and `tools.arggon.show` returns the three `routing decision under ADR 0026` comments. But those comments are **staged-only in the primary checkout** (`git status --short` → `M `), and absent from every ref: `git log --all -S "routing decision under ADR 0026"` → nothing; both `origin/main` and `feat/task-wire-decision-brief-carriers` → 0 hits. Evidence that does not travel with the change and lives in an uncommitted working tree is a claim I cannot find on the record. Commit those three item edits (or explicitly defer them on a filed follow-up) so row 8 is durably met.

### Non-blocking — F3: commit `2fde2846` message and ordering
`chore(tasks): generated init docs (37 files)` changed **3** files, not 37: the two generated `arggon-delivery-lead` copies and `.convention.yml`. It also committed the generated copy **ahead of** the template edit (`0e547431`) — at `2fde2846` the generated file carries the duty while its template does not, so `arggon init` at that commit would strip it. Harmless at tip (generated == template, checksums match) but the seam was momentarily inconsistent. The wholesale `generatedAt` timestamp churn across ~37 entries is inherent to a batch `arggon init`; it belongs with the carrier change, not as unrelated noise — but the message should not say "37 files". Also, the plugin checksum moved (`bb7ac137…` → `0d454f9a…`) because the kernel PR changed the bundle source without re-recording its generated checksum; `2fde2846` is partly catching that up. Fine to keep, worth a line in the commit body.

### Node on the item's rows I was asked to challenge
- **Row 6 (adoption channel / release note):** I accept your call. `release-please-config.json` maps `docs` → "Changed", and the subject `docs(methodology): …` names the change; the commit body carries the `init --propose` instruction (release-please emits the subject by default, so the changelog line is thinner than the body — still adequate to "name it"). `init --propose` delivers the convention through the bundled skill and generated contract, confirmed by the mechanism. Not a hand-edit of a generated file. Fine.
- **Row 8 (three live cases):** your classification is right — none of the three owes a brief under §5 (all config/prose-reversible lead calls), and manufacturing briefs would be noise. I am not challenging the decision. I am challenging only its **durability** (F2).

## Gates — expected vs observed (re-run by me at `0e547431`)

| Gate | Expected | Observed |
|---|---|---|
| `npm run arggon -- validate` | ok | `ok (0 warning(s), convention v5)` |
| `npm run arggon -- spec validate` | ok, pre-existing collisions | `ok (37 doc(s), 5 warning(s))` — all 5 pre-existing `DOC_NUMBER_COLLISION` |
| `npm run arggon -- spec analyze` | 11, extra is date-driven | `11 finding(s)`. I reproduced **11 on `main` too** (`1316dbde`, after rebuild). Extra = `DECISION-PENDING-EXPLORATION` on `exploration-methodology-improvements-014` (created 2026-09-29, 7-day threshold, now 2026-10-07). **I confirm the caller's explanation: not this change.** (The committed baseline is stale at count 6 and pins a different decision-pending file, so `--baseline` drift-compare is not a usable cleaner here.) |
| `npx prettier --check` changed files | clean | `All matched files use Prettier code style!` |
| `npm run test:structure` | 5/5 | `5 passed; 0 failed` |
| `npm run lint:structure` | clean | exit 0, no findings |
| `cli/src/skill-copy.test.ts` + `skill-generated-commands.test.ts` | green | `12 passed` |
| `cli/src/init-docs.test.ts` | green | `42 passed` |
| `npm run check:plugin` | current | green (bundle regenerated, no diff) |
| `npm test` | green | `133 files / 2837 passed` |

## Not verified / out of scope
No behavioral change, so no smoke probe was owed and none was run. I did not run the ADR 0016 `init --propose` against a scratch adopter tree (the proposal mechanism is exercised by `cli/src/init.test.ts`, 42 passing). Nothing else remains unverified.

## Merge recommendation
**No-merge as-is.** Both blockers are one-line fixes (F1 path; F2 commit the three item edits). After those, the change is approvable: scope, domain neutrality, restatement fidelity and the merged-code claims all hold. F3 is cosmetic.

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-06 @arggon-delivery-lead

**verdict: both blockers fixed and pushed (cb556852) — approve subject to CI.**

**F1 — dead cross-reference in the ADR 0026 amendment.** Confirmed and fixed. `./specs/...` resolves to `docs/adr/specs/...`; the amendment now uses `../specs/` like every sibling ADR. Verified by resolving the link against the ADR's own directory, not by eye: it targets an existing file, and the dead form now occurs **zero** times at the branch tip. No link gate catches this class, which is exactly why it was worth the reviewer's pass.

**F2 — the row-8 evidence did not travel with the change.** This one was worse than the review stated, and the review was right to block on it. The three routing-decision comments were written while this session was moved into the carriers worktree, so the tracker committed them **on the branch**, not on `main` — and they were not on the branch tip either by the time it was checked, because that commit predated the rebase. Net effect: evidence I claimed in a comment existed nowhere durable.

Fixed by landing all three on `main` (42126a94), verified reachable: each of the three items now carries its routing decision on `origin/main`.

**A note on my own error, because it is the second time this session.** Both this and the earlier `task-implement-decision-brief-kernel` slip came from the same cause: a tracker write made from a worktree lands on that branch, and I then described it as if it were on `main`. The rule that would have caught it is the one this repo already states — read the item back from the ref you are actually claiming about. I am recording it here rather than quietly fixing it.

**F3 (non-blocking, not fixed):** commit `2fde2846` says "37 files" and changed 3. The message is inaccurate but the content is right, and amending a pushed commit to fix a message is worse than the inaccuracy. Left as is, deliberately.

**Reviewer's own confirmations, which I accept and did not re-litigate:** prose only, no behavior; every restatement matches ADR 0026 §§1–7 and the spec; domain neutrality holds with the software example explicitly labelled; the claims about `show`/`report`/`sync` and the skill-copy mechanism are true against the merged code; §Boundary respected.

**On `spec analyze` reading 11 rather than 10:** confirmed **not** this change. `main` reports 11 too once `lib/dist` is rebuilt. The extra finding is `DECISION-PENDING-EXPLORATION` on `exploration-methodology-improvements-014`, which is date-driven — created 2026-09-29 against a 7-day threshold, and the clock rolled to 2026-10-07 during this session. The ADR 0017 gate called it "10, none new" all chain and that was correct at the time; it is time that moved, not the corpus.
