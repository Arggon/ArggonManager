---
type: task
status: done
id: task-propose-section-backports
title: "propose: section-level backports for completed (acked) docs"
assignee: Arggon
branch: feat/task-propose-section-backports
parent: story-adoption-state
labels: [p3]
created: "2026-09-17"
updated: "2026-09-17"
depends_on: [bug-project-name-dir-derived]
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-propose-section-backports.md
  Leaves live only under a story. id is the filename stem: task-propose-section-backports.
  CLI `arggon create task propose-section-backports` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# propose: section-level backports for completed (acked) docs

## Context

Pilot finding (2026-09-17, first `init --propose` run on this self-host repo): all 11 proposals were wholesale template renders, and every one was a REGRESSION against our curated docs (generic skeletons with TODOs vs completed content — CHANGELOG with real release history, convention.md with 511 real lines, SECURITY with filled support table). The flow's review step correctly rejected all of them, which validates the design — but it also means for fully-adopted repos the propose channel as shipped delivers near-zero value: the realistic upgrade need is "the upstream template GAINED a section/guidance — backport that section", not "re-render the whole file".

## Acceptance

- [ ] Design (spec-first, small): a proposal mode that diffs the CURRENT template against the template AS-GENERATED (recoverable from the destination's generation-time state or git history of the init commit) and proposes only ADDED/CHANGED template regions as section-level suggestions, leaving adopter content alone
- [ ] Whole-file proposals remain available explicitly (flag or fallback) for boilerplate docs and never-completed docs
- [ ] Depends on the dir-name recovery fix (bug-project-name-dir-derived) — section matching needs clean renders first
- [ ] Pilot re-run on this repo post-fix: proposals for convention.md/engineering.md should surface only genuinely new template sections (if any), not skeleton swaps

## Notes

### 2026-09-17 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #310.

Verified: full diff read (spec-007 spec-first flipped implemented; LCS region extraction with anchors from the git-history as-generated baseline — first committed version of each dest; sections default + --propose-whole-file explicit + automatic whole-file fallback when baseline unrecoverable; informational decision for removed-only diffs — adopter content never proposed for deletion; same-version idempotency/absorbed/stale rules reused). Gates mine: suite 1030/1030 (5 new tests; first run had 5 load flakes — the exact class #311 fixes), lint/build clean, spec validate 0 errors, validate ok. Pilot reproduced independently: init --propose --full on this repo now yields section-level proposals (mode=sections, 1-19 regions per doc, anchors quote unchanged context) instead of the 11 skeleton-swap regressions of the first pilot; runbooks/README correctly informational (template gained nothing); originals byte-intact. Year-boundary {{YEAR}} churn documented as acceptable noise in the spec.
