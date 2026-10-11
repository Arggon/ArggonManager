# 0025 Done gate scope: the live `## Acceptance` section, and no contract means no flip

- Status: Accepted
- Date: 2026-10-06
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Programme: `methodology-improvements` (bug-done-gate-counts-checkboxes-inside-comment-blocks)

> Status note (2026-10-11): flipped from `Proposed` to **Accepted** retroactively.
> This record reached `main` in merge `81828441` (PR #656, 2026-10-06) and the
> status line was left behind — the drift tracked as
> `bug-adr-status-drift-merged-adr-proposed`. `docs/engineering.md` §ADR process
> declares the lifecycle "Proposed in a PR → Accepted when merged (or explicitly
> recorded)", so the line now states the state the record has been in since that
> merge. Nothing below this note is rewritten: the six decisions, the measured
> consequence counts and the alternatives considered stand as merged.
>
> Amendment (2026-10-11, `bug-done-gate-whole-body-scan-counts-fenced-repro-boxes`):
> **fenced code blocks are excluded from the scan, on the same footing as dated
> comment blocks.** Decision 1 said the gate reads the live `## Acceptance`
> section with dated comment blocks excluded; the shipped implementation scoped
> the region and stripped comment blocks but still parsed every surviving LINE,
> so a `- [ ]` row inside a fenced block counted as a criterion. Two observed
> sessions today:
>
> 1. a bug item whose own repro is a fenced markdown sample of what a formatter
>    does to a `- [ ]` list item (`bug-prettier-glues-split-inline-code-span`,
>    live section 6/6 ticked, three literal fenced rows) was refused on every
>    flip attempt and the auto-flip automation wedged on it;
> 2. the exclusion ran the OTHER way too — a fenced `### <date> @author` line
>    (a repro of what `arggon comment` writes) opened a comment block and deleted
>    the live section that followed the fence, turning a satisfied item into a
>    `no-live-contract` refusal.
>
> So the rule the gate implements is now ONE sentence, not two:
>
> **The gate reads the item's live `## Acceptance` section; dated comment blocks
> (`### <date> @author`, `### Waiver <date>`) and fenced code blocks are
> excluded from the scan. A flip is refused when that section publishes no
> criterion at all (decision 2 unchanged) OR when the section's own boxes are
> unticked (decision 1 unchanged). Nothing else in the body gates the flip.**
>
> The fence is consulted BEFORE the heading rules, because a fence is content: a
> fenced `## Acceptance` heading cannot open a section, a fenced
> `### <date> @author` heading cannot open a comment block, and an unclosed
> fence runs to the end of the body (CommonMark). Consequences, named: an item
> whose criteria exist only inside a fence has published no contract and refuses
> as `no-live-contract` (never as `unchecked-live-criteria`), which is the same
> trade decision 3 already made for bare boxes — the region decides what the row
> parser is asked about, never the other way round. The row parser
> (`acceptanceRows`) stays fence-blind so renderers keep listing an item's rows
> as written, exactly as decision 5 says, and the container cascade keeps the
> whole-body question (decision 6) — widening it is carried by
> `task-cascade-whole-body-acceptance-defers-this-defect`, not here.

## Context

ADR 0015 gated the `→ done` flip of a claimable leaf on "the body's acceptance
checklist is complete", implemented as a count of unchecked boxes over the whole
item body (`acceptanceComplete`). Two measured consequences, both from
`bug-done-gate-counts-checkboxes-inside-comment-blocks`:

1. **The verdict depended on history, not on the work.** `arggon comment`
   appends a dated `### <date> @<author>` block to the body, and `arggon create`
   has no `--body` flag — so a checklist filed as a comment is the _default_ path
   for a new item, and comment blocks quote criteria verbatim, unticked. Every
   such box was counted as an open obligation. Measured over this repo's 482
   claimable leaves (117 refused before this decision), the pre-fix refusal
   population splits three ways, and only one of the three is unblocked:

   - **5 leaves are unblocked** by scoping — their live `## Acceptance` is
     present and already fully ticked, and the pre-fix refusal came only from
     unticked boxes in dated comment blocks. Two are merged, verified,
     `main`-green items (`bug-validate-does-not-check-frontmatter-present`,
     5 ticked live criteria + 5 unticked comment boxes;
     `bug-engineering-doc-stale-adr-statuses`, 4 ticked + 1 unticked) that could
     not be completed at all.
   - **56 leaves publish no live criteria at all** (section absent, empty, or
     still the template placeholder — the shape `create` scaffolds). They were
     refused before this decision and are refused after it: scoping does not
     unblock them, decision 2 **relabels** them `no-live-contract`. All 56 carry
     unticked boxes in dated comment blocks and nowhere else — which is why they
     are the population the relabel acts on, not the population the scoping
     rescues.
   - **56 leaves keep an unticked criterion in their live section.** They stay
     refused, for the same reason, and decision 2 does not touch them.

   Worse, the rule was not even self-consistent: whether an item could flip
   depended on whether its comment record happened to contain an unticked box, so
   two items with identical live acceptance got opposite verdicts.

   The cost runs the other way and is named in Consequences: scoping plus the
   missing-contract refusal **newly refuses 7 open leaves** — the scaffolds with
   zero criterion rows anywhere in the body, which decision 2 turns from a free
   pass into a loud refusal.

2. **Scoping alone would have been worse.** Restricting the scan to the live
   section fixes (1) and opens a vacuity: an item whose live `## Acceptance` is
   still the `<!-- … -->` template placeholder, while its real criteria sit
   ticked in dated comments, would flip to `done` with **no acceptance contract
   at all**. ADR 0015 explicitly declared such an item ungated ("items without
   any checklist are unaffected — no acceptance contract means nothing to gate"),
   which is exactly the hole scoping widens. Vacuous success is a defect class
   this repo already tracks: `bug-verification-regex-matching-nothing`,
   `bug-wave-probe-file-check-model-dependent`.

The current body is the contract and a dated block is history — a rule this
methodology already states for reviewers ("dated comments are verbatim; the live
body is current state", PR #586/#619). The gate was the last surface that did not
honour it.

## Decision

1. **The gate reads the live `## Acceptance` section.** A claimable leaf's
   `→ done` flip is refused when an **unticked criterion** sits in that section.
   The section is the one headed exactly `## Acceptance` (case-insensitively)
   and ends at the next `#`/`##` heading; dated comment blocks inside it
   (`### <date> @<author>`, `### Waiver <date>`, through the next dated heading
   or the end of the body) are excluded, including any `### Acceptance` a
   reporter pasted into one. Comment blocks are stripped _before_ the section is
   located, so a `## Acceptance` pasted inside a comment cannot become the
   contract. History is never edited to satisfy a gate.
   *(Amended 2026-10-11, see the note at the top: fenced code blocks are
   excluded on the same footing, and the fence is consulted before the heading
   rules.)*
2. **A missing contract is refused too.** The flip is also refused when the live
   section publishes **no criterion at all** — absent, empty, whitespace-only,
   still the template placeholder, nothing but bare `- [ ]` rows, or nothing but
   rows that sit inside a fenced code block. One predicate
   (zero criteria in the live section) covers all of them, so no fourth spelling
   of "no contract" is a way past it, and ticked boxes in a comment record are
   never evidence for a flip that has no live contract to satisfy.
3. **The scaffold carve-out is preserved, on its own axis.** A checkbox with no
   text after it is a placeholder, not a criterion (`bug-empty-template-checkbox`):
   it is never an unmet criterion and never appears in the refusal set. A section
   whose only rows are bare placeholders therefore refuses for decision 2 — for
   having no contract, never for an unfinished box.
4. **The waiver is unchanged** as the single human-only escape, now valid for
   both refusals; the refusal message names the live section and the remedy.
5. **One parser, one input, one region.** The region extraction lives beside
   `acceptanceRows` in the kernel and runs on the canonical body
   (`acceptanceBody`); `acceptanceRows`/`acceptanceCriteria`/`acceptanceComplete`
   keep their whole-body meaning for the acceptance-aware container cascade and
   for renderers, which keep listing the item's rows as written so history stays
   visible. The surfaces that answer the gate's _question_ — the gate itself, the
   board drawer's `acceptance_complete`, and the ZCode goal contract's
   `gateUnchecked` — read `acceptanceGate`, so none of them can contradict it.
   `import-issues` asks the same predicate before offering its waiver.
6. **Containers stay exempt.** The cascade keeps the whole-body question, so no
   contract is enforced twice on one item and a container's auto-completion is
   unchanged by this decision.

## Consequences

- An item can only be completed against criteria a reader can find in its live
  body. The workflow cost is real and named: acceptance criteria must be
  **authored into the `## Acceptance` section**, not only filed as a comment —
  and `arggon create` still has no `--body` flag, so the first write is a
  hand-edit of the item file (or a `create --body` in a later change).
- Freshly scaffolded items are no longer flippable until one criterion is
  written. That is the point of decision 2, and it is enforced loudly: the
  refusal names the section, the shape, and the two remedies. Measured cost:
  **7 open leaves** — the ones with zero criterion rows anywhere — go from
  flippable to refused; 40 more open leaves keep their refusal but under the
  `no-live-contract` label instead of `unchecked-live-criteria`; 3 open leaves
  are unblocked.
- Historical unticked boxes stop being obligations, so an item whose live
  criteria are already ticked completes without rewriting that history — the 5
  leaves named in Context. An item whose criteria live ONLY in comments is
  **not** among them: it has no contract to satisfy and is refused under
  decision 2 until the criteria are written into the live section.
- Behavioural change: agents must re-learn "the live section is the contract"
  before flipping `done`, and every consumer of the gate's verdict reads the new
  predicate. Reaches adopters through the adopter upgrade channel
  ([ADR 0016](./0016-adopter-upgrade-channel.md)); the carrier statements are
  [`convention.md` §Done gate](./convention.md), [`agents.md` §5](./agents.md)
  and the bundled skill.
- `acceptanceComplete` is no longer the gate. Its doc comment says so, and the
  parity corpus compares the gate against an independent oracle of this decision
  rather than against the pre-fix regex (`cli/src/acceptance-parity.test.ts`).

## Alternatives considered

- **Scope only, no missing-contract refusal.** Rejected: it converts a blocking
  defect into vacuous success on exactly the items `create` produces.
- **Refuse only when criteria exist elsewhere in the body.** Narrower, and it
  leaves the "never wrote criteria anywhere" item a free pass — the most
  accidental satisfaction of all.
- **Count dated comments only when they are newer than the section's last edit.**
  Rejected: no timestamp a body carries can say whether a comment is a _record of
  a past obligation_ or a _newly reported one_. "Dated blocks are history" is a
  property of the format, not of a date comparison.
- **Let agents transcribe automatically at `create`.** Rejected here as scope
  creep, but it is the natural follow-up: `create --body` (or a
  `--acceptance` flag) removes the hand-edit the consequences section names.
- **Edit the historical boxes instead.** Rejected: dated blocks are append-only,
  force-push is denied, and it destroys the evidence that the criteria were met.
- **Apply the same scoping to the container cascade.** Deferred: containers are
  exempt from this gate by ADR 0015, so it is a separate decision with its own
  blast radius, not a side effect of this one. Filed as
  `task-cascade-whole-body-acceptance-defers-this-defect` — the deferral is
  carried by that item, not by this paragraph
  (`docs/engineering.md` §Definition of done 6). It is a live defect, not a
  hypothetical: `story-ci-wall-clock` is vetoed by the cascade on comment history
  alone (`liveCriteria=0`, five whole-body unticked boxes), so a container whose
  live section is empty cannot auto-complete for the same reason a leaf cannot
  flip.
