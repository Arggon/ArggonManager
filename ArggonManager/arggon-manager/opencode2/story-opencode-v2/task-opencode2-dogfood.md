---
type: task
status: done
id: task-opencode2-dogfood
title: "Dogfood: ArggonManager self-hosts the OpenCode2 surface"
assignee: Arggon
branch: feat/task-opencode2-dogfood
parent: story-opencode-v2
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
depends_on: [task-opencode-v2-plugin, task-opencode2-orchestration, task-opencode2-methodology]
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode2-dogfood.md
  Leaves live only under a story. id is the filename stem: task-opencode2-dogfood.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Dogfood: ArggonManager self-hosts the OpenCode2 surface

## Context

W7 of [plan-opencode2-009](../../../../docs/plans/plan-opencode2-009.md): this
repository becomes the reference adopter of its own V2 surface, the program
documents close, and the program closes on the `opencode2` branch (`main`
stays untouched by product decision). The dogfood is the
strongest acceptance signal: if the generated seam + plugin + agents/commands
cannot run ArggonManager's own work loop, the program is not done.

## Acceptance

- [x] This repo carries the generated surface (checked in, provenanced):
      `opencode.jsonc` (root), `.opencode/plugins/arggon/`, `.opencode/agents/`,
      `.opencode/commands/`, slim `AGENTS.md`, skill with references.
- [x] A real session on this repo demonstrates the loop end-to-end with
      evidence: `next` → claim → worktree → work → review verdict → done
      (transcript attached to the item).
- [x] Upgrade path proven: a second `arggon init` run refreshes untouched
      artifacts, skips modified ones, and reports both lists.
- [x] Docs and release: `docs/playbooks/opencode.md` current; README,
      `docs/agents.md`, `docs/json-output.md` reflect shipped behavior;
      `spec-opencode2-009` and `plan-opencode2-009` statuses flipped to
      `implemented` in the same PR.
- [x] Context budgets re-checked per task-opencode2-context (MCP tools/list within the 12,288 B advisory; context:report --strict green).
- [x] Gates green: `arggon validate`, `arggon spec validate`, `arggon doctor`,
      full test suite, `npm run smoke:opencode` harness.
- [x] Program close-out PR on `opencode2` references epic `opencode2` and the spec; the story closes through the normal cascade after merge, and the epic stays open while `story-opencode2-hardening` tracks the p3 backlog.

## Notes

- Depends on plugin, orchestration and methodology waves; run last.
- If any gate fails, file the finding as an item instead of weakening the
  acceptance.

### 2026-09-18 @Arggon
## W7 dogfood evidence (worker @Arggon) — pending coordinator review/merge

**Surface committed (7122c8c):** `opencode.jsonc`, `.mcp.json`, 3 agents, 10 commands, `tasks/.convention.yml` (+111 lines: projectName + 22 `x-generated` entries). Derived single-source bundles (`.agents/skills/**`, `.opencode/plugins/arggon/index.ts`) are gitignored by the repo's design: byte-parity verified, provenance recorded. `AGENTS.md` is adopter-owned (1,559 B slim router); `init` skipped it by never-overwrite, no diff.

**init buckets.** Run 1: created 22 / updated 0 / skipped 9 (adopter-modified: .editorconfig, .github/*, AGENTS.md, CLAUDE.md, CONTRIBUTING.md, SECURITY.md, docs/tracking.md). Run 2 on the committed tree: created 0 / updated 22 / skipped 9; only `generatedAt` churned in state. Run 3 probe (edited `.opencode/commands/arggon-status.md`): skipped 10 / modified 3 including the edit; sha256 unchanged after the run (never clobbered); probe restored.

**Real sessions (opencode v2.0.7, this worktree).** Session A `ses_f4d5efc0effeWloPpAnFvFhKRn`: plugin loaded from `.opencode/plugins/arggon`; `mcp connected server=arggon tools=9`; `[arggon] session renamed to task-opencode2-dogfood`; `[arggon] context: injected item task-opencode2-dogfood (312 bytes)` per model call; `tools.arggon.arggon_show` returned `{"ok":true,...,"command":"show"}`; model echoed the injected item id; `opencode.jsonc` sha256 identical before/after (no clobber). Session B `ses_f4d5f50fcffe0pisbBiJrS5bw6`: skill tool loaded `arggon-cli`, read `.agents/skills/arggon-cli/references/orchestration.md`; replied `SKILL_OK=arggon-cli REF_HEAD=# Orchestration — multi-agent work`. Both sessions persisted with title `task-opencode2-dogfood`. This worker session (`ses_f4d633ecdffea04CaLlXaunx72`) ran the real loop: next → `start --worktree` (via the `bug-start-worktree-node-modules` workaround: manual worktree + node_modules symlink + attach) → work → PR; review verdict/done are coordinator steps by rule.

**Gates.** `arggon validate` ok (0 warnings) · `arggon spec validate` ok · `arggon doctor` ok (opencode: config + 3 agents + 10 commands + 2 skills, V1 findings none, MCP native) · `npm test` 69 files / 1113 passed · `npm run smoke:opencode` 11 scenarios / 0 failures · `npm run context:report -- --strict` exit 0, MCP `tools/list` 10,096 B ≤ 12,288 B advisory · lint + build clean.

**Docs.** `spec-opencode2-009` and `plan-opencode2-009` → `implemented`; the W6 numbers recorded under plan T15; README and docs/agents.md seam enumerations now include the plugin.

**PR:** draft close-out to `opencode2` (merge-commit — it carries tracker auto-commits). No container/status flips by this worker.

**For coordinator triage (not filed, subagent rule):** (1) `init` re-runs here report `commit.skipped: git add failed ... ignored ...` because it stages the ignored bundles — a self-hosting tree can be left with a dirty index; plain adopters unaffected. (2) `/tmp/arggon-budget-*` hygiene race between `measure.test.ts` and a concurrent `doctor --budget` (known transient; serial run green). (3) generated `formatter: true` prettier-formatted whole files on agent edits (reverted; PR diff kept surgical). (4) open p3 follow-ups under `story-opencode-v2` block the acceptance-aware cascade for the story/epic — decide before merge.

### handoff 2026-09-18 @Arggon (session: ses_f4d633ecdffea04CaLlXaunx72) — next: Coordinator: review draft PR #331 (base opencode2, MERGE commit — tracker auto-commits). Decide the 7 open p3 follow-ups before flipping this item done; they block the story/epic cascade.
- branch: feat/task-opencode2-dogfood
- open questions: File the init commit.skipped-on-ignored-bundles observation?; Keep story-opencode-v2 open until the p3 follow-ups land, or waive/cancel them at close-out?
