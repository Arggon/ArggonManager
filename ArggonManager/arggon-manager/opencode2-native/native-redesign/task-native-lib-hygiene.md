---
type: task
status: in_progress
id: task-native-lib-hygiene
title: "lib hygiene: commander types, workspace resolution, test/docs nits"
assignee: Arggon
branch: feat/task-native-lib-hygiene
parent: native-redesign
labels: []
priority: p2
created: "2026-09-20"
updated: "2026-09-21"
claimed_at: "2026-09-21T21:30:09.094Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-lib-hygiene
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-native-lib-hygiene.md
  Leaves live only under a story. id is the filename stem: task-native-lib-hygiene.
  CLI `arggon create task native-lib-hygiene` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# lib hygiene: commander types, workspace resolution, test/docs nits

## Context

Findings from the PR #374 review (`task-native-lib-package`, ADR 0013):

1. **MEDIUM** — `@arggon/lib`'s `.d.ts` import `commander` without declaring it
   in `lib/package.json` (consumer repro: `TS2307`). Runtime is dependency-free,
   but the public types leak it. Release-blocking for W6/W7.
2. **MEDIUM** — `npm test` and the child CLI require a prior `lib` build, and in
   worktrees with linked `node_modules`, `@arggon/lib` resolves to the
   **primary checkout** (repro: `ERR_MODULE_NOT_FOUND` when hiding `lib/dist`;
   the `start --worktree` link simulation resolves to PRIMARY). Follow-up in
   docs or `start` tooling.
3. **LOW** — the `rules.ts` identity test is tautological
   (`cli/src/lib.test.ts:19-22,146-153`).
4. **LOW** — `CONTRIBUTING.md`/README drift about `lib/`; ADR index rows
   0005–0009 pre-existing.
5. **INFO** — `lib/dist` compiles `*.test.ts` (excluded from the pack).

## Acceptance

- [x] `commander` is either declared for types or removed from the public
      `.d.ts` surface; consumer type-check passes without undeclared imports.
      (Removed: `JsonProgram` is structural; the consumer type-check is pinned
      in `cli/src/lib-build.test.ts` and mutation-verified.)
- [x] Worktree resolution: tests/CLI work in a linked worktree without
      resolving `@arggon/lib` to the primary (or the requirement is documented
      and enforced in `start`).
      (Documented in `CONTRIBUTING.md`/`lib/README.md`/`README.md` and reported
      by `start --worktree` as `linkedWorkspaces` + stdout note; the full
      resolution fix needs the worktree built before the claim commit's gate —
      see the PR notes.)
- [x] `rules.ts` identity test asserts something non-tautological.
      (Moved to `lib/src/index.test.ts`; the in-place static deep import is not
      possible — it breaks `npm run build` with TS6059.)
- [x] Docs drift fixed (`CONTRIBUTING`/README about `lib/`).
- [x] `lib/dist` excludes `*.test.*` (or the pack exclusion is documented).
      (Emit pass excludes them; `tsconfig.typecheck.json` keeps them
      type-checked; asserted in `cli/src/lib-build.test.ts`.)
- [x] `lib/src/import-issues.ts` forwards `cwd` to `ghIssueListJson` (native
      calls currently resolve the repo from the server process cwd; `sync`
      already does it right).
- [x] `arggon validate` green; CI green.
      (`arggon validate` ok locally, convention v5; CI green on PR #384 — cli
      run 35659513657, tasks-validate run 35659513816.)

## Notes

- PO decisions still open: publishing/versioning of `@arggon/lib` (private
  until W6/W7) and the W2/W3 `templatesDir` injection requirement.

### 2026-09-21 @Arggon

Worker evidence for PR #384 (branch `feat/task-native-lib-hygiene`, 5 commits: ae158d3, f99ae70, a65d4ad, eb6073d, 9f2c058).

Environment note: this worktree was started with `--worktree` (linked `node_modules` → primary) and then given a **local `npm ci`** install, because finding 2's linked shape would make every spawned CLI test run the _primary's_ `lib/dist` instead of this branch's kernel. That local install is itself the documented remediation.

## Gates (all run in the worktree, after the final content commit)

- `npm run build` ✅ (kernel emit + kernel test typecheck + root tsc + `build:plugin` regenerated)
- `npm test` ✅ **1462 passed / 90 files** at the time of writing (net additions from this PR: consumer type-check, dist-no-tests pin, entry identity, 3 `linkedWorkspacePackages` unit cases, `import-issues` cwd cases, `start --worktree` fixtures, CLI envelope assertions; the one tautological test was removed). The F2/F3 follow-up round moved it to 1463 — see the review-fix comment.
- `npm run lint` ✅ exit 0 · `npx prettier --check` on every touched file ✅
- `npm run check:plugin` ✅ exit 0 (bundle regenerated and committed)
- `npm run arggon -- validate` ✅ ok, convention v5 · `npm run arggon -- spec validate` ✅ 18 docs
- CI on PR #384: pending at the time of writing (the item's last box stays unchecked until it is green).

## Finding 1 — commander types (before/after)

Consumer fixture: real copy of `lib/dist` (+`@types/node`, **no commander**) under `node_modules/@arggon/lib`, `tsc --noEmit --strict --module nodenext consumer.ts`.

- before (primary's build): `node_modules/@arggon/lib/dist/json.d.ts(1,30): error TS2307: Cannot find module 'commander' or its corresponding type declarations.`
- after: exit 0.
  Mutation sanity: re-adding the commander type to `lib/src/json.ts` makes the new test fail with that exact TS2307. `dist/*.d.ts` now import only `node:*` and relative modules.

## Finding 2 — worktree resolution (smoke, real `dist/cli.js` on a fixture repo)

- workspace link (`node_modules/@arggon/lib -> ../../lib`) + committed `lib/`: `linkedNodeModules=true linkedWorkspaces=["@arggon/lib"]`
- plain install (no workspace link): `linkedNodeModules=true linkedWorkspaces=[]`
- human output: `note: @arggon/lib resolve(s) into the primary checkout through the linked install — build there, or run \`npm ci\` in the worktree (e.g. \`x-worktree.post-start: npm ci\`) for worktree-local resolution`
- `arggon validate`/`npm test`-requires-a-build is now documented in CONTRIBUTING (CI already builds before testing).
  Decision (deviation from the item's first option, reported for review): the resolution itself was NOT changed. A link farm pointing `@arggon/lib` at the worktree copy needs `<worktree>/lib/dist` **before** the claim commit's pre-commit gate, so `start` would have to build the kernel (kernel layering) or the gate would fail — regressing `bug-start-worktree-node-modules`. The item explicitly allows "documented and enforced in `start`", which is what landed (`linkedWorkspaces` + stdout note + docs). If the coordinator wants the real resolution flip, it needs its own item (build-before-gate design).

## Finding 3 — identity test

`lib/src/index.test.ts` compares the entry bindings against `rules.ts`/`status.ts`/`relations.ts`/`next.ts` (`toBe`, not a wrapper). The reviewer's literal fix (static `../../lib/src/rules.js` in the cli test) was verified to break `npm run build`: `cli/src/lib.test.ts(1,30): error TS6059: File '.../lib/src/rules.ts' is not under 'rootDir' '.../cli/src'` (+ stray emit) — hence the relocation and the note in `lib/src/index.test.ts`.

## Finding 5 — dist test artifacts

`ls lib/dist | grep '\.test\.'` → 0 (was 26 artifacts in the primary's build). The typecheck pass still includes 14 test files (`tsc -p lib/tsconfig.typecheck.json --listFiles`), and a mutation (`const x: number = "s"` in a lib test) fails the build.

## Finding 6 — `import-issues` cwd (smoke)

Fake `gh` logging `$PWD`, probe run from `/tmp/opencode` (the "server" cwd) with the tracker at `/tmp/opencode/libhygiene-smoke/fixture`:

- before (pre-fix build): `gh ran in /tmp/opencode`
- after: `gh ran in /tmp/opencode/libhygiene-smoke/fixture`
  Tests pin both the helper's forwarding and that the operation passes its own `cwd` (and that no `cwd` key is added when the caller omits it).

## Out of scope / not done

- ADR index rows 0005–0009: flagged as pre-existing in the item context, outside its acceptance — untouched.
- `ArggonManager/docs/agents.md` (generated, drift-gated against `templates/`) does not mention `linkedWorkspaces`; the adopter template was not changed.
- PO decisions in Notes (publishing/versioning of `@arggon/lib`, W2/W3 `templatesDir` injection) untouched.

### handoff 2026-09-21 @Arggon — next: Review PR #384 (5 commits + tracker ticks): confirm CI green, then merge (tracker-carrying branch: merge commit, not squash) and flip the item to done.

- branch: feat/task-native-lib-hygiene
- open questions: Finding 2: resolution itself unchanged (documented + reported as linkedWorkspaces) — is that acceptable, or do you want a follow-up item for the link-farm/build-before-gate design?; Linked-worktree d…

### 2026-09-21 @Arggon
CI green on PR #384 @ eb6073d+tracker commits: `cli` pass (4m14s, run 35659513657) and `tasks-validate` pass (34s, run 35659513816). All seven acceptance boxes are now ticked; the coordinator still owns the done flip after merge.

### 2026-09-21 @Arggon
Review de PR #384 (`feat/task-native-lib-hygiene` @ `394f555`, base `opencode2`) — subagente revisor, DeepSeek V4.1 Flash. Evidencia abajo; no marqué done.

## Veredicto: **NO MERGE todavía** — 1 pedido de cambio acotado (F1)

El paquete verifica de punta a punta (los 7 boxes, con mutación/smoke independientes). El único defecto real es una regresión de texto en `ArggonManager/docs/json-output.md` introducida por el propio PR; se arregla con 3 espacios en 2 líneas.

## Findings (por severidad)

**F1 · MEDIA · `ArggonManager/docs/json-output.md:184` y `:659` — espacios comidos en el doc del contrato JSON (regresión de `eb6073d`)**
- `:184`: `...\`); \`null\`otherwise (the default seam writes no stanza, and\`.mcp.json\` alone...` → faltan dos espacios (`null` otherwise · and `.mcp.json`).
- `:659`: `... adds \`v1.findings\`entries such as\`{ "file": ... }\`` → faltan espacios antes de `entries` y de `{`.
- Base (`origin/opencode2`) tiene el texto correcto en ambos casos; `git show origin/opencode2:ArggonManager/docs/json-output.md | grep -n 'null.otherwise'` no matchea.
- No es prettier: probe con prettier 3.9.6 (el del repo) sobre un snippet con esos textos → los preserva y solo alinea la tabla. Es edición manual/script.
- `prettier --check` pasa (los espacios no son formato) y `spec validate` no lo cubre (valida `docs/specs`/`docs/plans`, no `docs/json-output.md`) — nada lo detecta.
- Pedido: restaurar los espacios en un commit del worker; con eso el PR queda mergeable.

**F2 · BAJA · `cli/src/start.ts:662` (cálculo) vs `:735` (hook) vs `:757` (return) — `linkedWorkspaces` reporta el estado pre-hook**
- `linkedWorkspaces` se computa antes de `x-worktree.post-start`. Con `x-worktree.post-start: npm ci` (la remediación que el propio doc recomienda), el hook reifica un install local pero el envelope y stdout siguen diciendo `["@arggon/lib"]` / "resolve(s) into the primary".
- Repro real (CLI `dist/cli.js`, fixture git con `node_modules/@arggon/lib -> ../../lib` y hook que reifica): `start --json` → `{'ok': True, 'linkedNodeModules': True, 'linkedWorkspaces': ['@arggon/lib'], 'postStart': {'ok': True}}`; tras el hook el worktree resuelve local. Es advisory (no rompe), pero contradice la definición del campo ("the worktree's install resolves into the primary"). Sugerencia: recalcular tras el hook antes del return, o documentar que reporta el estado pre-hook (la ventana del gate).

**F3 · BAJA · `skills/arggon-cli/SKILL.md:132-136` y `references/pitfalls.md:54-62` sin sincronizar**
- `ArggonManager/docs/engineering.md:35` exige `skills/arggon-cli/` "keep in sync with `ArggonManager/docs/json-output.md`" y el PR añadió campo + caveat al doc JSON sin tocar el skill (que sí documenta `linkedNodeModules` y los worktree starts). Fix barato en el mismo PR o follow-up. Nota: `.agents/skills/arggon-cli/` es copia generada (gitignored); el source commiteado es `skills/arggon-cli/`.

**F4 · INFO** — el comment del worker dice "13 test files" en el typecheck de `lib`; el conteo real es 14 (`tsc -p lib/tsconfig.typecheck.json --listFiles | grep 'lib/src.*\.test\.ts'`). Sin impacto en código.

## Verificado (independiente, sin tocar archivos del repo)

- **Acceptance 1 (commander):** `lib/dist/*.d.ts` no tiene imports reales salvo `node:child_process` + relativos; consumer tsc (copia real de `dist`+`package.json`, sin commander) exit 0; mutación en `/tmp` re-añadiendo `import type { Command } from "commander"` al `json.d.ts` copiado → `error TS2307 ... json.d.ts(1,30)` exacto. Gate en `cli/src/lib-build.test.ts:415` con copia física (no symlink, para que TS no escape al `node_modules` del repo).
- **Acceptance 2 (worktree):** documentado+enforced, alternativa sancionada por el item. Smoke real: `start --worktree` sobre fixture con workspace link imprimió la nota documentada y `--json` devolvió el campo; `linkedWorkspacePackages` con 3 casos unit + fixture `runStart` (`cli/src/worktree.test.ts`). **El flip real merece item aparte**: el razonamiento del worker es correcto — un link farm al worktree necesita `<worktree>/lib/dist` antes del gate del claim y regresaría `bug-start-worktree-node-modules`; `linkedWorkspaces` + docs (`CONTRIBUTING`, README, json-output) cumple el item.
- **Acceptance 3 (identidad):** `lib/src/index.test.ts:22-28` es falsable — mutación en copia `/tmp` envolviendo `assertUpdateRules` → el test falla (no tautológico). TS6059 reproducido con `rootDir: cli/src` + import estático de `../../lib/src/rules.js`, así que el traslado está justificado.
- **Acceptance 4/5 (docs/dist):** `lib/dist` con 0 artefactos `*.test.*`; emit program 0 tests vs typecheck 14 (`lib/tsconfig.json:15` exclude + `lib/tsconfig.typecheck.json:8` encadenado en el `build` de `lib/package.json`). `check:plugin` exit 0, bundle sin drift.
- **Acceptance 6 (`gh` cwd):** smoke real con un `gh` falso en PATH, proceso corriendo en `/tmp/opencode` y tracker en otro dir: `runImportIssues({cwd})` ejecutó gh en el dir de la operación; `ghIssueListJson({})` (sin cwd) en el cwd del proceso (documentado). Tests pinnean helper y operación.
- **Acceptance 7 (gates):** `npm test` 1462/90 ✅ · `npm run build` ✅ · `check:plugin` ✅ · `lint` ✅ · `validate` ok v5 ✅ · `spec validate` ok 18 ✅ · prettier en todos los archivos tocados ✅. CI en `394f555`: `cli` + `tasks-validate` pass (runs 35659979955 / 35659980003). API: `mergeable: true`, `merge_state: clean`.
- **Scope:** bundle regenerado sin drift; commits de tracker tocan solo el item; `dist/`/`lib/dist` no trackeados; ADR index 0005-0009 intactos (fuera de alcance declarado); las 7 cajas del item tildadas y status `in_progress` (correcto hasta el merge).

## Notas para el coordinator

- PR en **draft**: marcar ready antes del merge.
- La rama está **19 commits detrás** de `opencode2` (le faltan `b5852e9` fix `--no-gh` y `45056fd` fix trend). No es un revert de la rama: el diff 3-puntos solo muestra sus cambios; el test-merge de GitHub es limpio y conservará ambos fixes. Verificar `git log`/tests tras el merge, o rebasar antes si se prefiere. Merge commit, nunca squash.
- No pude correr `git merge-tree` (el gate de shell deniega el comando); la limpieza del merge se verificó vía API de GitHub + hunks disjuntos.
- Este verdict se publicó con `npm run arggon -- comment` (auto-commit `chore(tasks): commented ...`) porque los tools MCP `arggon_*` de esta sesión apuntan a otro checkout (`/home/arggon/Projects/ArggonManager`) y fallan con `SHOW_FAILED` en este workspace. Ese commit tracker-only mueve el tip: re-chequear CI tras el commit.
- Cierre: **NO MERGE hasta F1**. F2/F3 pueden ir en el mismo commit o a follow-up, a criterio del coordinator. Yo no marco done.

### 2026-09-21 @Arggon
Review-round fixes for the F1–F4 verdict (`git range 5590acb..11be0c4`, pushed; PR #384).

**F1 (MEDIA) — restored + root cause.** `abdb28f` restores all **four** glued spaces in `ArggonManager/docs/json-output.md` (verdict said 3; `:184` had two — `` `null` otherwise `` and `and `.mcp.json``— and `:659` two:`` `v1.findings` entries `` and `such as `{`). Token-set comparison vs `origin/opencode2`now finds zero glued tokens. Cause is *not* a hand edit:`opencode.jsonc`has`"formatter": true`, so editing the file ran prettier, and **prettier 3.9.6 glues those four spaces itself** — repro on the untouched base: `git show origin/opencode2:... > /tmp/base.md && npx prettier --write /tmp/base.md`→ the same glues (and`prettier --check`already warns on the base). The file therefore cannot be prose-correct and prettier-clean at once; the restore leaves`prettier --check`warning on that one file only (no CI job runs prettier). Reported for a possible follow-up (markdown formatter guard):`npm run format` would corrupt the reviewer-quoted text in this very item body too. Every other touched file is prettier-clean.

**F2 (BAJA) — fixed at the source.** `f56674b` recomputes `linkedWorkspaces` after `x-worktree.post-start` (before the return) and docs now state it describes the state the worktree is _left in_; the pre-hook link only covered the claim-commit gate window. Real-CLI smoke (fixture with `node_modules/@arggon/lib -> ../../lib` + a `npm ci`-shaped reify hook): reified → `{"linkedNodeModules":true,"linkedWorkspaces":[],"postStart":true}` (was `["@arggon/lib"]`) and the stdout note is gone; control hook that leaves no install → start re-links and reports `["@arggon/lib"]`. Test mutation-verified (removing the recompute → `expected [ '@arggon/lib' ] to deeply equal []`).

**F3 (BAJA).** `8c98b03` syncs the committed source `skills/arggon-cli/` (SKILL.md claim step, `references/pitfalls.md`, `references/orchestration.md`) with `docs/json-output.md`; `npm run skills:sync` regenerated the gitignored `.agents/skills/arggon-cli/**`; `skill-copy.test.ts` green.

**F4 (INFO).** `11be0c4` fixes this item's own comment: 14 test files in the `lib/tsconfig.typecheck.json` program (re-counted with the reviewer's command), and the `npm test` line no longer claims an unmeasured "before: same counts".

**Gates after the fixes:** `npm run build` ✅ · `npm test` ✅ **1463 passed / 90 files** · `lint` ✅ · `check:plugin` ✅ · `arggon validate` ✅ v5 · `spec validate` ✅ 18 · prettier ✅ except the `json-output.md` exception above. CI: pending on `11be0c4` (link in the next comment).

### handoff 2026-09-21 @Arggon — next: Re-review the F1-F4 round on PR #384 (commits f56674b, abdb28f, 8c98b03, 11be0c4): confirm the json-output.md prose is restored and CI green on the final tip, then merge (merge commit; tracker-carryi…
- branch: feat/task-native-lib-hygiene
- open questions: F1 root cause is prettier 3.9.6 + opencode formatter:true, not a hand edit — do you want a follow-up item for a markdown formatter guard (npm run format corrupts json-output.md and tracker comments)?…

### 2026-09-21 @Arggon
CI green on the final tip of the review-fix round (`11be0c4`, PR #384): `cli` pass (4m22s, run 35662349327) and `tasks-validate` pass (28s, run 35662349313). All four review findings are addressed; the item stays `in_progress` for the coordinator's done flip after merge.
