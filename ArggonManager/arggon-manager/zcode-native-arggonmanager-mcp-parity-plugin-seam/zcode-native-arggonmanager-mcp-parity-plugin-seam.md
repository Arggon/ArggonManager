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

- [x] Capability audit complete (ZCode plugin/hooks/agents/MCP surfaces,
      dated sources)
      (2026-10-01 artifact audit on task-zcode-live-verification: manifest,
      plugin.json, hooks.json parse; agents/commands parity; superseded and
      re-verified live 2026-10-10 after waves 1-2 — 15-tool MCP surface,
      13 commands, two subagents, gate fixed and live)
- [x] ADR 0014 (multi-client native surfaces: ZCode via MCP + plugin)
      (Accepted with status note; spec + plan zcode-native-seam-012 flipped
      `implemented` 2026-10-10)
- [x] Implementation waves filed as tasks and closed
      (subtree fully terminal 2026-10-10: task-mcp-full-surface,
      task-zcode-plugin-seam, task-zcode-board-command, task-zcode-goal-mode,
      task-zcode-live-verification, bug-force-push-gate-misses-refspec-plus —
      all done; story native-zcode-integration done)

## Notes
