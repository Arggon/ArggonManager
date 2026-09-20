---
type: task
status: in_progress
id: task-native-kernel-lib
title: Kernel as a library
assignee: Arggon
branch: feat/task-native-kernel-lib
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T05:57:37.025Z"
depends_on: [task-native-layout-rename]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-kernel-lib
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
