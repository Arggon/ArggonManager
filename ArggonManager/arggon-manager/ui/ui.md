---
type: epic
status: done
id: ui
title: "UI surfaces: web board, terminal TUI and OpenCode panel"
assignee: arggon-delivery-lead
parent: arggon-manager
labels: [ui, viewer, tui]
priority: p2
created: "2026-09-22"
updated: "2026-10-18"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui.md (epic index; required).
  parent MUST be the initiative id. Container ids must not start with task-/bug-.
-->

# UI surfaces: web board, terminal TUI and OpenCode panel

## Context

Product-owner directive (2026-09-22): improve the three UI surfaces — the static/served web
board, the terminal kanban (`arggon board --tui`) and the OpenCode board panel. The
2026-09/10 wave delivered `ui-foundation`, `ui-web-board-v2`, `ui-tui-v2` and
`ui-native-panel-v2`; the web board then gained the grouped-ancestry tree
(`story-board-hierarchy-grouping`, closed 2026-10-14). The epic is open again because
`story-hierarchy-navigation` — reaching an item's parent and children from every GUI surface
(product-owner requirement 2026-10-11) — is not finished (one of its three surfaces still
open). The dated record below carries the original spike and constraints.

## Acceptance

- [x] `story-hierarchy-navigation` closes with all three surfaces verified (web drawer, TUI, OpenCode panel) against its own acceptance
- [ ] The 2026-09-22 constraints still hold: no new runtime dependency (web artifact self-contained, TUI raw-ANSI), and no tracker write bypasses the kernel update path

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

- [x] All four child stories done and their checklists honest (36/38 leaves done; the 2 open — bug-row-table-flake mitigated, ci-stability track — are CI-infra, reparented to `ecosystem-ops/ci-stability`)
- [x] No new runtime dependency added by any UI change (dev-only tools allowed; runtime deps unchanged: verify in package.json — playwright/axe are devDependencies)
- [x] Docs updated with the behavior: README board/TUI sections, docs/json-output.md, docs/playbooks/opencode.md
- [x] Wave evidence recorded per ADR 0008 (Playwright CLI for web, pty frame checks for TUI) and `arggon validate` green (every lane PR carried smoke evidence; validate ok at close)
