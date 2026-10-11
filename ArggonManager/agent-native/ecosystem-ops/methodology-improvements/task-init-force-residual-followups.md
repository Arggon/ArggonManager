---
type: task
status: todo
id: task-init-force-residual-followups
title: '`init --force` residual follow-ups from PR #681: the `x-generated` section relocates to EOF, "survive byte-for-byte" does not cover EOLs, and `plan.conventionWrite!` asserts an invariant nothing names'
parent: methodology-improvements
labels: [cli, convention, followup]
created: "2026-10-11"
updated: "2026-10-11"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-init-force-residual-followups.md
  Leaves live only under a story. id is the filename stem: task-init-force-residual-followups.
  CLI `arggon create task init-force-residual-followups` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `init --force` residual follow-ups from PR #681: the `x-generated` section relocates to EOF, "survive byte-for-byte" does not cover EOLs, and `plan.conventionWrite!` asserts an invariant nothing names

## Context

Three sub-items recorded by the `arggon-standards-reviewer` pass on PR #681
(`bug-init-force-drops-x-tracker-block`, 2026-10-11). None of them blocked that merge; each is
a named, bounded piece of work rather than a defect.

1. `updateGeneratedSection` removes the `x-generated` section from wherever it sits and
   re-appends it at EOF. Acceptable for machine-owned provenance — but it is a relocation of
   bytes the adopter placed, and nothing states which behaviour is intended.
2. README / `json-output.md` say the rest of the file "survives byte-for-byte". A CRLF
   `.convention.yml` is rewritten LF by the split/join. Pre-existing and consistent with the
   repo's LF-write rule — but the sentence overstates what happens.
3. `plan.conventionWrite!` (non-null assertion) is sound today because the two plan returns
   without it early-return or throw before the write. The invariant is proved by hand on every
   read rather than enforced anywhere.

## Acceptance

- [ ] The `x-generated` relocation is either preserved-in-place or documented as
      machine-owned provenance that may move — and a test names the chosen behaviour, so a
      silent move cannot appear in a later change
- [ ] "survives byte-for-byte" is corrected to cover EOLs in README and
      `ArggonManager/docs/json-output.md` (a CRLF file is rewritten LF), so the claim matches
      the behaviour — the review bar's docs-travel-with-code
- [ ] `plan.conventionWrite!` is replaced by an explicit invariant: required on the write path,
      or an assertion with a named error, so the invariant is enforced rather than argued
- [ ] Docs for each decision land in the same PR as the code, including the one-line README /
      json-output.md corrections
- [ ] `npm test` green, `npm run build` ok, `arggon validate` ok

## Notes
