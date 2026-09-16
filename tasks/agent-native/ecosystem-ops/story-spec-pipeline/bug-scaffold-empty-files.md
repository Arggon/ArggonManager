---
type: bug
status: in_progress
id: bug-scaffold-empty-files
title: scaffolded docs reported truncated to 0 lines (spec new / playbook new / stack explore)
assignee: Arggon
branch: fix/bug-scaffold-empty-files
parent: story-spec-pipeline
labels: [p3]
created: "2026-09-15"
updated: "2026-09-16"
claimed_at: "2026-09-16T01:08:16.859Z"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-spec-pipeline/bug-scaffold-empty-files.md
  Leaves live only under a story. id is the filename stem: bug-scaffold-empty-files.
  CLI `arggon create bug scaffold-empty-files` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# scaffolded docs reported truncated to 0 lines (spec new / playbook new / stack explore)

## Context

Reported by the casa-pendiente experiment (2026-09-15, session sess_fefa3aec): after running `arggon stack explore`, `spec new` and `playbook new` (5 files under docs/), the scaffolded files were repeatedly found TRUNCATED TO 0 LINES between the agent's read and write passes ("file modified since read" errors). The agent rewrote all content by hand (no loss) and could not identify the cause or reproduce it deterministically.

Code analysis at filing time: the scaffold write paths (cli/src/spec.ts:727/737, cli/src/playbooks.ts:193/287) are single full-content `writeFileSync` calls — they never write empty output. So the truncation is most likely environmental (interrupted process, concurrent interference in that workspace) rather than the CLI writing empty content — but a single non-atomic write can truncate on crash, and generated docs are data.

## Acceptance

- [x] Scaffold writes hardened: temp-file + rename (atomic) across spec new / playbook new / stack explore write paths
- [x] Shrink guard: a post-write check that the written byte length matches the rendered content, failing loudly instead of leaving a truncated doc
- [ ] If the environment cause is identified during investigation, document it in this item

## Notes
