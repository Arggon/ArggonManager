---
type: task
status: in_progress
id: task-opencode2-context
title: Context and token optimization for V2 runtime
assignee: Arggon
branch: feat/task-opencode2-context
parent: story-opencode-v2
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T03:15:43.469Z"
depends_on: [task-opencode-v2-plugin]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-context
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode2-context.md
  Leaves live only under a story. id is the filename stem: task-opencode2-context.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Context and token optimization for V2 runtime

## Context

W6 of [plan-opencode2-009](../../../../docs/plans/plan-opencode2-009.md).
ArggonManager's own ADR 0006 makes token/context efficiency a product value;
the OpenCode2 surface changes what is in the prompt (AGENTS router, skill
descriptions, agent prompts, tool schemas, injected item block, compaction
retention). This task measures and tunes that surface with before/after
evidence instead of intuition.

## Acceptance

- [ ] Measurement method documented and reproducible: `doctor --budget`
      surfaces plus a scripted count of V2 system-prompt contributions
      (AGENTS.md text, advertised skill ids/descriptions, agent prompts, MCP
      tool schemas, injected item block) on a fixture repo.
- [ ] Baseline captured before each wave lands (W1–W5) and after; a results
      table inside this item's Notes with method, dates and numbers.
- [ ] Tuning applied where the numbers justify it: skill description/bodies,
      agent prompt lengths, item-block bound, compaction `keep.tokens` in the
      generated config, Code Mode batching guidance for coordinators.
- [ ] No dimension regresses beyond the agreed bound; any waived regression has
      an explicit rationale and a follow-up item.
- [ ] Findings that affect docs (README, playbook, agents.md) updated in the
      same PR.

## Notes

- Depends on task-opencode-v2-plugin; per-wave numbers can start at W1 (config
  seam) even before the plugin lands.
- Prefer measured constraints that a test can enforce (e.g. max bytes for the
  injected block, max length of advertised descriptions) over prose guidance.

### 2026-09-18 @Arggon
### 2026-09-18 @Arggon — W6 context/token report (work complete, draft PR pending)

**Method (reproducible).** New report-only script `smoke/context-report.ts`
(`npm run context:report`; flags `--json`, `--strict`; NO model calls, no
network) — `arggon init` on a temp fixture with a fixed project name
(`ctx-fixture`) so `{{PROJECT_NAME}}` renders deterministically; kernel
surfaces (list/show/MCP `tools/list`) are reused from
`arggon doctor --budget --json`; the injected item block is measured through
the shipped plugin helper (`buildItemBlock`, with `ITEM_BLOCK_MAX_BYTES`
imported, never copied); the pre-W5 skill is reconstructed from git history
(newest revision of `skills/arggon-cli/SKILL.md` whose tree has no
`references/`). Tokens = bytes/4 (stated heuristic; ADR 0006 baseline method).

**Results (2026-09-18).**

| Surface | When paid | Bytes | ~tok | Bound | Verdict |
| --- | --- | ---: | ---: | --- | --- |
| generated `AGENTS.md` | per session | 1,863 | 466 | ≤2,048 B (test-enforced) | pass (1,872 B on doctor's tree — project-name length) |
| skill entry `arggon-cli` (description) | per session | 176 | 44 | — | pass |
| skill entry `arggon-upgrade` (description) | per session | 324 | 81 | — | pass |
| agent descriptions ×3 | per session | 393 | 98 | — | pass |
| MCP `tools/list` (9 tools, live) | per session | 10,096 | 2,524 | ≤12,288 B advisory | pass; **+1,046 B (+11.6%)** vs 9,050 B (2026-09-15) |
| **fixed per-session total** | per session | **12,852** | **3,213** | — | — |
| injected item block | per model call | 193 / 252 measured | 48 / 63 | ≤1,024 B | pass; W3 smoke 181–204 B |
| compaction `keep.tokens` | compaction | 15,000 retained | — | V2 default 15,000 | keep |
| umbrella `SKILL.md` | on skill load | 9,582 fixture / 9,518 source | 2,380 | — | pass |
| `references/json-contract.md` | on demand | 3,695 | 924 | — | — |
| `references/methodology.md` | on demand | 5,102 | 1,276 | — | — |
| `references/orchestration.md` | on demand | 2,755 | 689 | — | — |
| `references/pitfalls.md` | on demand | 4,252 | 1,063 | — | — |
| agent prompts (READ-only) | when agent runs | coordinator 2,174 / worker 1,406 / reviewer 1,248 | 544 / 352 / 312 | — | no action |

**Before/after (W5 skill split).** `git log --oneline -- skills/arggon-cli/SKILL.md`
→ `git show dc9fa40:skills/arggon-cli/SKILL.md | wc -c` = **21,955 B always
loaded** before; after = **9,518 B umbrella always loaded + 15,479 B references
on demand** (full content 24,997 B, +13.9% — the references archive more detail
than the single file held; the per-session cost is what dropped). On-load delta:
**−12,437 B (−57%)**.

**Tuning decisions (numbers-driven).**

- `compaction.keep.tokens: 15000` **kept**: equals the V2 documented default;
  the retained budget is ≈4.6× the fixed per-session surface (~3.2k tok), and
  the V2 docs say to raise it only when exact recent detail matters. No
  template change → no adopter churn.
- Skill descriptions/umbrella: **no change** — `arggon-cli`'s description was
  already trimmed to 176 B (from 245 B pre-W5); `arggon-upgrade`'s 324 B is
  routing text ("Use when `doctor` reports `outdated`…") loaded only when the
  skill is; the 9.5 KB umbrella is mostly generated command regions.
- Agent prompts: **read-only** (templates owned by the W4 orchestration item);
  4.8 KB total across the three agents, paid only when the agent runs → no
  action.
- MCP `tools/list` is the dominant fixed cost (10,096 B, 82% of the advisory
  cap) with an unchanged tool count — flagged for the W7 dogfood re-check; the
  schemas live in `cli/src/**`, outside this item's ownership.
- Docs: added the missing **Code Mode batching** pointer (batch read-only calls
  in one `execute` via `tools.arggon.*`) and a **Context budgets** section
  (bounds + how to re-run) to `docs/playbooks/opencode.md`.

**Deviation (honest).** W1–W5 all landed before W6 started (this is the last
wave), so per-wave before/after captures were not possible. The table cites the
pre-existing measurements (ADR 0006 re-measure 2026-09-15: AGENTS.md 2,043 B →
1,863/1,872 B now after the headroom trim; MCP 9,050 → 10,096 B; W3 block
181–204 B) and reconstructs the pre-W5 skill from git.

**Gates.** `npm test` 69 files / 1112 passed · `npm run lint` clean ·
`npm run build` clean · `arggon validate --json` ok (0 warnings) ·
`arggon spec validate --json` ok · `npm run context:report -- --strict` exit 0,
0 regressions.

Repro: `npm run context:report` (add `--json` for machine output;
`CONTEXT_REPORT_BEFORE_REV=<rev>` pins the before/after reconstruction).

### 2026-09-18 @Arggon
W6 draft PR: https://github.com/Arggon/ArggonManager/pull/329 (base opencode2). Stops here: no merge, no status flip.
