---
type: task
status: done
id: task-native-lib-package
title: "Kernel package: @arggon/lib (ADR 0013)"
assignee: Arggon
branch: feat/task-native-lib-package
parent: native-redesign
labels: []
priority: p0
created: "2026-09-20"
updated: "2026-09-20"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-lib-package
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-native-lib-package.md
  Leaves live only under a story. id is the filename stem: task-native-lib-package.
  CLI `arggon create task native-lib-package` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Kernel package: @arggon/lib (ADR 0013)

## Context

Product-owner decision (2026-09-20), amending ADR 0011 §5: the kernel ships as
a **separate package `@arggon/lib`**, not as a subpath export of the root
package. The root package (`arggon-manager`) ships the plugin build + headless
bin and depends on `@arggon/lib`.

W1 (`task-native-kernel-lib`) landed the library as `arggon-manager/lib`
(subpath export, root `private: true`). This task restructures it into its own
package and absorbs the W1 review polish (`task-native-kernel-lib-polish`).

## Acceptance

- [x] `@arggon/lib` package (workspace layout, own package.json/build/exports)
      containing the kernel surface (items, rules, paths, envelopes); the root
      package depends on it via the workspace; no behavior change.
- [x] Root bin/plugin build still green; CLI human/`--json` byte parity
      preserved by the existing parity tests.
- [x] ADR 0013 merged (Accepted) amending ADR 0011 §5; `spec-native-first-011`
      Distribution updated (two packages; the vendored plugin stays a
      single-file, dependency-free bundle built from `@arggon/lib`); plan note.
- [x] W1 polish absorbed: MCP `issueRoundtrip`/`conventionVersion` test or
      documented contract; write-parity cases (create, cascade update,
      comment/handoff); re-exports (`PriorityMigrateOptions`, `SyncFilled`) with
      no deep imports left in `mcp-server.ts`; clean-build test deletes `dist`
      first; stable export subset documented.
- [x] Full suite + lint + build + `arggon validate` + `arggon spec validate`
      green; CI green.

## Notes

- Blocks W2 (`task-native-tools`), which consumes the package.
- `task-native-kernel-lib-polish` was cancelled as absorbed.

### 2026-09-20 @Arggon
### 2026-09-20 @Arggon — Entrega W1b: `@arggon/lib` como paquete (PR #374)

**Rama:** `feat/task-native-lib-package` · worktree `../ArggonManager-opencode2-task-native-lib-package` · PR #374 (draft, base `opencode2`).

**Commits**
- `a4be3a2` refactor(kernel): extract @arggon/lib as its own package (ADR 0013)
- `019f691` docs(adr): ADR 0013 + enmienda ADR 0011 §5 + spec/plan
- `af8c4a3`, `ee45d99` ticks de aceptación (tracker)

**Cambios**
- `lib/` es el paquete `@arggon/lib` (package.json/tsconfig/exports propios, ESM, sin dependencias, sin assets): entrada `lib/src/index.ts` con la superficie W1 (items/rules/paths/envelopes + 12 operaciones) y el **subset estable documentado en `lib/README.md`**.
- Root: `"workspaces": ["lib"]` y dependencia `"@arggon/lib": "^0.3.0"`; `build` construye el kernel primero; el subpath `arggon-manager/lib` se elimina. `cli/src/package-assets.ts` resuelve `packageRoot`/`bundledTemplatesDir` (el kernel no tiene assets): `create`/`import-issues` reciben `templatesDir` inyectado por CLI/MCP (y tests).
- Polish W1 absorbido: `PriorityMigrateOptions`/`SyncFilled` re-exportados; `mcp-server.ts` sin deep imports del kernel (`HANDOFF_SESSION_CAP`/`parseCsvList` desde la entrada); test MCP del payload aditivo (`conventionVersion` + `issueRoundtrip`, con shim determinista de `gh`); `lib-build.test.ts` construye en un clon limpio (sin `dist/` previo) y añade paridad de **escritura** (create, update con cascade, comment, handoff) comparando envelope normalizado + snapshot de archivos del tracker; identidad de `rules.ts` intacta.

**Evidencia (head `ee45d99`; CI en `af8c4a3`)**
- `npm test` → **1356 passed (83 files)** · `npm run lint` limpio · `npm run build` limpio (kernel → root).
- `arggon validate` ok (0 warnings, v5) · `arggon spec validate` ok (18 docs).
- CI `cli` **success** en `af8c4a3`: run 35507205400 (3m16s). Los commits de tracker posteriores solo tocan markdown del item.
- Paridad: 8 lecturas + 4 escrituras byte-idénticas CLI ↔ artefacto compilado (normalizando ruta del fixture, fechas y hash de commit); snapshot byte a byte del tracker idéntico entre los gemelos.
- `npm pack --dry-run -w @arggon/lib` → sin artefactos de test.

**Decisiones (ADR 0013)**
- Dos paquetes; ambos siguen `private: true` hasta las olas de release (W6/W7).
- El plugin vendored de W3 sigue siendo bundle single-file dependency-free construido desde `@arggon/lib`; como el kernel no tiene assets, **W2/W3 deben inyectar `templatesDir`** (o embeber las plantillas en el bundle vendored).

**Abierto para el coordinador**
- ADR 0013 se registra como Accepted en este PR (decisión ya confirmada por el product owner); el merge la sella. `docs/adr/README.md` no listaba las filas 0005–0009 (pre-existente; no tocado).
- Merge con **merge commit** (la rama lleva auto-commits del tracker), nunca squash.

### handoff 2026-09-20 @Arggon — next: Revisar PR #374 (head tras los commits de tracker) contra ADR 0013: paquete lib/ con exports propios, consumo por workspace, paridad lectura+escritura y polish W1; merge con MERGE commit; después fli…
- branch: feat/task-native-lib-package
- open questions: W2/W3 deben inyectar templatesDir (o embeber plantillas) al consumir @arggon/lib; publicar y versionar @arggon/lib (private: true hoy) queda para W6/W7.

### 2026-09-20 @Arggon
### 2026-09-20 @Arggon — Revisión PR #374: kernel como paquete `@arggon/lib`

**Veredicto: MERGE (merge commit, nunca squash).** Sin blockers. Acceptance verificada (el body tiene 5 casillas, todas `[x]`; no se eliminó ninguna respecto al estado inicial). F1 queda como follow-up **release-blocking para W6/W7**; F2/F3 como polish.

**Verificado (reproducido localmente en el worktree del item y contra CI)**

- **Gates**: `npm test` → **1356 passed / 83 files** (incluye `cli/src/lib-build.test.ts`, 16 tests); `npm run lint` limpio; `npm run build` limpio (kernel → root); `npm run arggon -- validate` → ok (0 warnings, v5); `npm run arggon -- spec validate` → ok (18 docs).
- **CI**: run `35507511643` (`cli`) success con `headSha=54814c7` == HEAD local; base `opencode2` (merge-base `8086de9`, `mergeStateStatus: CLEAN`). El workflow hace `npm ci` (prepare → build), `npm run build`, `test`, `lint`.
- **Split**: 49 ficheros movidos `cli/src → lib/src`; kernels idénticos (R100) salvo `create`, `import-issues`, `paths`, `trend`, `lib.ts → index.ts` (deltas documentados: `templatesDir`, extracción de `packageRoot`/`bundledTemplatesDir`, `ParsedLog` exportado y la nueva entrada). Cero módulos kernel restantes en `cli/src`; cero deep imports (`@arggon/lib/src|dist`, relativos a los módulos movidos); `lib/src` no importa `cli/` ni commander en runtime; el root consume solo el bare specifier (workspaces + link del lockfile); subpath `arggon-manager/lib` eliminado y sin referencias activas.
- **Paridad (probe independiente mío, base merge-base `8086de9` vs head)**: 22 casos human + `--json` — list, list --full, show, show --body, show missing, next, report, validate, create×2, update (title, status done con cascade, transición ilegal), comment, handoff, show --body y list finales — stdout/stderr/exit **y snapshot completo del tracker** byte-idénticos (normalizados solo root del fixture, fechas y hashes). Además `node dist/cli.js --json list` == CLI por tsx, y `create` + `validate` sobre el bin compilado ok.
- **Clean build**: `lib-build.test.ts` construye en un clon fresco (asserta que no existen `dist/` ni `lib/dist/`), importa por el `exports` real en Node y compara 8 lecturas + 4 escrituras (create, cascade update, comment, handoff) con snapshot de ficheros del tracker. `npm pack --dry-run -w @arggon/lib` → 74 ficheros (README, `dist/`, package.json), **0 artefactos `*.test.*`**.
- **`templatesDir`**: todos los call sites productivos inyectan `bundledTemplatesDir()` (cli.ts create/import-issues, adopt, playbooks, MCP create); el kernel sigue leyendo primero el `templates/` del repo. CLI y MCP sin cambio (tests + probe).
- **Polish W1 absorbido**: test MCP aditivo (`conventionVersion` + `issueRoundtrip` con shim de `gh`), paridad de escritura, re-exports (`PriorityMigrateOptions`, `SyncFilled`, `HANDOFF_SESSION_CAP`, `parseCsvList`, `maybeCommitUpdate`), clean-build sin `dist`, subset estable en `lib/README.md`.
- **Scope**: plugin/seam W3 intactos (`opencode/**`, `init-opencode.ts` sin tocar); sin dependencias runtime nuevas; ADR 0013 (Accepted) + enmienda 0011 §5 + spec/plan + docs vivas actualizadas.

**Hallazgos (por severidad)**

1. **MEDIUM — los types publicados de `@arggon/lib` dependen de `commander` sin declararlo.** `lib/src/json.ts:1` (`import type { Command } from "commander"`) y `lib/src/index.ts:282` re-exportan `bindJsonProgram`/`jsonEnabled`/`emitJson`/`failJson`/`successJson`; `lib/package.json` no declara `dependencies`/`devDependencies`/`peerDependencies`, y `lib/dist/json.d.ts:1` conserva el import. Repro: consumidor con el contenido del tarball, `skipLibCheck:false`, sin commander → `error TS2307: Cannot find module 'commander'` en `.../node_modules/@arggon/lib/dist/json.d.ts(1,30)`. También `npm install && npm run build` dentro de `lib/` a solas falla (commander, `@types/node`, `vitest` no declarados; el hoisting del workspace lo oculta). El runtime **sí** es dependency-free (el import de tipo se borra; no hay `commander` en `lib/dist/*.js` salvo el test, excluido del pack), y el bundle single-file de W3 no se ve afectado. Fix: `peerDependencies: { commander: ">=13" }` (o mover esos helpers, que no están en el subset estable, al adapter root; el README dice "No commander"). **Cerrar antes de publicar (W6/W7) o de consumir los types fuera del monorepo.**
2. **MEDIUM — `npm test` y el CLI hijo dependen de un build previo de `lib`; en worktrees con `node_modules` enlazado la resolución apunta al checkout primario.** Repro 1: `mv lib/dist … && vitest run cli/src/success-stdout.test.ts` → 12/12 fallan con `ERR_MODULE_NOT_FOUND .../node_modules/@arggon/lib/dist/index.js`; el comentario de `vitest.config.ts` ("a run never depends on a previous `npm run build`") solo vale para los imports in-process (alias), no para los tests spawn+tsx. CI/README son build-first (`npm ci` corre `prepare`), así que el gate no se rompe. Repro 2 (riesgo de worktree): simulé el enlace que hace `arggon start --worktree` (`node_modules → primario/node_modules`) y `@arggon/lib` resuelve a `primario/lib` (no al `lib/` del worktree): un worktree sin instalación propia testea/ejecuta el kernel del primario, o falla si el primario no está en un branch con `lib/`. Recomiendo follow-up: documentar que trabajar sobre `lib/` exige `npm ci`/instalación real en el worktree (o un globalSetup que construya), y revisar el link de `start`.
3. **LOW — test de identidad de `rules.ts` tautológico.** `cli/src/lib.test.ts:19-22` importa `rulesModule`/`statusModule`/… desde `@arggon/lib` (la misma entrada) y `:146-153` compara la entrada consigo misma; antes comparaba contra `./rules.js`, `./status.js`, etc., así que ya no detecta un wrapper divergente. Fix: import relativo test-only (`../../lib/src/rules.js`). El re-export real es directo, por eso es un finding de test, no de runtime.
4. **LOW (docs) — drift menor:** `CONTRIBUTING.md` ("TypeScript sources live under `cli/`") y `README.md` ("TypeScript in cli/") no mencionan `lib/`; el resto viaja bien (ARCHITECTURE, engineering, json-output, agents, claim, ADR, spec, plan). `docs/adr/README.md` sigue sin las filas 0005–0009 (pre-existente, declarado por el worker; opcional).
5. **INFO — `lib/dist` compila los `*.test.ts`** (26 artefactos), excluidos del pack (verificado) y del `exports`; el root hace lo mismo. Opcional añadir `exclude` al tsconfig de `lib`.

**No verificado / límites**

- `import-issues` de punta a punta contra `gh` (inspección de código + tests unitarios con `execGh` inyectado; el probe de paridad no cubre ese comando).
- El flujo real de `arggon start --worktree` completo (simulé la mecánica del enlace de `node_modules`, no lo ejecuté).
- El bundle vendored de W3 (aún no existe; el runtime dependency-free de `lib/dist` sí está comprobado).

**Decisiones para el product owner**

- **Publishing/versionado de `@arggon/lib`** (hoy `private: true`, ADR 0013 §6): nombre/scope, si `commander` pasa a peerDependency o se mueven los helpers tipados al root, y cómo se publican/etiquetan los dos paquetes en W6/W7. Confirmar antes de publicar.
- **W2/W3 deben inyectar `templatesDir`** (o embeber plantillas en el bundle vendored): registrado en ADR/spec/plan; W2 (`task-native-tools`) sigue bloqueado por este item.

**Recomendación: merge con merge commit (nunca squash).** CI/paridad/acceptance en verde; F1 release-blocking como follow-up, F2/F3 polish como follow-ups.
