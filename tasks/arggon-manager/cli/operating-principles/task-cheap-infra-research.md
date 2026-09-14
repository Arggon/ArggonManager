---
type: task
status: done
id: task-cheap-infra-research
title: "Cheap-infra principle: investigate the most economical path to prod for generated projects"
assignee: Arggon
branch: feat/task-cheap-infra-research
parent: operating-principles
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-cheap-infra-research.md
  Leaves live only under a story. id is the filename stem: task-cheap-infra-research.
  CLI `arggon create task cheap-infra-research` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Cheap-infra principle: investigate the most economical path to prod for generated projects

## Context

Operating principle 2 (2026-09-14): **infrastructure is expensive.** There is
always an investigation into the most accessible way to take an
ArggonManager-generated project to production with the lowest possible setup
and maintenance cost. This is a research-first task: explore with dated
sources, decide via ADR, let the product (init, playbooks, templates) carry
the decision afterwards.

## Acceptance

^- [x] Exploration recorded via `arggon stack explore` (docs/explorations/): candidates for cheapest credible path-to-prod per common project shape (static site, SPA + API, full-stack server, worker/cron), criteria (setup effort, monthly cost at small scale, maintenance burden, exit cost), findings with DATED sources (pricing pages with dates), recommendation
^- [x] ADR under docs/adr/ (next number, status Proposed in the PR) capturing the default guidance init/playbooks will recommend for generated projects, linked from the exploration's Decision section
- [ ] No product code changes in this item — the decision lands in the product through follow-up items

## Notes
