---
type: bug
status: in_progress
id: bug-convention-md-links-nonexistent-adr-0015
title: "convention.md links a nonexistent ADR 0015 path, and that one dead link is what keeps PR #618's link-resolution rule scoped to 1 of 4 carriers"
assignee: arggon-delivery-lead
branch: fix/bug-convention-md-links-nonexistent-adr-0015
parent: methodology-improvements
labels: [docs]
created: "2026-10-03"
updated: "2026-10-05"
claimed_at: "2026-10-05T22:48:13.979Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-convention-md-links-nonexistent-adr-0015
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-convention-md-links-nonexistent-adr-0015.md
  Leaves live only under a story. id is the filename stem: bug-convention-md-links-nonexistent-adr-0015.
  CLI `arggon create bug convention-md-links-nonexistent-adr-0015` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# convention.md links a nonexistent ADR 0015 path, and that one dead link is what keeps PR #618's link-resolution rule scoped to 1 of 4 carriers

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @Arggon
Found by the worker on PR #618 (`bug-engineering-doc-stale-adr-statuses`), 2026-10-03, and reported as the concrete blocker on its own fix.

**The defect.** `ArggonManager/docs/convention.md` links `./adr/0015-done-gate.md`. That file does not exist — the real one is `docs/adr/0015-done-gate-acceptance-waiver.md`. A dead link in a carrier, pointing at the very document that defines the done-gate rule the carrier also describes.

**Why it is filed rather than fixed inline.** PR #618 added `cli/src/adr-status-doc-contract.test.ts`, scoped to `engineering.md` alone — because extending its "every `./adr/NNNN` link resolves" rule to the other carriers would immediately fail on this dead link. So one dead link is currently holding the check's coverage at 1 of 4 carriers. Repairing it is a one-liner; the check can then be widened immediately, and `docs/agents.md`, `docs/convention.md` and the spec set are all already clean on the ADR-status field.

Acceptance:
- [ ] The link resolves — or, if the target should be renamed, the rename is a deliberate act with the references swept, not a link edit papering over a wrong filename
- [ ] **The link-resolution rule is extended to all four carriers** (`engineering.md`, `agents.md`, `convention.md`, and the skill/spec set), not just `engineering.md`, so this class is caught where it occurs rather than where it was first found
- [ ] **A dead link fails with a readable message naming the carrier, the target path, and what does exist at that directory** — a link test that reports "unresolved" without the candidate filenames is a slow test to act on
- [ ] Swept: every `./adr/` and `docs/adr/` reference across the repo (templates and `templates/docs/**` included, since those ship to adopters), because the carrier set here is by construction duplicated into the adopter template
- [ ] The adopter template copy of `convention.md` gets the same treatment — if the dead link is only in the repo copy, the template is clean and that must be stated, not assumed

Note: the ADR **index** parity test (`cli/src/adr-index-parity.test.ts`) pins one `README.md` row per ADR and does not read prose links, so nothing catches this today.
