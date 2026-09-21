---
type: task
status: todo
id: task-playbook-2-0-10-nits
title: "Playbook 2.0.10 nits: exploration-010 tension + plugin header probe note"
parent: story-tech-playbooks
labels: []
priority: p3
created: "2026-09-20"
updated: "2026-09-20"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tech-playbooks/task-playbook-2-0-10-nits.md
  Leaves live only under a story. id is the filename stem: task-playbook-2-0-10-nits.
  CLI `arggon create task playbook-2-0-10-nits` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Playbook 2.0.10 nits: exploration-010 tension + plugin header probe note

## Context

Non-blocking nits from the PR #373 review (`task-playbook-opencode-2-0-10`):

1. `ArggonManager/docs/explorations/exploration-opencode2-native-010.md` still
   lists the playbook pin refresh in its "Open tensions" section as open; it
   landed in #373 (2026-09-20).
2. `opencode/plugins/arggon/index.ts` header cites only the 2.0.8 A/B re-probe;
   the 2.0.10 re-probe (2026-09-20) is now the current evidence. The plugin was
   out of scope for the docs-only PR; update the comment here (or when W3
   touches the plugin).

## Acceptance

- [ ] Pin statements refreshed outside the accepted set: `docs/adr/0011` §7,
      `ArggonManager/docs/specs/spec-native-first-011.md` ("Pinned runtime
      2.0.10") and `ArggonManager/docs/plans/plan-native-first-011.md`.
- [ ] `exploration-opencode2-native-010` F4.1 (:244) still says "pin 2.0.10" —
      refresh it with the tensions line.
- [ ] `opencode.md:451,458` prettier de-indents 2 continuation lines (base was
      clean) — same family as `bug-formatter-glues-markdown-spaces`.
- [ ] The playbook's Context budgets snapshot matches `context:report --json`
      after the W7 trim + PR #384 skill sync (11.821 / 25.275 / 12.885+19.604).

- [ ] Exploration 010 "Open tensions" marks the pin refresh as landed.
- [ ] The plugin header references the 2.0.10 re-probe date (or points to the
      playbook's research record).
- [ ] `arggon validate` green; CI green.

## Notes

- Filed per the review-findings rule; cosmetic.
