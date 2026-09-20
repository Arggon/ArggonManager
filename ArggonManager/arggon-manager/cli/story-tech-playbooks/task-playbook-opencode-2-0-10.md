---
type: task
status: in_progress
id: task-playbook-opencode-2-0-10
title: Refresh OpenCode playbook pin to 2.0.10 + re-probe plugin import A/B
assignee: Arggon
branch: feat/task-playbook-opencode-2-0-10
parent: story-tech-playbooks
labels: []
priority: p2
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T10:45:15.393Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-playbook-opencode-2-0-10
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tech-playbooks/task-playbook-opencode-2-0-10.md
  Leaves live only under a story. id is the filename stem: task-playbook-opencode-2-0-10.
  CLI `arggon create task playbook-opencode-2-0-10` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Refresh OpenCode playbook pin to 2.0.10 + re-probe plugin import A/B

## Context

Declared follow-up from exploration `exploration-opencode2-native-010` (epic
`opencode2-native`): the local runtime is `opencode v2.0.10` (2026-09-19) while
`docs/playbooks/opencode.md` still pins 2.0.8 and records the A/B probe from
that version.

Per the playbook's upgrade policy, refresh the research record and re-run the
A/B plugin-import probe (dependency-less fixture: documented static import vs
the guarded dynamic import) on 2.0.10; note any behavior change.

## Acceptance

- [ ] `docs/playbooks/opencode.md` version/pin and research record updated to
      2.0.10 with the probe date.
- [ ] A/B probe result recorded (static import failure mode re-confirmed or
      changed; guarded import still loads).
- [ ] Any new gotcha folded into the playbook's Conventions/Troubleshooting.
- [ ] `arggon validate` green; docs-only diff.

## Notes

- 2.0.8 → 2.0.10 is patch-level, but the pin refresh is part of the native
  redesign program's version discipline.
