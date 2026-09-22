---
type: task
status: in_progress
id: task-ui-browser-smoke-ci
title: "Browser smoke in CI: @smoke Playwright spec + TUI frame check"
assignee: Arggon
branch: feat/task-ui-browser-smoke-ci
parent: ui-foundation
labels: [ui, smoke, ci]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
claimed_at: "2026-09-22T22:56:04.543Z"
depends_on: [bug-ci-version-guard-dev-only]
worktree_path: /home/arggon/Projects/ArggonManager-task-ui-browser-smoke-ci
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ui-browser-smoke-ci.md
  Leaves live only under a story. id is the filename stem: task-ui-browser-smoke-ci.
  CLI `arggon create task ui-browser-smoke-ci` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Browser smoke in CI: @smoke Playwright spec + TUI frame check

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

ADR 0008 chose two tiers: review-time Playwright CLI (used ad hoc today) and an optional CI `@smoke` `@playwright/test` spec that was never implemented. Every UI change in the `ui` epic will need a durable regression net; the TUI exception (scripted pty render check) is already prototyped in `smoke/tui-smoke.ts`.

## Acceptance

- [ ] A `@smoke`-tagged Playwright spec: `board --serve` on a fixture renders cards matching `arggon list`, one status move round-trips and persists (verified with `arggon show`), and a filter reduces the view
- [ ] A CI job runs the spec on Chromium only; Playwright stays dev-only (never a runtime dependency) and the job skips cleanly when browsers are unavailable
- [ ] The TUI gets a scripted frame assertion (reuse the smoke fixture pattern) or a documented manual step in the same docs section
- [ ] docs/engineering.md testing table + CONTRIBUTING.md commands updated; CI green on the PR

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Coordinator amendment (2026-09-22, pre-claim)

Two scope clarifications before this item is claimed:

1. **Drop the filter assertion from the spec's initial scope.** The board has no filter UI yet — that is `task-board-filter-lenses` (wave 1) and its own acceptance already requires a filter smoke. The `@smoke` spec here must cover what exists today: board renders, cards match `arggon list --json`, one legal status move round-trips and persists (`arggon show`), and the spec is structured so later UI features add cases. The wave-1 item extends the spec.
2. **`bug-ci-version-guard-dev-only` is a hard prerequisite and is in scope here** (dependency recorded): adding `@playwright/test` to devDependencies trips the inline version guard in `.github/workflows/ci.yml`, which fails on any `package.json` change while v0.4.0 is tagged. Fix the guard scoping (publish-relevant fields only) in this PR, reference the bug id and this item in the PR body, and keep the release-forgotten behavior for shipping fields with a local probe as evidence. This is an authorized, documented scope addition, not diff creep.

Everything else in the original acceptance stands.
