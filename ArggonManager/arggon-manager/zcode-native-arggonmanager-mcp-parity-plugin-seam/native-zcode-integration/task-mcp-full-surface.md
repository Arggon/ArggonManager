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

Design as landed: `priority`/`sync`/`import_issues` call their existing kernel
operations (`priorityOperation`/`syncOperation`/`importIssuesOperation`)
in-process; `start`/`branch`/`cleanup` spawn the arggon CLI itself (argv
array, no shell) and return the CLI's `--json` envelopes — one
worktree/ergonomics implementation path, injection-safe by construction. The
default spawn spec is derived from the launch argv (built `cli.js` bin or the
tsx source runner); embedded runners inject `options.cliSpawn`. Every tool
schema property keeps the standing CLI ↔ MCP option-surface parity invariant
(`mcp-parity.test.ts`), and the `doctor --budget` advisory cap moved
12 KiB → 16 KiB with the measured re-baseline (15,701 B / 15 tools).

## Acceptance

- [x] `arggon mcp` exposes 15 tools; the six new ones are `arggon_priority`,
      `arggon_sync`, `arggon_import_issues`, `arggon_start`, `arggon_branch`,
      `arggon_cleanup` with schemas mirroring the CLI options
- [x] `priority`/`sync` go through the shared kernel operations (envelope
      parity with the CLI verified by a test)
- [x] `start`/`branch`/`cleanup` spawn the CLI with an argv array and return
      its `--json` envelope parity (tested with a spawned CLI), with kernel
      failures and envelope-less children surfacing as tool errors that never
      kill the session
- [x] CLI ↔ MCP option-surface parity test extended to the six new tools;
      envelope parity added for `priority`/`branch`/`cleanup` (sync and
      import-issues need `gh`/network, start needs a push — surface-checked
      only)
- [x] Agent playbook rules hold through MCP: no reopen of done/cancelled, no
      claim steal (no `--force` surface anywhere)
- [x] Bundled `skills/arggon-cli/references/json-contract.md` MCP section
      updated (nine → fifteen tools, spawn semantics)
- [x] Full test suite + lint/typecheck gates green (1710 tests); `arggon
      validate --json` `ok:true` before every commit

## Notes

ADR 0014 + spec/plan (`spec-zcode-native-seam-012`, `plan-zcode-native-seam-012`)
ride in this PR per the methodology (paperwork with the change); spec/plan flip
to `implemented` when T2 (`task-zcode-plugin-seam`) lands the plugin seam — the
spec's acceptance spans both waves.

## Notes
