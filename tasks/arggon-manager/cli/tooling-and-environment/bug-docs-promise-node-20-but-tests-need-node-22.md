---
type: bug
status: todo
id: bug-docs-promise-node-20-but-tests-need-node-22
title: Docs promise Node 20+ but tests need Node 22
parent: tooling-and-environment
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/tooling-and-environment/bug-docs-promise-node-20-but-tests-need-node-22.md
  Leaves live only under a story. id is the filename stem: bug-docs-promise-node-20-but-tests-need-node-22.
  CLI `arggon create bug docs-promise-node-20-but-tests-need-node-22` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Docs promise Node 20+ but tests need Node 22

## Context

Follow-up from the architect code review of PR #46 (dependabot bump of
`vitest` 3 → 5, grouped with `@vitest/mocker`). Vitest 5 declares
`engines: node ^22.12.0 || ^24.0.0 || >=26.0.0`, but `README.md` and
`docs/agents.md` still promise Node.js 20+. CI runs on a newer Node so it
stays green; a contributor on Node 20 gets a broken dev setup with no
explanation. Decide the floor and make docs, CI, and `engines` agree:
either document Node 22.12+ for development, or pin vitest back to a
version supporting Node 20.

## Acceptance

- [ ] One stated Node version for development, consistent across `README.md`, `docs/agents.md`, CI `node-version`, and (if changed) package `engines`
- [ ] A contributor following the docs from a clean checkout can run `npm ci && npm test` successfully
- [ ] `arggon validate --json` still reports `ok: true`

## Notes
