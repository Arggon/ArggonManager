---
type: task
status: done
id: task-agents-doc-restructure
title: agents-doc-restructure
assignee: Arggon
branch: feat/task-agents-doc-restructure
parent: methodology-improvements
labels: []
priority: p2
created: "2026-09-29"
updated: "2026-09-29"
worktree_path: /home/arggon/Projects/ArggonManager-task-agents-doc-restructure
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-agents-doc-restructure.md
  Leaves live only under a story. id is the filename stem: task-agents-doc-restructure.
  CLI `arggon create task agents-doc-restructure` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# agents-doc-restructure

## Context

<!-- Why this task exists. -->

## Acceptance

- [x] 

## Notes

### 2026-09-29 @Arggon
### Context — C5 (exploration-methodology-improvements-014 F4)

`docs/agents.md` §4 carries a ~700-word single paragraph (worktree/start/link-farm contract) and §0's merge/squash bullet is similarly dense; every adopting repo's agents load this file (ADR 0006 context-budget spirit). Restructure into bounded subsections/bullets.

**STRICT: prose-only reorganization.** Zero semantic change: every normative sentence (never / always / only / requires / must) must survive verbatim or with meaning-identical rewording; no new rules; no dropped rules; do not touch other docs.

### Acceptance checklist
- [x] §4 split into short subsections (e.g. claim+worktree in one step / linked installs / readiness reporting / failure semantics / cleanup), bullets ≤ ~3 lines.
- [x] §0 merge/squash bullet becomes a short subsection; other §0 mega-bullets bounded.
- [x] PR description lists every normative statement before/after — none lost.
- [x] Total word count not increased by more than 5%.
- [x] Docs-only PR; `arggon validate` ok.
- [x] Merge order: after `task-done-gate-acceptance-waiver` (which adds a §5 line) — rebase before opening if needed.
