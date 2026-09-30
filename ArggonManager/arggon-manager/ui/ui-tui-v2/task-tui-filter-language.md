---
type: task
status: in_progress
id: task-tui-filter-language
title: "TUI filter prompt: kernel filter predicates + saved views"
assignee: Arggon
branch: feat/task-tui-filter-language
parent: ui-tui-v2
labels: [tui, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T17:16:16.221Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-tui-filter-language
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-filter-language.md
  Leaves live only under a story. id is the filename stem: task-tui-filter-language.
  CLI `arggon create task tui-filter-language` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI filter prompt: kernel filter predicates + saved views

## Context

`/` filters by case-insensitive substring on id/title only. The kernel filter language (`lib/src/filter.ts`: `status:`, `type:`, `label:`, `assignee:`, `priority:`, `ancestor:`, free text) and the tracker's `x-views` saved views exist but no TUI surface uses them.

## Acceptance

- [x] `/` accepts the documented predicate subset parsed with the kernel parser where possible; unknown predicates show an inline hint instead of crashing or silently matching nothing
- [x] `v` cycles saved views (name + expression shown in the header); Esc clears the filter/view
- [x] Filtered empty columns stay informative (count 0 + empty mark), footer shows the active filter and matched totals
- [x] Parser parity tests against `lib/src/filter.ts`; README keybindings + filter docs updated

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`/` filters by case-insensitive substring on id/title only. The kernel filter language (`lib/src/filter.ts`: `status:`, `type:`, `label:`, `assignee:`, `priority:`, `ancestor:`, free text) and the tracker's `x-views` saved views exist but no TUI surface uses them.

## Acceptance

- [ ] `/` accepts the documented predicate subset parsed with the kernel parser where possible; unknown predicates show an inline hint instead of crashing or silently matching nothing
- [ ] `v` cycles saved views (name + expression shown in the header); Esc clears the filter/view
- [ ] Filtered empty columns stay informative (count 0 + empty mark), footer shows the active filter and matched totals
- [ ] Parser parity tests against `lib/src/filter.ts`; README keybindings + filter docs updated

### 2026-09-30 @Arggon
verdict: implemented (awaiting review)

Branch feat/task-tui-filter-language, PR #484 (ready).

Gates (all green): npm test (108 files / 1865 tests), npm run lint, npm run build, npm run check:plugin (bundle regenerated — kernel changed), arggon validate --json ok, npm run smoke:tui-board (pty).

Evidence, expected vs observed:
- applyViewFilter parity suite: 12 kernel expressions through parseFilter+matchesPredicate vs applyViewFilter select identical items; kernel error texts pinned verbatim (unknown field/status/type/priority, unterminated quote, empty value).
- TUI pty smoke: pressed v on a fixture with x-views open-tasks='type:task status:todo' — expected header 'view: open-tasks (type:task status:todo)', 4/7 match, story/initiative cards hidden, (empty) marks in the emptied columns; observed exactly that. Pressed / + 'status:bogus' + Enter — expected the draft refused inline; observed footer '/status:bogus█ — unknown status "bogus". Allowed: todo, …' with the previous lens intact and the board unfiltered.
- Unit loop test drives the same refusal through runTuiBoard with fake streams.

Deviations: none. Notes: (1) the prompt also accepts free-text tokens on id/title (kept from the old substring behavior, same as the web board lens); (2) an invalid view can wedge the v-cycle until Esc clears (documented in README) — stateless refusal, no extra state field.
