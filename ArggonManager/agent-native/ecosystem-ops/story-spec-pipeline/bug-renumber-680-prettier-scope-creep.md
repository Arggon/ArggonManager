---
type: bug
status: todo
id: bug-renumber-680-prettier-scope-creep
title: "Renumber wave PR #680 prettier scope creep: ADR 0005's decision table re-wrapped and *credible*/*ready* normalized to _credible_/_ready_ in two moved docs — incidental churn in a renumber diff"
parent: story-spec-pipeline
labels: [docs, renumber-fallout, diff-hygiene]
created: "2026-10-12"
updated: "2026-10-12"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-renumber-680-prettier-scope-creep.md
  Leaves live only under a story. id is the filename stem: bug-renumber-680-prettier-scope-creep.
  CLI `arggon create bug renumber-680-prettier-scope-creep` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Renumber wave PR #680 prettier scope creep: ADR 0005's decision table re-wrapped and _credible_/_ready_ normalized to _credible_/_ready_ in two moved docs — incidental churn in a renumber diff

## Context

Found 2026-10-12 in delivery-lead review of the renumber wave (PR #680,
`task-renumber-colliding-doc-numbers`, now done). That wave's maker ran
`prettier -w` over whole files, so beyond the renames the diff carries
incidental normalization:

- `ArggonManager/docs/adr/0005-cheap-path-to-prod.md`'s decision table was
  re-wrapped (table alignment churn across rows the renumber did not touch),
- `*credible*` / `*ready*` became `_credible_` / `_ready_` inside two of the
  moved documents (prettier's emphasis-style normalization).

The renumber item's own dispatch said "if `prettier --write` reformats a file
you did not intend to change, revert that file — keep the diff minimal".
Cosmetic, but it widens the review diff and can bury a real edit — the same
diff-hygiene class as a `D` row nobody reads. Both changes are already on
`main` (merged via the renumber wave); this bug is the cleanup, not a blocker.

## Acceptance

- [ ] ADR 0005's decision table restored to its pre-#680 wrapping, or the
      normalization recorded as deliberate with its reason (dated note on this
      item)
- [ ] The emphasis style in the two moved docs decided and applied consistently
      — either restore `*x*` or accept `_x_` house-wide for those spots, with
      the choice recorded
- [ ] `npx prettier --check` still passes on every touched file — the correction
      must not fight the formatter (a second normalization cycle is the failure)
- [ ] Evidence: `git diff` against the pre-fix tree for the touched files shows
      ONLY the intended correction (no re-derivation of unrelated churn)

## Notes
