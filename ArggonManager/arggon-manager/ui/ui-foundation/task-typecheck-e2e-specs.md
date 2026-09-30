---
type: task
status: done
id: task-typecheck-e2e-specs
title: "e2e/ is in no tsconfig project, so the browser spec that now gates CI is never type-checked"
assignee: Arggon
branch: feat/task-typecheck-e2e-specs
parent: ui-foundation
labels: [ci, playwright, tooling]
priority: p3
created: "2026-09-29"
updated: "2026-09-30"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-typecheck-e2e-specs.md
  Leaves live only under a story. id is the filename stem: task-typecheck-e2e-specs.
  CLI `arggon create task typecheck-e2e-specs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# e2e/ is in no tsconfig project, so the browser spec that now gates CI is never type-checked

## Context

`e2e/` (the CI `@smoke` browser gate) sat in no tsconfig project — linted and
transpiled, never type-checked. Closed by a `noEmit` sibling `tsconfig.e2e.json`
wired into `npm run build`; see the work order and evidence below.

## Acceptance

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

- [x] `e2e/**/*.ts` is covered by a type-checking project, wired into a script CI runs — extend the root `tsconfig.typecheck.json` or add a sibling, and say which and why. *(Added a sibling `tsconfig.e2e.json` (`noEmit`, wired into `npm run build`, which CI runs in both `ci.yml` jobs). Why a sibling over extending `tsconfig.typecheck.json`: the spec needs `lib: ["ES2022", "DOM"]` for its `page.evaluate` callbacks (`window`, `document`, `HTMLElement`), and putting DOM in the shared project would widen the globals `cli/src` and `test/` are checked against — acceptance rule 4.)*
- [x] Prove the gate with the same A/B discipline used elsewhere: a deliberate type error in an `e2e` file must fail the typecheck command, with the command and exit code recorded. *(RED: `npx tsc -p tsconfig.e2e.json` with `e2e/__typecheck-probe.ts` holding `const label: number = "not a number"` → exit 2, `error TS2322: Type 'string' is not assignable to type 'number'`. GREEN: probe removed → exit 0.)*
- [x] Do **not** put `e2e/` in an **emitting** project unless you have checked the published surface; `e2e/` must not appear in the packed tarball, and the existing `files` entry should be verified rather than assumed. *(Sibling is `noEmit`; the emitting BUILD project is untouched. `npm pack --dry-run` verified: 128 files, zero `e2e` paths — the `dist/**, templates/, skills/, opencode/` allowlist holds.)*
- [x] Do not weaken the existing projects to reach it (e.g. broadening `rootDir` on an emitting project) — the fast-check PR's arrangement (emitter + `noEmit` sibling) is the pattern to follow. *(Root `tsconfig.json` and `tsconfig.typecheck.json` are byte-identical; the only package.json change appends `&& tsc -p tsconfig.e2e.json` to `build`.)*
- [x] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npx playwright test --grep @smoke`, `npm run arggon -- validate --json` are green. *(test: 107 files / 1780 tests passed; lint exit 0; build exit 0 — now including the e2e typecheck; check:plugin exit 0; playwright @smoke: 13 passed; validate ok:true.)*

## Notes

Filed 2026-09-28 from the PR #435 review. p3: no current defect, a missing gate on a surface that
just became load-bearing.

### 2026-09-30 @Arggon
Evidence (worker, PR to follow): New sibling `tsconfig.e2e.json` — `noEmit`, extends `tsconfig.typecheck.json` (so it inherits strict + `rootDir: "."`), `lib: ["ES2022","DOM"]` scoped to the browser surface, `include: ["e2e/**/*.ts"]`. Wired into `npm run build` (`&& tsc -p tsconfig.e2e.json`), which ci.yml runs in both jobs. Why not extend `tsconfig.typecheck.json`: DOM in the shared project would widen the globals cli/src and test/ are checked against.

REAL defect found by the new gate (task premise confirmed): `e2e/board.smoke.spec.ts` imported `AxeBuilder` as a default import — under NodeNext the package's `types` condition resolves the CJS-paired index.d.ts where `export { AxeBuilder as default }` is not honored, so the default binding is the module namespace and `new AxeBuilder(...)` is TS2351, with three implicit-any cascades. Playwright's transpiler never checked it. Fixed with the runtime-equivalent named import `{ AxeBuilder }`; @smoke lane re-run proves behavior unchanged.

Commands/exit codes: RED `npx tsc -p tsconfig.e2e.json` with deliberate `e2e/__typecheck-probe.ts` error → exit 2 (TS2322), probe removed → exit 0. Gates: npm test 107 files/1780 tests pass; npm run lint 0; npm run build 0; npm run check:plugin 0; npx playwright test --grep @smoke 13 passed (7.2s, includes the zero-exclusion axe scan); arggon validate --json ok:true. Published surface: npm pack --dry-run → 128 files, zero e2e paths.
