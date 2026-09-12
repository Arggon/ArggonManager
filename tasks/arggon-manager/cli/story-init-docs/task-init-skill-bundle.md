---
type: task
status: done
id: task-init-skill-bundle
title: Init bundles the arggon-cli skill and AGENTS.md mandates it
assignee: Arggon
branch: feat/task-init-skill-bundle
parent: story-init-docs
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-init-skill-bundle.md
  Leaves live only under a story. id is the filename stem: task-init-skill-bundle.
  CLI `arggon create task init-skill-bundle` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Init bundles the arggon-cli skill and AGENTS.md mandates it

## Context

User report after running `init --full` on an adopter repo: the arggon-cli SKILL.md should ship with the init (at `.agents/skills/arggon-cli/SKILL.md`, the project-scoped skills location), and the generated AGENTS.md should instruct agents to use that skill by default for every arggon invocation (it documents the JSON contract and the pitfalls).

## Acceptance

- [x] `arggon init` copies the skill from the single source (`skills/arggon-cli/SKILL.md` in this repo — no template duplicate) to `<root>/.agents/skills/arggon-cli/SKILL.md`; created/skipped reported; idempotent; missing source skips gracefully
- [x] Generated AGENTS.md mandates using the skill by default for every arggon invocation
- [x] Tests (skill file created, second-run skip, AGENTS.md line) + README/agents.md docs
