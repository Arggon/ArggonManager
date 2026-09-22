---
type: task
status: in_progress
id: task-release-0-4-0
title: "Release 0.4.0: kernel-first publish + tag"
assignee: Arggon
branch: feat/task-release-0-4-0
parent: native-redesign
labels: []
priority: p1
created: "2026-09-21"
updated: "2026-09-22"
claimed_at: "2026-09-22T02:01:58.584Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-release-0-4-0
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-release-0-4-0.md
  Leaves live only under a story. id is the filename stem: task-release-0-4-0.
  CLI `arggon create task release-0-4-0` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Release 0.4.0: kernel-first publish + tag

## Context

Prepared by W7 (`task-native-dogfood-release`): the release runbook
(`ArggonManager/docs/runbooks/release.md`) and the CHANGELOG `[Unreleased]`
section are ready. Publishing/tagging is a **product-owner decision** — this
item is blocked on it.

Steps (from the runbook):

1. Bump `0.3.0` → `0.4.0`; rename `[Unreleased]` → `## 0.4.0 (date)`.
2. Remove `private: true` from `package.json` and `lib/package.json`.
3. Merge `opencode2` → `main`; `git tag v0.4.0 && git push origin v0.4.0`.
4. `npm publish --workspace @arggondev/lib`, then `npm publish` (kernel first).
5. Verify with `npm view` + a clean global install.
6. Follow-up: pin `ARGGON_REF: v0.4.0` in the workflow template, re-run `init`,
   move README/`ci.md` to the one-liner install.

## Acceptance

- [ ] Product-owner approval recorded.
- [ ] Version bump + `private` removed merged to `main`.
- [ ] `v0.4.0` tag pushed; both packages published and verified.
- [ ] Workflow template pinned to `v0.4.0`; `init` re-run; docs updated.

## Notes

- Blocked on the PO release decision (2026-09-21).

### 2026-09-22 @Arggon
Release prep evidence: bump 0.3.0→0.4.0 (root+lib), private off, kernel dep range ^0.3.0→^0.4.0 (without it the packed-install suite fails E404 and skips 6 tests), CHANGELOG [0.4.0] - 2026-09-22. Review F1-F3 applied: lock synced, lib publishConfig {access: public} + license MIT + LICENSE in the tarball (79 files/124.3 kB). Gates 1498 tests, build, check:plugin, validate, spec validate. Pending (owner gate): merge opencode2→main, tag v0.4.0, npm publish kernel-first — blocked on the @arggon npm scope (account arggondev; org must be created or an alternative chosen).

### handoff 2026-09-22 @Arggon — next: After the @arggon scope exists: merge opencode2 to main, tag v0.4.0, npm publish --workspace @arggondev/lib then npm publish; then pin ARGGON_REF v0.4.0 and re-run init.
- branch: feat/task-release-0-4-0

### 2026-09-22 @Arggon
### Review verdict (ronda 1) — PR #395 · head revisado `9f7cb03` · base `opencode2` (draft)

**NO-MERGE (request changes).** El bloque de release está casi cerrado — versiones/`private`/rango, CHANGELOG, gates y pack verificados — pero quedan dos arreglos chicos de metadata que este PR es el sitio natural para dejar hechos. F3/F4 no bloquean el merge.

## F1 (bloqueante, 4 líneas) — `package-lock.json` quedó sin actualizar

El lockfile está trackeado y en `9f7cb03` sigue en `0.3.0`: `package-lock.json:3` (root), `:9` (`packages[""]`), `:14` (`"@arggon/lib": "^0.3.0"`, el rango que este PR sube en `package.json`) y `:35` (entrada `lib`). Mientras, `package.json:3` y `lib/package.json:3` dicen `0.4.0` y la dependencia del root `^0.4.0`.

Evidencia de que es un olvido, no una decisión: el worktree del worker tiene el arreglo exacto sin commitear — `git status` → `modified: package-lock.json`; `git diff -- package-lock.json` = 4 líneas (version/version/dep/version). Precedente del repo: `d2b40c6` (release 0.3.0) y `01e7cf3` ("sync package-lock root version to 0.1.0") sí sincronizan el lock en el bump.

Impacto verificado (no rompe nada hoy): CI `35678373648` (npm 10/Node 22) pasa `npm ci` con el lock viejo; en clon limpio con npm 12 `npm ci` también pasa y `npm ls @arggon/lib` → `0.4.0 -> ./lib`; `npm pack`/`npm publish --dry-run` no leen el lock (no viaja en el tarball). Pero el commit de release — y el tag, que por política no se mueve — quedaría con el lock declarando 0.3.0, y el primer `npm install` de cualquiera ensucia su PR con ese diff.
**Fix:** commitear los 4 cambios que ya están en el worktree (y re-correr gates).

## F2 (bloqueante para el publish) — `@arggon/lib` publicaría con visibilidad privada

`lib/package.json` no tiene `publishConfig.access` y el runbook publica con `npm publish --workspace @arggon/lib` (`ArggonManager/docs/runbooks/release.md:80-81`) sin `--access public`. npm: *"By default, scoped packages are published with private visibility. To publish a scoped package with public visibility, use `npm publish --access public`"* (docs.npmjs.com, *Creating and publishing scoped public packages*, consultado 2026-09-21). Con el comando documentado, el kernel sale restringido (o el publish falla en cuenta free por requerir plan pago): en ambos casos el one-liner `npm install -g arggon-manager` no resuelve `@arggon/lib`. `npm publish --dry-run -w @arggon/lib` en el clon del head sale ok y solo imprime "with tag latest and default access (dry-run)" — el problema es silencioso hasta el publish real.
**Fix:** `"publishConfig": { "access": "public" }` en `lib/package.json` (el root es unscoped, no lo necesita) o `--access public` en el runbook; recomiendo el `publishConfig` para que el comando documentado funcione tal cual. No pude validar contra el registry: `npm view @arggon/lib version` → 404 (el scope `@arggon` no existe para `arggondev`), que es el bloqueo ya declarado.

## F3 (menor, gatea el publish) — el tarball del kernel no lleva licencia

`LICENSE` es MIT en la raíz, pero el tarball de `@arggon/lib` (78 files) solo trae `README.md`, `dist/**` y `package.json`; ningún package.json declara `"license"`. El tarball del root sí incluye `LICENSE`. Al publicar, npmjs mostraría el kernel sin licencia. **Fix sugerido:** `"license": "MIT"` en ambos + `lib/LICENSE` (npm auto-incluye `LICENSE*`/`README*` del root del paquete). No bloquea este merge; sí debería resolverse antes del `npm publish`.

## F4 (menor, proceso) — el item no tiene comentarios ni handoff

`arggon show --json task-release-0-4-0` → `comments: []`. La evidencia del worker quedó solo en el cuerpo del PR y el mensaje de commit (`docs/agents.md:22`: el comentario es el canal de handoff). Sin acción bloqueante.

## Verificado (clon limpio del head `9f7cb03`, comandos CI-equivalentes)

- Versiones/`private`/rango: root `0.4.0` sin `private`, dep `^0.4.0`; `lib/package.json` `0.4.0` sin `private`. `npm ls @arggon/lib` → `arggon-manager@0.4.0 └── @arggon/lib@0.4.0 -> ./lib`; `arggon --version` → `0.4.0 (9f7cb03, feat/task-release-0-4-0)`.
- `CHANGELOG.md:9` → `## [0.4.0] - 2026-09-22`; solo cambia el heading, el contenido de `[Unreleased]` queda intacto.
- `npm run build` 0 · `npm run check:plugin` 0 (sin drift del bundle) · `npm test` **92 files / 1498 tests passed, 0 failed, 0 skipped**, incluido `headless bootstrap + CI (packed install)` **6/6** · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` · `arggon spec validate` ok (18 docs, 0 warnings) · `context:report -- --strict` → all bounds pass.
- `npm pack --dry-run`: lib **78 files / 123.6 kB**, root **109 files / 334.7 kB** (clava los números del PR). Revisé las listas completas: 0 `.test.`/test-tmp/pack-fixtures/teardown/tui-stub; sin `node_modules` ni fuentes TS (los `.d.ts` son tipos publicados, correctos).
- Smoke: cambio metadata-only, sin cambio de comportamiento (diff solo versiones/`private`/CHANGELOG), así que no aplica el browser drive; igual probé la superficie afectada (`--version`, `npm ls`, validate/spec, pack y `npm publish --dry-run`).
- Contrafactual del rango (`lib` 0.4.0 + root `^0.3.0`, copia en /tmp): el install step de la receta falla `E404 @arggon/lib@^0.3.0` y los 6 tests quedan en skipped con el fichero en rojo (`Test Files 1 failed`, exit 1) — el bump es necesario y hace correr la suite (la palabra "silencioso" es imprecisa: el run sale rojo).
- Scope: sin tag `v0.4.0` (solo v0.2.0/v0.3.0), sin pasos/workflows de publish, PR base `opencode2` y draft; diff = `package.json`, `lib/package.json`, `CHANGELOG.md` + md del item (commit de claim). Cero cambios de comportamiento; tag/publish/merge a main quedan post-merge y bloqueados por el scope npm.
- CI de `9f7cb03`: `cli` pass (4m18s), `tasks-validate` pass (40s).
- `arggon doctor --json` head vs base: mismos buckets que `opencode2` (3 modified / 6 acknowledgedDrifted / 9 outdated preexistentes); este PR no agrega drift nuevo.

## No verificado

- Tag/publish reales (bloqueados por el scope npm; fuera de alcance por diseño).
- Windows: fixture `skipIf(win32)` por diseño.
- Los `tools.arggon.*` de esta sesión no resuelven el tracker v5 ("No tasks/ convention found"), así que el veredicto se publica con el CLI local (auto-commit a `opencode2`), igual que el veredicto de `task-native-headless-ci`.

**NO-MERGE (request changes): F1 + F2 antes del merge; F3 antes del `npm publish`; F4 sin acción bloqueante. Al reanudar: commitear el lock, `publishConfig` en `lib/package.json`, re-correr gates/CI. Después, merge commit (nunca squash); el item queda `in_progress` — su acceptance (PO, tag, publish, pin del workflow) sigue pendiente.**

### 2026-09-22 @Arggon
### Review verdict (ronda 2 — final) — PR #395 · head revisado `7288c2f` · base `opencode2` (draft)

**MERGE — confirmado.** F1–F3 corregidos y verificados en el head nuevo; F4 (tracker) ok. Gates locales 1498/1498 con packed-install 6/6 y CI de `7288c2f` verde. Merge commit, nunca squash; el item queda `in_progress` (tag/publish bloqueados por el scope `@arggon`).

## F1 — lock sincronizado (verificado)

`package-lock.json` @`7288c2f`: root `0.4.0` (`:3`), `packages[""]` `0.4.0` (`:9`), dep `^0.4.0` (`:14`), entrada `lib` `0.4.0` + `license: MIT` (`:35-36`). `grep -c '"version": "0.3.0"'` → 0 y no queda ningún `^0.3.0`. En clon limpio: `npm ci` exit 0 y `npm ls @arggon/lib` → `arggon-manager@0.4.0 └── @arggon/lib@0.4.0 -> ./lib`.

## F2 — publish público (verificado)

`lib/package.json:26-28` → `"publishConfig": { "access": "public" }`. `npm publish --dry-run -w @arggon/lib` en el clon del head: *"Publishing to https://registry.npmjs.org/ with tag latest and **public access** (dry-run)"* (antes decía "default access"). El bloqueo real sigue siendo el scope: `npm view @arggon/lib version` → 404, a crear/elegir por el PO.

## F3 — licencia (verificado, con residual menor)

`lib/LICENSE` es byte-idéntico al `LICENSE` raíz (MIT); `"license": "MIT"` declarado en `lib/package.json:25`; el tarball del kernel pasa a **79 files / 124.3 kB** con `LICENSE` presente (0 `.test.`/test-tmp/pack-fixtures). Residual no bloqueante: el `package.json` del root sigue sin campo `"license"` (su tarball sí lleva el texto `LICENSE`, así que la distribución es correcta; npmjs no mostrará SPDX). Sugerencia: agregarlo en el follow-up pre-publish / al pinchar `ARGGON_REF`.

## F4 — tracker (verificado)

El item ya tiene el comment de evidencia + `### handoff` (`7845a99`, `29beb10`; solo el md del item). Aviso de mecánica de merge: esos dos commits de tracker apendean al final del md y el veredicto de la ronda 1 ya está en `opencode2` (`7ff0340`) apendeando la misma zona → `diff3` marca **1 conflicto** al integrar. Opciones: (a) no pushear los commits de tracker y publicar el comment/handoff en `opencode2` con el CLI (como se hizo con el veredicto), o (b) mergear y resolver el md conservando ambas secciones. No toca código (`git diff 7288c2f..29beb10` = solo el md).

## Gates @`7288c2f` (clon limpio, CI-equivalentes)

- `npm ci` 0 · `npm ls` `0.4.0 -> ./lib` · `npm run build` 0 · `npm run check:plugin` 0 · `npm test` **92 files / 1498 passed (0 failed, 0 skipped)**, `headless bootstrap + CI (packed install)` **6/6** · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` · `arggon spec validate` ok (18 docs, 0 warnings) · `context:report -- --strict` → all bounds pass.
- `npm pack --dry-run`: lib **79 files / 124.3 kB** (con `LICENSE`), root **109 files / 334.6 kB** (con `LICENSE`); sin tests ni artefactos de desarrollo.
- `npm publish --dry-run`: lib con **public access**; root ok (unscoped, público por defecto).
- CI GitHub @`7288c2f`: `cli` **pass** (3m18s, run `35678997811`) · `tasks-validate` **pass** (36s, run `35678997798`).

## Scope

El fix = `lib/LICENSE` + `lib/package.json` + `package-lock.json` (0 código, 0 plantillas, 0 comportamiento). Sin tag `v0.4.0`, sin pasos de publish, PR base `opencode2` y draft. Item `in_progress` y acceptance sin tildar (honesto): tag/publish/pin siguen pendientes y bloqueados por el scope npm.

## No verificado

- Publish/tag reales (el scope `@arggon` no existe para `arggondev`: `npm view` → 404; decisión y creación del PO).
- Windows: fixture `skipIf(win32)` por diseño.

**MERGE — confirmado (merge commit, nunca squash).** Después: el item queda `in_progress` hasta el tag `v0.4.0` + publish kernel-first + pin `ARGGON_REF: v0.4.0` (follow-up).

*Publicado con el CLI local (los `tools.arggon.*` no resuelven el tracker v5 en esta sesión); comentario auto-commiteado en `opencode2`.*

### 2026-09-22 @Arggon
### Review verdict (ronda 3) — PR #396 · head revisado `837f9a54` · base `opencode2` (draft)

**NO-MERGE (request changes).** El rename a `@arggondev/lib` está completo y es un rename puro verificado (128 archivos, bundle +18 B, 0 cambios de comportamiento), pero quedan dos bloqueantes chicos: un alias de vitest sin renombrar (los tests ya no resuelven el kernel a `lib/src`) y CI rojo (`tasks-validate`) por el paso de install del workflow contra el ref pinneado.

## F1 (bloqueante, 1 línea) — `vitest.config.ts:12`: alias del kernel sin renombrar

`find: /^@arggon\/lib$/` sigue apuntando al specifier viejo; 75 archivos bajo `cli/src` importan `@arggondev/lib`, así que el alias no matchea (`/^@arggon\/lib$/.test("@arggondev/lib")` → `false`). Consecuencia verificada en clon limpio (`npm ci` 0, luego `mv lib/dist` fuera): `npx vitest run cli/src/atomic-config-writers.test.ts` → `Error: Failed to resolve entry for package "@arggondev/lib". The package may have incorrect main/module/exports specified in its package.json.` La resolución cae por `node_modules/@arggondev/lib` → `lib/dist/index.js` (`node --input-type=module -e "import.meta.resolve('@arggondev/lib')"` → `.../lib/dist/index.js`), no a `lib/src/index.ts` como prometen el comentario de la config (`vitest.config.ts:6-9`) y el docstring de `cli/src/lib.test.ts` ("vitest resolves `@arggondev/lib` to the source entry, so no build is required"). Hoy la suite pasa porque `npm ci` corre `prepare` y construye `dist/`, pero el contrato "tests contra fuente, sin build previo" quedó roto y un cambio en `lib/src` sin rebuild se testea contra `dist` viejo en silencio. **Fix:** `find: /^@arggondev\/lib$/`. Es el único ref stale que queda: `git grep -n "@arggon/lib"` → 0 y `git grep -nE 'arggon\\/lib'` → 1 hit (esta línea).

## F2 (bloqueante) — CI `tasks-validate` rojo: el workflow empaqueta `@arggondev/lib` contra `ARGGON_REF: opencode2` (pre-rename)

Run `35715647962` (head `837f9a54`): el job clona `opencode2` y ejecuta el step del head `npm pack --workspace @arggondev/lib` → `npm error No workspaces found: --workspace=@arggondev/lib` (el clone sigue con `@arggon/lib`: su build imprime `> @arggon/lib@0.4.0 build`), exit 1. El job `cli` run `35715647897` **pass** (4m17s, `check:plugin` incluido). Es transicional (post-merge el ref pinneado ya tiene el nombre nuevo), pero el PR no queda verde como está: el archivo del workflow está excluido del drift gate por self-bootstrapping y el paso de install necesita la misma tolerancia. **Fix sugerido (verificado en npm 12.0.2 y npm 10.9.4):** pack por path + glob tolerante — `npm pack --workspace lib --pack-destination "$RUNNER_TEMP/arggon-packs"` y `npm install -g "$RUNNER_TEMP/arggon-packs"/*-lib-*.tgz "$RUNNER_TEMP/arggon-packs"/arggon-manager-*.tgz` (npm acepta path como workspace y el glob matchea ambos nombres). Alternativa: decisión explícita del owner/coord de mergear con ese job rojo transicional y verificarlo post-merge; sin eso, CI no está verde.

## Verificado (worktree head `837f9a54` + clon limpio)

- **Rename puro:** normalizando `arggondev`→`arggon` en los 128 archivos del diff (`origin/opencode2...HEAD`), solo difieren 5: `.convention.yml` (bookkeeping de init: arggonVersion 0.4.0 + generatedAt), ADR 0013 (enmienda), `package-lock.json` (línea `license: MIT` del root, sync con el package.json ya mergeado), `docs/json-output.md` (reflow de tabla de prettier) y el body del item (handles `arggondev` históricos). Cero cambios de comportamiento; `index.bundle.ts` 338.601 B = 338.583 del base + 18 B (6 ocurrencias × 3 chars; 0 refs viejas en el bundle).
- **Gates:** `npm test` **92 files / 1498 passed, 0 failed, 0 skipped**; `headless bootstrap + CI (packed install)` **(6) passed** (corren con el tarball nuevo, no skipean). `npm run build` 0 · `npm run check:plugin` 0 (bundle sin drift; `git status --porcelain` vacío) · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` (layout `arggon-manager`, conventionVersion 5) · `arggon spec validate` ok (18 docs, 0 warnings) · `arggon --version` → `0.4.0 (837f9a54, feat/task-release-0-4-0-scope)` (tsx y dist compilado).
- **Pack/publish:** lib `arggondev-lib-0.4.0.tgz` **79 files / 124.325 B (124.3 kB)**, LICENSE presente, 0 `.test.`; root `arggon-manager-0.4.0.tgz` **109 files / 334.705 B (334.7 kB)**, LICENSE presente, 0 `.test.` (clavan los números del PR). `npm publish --dry-run -w @arggondev/lib`: *"Publishing to https://registry.npmjs.org/ with tag latest and **public access**"*.
- **Lock/install:** clon limpio `npm ci` exit 0 y `lib/dist/index.js` construido; `node_modules/@arggondev/lib` es el único scope linkeado (0 `@arggon` stale, también en el worktree); `npm ls @arggondev/lib` → `arggon-manager@0.4.0 └── @arggondev/lib@0.4.0 -> ./lib`.
- **ADR 0013:** enmienda presente (`Amendment (2026-09-22)`: nombre publicado, scope `@arggon` no disponible, "The architecture is unchanged"); header y cuerpo renombrados; sin cambios de arquitectura.
- **Scope:** base `opencode2`, PR draft; sin tag `v0.4.0` (local v0.2.0/v0.3.0; origin 0) ni pasos de publish nuevos (solo `.github/workflows/arggon.yml` renombrado); sin merge a `main`. Item `in_progress` con acceptance sin tildar (correcto: tag/publish/pin pendientes).
- **CI:** `cli` pass (`35715647897`); `tasks-validate` fail (`35715647962`, ver F2).

## No verificado / residual

- Tag/publish reales (bloqueados por el scope npm; fuera de alcance por diseño).
- Windows: fixtures `skipIf(win32)` por diseño.
- Residual menor (preexistente, no de este PR): `ADR 0013:40` y `ArggonManager/docs/ci.md:24,26` siguen diciendo `^0.3.0` mientras `package.json` declara `^0.4.0`; conviene corregirlo en el follow-up pre-publish.
- Residual local (no viaja al repo): las copias vendoreadas `.agents/skills/*` se renombraron a mano; `arggon init --dry-run` las reporta `modified-skip` (checksums 0.3.0) y `doctor` da 5 modified vs 2 del base. `.agents/skills/` es gitignored y el drift gate de CI no las mira.

**NO-MERGE (request changes): F1 + F2 antes del merge; ambos son de una línea / un step.** Al reanudar: fix del alias, re-correr gates y CI; después merge commit (nunca squash). El item queda `in_progress` (tag `v0.4.0` + publish kernel-first + pin `ARGGON_REF: v0.4.0` siguen pendientes).

### 2026-09-22 @Arggon
### Review verdict (ronda 4 — final) — PR #396 · head revisado `46f5af5b` · base `opencode2` (draft)

**MERGE — confirmado.** F1 y F2 corregidos y verificados en el head nuevo; CI del head **verde** (`cli` pass 4m36s run `35717441643`; `tasks-validate` pass 38s run `35717441640`). Gates locales 1498/1498 con packed-install 6/6. Merge commit, nunca squash; el item queda `in_progress` (tag `v0.4.0` + publish kernel-first + pin `ARGGON_REF` pendientes; scope ya resuelto como `@arggondev/lib`).

## F1 — alias de vitest (verificado)

`vitest.config.ts:12` → `find: /^@arggondev\/lib$/`. Reproducción en clon limpio del head (`npm ci` 0): con `lib/dist` movido fuera, `npx vitest run cli/src/atomic-config-writers.test.ts cli/src/lib.test.ts` → **2 files / 10 tests passed** (antes: `Failed to resolve entry for package "@arggondev/lib"`). Los tests vuelven a resolver `lib/src/index.ts` sin build previo, como dicen el comentario de la config y el docstring de `lib.test.ts`. Auditoría de refs stale: `git grep "@arggon/lib"` → 0 y `git grep -nE 'arggon\\/lib'` → 0.

## F2 — workflow transicional (verificado)

Template + copia del repo + docs + test actualizados a `npm pack --workspace lib` y glob `*-lib-*.tgz`; `headless-ci.test.ts` con `^.*-lib-.*\.tgz$`. Escenario transicional reproducido con el ref pinneado real (`git clone --branch opencode2`, pre-rename, `lib/package.json` = `@arggon/lib`): pack por path → `arggon-lib-0.4.0.tgz` + `arggon-manager-0.4.0.tgz`, el glob tolerante matchea e instala; `arggon --version` → `0.4.0` con **npm 12.0.2** y **npm 10.9.4** (install con prefix temporal, sin tocar el global). En CI real, `tasks-validate` pasa (38s) contra el ref pre-rename. Template vs copia del repo: idénticos salvo el comentario repo-específico (preexistente).

## Extras (verificados)

- `^0.3.0` → `^0.4.0` en `ADR 0013:40` y `ci.md:24,26`.
- `skills:sync` en clon limpio: "synced 6 bundled skill file(s)", `git status` vacío (sin drift).
- Rename puro intacto: bundle 338.601 B; `dist/cli.js` del tarball root 0 refs viejas / 1 nueva.

## Gates @`46f5af5b` (worktree + clon limpio)

- `npm test` **92 files / 1498 passed (0 failed, 0 skipped)**, `headless bootstrap + CI (packed install)` **6/6** · `npm run build` 0 · `npm run check:plugin` 0 (bundle sin drift; `git status` limpio) · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` · `arggon spec validate` ok (18 docs, 0 warnings).
- `npm pack --dry-run`: lib `arggondev-lib-0.4.0.tgz` **79 files / 124.325 B (124.3 kB)** con LICENSE; root `arggon-manager-0.4.0.tgz` **109 files / 334.7 kB** con LICENSE; 0 `.test.`. `npm publish --dry-run -w @arggondev/lib` → *"public access"*.
- CI `46f5af5b`: `cli` **pass** (4m36s) · `tasks-validate` **pass** (38s).

## Residual (no bloqueante)

- Comentarios con versión vieja: `cli/src/headless-ci.test.ts:23` (`404 @arggondev/lib@^0.3.0`) y `cli/src/pack-fixtures.ts:25` (ejemplo `arggondev-lib-0.3.0.tgz`); cosmético.
- `README.md:137` mantiene el nombre explícito `arggondev-lib-<version>.tgz` en el install (correcto para el checkout post-rename; `ci.md`/`agents.md` usan el glob por el ref pinneado).
- Bodies de items con evidencia histórica (`arggon-lib-0.3.0.tgz`, `^0.3.0`) — historia, por diseño.

## No verificado

- Tag/publish reales (post-merge; el scope ya está resuelto).
- Windows: fixtures `skipIf(win32)` por diseño.

**MERGE — confirmado (merge commit, nunca squash).** Después: merge a `main`, tag `v0.4.0`, publish kernel-first (`npm publish --workspace @arggondev/lib` → `npm publish`), pin `ARGGON_REF: v0.4.0` + re-run `init`, y recién ahí el item a `done`.

### 2026-09-22 @Arggon
Post-release PR #397 evidence: pin ARGGON_REF v0.4.0 (template + repo copy), README/ci.md one-liner primary, from-checkout recipe kept; review F1-F3 applied (registry statements corrected, docstring updated). Gates 1498 tests, validate, spec validate, headless-ci 6/6; CI pass. Residual: the published 0.4.0 generates ARGGON_REF: opencode2 — the v0.4.0 pin reaches npm adopters with the next publish (0.4.1/follow-up).

### handoff 2026-09-22 @Arggon — next: Merge #397, FF opencode2 to main, then close the release item and containers.
- branch: feat/task-release-0-4-0-post

### 2026-09-22 @Arggon
Release prep evidence: bump 0.3.0→0.4.0 (root+lib), private off, kernel dep range ^0.3.0→^0.4.0 (without it the packed-install suite fails E404 and skips 6 tests), CHANGELOG [0.4.0] - 2026-09-22. Review F1-F3 applied: lock synced, lib publishConfig {access: public} + license MIT + LICENSE in the tarball (79 files/124.3 kB). Gates 1498 tests, build, check:plugin, validate, spec validate. Pending (owner gate): merge opencode2→main, tag v0.4.0, npm publish kernel-first — blocked on the @arggon npm scope (account arggondev; org must be created or an alternative chosen).

### handoff 2026-09-22 @Arggon — next: After the @arggon scope exists: merge opencode2 to main, tag v0.4.0, npm publish --workspace @arggondev/lib then npm publish; then pin ARGGON_REF v0.4.0 and re-run init.
- branch: feat/task-release-0-4-0

### 2026-09-22 @Arggon
### Review verdict (ronda 1) — PR #395 · head revisado `9f7cb03` · base `opencode2` (draft)

**NO-MERGE (request changes).** El bloque de release está casi cerrado — versiones/`private`/rango, CHANGELOG, gates y pack verificados — pero quedan dos arreglos chicos de metadata que este PR es el sitio natural para dejar hechos. F3/F4 no bloquean el merge.

## F1 (bloqueante, 4 líneas) — `package-lock.json` quedó sin actualizar

El lockfile está trackeado y en `9f7cb03` sigue en `0.3.0`: `package-lock.json:3` (root), `:9` (`packages[""]`), `:14` (`"@arggon/lib": "^0.3.0"`, el rango que este PR sube en `package.json`) y `:35` (entrada `lib`). Mientras, `package.json:3` y `lib/package.json:3` dicen `0.4.0` y la dependencia del root `^0.4.0`.

Evidencia de que es un olvido, no una decisión: el worktree del worker tiene el arreglo exacto sin commitear — `git status` → `modified: package-lock.json`; `git diff -- package-lock.json` = 4 líneas (version/version/dep/version). Precedente del repo: `d2b40c6` (release 0.3.0) y `01e7cf3` ("sync package-lock root version to 0.1.0") sí sincronizan el lock en el bump.

Impacto verificado (no rompe nada hoy): CI `35678373648` (npm 10/Node 22) pasa `npm ci` con el lock viejo; en clon limpio con npm 12 `npm ci` también pasa y `npm ls @arggon/lib` → `0.4.0 -> ./lib`; `npm pack`/`npm publish --dry-run` no leen el lock (no viaja en el tarball). Pero el commit de release — y el tag, que por política no se mueve — quedaría con el lock declarando 0.3.0, y el primer `npm install` de cualquiera ensucia su PR con ese diff.
**Fix:** commitear los 4 cambios que ya están en el worktree (y re-correr gates).

## F2 (bloqueante para el publish) — `@arggon/lib` publicaría con visibilidad privada

`lib/package.json` no tiene `publishConfig.access` y el runbook publica con `npm publish --workspace @arggon/lib` (`ArggonManager/docs/runbooks/release.md:80-81`) sin `--access public`. npm: *"By default, scoped packages are published with private visibility. To publish a scoped package with public visibility, use `npm publish --access public`"* (docs.npmjs.com, *Creating and publishing scoped public packages*, consultado 2026-09-21). Con el comando documentado, el kernel sale restringido (o el publish falla en cuenta free por requerir plan pago): en ambos casos el one-liner `npm install -g arggon-manager` no resuelve `@arggon/lib`. `npm publish --dry-run -w @arggon/lib` en el clon del head sale ok y solo imprime "with tag latest and default access (dry-run)" — el problema es silencioso hasta el publish real.
**Fix:** `"publishConfig": { "access": "public" }` en `lib/package.json` (el root es unscoped, no lo necesita) o `--access public` en el runbook; recomiendo el `publishConfig` para que el comando documentado funcione tal cual. No pude validar contra el registry: `npm view @arggon/lib version` → 404 (el scope `@arggon` no existe para `arggondev`), que es el bloqueo ya declarado.

## F3 (menor, gatea el publish) — el tarball del kernel no lleva licencia

`LICENSE` es MIT en la raíz, pero el tarball de `@arggon/lib` (78 files) solo trae `README.md`, `dist/**` y `package.json`; ningún package.json declara `"license"`. El tarball del root sí incluye `LICENSE`. Al publicar, npmjs mostraría el kernel sin licencia. **Fix sugerido:** `"license": "MIT"` en ambos + `lib/LICENSE` (npm auto-incluye `LICENSE*`/`README*` del root del paquete). No bloquea este merge; sí debería resolverse antes del `npm publish`.

## F4 (menor, proceso) — el item no tiene comentarios ni handoff

`arggon show --json task-release-0-4-0` → `comments: []`. La evidencia del worker quedó solo en el cuerpo del PR y el mensaje de commit (`docs/agents.md:22`: el comentario es el canal de handoff). Sin acción bloqueante.

## Verificado (clon limpio del head `9f7cb03`, comandos CI-equivalentes)

- Versiones/`private`/rango: root `0.4.0` sin `private`, dep `^0.4.0`; `lib/package.json` `0.4.0` sin `private`. `npm ls @arggon/lib` → `arggon-manager@0.4.0 └── @arggon/lib@0.4.0 -> ./lib`; `arggon --version` → `0.4.0 (9f7cb03, feat/task-release-0-4-0)`.
- `CHANGELOG.md:9` → `## [0.4.0] - 2026-09-22`; solo cambia el heading, el contenido de `[Unreleased]` queda intacto.
- `npm run build` 0 · `npm run check:plugin` 0 (sin drift del bundle) · `npm test` **92 files / 1498 tests passed, 0 failed, 0 skipped**, incluido `headless bootstrap + CI (packed install)` **6/6** · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` · `arggon spec validate` ok (18 docs, 0 warnings) · `context:report -- --strict` → all bounds pass.
- `npm pack --dry-run`: lib **78 files / 123.6 kB**, root **109 files / 334.7 kB** (clava los números del PR). Revisé las listas completas: 0 `.test.`/test-tmp/pack-fixtures/teardown/tui-stub; sin `node_modules` ni fuentes TS (los `.d.ts` son tipos publicados, correctos).
- Smoke: cambio metadata-only, sin cambio de comportamiento (diff solo versiones/`private`/CHANGELOG), así que no aplica el browser drive; igual probé la superficie afectada (`--version`, `npm ls`, validate/spec, pack y `npm publish --dry-run`).
- Contrafactual del rango (`lib` 0.4.0 + root `^0.3.0`, copia en /tmp): el install step de la receta falla `E404 @arggon/lib@^0.3.0` y los 6 tests quedan en skipped con el fichero en rojo (`Test Files 1 failed`, exit 1) — el bump es necesario y hace correr la suite (la palabra "silencioso" es imprecisa: el run sale rojo).
- Scope: sin tag `v0.4.0` (solo v0.2.0/v0.3.0), sin pasos/workflows de publish, PR base `opencode2` y draft; diff = `package.json`, `lib/package.json`, `CHANGELOG.md` + md del item (commit de claim). Cero cambios de comportamiento; tag/publish/merge a main quedan post-merge y bloqueados por el scope npm.
- CI de `9f7cb03`: `cli` pass (4m18s), `tasks-validate` pass (40s).
- `arggon doctor --json` head vs base: mismos buckets que `opencode2` (3 modified / 6 acknowledgedDrifted / 9 outdated preexistentes); este PR no agrega drift nuevo.

## No verificado

- Tag/publish reales (bloqueados por el scope npm; fuera de alcance por diseño).
- Windows: fixture `skipIf(win32)` por diseño.
- Los `tools.arggon.*` de esta sesión no resuelven el tracker v5 ("No tasks/ convention found"), así que el veredicto se publica con el CLI local (auto-commit a `opencode2`), igual que el veredicto de `task-native-headless-ci`.

**NO-MERGE (request changes): F1 + F2 antes del merge; F3 antes del `npm publish`; F4 sin acción bloqueante. Al reanudar: commitear el lock, `publishConfig` en `lib/package.json`, re-correr gates/CI. Después, merge commit (nunca squash); el item queda `in_progress` — su acceptance (PO, tag, publish, pin del workflow) sigue pendiente.**

### 2026-09-22 @Arggon
### Review verdict (ronda 2 — final) — PR #395 · head revisado `7288c2f` · base `opencode2` (draft)

**MERGE — confirmado.** F1–F3 corregidos y verificados en el head nuevo; F4 (tracker) ok. Gates locales 1498/1498 con packed-install 6/6 y CI de `7288c2f` verde. Merge commit, nunca squash; el item queda `in_progress` (tag/publish bloqueados por el scope `@arggon`).

## F1 — lock sincronizado (verificado)

`package-lock.json` @`7288c2f`: root `0.4.0` (`:3`), `packages[""]` `0.4.0` (`:9`), dep `^0.4.0` (`:14`), entrada `lib` `0.4.0` + `license: MIT` (`:35-36`). `grep -c '"version": "0.3.0"'` → 0 y no queda ningún `^0.3.0`. En clon limpio: `npm ci` exit 0 y `npm ls @arggon/lib` → `arggon-manager@0.4.0 └── @arggon/lib@0.4.0 -> ./lib`.

## F2 — publish público (verificado)

`lib/package.json:26-28` → `"publishConfig": { "access": "public" }`. `npm publish --dry-run -w @arggon/lib` en el clon del head: *"Publishing to https://registry.npmjs.org/ with tag latest and **public access** (dry-run)"* (antes decía "default access"). El bloqueo real sigue siendo el scope: `npm view @arggon/lib version` → 404, a crear/elegir por el PO.

## F3 — licencia (verificado, con residual menor)

`lib/LICENSE` es byte-idéntico al `LICENSE` raíz (MIT); `"license": "MIT"` declarado en `lib/package.json:25`; el tarball del kernel pasa a **79 files / 124.3 kB** con `LICENSE` presente (0 `.test.`/test-tmp/pack-fixtures). Residual no bloqueante: el `package.json` del root sigue sin campo `"license"` (su tarball sí lleva el texto `LICENSE`, así que la distribución es correcta; npmjs no mostrará SPDX). Sugerencia: agregarlo en el follow-up pre-publish / al pinchar `ARGGON_REF`.

## F4 — tracker (verificado)

El item ya tiene el comment de evidencia + `### handoff` (`7845a99`, `29beb10`; solo el md del item). Aviso de mecánica de merge: esos dos commits de tracker apendean al final del md y el veredicto de la ronda 1 ya está en `opencode2` (`7ff0340`) apendeando la misma zona → `diff3` marca **1 conflicto** al integrar. Opciones: (a) no pushear los commits de tracker y publicar el comment/handoff en `opencode2` con el CLI (como se hizo con el veredicto), o (b) mergear y resolver el md conservando ambas secciones. No toca código (`git diff 7288c2f..29beb10` = solo el md).

## Gates @`7288c2f` (clon limpio, CI-equivalentes)

- `npm ci` 0 · `npm ls` `0.4.0 -> ./lib` · `npm run build` 0 · `npm run check:plugin` 0 · `npm test` **92 files / 1498 passed (0 failed, 0 skipped)**, `headless bootstrap + CI (packed install)` **6/6** · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` · `arggon spec validate` ok (18 docs, 0 warnings) · `context:report -- --strict` → all bounds pass.
- `npm pack --dry-run`: lib **79 files / 124.3 kB** (con `LICENSE`), root **109 files / 334.6 kB** (con `LICENSE`); sin tests ni artefactos de desarrollo.
- `npm publish --dry-run`: lib con **public access**; root ok (unscoped, público por defecto).
- CI GitHub @`7288c2f`: `cli` **pass** (3m18s, run `35678997811`) · `tasks-validate` **pass** (36s, run `35678997798`).

## Scope

El fix = `lib/LICENSE` + `lib/package.json` + `package-lock.json` (0 código, 0 plantillas, 0 comportamiento). Sin tag `v0.4.0`, sin pasos de publish, PR base `opencode2` y draft. Item `in_progress` y acceptance sin tildar (honesto): tag/publish/pin siguen pendientes y bloqueados por el scope npm.

## No verificado

- Publish/tag reales (el scope `@arggon` no existe para `arggondev`: `npm view` → 404; decisión y creación del PO).
- Windows: fixture `skipIf(win32)` por diseño.

**MERGE — confirmado (merge commit, nunca squash).** Después: el item queda `in_progress` hasta el tag `v0.4.0` + publish kernel-first + pin `ARGGON_REF: v0.4.0` (follow-up).

*Publicado con el CLI local (los `tools.arggon.*` no resuelven el tracker v5 en esta sesión); comentario auto-commiteado en `opencode2`.*

### 2026-09-22 @Arggon
### Review verdict (ronda 3) — PR #396 · head revisado `837f9a54` · base `opencode2` (draft)

**NO-MERGE (request changes).** El rename a `@arggondev/lib` está completo y es un rename puro verificado (128 archivos, bundle +18 B, 0 cambios de comportamiento), pero quedan dos bloqueantes chicos: un alias de vitest sin renombrar (los tests ya no resuelven el kernel a `lib/src`) y CI rojo (`tasks-validate`) por el paso de install del workflow contra el ref pinneado.

## F1 (bloqueante, 1 línea) — `vitest.config.ts:12`: alias del kernel sin renombrar

`find: /^@arggon\/lib$/` sigue apuntando al specifier viejo; 75 archivos bajo `cli/src` importan `@arggondev/lib`, así que el alias no matchea (`/^@arggon\/lib$/.test("@arggondev/lib")` → `false`). Consecuencia verificada en clon limpio (`npm ci` 0, luego `mv lib/dist` fuera): `npx vitest run cli/src/atomic-config-writers.test.ts` → `Error: Failed to resolve entry for package "@arggondev/lib". The package may have incorrect main/module/exports specified in its package.json.` La resolución cae por `node_modules/@arggondev/lib` → `lib/dist/index.js` (`node --input-type=module -e "import.meta.resolve('@arggondev/lib')"` → `.../lib/dist/index.js`), no a `lib/src/index.ts` como prometen el comentario de la config (`vitest.config.ts:6-9`) y el docstring de `cli/src/lib.test.ts` ("vitest resolves `@arggondev/lib` to the source entry, so no build is required"). Hoy la suite pasa porque `npm ci` corre `prepare` y construye `dist/`, pero el contrato "tests contra fuente, sin build previo" quedó roto y un cambio en `lib/src` sin rebuild se testea contra `dist` viejo en silencio. **Fix:** `find: /^@arggondev\/lib$/`. Es el único ref stale que queda: `git grep -n "@arggon/lib"` → 0 y `git grep -nE 'arggon\\/lib'` → 1 hit (esta línea).

## F2 (bloqueante) — CI `tasks-validate` rojo: el workflow empaqueta `@arggondev/lib` contra `ARGGON_REF: opencode2` (pre-rename)

Run `35715647962` (head `837f9a54`): el job clona `opencode2` y ejecuta el step del head `npm pack --workspace @arggondev/lib` → `npm error No workspaces found: --workspace=@arggondev/lib` (el clone sigue con `@arggon/lib`: su build imprime `> @arggon/lib@0.4.0 build`), exit 1. El job `cli` run `35715647897` **pass** (4m17s, `check:plugin` incluido). Es transicional (post-merge el ref pinneado ya tiene el nombre nuevo), pero el PR no queda verde como está: el archivo del workflow está excluido del drift gate por self-bootstrapping y el paso de install necesita la misma tolerancia. **Fix sugerido (verificado en npm 12.0.2 y npm 10.9.4):** pack por path + glob tolerante — `npm pack --workspace lib --pack-destination "$RUNNER_TEMP/arggon-packs"` y `npm install -g "$RUNNER_TEMP/arggon-packs"/*-lib-*.tgz "$RUNNER_TEMP/arggon-packs"/arggon-manager-*.tgz` (npm acepta path como workspace y el glob matchea ambos nombres). Alternativa: decisión explícita del owner/coord de mergear con ese job rojo transicional y verificarlo post-merge; sin eso, CI no está verde.

## Verificado (worktree head `837f9a54` + clon limpio)

- **Rename puro:** normalizando `arggondev`→`arggon` en los 128 archivos del diff (`origin/opencode2...HEAD`), solo difieren 5: `.convention.yml` (bookkeeping de init: arggonVersion 0.4.0 + generatedAt), ADR 0013 (enmienda), `package-lock.json` (línea `license: MIT` del root, sync con el package.json ya mergeado), `docs/json-output.md` (reflow de tabla de prettier) y el body del item (handles `arggondev` históricos). Cero cambios de comportamiento; `index.bundle.ts` 338.601 B = 338.583 del base + 18 B (6 ocurrencias × 3 chars; 0 refs viejas en el bundle).
- **Gates:** `npm test` **92 files / 1498 passed, 0 failed, 0 skipped**; `headless bootstrap + CI (packed install)` **(6) passed** (corren con el tarball nuevo, no skipean). `npm run build` 0 · `npm run check:plugin` 0 (bundle sin drift; `git status --porcelain` vacío) · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` (layout `arggon-manager`, conventionVersion 5) · `arggon spec validate` ok (18 docs, 0 warnings) · `arggon --version` → `0.4.0 (837f9a54, feat/task-release-0-4-0-scope)` (tsx y dist compilado).
- **Pack/publish:** lib `arggondev-lib-0.4.0.tgz` **79 files / 124.325 B (124.3 kB)**, LICENSE presente, 0 `.test.`; root `arggon-manager-0.4.0.tgz` **109 files / 334.705 B (334.7 kB)**, LICENSE presente, 0 `.test.` (clavan los números del PR). `npm publish --dry-run -w @arggondev/lib`: *"Publishing to https://registry.npmjs.org/ with tag latest and **public access**"*.
- **Lock/install:** clon limpio `npm ci` exit 0 y `lib/dist/index.js` construido; `node_modules/@arggondev/lib` es el único scope linkeado (0 `@arggon` stale, también en el worktree); `npm ls @arggondev/lib` → `arggon-manager@0.4.0 └── @arggondev/lib@0.4.0 -> ./lib`.
- **ADR 0013:** enmienda presente (`Amendment (2026-09-22)`: nombre publicado, scope `@arggon` no disponible, "The architecture is unchanged"); header y cuerpo renombrados; sin cambios de arquitectura.
- **Scope:** base `opencode2`, PR draft; sin tag `v0.4.0` (local v0.2.0/v0.3.0; origin 0) ni pasos de publish nuevos (solo `.github/workflows/arggon.yml` renombrado); sin merge a `main`. Item `in_progress` con acceptance sin tildar (correcto: tag/publish/pin pendientes).
- **CI:** `cli` pass (`35715647897`); `tasks-validate` fail (`35715647962`, ver F2).

## No verificado / residual

- Tag/publish reales (bloqueados por el scope npm; fuera de alcance por diseño).
- Windows: fixtures `skipIf(win32)` por diseño.
- Residual menor (preexistente, no de este PR): `ADR 0013:40` y `ArggonManager/docs/ci.md:24,26` siguen diciendo `^0.3.0` mientras `package.json` declara `^0.4.0`; conviene corregirlo en el follow-up pre-publish.
- Residual local (no viaja al repo): las copias vendoreadas `.agents/skills/*` se renombraron a mano; `arggon init --dry-run` las reporta `modified-skip` (checksums 0.3.0) y `doctor` da 5 modified vs 2 del base. `.agents/skills/` es gitignored y el drift gate de CI no las mira.

**NO-MERGE (request changes): F1 + F2 antes del merge; ambos son de una línea / un step.** Al reanudar: fix del alias, re-correr gates y CI; después merge commit (nunca squash). El item queda `in_progress` (tag `v0.4.0` + publish kernel-first + pin `ARGGON_REF: v0.4.0` siguen pendientes).

### 2026-09-22 @Arggon
### Review verdict (ronda 4 — final) — PR #396 · head revisado `46f5af5b` · base `opencode2` (draft)

**MERGE — confirmado.** F1 y F2 corregidos y verificados en el head nuevo; CI del head **verde** (`cli` pass 4m36s run `35717441643`; `tasks-validate` pass 38s run `35717441640`). Gates locales 1498/1498 con packed-install 6/6. Merge commit, nunca squash; el item queda `in_progress` (tag `v0.4.0` + publish kernel-first + pin `ARGGON_REF` pendientes; scope ya resuelto como `@arggondev/lib`).

## F1 — alias de vitest (verificado)

`vitest.config.ts:12` → `find: /^@arggondev\/lib$/`. Reproducción en clon limpio del head (`npm ci` 0): con `lib/dist` movido fuera, `npx vitest run cli/src/atomic-config-writers.test.ts cli/src/lib.test.ts` → **2 files / 10 tests passed** (antes: `Failed to resolve entry for package "@arggondev/lib"`). Los tests vuelven a resolver `lib/src/index.ts` sin build previo, como dicen el comentario de la config y el docstring de `lib.test.ts`. Auditoría de refs stale: `git grep "@arggon/lib"` → 0 y `git grep -nE 'arggon\\/lib'` → 0.

## F2 — workflow transicional (verificado)

Template + copia del repo + docs + test actualizados a `npm pack --workspace lib` y glob `*-lib-*.tgz`; `headless-ci.test.ts` con `^.*-lib-.*\.tgz$`. Escenario transicional reproducido con el ref pinneado real (`git clone --branch opencode2`, pre-rename, `lib/package.json` = `@arggon/lib`): pack por path → `arggon-lib-0.4.0.tgz` + `arggon-manager-0.4.0.tgz`, el glob tolerante matchea e instala; `arggon --version` → `0.4.0` con **npm 12.0.2** y **npm 10.9.4** (install con prefix temporal, sin tocar el global). En CI real, `tasks-validate` pasa (38s) contra el ref pre-rename. Template vs copia del repo: idénticos salvo el comentario repo-específico (preexistente).

## Extras (verificados)

- `^0.3.0` → `^0.4.0` en `ADR 0013:40` y `ci.md:24,26`.
- `skills:sync` en clon limpio: "synced 6 bundled skill file(s)", `git status` vacío (sin drift).
- Rename puro intacto: bundle 338.601 B; `dist/cli.js` del tarball root 0 refs viejas / 1 nueva.

## Gates @`46f5af5b` (worktree + clon limpio)

- `npm test` **92 files / 1498 passed (0 failed, 0 skipped)**, `headless bootstrap + CI (packed install)` **6/6** · `npm run build` 0 · `npm run check:plugin` 0 (bundle sin drift; `git status` limpio) · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` · `arggon spec validate` ok (18 docs, 0 warnings).
- `npm pack --dry-run`: lib `arggondev-lib-0.4.0.tgz` **79 files / 124.325 B (124.3 kB)** con LICENSE; root `arggon-manager-0.4.0.tgz` **109 files / 334.7 kB** con LICENSE; 0 `.test.`. `npm publish --dry-run -w @arggondev/lib` → *"public access"*.
- CI `46f5af5b`: `cli` **pass** (4m36s) · `tasks-validate` **pass** (38s).

## Residual (no bloqueante)

- Comentarios con versión vieja: `cli/src/headless-ci.test.ts:23` (`404 @arggondev/lib@^0.3.0`) y `cli/src/pack-fixtures.ts:25` (ejemplo `arggondev-lib-0.3.0.tgz`); cosmético.
- `README.md:137` mantiene el nombre explícito `arggondev-lib-<version>.tgz` en el install (correcto para el checkout post-rename; `ci.md`/`agents.md` usan el glob por el ref pinneado).
- Bodies de items con evidencia histórica (`arggon-lib-0.3.0.tgz`, `^0.3.0`) — historia, por diseño.

## No verificado

- Tag/publish reales (post-merge; el scope ya está resuelto).
- Windows: fixtures `skipIf(win32)` por diseño.

**MERGE — confirmado (merge commit, nunca squash).** Después: merge a `main`, tag `v0.4.0`, publish kernel-first (`npm publish --workspace @arggondev/lib` → `npm publish`), pin `ARGGON_REF: v0.4.0` + re-run `init`, y recién ahí el item a `done`.

### 2026-09-22 @Arggon
### Review verdict (ronda 5) — PR #397 · head revisado `5870828f` · base `opencode2` (draft)

**NO-MERGE (request changes).** El objetivo del PR está cumplido y verificado — pin `ARGGON_REF: v0.4.0` contra el tag real, template y copia coherentes, drift gate limpio, gates locales 1498/1498 + headless-ci 6/6 y CI del head verde — pero quedan dos afirmaciones post-release ya falsas en los mismos archivos que el PR edita (README/ci.md) y en el comentario del template del workflow. Es un fix de wording (1 commit); después, merge commit.

## F1 (bloqueante, 1 commit de docs) — "not on the registry / 404" ya es falso

- `README.md:135` (párrafo reescrito por este PR): "…declares the kernel package `@arggondev/lib`, which is **not on the registry**, so installing the root tarball alone fails with `404 @arggondev/lib`".
- `ArggonManager/docs/ci.md:28-30`: "The root tarball alone is **not installable** … that package is not on the registry (a lone `npm install -g arggon-manager-<v>.tgz` fails with `404 @arggondev/lib@^0.4.0`)".

Es falso desde el publish de 0.4.0 y contradice la frase dos líneas más arriba en ambos archivos ("both are published (`arggon-manager@0.4.0`, `@arggondev/lib@0.4.0`)"). Evidencia (npm 12.0.2 / node 26.7.0):

- `npm view @arggondev/lib version dist-tags` → `0.4.0` / `latest: 0.4.0`; `npm view arggon-manager@0.4.0 dependencies` → `{ '@arggondev/lib': '^0.4.0', commander: '^13.1.0' }`.
- Tarball raíz publicado **solo**: descargado de `registry.npmjs.org/arggon-manager/-/arggon-manager-0.4.0.tgz` y `npm install -g --prefix /tmp/opencode/pr397-tgz-prefix …/arggon-manager-0.4.0.tgz` → `added 3 packages` (arggon-manager + `@arggondev` + commander) y `arggon --version` → `0.4.0 (394654f5, opencode2)`. No hay 404.

Fix sugerido: calificar la receta a checkouts **pre-release** (kernel aún sin publicar), p.ej. "if the pinned checkout's kernel version is not on the registry (pre-release branch), the root tarball alone fails with 404 — pack both".

## F2 (bloqueante, mismo commit) — el comentario del workflow quedó auto-contradictorio

`templates/docs/github/workflows/arggon.yml:24-28` (y su copia `.github/workflows/arggon.yml:25-29`) sigue diciendo: "While `arggon-manager` and `@arggondev/lib` stay `private` (**no npm release yet**), the bin is packed from this pinned checkout…" y "**After release, replace the install step with the one-liner** `npm install -g arggon-manager` and drop these two variables" — mientras el hunk que este PR cambia pone `ARGGON_REF: v0.4.0` (el release) y conserva el install empaquetado. El archivo se vende a los adopters vía `templates/`. Fix: reescribir el comentario al estado real (el path empaquetado se mantiene a propósito contra el ref pinneado; el one-liner es el camino de adopción) o, si se quiere seguir su propia instrucción, cambiar el step al one-liner en el mismo PR.

## F3 (menor, preexistente) — docstring con versión vieja

`cli/src/headless-ci.test.ts:21-23` sigue afirmando que el kernel es `private` (no npm release) y `404 @arggondev/lib@^0.3.0` (ya señalado como residual cosmético en la ronda 4). No bloquea; arreglarlo junto con F1/F2 es gratis.

## F4 (menor, proceso) — sin comment/handoff en el item

El item no tiene `arggon comment`/`handoff` de esta ronda (la evidencia quedó solo en el body del PR); `ArggonManager/docs/agents.md:22` marca el comentario del item como canal de handoff. No bloquea.

## Verificado (worktree `5870828f` + clon limpio + registry)

- **Pin:** tag anotado `v0.4.0` (`3ec7938c`) → `394654f5` (merge del release); `git ls-remote --tags origin` y `git show v0.4.0:lib/package.json` → `@arggondev/lib@0.4.0` (el step `npm pack --workspace lib` funciona contra el ref pinneado; lo prueba el job `tasks-validate` verde). Template vs copia: `tail -n +2 .github/workflows/arggon.yml | diff - templates/docs/github/workflows/arggon.yml` → idénticos (solo el marker `# arggon:generated`).
- **init/drift:** `init --dry-run` en el head → el workflow es `modified-skip` (ya lo era en el base: checksum registrado `3bc6ebd3…` vs archivo base `587d4f4d…` / head `e897e26c…`; no es drift nuevo y el gate lo excluye). Simulé el gate de CI con el bin v0.4.0 en un clon del head: `init --no-commit` → `git status --porcelain` excluyendo `ArggonManager/.convention.yml`, `tasks/.convention.yml` y `.github/workflows/arggon.yml` → **vacío** (solo queda `M ArggonManager/.convention.yml`, excluido por diseño).
- **Docs:** versión publicada y one-liner correctos; receta from-checkout ejecutada end-to-end: `npm pack --workspace lib` + `npm pack` → `arggondev-lib-0.4.0.tgz` + `arggon-manager-0.4.0.tgz`, glob tolerante `*-lib-*.tgz`, install → `arggon --version` = `0.4.0 (5870828f, feat/task-release-0-4-0-post)`; `git status` limpio tras el pack.
- **Gates @`5870828f`:** `npm test` **92 files / 1498 passed (0 failed, 0 skipped)**, `headless-ci` **6/6** (45.6s) · `npm run build` 0 · `npm run check:plugin` 0 (bundle 338.601 B, sin drift, `git status` limpio) · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` · `arggon spec validate` ok (18 docs, 0 warnings).
- **CI del head:** `cli` **pass** (4m15s, run `35720138727`) · `tasks-validate` **pass** (37s, run `35720138712`).
- **Scope:** 5 archivos (`templates/docs/github/workflows/arggon.yml`, `.github/workflows/arggon.yml`, `README.md`, `ArggonManager/docs/ci.md`, `ArggonManager/.convention.yml` con **solo** 20 líneas `generatedAt`; 0 checksums). Sin cambios de código/comportamiento; base `opencode2`, draft, 2 commits sobre `394654f5`.

## Residual (no bloqueante, fuera de alcance)

- El pin solo llega a los adopters con el próximo publish: `arggon init` desde el `arggon-manager@0.4.0` **publicado** genera el workflow con `ARGGON_REF: opencode2` (verificado). Si el one-liner es el camino primario, conviene un 0.4.1 (o un follow-up) para que el template publicado apunte al tag.
- `CHANGELOG.md` [0.4.0] y `docs/runbooks/release.md:74` conservan prosa "private hasta la release wave" (histórica/por-diseño).

## No verificado

- Windows (fixtures `skipIf(win32)` por diseño).
- El publish/tag reales ocurrieron antes de este PR; verifiqué el resultado vía registry (`npm view`) y el tag, no la ejecución del publish.

**NO-MERGE (request changes): F1 + F2 en un commit de wording; F3 opcional en el mismo commit.** Después: re-correr gates/CI, merge commit (nunca squash), FF `opencode2` → `main` y cierre del item/contenedores (coordinador).

*Publicado con el CLI local (los `tools.arggon.*` no resuelven el tracker v5 en esta sesión); el comment auto-commitea en `opencode2`.*

### 2026-09-22 @Arggon
### Review verdict (ronda 6 — final) — PR #397 · head revisado `a60a02d7` · base `opencode2` (draft)

**NO-MERGE (request changes) — un solo fix de una frase.** F1 (fondo), F2, F3 y F4 están corregidos y verificados; gates y CI verdes. Queda **una afirmación falsa nueva** introducida por el fix de F1: `ci.md:29` "(and the install works offline)".

## F1' (bloqueante, 1 frase) — `ArggonManager/docs/ci.md:29`: "the install works offline" es falso

Texto actual: "Pack and install **both** tarballs from the same directory so the checkout's versions stay pinned **(and the install works offline)**; the root tarball also resolves `@arggondev/lib` from the registry since 0.4.0."

- El propio doc se contradice: `ci.md:113-115` → "The recipe is **not offline-hermetic**: … installs the two tarballs, **whose only runtime dependency is `commander`**. CI runners have the registry".
- Repro (npm 12.0.2): `npm install -g --prefix /tmp/opencode/pr397-offline --cache /tmp/opencode/npm-cache-empty --offline /tmp/opencode/pr397-packs/arggondev-lib-0.4.0.tgz /tmp/opencode/pr397-packs/arggon-manager-0.4.0.tgz` → `npm error code ENOTCACHED … request to https://registry.npmjs.org/commander failed`. El kernel sí se resuelve local (no falla por él), pero `commander` (dep runtime del root: `npm view arggon-manager@0.4.0 dependencies` → `{ '@arggondev/lib': '^0.4.0', commander: '^13.1.0' }`) sale del registry.
- Fix: borrar el paréntesis, o reformular: "…keeps the checkout's versions pinned (the kernel resolves locally; `commander` still comes from the registry — see the not-offline-hermetic note below)".

## F1/F2/F3/F4 — verificados

- **F1 (afirmaciones corregidas):** `npm view @arggondev/lib version` / `npm view arggon-manager version` → ambos `0.4.0` (`latest`); tarball raíz **solo** con cache limpia → instala y resuelve el kernel del registry (`arggon --version` = 0.4.0). README:135 y ci.md:27-30 ya no dicen "not on the registry"/"not installable".
- **F2:** comentario del workflow (template y copia, idénticos salvo el marker `# arggon:generated`) correcto: pack del ref pinneado para validar el seam exacto + one-liner disponible desde 0.4.0.
- **F3:** docstring `cli/src/headless-ci.test.ts:21-27` corregido (sin `private`/404).
- **F4:** el md del item en la rama ya trae comment de evidencia + `### handoff` (`eda1b77e`, `a60a02d7`).
- **Grep de frases viejas** en los archivos del PR (`not published|not on the registry|stay .*private|no npm release|404 @arggondev`): **0 hits** (solo queda "release wave" en README:538, prosa de versionado, no relacionada).

## Gates @`a60a02d7` (worktree)

`npm test` **92 files / 1498 passed** (0 failed, 0 skipped), `headless-ci` **6/6** (45.9s) · `npm run build` 0 · `npm run check:plugin` 0 (bundle 338.601 B, sin drift, `git status` limpio) · `npm run lint` 0 · `arggon validate --json` `{errors:[],warnings:[]}` · `arggon spec validate` ok (18 docs, 0 warnings) · drift gate simulado con el bin v0.4.0 sobre un clon del head → `DIRTY=[]` (solo `M ArggonManager/.convention.yml`, excluido por diseño) · template vs copia idénticos.

## CI

- Verde para `74363f83` (el head de código): `cli` pass (run `35721188905`) · `tasks-validate` pass (run `35721188834`).
- **Aviso:** el tip `a60a02d7` (los 2 commits de tracker, solo el md del item) **no tiene check runs** — se pushearon después del último run. No afecta build/test, pero conviene verificar el run del próximo push (el fix de F1') sobre el tip antes del merge.

## Merge (mecánica)

- Los commits de tracker de la rama apendean el md del item y el veredicto de la ronda 5 (`b3b7611d`, ya en `origin/opencode2`) apendea la misma zona → **1 conflicto esperado** en `ArggonManager/arggon-manager/opencode2-native/native-redesign/task-release-0-4-0.md`; resolver conservando ambas secciones (no perder el veredicto).
- Después: merge commit (nunca squash), FF `opencode2` → `main` y cierre del item/contenedores.

**NO-MERGE (request changes): solo F1' (una frase).** Todo lo demás está merge-ready.

*Publicado con el CLI local (los `tools.arggon.*` no resuelven el tracker v5 en esta sesión); el comment auto-commitea en `opencode2`.*
