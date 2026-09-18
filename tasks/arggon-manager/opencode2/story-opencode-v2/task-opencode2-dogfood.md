---
type: task
status: todo
id: task-opencode2-dogfood
title: "Dogfood: ArggonManager self-hosts the OpenCode2 surface"
priority: p2
depends_on: [task-opencode-v2-plugin, task-opencode2-orchestration, task-opencode2-methodology]
parent: story-opencode-v2
labels: []
created: "2026-09-18"
updated: "2026-09-18"
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
documents close, and the promotion PR to `main` lands. The dogfood is the
strongest acceptance signal: if the generated seam + plugin + agents/commands
cannot run ArggonManager's own work loop, the program is not done.

## Acceptance

- [ ] This repo carries the generated surface (checked in, provenanced):
      `opencode.jsonc` (root), `.opencode/plugins/arggon/`, `.opencode/agents/`,
      `.opencode/commands/`, slim `AGENTS.md`, skill with references.
- [ ] A real session on this repo demonstrates the loop end-to-end with
      evidence: `next` → claim → worktree → work → review verdict → done
      (transcript attached to the item).
- [ ] Upgrade path proven: a second `arggon init` run refreshes untouched
      artifacts, skips modified ones, and reports both lists.
- [ ] Docs and release: `docs/playbooks/opencode.md` current; README,
      `docs/agents.md`, `docs/json-output.md` reflect shipped behavior;
      `spec-opencode2-009` and `plan-opencode2-009` statuses flipped to
      `implemented` in the same PR.
- [ ] Gates green: `arggon validate`, `arggon spec validate`, `arggon doctor`,
      full test suite, `npm run smoke:opencode` harness.
- [ ] Program PR to `main` references epic `opencode2` and the spec; the epic
      and story containers close through the normal cascade after merge.

## Notes

- Depends on plugin, orchestration and methodology waves; run last.
- If any gate fails, file the finding as an item instead of weakening the
  acceptance.
