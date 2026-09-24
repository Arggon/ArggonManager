---
type: task
status: todo
id: task-axe-core-browser-ci
title: Add @axe-core/playwright to the existing browser CI lane
parent: ui-foundation
labels: [playwright, accessibility, ci, ui]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-axe-core-browser-ci.md
  Leaves live only under a story. id is the filename stem: task-axe-core-browser-ci.
  CLI `arggon create task axe-core-browser-ci` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Add @axe-core/playwright to the existing browser CI lane

## Context

Add `@axe-core/playwright` to the existing Playwright Test browser lane so common accessibility defects block CI on the real `arggon board --serve` surface. Keep the check deterministic and dev-only; do not add a second browser runner or runtime UI dependency.

## Acceptance

- [ ] Add an exact/dev-only `@axe-core/playwright` dependency compatible with the pinned Playwright version; it must not enter production dependencies or the published package.
- [ ] Run AxeBuilder against the real served board in the existing `@smoke` Chromium lane after the page is ready and before the interaction/round-trip assertions complete.
- [ ] Assert WCAG-tagged automated checks with a stable, reviewed policy: no unexplained exclusions, disable-rules, or blanket exclusions; any accepted exception records the exact rule, reason, and owner.
- [ ] Fix only accessibility defects exposed on the current smoke surface or file linked follow-ups before merge; preserve the existing card match, status move, persistence, TUI, and live behavior.
- [ ] Keep the lane Chromium-only, one-worker, and deterministic on CI; no hosted accessibility service or personal browser profile.
- [ ] Update contributor/CI/testing documentation with the exact local and CI commands and failure remediation.
- [ ] Real-browser smoke evidence plus `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npx playwright test --grep @smoke`, and `arggon validate` are green.

## Notes
