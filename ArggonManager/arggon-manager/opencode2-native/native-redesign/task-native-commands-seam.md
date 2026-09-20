---
type: task
status: todo
id: task-native-commands-seam
title: Native commands + seam without MCP
parent: native-redesign
depends_on: [task-native-tools]
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-commands-seam.md
  Leaves live only under a story. id is the filename stem: task-native-commands-seam.
  CLI `arggon create task native-commands-seam` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native commands + seam without MCP (W3)

## Context

W3 of `plan-native-first-011`. Replace the CLI-driving commands with native commands that drive tools (including `/arggon-adopt` for guided
adoption); regenerate the config seam without the MCP stanza; ship the vendored single-file plugin build; update the AGENTS.md router and the skill. ADR 0011 decision 5/6.

## Acceptance

- [ ] Fresh-`init` fixture yields the new seam (no MCP stanza) plus one headless scenario per command.
- [ ] `init` stays idempotent with provenance and never overwrites adopter files.
- [ ] The vendored plugin is single-file and loads in a dependency-less fixture.
- [ ] AGENTS.md router and skill describe the native surface (no CLI-driving prose).
- [ ] Session↔item correlation recognizes Code Mode `tools.arggon.<name>(…)`
      calls, not only MCP `arggon_*` names (plugin regex at `index.ts:703`);
      otherwise correlation regresses when MCP is dropped.
- [ ] Catalog budget: evaluate `options.pinned` on core tools as the W3 lever
      (pinning all 12 may exceed the ADR 0006 budget).

## Notes

- The W2 `loadArgonKernel()` failure-cache becomes moot if W3 ships a
  bundled single-file plugin (verify).

- Depends on W2; supersedes the ADR 0010 seam incrementally.
