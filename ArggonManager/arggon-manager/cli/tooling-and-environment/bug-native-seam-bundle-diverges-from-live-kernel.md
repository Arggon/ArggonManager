---
type: bug
status: todo
id: bug-native-seam-bundle-diverges-from-live-kernel
title: "The native seam runs a frozen single-file bundle of the kernel, and it computed a different done-gate verdict than the CLI on the same file — `tools.arggon.update --status done` refused a flip the CLI accepted, with both `lib/src` and `lib/dist` independently returning `gated:false`"
parent: tooling-and-environment
labels: [native-seam, parity, done-gate, cli]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-native-seam-bundle-diverges-from-live-kernel.md
  Leaves live only under a story. id is the filename stem: bug-native-seam-bundle-diverges-from-live-kernel.
  CLI `arggon create bug native-seam-bundle-diverges-from-live-kernel` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The native seam runs a frozen single-file bundle of the kernel, and it computed a different done-gate verdict than the CLI on the same file — `tools.arggon.update --status done` refused a flip the CLI accepted, with both `lib/src` and `lib/dist` independently returning `gated:false`

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
