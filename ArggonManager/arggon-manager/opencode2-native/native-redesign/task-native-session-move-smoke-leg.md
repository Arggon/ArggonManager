---
type: task
status: done
id: task-native-session-move-smoke-leg
title: Add a real-runtime smoke leg proving a session that moved into a worktree commits to the worktree branch
assignee: Arggon
branch: feat/task-native-session-move-smoke-leg
parent: native-redesign
labels: [opencode-seam, worktree, smoke]
priority: p3
created: "2026-09-28"
updated: "2026-10-01"
worktree_path: /home/arggon/Projects/ArggonManager-task-native-session-move-smoke-leg
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

- [x] A smoke leg drives a real OpenCode session that is moved into an item worktree, calls a committing native tool, and asserts the resulting commit is on the item branch in that worktree and that the primary checkout is unchanged.
- [x] The leg is deterministic and model-free, and runs in the same smoke command as the cold-start smoke (or a documented sibling command) rather than as a one-off manual check.
- [x] The leg also covers the negative direction: with the session root unresolvable, the call refuses with `SESSION_ROOT_UNRESOLVED` and nothing is written anywhere.
- [x] Reuse the existing fixtures and helpers; do not build a second harness.
- [x] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run lint:structure`, `npm run test:structure`, the smoke command and `arggon validate` are green.
- [x] Record expected-vs-observed evidence on this item, including a source-reasoned pre-fix comparison: the leg pins current per-call resolution end-to-end, but does NOT discriminate pre-#426 on the pinned host (2.0.21 builds the post-move plugin instance from the destination location, so a frozen cwd converges to the correct commit in this ordering) — the P1-signature fault is likely unreachable here.

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

- [x] A smoke leg drives a real OpenCode session that is moved into an item worktree, calls a committing native tool, and asserts the resulting commit is on the item branch in that worktree and that the primary checkout is unchanged.
- [x] The leg is deterministic and model-free, and runs in the same smoke command as the cold-start smoke (or a documented sibling command) rather than as a one-off manual check.
- [x] The leg also covers the negative direction: with the session root unresolvable, the call refuses with `SESSION_ROOT_UNRESOLVED` and nothing is written anywhere.
- [x] Reuse the existing fixtures and helpers; do not build a second harness.
- [x] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run lint:structure`, `npm run test:structure`, the smoke command and `arggon validate` are green.
- [x] Record expected-vs-observed evidence on this item, including a source-reasoned pre-fix comparison: the leg pins current per-call resolution end-to-end, but does NOT discriminate pre-#426 on the pinned host (2.0.21 builds the post-move plugin instance from the destination location, so a frozen cwd converges to the correct commit in this ordering) — the P1-signature fault is likely unreachable here.

## Notes

Owner: whoever picks up the native smoke surface next. Priority p3 — it is a verification gap, not a
live defect.

### 2026-10-01 @ses_f0735ed77ffewWZr4DUpwOUc58
## 2026-10-01 @Arggon — smoke leg landed (expected vs observed)

**How the model-free real-session drive works** (smoke/native-start-cold-smoke.ts §6, extended `npm run smoke:native-start-cold`):

1. A fourth fixture (`repo-move`) is seeded with a tracker + `task-cold-move-leg`, the vendored plugin bundle (`.opencode/plugins/arggon/index.ts`, freshness guarded by `check:plugin`), a marker-writing pre-commit gate, an `opencode.json` declaring a scripted provider, and an item worktree `repo-move-task-cold-move-leg` on `feat/task-cold-move-leg`.
2. A REAL `opencode serve` (v2.0.21 observed) is spawned in the fixture; the harness reads the printed password/port from its stdout/stderr.
3. A session is created over the server API (`POST /api/session` with `location.directory` = fixture primary); `GET /api/session/{id}` confirms the root. The scripted provider is an IN-PROCESS OpenAI-compatible SSE server (port 0, localhost-only, no model, no child process): round 1 with tools offered returns exactly one `execute` tool call whose `code` is `return await tools.arggon.comment({"id":"task-cold-move-leg","text":"…"});`; any round carrying a tool result returns the closing text; tool-less title calls get plain text.
4. The REAL host move: `POST /api/session/{id}/move {"directory": worktree}` → 204; the host's own session record is then polled until `location.directory` === the worktree (eventually consistent, converges ~0.5 s observed).
5. The prompt runs the host's full agent loop: the scripted model's `execute` call runs the Code Mode runtime, the native `tools.arggon.comment` executes through the real plugin (`resolveToolCwd` reads the calling session's directory per call via `ctx.session.get`), the kernel writes the item and auto-commits behind the real pre-commit gate.

**Expected vs observed** — expected: commit `chore(tasks): commented task-cold-move-leg` on `feat/task-cold-move-leg` in the worktree, gate marker reading `move gate ran in <worktree>`, primary HEAD and porcelain identical before/after, one execute round + one closing text round. Observed: all of it, twice (two consecutive smoke runs, 42/42 checks each; the second run's log: /tmp/opencode/move-smoke-run2.log). Negative direction: `GET /api/session/<unknown>` on the real server returns 404 (the observed no-record shape); the REAL plugin exports (`sessionDirectoryResolver` + `resolveToolCwd`) driven with that absence refuse with `error.code: SESSION_ROOT_UNRESOLVED` naming the session and the refused fallback, for both the undefined-record and the throwing-lookup flavors, and git state is asserted unchanged afterward.

**What the leg proves about the pre-fix code — reasoned from source, not executed (corrected 2026-10-01 after reviewer verification)**: the leg pins CURRENT per-call resolution end-to-end (real server, real session.move, real plugin instance, real gate): the commit lands on the item branch in the worktree only, with the primary untouched. The pre-fix comparison is an argument from source, not an executed regression: on opencode 2.0.21 the plugin instance that answers the tool call is built AT MOVE TIME from the DESTINATION location (`packages/core/src/session/move.ts` — `resolveDestination` runs `locations.contextEffect(destination.location)`; consistent with this leg's own observation that the registration line appears only after the move), so on pre-#426 code the frozen `options.cwd` would resolve to the WORKTREE in this ordering too and the comment would still commit correctly — the P1-signature fault (`moveLegFaults`: "the comment commit landed on the primary's branch") is therefore likely UNREACHABLE on the pinned host, and this leg's positive assertions do not discriminate pre-#426 vs post-#426 there (reviewer's analysis, cited). What the fault still guards is the invariant on hosts whose plugin instance is NOT destination-loaded, and the negative direction's `SESSION_ROOT_UNRESOLVED` refusal is independent of this ordering.

**What remains simulated (coordinator-adjudicated)**: only the model's DECISION (a canned tool call instead of an LLM) and, for the negative direction, the resolver's INPUT — the host cannot carry a live tool call for a session it has no record of, so the refusal is driven at the plugin seam with the host's observed absence, not through a live call. The session, the move, the plugin registration, the tool execution, the gate and the commit are all the real host's.

**Gates**: npm test 115 files / 2045 tests green; lint, build, check:plugin, lint:structure, test:structure exit 0; `arggon validate` ok:true. Unit coverage for the leg's pure helpers in smoke/native-start-cold-smoke.test.ts (25 tests incl. a real HTTP round against the scripted provider). The leg SKIPS (passing, documented) when the `opencode` binary is absent (CI) — same tradeoff as `smoke:opencode`.

### handoff 2026-10-01 @ses_f0735ed77ffewWZr4DUpwOUc58 (session: ses_f0735ed77ffewWZr4DUpwOUc58) — next: Coordinator review of PR #559; merge squashes the smoke leg + unit tests + item ticks. Acceptance checklist complete; awaiting adjudication note on the simulated-decision scope.
- branch: feat/task-native-session-move-smoke-leg
- open questions: CI runs without the opencode binary, so the move leg reports a documented skip there (same tradeoff as smoke:opencode) — acceptable?; scripted-provider leg is pinned to observed v2.0.21 server API sh…
