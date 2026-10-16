---
type: task
status: done
id: task-playbook-panel-hierarchy-keys
title: Document panel parent/children keys in the OpenCode playbook key table
assignee: arggon-delivery-lead
branch: feat/task-playbook-panel-hierarchy-keys
parent: story-hierarchy-navigation
labels: []
created: "2026-10-11"
updated: "2026-10-16"
worktree_path: /home/arggon/Projects/ArggonManager-task-playbook-panel-hierarchy-keys
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-hierarchy-navigation/task-playbook-panel-hierarchy-keys.md
  Leaves live only under a story. id is the filename stem: task-playbook-panel-hierarchy-keys.
  CLI `arggon create task playbook-panel-hierarchy-keys` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Document panel parent/children keys in the OpenCode playbook key table

## Context

Follow-up to `task-native-panel-hierarchy-links` (panel parent/children navigation): the panel documents its keys where users meet them (module header, inline `[p]`/`[1]..[9]` hints), but the OpenCode playbook's TUI key prose (`ArggonManager/docs/playbooks/opencode.md`, W6 sections) does not list the new binds. Per the standards review (N1), deferral is not a merge blocker but DoD #6 requires the follow-up to be a tracked item — this is that item. Blocked on the panel PR merging (keys must be final first).

## Acceptance

- [x] The playbook's TUI sections name the `p` (parent) and `1..9` (Nth child) binds with their toasts, or state with reasoning why the playbook stays generic
- [x] No existing playbook statement made false; prettier clean; `arggon validate` green; PR opened

## Notes

### 2026-10-16 @Arggon

verdict: approve (playbook hierarchy keys, commit ec4b88b0)

- standards review: all 8 playbook claims spot-checked exact against tui.tsx/board.ts sources (binds, id-sorted children, BOARD_HIERARCHY_CHILD_KEYS=9, inline hints, all three miss toasts); edit purely additive, no statement falsified; scope confined; smoke exempt (docs-only)
- verifier evidence: validate ok 0 warnings; prettier clean; playbook status 4 current none stale; diffstat 2 files (playbook + tracker md), tree clean
