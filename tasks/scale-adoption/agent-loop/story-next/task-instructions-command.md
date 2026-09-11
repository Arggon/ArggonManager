---
type: task
status: todo
id: task-instructions-command
title: Add instructions command for agent wiring
parent: story-next
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Add instructions command for agent wiring

## Context

Backlog.md's `instructions` command prints agent wiring on demand. Do the same from `docs/agents.md` so every repo can bootstrap agents in one command.

## Acceptance

- [ ] Prints install, pre-commit hook, and CI gate snippets
- [ ] Snippets are generated from the playbook source, not duplicated by hand
- [ ] `--json` emits the snippets as structured fields
