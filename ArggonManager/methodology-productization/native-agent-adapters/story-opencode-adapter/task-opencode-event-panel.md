---
type: task
status: done
id: task-opencode-event-panel
title: OpenCode board panel event-driven refresh (plan T4)
assignee: arggon-delivery-lead
branch: feat/task-opencode-event-panel
parent: story-opencode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-13"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
worktree_path: /home/arggon/Projects/ArggonManager-task-opencode-event-panel
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/task-opencode-event-panel.md
  Leaves live only under a story. id is the filename stem: task-opencode-event-panel.
  CLI `arggon create task opencode-event-panel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode board panel event-driven refresh (plan T4)

## Context

Board panel refreshes from the OpenCode event stream instead of polling

## Acceptance

- [x] unit test for event→refresh path
- [x] headless smoke evidence
- [x] no polling fallback regression

## Notes

### 2026-10-13 @ses_eca8380c0ffersLXopMkATS3NS
## Impact class: **Behavioral** (vendored OpenCode seam: `opencode/plugins/arggon/`)

Per `ArggonManager/docs/agents.md` §Changing the methodology itself. Adopter-facing
behavior changes: the open board panel now refreshes from the host event stream
instead of waiting for a keypress — agents/users must re-learn that an `arggon …`
run inside a session repaints the panel, and that a tracker change made OUTSIDE
OpenCode (another terminal) is deliberately not observed (no polling, no watcher;
`r` remains the manual fallback). No carrier doc (`agents.md`/`engineering.md`/
`convention.md`) and no `skills/arggon-cli/**` file changed, so the skill-sync
obligation is a no-op (byte-equal, nothing to sync); the adopter-upgrade channel is
`arggon init`/re-init, which re-vendors the derived `.opencode/plugins/arggon/tui.tsx`
copy (drift-gated by `cli/src/plugin-copy.test.ts`).

## What shipped (task-opencode-event-panel, T4 second half)

- `opencode/plugins/arggon/tui.tsx`: `BOARD_REFRESH_EVENTS = ["session.shell.ended", "session.step.ended"]`,
  `boardRefreshSurface(context)` (feature-detects `context.data.on`, the 2.0.26 TUI
  surface — there is no `context.event`), `subscribeBoardRefresh(surface, reload)`
  (failure-isolated, returns one disposer for both subscriptions) and
  `connectBoardRefresh(board, context)`; the mounted panel wires it through
  `onCleanup`, so the subscription lives and dies with the panel.
- Unit tests (`tui.test.ts`, 6 new): allow-list/negative-event/dispose, failure
  isolation (throwing `on`, throwing `reload`, throwing unsubscribe, missing
  surface), surface detection, the event→refresh path on a REAL tracker fixture
  (unrelated event leaves the panel stale, `session.step.ended`/`session.shell.ended`
  draw the new item), the mounted-panel lifecycle wiring, and a source assertion
  that the refresh path declares no timer.
- `smoke/opencode-panel-refresh-smoke.ts` + `.test.ts` (pure predicates) and the
  additive `npm run smoke:opencode:panel-refresh`.
- Docs: `docs/opencode2.md` (T4 bullet, W5 freshness paragraph, manual-checklist row,
  Verify block) and `docs/playbooks/opencode.md` (TUI probes: `context.data.on` vs
  no `context.event`, the `session.shell.*` endpoint contract, the hermetic-HOME
  service-port gotcha, the init provenance marker).

## Gates (expected vs observed)

- `npm run build` → ok (48 modules inlined, 562619 bytes).
- `npm run check:plugin` → green with **no diff**: this change lives in `tui.tsx`,
  which is vendored VERBATIM (not bundled), so the regenerated `index.bundle.ts`
  is byte-identical — nothing to commit for it, and the gate is what proves it.
- Unit `tui.test.ts` → 20 passed (14 existing + 6 new).
- `npx vitest run opencode/plugins/arggon smoke/opencode-panel-refresh-smoke.test.ts` → 274 passed.
- `npm test` → 153 files / 3327 tests passed.
- `npm run lint` → clean; `npm run test:structure` → 5/5; `npm run arggon -- validate` → ok (0 warnings, convention v5); `prettier --check` on every touched file → clean.

## Headless smoke evidence (model-free, hermetic, deterministic)

Command: `npm run smoke:opencode:panel-refresh` (real `opencode` TUI in a PTY via util-linux
`script`, hermetic `HOME`/`XDG_*`, its own managed-service port so the machine's
`opencode service` on 49374 is untouched).

Expected → observed (3 consecutive runs, same result, ~60 s each):

1. panel opens STALE → `arggon board · 4 item(s)` drawn before any event ✅
2. `POST /api/session/<id>/shell` (`arggon create …`) → 204, item file created, git auto-commit `chore(tasks): created task-live-refresh` ✅
3. the open panel repaints `arggon board · 5 item(s)` + `task-live-refresh` with **zero keys sent after the panel opened** (`keys sent after open: 0`) ✅
4. a second item written DIRECTLY on disk (no OpenCode involvement) never appears in a 6 s idle window (`no polling fallback`) ✅
5. capture carries no `failed to load plugin … arggon` ✅
6. vendored entry declares no `setInterval`/`setTimeout`/`requestAnimationFrame` and does carry `BOARD_REFRESH_EVENTS` ✅

## Open questions / follow-ups (not in this diff)

- `smoke:tui` and `smoke:opencode*` still inherit `process.env` (no hermetic HOME), so a machine-global `~/.config/opencode/plugins/arggon` can shadow their fixture — already tracked as `task-plugin-smoke-home-isolation`.
- `smoke/opencode-prompt-stamp-smoke.ts` asserts the vendored bundle is byte-equal to the committed artifact; `arggon init` prepends `// arggon:generated template="…"` to BOTH vendored files, so that equality only holds because the smoke overwrites the copy with `copyFileSync`. My smoke strips the marker instead (see `vendoredSourceMatches`) — worth a look if that sibling smoke is ever re-pointed at a plain init fixture.
- The new smoke is maintainer-run (like the T4 sibling): CI has no `opencode` binary, so it would report `skipped`. Wiring it into CI needs an install step — a lead call, not made here.

### handoff 2026-10-13 @ses_eca8380c0ffersLXopMkATS3NS (session: ses_eca8380c0ffersLXopMkATS3NS) — next: Review PR #773 (feat/task-opencode-event-panel): verify the two allow-listed events + onCleanup disposal in tui.tsx, run `npm run smoke:opencode:panel-refresh` (maintainer, model-free) and the standa…
- branch: feat/task-opencode-event-panel
- open questions: smoke:tui/opencode* still not hermetic-HOME (task-plugin-smoke-home-isolation); prompt-stamp smoke's byte-equality relies on its own copyFileSync because init prepends a provenance marker to both ven…

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as cc2ccc4e (PR #773); auto-done flip landed. T4 second half: the open board panel follows the host's event stream (`context.data.on`, probed on 2.0.26) on `session.shell.ended` / `session.step.ended`, failure-isolated, one disposer wired through `onCleanup`; no timer, no polling. Model-free hermetic smoke — 3 consecutive identical runs: stale panel → event → repaint with zero keys sent, and a disk-only change never drawn (no polling fallback). `check:plugin` green (tui.tsx is vendored verbatim — bundle byte-identical), full suite 3327, lint/structure/validate/prettier green; CI green.
Recorded follow-ups: smoke HOME isolation (already tracked as task-plugin-smoke-home-isolation); CI wiring for the new smoke needs an opencode install step (deliberately not taken); the prompt-stamp smoke's vendored-marker nuance stays a note.
