---
type: task
status: in_progress
id: task-opencode2-context-polish
title: "Context report polish: git-history robustness, helper tests, CI gate decision"
assignee: Arggon
branch: feat/task-opencode2-context-polish
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T15:14:28.760Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-context-polish
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode2-context-polish.md
  Leaves live only under a story. id is the filename stem: task-opencode2-context-polish.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Context report polish: git-history robustness, helper tests, CI gate decision

## Context

Non-blocking findings from the independent review of PR #329
(`task-opencode2-context`), filed per the repo rule.

- **F4 — history robustness.** `smoke/context-report.ts` hardcodes
  `references/json-contract.md` to detect the post-W5 split and unconditionally
  reads the working tree's references; on a pre-split checkout (bisect, revert)
  it throws instead of printing `unavailable`.
- **F5 — cosmetic column collision.** `pad()` returns text unchanged when it
  exceeds the column; the long `skill entry arggon-upgrade (description)` label
  runs into the size column.
- **F6 — CI gate decision.** `context:report --strict` is manual (not in CI);
  the pure helpers (`frontmatter`, `stripJsonComments`) have no unit tests.
  Decide: wire `--strict` into CI or document it as a manual/release gate, and
  add helper tests either way.
- **F7 — bases nuance.** The playbook paragraph mixes source bytes (references)
  with fixture bytes (on-demand table, 15,479 vs 15,804 B); label the bases so
  a reader cannot sum them wrongly.

## Acceptance

- [ ] `reconstructBeforeAfter()` degrades to `unavailable` on checkouts without
      the W5 split; the detection no longer depends on a single hardcoded
      reference name.
- [ ] Column padding handles over-width labels (no run-together output).
- [ ] `--strict` gate decision recorded (CI wiring or documented manual gate)
      with rationale; unit tests cover the pure helpers.
- [ ] Playbook bases labeled consistently.
- [ ] Full suite + `context:report --strict` green; small PR to `opencode2`.

## Notes

- Report-only tool; none of this blocks W7.
