---
type: task
status: todo
id: task-opencode2-doc-builtworkspaces-bound-unstated
title: `docs/opencode2.md` declares Bound `—` for `preparation.builtWorkspaces`/`linkedWorkspaces` while the payload caps both at 32 with no exact total beside them
parent: methodology-improvements
labels: [docs, json-contract]
created: "2026-10-03"
updated: "2026-10-03"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-opencode2-doc-builtworkspaces-bound-unstated.md
  Leaves live only under a story. id is the filename stem: task-opencode2-doc-builtworkspaces-bound-unstated.
  CLI `arggon create task opencode2-doc-builtworkspaces-bound-unstated` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/opencode2.md` declares Bound `—` for `preparation.builtWorkspaces`/`linkedWorkspaces` while the payload caps both at 32 with no exact total beside them

## Context

`ArggonManager/docs/opencode2.md` §start defines `Bound` as the kernel constant that caps a list (`lib/src/worktree.ts`), and its field table gives `preparation.builtWorkspaces` and `preparation.linkedWorkspaces` a Bound of `—` — unbounded. The payload caps both: `MAX_NATIVE_PREPARATION_NAMES = 32` (`opencode/plugins/arggon/index.ts:195`), applied as `.slice(0, 32)` on both lists and as length checks that feed `truncated`.

Unlike `missingDependencies`, which pairs its cap (`MAX_MISSING_DEPENDENCIES`, 10) with an exact `missingDependenciesTotal` beside it, neither workspace list carries an exact total — a capped list can read as the whole set. The `—` is either wrong (there is a bound and it should name the constant) or the table owes the exact-total companion the `missingDependencies` pattern already sets.

## Acceptance

- [ ] Verify both caps against the kernel (`MAX_NATIVE_PREPARATION_NAMES` in `opencode/plugins/arggon/index.ts` and the `lib/src/worktree.ts` bound the column points at) — not against this item's prose
- [ ] Decide the table remedy: name the kernel bound in both `Bound` cells, add an exact-total companion for each capped list, or record why these two lists need neither — and apply the `missingDependencies` / `missingDependenciesTotal` precedent explicitly
- [ ] The doc-contract suite (`opencode/plugins/arggon/opencode2-doc-contract.test.ts`) pins whatever is decided, so the `—` cannot return silently
- [ ] `npx prettier --check ArggonManager/docs/opencode2.md` clean and `arggon validate` green

## Notes
