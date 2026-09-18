---
type: bug
status: todo
id: bug-init-ignored-artifacts-dirty-commit
title: "arggon init leaves a dirty index when generated paths are gitignored (commit.skipped)"
priority: p3
parent: opencode2-hardening
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/bug-init-ignored-artifacts-dirty-commit.md
  Leaves live only under a story. id is the filename stem: bug-init-ignored-artifacts-dirty-commit.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# argon init leaves a dirty index when generated paths are gitignored (commit.skipped)

## Context

Reproduced independently on a **fresh clone** of PR #331's head during the W7
dogfood review (and on all three `init` runs): `arggon init` reports
`commit.skipped: "git add failed: The following paths are ignored by one of
your .gitignore files:"` and leaves `M tasks/.convention.yml` **staged but
uncommitted** — a dirty index after a successful init.

Why it happens here: the OpenCode2 bundling ships derived copies that are
gitignored by design (`.agents/skills/**`, `.opencode/plugins/arggon/**`), so
the generation state (`tasks/.convention.yml`) updates while the tracked
`git add` for the auto-commit hits ignored paths. The same applies to any
adopter that gitignores a generated path.

## Acceptance

- [ ] `arggon init`'s auto-commit stages only non-ignored paths (surgical
      staging is already the norm) and commits the state update without
      failing, **or** reports a precise non-failing status explaining exactly
      which paths were skipped and why.
- [ ] No dirty index after a successful init on a tree with an ignored
      generated path (fixture test).
- [ ] If the user-visible behavior changes, README/docs and the init JSON
      contract are updated in the same PR.

## Notes

- Surfaced by W7 (`task-opencode2-dogfood`); filed here per the review rule.
  Generic CLI behavior — reparent to a `cli`-owned story if maintainers prefer.
