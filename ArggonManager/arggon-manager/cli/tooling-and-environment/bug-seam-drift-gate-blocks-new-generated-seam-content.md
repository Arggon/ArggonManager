---
type: bug
status: todo
id: bug-seam-drift-gate-blocks-new-generated-seam-content
title: "`tasks-validate` drift gate installs the PINNED released arggon and diffs the committed seam, so any PR adding new generated seam content (e.g. the ZCode goal-mode template) fails until a release + ARGGON_VERSION re-pin"
parent: tooling-and-environment
labels: [ci, release]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-seam-drift-gate-blocks-new-generated-seam-content.md
  Leaves live only under a story. id is the filename stem: bug-seam-drift-gate-blocks-new-generated-seam-content.
  CLI `arggon create bug seam-drift-gate-blocks-new-generated-seam-content` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `tasks-validate` drift gate installs the PINNED released arggon and diffs the committed seam, so any PR adding new generated seam content (e.g. the ZCode goal-mode template) fails until a release + ARGGON_VERSION re-pin

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
