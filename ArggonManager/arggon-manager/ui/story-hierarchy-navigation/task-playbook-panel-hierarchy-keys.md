---
type: task
status: todo
id: task-playbook-panel-hierarchy-keys
title: Document panel parent/children keys in the OpenCode playbook key table
parent: story-hierarchy-navigation
labels: []
created: "2026-10-11"
updated: "2026-10-11"
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

- [ ] The playbook's TUI sections name the `p` (parent) and `1..9` (Nth child) binds with their toasts, or state with reasoning why the playbook stays generic
- [ ] No existing playbook statement made false; prettier clean; `arggon validate` green; PR opened

## Notes
