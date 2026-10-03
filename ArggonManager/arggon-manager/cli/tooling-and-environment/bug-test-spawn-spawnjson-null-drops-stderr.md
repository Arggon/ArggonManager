---
type: bug
status: todo
id: bug-test-spawn-spawnjson-null-drops-stderr
title: "`test-spawn` spawnJson resolves `null` on empty stdout and discards stderr with `void err;`, so a spawn/load failure is indistinguishable from a resolved value — same trigger as the mcp-parity flake, different helper"
parent: tooling-and-environment
labels: [tests, ci]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-test-spawn-spawnjson-null-drops-stderr.md
  Leaves live only under a story. id is the filename stem: bug-test-spawn-spawnjson-null-drops-stderr.
  CLI `arggon create bug test-spawn-spawnjson-null-drops-stderr` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `test-spawn` spawnJson resolves `null` on empty stdout and discards stderr with `void err;`, so a spawn/load failure is indistinguishable from a resolved value — same trigger as the mcp-parity flake, different helper

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
