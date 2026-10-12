---
type: bug
status: todo
id: bug-template-only-bodies-ship-green
title: "Template-only item bodies ship green: open containers carry placeholder Context and Acceptance and no surface names it"
parent: story-tracker-hygiene
labels: []
created: "2026-10-11"
updated: "2026-10-11"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-template-only-bodies-ship-green.md
  Leaves live only under a story. id is the filename stem: bug-template-only-bodies-ship-green.
  CLI `arggon create bug template-only-bodies-ship-green` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Template-only item bodies ship green: open containers carry placeholder Context and Acceptance and no surface names it

## Context

Found 2026-10-11 reviewing the `methodology-productization` initiative at the product owner's prompt: its index file (and every open container under it) still carries the scaffold placeholders — `<!-- Why this initiative exists. -->` and `<!-- The real acceptance criteria; ... -->` — with no real prose. `arggon validate` is green and every gate passes, because the convention treats bodies as opaque (convention.md: "Body content after frontmatter is free-form Markdown") and the done gate + acceptance-aware cascade only consult checkboxes that exist. A container with no checklist "has no acceptance contract and completes as before" — so emptiness is the one shape that auto-completes without friction.

Scale (same-day grep, open `todo`/`in_progress`/`blocked` items only): 12 open containers still placeholder — the whole `methodology-productization` subtree (1 initiative, 3 epics, 8 stories) — plus 26 open tasks. Done/cancelled placeholders are history and out of scope.

## Acceptance

- [x] The 12 open `methodology-productization` containers named in `task-author-methodology-productization-bodies` carry real Context and Acceptance (done, PR #727)
- [ ] The 27 remaining open placeholder items named in the six `task-author-*-bodies` tasks carry real Context and Acceptance (those tasks' merges satisfy this row; this bug tracks the guard, not the prose)
- [ ] A BLOCKING surface refuses template-only bodies on open items: `arggon validate` fails non-zero with a named error (`task-validate-refuses-placeholder-bodies`; `decided: A`, report-only explicitly rejected)
- [ ] The guard matches the scaffold marker, never quoted prose; done/cancelled excluded with the message saying so
- [ ] `arggon validate` + `npm test` green; prettier clean

## Notes

### 2026-10-11 @ses_ed2ed434cffdHsqB0EV526IjUT

decide: how loudly should the tracker complain about placeholder item bodies (the empty Context and Acceptance sections this bug names)?

- The question: when an open item still carries its scaffold placeholder text, should the toolchain refuse (a red gate) or only report it (a warning you can read and ignore)?
- Why it matters: today the silence is total — 12 open containers and 26 open tasks in this repo carry placeholders with every gate green, so nobody learns a body was never written until a human trips over it. Whatever we choose becomes the behavior in every adopting repo too.
- The options: A — blocking: `validate` fails on placeholder bodies in open items, so no PR with one goes green, at the cost that 38 currently-open items in this repo must be fixed or waived first and every adopter with a placeholder gets a red lane on upgrade. B — report-only: a `validate` warning (or equivalent finding) names the items without failing anything, so nothing breaks and the list is always visible, at the cost that warnings get ignored and the rot can persist exactly as it did here. C — split: containers report-only (their prose is product judgment, often legitimately brief) while task/bug leaves block (their checklist is the done contract the kernel already gates).
- The recommendation: B first, C as the follow-up — report-only now because a blocking gate over 38 open items (plus unknown adopter trees) holds delivery hostage to a cleanup backlog, and the warning gives us the list to burn down before any gate is armed.
- The strongest argument against that recommendation: report-only is how this exact rot happened — the convention already says bodies matter and every surface stayed silent; a warning nobody reads is the same silence with better formatting, and option A is the only one that guarantees the next placeholder never ships.
- The default: B, from 2026-10-25 — the maker implements the report-only surface; if the finding list is still unread after one release cycle, the lead re-briefs with the burn-down numbers attached.

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT

decided: A recorded — implementing as blocking. The 2026-10-25 default (B) is superseded by this answer; the brief above stands unwritten-per-convention (a superseded brief is never rewritten).

- Owner's reasoning: the delivery lead owns backlog creation and maintenance, so report-only (B) and split (C) — both of which park the rot in the backlog — are not options. The toolchain must refuse.
- Implementation order this forces: placeholder bodies on currently-open items FIRST (a blocking `validate` over today's ~38 open placeholders would otherwise turn every lane red on landing), the blocking guard SECOND with the tree already clean.
- Scope kept: done/cancelled items stay excluded (history, not the contract); the guard reads item bodies, not a marker copy; waiver stays human-only per the done-gate shape.
