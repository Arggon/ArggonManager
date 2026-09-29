---
type: task
status: in_progress
id: task-mcp-full-surface
title: "MCP full tool surface: add the six missing tools"
assignee: Arggon
branch: feat/task-mcp-full-surface
parent: native-zcode-integration
labels: []
created: "2026-09-29"
updated: "2026-09-29"
claimed_at: "2026-09-29T10:38:40.231Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-mcp-full-surface
---
<!--
  Placement (v0): ArggonManager/arggon-manager/zcode-native-arggonmanager-mcp-parity-plugin-seam/native-zcode-integration/task-mcp-full-surface.md
  Leaves live only under a story. id is the filename stem: task-mcp-full-surface.
  CLI `arggon create task mcp-full-surface` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# MCP full tool surface: add the six missing tools

## Context

ZCode has no code-mode tool mechanism, so `arggon mcp` IS the native tool
surface for a ZCode-native seam (ADR 0014). Today it exposes only the core
nine tools (`list/create/update/comment/handoff/show/next/report/validate`);
the OpenCode V2 native surface additionally ships `priority`, `sync`,
`import_issues` and the worktree lifecycle (`start`, `branch`, `cleanup`).
A ZCode session cannot run the find → claim → worktree → PR loop through MCP
alone. Decision (product owner, 2026-09-28): the MCP surface gains the six
missing tools so both clients reach full parity.

Design constraints: `priority`/`sync` call their existing kernel operations
(`priorityOperation`/`syncOperation`) in-process; `import_issues`/`start`/
`branch`/`cleanup` spawn the arggon CLI itself (argv array, no shell) and
return the CLI's `--json` envelopes — one worktree/ergonomics implementation
path, injection-safe by construction. Every tool schema property must keep the
standing CLI ↔ MCP option-surface parity invariant (`mcp-parity.test.ts`).

## Acceptance

- [ ] `arggon mcp` exposes 15 tools; the six new ones are `arggon_priority`,
      `arggon_sync`, `arggon_import_issues`, `arggon_start`, `arggon_branch`,
      `arggon_cleanup` with schemas mirroring the CLI options
- [ ] `priority`/`sync` go through the shared kernel operations (envelope
      parity with the CLI verified by a test)
- [ ] `import_issues`/`start`/`branch`/`cleanup` spawn the CLI with an argv
      array and return its `--json` envelope byte-parity (test with a spawned
      CLI), with kernel failures surfacing as tool errors that never kill the
      session
- [ ] CLI ↔ MCP option-surface parity test extended to the six new tools
- [ ] Agent playbook rules hold through MCP: no reopen of done/cancelled, no
      claim steal (no `--force` surface anywhere)
- [ ] `references/json-contract.md` MCP section updated (nine → fifteen tools)
- [ ] Full test suite + lint/typecheck gates green; `arggon validate --json`
      `ok:true` before every commit

## Notes
