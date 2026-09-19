---
type: task
status: in_progress
id: task-native-adr-0011
title: "ADR 0011: OpenCode2-native architecture"
assignee: Arggon
branch: feat/task-native-adr-0011
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
claimed_at: "2026-09-19T23:13:57.215Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-adr-0011
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-adr-0011.md
  Leaves live only under a story. id is the filename stem: task-native-adr-0011.
  CLI `arggon create task native-adr-0011` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0011: OpenCode2-native architecture

## Context

Decision task from `task-native-capability-audit` (exploration
`docs/explorations/exploration-opencode2-native-010.md`, 2026-09-19).

The audit recommends candidate B (native-first hybrid): in-process kernel tools
(`ctx.tool.transform`, namespaced + `codemode`), native commands, permissions as
hard gates, the worktree domain, TUI panels/routes, git-native `tasks/` as
canonical data, and a thin headless artifact for bootstrap + CI; MCP optional.

ADR 0011 must decide and record:

- Surface map and the fate of CLI/MCP (drop vs thin adapter).
- Distribution: single npm package (kernel library + plugin + bootstrap bin).
- Migration from the ADR 0010 surface (provenance/init) and which sections of
  0010 it supersedes.
- The audit's open tensions (F3.1/F4): bootstrap artifact form and the B→A
  criteria; kernel-as-library vs dependency-less vendored plugin; config-seam
  content after the MCP demote; MCP adapter drop-vs-conditional; ADR 0006
  re-measurement as the native wave gate.

## Acceptance

- [ ] `docs/adr/0011-*.md` merged, following the ADR format, explicitly
      superseding ADR 0010 §2/§3 and its packaging deferrals.
- [ ] Decision covers D1 (git-native data), D2 (methodology contract kept,
      mechanics native), distribution, migration and revisit triggers.
- [ ] Follow-up spec/plan/wave tasks filed under `native-redesign`.
- [ ] `arggon validate` green; docs-only diff.

## Notes

- Blocks the implementation waves; the product owner confirms D1/D2 through
  this ADR.

### 2026-09-19 @Arggon
### review PR #368 — ADR 0011 (DeepSeek V4.1 Flash, subagente revisor)

**Veredicto: MERGE con merge commit (nunca squash).** Sin hallazgos bloqueantes. Revisión sobre `feat/task-native-adr-0011` (HEAD 1a2e8e1), base `opencode2`.

#### Verificado

- **Formato ADR** (`docs/adr/0011-native-first-architecture.md`): Status/Date/Deciders (L3–5) + Context/Decision/Consequences/Alternatives considered (L10–88), bullets extra (Research/Supersedes/Program) permitidos por `docs/engineering.md#adr-process`. `Proposed` es intencional (confirmación del PO pendiente); no lo tomo como falta.
- **Supersesión explícita**: cabecera L7 y contexto L24–27 superseden parcialmente 0010 §2/§3 + deferrals (native tools, in-process kernel, npm publish), preservando el contrato de **datos** portable y la regla **one logic path**. `docs/adr/0010` L3 → "Partially superseded by ADR 0011 (§2/§3 and its packaging deferrals)"; README filas 0010/0011 añadidas y coherentes entre sí (0010 "Partially superseded by 0011", 0011 "Proposed").
- **Cobertura de la decisión**: D1 git-native canónico + storage como cache (L37–39), D2 contrato de metodología intacto con mecánica nativa (L40–42), distribución single npm package kernel+plugin+bin (L46–49), migración `init`/provenance (L56–57), version policy + **re-medición ADR 0006 como gate de la wave native-tools** (L52–55), **bootstrap B→A como revisit trigger explícito** (L59–63), MCP fuera del camino por defecto con adaptador condicional (L48–49), config seam sin stanza MCP (L50–51). La tensión kernel-as-library queda resuelta en dirección (L43–45); su mecánica (vendoring/dependency-less, F4.7 del audit) se difiere al spec vía `task-native-spec-plan` §Notes — trazable, sin contradicción.
- **Fidelidad al audit 010**: candidato B, D1/D2 recomendados, MCP drop por defecto, worktree domain/TUI/permissions/hooks en el surface map (L31–36); el audit no se contradice en "git-native canonical", "one logic path" ni "MCP dropped".
- **`task-native-spec-plan`** (nuevo, `native-redesign`, p0, todo/sin assignee): contexto correcto (ADR 0011 + exploración 010), acceptance medible (spec, plan de waves con gates, waves con `depends_on`, gate 0006, `validate`+`spec validate`, docs-only) y sin solape con `task-playbook-opencode-2-0-10` (pin 2.0.10, p2) ni con `task-native-capability-audit` (done).
- **Alcance e historia**: diff docs+tracker, 5 archivos, sin código; `claim: task-native-adr-0011` → `docs(task-native-adr-0011): ...`; rama/worktree/claim registrados en el item. Al ser docs-only no aplica probe de CLI ni drive de navegador; el probe relevante (`validate`) se re-ejecutó.
- **Gates re-verificados localmente en el worktree (HEAD 1a2e8e1)**: `arggon validate` ok (0 warnings, convention v3); `npm run lint` limpio; `npm run build` ok; `npm test` → **79 files / 1311 tests passed** (44s); `arggon spec validate` ok (16 docs, informativo). **CI `cli` del PR: pass (1m51s)**.

#### Observaciones (no bloqueantes, en orden)

1. `docs/adr/README.md` sigue omitiendo las filas 0005–0009 (drift previo: el índice solo listaba 0001–0004). Las filas 0010/0011 de este PR son correctas; si se quiere índice completo, es un follow-up trivial fuera del alcance del item.
2. `task-native-spec-plan` no declara `depends_on: task-native-adr-0011`; `next` podría sugerirlo antes de que el ADR esté aceptado. Nit de scheduling (sin precedente en otros follow-ups docs); si el coordinador quiere orden estricto, añadirlo es una línea.
3. 0010 ya registra la supersesión parcial mientras 0011 está `Proposed`: es el flujo acordado, pero el wrap-up del merge debería incluir la confirmación explícita del PO / flip a `Accepted` (engineering.md: "Accepted when merged (or explicitly recorded)") para no dejar 0010 apuntando a un ADR no aceptado.
4. F4.7 (árboles dependency-less y el import guardado del plugin) no figura en las consecuencias del 0011; queda como decisión de spec. Aceptable (la dirección sí está decidida), solo dejo constancia.

#### No verificado / fuera de alcance

- Aceptación del product owner (intencional: `Proposed`).
- Contenido del spec/plan/waves (lo cubre `task-native-spec-plan`).

**Recomendación: merge con merge commit (nunca squash, preservando el claim commit). No marcar `done` en esta revisión; el coordinador completa el flujo y la confirmación del PO.**
