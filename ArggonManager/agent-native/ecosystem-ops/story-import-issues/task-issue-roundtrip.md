---
type: task
status: done
id: task-issue-roundtrip
title: "issue round-trip: done flips close/annotate the linked GitHub issue"
assignee: Arggon
branch: feat/task-issue-roundtrip
parent: story-import-issues
labels: [p3]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-import-issues/task-issue-roundtrip.md
  Leaves live only under a story. id is the filename stem: task-issue-roundtrip.
  CLI `arggon create task issue-roundtrip` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# issue round-trip: done flips close/annotate the linked GitHub issue

## Context

Candidate #7 of [product discovery](../../../docs/explorations/exploration-product-discovery-002.md): `import-issues` is one-shot — items carry the linked GitHub issue in the additive `issue` frontmatter field but never push status back, so dual-tracker teams drift. Linear×Copilot issue→PR→status flows are now the norm (github.blog, 2026-07-23). Effort S; principle: same-rules, repo-is-truth (the issue id is already in frontmatter).

## Acceptance

- [x] Opt-in round-trip lands: on `update --status done`, items with `issue:` frontmatter close/annotate the linked issue via gh (config-gated, e.g. x-github round-trip flag, or explicit `--close-issue` — decide and document) — DECIDED: config gate `tasks/.convention.yml` `x-github.issue-roundtrip: true` (default OFF; new namespaced `x-github` section); lives in the update kernel, so CLI + MCP (`arggon_update`) flips are both covered
- [x] gh absent/unauthenticated → clean skip, never blocks the done flip (skip reported in the additive `issueRoundtrip` payload field + stderr warning)
- [x] Tests with a mocked gh path (cli/src/issue-roundtrip.test.ts, 6 cases, no live gh); docs updated (README import-issues bullet, docs/json-output.md `issueRoundtrip`, docs/agents.md §0)

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. Config-gate over per-call flag is correct (flips come through bots and MCP), the kernel-level hook means arggon_update flips are covered with zero special-casing, and every failure degrades to a reported skip that never blocks the done flip — the import-issues story stays one-shot while the round-trip is strictly opt-in. Mocked-gh tests follow the established pattern. Merge follows.
