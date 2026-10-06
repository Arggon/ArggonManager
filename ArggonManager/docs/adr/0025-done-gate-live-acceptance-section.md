# 0025 Done gate scope: the live `## Acceptance` section, and no contract means no flip

- Status: Proposed
- Date: 2026-10-06
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Programme: `methodology-improvements` (bug-done-gate-counts-checkboxes-inside-comment-blocks)

## Context

ADR 0015 gated the `→ done` flip of a claimable leaf on "the body's acceptance
checklist is complete", implemented as a count of unchecked boxes over the whole
item body (`acceptanceComplete`). Two measured consequences, both from
`bug-done-gate-counts-checkboxes-inside-comment-blocks`:

1. **The verdict depended on history, not on the work.** `arggon comment`
   appends a dated `### <date> @<author>` block to the body, and `arggon create`
   has no `--body` flag — so a checklist filed as a comment is the _default_ path
   for a new item, and comment blocks quote criteria verbatim, unticked. Every
   such box was counted as an open obligation. On this repo's tracker, 61 leaves
   whose live acceptance was already satisfied were refused solely because a
   dated block carried the original unticked criteria — including two merged,
   verified, `main`-green items (`bug-validate-does-not-check-frontmatter-present`,
   `bug-engineering-doc-stale-adr-statuses`) that could not be completed at all.
   Worse, the rule was not even self-consistent: whether an item could flip
   depended on whether its comment record happened to contain an unticked box, so
   two items with identical live acceptance got opposite verdicts.

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
2. **A missing contract is refused too.** The flip is also refused when the live
   section publishes **no criterion at all** — absent, empty, whitespace-only,
   still the template placeholder, or nothing but bare `- [ ]` rows. One predicate
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
  refusal names the section, the shape, and the two remedies.
- Historical unticked boxes stop being obligations, so items whose criteria live
  in comments become completable without rewriting that history.
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
  blast radius, not a side effect of this one.
