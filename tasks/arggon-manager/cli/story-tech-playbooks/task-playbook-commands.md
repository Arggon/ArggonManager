---
type: task
status: done
id: task-playbook-commands
title: arggon playbook new/status — versioned playbooks
assignee: Arggon
parent: story-tech-playbooks
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tech-playbooks/task-playbook-commands.md
  Leaves live only under a story. id is the filename stem: task-playbook-commands.
  CLI `arggon create task playbook-commands` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon playbook new/status — versioned playbooks

## Context

`arggon playbook new <tech> [--version <v>]` generates docs/playbooks/<tech>.md (frontmatter: tech, version, researched: today; sections: setup, conventions, testing, security, upgrade policy) — the version/best-practices research is the caller's job at creation (agents do it well); the CLI records it. `arggon playbook status [--max-age-days N]` flags playbooks with researched older than N days (default 90, overridable via tasks/.convention.yml x-playbooks.max-age-days); `--file-task <story-id>` creates a re-research task into the tracker via the kernel.

## Acceptance

- [x] playbook new/status landed with tests (stale math fixed-clock, --file-task integration via runCreate)
- [x] Stale threshold configurable via .convention.yml x-playbooks (namespaced extension)
