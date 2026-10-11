---
type: task
status: in_progress
id: task-native-panel-hierarchy-links
title: "OpenCode board panel: parent and children navigation"
assignee: arggon-delivery-lead
branch: feat/task-native-panel-hierarchy-links
parent: story-hierarchy-navigation
labels: []
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T23:20:22.742Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-native-panel-hierarchy-links
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-hierarchy-navigation/task-native-panel-hierarchy-links.md
  Leaves live only under a story. id is the filename stem: task-native-panel-hierarchy-links.
  CLI `arggon create task native-panel-hierarchy-links` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode board panel: parent and children navigation

## Context

Parent story `story-hierarchy-navigation`: the OpenCode board panel (`opencode/plugins/arggon/tui.tsx`) renders no parent/child/breadcrumb/ancestor information at all — the thinnest of the three surfaces. Panel users cannot see, let alone walk, the hierarchy.

## Acceptance

- [ ] The panel's detail/selection surface shows the parent (activatable to open the parent) and the children (each activatable), or documents with owner sign-off why the panel's component model cannot carry it and what the fallback is
- [ ] Resolution reads the inlined kernel's `parent` edges; bundle regenerated (`npm run check:plugin` green) with no board-surface export broken
- [ ] `arggon validate` green; prettier clean; PR opened with impact class (panel is a shipped adapter seam — likely Behavioral with the ADR 0016 channel reference)

## Notes
