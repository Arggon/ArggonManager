---
type: task
status: done
id: task-adr-0026-owner-decision-brief
title: "ADR 0026: the bounded plain-language decision brief — a delivery lead brings a decision to the product owner with options, one recommendation, and a default that executes unanswered"
assignee: arggon-delivery-lead
branch: feat/task-adr-0026-owner-decision-brief
parent: role-model-foundation
labels: [methodology, roles, adr]
priority: p0
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-adr-0026-owner-decision-brief.md
  Leaves live only under a story. id is the filename stem: task-adr-0026-owner-decision-brief.
  CLI `arggon create task adr-0026-owner-decision-brief` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0026: the bounded plain-language decision brief — a delivery lead brings a decision to the product owner with options, one recommendation, and a default that executes unanswered

## Context

<!-- Why this task exists. -->

## Acceptance

The live contract for this item (ADR 0025: boxes in a dated `## Notes` block are
history, not the contract the done gate reads). PR #659.

- [x] ADR 0026 written at `ArggonManager/docs/adr/0026-owner-decision-brief.md` with Status/Date/Deciders + Context / Decision / Consequences / Alternatives, per `ArggonManager/docs/engineering.md` §ADR process, and its row added to `ArggonManager/docs/adr/README.md`
- [x] ADR states the **methodology impact class: Behavioral** and links exploration 025 as Input
- [x] The six brief fields and the answer grammar are written out as the convention, not as a description of one
- [x] The ADR states explicitly that **ADR 0021 §2 is unchanged** — no authority moves, and the delivery-lead contract still recommends rather than decides
- [x] The **routing rule** is normative (which decisions owe a brief) and the "brief on every decision" rejection is recorded under Alternatives
- [x] The **reversal condition** is recorded verbatim, falsifiable, with both limbs
- [x] Exploration 025's Decision section links this ADR (closes the exploration-vs-ADR gap `task-exploration-decision-records` exists to prevent)
- [x] ADR lifecycle honored: Proposed in the PR, Accepted on merge — never rewritten in place afterwards

Box 8 is deliberately left unticked by the maker. Its first half ships in this PR
(Status `Proposed`, plus the status note recording the lifecycle); its second half
— `Accepted` on merge — is the delivery lead's merge-commit action, not work in
this PR, so it cannot honestly be verified from here. It belongs to the same commit
that flips the status.

## Notes

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG

Input: [exploration-owner-decision-brief-025](../../../docs/explorations/exploration-owner-decision-brief-025.md) (2026-10-06) — classification **greenfield** (entered bounded, upgraded in the ground phase: there is no request-side convention anywhere, and this is a Behavioral change reaching every adopter through the ADR 0016 channel).

**The decision the ADR records.** Adopt C1: a bounded, plain-language **decision brief** the delivery lead writes **on the item**, answered by a bounded `decided:` comment. Authority does not move — ADR 0021 §2 stands verbatim; the lead still recommends, the product owner still decides. This record adds only the missing **request side**.

Brief fields, in order: the question in one sentence (technical term translated into its effect on the product) · why it matters in outcome terms, never mechanism terms · 2–3 options each with its plain-language consequence, including the honest cost of the recommended one · **the recommendation and why** · **the strongest argument against that recommendation** · **the default that executes if no answer arrives, and the absolute ISO date**.

Two load-bearing constraints, both from the exploration's findings:

- **The stated default is what makes it safe to send.** A brief with a default is a time-boxed proposal; a brief without one is a blocker. This is ADR 0021 §3's "an absent product owner can never wedge a container's children" applied concretely.
- **A recommendation-first brief is a confirmation-bias vector**, mitigated by convention not by gate: the self-contradiction line, and `decided: other` as a first-class unremarkable reply. Grounded in Klein's premortem finding (HBR, 2007-09).

**Routing rule (the other load-bearing half).** A brief is owed **only** for the ADR 0021 §2 authority-map rows and for hard-to-reverse calls. Everything else the lead decides and records as a plain item comment. Mandating a brief on every decision is explicitly rejected — it inverts "the model must reduce per-item human cost, never add one".

**Rejected, with reasons recorded:** C2 teach-only (fixes tone, not the gap — the question still lands in chat and the answer has nowhere durable to live); C3 a `docs/decisions/` corpus (second home, second style, forks the record against the ADR; the volume does not justify a surface); a frontmatter field (schema change carrying a fact a comment already carries — the objection that already rejected `role:`/`owner:`); any gated transition (forgeable or unusable without an identity layer, inherited from ADR 0021 §4).

**Falsifiable reversal condition**, to be written into the ADR verbatim: revisit if (a) briefs are routinely rubber-stamped — measurable as answer latency collapsing to "immediate, no scope note", or an answered-brief ratio near 1.0 with zero `decided: other` replies across a meaningful sample; or (b) more real decisions are made in chat than in briefs, which would mean the routing rule is wrong, not the convention.

### Acceptance (superseded — this is the lead's original filing, kept as history)

<!--
  Demoted from `## Acceptance` on 2026-10-06. Written into this comment as a
  heading, it created a SECOND `## Acceptance` section in the body, and the
  done gate resolved to this one instead of the live contract at the top of the
  file — so the flip was refused on eight boxes that are history, which is
  exactly what ADR 0025 says they are. The live section is authoritative; these
  rows are the draft the maker transcribed into it.
-->

- [ ] ADR 0026 written at `ArggonManager/docs/adr/0026-<owner-decision-brief>.md` with Status/Date/Deciders + Context / Decision / Consequences / Alternatives, per `ArggonManager/docs/engineering.md` §ADR process, and its row added to `ArggonManager/docs/adr/README.md`
- [ ] ADR states the **methodology impact class: Behavioral** and links exploration 025 as Input
- [ ] The six brief fields and the answer grammar are written out as the convention, not as a description of one
- [ ] The ADR states explicitly that **ADR 0021 §2 is unchanged** — no authority moves, and the delivery-lead contract still recommends rather than decides
- [ ] The **routing rule** is normative (which decisions owe a brief) and the "brief on every decision" rejection is recorded under Alternatives
- [ ] The **reversal condition** is recorded verbatim, falsifiable, with both limbs
- [ ] Exploration 025's Decision section links this ADR (closes the exploration-vs-ADR gap `task-exploration-decision-records` exists to prevent)
- [ ] ADR lifecycle honored: Proposed in the PR, Accepted on merge — never rewritten in place afterwards

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG

### 2026-10-06 @arggon-delivery-lead

Priority provenance: **`p0` set by the product owner on 2026-10-06** ("this is top priority. Let's start working on this."), after reading exploration 025. Recorded because ADR 0021 §6.1 boundary 1 makes the `priority` field the product owner's and the lead's call is sequencing only — the field, not the recommendation, is what carries their decision here.

**Delivery sequencing (mine, not the priority call).** The chain is strictly causal, so it runs as three single-item waves, not a parallel wave:

1. **W1 — this item (ADR 0026).** The decision is already taken and recorded in exploration 025's Recommendation; the ADR is the record of it. Nothing before it can be written.
2. **W2 — `task-spec-owner-decision-brief`.** Specifies the convention and turns exploration 025's edge-case table into acceptance criteria.
3. **W3 — `task-wire-decision-brief-carriers`.** **Blocked by the ADR 0017 hard gate**: no claim until W2's spec passes `arggon spec analyze` with no NEW findings.

File-disjointness is not the constraint here — causality is: each item consumes the previous item's artifact, so overlapping waves would be a race, not a wave. They are still separate worktrees, one maker each.

**Watch for in W3:** it is Behavioral, so both skill copies must land byte-equal in the same PR and the ADR 0016 release note must name the change. There is a standing item for the drift-gate interaction (`bug-seam-drift-gate-blocks-new-generated-seam-content`) — a PR adding new generated seam content fails the drift gate until a release + re-pin, so W3 must be checked against that before it is opened, not after it goes red.

### 2026-10-06 @arggon-maker

**Maker report — ADR 0026 landed on `feat/task-adr-0026-owner-decision-brief`, PR #659** (draft status: Proposed; Accepted on merge).

Docs-only change set, three files, one commit `76e0a4bc`:

- `ArggonManager/docs/adr/0026-owner-decision-brief.md` (new, 283 lines) — Status Proposed · Date 2026-10-06 · Deciders product owner (Gonzalo), delivery lead (Arggon) · Input exploration 025 · **Methodology impact class: Behavioral** with the ADR 0016 channel reference, matching ADR 0021/0022's metadata shape.
- `ArggonManager/docs/adr/README.md` — one index row. The Title cell copies the `# 0026 …` H1 **byte for byte** (101 chars, verified programmatically) and the Status cell reads `Proposed`. **No `- Index title:` line was added**, so the still-open `task-decide-adr-0021-index-title-editorial-vs-verbatim` is untouched. Title is 101 chars against the table's existing 110-char maximum column, so prettier re-pads nothing.
- `ArggonManager/docs/explorations/exploration-owner-decision-brief-025.md` (new, 462 lines) — the ADR's Input, brought into the repo as acceptance requires. **Only the `## Decision` placeholder was filled** (it now links ADR 0026 and records what the ADR settles); the body above it is byte-unchanged.

### Gates — command → expected → observed

| Gate                                              | Expected          | Observed                                                                                                  |
| ------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| `npx prettier --check` (3 files)                  | clean, and stable | `--write` reported **all 3 unchanged**; `--check` then green. Re-ran after the last edit: unchanged again |
| `npm run arggon -- validate`                      | `ok:true`         | `arggon validate: ok (0 warning(s), convention v5)`                                                       |
| `npx vitest run cli/src/adr-index-parity.test.ts` | green             | 1 file, **9 passed**                                                                                      |
| `npm run test:structure`                          | pass              | **5 passed**, 0 failed                                                                                    |
| `npm run lint:structure`                          | no findings       | no findings                                                                                               |
| `npm run test` (full, not required)               | green             | **132 files / 2803 tests passed**                                                                         |

**One honest note on the full suite.** Its first run failed `cli/src/headless-ci.test.ts` on `run \`npm run build\` first`— the worktree had never produced`dist/cli.js`(the earlier`[kernel-artifacts] freeze not complete`warning said the same).`npm run build`, then that file passed 7/7 and the full suite was green. Environmental, not caused by this change; reporting it because a red first run is worth naming rather than hiding.

### On the two hard acceptance boxes

**Domain neutrality** (§7, ADR 0021 §6.2) got a deliberate pass, not a hopeful one. I grepped the finished file for software vocabulary and then removed the two places where it leaked into the convention itself: the routing rule's record list now reads "the `priority` field, an `accept:` comment, the ADR 0015 waiver, **the claim-takeover gate** and the human-pushed release" instead of naming `--steal`, and §6's closing constraint says "the existing comment command" rather than `arggon comment`. Software now survives only where a domain-neutral record cannot: the two **worked-example** spots, labelled as such — "in software, no pipeline goes red over an unanswered brief" and §7's "the worked example for this project is software". A reader who has never written anything technical can follow §1–§6 without a software noun.

**Verbatim reversal condition** (§8) carries both limbs as given: (a) latency collapsing to "immediate, no scope note", or an answered-brief ratio near 1.0 with zero `decided: other` replies across a meaningful sample; (b) more real decisions made in chat than in briefs, which would mean the routing rule is wrong, not the convention.

No `skills/`, `.agents/skills/`, `templates/`, `.opencode/` or `cli/` file was touched — the carriers and both skill copies belong to `task-wire-decision-brief-carriers`.

### handoff 2026-10-06 @arggon-maker — next: Review PR #659 and merge; flip Status to Accepted on merge, then tick the live ## Acceptance boxes

- branch: feat/task-adr-0026-owner-decision-brief
- open questions: Should the acceptance boxes be ticked by the lead or left for merge verification?

### 2026-10-06 @arggon-maker

**Change request addressed — commit `e2023c1a` on `feat/task-adr-0026-owner-decision-brief`, PR #659 left open.**

All four blocking findings and all five non-blocking ones are fixed, all as prose in files already in the PR. Every finding was re-verified against the tree before I edited; two of them were confirmed by re-fetching the cited source rather than trusting the review.

### Blocking

**B1 — default direction.** §3 now constrains direction, not just presence. For a hard-to-reverse call the default is **the reversible or "hold" option, never the more aggressive one**; where no such default exists the default is **"hold"** and the brief says so explicitly; for every other decision that owes a brief it is the lead's own recommended option. The consequence is stated in the ADR's own words: **a brief can never make an irreversible act happen because nobody replied.** §3 now says why that clause is load-bearing rather than merely prudent — §5 routes hard-to-reverse calls here, so silence fires exactly where an unforced default does the most damage. The two clauses are also explicitly tied: the direction rule is "the clause that makes the first one safe", and a reader who never opens the brief and a repository with no reader both land on the same safe outcome, which is what lets a brief be sent without a blocker status ever existing.

**B1b — the contradiction.** Silence no longer claims the product owner chose anything by not answering. §3 now says the choice was made and put in writing **by the lead, before the brief was sent, precisely so the owner could override it** — silence selects a default the owner was shown in advance, not one they picked by abstention. That formulation holds for both halves: the no-product-owner case is now folded into the same paragraph as the ordinary silence case rather than sitting two paragraphs below it to contradict it.

**B2 — live `## Acceptance` published.** The eight criteria now live in the item's live `## Acceptance` section, replacing the `<!-- The real acceptance criteria… -->` placeholder; the placeholder is gone and the dated-comment copy is left as history. Verified against the kernel's own view: **8 live rows, 7 ticked, 1 unticked**.

**Box 8 is deliberately unticked, and this is the one judgement call in the set.** Its first half ships here (`Status: Proposed` plus the status note). Its second half — Accepted on merge — is the merge commit, which per the lead's own answer is not work in this PR, so it cannot honestly be verified from here. It is the same commit that flips the status. The section says so in a line under the checklist. Tick it in the merge commit and the contract is complete; I would rather hand you one open box with a stated reason than eight ticked ones where one is unearned. Say the word if you would rather I tick it now.

**B3 — misattributed quotation, fixed.** The clause is now attributed to `docs/engineering.md` §Review bar → Product acceptance, where `grep` confirms it verbatim at `:145`, with ADR 0021 §3 kept for the rule and credited with its own wording ("compliant by default and never blocked", `0021:283`). Confirmed independently: the phrase "wedge a container" occurs **zero** times in ADR 0021.

**B4 — the fabricated quotation, restated.** The quoted fragment is deleted. The row now reads what the item actually says: **partially — it is a decision item, not a bug, and states the choice in mechanism terms**. Grounded in the item's own frontmatter (`type: task`, its title asking whether to arm a setting or record why the report-only default is kept) and its acceptance checklist ("Decision recorded on the item…"). Table alignment verified intact — all five rows measure 58/112/88/26, so prettier had nothing to rewrite.

### Also fixed

- **N1** — §8's "counters in §4" → "the two countermeasures in §4, read as conventions rather than as counters".
- **N2** — Context's "Measured, not assumed" replaced with "Three open items of the same shape, verified 2026-10-06", stating what was actually checked (each `todo`, unassigned, no recommendation, choice stated in mechanism terms), naming the product-owner framing as **an inference rather than something the items ask in their own words**, and recording the caveat that under §5's own routing rule two of the three would not owe a brief at all. The paragraph now says the load-bearing evidence is the product owner's request.
- **N3** — line 135's confirmation dialog is now domain-neutral and the software shape is labelled: "asks a question the reader has no way to decline — in software, the shape of a confirmation dialog with no cancel button."
- **N4** — NN/g heuristic-2 restored to the source's "**that** seem" (the reviewer's reading confirmed against the live page, including the 1994 / last-reviewed-2024-01-30 dating).
- **N5** — MADR 0015's three drivers now name all three; the missing one is "MADR should contain fields important to the ADR decision process" (confirmed against the live page).
- **The §6.2 attribution** — "any project — not only software" now traced to **ADR 0020 §Decision.1**, quoted in ADR 0021's §6 amendment preamble at `0021:20`, with §6.2 credited as the substance leaned on.

### One more citation defect I found in my own text, beyond the six

Same class as B3, in the sentence about the `priority`-style frontmatter field: I cited the `role:`/`owner:` rejection to **ADR 0021 §Consequences**. It is at `0021:417`, under **§Alternatives considered** (`## Consequences` is at `:376`, `## Alternatives considered` at `:405`). Corrected. I checked every other ADR 0021 citation in the file the same way — §4, §2, §6.1 boundary 1, and §3 (`:283`, `:297` are both inside §3) are all accurate, and "reduce per-item human cost, never add one" is verbatim at `0021:297`.

### Quotation re-check, as asked

Every quotation in both files re-checked against its source, and reported rather than quietly patched. Verified **unchanged and correct**: Klein (HBR 2007-09, fetched live), the NN/g confirmation-dialog quotes, the Plain Writing Act "written for its specific audience" and the archive note (fetched live), "reduce per-item human cost, never add one", "compliant by default and never blocked", "forgeable or unusable", the five authority-map rows. Verified **wrong and fixed**: the three above plus the coordinator-decides fabrication. Nothing else moved.

### Gates — command → expected → observed

| Gate                                              | Expected         | Observed                                                     |
| ------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| `npx prettier --check` (4 files)                  | clean and stable | `--write` reported **all 4 unchanged**; `--check` then green |
| `npm run arggon -- validate`                      | `ok:true`        | `ok (0 warning(s), convention v5)`                           |
| `npx vitest run cli/src/adr-index-parity.test.ts` | 9/9              | **9 passed**                                                 |
| `npm run test:structure`                          | 5/5              | **5 passed; 0 failed**                                       |
| `npm run lint:structure`                          | no findings      | no findings                                                  |

`ArggonManager/docs/adr/README.md` needed no edit: the H1 is unchanged, so the verbatim row and its `Proposed` status still hold. Three files changed, 104 insertions / 45 deletions. Nothing merged, no `done` flip, and no `Accepted` written.

### handoff 2026-10-06 @arggon-maker — next: Re-review e2023c1a, then merge; in the merge commit flip Status to Accepted AND tick acceptance box 8

- branch: feat/task-adr-0026-owner-decision-brief
- open questions: Is leaving box 8 unticked right, or do you want all eight ticked now?; the exploration's intro paragraph still says each item 'asks the product owner' — left as written since the lead filed it; needs…

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — release checked, and it is not broken

**Verdict: the release automation is healthy. There is no release PR because the human trigger was never pushed** — not because anything failed. That trigger is the product owner's step (publishing is a human-only power, `engineering.md` §Authority map), so this is a decision brief, not a fix.

## What I checked, and what it showed

- **`v0.5.0` is the latest release** (2026-10-02, GitHub Release exists, tag exists, and the tag is an ancestor of `main`). Nothing is stranded.
- **release-please runs green on every push** — 5 recent runs, all `success`. It is not failing and not wedged.
- **`v0.5.0..main` is 973 commits**: 13 `feat`, 39 `fix`, 65 `docs`, 719 `chore` (`chore` is mapped to the *Changed* section, so it is deliberately releasable). **52 releasable `feat`/`fix` commits have no home in a release.**
- **`release-please` opens a PR only when a version is requested.** Per `release.md` §What the automation owns, step 1: push a `Release-As: X.Y.Z` trailer commit to `main`. There is no such commit in history, so release-please had no number to propose — it correctly did nothing.
- **No release PR is open** (`gh pr list` — only a dependabot bump), and the `release-please--branches--main` branch still exists from the 0.5.0 cycle, which is why the action's log mentions PR #556: that is the *merged* 0.5.0 PR from Oct 2, re-read for state, not a live one.

## Why this matters, stated plainly

The chain that just merged — ADR 0026, spec 021, the decision-brief kernel and carriers — is **Behavioral** and reaches adopters only through the ADR 0016 channel, which ships **in a release**. Same for the done-gate scoping fix (#656) and everything else since Oct 2. Until a release is cut, none of it produces any value outside this repository: the work is done, merged, and inert.

## What I am NOT doing

I have not pushed a `Release-As` commit. The runbook assigns that to the operator, `engineering.md` §Authority map lists "Publishing a release" as the product owner's, and `release.md` calls npm publishes and GitHub Releases owner-only. Deciding a version number is also a product judgement (minor vs patch, and what the release note leads with) — not mine to take quietly.

**What I can do on your word:** push the `Release-As` trailer (one empty commit), let release-please open the PR, hand-edit the drafted CHANGELOG section to house style, verify the five-file diff, and bring it back to you for the merge. The merge is the release, so that click stays yours.

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — the release deadlock, root cause isolated

**This is not a missing human trigger. It is a config mismatch that has killed the release pipeline since 2026-10-02, while every run reported green.** Pushing the `Release-As: 0.6.0` trailer surfaced it; the trigger was never the problem.

## The cause, measured

`release-please-config.json` never sets `include-component-in-tag`. Per the official schema (fetched 2026-10-07, `schemas/config.json`), **that option defaults to `true`** — so release-please looks for component-prefixed tags. The logs show it hunting:

```
⚠ Found release tag with component '', but not configured in manifest
❯ looking for tagName: arggon-manager-v0.5.0
❯ looking for tagName: lib-v0.5.0
⚠ There are untagged, merged release PRs outstanding - aborting
```

But the tags that actually exist are plain — `v0.2.0 v0.3.0 v0.4.0 v0.4.1 v0.5.0` — because **`release.yml` creates them that way by the decided contract**: `git tag -a "v${VERSION}"` (`.github/workflows/release.yml:101`), and spec-release-pipeline-015 invariant 1 says *"the root tag `vX.Y.Z` names the exact commit being published"*.

So release-please never finds `v0.5.0`, concludes its own merged PR #556 is still untagged, and aborts before opening a new one. **It cannot ever open the next release PR until this is resolved** — a permanent deadlock, not a one-off.

## Why nobody noticed

**Every run reports `success`.** Verified across 13+ consecutive runs since the 0.5.0 cycle — 2026-10-06 and 2026-10-07 alike — every one contains `untagged, merged release PRs outstanding - aborting` and every one is green. The abort is a warning inside a successful job, so the failure is invisible to CI status, to dashboards, and to anyone who did not read the log line. That is the same defect class as `bug-verification-regex-matching-nothing`: a check that cannot fail teaches its reader that nothing is wrong.

## The fix, and which side is wrong

**The config is wrong, not the workflow.** ADR 0018 and spec-release-pipeline-015 both decide `vX.Y.Z` as the tag contract, and `release.yml` — the spec's chosen owner of tag + GitHub Release + publish (spec §Rationale: release-please must NOT own them, because `GITHUB_TOKEN`-created events do not trigger workflows) — implements exactly that. So the fix is to make release-please agree with the decided contract:

```json
"include-component-in-tag": false
```

Added at the top level of `release-please-config.json`, so both packages (`arggon-manager` and `lib`) resolve to the plain `v`-prefixed tag the workflow creates.

**What I am NOT doing:** I am not touching `release.yml`, not renaming or creating tags (the runbook forbids moving or deleting a released tag, and `v0.5.0` is a real shipped release of record), and not choosing the version — that stays the product owner's, and the `Release-As` trailer is already pushed and waiting.

## The gap this exposes, which needs its own item

`release-please-config.json` has **no test and no gate**. Nothing asserts that its tag convention agrees with the tags `release.yml` actually creates, which is why a one-word omission could silently disable releases for five days. After the fix lands, this wants the same treatment the seam pin got: a check that the two agree, so the next config drift fails loudly instead of aborting quietly inside a green job.

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — release PR is READY for the merge

**`#664 chore: release main` is open, `0.6.0`, CI fully green, `CLEAN`.** The release PR was requested by the product owner ("release please, with your recommendation") and is complete through the review step the runbook prescribes. **The merge is the release and it stays the product owner's click.**

## What was actually wrong (two stacked defects, neither a missing trigger)

Pushing the `Release-As: 0.6.0` trailer surfaced that the pipeline had been **dead since 2026-10-02**, with every run reporting green:

1. **`include-component-in-tag` was never set**, and the schema defaults it to `true`. release-please hunted for `arggon-manager-v0.5.0` / `lib-v0.5.0` while the tags that exist are plain `v0.5.0` — because `release.yml` creates them that way by the decided contract (spec-release-pipeline-015 invariant 1, ADR 0018). It never found `v0.5.0`, concluded its own merged PR #556 was untagged, and aborted. **Fixed** (`include-component-in-tag: false`, b7b5f866), verified against the fetched schema; v0.5.0 dereferences to 13d72f5f, exactly PR #556's merge commit.
2. **A stale `autorelease: pending` label on PR #556** — the second half of the deadlock. release-please filters merged PRs by that label (`DEFAULT_LABELS`, `manifest.ts:289`), and it normally flips the label to `autorelease: tagged` when it tags. This repo sets `skip-github-release: true` and lets `release.yml` tag via `git tag`, so **release-please's tagging path never runs and the label is never flipped** — a permanent deadlock by construction. Resolved by creating the `autorelease: tagged` label and moving #556 onto it. Verified: the abort count went 1 → 0 and #664 appeared.

**Nobody had considered the label lifecycle.** `grep -rn autorelease` across the whole repo returned zero hits before this — the label is load-bearing for the pipeline and appears nowhere in the spec, the ADR, or the runbook.

## The review edits applied (three, per the runbook)

- **CHANGELOG curated to house style** — bold name + prose + `(PR, spec)`, no commit links; duplicates from merge commits and rebases collapsed. **The 0.5.0 section and everything older are byte-identical** (append-only invariant verified by diff, then re-verified after prettier).
- **The one-time kernel pin bootstrap** (`release.md` exception): the extra-files JSON updater preserves the range prefix, so the first release PR after an un-pin keeps the caret. The caret had **never** been bootstrapped — `v0.4.0`, `v0.4.1` and `v0.5.0` all shipped with one. Edited to the exact `0.6.0`; from the next release on the rewrite is exact-to-exact and machine-owned.
- **`package-lock.json` resynced** to the exact pin.

The diff is exactly the **five files the spec mandates**: both `package.json`, `package-lock.json`, `CHANGELOG.md`, `.release-please-manifest.json`. Versions in lockstep at `0.6.0`.

## Filed, because they are real gaps this exposed

- **No gate guards the release config↔workflow agreement.** A one-word omission disabled releases for five days inside a green job. The next config drift should fail loudly, not abort quietly.
- **The `autorelease` label lifecycle is documented nowhere** and is load-bearing. Whatever the fix (the workflow flipping the label, or the config accounting for the split ownership), it needs writing down.
- **release-please's abort is a warning in a `success` run** — the same class as `bug-verification-regex-matching-nothing`: a check that cannot fail teaches its reader that nothing is wrong.
