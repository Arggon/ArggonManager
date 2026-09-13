---
type: bug
status: todo
id: bug-playbook-double-v
title: playbook --file-task title doubles the v prefix (vv1.27.1)
parent: story-tech-playbooks
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tech-playbooks/bug-playbook-double-v.md
  Leaves live only under a story. id is the filename stem: bug-playbook-double-v.
  CLI `arggon create bug playbook-double-v` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# playbook --file-task title doubles the v prefix (vv1.27.1)

## Context

Found by the suizo experiment (2026-09-13): `arggon playbook status --file-task <story>` created a task titled "Re-research go playbook (vv1.27.1, 100 days old)" — double v. playbooks.ts:386 hardcodes `v${playbook.version}`; when the recorded version already carries the prefix, it doubles.

## Acceptance

- [ ] The title normalizes the prefix (v once, e.g. v1.27.1 whether version is stored as "1.27.1" or "v1.27.1"); test both stored forms
