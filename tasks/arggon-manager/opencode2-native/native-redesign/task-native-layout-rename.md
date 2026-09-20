---
type: task
status: todo
id: task-native-layout-rename
title: "Layout rename: ArggonManager/ root + docs"
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
depends_on: [task-native-layout-decision]
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-layout-rename.md
  Leaves live only under a story. id is the filename stem: task-native-layout-rename.
  CLI `arggon create task native-layout-rename` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Layout rename: ArggonManager/ root + docs

## Context

Executes ADR 0012 (accepted 2026-09-19): tracker root `tasks/` →
`ArggonManager/`; all product docs under `ArggonManager/docs/`; legacy
auto-detection + migration, no hard break.

## Acceptance

- [ ] Kernel/convention: root constant and detection (`paths.ts`), convention
      docs, templates, init seam, doctor/board/CLI/MCP messages updated.
- [ ] Legacy `tasks/` auto-detected; the migration command moves the tree and
      docs (idempotent, provenance-safe) and `validate` reports the legacy
      location.
- [ ] This repo dogfoods the rename (`tasks/` → `ArggonManager/`, `docs/` →
      `ArggonManager/docs/`) with internal links updated.
- [ ] Full suite + lint + `validate` green; convention version bumped with
      migration notes.
- [ ] No hard break: an existing `tasks/` tree still works until migrated.
- [ ] Docs-migration scope pinned before the sweep: `docs/assets`, labs/runbooks,
      root meta-docs, and package `templates/docs/**` are each classified
      (move vs stay).
- [ ] Plan frontmatter `spec:` pointer and internal links updated after the
      move.

## Notes

- Blocks W1 (`task-native-kernel-lib`), which extracts the kernel after the
  layout is stable.

### 2026-09-20 @Arggon
### Review PR #371 — task-native-layout-rename (W0, ADR 0012) — 2026-09-20

Alcance: head `f66affb` vs base `opencode2` (469 archivos, +4802/−3056). Leí ADR 0012, el item (ticks + comentarios) y los 4 commits (e5067f1 kernel/seam, e558d38 migración+tests, e6dfd6b dogfood, 887d64a barrido). No marqué done.

**Verificado OK (evidencia):**
- CI `cli` pass en el head (run 35491298989). Local: `npm test` 1329/1329 (81 files), `lint` y `build` limpios; `validate` → `{layout:"arggon-manager", warnings:[]}`; `spec validate` ok; `spec audit` ok; `doctor` → `{dir:"ArggonManager",layout:"arggon-manager"}`.
- **No hard break**: con el CLI nuevo contra el repo primario (aún legacy en `tasks/`): `validate` ok + warning `LEGACY_LAYOUT`, `list`/`next` operan sobre `tasks/`, `doctor` → `{dir:"tasks",layout:"legacy"}`. `init --full` en fixture legacy actualiza in-place (docs en `<root>/docs`, no crea `ArggonManager/`).
- **Migración**: mueve tracker+docs, bump 3→5, reescribe x-generated, preserva bytes; 2ª corrida `alreadyMigrated`; dry-run no escribe (unit tests + probe real); convergencia de half-move; refusals (dos trackers / dest existente / dos docs) OK.
- **.convention.yml sin pérdida**: mismas keys x-generated, solo `docs/*` → `ArggonManager/docs/*` (+deploy.md nuevo); projectName preservado; 28/34 entradas matchean checksum y las 6 divergentes son las acked-drifted esperadas.
- **Historia**: `git log --follow` sigue items y docs a través del move; el move detecta R100/R<100, sin A/D sospechosos.
- **Barrido**: `spec:` pointers de plans → `ArggonManager/docs/specs/...`; `.opencode` sin refs viejas; auto-done `git add ArggonManager/`; skills/smoke/descriptions MCP/plugin actualizados; los links de docs vivas resuelven (link-checker sobre 541 .md; falsos positivos solo en templates, que se renderizan en otra ruta).
- **Plugin**: cambio semántico = guard acepta ambos roots + tests v5/legacy; el resto (~900 líneas) es reformateo prettier. `tsc --noEmit` OK y sus unit tests pasan en la suite.

**Hallazgos (orden de severidad):**

1. **[MEDIA-ALTA] `arggon report --trend` queda corrupto después de `migrate --layout`** — `cli/src/trend.ts:63-84` mina `git log -p -- <root nuevo>`; con pathspec git muestra cada archivo movido como `new file` (sin rename detection) y no recorre la historia bajo `tasks/`. Repro mínimo (fixture git en /tmp/opencode/trend-repro): antes de migrar → `weeks:[{2026-W36,1}]`, `cycleTime:[{task,1d,count:1}]`; después → `weeks:[{2026-W38,1}]` (la completion se atribuye al commit de migración) y `cycleTime:[]`. En este repo: worktree → `[{W38:255}]` + cycleTime bug 1; legacy con el mismo historial → `[{W36:1},{W37:98},{W38:156}]` + bug 31/story 9/task 135; `git show e6dfd6b -- ArggonManager | grep -c '^+status:'` = **311** (sin pathspec = 0). No hay test de root-rename (`trend.test.ts:254` solo cubre rename intra-tracker). Fix verificado en el repro: incluir el path legacy en el pathspec cuando el layout es v5 (`-- ArggonManager tasks` recupera los 4 commits y sus `rename from`; +status correctos) + test migración→trend.

2. **[MEDIA] `arggon init --propose` es no-op silencioso para docs en árboles legacy** — `cli/src/init.ts:625` (`planProposals`) usa `currentGeneratedTemplates()` sin layout (canonical v5): los dest `ArggonManager/docs/**` no existen en legacy → skip por `existsSync`; `TIER2_DESTS.has(dest)` compara contra el set canonical. Repro: fixture legacy con `docs/tracking.md` editado + estado x-generated → `init --propose --json` = `proposals: []` (también con `--full`); el mismo fixture en v5 → propone `ArggonManager/docs/tracking.md` (+10/−1). Fix: resolver el layout en `planProposals`/`applyProposals` y usar `currentGeneratedTemplates({layout})` + gating tier-2 sobre el dest canonical.

3. **[BAJA-MEDIA] 22 links relativos en cuerpos de items rotos por el move** — 14 archivos bajo `ArggonManager/arggon-manager/opencode2/**` (story-opencode-v2 y task-opencode2-*; ej. `task-opencode2-dogfood.md`, `task-opencode-v2-spec.md`, `story-opencode-v2.md`) con `../../../../docs/...`, que antes resolvían a `<root>/docs` y ahora apuntan a un root sin `docs/`. Link-checker base vs head: 1 roto de esa familia vs 23. Fix mecánico: `../../../docs/...` (3 subidas = `ArggonManager/docs`) o `../../../../ArggonManager/docs/...`.

4. **[BAJA] Residuales del barrido en docs/templates** —
   - `templates/docs/github/copilot-instructions.md` sigue con `[AGENTS.md](../../AGENTS.md)` (roto al renderizar en `.github/`; debe ser `../AGENTS.md`), mientras la copia generada `.github/copilot-instructions.md` fue corregida a mano a `../AGENTS.md` → la copia ya no matchea su template (doctor: outdated) y todo adopter recibe el link roto en el próximo init.
   - README: `(0-3)` en línea 221 (ahora v5); tier-2 listado como `docs/convention.md` / `docs/runbooks/README.md` / `docs/deploy.md` (172-173); inventory de adopt con paths viejos (242); textos de link `[docs/convention.md]` (cosmético, href correcto).

**No pude verificar:** carga real del plugin dentro de una sesión OpenCode (solo tsc + unit tests; no corrí `smoke:opencode`); smoke con navegador (no aplica a este PR).

**Decisiones de producto a confirmar explícitamente (no bloquean por sí solas):**
1. `migrate --layout` mueve TODO `<root>/docs/` a `ArggonManager/docs/` (convergencia), incluso si el repo no tuvo tracker legacy, sin preguntar; nunca auto-commitea y está documentado. Confirmar que es la semántica deseada para adopters con un `docs/` ajeno.
2. Clasificación pineada en el item: root meta-docs (README/AGENTS/CONTRIBUTING/SECURITY/SUPPORT/ARCHITECTURE/CHANGELOG), `.github`, `.opencode`, `templates/`, `fixtures/`, `labs/` se quedan; el resto dentro. ADR 0012 §2 dice "all product docs under ArggonManager/docs/" — el item lo interpreta así y coincide con el brief de review; que quede explícito en el ADR/comentario.

**Nits no bloqueantes:** el reformateo prettier del plugin (`opencode/plugins/arggon/index.ts`, ~900 líneas) es ruido de alcance (el cambio funcional es 1 línea + tests); el comentario del item dice "79 files" y son 81; `layout-migrate.ts:88` (`trackerDir !== legacyDocsDir`) es comparación muerta.

**Recomendación: NO MERGE todavía** hasta que (1) y (2) estén **arreglados en el PR o fileados como items con repro y acceptance** (AGENTS.md: ningún finding accionable queda sin item antes del merge); (3) y (4) pueden ir en el mismo barrido o como follow-up. El resto del PR está sólido: kernel/detección/seam, migración idempotente y dogfood cumplen ADR 0012. Al mergear: **merge commit, nunca squash** (la rama lleva auto-commits del tracker).
