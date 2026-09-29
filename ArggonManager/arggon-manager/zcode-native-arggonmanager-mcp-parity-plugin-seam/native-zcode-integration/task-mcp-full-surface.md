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

### handoff 2026-09-29 @Arggon — next: Review + merge PR #436. After merge: merge origin/main into feat/task-zcode-plugin-seam before landing #437 (main carries a comment commit on this item file; expect a trivial item-file overlap, keep …
- branch: feat/task-mcp-full-surface

### 2026-09-29 @Arggon
smoke: E2E evidence for PR #436 (MCP full tool surface) — node v26.7.0, npm 12.0.2, built dist/cli.js v0.4.0 (`npm run build` ok). Fixture: throwaway git repo; built bin `init` + create initiative/epic/story/task — all ok envelopes (l, a, story-login, task-rate-limit).

MCP probes (spawn `node dist/cli.js mcp`, newline-delimited JSON-RPC):
- initialize -> proto 2025-06-18, serverInfo {"name":"arggon","version":"0.4.0"} — PASS
- tools/list -> exactly 15 tools: arggon_list, arggon_create, arggon_update, arggon_comment, arggon_handoff, arggon_show, arggon_next, arggon_report, arggon_validate, arggon_priority, arggon_sync, arggon_import_issues, arggon_start, arggon_branch, arggon_cleanup — PASS
- arggon_list -> ok:true, 4 items incl task-rate-limit — PASS
- arggon_next -> ok:true, suggestion task-rate-limit — PASS
- arggon_create {task mcp-smoke @story-login} -> ok:true, id task-mcp-smoke — PASS
- arggon_update {status in_progress, assignee smoke} -> ok:true, claimed_at set — PASS
- arggon_branch {task-mcp-smoke} -> ok:true, branch feat/task-mcp-smoke, created:true — PASS
- arggon_priority {dry_run:true} -> ok:true, scanned=5, changed=0 — PASS
- arggon_cleanup {} -> ok:true, candidates=0 — PASS
- arggon_show {task-rate-limit} -> ok:true, item + comments[] — PASS
- arggon_validate -> ok:true, errors=0 — PASS

Error isolation:
- arggon_branch {id does-not-exist} -> isError:true, ok:false, code BRANCH_FAILED ("id not found"); follow-up tools/list -> 15 (session alive) — PASS
- no reopen via MCP: arggon_update {status todo} on a done item -> isError:true, ok:false, UPDATE_FAILED "agents must not reopen done items"; item frontmatter stays status: done — PASS
- arggon_update on missing id -> isError:true, UPDATE_FAILED — PASS

Not smoked: arggon_start (would push to a remote; spawn path identical to arggon_branch/arggon_cleanup, both smoked live), arggon_sync + arggon_import_issues (need gh + network; option-surface parity tests cover them).

Combined loop: this branch merged with feat/task-zcode-plugin-seam in a throwaway worktree (sole conflict: tracker item .md, resolved -X ours; zero code conflicts), fresh npm ci + build: init vendors the 18-file .zcode-marketplace seam AND `mcp` tools/list = 15. Full adopter loop green.
