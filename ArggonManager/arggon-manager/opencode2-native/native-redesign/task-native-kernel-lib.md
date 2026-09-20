---
type: task
status: done
id: task-native-kernel-lib
title: Kernel as a library
assignee: Arggon
branch: feat/task-native-kernel-lib
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
depends_on: [task-native-layout-rename]
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-kernel-lib.md
  Leaves live only under a story. id is the filename stem: task-native-kernel-lib.
  CLI `arggon create task native-kernel-lib` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Kernel as a library (W1)

## Context

W1 of `plan-native-first-011` (spec `native-first-011`). Extract the kernel from `cli/src` into an importable library entry with a stable typed API (items, rules, paths, `--json` envelopes); the CLI consumes it, behavior and envelopes unchanged. ADR 0011 decision 4: one logic path, one library.

## Acceptance

- [x] The library imports from a clean build (`npm run build`) and exposes the kernel entrypoints the tools need.
- [x] The full test suite (1311+) stays green; CLI human/`--json` output is byte-identical on the existing fixtures.
- [x] No rule logic moves outside the kernel; `rules.ts` remains the single source.
- [x] `arggon validate` green; no user-facing behavior change.

## Notes

- Gates W2 (`task-native-tools`) and W6 (`task-native-headless-ci`).

### 2026-09-20 @Arggon
W1 evidence (head `cde8936`, branch `feat/task-native-kernel-lib`).

ENTREGA. `cli/src/lib.ts` es la entrada de librería (compila a `dist/lib.js`; subpath export `arggon-manager/lib` en `package.json` con `types` + `import`): expone items, rules, paths, los builders de envelope `--json` y una operación por comando. `cli/src/operations.ts` define las 12 operaciones in-process (list/create/update/show/next/report/validate/comment/handoff/priority/sync/import-issues): cada una devuelve el envelope documentado (`docs/json-output.md`) + los exit codes del CLI, no imprime y no lanza errores al caller (los fallos vuelven como envelope `ok:false` con el código de comando). El CLI (ramas `--json`) y el adapter MCP consumen esas mismas operaciones: una sola ruta lógica para CLI/MCP y para los tools nativos de W2/W3 (ADR 0011 §4). `rules.ts` intacto: test de identidad (`lib.assertUpdateRules === rules.assertUpdateRules`, `canTransition`, `isClaimed`, `assertParentEdge`, `runNext`) para que la librería no pueda ser un wrapper divergente.

TESTS NUEVOS. `cli/src/lib.test.ts` (8): superficie requerida por categoría, identidad de reglas, envelopes de list/show/next/report/validate, fallo `ok:false` + exit 1, `validate` con errores → exitCode 1, reglas compartidas (agente no reabre done). `cli/src/lib-build.test.ts` (11): corre `npm run build`, importa `dist/lib.js` en un proceso Node ESM real vía self-reference del paquete (ejercita el `exports` map, no un file path), verifica la lista de entrypoints del artefacto y compara bytes contra el CLI (`tsx`) en 8 casos: `list`, `list --full`, `show`, `show --body`, `show` inexistente, `next`, `report`, `validate`.

GATES (head `cde8936`): `npm test` **1350 passed** (83 files; baseline 1331 + 19 nuevos) · `npm run lint` limpio · `npm run build` limpio · `arggon validate` ok (0 warnings, convention v5) · `arggon spec validate` ok (18 docs).

PARIDAD CLI byte-idéntica (base `fc68ccc` vs head, árboles gemelos, script temporal `/tmp/opencode/w1-cli-parity.sh`, no commiteado): 18 lecturas (`hello`, `list` ± `--full`/`--filter`/`--type`, `next` ± `--ready`/`--include-stories`, `report`, `validate`, `show` ± `--body`/`--meta`/`--tail-comments`, `instructions`, `doctor`, `spec validate`), 8 fallos (`show`/`comment`/`update` inexistente, filtro inválido, `report --format`/`--since`, `handoff` sin `--next`) y 7 escrituras (`create` con labels+priority, claim, branch, `--depends-on`, `comment`, `handoff`, `done` con cascade, `priority migrate --dry-run`) + round-trip `show` posterior a un claim: todos con stdout byte-idéntico, mismo exit code y mismo stderr, normalizando solo la ruta del árbol gemelo y el lease `claimed_at` (ms). El test commiteado cubre la paridad del artefacto compilado en los 8 casos de lectura.

ALINEACIÓN MCP (reportada, no es cambio del CLI): el envelope de `arggon_update` ahora incluye `issueRoundtrip` cuando corresponde, igual que el CLI y como ya documenta `docs/json-output.md` (antes el adapter MCP lo omitía); y el `conventionVersion` de los envelopes MCP se resuelve contra el tracker detectado (mismo valor cuando el cwd es la raíz del repo, que es el caso de una sesión OpenCode). Suite completa verde, incluida la paridad CLI↔MCP.

DOCS: `ARCHITECTURE.md` (big picture + code map + boundary), `ArggonManager/docs/engineering.md` (layout del paquete), `ArggonManager/docs/json-output.md` (dónde se ensambla el envelope).

DECISIÓN REPORTADA (no tomada): bundling del plugin vendored single-file de W3 (bundlear `dist/lib.js` vs dependencia npm). La entrada es side-effect-free, sin commander y sin printing, así que ambas siguen abiertas; publicar el paquete y `private: true` son de W7. Sin cambios de contrato de datos.

### handoff 2026-09-20 @Arggon — next: Revisar PR #372 (head 5217233) contra ADR 0011 §4: lib.ts entry + operations compartidas por CLI/MCP; merge con MERGE commit (la rama lleva auto-commits del tracker); luego flip done.
- branch: feat/task-native-kernel-lib
- open questions: W3/W7 sin resolver (no bloquean W1): bundle de dist/lib.js en el plugin vendored single-file vs dependencia npm; publicar el paquete (private:true hoy). El MCP gana issueRoundtrip en update, alineado…

### 2026-09-20 @Arggon
CI `cli` pass en el head de PR #372 (`cba43a9`, run 35493791725, 2m55s). Gates locales del head: npm test 1350 passed (83 files) · lint · build · validate v5 · spec validate 18 docs.

### 2026-09-20 @Arggon
### 2026-09-20 @Arggon — Revisión W1 (PR #372, head `b823c34`)

**Veredicto: MERGE (sin bloqueantes).** Merge commit (nunca squash; la rama lleva auto-commits del tracker). No marco done.

#### Verificado (evidencia reproducida, no solo reportada)
- Worktree `.../ArggonManager-opencode2-task-native-kernel-lib` en `b823c34`; PR #372 draft base `opencode2`, MERGEABLE. CI `cli`: success en `b823c34` (run 35493928181) y en `cba43a9` (35493791725).
- Gates reproducidos: `npm test` **1350 passed (83 files)** · `npm run lint` limpio · `npm run build` limpio · `arggon validate` v5 (0 errores/0 warnings) · `arggon spec validate` (18 docs, ok). Delta de tests: 19 nuevos = 8 (`lib.test.ts`) + 11 (`lib-build.test.ts`).
- Librería desde build limpio: `rm -rf dist && npm run build`; `import("arggon-manager/lib")` por self-reference del `exports` (artefacto real, no file path) → 100 exports con los entrypoints de items/rules/paths/envelopes y las 12 operaciones; `dist/lib.d.ts` presente; 0 bytes en stdout al importar; sin import runtime de `commander` (solo `dist/cli.js` lo importa). Identidad de reglas: `lib.assertUpdateRules === rules.assertUpdateRules` (+ `canTransition`, `isClaimed`, `assertParentEdge`, `runNext`).
- Operaciones desde el artefacto compilado (no source): create/update/comment/handoff/done/reopen-refused/report → envelope y exit codes correctos; `agent:true` no reabre done (`UPDATE_FAILED`).
- **Paridad byte a byte independiente**: base `fc68ccc` en worktree propio vs head, árboles gemelos, normalizando solo la ruta raíz y `claimed_at`. **66 comparaciones, 0 diferencias**: lecturas JSON y humanas (`list` ±`--full`/`--filter`/`--type`, `show` ±`--body`/`--meta`/`--tail-comments`, `next` ±`--ready`/`--include-stories`, `report`, `validate`), fallos (`show`/`comment`/`update` inexistente, filtro inválido, `report --format`/`--since`, `handoff` sin `--next`), `validate` con errores (envelope `ok:false` + `error`, exit 1), escrituras JSON y humanas (`create` con labels+priority, claim con lease, `--add-depends-on`, comment, handoff, done con **cascade real**: `autoCompleted:["story-login"]`, `cascadeLevels:["story"]`, `cascadeSkipped:[{auth, acceptance-incomplete}]`, `priority migrate` dry-run y real).
- Alcance: diff solo en `ARCHITECTURE.md`, `engineering.md`, `json-output.md`, `cli.ts`, `mcp-server.ts`, `lib.ts`, `operations.ts`, 2 tests, `package.json` (+ item del tracker). `rules.ts` intacto, plugin/seam/templates sin tocar, sin dependencias nuevas (package.json solo `+exports`), sin reformateo masivo.

#### No verificado / límites
- `sync`/`import-issues`: paridad no reproducida (requiere `gh`); por revisión de código payload y `exit_code` idénticos, y la suite con `gh` mockeada pasa.
- `issueRoundtrip` en MCP: verificado solo por lectura del diff; la prueba viva requiere `gh` + `x-github.issue-roundtrip: true` y no hay test que lo cubra.
- El script externo de paridad del worker (33 casos) no está commiteado; reproduje un set independiente equivalente, no el mismo script.

#### Hallazgos (por severidad; ninguno bloquea)
1. **[media-baja] Cambio de comportamiento en el adapter MCP** (`cli/src/mcp-server.ts:457`, `cli/src/operations.ts:337`): `arggon_update` gana `issueRoundtrip` (antes lo omitía) y el `conventionVersion` de éxito se resuelve contra el tracker detectado. Es alineación con lo ya documentado en `ArggonManager/docs/json-output.md` §update ("aplica a todo caller del kernel, CLI y arggon_update por igual") y el worker lo declaró; la aceptación "sin cambio de comportamiento" se cumple para el CLI. Acción: test que congele el envelope MCP con `issueRoundtrip` (o nota explícita en el PR) antes de que W3/W7 lo hereden.
2. **[baja] La paridad commiteada solo cubre lecturas** (`cli/src/lib-build.test.ts:57-66`, 8 casos); las escrituras solo se validaron con script externo. Añadir 2–3 casos de escritura al gate (`create`, `update` con cascade, comment/handoff): son los envelopes de mayor riesgo (`autoCompleted`/`cascadeSkipped`/`commit`) y hoy un refactor futuro podría romperlos con la suite en verde.
3. **[baja] Superficie para W2/W3 incompleta en tipos/constantes**: `PriorityMigrateOptions` y `SyncFilled` se usan en firmas exportadas pero no se re-exportan (`cli/src/lib.ts:135,171`); y `mcp-server.ts` sigue importando `HANDOFF_SESSION_CAP` de `handoff.js` (`:4`) y `parseCsvList` de `update.js` (`:19`) en vez de la entrada de librería. W2 puede hacer deep-import, pero es el acoplamiento que W1 busca eliminar (el schema nativo de handoff necesita el cap).
4. **[baja] El gate "clean build" no limpia `dist`** (`cli/src/lib-build.test.ts:121`): corre `npm run build` sobre el dist existente. Un `rm -rf dist` previo hace real la premisa de aceptación (verifiqué el build limpio + import manualmente: ok).
5. **[informativo] Superficie amplia**: `lib.ts` re-exporta ~100 nombres, incluidas primitivas de frontmatter/ids y los `run*` de comando. Lo que W2/W3 necesitan es items/rules/paths/operations; conviene documentar qué es estable o marcar el resto como interno para no congelar internals en la API.

#### Decisión de producto a confirmar (crítica, no tomada)
Forma del paquete: W1 expone `arggon-manager/lib` como subpath export del paquete raíz existente (`package.json:7`; `private: true`, sin entry `"."` ni condición `require`/CJS). Consistente con ADR 0011 §5 ("un solo npm package = kernel + plugin + bin"), pero W3 (bundle de `dist/lib.js` en el plugin vendored single-file vs dependencia npm) y W7 (publicar, quitar `private`) heredan esta forma. Confirmar antes de W3 el nombre del subpath, la ausencia de CJS y la estrategia de bundling.

**Recomendación: merge con merge commit**, con los puntos 1–5 como follow-ups de W2/W3 (no bloquean W1). Tras mergear: flip done de `task-native-kernel-lib` y desbloquear W2.
