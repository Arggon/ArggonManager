---
type: task
status: in_progress
id: task-native-commands-seam
title: Native commands + seam without MCP
assignee: Arggon
branch: feat/task-native-commands-seam
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T13:01:35.069Z"
depends_on: [task-native-tools]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-commands-seam
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

- [x] Fresh-`init` fixture yields the new seam (no MCP stanza) plus one headless scenario per command.
- [x] `init` stays idempotent with provenance and never overwrites adopter files.
- [x] The vendored plugin is single-file and loads in a dependency-less fixture.
- [x] AGENTS.md router and skill describe the native surface (no CLI-driving prose).
- [x] Session↔item correlation recognizes Code Mode `tools.arggon.<name>(…)`
      calls, not only MCP `arggon_*` names (plugin regex at `index.ts:703`);
      otherwise correlation regresses when MCP is dropped.
- [x] Catalog budget: evaluate `options.pinned` on core tools as the W3 lever
      (pinning all 12 may exceed the ADR 0006 budget).

## Notes

- The W2 `loadArgonKernel()` failure-cache becomes moot if W3 ships a
  bundled single-file plugin (verify).

- Depends on W2; supersedes the ADR 0010 seam incrementally.

### 2026-09-20 @Arggon
W3 native commands + seam without MCP — implemented on `feat/task-native-commands-seam`.

Seam (ADR 0011 §5/§6, ADR 0013)

- `templates/docs/opencode.jsonc` keeps formatter + compaction `keep.tokens` and drops the `mcp.servers.arggon` stanza; the plugin no longer touches `ctx.mcp`. MCP stays available through `arggon mcp`/`.mcp.json` for other clients, and `doctor` now reports a present stanza as _optional_ (removal guidance) instead of recommending registration; `.mcp.json`-only is the expected shape (no hint).
- All eleven native command templates drive the tools (Code Mode `tools.arggon.*`) and write the methodology artifacts directly; `/arggon-adopt` is new; `agent:`/`subagent:` where they apply (done/adopt → coordinator, review → reviewer + subagent); no CLI-driving prose, no shell blocks.
- AGENTS.md router, the `arggon-cli` skill (SKILL.md + json-contract reference), `docs/agents.md` (MCP server + OpenCode V2 sections), the OpenCode playbook, `docs/opencode2.md`, `docs/json-output.md` (doctor hint) and README describe the native surface.

Vendored bundle (single-file, dependency-free)

- `npm run build:plugin` (postbuild) generates `opencode/plugins/arggon/index.bundle.ts` from `opencode/plugins/arggon/index.ts` with `@arggon/lib` inlined: 36 modules, 282,381 B, deterministic (md5 92fc312c…); the only bare import left is `node:module`. No bundler dependency (TypeScript compiler API + a tiny ESM module registry).
- `init` vendors that artifact to `.opencode/plugins/arggon/index.ts` with the standard `//` provenance marker and x-generated state; `cli/src/plugin-copy.test.ts` regenerates artifact + vendored copy and pins the bytes.
- `opencode/plugins/arggon/bundle.test.ts` copies the artifact to a temp dir with **no `node_modules`**, imports it, runs `setup()` and calls tools: 12 tools registered (namespace/codemode), the pinned subset exact, `list`/`show` envelopes, `SHOW_FAILED` typed error.

Correlation

- `parseArggonItemFromCode` now matches `tools.arggon.<name>(…)` alongside the MCP `arggon_*` spelling (module-level global regexes reset `lastIndex` between calls); `parseArggonItemFromTool` accepts `arggon.<name>`/`tools.arggon.<name>`. Unit tests cover native calls + coexistence; the smoke's context-storage scenario correlates from an observed native `tools.arggon.show` call.

Catalog budget (`options.pinned`)

- Core eight tools register `options.pinned: true` (list/create/update/show/next/validate/comment/handoff); the maintenance four (report/priority/sync/import_issues) stay unpinned and search-reachable. `nativeToolSchemas`/`nativeToolsCatalogBytes` carry the flag and `context:report` prints the pinned count.
- `npm run context:report -- --strict` → all bounds pass: native 12 tools (8 pinned) 11,097 B ≤ 12,288 B advisory; AGENTS.md 1,959 B ≤ 2,048; item block 252 B ≤ 1,024; fixed total 24,505 B.

Gates

- `npm test` → 86 files / 1393 tests green; `npm run lint` clean; `npm run build` ok; `arggon validate` ok (0 warnings); `arggon spec validate` ok (18 docs); `npm run smoke:opencode` → `npm run smoke:opencode` → **23 scenarios / 0 failures** (104 checks, incl. 33 command checks over the 11 commands) on opencode v2.0.10; `npm run context:report -- --strict` → all bounds pass.

Open questions / follow-ups

- `options.pinned` is an undocumented 2.0.10 runtime option (probe: the runtime's own `session_move` uses it); treated as feature-detected — if a future 2.x ignores/drops it, every tool stays reachable through `search`.
- This repo's own tracked `.opencode/commands/*.md` (dogfood seam) still carries the W2 templates; W7 migrates the repo's own seam per the plan.
- `npm run smoke:opencode:wave` was not updated/run for W3 (it drives the CLI/MCP wave; W4/W7 territory).
- MCP auto-registration removal means an adopter who wants the stdio server must configure `mcp.servers.arggon` explicitly (doctor reports it as optional) — intended per ADR 0011 §5.

### handoff 2026-09-20 @Arggon — next: Coordinator review of draft PR #376: verify the W3 evidence (smoke 23/0, context:report --strict) and merge with a merge commit (tracker auto-commits live on this branch, never squash).
- branch: feat/task-native-commands-seam
- open questions: options.pinned is an undocumented 2.0.10 option (feature-detected; core 8 pinned, all 12 still search-reachable); this repo's own tracked .opencode/commands dogfood still carries the W2 templates (W7…
