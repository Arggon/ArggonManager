---
type: task
status: todo
id: task-opencode-v2-doctor
title: "arggon doctor: OpenCode integration checks"
priority: p2
parent: story-opencode-v2
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-opencode-v2/task-opencode-v2-doctor.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-doctor.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon doctor: OpenCode integration checks

## Context

`arggon doctor` is the pure-read installation-state command. The research
([exploration-opencode-v2-native-009](../../../../docs/explorations/exploration-opencode-v2-native-009.md))
found two gaps worth reporting without writing anything: V2 registers MCP
servers under `mcp.servers` in `opencode.json(c)` (the generated `.mcp.json` is
unverified for V2), and adopters may carry V1-shaped config keys. Doctor is the
right surface: report-only, exit 0, actionable.

## Acceptance

- [ ] `doctor --json` gains an additive `opencode` block: detected config files
      (`opencode.json(c)`, `.opencode/opencode.json(c)`), V1-shaped keys
      (top-level `mcp.<name>`, `enabled`, `autoupdate`, `permission`, `tools`,
      `maxSteps`), presence of generated `.opencode/` artifacts, bundled
      `.agents/skills/*`, and whether the arggon MCP server is registered
      natively vs only in `.mcp.json`.
- [ ] Findings are bounded and actionable (exact stanza/path to add), never
      writes, exit code unchanged (report-only, like the rest of doctor).
- [ ] Tests: V1-shaped config fixture, clean repo, repo with artifacts;
      JSON contract documented in `docs/json-output.md`.
- [ ] Wall-clock and output stay bounded (no recursive scans of ignored trees).

## Notes

- Exit 0 always, including when findings exist — this mirrors doctor's current
  contract; the board/report/doctor trio must not start failing builds.
- If a `.mcp.json` exists with the arggon entry and no native registration, the
  finding explains the V2 precedence and offers the stanza; it does not migrate.
