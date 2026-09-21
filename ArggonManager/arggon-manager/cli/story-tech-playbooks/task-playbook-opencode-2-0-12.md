---
type: task
status: todo
id: task-playbook-opencode-2-0-12
title: Refresh OpenCode playbook pin to 2.0.12 + A/B re-probe
parent: story-tech-playbooks
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-21"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tech-playbooks/task-playbook-opencode-2-0-12.md
  Leaves live only under a story. id is the filename stem: task-playbook-opencode-2-0-12.
  CLI `arggon create task playbook-opencode-2-0-12` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Refresh OpenCode playbook pin to 2.0.12 + A/B re-probe

## Context

Runtime drift detected in W5: the local OpenCode is **2.0.12** while
`ArggonManager/docs/playbooks/opencode.md` pins 2.0.10 (W5 probes ran on
2.0.12). Per the playbook upgrade policy, refresh the pin/research record and
re-run the plugin-import A/B probe on 2.0.12.

## Acceptance

- [ ] Playbook version/pin + research record updated to 2.0.12 with the probe date.
- [ ] A/B result recorded (static import vs guarded) and any new gotcha folded into Conventions/Troubleshooting.
- [ ] Pin references refreshed (README, docs/agents.md, docs/opencode2.md, ADR 0010 trigger) and exploration-010 F1.16 note updated.
- [ ] `arggon validate` green; docs-only diff; CI green.

## Notes

- Mirrors the 2.0.10 refresh (`task-playbook-opencode-2-0-10`, PR #373).
