---
type: task
status: done
id: task-auto-commit-tracker
title: Auto-commit tracker mutations (--commit/--no-commit)
assignee: Arggon
parent: story-tracker-hygiene
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/task-auto-commit-tracker.md
  Leaves live only under a story. id is the filename stem: task-auto-commit-tracker.
  CLI `arggon create task auto-commit-tracker` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Auto-commit tracker mutations (--commit/--no-commit)

## Context

`create`, `comment`, `adopt` (task creation) and `cleanup --prune` (state clearing) mutate `tasks/` without committing; `start` refuses a dirty tree. Proposal from the adoption agent: these commands should commit their own mutations. Design guardrails: stage ONLY the mutated file (never `git add .`/`-A` — the skill forbids it for good reasons), commit message convention (`chore(tasks): <verb> <id>` or including the item id), author = git config; skip silently on non-git trees. Default ON via config (`x-tracker.auto-commit: true` in tasks/.convention.yml, namespaced like x-playbooks) with `--no-commit` flag to opt out per invocation.

## Acceptance

- [x] create/comment/adopt/cleanup --prune commit their mutated files by default (--no-commit opts out); message references the item id
- [x] Staging is surgical (only the mutated path); non-git trees skip silently; config override via x-tracker
- [x] Tests: mutation + assert commit exists with only that path staged/changed; --no-commit leaves dirty
