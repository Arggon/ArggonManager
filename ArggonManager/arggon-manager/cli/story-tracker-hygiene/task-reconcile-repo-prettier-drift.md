---
type: task
status: todo
id: task-reconcile-repo-prettier-drift
title: Reconcile repo-wide prettier drift so `prettier --check` can be a gate again
parent: story-tracker-hygiene
labels: [docs, tooling, hygiene]
created: "2026-10-13"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-reconcile-repo-prettier-drift.md
  Leaves live only under a story. id is the filename stem: task-reconcile-repo-prettier-drift.
  CLI `arggon create task reconcile-repo-prettier-drift` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Reconcile repo-wide prettier drift so `prettier --check` can be a gate again

## Context

`prettier --check .` is red repo-wide at main: the template bug's maker reported 648 files; the lesson-store spike reported 574 tracker `.md` files failing, plus ~905 lines of CHANGELOG `*`→`-` drift. Likely roots are the open markdown non-idempotency bugs (`bug-prettier-glues-split-inline-code-span`, `bug-prettier-indented-list-continuation-grows-2-spaces-per-write`, `bug-start-claim-commit-frontmatter-fails-prettier`). Until reconciled, `prettier --check` cannot be a gate and every review must scope touched-file checks by hand — two wave-1 items hit exactly this.

## Acceptance

- [ ] root causes fixed, or the drift is accepted with a recorded decision (and the sibling items linked accordingly)
- [ ] the tree is prettier-clean at main, or a documented scope/ignore policy replaces repo-wide `--check`
- [ ] a CI gate (or scoped check) enforces whatever is decided, so drift cannot silently return
- [ ] evidence: `npx prettier --check .` output before/after (summary counts)

## Notes
