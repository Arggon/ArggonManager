---
type: task
status: in_progress
id: task-plugin-smoke-home-isolation
title: "Plugin smokes need hermetic HOME: a machine-global plugin can shadow fixture bundles"
assignee: arggon-delivery-lead
branch: feat/task-plugin-smoke-home-isolation
parent: story-opencode-adapter
labels: [opencode-seam, tests, review-followup]
created: "2026-10-13"
updated: "2026-10-13"
claimed_at: "2026-10-13T16:39:49.749Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-plugin-smoke-home-isolation
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/task-plugin-smoke-home-isolation.md
  Leaves live only under a story. id is the filename stem: task-plugin-smoke-home-isolation.
  CLI `arggon create task plugin-smoke-home-isolation` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin smokes need hermetic HOME: a machine-global plugin can shadow fixture bundles

## Context

From the `task-opencode-prompt-stamp` review (PR #760). The new `smoke/opencode-prompt-stamp-smoke.ts` serves with a hermetic HOME/XDG_* set and asserts the fixture's bundle bytes are the ones under test — because the machine-global `~/.config/opencode/plugins/arggon/index.ts` (9511 lines, pre-T4) shadows fixture bundles by id under the supervisor's first-registration-wins rule (`Duplicate plugin ID: arggon`). `smoke/opencode-smoke.ts` and `smoke/native-start-cold-smoke.ts` do NOT isolate: they inherit `process.env`, so on this box they may be exercising the global copy rather than the fixture bundle — their evidence is suspect until fixed. Also from the same review: the new smoke has no npm script (package.json was out of that item's lane), and `onCompaction`'s `asString(item.id) ?? "?"` is inconsistent with `onContext`'s tighter read.

## Acceptance

- [ ] `smoke/opencode-smoke.ts` and `smoke/native-start-cold-smoke.ts` serve hermetically (HOME/XDG_* into a temp dir) and assert the fixture bundle is the one under test
- [ ] evidence: a run with a machine-global plugin present proves the fixture copy was exercised (or the shadowing fails loudly)
- [ ] `smoke:opencode-prompt-stamp` npm script added (or the npx form stays documented and pinned by a check)
- [ ] `onCompaction` id read consistent with `onContext`; `check:plugin` + affected suites green

## Notes
