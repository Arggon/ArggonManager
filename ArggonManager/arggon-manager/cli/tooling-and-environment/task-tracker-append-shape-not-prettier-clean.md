---
type: task
status: todo
id: task-tracker-append-shape-not-prettier-clean
title: "Tracker comment/handoff append shape is not prettier-clean and differs from hand-authored bodies (no blank line after frontmatter, none after appended headings) — decide one canonical shape or exempt tracker files"
parent: tooling-and-environment
labels: [tracker-schema, docs, formatter]
created: "2026-10-13"
updated: "2026-10-13"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-tracker-append-shape-not-prettier-clean.md
  Leaves live only under a story. id is the filename stem: task-tracker-append-shape-not-prettier-clean.
  CLI `arggon create task tracker-append-shape-not-prettier-clean` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tracker comment/handoff append shape is not prettier-clean and differs from hand-authored bodies (no blank line after frontmatter, none after appended headings) — decide one canonical shape or exempt tracker files

## Context

Observed 2026-10-12 across the improvement waves: when the kernel's `comment`/`handoff`
writers append to an item body, the result is not prettier-clean and differs from the
hand-authored template shape — no blank line after the frontmatter, no blank line after
appended headings. Every item that receives a comment therefore shows as prettier-dirty
against its authored state (makers kept re-discovering this; 18/18 sibling items share
the shape). No workflow runs prettier over tracker files, so it is cosmetic — but it
makes "prettier --check" a misleading local signal on item files and splits the corpus
into two shapes.

## Acceptance

- [ ] Decide and implement one: make the kernel's append shape prettier-clean (blank
      line after frontmatter + after headings); or exempt `ArggonManager/**/*.md` from
      prettier (config) and say so; or record why the two shapes coexist
- [ ] If the writer changes: a test pins the emitted shape; existing items are NOT
      mass-rewritten (append-only history) — new appends become canonical
- [ ] `arggon validate` green; the decision recorded where the next author reads it
      (`docs/convention.md` or the kernel writer's docblock)

## Notes
