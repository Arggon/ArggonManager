---
type: task
status: blocked
id: task-release-0-4-0
title: "Release 0.4.0: kernel-first publish + tag"
parent: native-redesign
labels: []
priority: p1
created: "2026-09-21"
updated: "2026-09-21"
blocked_reason: product-owner approval for publish/tag 0.4.0
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
4. `npm publish --workspace @arggon/lib`, then `npm publish` (kernel first).
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
