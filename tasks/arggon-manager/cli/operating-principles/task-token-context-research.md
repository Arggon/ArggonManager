---
type: task
status: in_progress
id: task-token-context-research
title: "Token/context principle: investigate optimizing agent tokens and context windows in ArggonManager"
assignee: Arggon
branch: feat/task-token-context-research
parent: operating-principles
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T20:34:28.261Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-token-context-research.md
  Leaves live only under a story. id is the filename stem: task-token-context-research.
  CLI `arggon create task token-context-research` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Token/context principle: investigate optimizing agent tokens and context windows in ArggonManager

## Context

Operating principle 3 (2026-09-14): **agent tokens and context windows are a
priority.** ArggonManager must investigate how to optimize both in the way it
manages agent work: every byte an agent must read (AGENTS.md, generated docs,
SKILL.md, `--json` envelopes, list payloads, MCP tool descriptions) costs
context, and every avoidable round-trip costs tokens. Research-first: measure,
propose, decide via ADR; the product changes land through follow-up items.

## Acceptance

- [ ] Exploration recorded via `arggon stack explore` (docs/explorations/): MEASURED context costs of the agent-facing surfaces (sizes/estimated tokens of AGENTS.md, generated AGENTS.md+docs, SKILL.md, a typical `--json` envelope, a full `list --json` payload, MCP tool descriptions), followed by ranked proposals (quick wins vs structural) each with expected savings and risk
- [ ] ADR under docs/adr/ (next number, status Proposed in the PR) for the chosen direction(s) — e.g. compact-envelope policy, context budget for generated docs, progressive disclosure defaults
- [ ] No product code changes in this item — implementation follows via spec + follow-up items

## Notes
