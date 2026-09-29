---
type: task
status: todo
id: task-typecheck-e2e-specs
title: "e2e/ is in no tsconfig project, so the browser spec that now gates CI is never type-checked"
parent: ui-foundation
labels: [ci, playwright, tooling]
priority: p3
created: "2026-09-29"
updated: "2026-09-29"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-typecheck-e2e-specs.md
  Leaves live only under a story. id is the filename stem: task-typecheck-e2e-specs.
  CLI `arggon create task typecheck-e2e-specs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# e2e/ is in no tsconfig project, so the browser spec that now gates CI is never type-checked

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon-coordinator
## Context

Found by the worker of `task-axe-core-browser-ci` (PR #435). Pre-existing, and its weight just
changed.

`e2e/` is in **no** tsconfig project: the root build project includes `cli/src/**/*.ts`, the lib
projects cover `lib/src`, and `labs/tsconfig.json` covers `labs/*.ts` + `cli/src`. So
`e2e/board.smoke.spec.ts` is linted by eslint and transpiled by Playwright, but **never type-checked**.

That was tolerable while the spec was a smoke. It is not any more, because PR #435 makes that spec a
**gate**: the `@smoke` lane now fails CI on a WCAG-tagged automated violation, and the worker's
accessibility policy, tag list and remediation message all live in TypeScript that nothing type-checks.
Playwright transpiles without checking, so a type error in the spec would not fail the lane — it would
just run, silently. A gate whose own code is unchecked is weaker than it looks.

Note the interaction with `task-fast-check-invariant-properties`: that PR added a root
`tsconfig.typecheck.json` for `cli/src` + `test/`, and deliberately did not reach `e2e/`. The
missing coverage is now the only gap in an otherwise closed loop.

## Acceptance

- [ ] `e2e/**/*.ts` is covered by a type-checking project, wired into a script CI runs — extend the root `tsconfig.typecheck.json` or add a sibling, and say which and why.
- [ ] Prove the gate with the same A/B discipline used elsewhere: a deliberate type error in an `e2e` file must fail the typecheck command, with the command and exit code recorded.
- [ ] Do **not** put `e2e/` in an **emitting** project unless you have checked the published surface; `e2e/` must not appear in the packed tarball, and the existing `files` entry should be verified rather than assumed.
- [ ] Do not weaken the existing projects to reach it (e.g. broadening `rootDir` on an emitting project) — the fast-check PR's arrangement (emitter + `noEmit` sibling) is the pattern to follow.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npx playwright test --grep @smoke`, `npm run arggon -- validate --json` are green.

## Notes

Filed 2026-09-28 from the PR #435 review. p3: no current defect, a missing gate on a surface that
just became load-bearing.
