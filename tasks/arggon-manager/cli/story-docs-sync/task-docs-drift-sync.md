---
type: task
status: done
id: task-docs-drift-sync
title: docs-drift-sync
assignee: Arggon
parent: story-docs-sync
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-docs-sync/task-docs-drift-sync.md
  Leaves live only under a story. id is the filename stem: task-docs-drift-sync.
  CLI `arggon create task docs-drift-sync` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# docs-drift-sync

## Context

The 2026-09-11 documentation audit found drift between the shipped CLI and the docs that describe it: `docs/json-output.md` (missing `milestone` in WorkItem, stale `command` enum, missing `instructions`/`--serve`/`--group-by` payloads, dead "may land later" wording), `README.md` (frozen at Phase 1: no sync/mcp/instructions/serve, "no client JS" claim false since the drag-and-drop board), `docs/engineering.md` (still a "#8 pending" draft), `skills/arggon-cli/SKILL.md`, and `docs/agents.md` §5 (cascade not mentioned).

## Acceptance

- [x] `docs/json-output.md`: `command` enum includes next/report/instructions/mcp; WorkItem documents `milestone`; board documents `groupBy`/`serving`/`url`/`port`; `instructions` payload section added; "may land later" wording removed
- [x] `README.md`: board section accurate (embedded script, `--serve`, `--group-by`, `--github`), plus sections for `sync`, `instructions`, `mcp` and the container-completion cascade
- [x] `docs/engineering.md`: no more "#8 pending" hedging, real repo structure, testing expectations in present tense, dead GitHub-issue links replaced, phases reflect what shipped
- [x] `skills/arggon-cli/SKILL.md` (repo copy) covers sync/mcp/instructions/serve and the cascade pitfall; home-directory copy synced
- [x] `docs/specs/spec-sync-001.md` and `docs/plans/plan-sync-001.md` statuses flipped to `implemented` (shipped feature left `proposed`)

## Notes

Found by a documentation audit comparing `arggon --help` against README/docs/skill; report delivered before editing, per workflow.
