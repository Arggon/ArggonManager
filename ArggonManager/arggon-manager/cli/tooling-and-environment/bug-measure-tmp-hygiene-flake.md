---
type: bug
status: done
id: bug-measure-tmp-hygiene-flake
title: measure.test.ts /tmp hygiene races sibling suites
assignee: Arggon
branch: fix/bug-measure-tmp-hygiene-flake
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-22"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/tooling-and-environment/bug-measure-tmp-hygiene-flake.md
  Leaves live only under a story. id is the filename stem: bug-measure-tmp-hygiene-flake.
  CLI `arggon create bug measure-tmp-hygiene-flake` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# measure.test.ts /tmp hygiene races sibling suites

## Context

Found while validating PR #366 (`task-npm-packaging`) on 2026-09-19; the
reviewer confirmed it is pre-existing and unrelated to that PR:

- `cli/src/measure.test.ts` → "always deletes the measurement temp tree
  (/tmp hygiene)" fails when a sibling vitest suite runs concurrently on the
  same machine (shared `/tmp`). It passes isolated.
- Reproduced at base `6a03d8c` without the new test files, so it is not a
  regression.
- Symptoms: the hygiene assertion races `doctor --budget` / `measureBudget`
  temp trees and fixture subprocesses exit 1 under load; the failure depends
  on machine load and suite interleaving (observed with load average ~26 from
  parallel agents).

## Acceptance

- [x] The measurement temp tree is unique per test process/run (e.g.
      `fs.mkdtemp` under the repo or `$TMPDIR`) and the test never globs or
      deletes shared paths.
- [x] A regression test proves two concurrent runs (or two vitest workers)
      cannot interfere.
- [x] `npm test` green with a sibling suite running; the repro is documented on
      the item.
- [x] `arggon validate` green.

## Notes

- Pre-existing flake; not caused by PR #366 (`task-npm-packaging`).
- May be superseded by the `opencode2-native` redesign if the
  measure/doctor surface is rewritten; cancel with a comment then.

### 2026-09-22 @Arggon
Resolution (worker `Arggon`, branch `fix/bug-measure-tmp-hygiene-flake`, commit `05a825b`).

**Root cause.** `cli/src/measure.test.ts` "always deletes the measurement temp tree (/tmp hygiene)" globbed `${TMPDIR:-/tmp}/arggon-budget-*` with `ls -d` and asserted the result was empty. `measureBudget()` was already per-run (`mkdtemp` + `finally rmSync`), but the glob also matched every _sibling_ suite's in-flight tree on the same machine, so the assertion failed whenever another session's measurement tree existed at that instant (load-dependent; the PR #366 flake).

**Fix (2 files).**

- `cli/src/measure.ts`: new `createMeasurementTree(tmpRoot = os.tmpdir())` → `mkdtempSync(join(tmpRoot, "arggon-budget-<pid>-"))`; `measureBudget(options?)` uses it and accepts an optional `tmpRoot`. Every run owns exactly one path (unique per run, pid-visible) and removes exactly that path — no glob.
- `cli/src/measure.test.ts`: the hygiene test now asserts on a private root it owns (`readdirSync(root)` empty), never globbing/deleting shared paths. New tests: (1) `createMeasurementTree` returns distinct per-run paths under the root; (2) race regression — two concurrent `measureBudget()` runs share one root while a foreign in-flight tree exists: both complete, the foreign tree survives untouched, only own trees are removed.

**Repro (before).** Two concurrent `npx vitest run cli/src/measure.test.ts` (staggered 2.6 s) at base commit `9d77619`: both failed with `AssertionError: expected '/tmp/arggon-budget-AFsh0G' to be ''` — the sibling run's in-flight tree.

**After.** Same two concurrent runs, fixed code: both exit 0, hygiene test green ("private root; no shared-path globbing"). Full suite while a sibling `measure.test.ts` loop ran concurrently: `npm test` → 92 files / 1492 tests passed (61.87 s).

**Falsification.** With `createMeasurementTree` temporarily forced to a shared path, the two new tests fail (unit: `first === second`; race: the sibling run's `arggon create initiative` exits 1) — the regression tests bite.

**Gates.** `npm test` 92/1492 green (sibling suite running); `npm run lint` clean; `npm run build` clean (plugin bundle unchanged); `npx prettier --check` clean; `arggon validate` ok (0 warnings, convention v5). Smoke probe: `doctor --json --budget` from an adopter tree → `ok:true`, budget present, tree `arggon-budget-<pid>-XXXXXX` created and removed.

**Files.** `cli/src/measure.ts`, `cli/src/measure.test.ts` — no public CLI flag or JSON-payload change (`BudgetResult` untouched).

### handoff 2026-09-22 @Arggon — next: Review the draft PR (cli/src/measure.ts + measure.test.ts), verify gates, merge, then flip the item to done.
- branch: fix/bug-measure-tmp-hygiene-flake
- open questions: None blocking. The item notes a possible supersede by the opencode2-native redesign: if the measure/doctor surface is ever rewritten, the per-run tree helper plus the two regression tests move with i…

### 2026-09-22 @Arggon
Evidence addendum: CI on PR #389 is green (cli pass 4m17s, tasks-validate pass 38s). Sibling-suite loop over 8 consecutive `vitest run cli/src/measure.test.ts` (overlapping the full suite) → 8/8 exit 0, 13/13 tests each; no /tmp/arggon-budget-* leftovers at the end. PR: https://github.com/Arggon/ArggonManager/pull/389

### 2026-09-22 @Arggon
## Re-review PR #389 (`fix/bug-measure-tmp-hygiene-flake` @ `367de43`, base `opencode2` @ `9d77619`) — subagente revisor, DeepSeek V4.1 Flash

**Recomendación: MERGE (merge commit, nunca squash).** Sin findings bloqueantes. El item queda `in_progress`; yo no marco done.

### Findings (por severidad)

- **INFO** — el claim "`npx prettier --check` clean" del worker es válido solo para los archivos tocados: `prettier --check cli/src/measure.ts cli/src/measure.test.ts` ✅, pero repo-wide sigue rojo **también en base** (355 archivos sin formatear) y los comentarios del item (formato que escribe el propio CLI, sin línea en blanco tras `###`) están entre ellos. No es regresión ni gate: CI no corre prettier.
- **INFO** — la concurrencia del test de carrera es intra-proceso y en gran parte serializada por `spawnSync` (bloquea el event loop); aun así los dos árboles de medición coexisten/se intercalan y la falsificación demuestra que el test muerde. La garantía cross-proceso la aporta la evidencia de dos `vitest run` concurrentes.

### Verificado (independiente)

- **Repro antes (base `9d77619`)**: dos `npx vitest run cli/src/measure.test.ts` concurrentes (stagger 2.6 s) → **ambos exit 1** con `AssertionError: expected '/tmp/arggon-budget-v5mT2z' to be ''` y `expected '/tmp/arggon-budget-9XOiHN' to be ''` — cada corrida veía el árbol in-flight de la hermana. Poll de `/tmp/arggon-budget-*` cada 0.2 s confirma los árboles ajenos vivos durante la aserción.
- **Después (`367de43`)**: mismos dos runs concurrentes → **exit 0, 13/13 tests cada uno**; el poll muestra árboles de ambos pids (`1318041-*`, `1318357-*`) coexistiendo en 24 ventanas de 1 s, e incluso un árbol ajeno (`1322735-*`) durante la corrida: los tests ya no dependen de paths compartidos.
- **Falsificación** (copia scratch en `/tmp`, sin tocar el repo): `createMeasurementTree` forzado a path compartido → falla el test de unicidad (`expected '/tmp/arggon-budget-unit-IUSMD7/arggon…' not to be '…'`) y el de carrera (`Error: arggon create initiative budget fixture --json failed (exit 1)`, `measure.test.ts:88`). Los dos tests nuevos muerden.
- **Suite completa con hermana en vuelo**: `npm test` + loop de 3 `vitest run cli/src/measure.test.ts` concurrentes → **92 files / 1492 tests ✅ (60.50 s)**; los 3 runs hermanos 13/13 ✅; **cero residuos nuevos** en `/tmp/arggon-budget-*` (diff antes/después del set).
- **Contrato CLI/JSON**: `doctor --json --budget` desde árbol adopter con el CLI del branch → `ok:true`, `budgetError` ausente. Comparación recursiva de claves/tipos del payload contra el base: **idéntica** (`budget`: 7 claves, `mcp`: 4). `doctor --json` sin `--budget` no trae `budget` en ninguno de los dos. `doctor.ts:477` sigue llamando `measureBudget()` sin opciones.
- **Árbol exacto, sin residuos**: poll cada 0.1 s durante el `doctor --budget` fixed → se observa exactamente un `arggon-budget-<pid>-XXXXXX` creado y borrado; 0 leftovers al final.
- **Gates**: `npm run lint` ✅ · `npm run build` ✅ · `npm run check:plugin` ✅ (bundle 337936 B sin drift, `git status` limpio) · `arggon validate` ok (0 warnings, convention v5) · prettier en los 2 archivos tocados ✅. CI en `367de43`: `cli` + `tasks-validate` **SUCCESS** (gh API); PR `mergeable: CLEAN`; base = tip de `origin/opencode2` (merge-base = `9d77619`, sin drift).
- **Scope**: diff 3-puntos = solo `cli/src/measure.ts`, `cli/src/measure.test.ts` y el item. No toca `lib/src/worktree.ts`, `docs/`, ni los ficheros de los workers paralelos (code-span sweep, start-build-exit). Acceptance 4/4 tildada, status `in_progress` (correcto pre-merge).

### No verificado / límites

- No aplica smoke UI (sin cambios de UI). El smoke de CLI (probe `doctor --budget` adopter) sí está hecho arriba.
- El repro de la carrera es dependiente del timing: en mi corrida base falló a la primera, pero en una máquina muy descargada podría requerir más intentos (naturaleza del flake).
- No corrí `git merge-tree` (gate de shell); mergeabilidad verificada vía GitHub API (`CLEAN`) + base sin movimiento.

### Notas para el coordinator

- PR en **draft**: marcar ready antes del merge.
- **Merge commit, nunca squash.** Tras el merge, flipear el item a done (fuera de mi alcance).
- Este verdict se publica con `npm run arggon -- comment` (auto-commit `chore(tasks): commented ...`) porque los tools MCP `arggon_*` de esta sesión apuntan a `/home/arggon/Projects/ArggonManager` (convention v3) y fallan con `SHOW_FAILED`/`LIST_FAILED` en este workspace. Ese commit tracker-only mueve el tip: re-chequear CI tras el push.

**Cierre: MERGE** (merge commit).

### 2026-09-22 @Arggon
Coordinator note: reviewer reproduced the concurrent-run failure at base and the pass at head, plus falsification (shared path fails the new tests); suite 1492 with sibling loops, zero /tmp leftovers, JSON contract unchanged. Gates lint/build/check:plugin/validate; CI pass on ca2b884. Merged with merge commit; item flipped to done.
