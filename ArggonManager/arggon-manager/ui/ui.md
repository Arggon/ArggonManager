---
type: epic
status: todo
id: ui
title: "UI surfaces: web board, terminal TUI and OpenCode panel"
parent: arggon-manager
labels: [ui, viewer, tui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui.md (epic index; required).
  parent MUST be the initiative id. Container ids must not start with task-/bug-.
-->

# UI surfaces: web board, terminal TUI and OpenCode panel

## Context

<!-- Why this epic exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Product-owner directive (2026-09-22): improve the user interfaces — the static/served web board, the CLI terminal kanban (`arggon board --tui`) and the OpenCode V2 native board panel (`/arggon-board`).

Spike record: `ArggonManager/docs/explorations/exploration-ui-improvements-012.md` (findings measured on main c4a61b7c, 2026-09-22). Follow-up work is split into four stories:

- `story-ui-web-board-v2` — web board: lenses, item detail, accessibility, live-view state.
- `story-ui-tui-v2` — terminal board: scroll window (bug), detail pane, filter language, live view.
- `story-ui-native-panel-v2` — OpenCode panel: interactive selection + refresh.
- `story-ui-foundation` — shared board view-model and the browser smoke gate (ADR 0008 tier 2).

Constraints (from ADR 0001 / ADR 0002 and docs/engineering.md): the web artifact stays a single self-contained file with zero runtime dependencies (a framework or a new top-level package needs an ADR first); the TUI stays raw-ANSI and dependency-free; no tracker write may bypass the kernel update path.

## Acceptance

- [ ] All four child stories done and their checklists honest
- [ ] No new runtime dependency added by any UI change (dev-only tools allowed)
- [ ] Docs updated with the behavior: README board/TUI sections, docs/json-output.md, docs/playbooks/opencode.md
- [ ] Wave evidence recorded per ADR 0008 (Playwright CLI for web, pty frame checks for TUI) and `arggon validate` green
