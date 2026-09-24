---
type: task
status: in_progress
id: task-ast-grep-structural-rules
title: Adopt ast-grep structural architecture rules
assignee: Arggon
branch: feat/task-ast-grep-structural-rules
parent: ui-foundation
labels: [tooling, architecture, ci]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
claimed_at: "2026-09-24T15:36:11.442Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-ast-grep-structural-rules
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ast-grep-structural-rules.md
  Leaves live only under a story. id is the filename stem: task-ast-grep-structural-rules.
  CLI `arggon create task ast-grep-structural-rules` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopt ast-grep structural architecture rules

## Context

Adopt the dev-only `ast-grep` CLI as a low-context structural guard. Keep ESLint/TypeScript responsible for type-aware policy; ast-grep should enforce a small set of repository architecture boundaries that ordinary text lint cannot express. Do not add an MCP server or a codemod that rewrites source automatically.

## Acceptance

- [x] Add an exact/dev-only `@ast-grep/cli` dependency and committed config/rules; do not add it to `dependencies` or the published runtime surface.
- [x] Enforce at least two high-value boundaries: tracker mutations outside the shared kernel are rejected, and native tool definitions cannot silently fork outside the shared catalog/seam.
- [x] Give every rule positive and negative `ast-grep test` coverage and document the rule's architectural rationale, scope, and justified exceptions.
- [x] Add a deterministic `lint:structure` command and run it in the existing `cli` CI job; never enable unattended `--update-all` rewrites.
- [x] Keep generated/vendored bundles and fixtures out of false-positive scope while preserving the real architecture boundary.
- [x] Document local/CI usage in the existing contributor/tooling docs without creating a product dependency or a new architecture fork.
- [x] `npm test`, `npm run lint`, `npm run lint:structure`, `npm run build`, `npm run check:plugin`, and `arggon validate` are green, with rule-test evidence in the PR.

## Notes
