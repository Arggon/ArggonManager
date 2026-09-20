---
type: story
status: done
id: tooling-and-environment
title: Tooling and environment
assignee: Arggon
branch: chore/tooling-and-environment
parent: cli
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/tooling-and-environment/tooling-and-environment.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Tooling and environment

## Context

The CLI epic's toolchain story: everything a contributor or agent needs to build, test, lint, and ship ArggonManager from a clean checkout, with one stated Node floor enforced everywhere (docs, CI, `engines`).

## Acceptance

- [x] One-command development loop without a build step: `npm run arggon -- <command>` / `npm run dev` run the CLI from TypeScript via `tsx`.
- [x] One-command build producing the `arggon` bin: `npm run build` (`tsc` → `dist/cli.js`, gitignored; rebuild after pulling).
- [x] Test suite via vitest: `npm test` / `npm run test:watch`; 341 tests across 28 files green on 2026-09-11.
- [x] Lint and format enforced: `npm run lint` (eslint flat config) and `npm run format` (prettier); both clean on the current tree.
- [x] CI gate on every PR to `main`: `.github/workflows/ci.yml` runs `npm ci && npm run build && npm run test && npm run lint` on Node 22, plus the `tasks/` validate gate.
- [x] One stated Node floor, consistent everywhere: `engines.node >=22.12.0`, README, `docs/agents.md`, `CONTRIBUTING.md`, CI `node-version: 22` (raised from Node 20 for vitest 5 in bug-docs-promise-node-20-but-tests-need-node-22; stale CONTRIBUTING line fixed here).
- [x] Adopter scaffolding: `arggon init` creates a convention tree with templates; the pre-commit/CI gates are printed on demand by `arggon instructions` and documented in `docs/agents.md`.

## Notes

- `dist/` is gitignored: the `arggon` bin is the compiled bundle, so run `npm run build` after pulling new commits before using `npx arggon` (the `npm run arggon --` script path always runs current source via tsx).
- Dev stack rationale lives in [docs/adr/0001-cli-stack.md](../../../docs/adr/0001-cli-stack.md).
