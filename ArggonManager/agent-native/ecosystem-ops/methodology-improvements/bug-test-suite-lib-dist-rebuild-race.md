---
type: bug
status: todo
id: bug-test-suite-lib-dist-rebuild-race
title: "`npm test` can fail spuriously: five test files rebuild `lib/dist` while vitest runs files in parallel, so a spawned CLI child imports a half-written kernel module"
parent: methodology-improvements
labels: [tests, ci-blocking, tooling]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-test-suite-lib-dist-rebuild-race.md
  Leaves live only under a story. id is the filename stem: bug-test-suite-lib-dist-rebuild-race.
  CLI `arggon create bug test-suite-lib-dist-rebuild-race` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `npm test` can fail spuriously: five test files rebuild `lib/dist` while vitest runs files in parallel, so a spawned CLI child imports a half-written kernel module

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
