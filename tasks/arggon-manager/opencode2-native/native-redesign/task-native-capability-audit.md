---
type: task
status: in_progress
id: task-native-capability-audit
title: Audit every OpenCode V2 surface and map ArggonManager capabilities
assignee: Arggon
branch: feat/task-native-capability-audit
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
claimed_at: "2026-09-19T20:16:52.992Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-capability-audit
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-capability-audit.md
  Leaves live only under a story. id is the filename stem: task-native-capability-audit.
  CLI `arggon create task native-capability-audit` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Audit every OpenCode V2 surface and map ArggonManager capabilities

## Context

First wave of epic `opencode2-native`. Produce the exploration
`docs/explorations/exploration-opencode2-native-010.md` (next free id) that
inventories every OpenCode V2 surface and maps each ArggonManager capability to
native mechanisms.

Sources: `https://opencode.ai/v2/llms.txt` (docs index), the V2 docs (accessed
2026-09-19), the installed runtime (v2.0.10; the playbook pin refresh to
2.0.10 is a follow-up), ADR 0010 + playbook +
`exploration-opencode-v2-native-009` (baseline), and the current code
(`cli/src/`, `opencode/plugins/arggon/`).

Required sections:

- **Inventory of V2 surfaces**: config/instructions, agents, commands, skills,
  plugins (transforms, hooks, events, storage, permissions, sessions,
  worktrees, VCS, generate, client/SDK/RPC); CLI/TUI plugins (commands,
  keymaps, routes, slots/panels, dialogs, markdown renderers); MCP (keep,
  replace or drop); API/client; Code Mode; compaction/context; snapshots;
  sharing.
- **Capability map**: for each ArggonManager capability (item CRUD, validate,
  board, claim, start/worktree, review gate, done/cascade, spec/ADR/plan docs,
  doctor, init/scaffold, orchestration, context injection) list the native
  mechanism(s) that could own it, with trade-offs.
- **Decision points, each with a recommendation** (the product owner delegated
  these to the audit, 2026-09-19):
  - **D1 — source of truth**: git-native `tasks/` vs OpenCode runtime state
    (storage/DB).
  - **D2 — methodology contract**: keep the Agile tree + claim→worktree→PR→
    review→done loop as fixed contract, or redesign the flow/states/gates with
    native primitives.
  - Implementation-level: in-process plugin tools vs child-process kernel; TUI
    plugin as the board; worktree strategy via `ctx.worktree.transform`; rule
    enforcement via `ctx.permission.rules`; distribution (npm package vs
    vendored file).
- **Risks**: API churn (pin 2.0.x), failure isolation, testing strategy
  without the CLI, adopter bootstrap without `arggon init`, migration of
  existing `tasks/` trees.
- **Recommendation** + ADR outline.

## Acceptance

- [ ] Exploration doc merged under `docs/explorations/` following
      `templates/exploration.md`, with dated sources.
- [ ] Every ArggonManager capability is either assigned a native mechanism or
      explicitly dropped, with rationale.
- [ ] D1 (source of truth) and D2 (methodology contract) each have a
      recommendation with trade-offs, ready for the ADR.
- [ ] ADR outline ready (next ADR number, 0011) for the follow-up task.
- [ ] `arggon validate` green; no code changes in this task.

## Notes

- This audit decides direction; `install-ergonomics` is reassessed when it
  lands.

### 2026-09-19 @Arggon
## Review PR #367 — `feat/task-native-capability-audit` (docs-only, draft, base `opencode2`)

**Veredicto: NO-MERGE por ahora (cambios solicitados, baratos).** El doc es sólido en estructura, D1/D2 y fuentes, pero la checklist de aceptación no está completa: el mapa F2 omite capacidades shipped y el inventario F1 omite superficies que el item pide explícitamente.

### Verificado (evidencia)
- **Diff docs-only y fuera de scope solo docs**: `docs/explorations/exploration-opencode2-native-010.md` (+258) y la nota de fuentes del item (2.0.8→2.0.10). Sin cambios de código. Smoke test exento por docs-only (docs/engineering.md, "Smoke test").
- **Gates reproducidos en el worktree**: `arggon validate` → ok (0 warnings, convention v3); `npm run lint` limpio; `npx vitest run` → **1293/1293 en 77 archivos**; `prettier --check` OK en ambos archivos. CI `cli` en verde sobre el head `fad6ead` (run 35474034283). CI verde es necesario, no suficiente: el smoke no aplica aquí.
- **Runtime/playbook**: `opencode --version` → v2.0.10; `docs/playbooks/opencode.md:3,23` sigue en 2.0.8. El drift declarado en F1.13 y en la nota del item es correcto.
- **Template y secciones**: sigue `templates/exploration.md` (frontmatter, Candidates, Criteria, Findings, Recommendation, Decision) con inventario (F1), mapa (F2), D1/D2/D3 (F3), revisión ADR 0010 (F3.1), riesgos (F4), recomendación y outline ADR 0011. D1 y D2 traen recomendación con trade-offs; F3.1 mapea correctamente lo diferido/rechazado de ADR 0010 (tools nativas, kernel in-process, npm, CLI-only, MCP-only, SDK embedding).
- **Spot-check de fuentes V2 (docs bajados 2026-09-19)**: `ctx.tool.transform` + namespaces + `options.codemode: true`; los 12 transforms (provider/model/agent/command/mcp/integration/reference/skill/tool/websearch/worktree/vcs); `ctx.worktree.transform` y `create/list/refresh/remove`; permisos con `execute`, `subagent`, `skill`, `<server>_<tool>`, last-match-wins y saved approvals durables project-scoped; snapshots best-effort con git-object DB separada y "not a transaction or backup"; `request` "preserved but does not yet send"; skills (dirs, autoinvoke/slash, permiso por skill ID); commands (shell blocks fuera del flujo de permisos, precedencia de proyecto); `ctx.generate.text`, `ctx.plugin.list`, `ctx.permission.rules`, sesiones create/get/context/switch/prompt/generate/command/synthetic/rename/interrupt/wait; Code Mode (execute gate + nested tools). Todo eso es correcto.

### Hallazgos (orden de severidad)
1. **Bloqueante — mapa de capacidades incompleto (acceptance #2).** F2 no menciona: `sync` + `import-issues` (reconciliación GitHub; `docs/engineering.md:50` la lista como shipped; `cli/src/cli.ts:2488` y `:1250`), `comment` + `handoff` (**2 de los 9 tools MCP**: `cli/src/mcp-server.ts:238,257`), `adopt` (`cli.ts:324`), `cleanup` (`cli.ts:2112`), `priority`/`priority migrate` (`cli.ts:1015-1019`) e `instructions` (`cli.ts:2580`). `grep` sobre el doc de "sync|handoff|comment|adopt|cleanup|migrate|instructions|import-issues" solo devuelve la fila `next (priority ranking)`, "Migration" (riesgo 5) y "adopters". El item exige "cada capacidad asignada a un mecanismo nativo o descartada con razón": hoy no se puede saber si el rediseño conserva o descarta `sync`/`handoff`/`comment`/`adopt`.
   **Fix sugerido**: filas en F2 (p. ej. `sync`/`import-issues` → tool + `gh` o drop razonado; `comment`/`handoff` → tools nativos in-process, son parte del loop; `adopt` → init/template; `cleanup` → worktree domain; priority field → item CRUD) o un párrafo corto que declare la granularidad y los pliegue.
2. **Mayor — inventario F1 incompleto frente a lo pedido por el item.** No hay finding de **compaction/context** (solo la clave `compaction retention` en F1.1 y el hook en F1.8) ni de **sharing** (0 menciones; el item lo pide y 009 lo registraba como inert). **API/client** queda en una frase dentro de F1.8 (`client/SDK/RPC/Effect`). Añadir 1-2 items cortos con fuente fechada y estado (compaction: checkpoint/lossy/hooks; sharing: inert).
3. **Menor — citas inexactas a corregir**:
   - F1.2 (`:65-66`) atribuye "nesting default is one level" a los docs de agents; la frase está en `https://opencode.ai/v2/docs/tools/` (Subagent: "the default nesting depth is one"). El doc de agents no menciona nesting.
   - F1.8 (`:92`) dice "storage (durable + memory)" para el plugin **server**; ese API solo documenta durable (`ctx.storage.get/set/remove/scan`). La memory storage es del plugin **CLI/TUI** (`context.storage.memory`), que F1.9 sí lista bien.
   - F1.5 (`:75-78`) lista `browser` como built-in; los docs lo presentan como namespace de Code Mode atado a la app desktop ("The browser Code Mode namespace controls the browser attached by the OpenCode desktop app"). Calificarlo.
   - F1.8 (`:92`) "events.subscribe" → API real `ctx.event.subscribe`.
4. **Menor — prosa rota en F2**: `:121-124` parte la frase con una línea en blanco y convierte "`- --json`) , stdio MCP..." en un bullet huérfano. Debería ser "CLI (human + `--json`), stdio MCP (9 tools), ...".
5. **Menor/proceso — follow-ups declarados sin item**: F1.13 y la nota del item dicen que el refresco del pin a 2.0.10 es follow-up, y el outline habla del "follow-up task" del ADR 0011; bajo `native-redesign` solo existe este task (`arggon list --parent native-redesign`). Con la regla "findings become items", conviene filearlos (p. ej. pin del playbook y `task-adr-0011-native-first`).

### Tensiones para ADR 0011 (no bloquean, pero el ADR debe cerrarlas)
- **Bootstrap**: B conserva un "thin headless artifact" (init/CI/doctor) y el riesgo 2 admite que A necesitaría un bin/template; no se fija la forma (npx package vs template repo vs subcomandos) ni el criterio para pasar de B a A.
- **Kernel como librería**: se asume publicarlo y consumirlo in-process, pero no se dice cómo lo resuelve el plugin en árboles dependency-less (el playbook registra que el import estático falla al cargar; bundle vs dependencia no aparece en F4).
- **Config seam**: F2 lo marca "already native, no change needed", pero bajo B su razón de ser en ADR 0010 (registrar el MCP) queda desactivada: cambia o desaparece.
- **MCP/cross-agent**: la recomendación deja el adapter "only if non-OpenCode clients stay a goal". Con la directiva de exclusividad V2, ADR 0011 debería decidirlo (drop + trigger de revisión, no condicional).
- **Presupuesto de contexto**: riesgo 6 agenda re-medir ADR 0006; conviene declararlo gate de la wave de tools nativos.

### Merge
- La rama trae claim commit (`3b68875`) + 2 commits docs → **merge commit, nunca squash**. `origin/opencode2` avanzó 23 commits desde el corte (merge-base `a8c15ef`, tip `5fad829`); GitHub lo da MERGEABLE y CI verde sobre `fad6ead`.
- No marcar `done` (el item sigue `in_progress` en la rama).

**Recomendación final: NO-MERGE hasta resolver #1 y #2 (con #3-#5 en el mismo pase); después, merge con merge commit.** El resto del doc (D1/D2, F3.1, riesgo, outline) está bien y no necesita rediseño.

### 2026-09-19 @Arggon
## Re-review PR #367 — head `2ff248c` ("review rework") — veredicto final

**Veredicto: NO-MERGE por un último pase de erratas puntuales (no estructurales).** El rework cubre los hallazgos anteriores (mapa completo, inventario, citas, prosa, follow-ups). Lo que queda son 3-4 correcciones de texto/factualidad en el doc; con ellas, merge.

### Lo verificado OK
- **F2 ya no omite capacidades shipped.** Contrasté la lista real de comandos (`cli/src/cli.ts`: hello, init, doctor, adopt, create, list, next, show, report, update, priority, comment, handoff, import-issues, validate, spec, stack, playbook, branch, start, cleanup, board, sync, instructions, mcp) y los 9 tools MCP (`cli/src/mcp-server.ts`: list/create/update/comment/handoff/show/next/report/validate): todas tienen fila o están cubiertas (hello dropped; mcp → ver errata 2c). `comment`/`handoff`, `sync`/`import-issues`, `adopt`, `cleanup`, `branch`, `instructions`, `priority` (+migrate) y config seam están ahora en la tabla.
- **F1 completo**: Sharing (13), Compaction/context (14), API/client/SDK (15), drift renumerado (16).
- **Citas corregidas**: nesting → tools (F1.2); `ctx.storage` durable vs memory del CLI/TUI (F1.8); `browser` desktop/Code Mode (F1.5); `ctx.event.subscribe` (F1.8). Spot-check de las nuevas: **compaction** correcta (config `keep` + hook "checkpoint summaries"); **API/client** correcta (`@opencode/client` "types and methods are generated from the same contract as the API reference"; `context.client` puede llamar al server remoto) salvo fuentes (errata 3).
- **Riesgo F4.7** (guarded `@opencode/plugin` / dependency-less) correcto y con la referencia al playbook.
- **Items nuevos con calidad**: `task-native-adr-0011` (parent `native-redesign`, p0, contexto + acceptance de 4 cajas) y `task-playbook-opencode-2-0-10` (parent `story-tech-playbooks`, p2, contexto + acceptance). Parents válidos, sin solapamiento (el gotcha 2.0.8 ya está `done`; este es el re-probe 2.0.10). Observación, no bloqueante: `story-tech-playbooks` está `done` y es el único hijo abierto; la convención lo permite (parent status independiente, sin rollup) y `validate` da 0 warnings, pero el propio item se justifica como "version discipline" del programa native — si el coordinador prefiere, `native-redesign` es el hogar natural.
- **Tensiones abiertas para ADR 0011**: añadidas y correctas (bootstrap + criterios B→A, kernel-as-library vs vendored, config seam, MCP drop/condicional, re-medición ADR 0006, pin del playbook).
- **Gates**: `arggon validate` ok (0 warnings); lint limpio; prettier OK en los 3 archivos; **1293/1293 tests**; CI `cli` verde en `2ff248c` (run 35474355835). Docs-only → smoke exento.
- **Historia**: claim `3b68875` + 3 commits docs + 2 items; merge commit, nunca squash. `origin/opencode2` avanzó 23 commits (tip `5fad829`); PR MERGEABLE.

### Erratas a corregir (último pase)
1. **F1.13 Sharing contradice la fuente.** La página V2 dice literalmente "OpenCode V2 does not support session sharing yet"; el doc dice "Session sharing exists as a surface". Reescribir a "Sharing: no soportado en V2 todavía (inerte); ADR 0010 no se apoya en él; sin impacto en el tracker".
2. **Filas F2 incorrectas o duplicadas** (el resto de la tabla está bien):
   - `migrate` (convention versions): **no existe** ese comando; el único `migrate` es `priority migrate` (`cli.ts:1019`), ya incluido en la fila `priority (+ migrate)`. Eliminar la fila o fusionarla.
   - `Status panels (status/refresh)`: `status`/`refresh` son subcomandos de **`playbook`** (`cli.ts:1818,1915` — freshness y post-re-research), ya cubiertos por la fila "Spec/ADR/plan/exploration docs"; no son paneles de estado del tracker. Eliminar o renombrar la fila y corregir el mapeo a TUI.
   - "**`mcp` is covered by the MCP row**": en F2 **no hay** fila MCP. Añadir fila explícita (`arggon mcp` stdio → adapter opcional; drop por defecto) o reescribir "covered by the MCP decision (D3/F3.1)".
   - Pre-existente, misma clase: la fila "Spec/ADR/plan/exploration docs" lista `CLI `spec`/`adr`/`explore`/`playbook``, pero **`arggon adr` no existe** (`arggon adr --help` → help general; tampoco en `origin/opencode2`). Los ADRs se autoran desde plantilla; quitar `adr` de la lista o anotar "manual/plantilla".
3. **Referencias obsoletas y fuentes**:
   - Línea 22: "drift recorded in **F1.13**" → **F1.16**.
   - F1.16: dice que el pin refresh es "a follow-up outside this audit's diff", pero el item ya viene **en este PR**; referenciar `task-playbook-opencode-2-0-10`.
   - F1.15: el path documentado es `/v2/openapi.json` (el `/openapi.json` desnudo también responde 200, pero la fuente enlaza el de `/v2`); "SDK for embedding" no tiene fuente (añadir `build/sdk`); `context.client` está documentado en la página de plugins CLI/TUI, no en `api`/`build/client` (añadir esa fuente).
4. Opcional (no bloquea): `task-native-adr-0011` podría declarar `depends_on: task-native-capability-audit` para que `next` no lo sugiera antes de que este audit cierre; y la nota del item audit podría apuntar a `task-playbook-opencode-2-0-10`.

**Recomendación final: NO-MERGE hasta aterrizar las erratas 1-3 en un commit de texto (sin re-revisión completa: son cambios literales); después, merge con merge commit. No marcar `done`.**
