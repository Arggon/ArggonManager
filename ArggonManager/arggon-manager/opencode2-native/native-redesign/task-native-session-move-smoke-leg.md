---
type: task
status: todo
id: task-native-session-move-smoke-leg
title: Add a real-runtime smoke leg proving a session that moved into a worktree commits to the worktree branch
parent: native-redesign
labels: [opencode-seam, worktree, smoke]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-native-session-move-smoke-leg.md
  Leaves live only under a story. id is the filename stem: task-native-session-move-smoke-leg.
  CLI `arggon create task native-session-move-smoke-leg` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Add a real-runtime smoke leg proving a session that moved into a worktree commits to the worktree branch

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-28 @Arggon-coordinator
## Filed from the PR #426 review (coordinator, 2026-09-28)

`bug-native-tools-commit-to-primary-checkout` fixed the native tracker-root resolution
(`resolveToolCwd`, per-call from `ctx.session.get` → `Session.Info.location.directory`). Its evidence
is an in-process suite that **models** the V2 tool context and a real linked git worktree. The one
link it cannot exercise is the real host answering `ctx.session.get` with a *moved* session's
`location.directory`.

The failure mode is contained — an unresolvable directory raises
`error.code: SESSION_ROOT_UNRESOLVED` and writes nothing, which is the loud path the fix
deliberately chose over a silent fallback — but "contained" is not "proven", and the whole bug
existed because that single link was assumed.

## Context

- Prior art to extend: `task-native-start-cold-smoke` adds a deterministic, model-free cold-start smoke with a real worktree and a real pre-commit gate. That is the right home for a start leg; this item covers the **commit** leg after a session move, which is a different assertion.
- The P1 evidence to preserve: commits landing on the primary's `main` (`d24215b9`, `b65ef7c6`, `adacc20a`) instead of the item branch.

## Acceptance

- [ ] A smoke leg drives a real OpenCode session that is moved into an item worktree, calls a committing native tool, and asserts the resulting commit is on the item branch in that worktree and that the primary checkout is unchanged.
- [ ] The leg is deterministic and model-free, and runs in the same smoke command as the cold-start smoke (or a documented sibling command) rather than as a one-off manual check.
- [ ] The leg also covers the negative direction: with the session root unresolvable, the call refuses with `SESSION_ROOT_UNRESOLVED` and nothing is written anywhere.
- [ ] Reuse the existing fixtures and helpers; do not build a second harness.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run lint:structure`, `npm run test:structure`, the smoke command and `arggon validate` are green.
- [ ] Record expected-vs-observed evidence on this item, including what the leg would have caught on the pre-fix code.

## Notes

Owner: whoever picks up the native smoke surface next. Priority p3 — it is a verification gap, not a
live defect.
