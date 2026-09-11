---
type: story
status: todo
id: story-next
title: Next-action guidance
parent: agent-loop
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Next-action guidance

## Context

Taskmaster's `next` answers 'what should I work on?' from dependencies and status. `arggon next` suggests a claimable `todo` item using tree order, current claims, and labels — without inventing v0-reserved fields like priority.

## Acceptance

- [ ] `arggon next` suggests one unclaimed todo story/task/bug with a reason
- [ ] `arggon instructions` emits the playbook wiring (pre-commit, CI) for this repo
- [ ] Both commands support `--json`
