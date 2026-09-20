---
type: task
status: in_progress
id: task-native-lib-package
title: "Kernel package: @arggon/lib (ADR 0013)"
assignee: Arggon
branch: feat/task-native-lib-package
parent: native-redesign
labels: []
priority: p0
created: "2026-09-20"
updated: "2026-09-20"
claimed_at: "2026-09-20T10:45:12.790Z"
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
