---
type: task
status: in_progress
id: task-propose-section-backports
title: "propose: section-level backports for completed (acked) docs"
assignee: Arggon
branch: feat/task-propose-section-backports
parent: story-adoption-state
labels: [p3]
created: "2026-09-17"
updated: "2026-09-17"
claimed_at: "2026-09-17T07:46:35.239Z"
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
