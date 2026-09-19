---
type: epic
status: todo
id: opencode2-native
title: "OpenCode2-native ArggonManager: full redesign"
parent: arggon-manager
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/opencode2-native.md (epic index; required).
  parent MUST be the initiative id. Container ids must not start with task-/bug-.
-->

# OpenCode2-native ArggonManager: full redesign

## Context

Product-owner directive (2026-09-19): the `opencode2` branch exists to build
something **exclusive to OpenCode V2, as native as possible** — rewriting
everything if needed, discarding the CLI and/or the MCP server. Goal: analyze
every OpenCode V2 surface and define a complete new ArggonManager that exploits
those tools and features.

This relaxes the constraint ADR 0010 chose ("portable core unchanged + thin
native surface"): under that decision the CLI/MCP _were_ the product and
OpenCode was an optional addition. Under this program the OpenCode-native
surface is the product; portability to other runtimes is not a requirement.

## Acceptance

- [ ] Capability audit complete (every OpenCode V2 surface, dated sources).
- [ ] ADR succeeding/superseding 0010 with the chosen architecture.
- [ ] Spec + plan for the new ArggonManager.
- [ ] Implementation waves filed as stories/tasks and closed.

## Notes

- Baseline: the existing native surface (plugin W2/W3, agents, commands,
  skills, MCP) and the kernel in `cli/src/`.
- `docs/opencode2.md` documents the superseded direction; it will be rewritten
  by the new program.
