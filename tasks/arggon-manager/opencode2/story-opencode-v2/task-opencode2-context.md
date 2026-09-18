---
type: task
status: todo
id: task-opencode2-context
title: "Context and token optimization for V2 runtime"
priority: p2
depends_on: [task-opencode-v2-plugin]
parent: story-opencode-v2
labels: []
created: "2026-09-18"
updated: "2026-09-18"
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
