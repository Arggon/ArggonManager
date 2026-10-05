---
type: bug
status: blocked
id: bug-convention-md-links-nonexistent-adr-0015
title: "convention.md links a nonexistent ADR 0015 path, and that one dead link is what keeps PR #618's link-resolution rule scoped to 1 of 4 carriers"
assignee: arggon-delivery-lead
branch: fix/bug-convention-md-links-nonexistent-adr-0015
parent: methodology-improvements
labels: [docs]
created: "2026-10-03"
updated: "2026-10-05"
blocked_reason: "Link fix merged (PR #649); acceptance box 2 (widen #618's link-resolution rule from 1 carrier to all four) is undelivered by design — it belongs to the unmerged, owner-claimed #618, and `skills/arggon-cli/**` cannot join the carrier list at all until its markdown files carry real ./adr/ links. Not waivable by an agent. Unblocks when #618 merges and the widening lands."
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

- [x] The link resolves — or, if the target should be renamed, the rename is a deliberate act with the references swept, not a link edit papering over a wrong filename
- [ ] **The link-resolution rule is extended to all four carriers** (`engineering.md`, `agents.md`, `convention.md`, and the skill/spec set), not just `engineering.md`, so this class is caught where it occurs rather than where it was first found — **the data is now ready, the rule change is not mine to make** (see the maker note below)
- [x] **A dead link fails with a readable message naming the carrier, the target path, and what does exist at that directory** — a link test that reports "unresolved" without the candidate filenames is a slow test to act on
- [x] Swept: every `./adr/` and `docs/adr/` reference across the repo (templates and `templates/docs/**` included, since those ship to adopters), because the carrier set here is by construction duplicated into the adopter template
- [x] The adopter template copy of `convention.md` gets the same treatment — if the dead link is only in the repo copy, the template is clean and that must be stated, not assumed

## Notes

### 2026-10-05 @arggon-maker

**Fixed:** `ArggonManager/docs/convention.md:131` linked `./adr/0015-done-gate.md`; the real file is `docs/adr/0015-done-gate-acceptance-waiver.md` (`# 0015 Done gate: enforce acceptance-checklist completeness on the terminal flip, with an explicit waiver`). The **number was right** — the prose means the done-gate rule, which is ADR 0015 — so the path was corrected, not the number: only the pre-rename filename was stale. One line, no rename, nothing else in the repo referenced the old path.

**Rule 2 can widen from 1 carrier to 3 — verified, not assumed.** PR #618's `cli/src/adr-status-doc-contract.test.ts` is unmerged and absent from this branch, so I ran it here as a scratch copy (deleted, never committed). With the link fixed, rule 2 (`LINK_CARRIERS`, iterate `adrReferences`) passes over **`engineering.md`, `agents.md` and `convention.md`** — 3/3 green. What remains for whoever owns that file: add the two paths to `LINK_CARRIERS` **and** update the §ADR process coverage sentence in `engineering.md` in the same commit — the suite's own `covers exactly the carriers the §ADR process sentence says it covers` test fails if the two drift apart.

**The 4th carrier (`skills/arggon-cli/**`) is a different piece of work.** With the rule's own `ADR_LINK` (`/\(\.\/adr\/(\d{4})-([a-z0-9-]+)\.md\)/g`) all seven markdown files of the skill set (`SKILL.md`, `EVALS.md`, the five `references/*.md`) see **zero** references, so the vacuity guard (`expected at least one ADR reference to pin`) fails on every one — the skill set carries no `./adr/` markdown links at all. Widening the shape to the paths it actually uses (bare `ArggonManager/docs/adr/…`) leaves 6 of the 7 still at zero mentions; only `references/pitfalls.md` names an ADR (and it resolves). So the skill set needs real ADR links before it can be pinned — that is content generation inside `arggon:generated` blocks under a drift gate (`npm run skills:sync`, `cli/src/skill-generated-commands.test.ts`), not a dead-link repair.

**Coverage hole worth knowing about:** `convention.md` writes 6 of its 14 ADR references as bare `adr/NNNN-….md` with no `./` (lines 386, 426×2, 539, 664×2). PR #618's regex requires `./adr/`, so widening `LINK_CARRIERS` to `convention.md` **without** widening the shape would pin 8 of its 14 references and silently skip the other 6.

**Message quality: already met by the rule as written.** The failure string is `` `${carrier}: links ${reference.target}, which does not exist — docs/adr/${actual.join(", docs/adr/")} does` `` — carrier, path as written, and the real filenames in that directory. Asserted in a scratch run: the message contains `ArggonManager/docs/convention.md`, `./adr/0015-done-gate.md` and `docs/adr/0015-done-gate-acceptance-waiver.md`.

**Sweep (acceptance box 4).** 904 `.md` files, 150 markdown ADR links, resolved relative to each file's own directory:

- **product docs (`ArggonManager/docs/**`) + root docs (`README.md`, `CONTRIBUTING.md`, `lib/README.md`): 0 dead** after this fix — `convention.md:131` was the only one.
- **adopter template: 0 dead, and nothing to fix** — `templates/docs/docs/convention.md` (89 lines) contains no `adr` string at all (`grep -c` → 0); the repo's 694-line carrier is not the template's content, and the only ADR paths anywhere under `templates/` are two `0000-<slug>` placeholders in `templates/exploration*.md`.
- **15 dead ADR links remain in tracker item bodies** — deliberately outside rule 2's scope ("dated records of what was true when written"). 13 are wrong relative bases (`./adr/…` from a tracker dir, `../../../../docs/adr/…` one level too deep, `../../docs/adr/0023-…`), and 5 of those are inside `bug-engineering-doc-stale-adr-statuses.md`, where they are deliberate quotes of the pre-fix sentence. **1 is a genuinely wrong slug**: `ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-state-exploration-stopping-rule.md:52` links `../../../docs/adr/0017-greenfield-work-exploration-first.md`; the real file is `0017-greenfield-exploration-gate.md` (ADR 0017, "Greenfield exploration gate"). Not fixed — another item's body is not this item's scope; filing is the delivery lead's call.
- 2 more are in `fixtures/spec-docs-invalid/**`, which exist to be invalid.

**Found, not fixed — this one blocks PR #618.** PR #618's rule 1 (status restatement) reports a **false positive on `convention.md:542`**: `… arms the **product-acceptance record** ([ADR 0021](…) §4): whether a container's work was accepted is written as an ordinary comment …`. The tail window is one clause and swallows that whole sentence, so "was accepted" (about work, not the ADR) reads as a status claim. Since `STATUS_CARRIERS` already includes `convention.md`, **PR #618's suite fails on main's `convention.md` as it stands** — its own run on this branch shows exactly that failure. Fixing it by rewording the prose would paper over the scanner, so the fix belongs in the scanner: add `:` to `TAIL_STOPS` (`/[·|,:\n]|\.\s/`). Verified — that one character clears the `convention.md:542` finding and leaves every premise test green (the defect's own shape `… (Proposed): [ADR 0003](…)` is a **head** shape, and `:` was excluded from `LABEL_DELIMITERS` for exactly that reason, so the trailing form `[ADR 0003](…) (Proposed)` is still caught).

**Also for the delivery lead:** PR #618's branch is behind `main` — its `engineering.md` still carries the pre-role-rename text (`Software Architect`/`Project Manager`, no §Roles and authority), so it needs a rebase/merge decision before it can be reviewed as-is. And PR #619 touches `convention.md` (+11 lines, additions only); this change is a one-line link edit in a different paragraph, so they should merge without a textual conflict.

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

### 2026-10-05 @arggon-delivery-lead
### 2026-10-05 @arggon-delivery-lead
Merged: PR #649, all three lanes green, `MERGEABLE/CLEAN`. The **link fix** is done and merged: `convention.md:131` now points at `./adr/0015-done-gate-acceptance-waiver.md`. The ADR **number was right** and the filename was stale, so no ADR was renamed and no reference elsewhere needed sweeping.

**Left `blocked`, not `done`, because acceptance box 2 is genuinely undelivered:** widening #618's link-resolution rule from 1 carrier to all four is not this item's to land — #618 is the product owner's live claim and is unmerged. The maker measured the widening rather than guessing it: `engineering.md`, `agents.md` and `convention.md` now pass **3/3** (so the carrier list widens with one constant), while `skills/arggon-cli/**` **cannot** be added as-is because all 7 of its markdown files have zero `./adr/` links and the suite's vacuity guard fails on each — it needs real ADR links inside `arggon:generated` blocks, which is separate work.

**Also noted:** the reporter's `### 2026-10-03 @Arggon` comment quotes the original 5-box acceptance verbatim, so the body now carries two checklists — the real one in `## Acceptance` and the quoted historical one inside the comment. The done gate counts `- [ ]` **anywhere in the body**, so those quoted boxes would block the flip independently of box 2. Filed as `bug-done-gate-counts-checkboxes-inside-comment-blocks` — I have not isolated whether that is the gate's actual rule or a second contributing cause, and the item is worth filing either way.
