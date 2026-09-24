---
type: task
status: todo
id: task-fast-check-invariant-properties
title: "Add fast-check properties for parser, status, dependency, UTF-8, and worktree invariants"
parent: ui-foundation
labels: [testing, property-based, kernel]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
depends_on: [bug-native-start-worktree-no-install]
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-fast-check-invariant-properties.md
  Leaves live only under a story. id is the filename stem: task-fast-check-invariant-properties.
  CLI `arggon create task fast-check-invariant-properties` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Add fast-check properties for parser, status, dependency, UTF-8, and worktree invariants

## Context

Add a small, high-confidence `fast-check` property suite for the adversarial kernel surfaces called out by `exploration-open-source-agent-tooling-013`. Properties complement the broad example-based suite; they must use bounded, deterministic seeds/run counts in ordinary CI and must not encode a weaker model than production invariants.

## Acceptance

- [ ] Add an exact/dev-only `fast-check` dependency with a small reusable bounded runner or deterministic seed/replay policy for normal CI.
- [ ] Property: valid generated item frontmatter survives parse → serialize → parse without losing required fields or changing unrelated body text.
- [ ] Property: status transitions preserve the legal transition table and terminal `done`/`cancelled` items cannot be reopened by any generated transition sequence.
- [ ] Property: generated dependency graphs terminate and report the same canonical cycle set regardless of input traversal order.
- [ ] Property: bounded UTF-8 detail clipping never splits a code point, respects the byte cap, and preserves valid text for representative multibyte input.
- [ ] Property: worktree cleanup/ownership classification remains safe and idempotent for generated link/farm shapes, including foreign installs that must never be removed.
- [ ] Each property has an explicit invariant comment, bounded complexity, a deterministic replay seed on failure, and ordinary example-based tests remain authoritative for concrete contracts.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, and `arggon validate` are green without runtime dependency or production behavior changes; PR evidence includes run counts/seeds and any minimized counterexample.

## Notes
