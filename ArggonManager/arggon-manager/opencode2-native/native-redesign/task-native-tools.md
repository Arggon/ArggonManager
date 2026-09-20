---
type: task
status: in_progress
id: task-native-tools
title: Native arggon tool namespace
assignee: Arggon
branch: feat/task-native-tools
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T11:38:53.308Z"
depends_on: [task-native-lib-package]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-tools
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-tools.md
  Leaves live only under a story. id is the filename stem: task-native-tools.
  CLI `arggon create task native-tools` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native arggon tool namespace (W2)

## Context

W2 of `plan-native-first-011`. Register the `arggon` tool namespace with `ctx.tool.transform` (`options.codemode: true`) for list/create/update/show/next/report/validate/comment/handoff/priority and `sync`/`import-issues`, calling the kernel library in-process. Inputs/outputs mirror `docs/json-output.md`; kernel failures surface as typed tool errors.

## Acceptance

- [x] Headless smoke (`opencode run`) calls every tool and gets contract-shaped results.
- [x] Contract tests pin tool output ≡ `--json` envelope per command.
- [x] A kernel error returns a typed tool error; the session continues (failure isolation).
- [x] The namespace appears in the Code Mode catalog with the expected description.
- [x] ADR 0006 tool-schema measurement re-runs and stays within budget.

## Notes

- Depends on W1. MCP parity matters only if the conditional adapter is built.

### 2026-09-20 @Arggon
W2 native arggon tool namespace — implemented on `feat/task-native-tools`.

Registration: `opencode/plugins/arggon/index.ts` registers namespace `arggon`
(`ctx.tool.transform`, `options.namespace: "arggon"`, `options.codemode: true`)
with the twelve spec tools: list, create, update, show, next, report, validate,
comment, handoff, priority, sync, import_issues. Each tool calls the kernel
in-process (guarded, cached dynamic import of `@arggon/lib` — the same
`*Operation` the CLI's `--json` path uses) and returns the documented envelope.
A kernel `ok: false` throws `ArgonToolError` (typed: `code`, `command`,
`envelope`; the bounded envelope also rides in the message) instead of throwing
through a hook, so the session continues. `comment`/`handoff` default
author/session from the runtime session id (accepted only as a bounded token);
`create`/`import_issues` receive the `templatesDir` fallback resolved from the
plugin location (ADR 0013 — the kernel embeds no templates).

Evidence:
- `npm test` — 84 files / 1382 tests green (new `opencode/plugins/arggon/tools.test.ts`, 26 tests).
- `npm run lint` clean; `npm run build` ok (lib + root tsc); `arggon validate` ok (0 warnings); `arggon spec validate` ok (18 docs, 0 warnings).
- `npm run smoke:opencode` — real headless `opencode` v2.0.10, **12 scenarios, 0 failures**. New scenario "native tools (W2)" 14/14 checks: one Code Mode script calls all twelve tools → ten contract envelopes (`ok`/`schemaVersion`/`conventionVersion`/`command`), create→update round-trip, `comment`/`handoff` author `ses_…`, `sync`/`import_issues` caught inside the script as typed `SYNC_FAILED: …`/`IMPORT_FAILED: …` errors carrying the envelope while the session exits 0, `search({namespace:"arggon"})` returns the 12 `tools.arggon.*` paths (`remaining: 0`), and the tool writes are visible in the tracker through `arggon show --body`. Fixture links the workspace kernel; the dependency-less fresh-init scenario still logs no tool registration (guarded import).
- Contract suite `tools.test.ts`: per-tool byte parity against the CLI `--json` envelope on twin fixtures (8 read cases incl. `--full`/`--meta`/`--body`; 6 write cases incl. `priority migrate --dry-run` with tracker snapshots), typed-error tests (`SHOW_FAILED` envelope equality, `VALIDATE_FAILED` keeping `errors[]`, `LIST_FAILED`/`NEXT_FAILED` outside a tree), registration/namespace-description test, ADR 0006 schema-budget pin. `sync`'s failure envelope is pinned there too (fixture without a GitHub remote); `import_issues` shelling out to `gh` is covered by the smoke (gh resolves the repo from the process cwd, see finding 2).
- ADR 0006: `npm run context:report --strict` → all bounds pass. Native `arggon` tools: 10,925 B / 12 definitions ≤ 12,288 B advisory; MCP `tools/list` unchanged 10,507 B; injected item block 252 B ≤ 1024 B; fixed per-session total 24,302 B (MCP + native coexist until W3 drops the MCP stanza). Live Code Mode catalog line observed in a real session: `- arggon (20 tools, 3 shown) // ArggonManager tracker tools, in-process — …` — the namespace and its description render; the runtime draws a subset under its own ~2000-token catalog budget and `search` covers the rest.

Findings (reported, not fixed here):
1. Session correlation does not see native tool calls: `parseArggonItemFromTool`/`parseArggonItemFromCode` match the MCP names (`arggon_show`) but a Code Mode native call is `tools.arggon.show(...)`. When W3 makes the native tools the default surface, the observed-call correlation silently regresses unless the parser learns the `arggon.<name>(` form.
2. `import_issues`/`sync` shell out to `gh`, which resolves the repository from the *process* cwd — the kernel's `ghIssueListJson` does not forward the operation's `cwd`, so a native tool call can target the OpenCode server's cwd instead of the session directory (kernel scope, out of this item).
3. `loadArgonKernel()` caches the import result for the process lifetime: a long-lived `opencode serve` started before `lib/dist` exists keeps the namespace absent until restart.

### handoff 2026-09-20 @Arggon — next: Coordinator review (PR #375); then W3 replaces the CLI-driving commands and drops the MCP stanza — extend parseArggonItemFromCode to correlate tools.arggon.<name>(...) calls or the session-item corre…
- branch: feat/task-native-tools
- open questions: Pin the 12 catalog entries (options.pinned) so all render under the runtime's ~2000-token catalog budget?; import_issues/sync gh repo resolution uses the process cwd (kernel ghIssueListJson does not …

### 2026-09-20 @Arggon
**Veredicto: NO-MERGE por ahora — 1 fix bloqueante trivial (F1) + 2 huecos que cerrar/filetear antes del merge (F2, F3).** Implementación, smoke y presupuesto verificados en verde; sin regresión de CLI/MCP.

**Verificado (reproducido por mí en el worktree del item, opencode v2.0.10)**

- **Gates**: `npm test` → 84 files / **1382 passed**; `npm run lint` limpio; `npm run build` ok (lib + root); `npm run arggon -- validate` → ok (0 warnings, convention v5); `spec validate` → ok (18 docs); `npm run smoke:opencode` → **12 scenarios, 0 failures** (escenario "native tools (W2)" con todos sus checks en verde); `npm run context:report -- --strict` → todos los bounds pasan: native **10.925 B / 12 defs ≤ 12.288 B**, MCP `tools/list` **10.507 B / 9 tools** (sin cambio), item block 252 B ≤ 1024 B, total fijo 24.302 B.
- **CI**: `cli` success en run `35510246526`, headSha `d012595` == HEAD local; base `opencode2` (merge-base `d4072f4`), `MERGEABLE`/`CLEAN`.
- **Smoke de los 12 tools**: 10 envelopes `ok/command/schemaVersion/conventionVersion` correctos (list, show, next, report, validate, create, update, comment, handoff, priority); `create→update` round-trip; `comment`/`handoff` con author `ses_…` (sessionID del runtime); `sync`/`import_issues` fallan como `ArgonToolError` tipado (`SYNC_FAILED:` / `IMPORT_FAILED:` + envelope) y la sesión termina 0; `search({namespace:"arggon"})` → los 12 paths `tools.arggon.*`, `remaining: 0`; escrituras visibles por `arggon show --body`. Transcript en `/tmp/arggon-smoke-native-tools-*/…` (fixture conservado con `ARGON_SMOKE_KEEP=1`).
- **Coexistencia MCP/native** (probe extra mío sobre el fixture, `search({limit:200})`): 21 tools bajo el namespace `arggon` — 9 MCP `tools.arggon.arggon_*` + 12 native `tools.arggon.*` — sin colisión ni tools perdidas.
- **Aislamiento de fallos**: `tools.test.ts` fija `SHOW_FAILED`/`VALIDATE_FAILED`/`LIST_FAILED`/`NEXT_FAILED` y que las definiciones siguen sirviendo tras el fallo; un `add` que lanza no propaga (sigue registrando el resto); `setup`/hooks envueltos (`logOnce`), sin throws a través de hooks.
- **Import guarded**: el escenario fresh-init verifica que sin `@arggon/lib` no hay registro de tools (no-op limpio).
- **Copia vendored**: `.opencode/plugins/arggon/index.ts` == marker + fuente (byte-idéntica salvo la línea de provenance), regenerada por `cli/src/plugin-copy.test.ts`; sin drift.
- **Firmas del kernel**: los 12 adapters pasan exactamente las opciones de las `*Operation` de W1 (contrastado con `lib/src/operations.ts` y los tipos de create/update/comment/handoff/show/next/report/priority/sync/import-issues), `agent:true` en update, `templatesDir` en create/import_issues.
- **Scope/diff**: 8 ficheros; diff vacío en `cli/` y `lib/`; nada de W3 (commands/seam/bundle); 3 hunks + bloque nuevo en el plugin, prosa en docs; los escenarios MCP existentes siguen pasando.

**Hallazgos (por severidad)**

1. **BLOQUEANTE (fix trivial) — `ToolEditorLike` no está definido** (`opencode/plugins/arggon/index.ts:97`, `ToolContext.transform`). Repro: `npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck opencode/plugins/arggon/index.ts` → `error TS2304: Cannot find name 'ToolEditorLike'` (la base era type-clean con el mismo comando). No lo cazan los gates: `tsconfig.json` solo incluye `cli/src/**/*.ts`, vitest usa esbuild (sin typecheck), eslint no es type-aware y CI hace build/test/lint. Impacto runtime nulo (los tipos se borran; smoke verde), pero la fuente única que se vendoriza queda con error de compilación para cualquier `tsc`/IDE. Fix: declarar el tipo estructural junto a `ToolContext` (o inline) y re-ejecutar test/lint.
2. **MEDIUM — cobertura de contrato 10/12, no "per command"**: `tools.test.ts` pinnea paridad byte a byte de list, show (3 casos), next, report, validate, create, update (2), comment, handoff, priority; de `sync` solo el envelope de fallo (`SYNC_FAILED`) y de `import_issues` nada (solo el smoke de error tipado). El playbook afirma "pinning each tool's output byte-for-byte against the CLI `--json` envelope": no es exacto para esos dos. Cierre barato sin red: shim falso de `gh` en PATH (mismo truco que el shim `arggon` del smoke) + fixtures gemelos (caso `sync` success y `import_issues --dry-run`). Alternativa: corregir el wording y filetear la paridad como follow-up, pero entonces ajustar también el tick de acceptance.
3. **MEDIUM (diferido a W3, no perder) — la correlación de sesión no ve las llamadas nativas**: probe directo: `parseArggonItemFromCode('tools.arggon.update({id:"task-x"})')` → `undefined`; forma MCP (`tools.arggon.arggon_update`) → `task-z`; shell (`arggon update task-w`) → `task-w`; `parseArggonItemFromTool("execute", …)` → `undefined`. La regex de `index.ts:703` solo cubre `arggon_*`. Cuando W3 quite MCP, la correlación por llamada observada se pierde en silencio (quedan branch/env/shell). El handoff lo menciona, pero el body de `task-native-commands-seam` (W3) no: añadirlo allí o filetear un bug antes del merge.
4. **LOW-MEDIUM (kernel, pre-existente) — `import_issues` resuelve el repo desde el cwd del proceso**: `lib/src/import-issues.ts:270` llama `ghIssueListJson({repo, execGh})` y `ghIssueListJson` (`lib/src/import-issues.ts:142-157`) nunca setea `cwd` en `execGh` → `gh` resuelve desde el cwd del server OpenCode (largo-vida, multi-proyecto). **Corrección al finding 2 del worker**: `sync` NO está afectado — `runSync` pasa el `cwd` de la operación a `getOpenPRs` (`lib/src/sync-command.ts:35`), que detecta el repo con `detectRepo(cwd)` y siempre pasa `--repo owner/name` explícito (`lib/src/get-open-prs.ts:85-104`). Filetear bug de kernel (fuera del scope de W2; el camino CLI no cambia).
5. **LOW — `loadArgonKernel()` cachea el fallo de por vida** (`index.ts:1878-1898`): un rechazo resuelve `undefined` y queda cacheado; un server arrancado antes de que exista `lib/dist`/`@arggon/lib` sigue sin tools hasta reiniciar. Aceptable para W2 (documentado), pero un cache solo-de-éxito o una nota explícita en el playbook lo cerraría.
6. **INFO — `options.pinned` es real y no se usa**: el runtime 2.0.10 (binario instalado) registra su tool `session_move` con `options:{namespace:"opencode",codemode:!0,pinned:!0}`. Los 12 nativos van sin `pinned`; bajo el presupuesto de catálogo del runtime algunos podrían no renderizarse (search los encuentra todos; el smoke llama los 12). Decidir en W3/W7 si se pinnea un subconjunto (pinnear los 12 puede comerse el presupuesto y desplazar otras tools). Queda como pregunta abierta del handoff; no bloquea.
7. **NIT — evidencia**: el comentario del worker/PR dice "14/14 checks" del escenario nativo; mi corrida reproduce **13** líneas `ok` (12 escenarios / 0 fallos). `docs/opencode2.md` sigue diciendo `npm test # 1293+ tests` (la suite son 1382) — stale pre-existente.

**No verificado / límites**

- Paridad de éxito de `sync`/`import_issues` contra `gh` real (solo fallo tipado + inspección de código).
- `opencode serve` largo-vida real: la cache del kernel y el cwd de `gh` se verificaron por código, no con un server multi-proyecto.
- El smoke completo se reprodujo una vez (12/12); no forcé la carrera del lag de catálogo (el prompt del smoke lleva la línea de reintento).

**Decisión crítica / recomendación**

**No-merge** hasta: (1) F1 (una línea), y (2) F2 resuelto en la misma pasada (preferido: 2 casos de paridad con shim `gh`) o fileteado + wording del playbook/acceptance corregido. Antes del merge, filetear F3 en `task-native-commands-seam` y F4 como bug de kernel. Después: merge con **merge commit, nunca squash**. No marcar `done` aquí; el flip es del coordinador.

### 2026-09-20 @Arggon
Review follow-up (verdict NO-MERGE on PR #375) — addressed on the branch.

F1 (blocking, TS2304) — `ToolEditorLike` is now declared next to `ToolContext`
(structural: namespace + add). New gate `opencode/plugins/arggon/typecheck.test.ts`
runs the reviewer's exact command (`tsc --noEmit --target ES2022 --module NodeNext
--moduleResolution NodeNext --strict --skipLibCheck`) over
`opencode/plugins/arggon/index.ts` inside `npm test`; verified the pre-fix file fails
it (TS2304, reproduced before the fix) and the fixed file passes.

F2 (medium, parity 10/12) — closed at 12/12 in `tools.test.ts`, no network/gh auth:
- `sync`: twin git fixtures with origin `github.com/acme/demo` + a fake `gh` shim on
  PATH printing `gh pr list --json` → tool envelope byte-equal to
  `arggon sync --write --json`, and the filled `branch` field leaves identical tracker
  snapshots.
- `import_issues`: same shim printing `gh issue list --json` (open bug #11 + closed
  enhancement #12) → tool envelope byte-equal to `arggon import-issues --dry-run --json`,
  nothing written on either side.
Playbook testing wording corrected (it claimed all tools without noting the
GitHub-dependent two; it now documents the fake-gh cases and the plugin type gate).

F3 (nits) — the native smoke scenario has 13 `ok` checks; the previous evidence said
"14/14" and is corrected here. `docs/opencode2.md` test count 1293+ → 1385+.

Gates on `4ecae7d`: `npm test` 85 files / 1385 tests; `npm run lint` clean; `npm run build`
ok; `arggon validate` ok (0 warnings); `arggon spec validate` ok (18 docs);
`npm run smoke:opencode` 12 scenarios / 0 failures (native scenario 13/13);
`context:report --strict` all bounds pass (native tools 10,925 B ≤ 12,288 B advisory).

Deferred findings untouched as instructed: correlation `tools.arggon.<name>(…)`,
`gh` cwd for import_issues, kernel import cache, `options.pinned`.

### handoff 2026-09-20 @Arggon — next: Coordinator re-review of PR #375 (F1/F2/F3 addressed on 4ecae7d); merge with a merge commit (tracker commits live on the branch, never squash). No further worker action pending.
- branch: feat/task-native-tools
- open questions: options.pinned subset for the catalog budget (W3/W7 decision); no blocking questions left.
