---
type: task
status: in_progress
id: task-plugin-source-prettier-policy
title: Plugin source prettier policy + exploration-010 status
assignee: Arggon
branch: feat/task-plugin-source-prettier-policy
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
claimed_at: "2026-09-22T01:28:45.565Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-plugin-source-prettier-policy
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-plugin-source-prettier-policy.md
  Leaves live only under a story. id is the filename stem: task-plugin-source-prettier-policy.
  CLI `arggon create task plugin-source-prettier-policy` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin source prettier policy + exploration-010 status

## Context

Observations from the PR #392 review (`task-playbook-2-0-10-nits`):

1. `opencode/plugins/arggon/index.ts` is **not prettier-clean at base** (the
   source is written without semicolons vs `.prettierrc.json`); `npm run format`
   would rewrite ~1.5k lines and `.prettierignore` only excludes the bundle.
   Decide: format the file once (large diff), add it to `.prettierignore`
   (documented), or align `.prettierrc` with the plugin style.
2. `exploration-opencode2-native-010` is still `status: open`; decide whether it
   should be marked landed/closed now that the program's waves shipped.

## Acceptance

- [ ] The plugin-source formatting policy is decided and enforced (prettier
      config/ignore or a one-time format), documented.
- [ ] `npm run format` no longer surprises the plugin source.
- [ ] exploration-010 status reflects reality.
- [ ] `arggon validate` green; CI green.

## Notes

- Filed from the PR #392 review; cosmetic.
