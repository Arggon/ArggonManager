---
type: task
status: in_progress
id: task-plugin-bundle-near-byte-ceiling
title: "The OpenCode plugin bundle is at 523689/524288 MAX_BUNDLE_BYTES — the friction chain's remaining items (T4/T5/MCP surface) will cross it; raise the cap or split the module before it bites"
assignee: arggon-delivery-lead
branch: feat/task-plugin-bundle-near-byte-ceiling
parent: opencode2-hardening
labels: [tooling, plugin]
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T15:43:39.582Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-plugin-bundle-near-byte-ceiling
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2/opencode2-hardening/task-plugin-bundle-near-byte-ceiling.md
  Leaves live only under a story. id is the filename stem: task-plugin-bundle-near-byte-ceiling.
  CLI `arggon create task plugin-bundle-near-byte-ceiling` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The OpenCode plugin bundle is at 523689/524288 MAX_BUNDLE_BYTES — the friction chain's remaining items (T4/T5/MCP surface) will cross it; raise the cap or split the module before it bites

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** Recorded by the T2 (friction report) maker, PR #712: the generated plugin bundle sits at 523,689 of 524,288 `MAX_BUNDLE_BYTES` — 599 bytes of headroom. The remaining adopter-friction chain is additive to the same bundle: T4 (tier-B URL + opt-out keys), T5 (MCP surface `arggon_friction` + `json-output.md` + `doctor.friction`), then the trigger carrier. The next feature-sized commit likely fails `check:plugin` with a ceiling error rather than a code error — a confusing failure at the worst moment.

Acceptance:
- [ ] Reproduce the measurement (`check:plugin` reports the current size; state it)
- [ ] Decide and record: raise `MAX_BUNDLE_BYTES` to a bound with headroom (state the new number and why that is safe — what the bound protects), OR split the bundle (module boundary + what moves), OR another recorded option
- [ ] If the cap is raised: the new value carries the same protection intent (an accidental runaway bundle still fails); evidence that a deliberately oversized bundle still trips the gate
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok
- [ ] This item does not gate the friction chain's other items — record that coupling where T4/T5 will see it (a note on the respective items or here suffices; do not add depends_on edges retroactively to filed items without their owners)
