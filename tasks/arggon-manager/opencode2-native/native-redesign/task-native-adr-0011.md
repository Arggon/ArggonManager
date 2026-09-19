---
type: task
status: todo
id: task-native-adr-0011
title: "ADR 0011: OpenCode2-native architecture"
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-adr-0011.md
  Leaves live only under a story. id is the filename stem: task-native-adr-0011.
  CLI `arggon create task native-adr-0011` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0011: OpenCode2-native architecture

## Context

Decision task from `task-native-capability-audit` (exploration
`docs/explorations/exploration-opencode2-native-010.md`, 2026-09-19).

The audit recommends candidate B (native-first hybrid): in-process kernel tools
(`ctx.tool.transform`, namespaced + `codemode`), native commands, permissions as
hard gates, the worktree domain, TUI panels/routes, git-native `tasks/` as
canonical data, and a thin headless artifact for bootstrap + CI; MCP optional.

ADR 0011 must decide and record:

- Surface map and the fate of CLI/MCP (drop vs thin adapter).
- Distribution: single npm package (kernel library + plugin + bootstrap bin).
- Migration from the ADR 0010 surface (provenance/init) and which sections of
  0010 it supersedes.
- The audit's open tensions (F3.1/F4): bootstrap artifact form and the B→A
  criteria; kernel-as-library vs dependency-less vendored plugin; config-seam
  content after the MCP demote; MCP adapter drop-vs-conditional; ADR 0006
  re-measurement as the native wave gate.

## Acceptance

- [ ] `docs/adr/0011-*.md` merged, following the ADR format, explicitly
      superseding ADR 0010 §2/§3 and its packaging deferrals.
- [ ] Decision covers D1 (git-native data), D2 (methodology contract kept,
      mechanics native), distribution, migration and revisit triggers.
- [ ] Follow-up spec/plan/wave tasks filed under `native-redesign`.
- [ ] `arggon validate` green; docs-only diff.

## Notes

- Blocks the implementation waves; the product owner confirms D1/D2 through
  this ADR.
