---
type: task
status: done
id: task-native-tui
title: TUI board and status panels
assignee: Arggon
branch: feat/task-native-tui
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-21"
depends_on: [task-native-permissions-worktrees]
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-tui.md
  Leaves live only under a story. id is the filename stem: task-native-tui.
  CLI `arggon create task native-tui` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI board and status panels (W5)

## Context

W5 of `plan-native-first-011`. Register board/status panels and routes through the CLI/TUI plugin API (`session.panel`, sidebar slots) with commands to open them; item status appears in the sidebar. The static HTML board stays as an optional artifact.

## Acceptance

- [ ] The board/status panel opens from a command and renders the current tree.
- [ ] Plugin loads clean; no session-startup regressions.
- [ ] TUI smoke checklist completed (open/close/fullscreen, narrow terminal).
- [ ] No context-budget regression from panel registration.

## Notes

- Depends on W2; web console is out of scope for this wave.

### 2026-09-21 @Arggon
W5 evidence (task-native-tui) — branch `feat/task-native-tui`, PR #378 (draft).

## What landed

- `opencode/plugins/arggon/board.ts` (new): pure, kernel-backed display surface —
  `boardSnapshot()` (`findTasksDir` → `loadItems` → kernel `openDependencies` /
  `runNext`), cycle-safe tree flattening, plain-text panel/sidebar renderers with
  width clipping and `sanitizeHumanTextUncapped` escaping. Never throws: no
  tracker → an error snapshot the panel renders; never writes.
- `opencode/plugins/arggon/tui.tsx` (new): the TUI entry OpenCode discovers
  beside `index.ts`. `session.panel` contribution `arggon.board` (tree, status
  glyphs, `⌫deps`, active item, kernel `next`), `sidebar.content` status line,
  command `arggon.board.open` (slash `/arggon-board`, palette, `ctrl+g`), panel
  keys `esc`/`f`/`r`. All feature-detected + failure-isolated; `panel.open`
  returning `false` outside a session becomes a toast.
- Bundle/init: the emitted bundle forwards the entry's named value exports so
  the TUI entry can `import … from "./index.ts"`; `init` vendors `tui.tsx` with
  the generated marker + `x-generated` provenance; `.gitignore` covers the
  derived copy; typecheck gate moved to `cli/tsconfig.plugin.json` (strict +
  `paths` → `lib/src/index.ts`, build-independent).
- Tests: `board.test.ts`, `tui.test.ts` (+ `test/tui-runtime-stub.ts`),
  extended `bundle.test.ts`, init/seam/pack assertions.

## Acceptance checklist — status

- [x] Panel opens from a command and renders the current tree — `npm run smoke:tui`
      (init → 4-item tree → plugin list → API session → PTY `script` → types
      `/arggon-board`) asserts the captured terminal contains
      `arggon board · 4 item(s) · next: …` + `· T task-board-task — Board task`.
- [x] Plugin loads clean; no session-startup regressions — smoke:tui (no
      `failed to load plugin … argon`), suite green, session/startup scenarios in
      `smoke:opencode` unaffected.
- [x] TUI smoke checklist completed — manual PTY runs on 2.0.12: open
      (slash/palette/`ctrl+g` in-session); `esc` closes and restores the session
      view; `f` toggles full-screen (header moves 2;61 → 1;1); 60×20 stays
      full-screen, clips lines, no crash; sidebar `arggon ▶ task-board-task todo` at
      200 cols; branch (`feat/<id>`) and `ARGON_ITEM` both resolve the active item;
      home screen toasts "open a session first". Documented in
      `ArggonManager/docs/opencode2.md` § TUI board and status.
- [x] No context-budget regression — `context:report --strict` "all bounds
      pass"; before/after byte-identical (AGENTS.md 2,005 B, native defs 12,182 B,
      MCP 10,507 B, item block ≤1,024 B). Only `doctor.initTreeBytes` moves
      (411,370 → 434,227 B): on-disk vendored seam, not a model-context surface.

## Gates (worktree)

- `npm test` → 1438 passed (88 files)
- `npm run lint` → clean
- `npm run build` → clean
- `npm run check:plugin` → clean (bundle staged; rebuild byte-identical)
- `npm run arggon -- validate` → ok (0 warnings, v5)
- `npm run arggon -- spec validate` → ok (18 docs)
- `npm run smoke:tui` → passed (11/11 checks)
- `npm run context:report -- --strict` → all bounds pass

## Findings reported to the coordinator (not fixed here)

1. `smoke:opencode` W4 permissions scenario fails `the reviewer's shell gate
denies git push` in two independent runs: the reviewer model _declines_ to
   run `git push origin main` (the fixture has no `origin`), so no permission
   denial is emitted. Transcripts:
   `/tmp/arggon-smoke-permissions-X9AAsP/.smoke-evidence/` and
   `/tmp/arggon-smoke-permissions-bwDBUr/.smoke-evidence/` ("NOT RUN
   (declined)"). Not W5-related (no config/agent/permission change in this PR);
   candidate follow-up: plant an `origin` remote so the attempt reaches the
   shell gate.
2. Runtime drift: probes ran on the local OpenCode **2.0.12** while the playbook
   pins 2.0.10. The W5 surfaces are documented 2.0.x and feature-detected; the
   pin/A-B re-probe refresh is a coordinator call (noted in the playbook).

### handoff 2026-09-21 @Arggon — next: Review PR #378 (draft) against the W5 acceptance and gates; if green, merge with a MERGE commit (the branch carries tracker auto-commits) and flip task-native-tui to done. Evidence to re-check: npm r…
- branch: feat/task-native-tui
- open questions: smoke:opencode W4 'reviewer shell gate denies git push' flaked twice because the model declines the push (fixture has no origin remote) — file a W6/W7 follow-up to plant an origin or relax the check?…

### 2026-09-21 @Arggon
**Reviewer verdict — PR #378 (independent audit).** Reviewed at PR head `3e3c75d` (worktree `ArggonManager-opencode2-task-native-tui`), base `opencode2`, CI `cli` run `35609904681` = success on that SHA.

**Verdict: NO-MERGE as-is (changes requested) — 1 blocking finding (P1). Everything else in the W5 acceptance is verified green. Do not mark done; merge with a merge commit, never squash.**

## P1 (blocking) — `boardSnapshot()` throws on a corrupt tracker, contradicting the item's "never throws" scope

- `opencode/plugins/arggon/board.ts:147`: `itemsById(kernelItems)` is **outside** the `try` that wraps `findTasksDir`/`loadItems` (lines 132–145). `itemsById` throws `Duplicate id '…' under the tracker` (`lib/src/items.ts:306`).
- Real-runtime repro (PTY, opencode 2.0.12): fresh `init` fixture + two items with `id: dup`, API session, `opencode -s <ses>` in a pty, type `/arggon-board` → the host shows `Plugin arggon.tui crashed in slot session.panel: Duplicate id 'dup' under the tracker (…/two.md and …/one.md)`; the `arggon board` panel never renders. The session survives (host-contained), but the board/status surface is dead until the tree is fixed.
- Direct repro through the vendored bundle (no runtime needed): `boardSnapshot(root)` throws (`/tmp/opencode/tui-probe/dup-probe.ts`, fixture `/tmp/board-dupe-bL85qb`).
- Expected by the module contract ("never throws … a missing/corrupt tracker degrades to an empty snapshot with a human reason, and the panel keeps rendering"): `board.test.ts` only covers the no-tracker case, so the claim is untested for the corrupt case.
- Fix (small): move `itemsById` (or the whole snapshot assembly) inside the guarded block and return an `error` snapshot on any read failure; add a regression test with duplicate ids.

## P2 (decision the coordinator must close) — runtime drift 2.0.12 vs the pinned 2.0.10

The playbook frontmatter still pins `version: 2.0.10`; all W5 probes, `smoke:tui` and the manual checklist ran on the local **2.0.12** (documented in the playbook). The upgrade policy asks for a pin refresh + A/B re-probe on a new 2.x. CI does not run `smoke:tui`, so the pinned runtime has **no** W5 end-to-end evidence. Decide explicitly before/with merge: refresh the pin to 2.0.12 (record the import A/B probe) or accept the documented drift.

## What I verified (reproduced, not taken from the checklist text)

- `npm run smoke:tui`: 11/11 ok — fresh init (both entrypoints vendored, no `node_modules`), 4-item tree, plugin discovery, API session, PTY `/arggon-board`, captured panel + palette entry, no plugin load failure.
- Independent PTY probes (own harness: `/tmp/opencode/tui-probe/`, raw captures + a minimal VT emulator): open 120×40 renders header + 4-row tree; **60×20** renders clipped, no crash; **`esc`** closes and the final screen is the session view; **`f`** moves the header from row 2 col 61 → row 1 col 1 (full-screen); **sidebar at 200 cols** shows `arggon ▶ task-probe-task todo` on a `feat/<id>` branch and `arggon · 1 ready · next …` without an active item.
- Hostile bytes: `sanitizeHumanTextUncapped` (C0/DEL/C1 + U+2028/29) applied to every repo-controlled field; unit tests cover ANSI/OSC/newline injection.
- Display-only: board.ts imports only read APIs (`findTasksDir`, `loadItems`, `itemsById`, `openDependencies`, `runNext`, `sanitize…`); the no-write unit test passes.
- Feature detection + failure isolation: every optional surface (`ui.slot`, `ui.panel.open`, `ui.toast.show`, `keymap.layer`, `data.location.vcs.info`) is optional-chained and try/caught, `setup` returns a noop disposer on failure, `panel.open → false` becomes a toast (unit-tested).
- Bundle: rebuild byte-identical (`check:plugin`, 39 modules, 326,046 B); the wrapper forwards every named value export `tui.tsx` imports (`ARGON_BOARD_PANEL`, `boardSnapshot`, `boardTreeLines`, `sidebarStatusLine`, …); bundle loads dependency-less in a temp dir.
- Type gate `cli/tsconfig.plugin.json` strict (`index.ts` + `board.ts`; `@arggondev/lib` → `lib/src/index.ts`, build-independent) passes.
- Provenance/parity: `init` stamps `tui.tsx` (`// arggon:generated template="…"`), byte-parity + idempotent refresh asserted in `init-opencode.test.ts`; `.gitignore` covers the derived copy.
- Gates: `npm test` 1437 passed / 1 failed, `lint`, `build`, `check:plugin`, `arggon validate` (v5, 0 warnings), `context:report -- --strict` all bounds pass with the claimed bytes (AGENTS 2,005 B; native 12,182 B; MCP 10,507 B; item block 252 B).
  - The 1 failure is `cli/src/measure.test.ts` "[…] /tmp hygiene" (`/tmp/arggon-budget-*` leftover): flake from a concurrent run — isolated rerun green (11/11), file untouched by the PR, CI green on the same SHA. Pre-existing, not W5.
- Scope: only W5 files; no W6/W7 changes, no server-plugin behavior change beyond the additive export block.

## P3 (non-blocking notes / possible follow-ups)

- `board.ts:306-312`: `sidebarStatusLine` reimplements the kernel's ready predicate (todo + unassigned + task/bug + no open deps) instead of reusing `isClaimable`/`isReady`; it matches `runNext` today but can silently drift from the kernel.
- `tui.tsx` is deliberately outside the strict type gate (no `solid-js` dep); eslint runs on it and smoke covers the load, but the 282-line wiring has no static type check. Feasible: map `solid-js`/`@opentui/solid/*` to the stub in `cli/tsconfig.plugin.json` and include the file.
- No in-repo regeneration/drift test for the derived `.opencode/plugins/arggon/tui.tsx` (only `index.ts` is self-healed in `plugin-copy.test.ts`); the copy in this worktree is unstamped (harmless, gitignored) but it is a stale-dogfood trap for W7.
- `moduleValueExports` now forwards all 46 named value exports of the bundle entry (internals such as `sessionToken`, `setBounded` included). Inert, but it widens the vendored module's surface; an allowlist would keep it a board API.
- `BoardItem.blockedReason` is populated but never rendered (dead field).
- Prettier reformatting churn in `README.md`/`opencode2.md`/`playbook` — harmless noise.

## Not verified by me

- `ctrl+g` and the home-screen toast end-to-end (palette entry is smoke-asserted; binding + `panel.open → false` toast are unit-tested).
- Anything on the pinned 2.0.10 (see P2).

## Recommendation

Request changes for P1 (one-line guard + regression test). After that, W5 is mergeable: merge commit (never squash), then the coordinator flips `task-native-tui` to done — I did not.

*Note: the MCP `arggon_*` tools are unusable in this environment (global `arggon` 0.3.0 does not resolve the v5 tracker: `No tasks/ convention found`); this verdict was posted with the repo's local CLI, auto-committed on `feat/task-native-tui`.*

### 2026-09-21 @Arggon
W5 review-fix pass (task-native-tui) — commit `c6f2701`, PR #378 updated.

## P1 (blocking) — FIXED: `boardSnapshot()` no longer throws on a corrupt tracker

`itemsById` (and the whole snapshot assembly) now runs inside the guard; tracker
detection keeps its own reason, and any read failure degrades to an escaped,
bounded `tracker unreadable: …` snapshot. `tui.tsx` adds a per-surface guard as
belt-and-braces (a future regression must not reach the host overlay).

Repro before/after (same duplicate-id fixture, `/tmp/opencode/w5-fix/dupe-fixture`):

- before, direct (vendored `board.ts`):
  `THREW: Duplicate id 'dup' under the tracker (…/one.md and …/two.md)`
- before, PTY 2.0.12 (`/arggon-board`): host overlay
  `arggon.tui crashed in slot session.panel: Duplicate id 'dup' under the tracker …`,
  no panel.
- after, direct:
  `SNAPSHOT OK {"error":"tracker unreadable: Duplicate id 'dup' under the tracker (…/one.md and …/two.md)","items":0}`
- after, PTY (same fixture/session): panel shows
  `arggon board · tracker unreadable: Duplicate id 'dup' under…`; the capture
  contains **no** `crashed in slot`.

Regression coverage: `board.test.ts` (duplicate-id fixture: no throw, empty
snapshot/counts, sanitized reason, active-id resolution skipped),
`tui.test.ts` (panel + sidebar render on the corrupt fixture),
`smoke:tui` (new PTY scenario: duplicate the created task id → panel must show
the unreadable header and no slot crash).

## P3 notes — all addressed

| Note                                                                | Fix                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidebarStatusLine` reimplemented the ready predicate               | Kernel `isClaimable(type)` + `isReady(item, byId)` (+ `todo`, unclaimed). Ready follows the kernel definition, so an unclaimed story counts too — the count can exceed `/arggon-next` (leaf pool); documented in the code and in `opencode2.md`. Tests updated (fixture now `2 ready`). |
| `tui.tsx` outside the strict type gate                              | Added to `cli/tsconfig.plugin.json` with the repo-only `cli/types/tui-runtime.d.ts` shim (`solid-js` + JSX namespace). Verified the gate catches an injected type error in `tui.tsx`.                                                                                                   |
| Derived `.opencode/plugins/arggon/tui.tsx` not regenerated/verified | `plugin-copy.test.ts`: stamps/self-heals the derived copy (marker-pinned) and pins the vendored import allowlist (`solid-js`, `./index.ts` only). The worktree copy is now stamped.                                                                                                     |
| Wrapper re-exported all 46 entry exports                            | `BUNDLE_EXPORTS` allowlist (`ARGON_BOARD_PANEL`, `boardSnapshot`, `boardTreeLines`, `emptyBoardSnapshot`, `sidebarStatusLine`); pinned in both directions (entry exports each name; wrapper forwards nothing else; list ≡ `tui.tsx` import block). Bundle shrank 326,046 → 324,325 B.   |
| `blockedReason` never rendered                                      | Renders ` · blocked: <reason>` (escaped; empty reason omitted) with unit coverage incl. hostile bytes.                                                                                                                                                                                  |
| Prettier churn                                                      | Surgical: `index.ts` is a **+1 line** diff; docs carry only W5 content + one checklist row (tables kept prettier-clean).                                                                                                                                                                |

## Gates (after the fix)

- `npm test` → **1444 passed** / 88 files
- `npm run lint` → clean
- `npm run build` → clean
- `npm run check:plugin` → clean (staged bundle; rebuild byte-identical)
- `npm run arggon -- validate` → ok (v5, 0 warnings)
- `npm run arggon -- spec validate` → ok (18 docs)
- `npm run smoke:tui` → **13/13** (includes the new corrupt-tracker check)
- `npm run context:report -- --strict` → all bounds pass (prompt-side bytes
  unchanged: AGENTS 2,005 B; native 12,182 B; MCP 10,507 B; item block ≤1,024 B)

## `smoke:opencode` (full) — 3 FAILs in the W4 permissions scenario, model variance

Full run: 141 ok / 3 FAIL, all three in `permissions (W4)`
(`arggon.update denied`, `arggon.start/cleanup denied`, `reviewer shell gate
denies git push`). The saved transcript
(`/tmp/arggon-smoke-permissions-A30okl/.smoke-evidence/permissions.stdout.jsonl`)
shows the reviewer ran a **reduced script** (only `tools.arggon.show`) and
declined the push — no `Unknown tool`/`Permission denied` was ever emitted, so
the checks' regexes could not match. Immediate rerun with
`OPENCODE_SMOKE_ONLY=w4` on the same tree: **40 ok / 0 FAIL**, including all
three checks. No permission/agent/config change in this PR; the scenario is
model-behaviour-dependent (same class as the earlier git-push-only flake).
Follow-up candidate: plant an `origin` remote and/or assert the attempted tool
calls instead of the model's prose.

Runtime drift (2.0.12 vs pin 2.0.10) is already filed as
`task-playbook-opencode-2-0-12`; untouched here.

### handoff 2026-09-21 @Arggon — next: Re-review PR #378 at commit c6f2701 (fix pass): verify the P1 repro is fixed (direct: boardSnapshot on a duplicate-id fixture returns an error snapshot; PTY: /arggon-board shows 'tracker unreadable' …
- branch: feat/task-native-tui
- open questions: smoke:opencode permissions (W4) scenario is model-behaviour-dependent: the reviewer sometimes runs a reduced script / declines the push, so its three checks fail on the model's prose — file a follow-…

### 2026-09-21 @Arggon
**Reviewer final verdict — re-review after `c6f2701`.** Reviewed head `06d7fff` (worktree `ArggonManager-opencode2-task-native-tui`), base `opencode2`. CI run `35616807586` on that head = **success**; PR is `MERGEABLE`/CLEAN.

**Verdict: MERGE.** P1 is fixed and independently reproduced; all P3s are addressed; every gate is green. Merge with a **merge commit (never squash)**, then flip `task-native-tui` to done. No blocking findings remain.

## P1 — FIXED (reproduced with my own probes, not just the worker's)

- `board.ts`: tracker detection keeps its own reason; `loadItems` + `itemsById` now run inside the assemble guard; any failure returns `emptyBoardSnapshot(sanitizeHumanError("tracker unreadable: …"))`; `tui.tsx` adds a per-surface try/catch as belt-and-braces.
- Direct repro through the vendored bundle (my script `/tmp/opencode/tui-probe/dup-probe.ts`, duplicate-id fixture): `RESULT: no throw; error = tracker unreadable: Duplicate id 'dup-id' … items = 0` (before: threw).
- PTY repro (my harness, opencode 2.0.12, own duplicate-id fixture + session): rendered screen shows `arggon board · tracker unreadable: Duplicate id 'dup' under…`; raw capture contains **no** `crashed in slot`; session survives (before: host overlay, no panel).
- Regression coverage confirmed: `board.test.ts` (duplicate fixture → no throw, empty counts, sanitized reason), `tui.test.ts` (panel + sidebar on the corrupt fixture), `smoke:tui` new check — I re-ran the smoke: **13/13**.

## P3 — all verified

- **Ready predicate**: `sidebarStatusLine` now uses kernel `isClaimable` + `isReady` (plus `todo`/unclaimed). Unit expectation updated to `2 ready`; my real-TUI probe on a non-active fixture shows `arggon · 2 ready · next task-probe-task` (kernel-ready includes the unclaimed story; `next` stays leaf — documented in code and opencode2.md).
- **Typed TUI gate**: `tui.tsx` is in `cli/tsconfig.plugin.json` via the repo-only `cli/types/tui-runtime.d.ts` shim; the gate test passes and I verified it catches an injected error (`const x: number = "str"` in a tui.tsx copy under the same compiler options → TS2322 reported by tsc).
- **Derived `tui.tsx`**: `plugin-copy.test.ts` stamps/self-heals the gitignored copy (worktree copy now starts with `// arggon:generated template="opencode/plugins/arggon/tui.tsx"`) and pins the vendored import allowlist (`solid-js`, `./index.ts` only).
- **Bundle surface**: `BUNDLE_EXPORTS` (5 names) pinned in both directions; wrapper forwards exactly those (verified by grep: 5 `export const … = __arggonEntry.…`); `bundle.test.ts` asserts the module keys ≡ allowlist; bundle shrank 326,046 → 324,325 B; `check:plugin` rebuild is byte-identical.
- **`blockedReason`**: rendered as ` · blocked: <reason>` (escaped, empty omitted) with hostile-byte coverage.
- **Churn**: the fix commit is surgical; docs carry W5 content only.

## Gates at head `06d7fff` (all re-run by me)

- `npm test` → **1444 passed / 88 files** (solo run). Note: a first run under concurrent local load showed the known `/tmp/arggon-budget-*` hygiene race in `cli/src/measure.test.ts` — the file is untouched by this PR, the isolated rerun is green, and the solo full suite is green.
- `npm run lint`, `npm run build`, `npm run check:plugin` → clean.
- `npm run arggon -- validate` → ok (v5, 0 warnings); `spec validate` → ok (18 docs).
- `npm run context:report -- --strict` → all bounds pass (AGENTS 2,005 B; native 12,182 B; MCP 10,507 B; item block 252 B).
- `npm run smoke:tui` → 13/13.
- CI `35616807586` (head `06d7fff`) → success.

## Non-blocking observations

- On a corrupt tracker the sidebar prints the generic `arggon · no tracker` while the panel prints `tracker unreadable: …`; cosmetic only.
- Runtime drift: all evidence is on 2.0.12 while the playbook pin stays 2.0.10 — now tracked in `task-playbook-opencode-2-0-12` (todo); this merge does not change the pin.
- W4 full-smoke variance (3 FAIL: model ran a reduced script / declined the push; W4-only rerun 40/0) — tracked in `task-w4-smoke-origin-remote` (todo); not W5.

## Recommendation

**MERGE** with a merge commit (never squash); the coordinator then flips `task-native-tui` to done. I did not mark it done.

*Posted with the repo's local CLI because the MCP `arggon_*` tools cannot resolve the v5 tracker in this environment (global `arggon` 0.3.0); auto-committed on `feat/task-native-tui`.*

### 2026-09-21 @Arggon
Coordinator note: P1 verified fixed with independent direct+PTY probes (duplicate-id fixture → error snapshot, panel renders 'tracker unreadable', no host crash) and P3s all closed (kernel ready predicate, strict type gate, derived-copy parity, 5-name bundle allowlist, blockedReason). Gates 1444 tests, lint/build/check:plugin/validate/spec, smoke:tui 13/13, budget within ADR 0006; CI pass. Merged with merge commit; item flipped to done.
