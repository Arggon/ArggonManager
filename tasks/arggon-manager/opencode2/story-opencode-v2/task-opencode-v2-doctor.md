---
type: task
status: in_progress
id: task-opencode-v2-doctor
title: "arggon doctor: OpenCode integration checks"
assignee: Arggon
branch: feat/task-opencode-v2-doctor
parent: story-opencode-v2
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T00:57:27.680Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode-v2-doctor
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

- [x] `doctor --json` gains an additive `opencode` block: detected config files
      (`opencode.json(c)`, `.opencode/opencode.json(c)`), V1-shaped keys
      (top-level `mcp.<name>`, `enabled`, `autoupdate`, `permission`, `tools`,
      `maxSteps`), presence of generated `.opencode/` artifacts, bundled
      `.agents/skills/*`, and whether the arggon MCP server is registered
      natively vs only in `.mcp.json`.
- [x] Findings are bounded and actionable (exact stanza/path to add), never
      writes, exit code unchanged (report-only, like the rest of doctor).
- [x] Tests: V1-shaped config fixture, clean repo, repo with artifacts;
      JSON contract documented in `docs/json-output.md`.
- [x] Wall-clock and output stay bounded (no recursive scans of ignored trees).

## Notes

- Exit 0 always, including when findings exist — this mirrors doctor's current
  contract; the board/report/doctor trio must not start failing builds.
- If a `.mcp.json` exists with the arggon entry and no native registration, the
  finding explains the V2 precedence and offers the stanza; it does not migrate.

### 2026-09-18 @Arggon
### Evidence — W1c doctor OpenCode checks (2026-09-18)

Implementation commit 579982c on `feat/task-opencode-v2-doctor`; probed with the built CLI (`npm run build` → `dist/cli.js`) on throwaway fixtures under `/tmp/opencode/arggon-doctor-evidence`. Expected vs observed:

**1. fresh init** (pre-`opencode-seam-010` branch state)
- expected: no config, no seam artifacts, 2 bundled skills, `.mcp.json` present → hint
- observed: `configs: []`; `v1.findings: []`; `artifacts: {config:false, agents:[], commands:[], skills:["arggon-cli","arggon-upgrade"]}`; `mcp: {native:false, mcpJson:true, hint:"OpenCode V2 does not read .mcp.json — add \"mcp.servers.arggon\" in opencode.json(c): \"mcp\": {\"servers\": {\"arggon\": ...}}}"}`; exit 0. ✔

**2. V1-shaped adopter config** (`opencode.json` with top-level `mcp.arggon` + `enabled`/`autoupdate`/`permission`/`tools`/`maxSteps`)
- expected: config detected, 6 V1 hits, `native:false`, hint
- observed: `configs:["opencode.json"]`; `v1.findings:[{file:"opencode.json", keys:["autoupdate","enabled","maxSteps","mcp.arggon","permission","tools"]}]`; `mcp:{native:false, mcpJson:true, hint:...}`; human output prints both hint lines; exit 0. ✔

**3. `.mcp.json`-only** (adopter `opencode.json` without MCP servers)
- expected: config detected, no V1 hits, `native:false`, `mcpJson:true`, exact-stanza hint
- observed: exactly that; human line `opencode: config opencode.json, no seam artifacts, 2 bundled skill(s), MCP only in .mcp.json` + hint; exit 0. ✔

**4. seam present** (simulating post-`task-opencode-v2-spec`: the real generated `opencode.jsonc` + 3 agents + 6 commands on disk)
- expected: JSONC parsed, `configs:["opencode.jsonc"]`, seam 10, `native:true`, no hint
- observed: exactly that; human line `opencode: config opencode.jsonc, seam 10 artifact(s), 2 bundled skill(s), MCP native`; exit 0. ✔

**Tests**: `npx vitest run cli/src/doctor.test.ts` → 35 passed (10 new: seam/no-adopter-config, V1-shaped, native no-hint, `.mcp.json`-only hint, no-wiring no-hint, bounded caps, malformed config, `.opencode/` candidates, non-initialized cwd, CLI `--json`). Full `npm test` → 66 files, **1057 passed** (baseline 1047 + 10). `npm run lint` clean; `arggon validate --json` ok 0/0.
Note: one intermediate full-suite run failed `measure.test.ts > always deletes the measurement temp tree` because a concurrent baseline suite (another checkout) raced on shared `/tmp/arggon-budget-*`; a serial rerun is green — transient, unrelated to this change.

**Ownership disclosure**: the `doctor --json` payload is whitelisted in `cli/src/cli.ts`, so the block cannot reach `--json` without the one-line wiring `opencode: result.opencode,` there. `cli/src/cli.ts` was outside my assigned file list and no other wave item touches it; I made that single-line edit and disclose it for review. Also: `OPENCODE_CONFIG_CANDIDATES` in `doctor.ts` mirrors `findOpenCodeConfig` (docs.ts, W1a) by hand because doctor reports ALL present configs while that helper returns the first only — reconcile when the seam branch lands (or leave the comment).
