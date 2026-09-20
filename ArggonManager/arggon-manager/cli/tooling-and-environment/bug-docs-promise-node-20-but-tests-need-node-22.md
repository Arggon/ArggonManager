---
type: bug
status: done
id: bug-docs-promise-node-20-but-tests-need-node-22
title: Docs promise Node 20+ but tests need Node 22
assignee: arggon
branch: fix/bug-docs-promise-node-20-but-tests-need-node-22
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

- [x] One stated Node version for development, consistent across `README.md`, `docs/agents.md`, CI `node-version`, and (if changed) package `engines`
- [x] A contributor following the docs from a clean checkout can run `npm ci && npm test` successfully
- [x] `arggon validate --json` still reports `ok: true`

## Notes

Decision: raise the development floor to **Node 22.12+** (keep vitest 5) rather than
pinning vitest back to v3. Vitest 5 declares `engines: ^22.12.0 || ^24.0.0 || >=26.0.0`.

- `README.md`: "Node.js 20+" → "Node.js 22.12+" with the vitest 5 rationale.
- `docs/agents.md`: prerequisites line and the CI snippet example use `node-version: 22`.
- `.github/workflows/ci.yml`: `node-version: 22`.
- `docs/adr/0001-cli-stack.md`: consequence line updated to Node 22.12+.
- `package.json`: `engines.node` → `>=22.12.0`.

Verified: `npm ci && npm test` on Node 26.7.0 → 265/265 passing; `npm run build` and
`npm run lint` clean; `arggon validate --json` → `ok: true`.
