---
type: task
status: in_progress
id: task-playbook-opencode-2-0-10
title: Refresh OpenCode playbook pin to 2.0.10 + re-probe plugin import A/B
assignee: Arggon
branch: feat/task-playbook-opencode-2-0-10
parent: story-tech-playbooks
labels: []
priority: p2
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T10:45:15.393Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-playbook-opencode-2-0-10
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tech-playbooks/task-playbook-opencode-2-0-10.md
  Leaves live only under a story. id is the filename stem: task-playbook-opencode-2-0-10.
  CLI `arggon create task playbook-opencode-2-0-10` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Refresh OpenCode playbook pin to 2.0.10 + re-probe plugin import A/B

## Context

Declared follow-up from exploration `exploration-opencode2-native-010` (epic
`opencode2-native`): the local runtime is `opencode v2.0.10` (2026-09-19) while
`docs/playbooks/opencode.md` still pins 2.0.8 and records the A/B probe from
that version.

Per the playbook's upgrade policy, refresh the research record and re-run the
A/B plugin-import probe (dependency-less fixture: documented static import vs
the guarded dynamic import) on 2.0.10; note any behavior change.

## Acceptance

- [x] `docs/playbooks/opencode.md` version/pin and research record updated to
      2.0.10 with the probe date.
- [x] A/B probe result recorded (static import failure mode re-confirmed or
      changed; guarded import still loads).
- [x] Any new gotcha folded into the playbook's Conventions/Troubleshooting.
- [x] `arggon validate` green; docs-only diff.

## Notes

- 2.0.8 → 2.0.10 is patch-level, but the pin refresh is part of the native
  redesign program's version discipline.

### 2026-09-20 @Arggon
A/B plugin-import re-probe on `opencode v2.0.10` (probe date 2026-09-20) + full smoke refresh — evidence for the reviewer.

**Fixture** `/tmp/opencode/opencode-plugin-import-probe-210`: fresh git repo + `arggon init` tracker, **no `node_modules` in the fixture or any ancestor** (asserted), `opencode.jsonc` edited to register **no MCP server** (so a connected `arggon` server can only come from the plugin's `ctx.mcp.transform`). Two auto-discovered plugins:

- **A** `.opencode/plugins/a-docs-pattern/index.ts` — the V2 docs pattern verbatim: `import { Plugin } from "@opencode/plugin"` + `Plugin.define`, writes a setup marker.
- **B** `.opencode/plugins/arggon/index.ts` — the `arggon init`-bundled guarded source (byte-identical to `opencode/plugins/arggon/index.ts` except the generated `//` marker); the guarded dynamic import is in place.

**Command** (one real headless session, same invocation as the smoke harness):
`opencode run --standalone --print-logs --log-level info --model opencode-go/deepseek-v4-flash --format json "<execute tools.arggon.arggon_next({})>"` → exit 0. Raw transcripts: fixture `.smoke-evidence/` (`ab.stdout.jsonl`, `ab.stderr.log`, `opencode-version.txt`).

**Expected vs observed (2.0.10)**

| Probe                      | Expected (2.0.7/2.0.8 shape)                       | Observed on 2.0.10                                                                                                                                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — docs static import     | fails to load, `setup` never runs, session exits 0 | **same**: `INFO msg="loading plugin" id=…/a-docs-pattern` → `WARN message="failed to load plugin" … cause="Cause([Die(ResolveMessage: Cannot find package '@opencode/plugin' imported from …/a-docs-pattern/index.ts)])"`; setup marker **ABSENT**; exit 0                                                                  |
| B — bundled guarded plugin | loads, registers `arggon` MCP, tool usable         | **same**: `msg="loading plugin" id=…/.opencode/plugins/arggon` → `message="mcp connected" server=arggon tools=9` (no config stanza exists); transcript: `execute` completed `return await tools.arggon.arggon_next({})` → `{"ok": true, "schemaVersion": 1, "conventionVersion": 5, "command": "next", "suggestion": null}` |
| Failure isolation          | A first, B unaffected                              | **same**: A is discovered first and fails; B still loads and works                                                                                                                                                                                                                                                          |

The only log-shape difference from 2.0.8 is the failure wrapper (`Cause([Die(ResolveMessage: …)])`) around the same `Cannot find package '@opencode/plugin'` root cause — no behavior change. **Verdict: keep the guarded form; no critical incompatibility found.**

**New gotcha folded into Conventions:** on the first model call of the session the Code Mode catalog lagged MCP startup — the first `execute` returned `Unknown tool 'arggon.arggon_next'` and the immediate retry succeeded (2.0.10 re-probe; the smoke prompt's one-retry line has covered this since W2).

**Propagation in this PR (docs-only, 6 .md files):** playbook pin `version: 2.0.10` / `researched: 2026-09-20` via `arggon playbook refresh`; research record + Setup; Conventions (per-version probe evidence 2.0.7/2.0.8/2.0.10, catalog-lag note); Testing (11 scenarios re-verified, A/B details); pin references refreshed in `README.md`, `docs/agents.md`, `docs/opencode2.md`, ADR 0010's revisit trigger; exploration-010 F1.16 marked landed.

**Smoke (same runtime):** `ARGON_SMOKE_KEEP=1 npm run smoke:opencode` → **11 scenarios, 0 failures** (fixtures kept for inspection).

**Gates:** `npm test` 83 files / 1350 tests passed · `npm run lint` clean · `npm run build` clean · `arggon validate` ok 0 errors/0 warnings · `arggon spec validate` ok 0/0 · diff docs-only (no `opencode/plugins/**` or source changes).
