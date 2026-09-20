---
type: task
status: done
id: task-instructions-command
title: Add instructions command for agent wiring
assignee: Arggon
parent: story-next
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Add instructions command for agent wiring

## Context

Backlog.md's `instructions` command prints agent wiring on demand. Do the same from `docs/agents.md` so every repo can bootstrap agents in one command.

## Acceptance

- [x] Prints install, pre-commit hook, and CI gate snippets (plus the AGENTS.md wiring snippet)
- [x] Snippets are generated from the playbook source, not duplicated by hand (extracted from docs/agents.md at runtime; tests parse the real doc so they fail if the doc drifts)
- [x] `--json` emits the snippets as structured fields (snippets.{install,precommit,ci,agent} with language+body)
