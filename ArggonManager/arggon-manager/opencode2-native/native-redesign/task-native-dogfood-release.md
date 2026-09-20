---
type: task
status: todo
id: task-native-dogfood-release
title: "Dogfood, ADR 0006 measurement and release"
parent: native-redesign
depends_on: [task-native-headless-ci]
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-dogfood-release.md
  Leaves live only under a story. id is the filename stem: task-native-dogfood-release.
  CLI `arggon create task native-dogfood-release` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Dogfood, ADR 0006 measurement and release (W7)

## Context

W7 of `plan-native-first-011`. Migrate this repo's own `.opencode` seam to the native surface; run `context:report --strict`; finish packaging/release docs; tag. Closes the program.

## Acceptance

- [ ] ADR 0006 budgets re-measured and within limits; item block ≤ 1024 B.
- [ ] Dogfood scenarios green on this repo's own tracker.
- [ ] Packaging/release docs updated; release checklist executed.
- [ ] Release notes cover the W3 default-path change: the plugin no longer
      auto-registers the MCP server; an adopter re-running `init` loses
      auto-registration unless they configure the stanza (`doctor` reports it
      as optional).
- [ ] `arggon validate` and `spec validate` green.

## Notes

- Depends on W3–W6; this is the program's closing gate.
