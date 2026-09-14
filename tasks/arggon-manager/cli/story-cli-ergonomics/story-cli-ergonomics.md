---
type: story
status: in_progress
id: story-cli-ergonomics
title: Query and reparent ergonomics
assignee: Arggon
parent: cli
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T18:34:52.408Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/story-cli-ergonomics.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Query and reparent ergonomics

## Context

Third ergonomics batch, from the estanteria MCP-first experiment (2026-09-14): (1) the `parent:` filter predicate is direct-parent only, so saved views cannot express "everything under this initiative" — the agent's per-initiative views stopped at epic level; (2) `update` has no --parent, so imported items (import-issues pins them under an adoption story) cannot be reparented to their real home without hand-moving files; (3) package.json version is never bumped — `arggon --version` prints 0.0.0, making it impossible to audit which build ran.

## Acceptance

- [x] Filters/views can target whole initiatives or subtrees (ancestor predicate or initiative field); documented + tested
- [x] `arggon update <id> --parent <new-parent>` reparents with the same rules as create's parent validation; documented + tested
- [x] A version policy exists (bump on release or changelog-driven) and --version reflects it; documented
