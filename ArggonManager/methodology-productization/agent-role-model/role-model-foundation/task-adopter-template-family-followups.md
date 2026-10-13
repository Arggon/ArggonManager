---
type: task
status: todo
id: task-adopter-template-family-followups
title: "Adopter template family follow-ups: CONTRIBUTING / PR-template software locks, zcode goal-mode pre-rename word, guard wording"
parent: role-model-foundation
labels: [docs, templates, methodology]
created: "2026-10-13"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-adopter-template-family-followups.md
  Leaves live only under a story. id is the filename stem: task-adopter-template-family-followups.
  CLI `arggon create task adopter-template-family-followups` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopter template family follow-ups: CONTRIBUTING / PR-template software locks, zcode goal-mode pre-rename word, guard wording

## Context

Leftovers from `bug-adopter-engineering-template-software-locked` (merged as PR #758), reported by the maker and the standards review rather than widened into that fix:

- `templates/docs/CONTRIBUTING.md:32` — "- [ ] Tests pass locally (`npm test` or the project equivalent)" still names the software noun first, and `templates/docs/github/PULL_REQUEST_TEMPLATE.md:18` — "- [ ] Tests pass locally" — has no project-equivalent escape at all.
- `templates/docs/zcode/arggon/commands/arggon-goal.md:29` — "so the coordinator can follow the claim": a pre-rename role word surviving in a shipped seam template, in the subtree the new family guard excludes.
- The new guard's header overstates what it compares (README bullets are plain list items, not blockquote-prefixed).
- The docs-only exemption moved inside the software worked example in `templates/docs/docs/engineering.md`.

## Acceptance

- [ ] `CONTRIBUTING.md` + `PULL_REQUEST_TEMPLATE.md` restate their checks as what the project declares (software case kept as a worked example)
- [ ] the zcode goal-mode template uses the shipped role vocabulary; the family guard covers the seam templates or the exclusion is named with its reason
- [ ] the guard header describes exactly what it compares; the docs-only exemption is lifted out of the software example
- [ ] `cli/src/adopter-template-invariant-drift.test.ts` + init-docs tests green; `arggon validate` ok; prettier clean on touched files

## Notes
