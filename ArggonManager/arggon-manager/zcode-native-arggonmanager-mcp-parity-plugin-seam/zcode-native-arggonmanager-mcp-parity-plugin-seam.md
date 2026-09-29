---
type: epic
status: todo
id: zcode-native-arggonmanager-mcp-parity-plugin-seam
title: "ZCode-native ArggonManager: MCP parity + plugin seam"
parent: arggon-manager
labels: []
created: "2026-09-29"
updated: "2026-09-29"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/zcode-native-arggonmanager-mcp-parity-plugin-seam/zcode-native-arggonmanager-mcp-parity-plugin-seam.md (epic index; required).
  parent MUST be the initiative id. Container ids must not start with task-/bug-.
-->

# ZCode-native ArggonManager: MCP parity + plugin seam

## Context

Product-owner directive (2026-09-28): port the ArggonManager native surface
to ZCode with the same "as native as possible" bar as the OpenCode V2
program, mapping each capability onto ZCode's own extension model instead of
shaping ZCode into OpenCode. Two client differences drive the design: no
code-mode tools (MCP is the tool surface) and no per-agent permission DSL
(hooks + dispatch-scoped marker replace it).

## Acceptance

- [ ] Capability audit complete (ZCode plugin/hooks/agents/MCP surfaces,
      dated sources)
- [ ] ADR 0014 (multi-client native surfaces: ZCode via MCP + plugin)
- [ ] Implementation waves filed as tasks and closed

## Notes
