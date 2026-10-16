---
type: task
status: in_progress
id: task-board-build-stamp-e2e-smoke-pin-for-board-build
title: "Board build-stamp: e2e @smoke pin for #board-build"
assignee: arggon-delivery-lead
branch: feat/task-board-build-stamp-e2e-smoke-pin-for-board-build
parent: ui-web-board-v2
labels: []
created: "2026-10-16"
updated: "2026-10-16"
claimed_at: "2026-10-16T10:52:11.885Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-build-stamp-e2e-smoke-pin-for-board-build
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-build-stamp-e2e-smoke-pin-for-board-build.md
  Leaves live only under a story. id is the filename stem: task-board-build-stamp-e2e-smoke-pin-for-board-build.
  CLI `arggon create task board-build-stamp-e2e-smoke-pin-for-board-build` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Board build-stamp: e2e @smoke pin for #board-build

## Context

Follow-up from the task-board-build-stamp review (PR #854, merged 2026-10-16): the build stamp is covered by unit tests, board-parity tests and a manual Chromium smoke, but the CI `@smoke` spec (`e2e/board.smoke.spec.ts`) asserts nothing about `#board-build` — a stamp regression would pass the durable lane. Same PR left a one-word README precision nit (see acceptance).

## Acceptance

- [ ] The CI `@smoke` spec asserts the served board exposes the build stamp viewer-visible (footer `#board-build` with the build string; drawer `#board-drawer-build` after opening a card)
- [ ] `ui-smoke` lane green on the PR; `arggon validate` green; prettier clean
- [ ] README `--details` sentence no longer over-claims byte-identical: scoped to drawer-free (no drawer markup, no embedded payload, no extra script) since header/footer now always carry the stamp

## Notes

### 2026-10-16 @Arggon
Evidence (maker, 2026-10-16, worktree commit 9e2ff093, branch feat/task-board-build-stamp-e2e-smoke-pin-for-board-build, pushed): e2e/board.smoke.spec.ts gains one case in the @smoke board --serve suite asserting footer #board-build visible with /^build \S+/ and #board-drawer-build visible with the identical string after opening the detail card drawer (no hard-coded sha; h1 readiness reused; flake-harness test import untouched, no throttling). README --details bullet now reads 'stays drawer-free and otherwise byte-identical'. Gates observed: npm run arggon -- validate ok (also via pre-commit); prettier --check clean on both files; npm run build green (incl. tsc -p tsconfig.e2e.json type-check of the spec); vitest build-stamp filter 10 passed; new spec case passes on real Chromium (1 passed, 4.4s); full @smoke board --serve describe 39 passed (27.7s); --grep @smoke --list shows 49 tests. No prod code touched; no product defect found (serve always renders both stamps: details:true + non-empty buildVersion). Scope: e2e spec + README only.

### handoff 2026-10-16 @Arggon — next: Open the PR from feat/task-board-build-stamp-e2e-smoke-pin-for-board-build; confirm ui-smoke lane green, then tick acceptance and merge
- branch: feat/task-board-build-stamp-e2e-smoke-pin-for-board-build
- open questions: None; boxes unticked pending PR CI (ui-smoke on the PR is the remaining gate)

### 2026-10-16 @Arggon
verdict: approve (e2e @smoke pin, commit 9e2ff093)
- standards review: scope on item (spec +27, README 1 line, no prod code), reuses readiness signal + flake-harness import, zero tracker writes / order-independent, assertions discriminate (visible + regex + cross-equality, no hard-coded sha), untouched siblings correctly left alone, docs-travel, negligible runtime cost
- verifier evidence: npx playwright test --grep @smoke → 49 passed incl new case 'the served board stamps the build in the footer and the detail drawer'; validate ok 0 warnings; prettier clean both files; diffstat confined to spec + README (+ tracker md)
- advisory (non-blocking): README:462 + board.ts drawer-chrome comment share the pre-stamp wording — left for a follow-up, not this PR
