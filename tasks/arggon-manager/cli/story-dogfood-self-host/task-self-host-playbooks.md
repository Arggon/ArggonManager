---
type: task
status: todo
id: task-self-host-playbooks
title: Create base tech playbooks (node/typescript/vitest) with researched versions
parent: story-dogfood-self-host
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-dogfood-self-host/task-self-host-playbooks.md
  Leaves live only under a story. id is the filename stem: task-self-host-playbooks.
  CLI `arggon create task self-host-playbooks` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Create base tech playbooks (node/typescript/vitest) with researched versions

## Context

Create docs/playbooks/ for the three core technologies of this repo (node, typescript, vitest), researched with current versions and dated sources (npm view / official docs), recorded via arggon playbook new + refresh. The skill's methodology section mandates playbooks for any tech the project uses; this repo uses three and had zero.

## Acceptance

- [ ] docs/playbooks/{node,typescript,vitest}.md with researched version pins and dated sources
- [ ] arggon playbook status reports 0 stale; docs referenced from AGENTS.md if natural
