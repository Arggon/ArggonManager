---
type: story
status: done
id: story-next
title: Next-action guidance
assignee: Arggon
branch: feat/story-next
parent: agent-loop
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Next-action guidance

## Context

Taskmaster's `next` answers 'what should I work on?' from dependencies and status. `arggon next` suggests a claimable `todo` item using tree order, current claims, and labels — without inventing v0-reserved fields like priority.

## Acceptance

- [x] `arggon next` suggests one unclaimed todo story/task/bug with a reason (shipped with `next`; verified live and covered by next.test.ts)
- [x] `arggon instructions` emits the playbook wiring (install, pre-commit, CI, AGENTS.md snippet) extracted from docs/agents.md
- [x] Both commands support `--json`
