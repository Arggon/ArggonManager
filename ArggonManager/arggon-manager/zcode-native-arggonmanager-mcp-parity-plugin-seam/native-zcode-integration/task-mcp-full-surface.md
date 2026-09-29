---
type: task
status: todo
id: task-mcp-full-surface
title: "MCP full tool surface: add the six missing tools"
parent: native-zcode-integration
labels: []
created: "2026-09-29"
updated: "2026-09-29"
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

### 2026-09-29 @Arggon
T1 implemented in worktree feat/task-mcp-full-surface, PR #436 open (not merged; item stays claimed until then). 15-tool MCP surface: priority/sync/import_issues in-process via kernel ops; start/branch/cleanup spawn the CLI (argv array) and return its --json envelope. Spawn spec derived from launch argv (cli.js / tsx) or injected; envelope-less children become tool errors, session survives. Parity invariant extended to 15 tools; envelope parity for priority/branch/cleanup. doctor --budget advisory cap 12 KiB -> 16 KiB (measured 15,701 B). Gates: 1710 vitest, eslint, tsc, validate all green. Gotcha for T2: spec/plan zcode-native-seam-012 + ADR 0014 live in THIS branch; flip spec/plan to implemented only when T2 lands.
