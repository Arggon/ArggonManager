---
type: task
status: done
id: task-adr0005-deploy-defaults
title: "ADR 0005 into product: init/playbooks carry per-shape deploy defaults"
assignee: Arggon
branch: feat/task-adr0005-deploy-defaults
parent: operating-principles
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-adr0005-deploy-defaults.md
  Leaves live only under a story. id is the filename stem: task-adr0005-deploy-defaults.
  CLI `arggon create task adr0005-deploy-defaults` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0005 into product: init/playbooks carry per-shape deploy defaults

## Context

Implements the accepted [ADR 0005](../../../docs/adr/0005-cheap-path-to-prod.md) (cheap-path-to-prod): init/playbooks must carry the per-shape deploy defaults so every generated project ships with a credible, low-cost answer to "how does this reach production?" — agent-executable from files in the repo, near-zero cost at small scale, with a documented exit path.

Also carries the recurring review consequence: infra pricing guidance ages (Oracle halving, Hetzner hikes, Netlify credits — see exploration cheap-path-to-prod-001), so the deploy defaults must name their verification date and get re-verified periodically.

## Acceptance

- [x] init (or the generated docs/playbooks) emits the per-shape deploy defaults table from ADR 0005, each default config-in-repo (agent-executable) with an exit note
- [x] The guidance names its pricing-verification date and the re-verify cadence (annual, or before each release wave)
- [x] init-docs test asserts the deploy guidance is present in the generated tree

## Notes
