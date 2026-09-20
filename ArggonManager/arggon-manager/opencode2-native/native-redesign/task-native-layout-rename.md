---
type: task
status: done
id: task-native-layout-rename
title: "Layout rename: ArggonManager/ root + docs"
assignee: Arggon
branch: feat/task-native-layout-rename
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
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

- [x] Kernel/convention: root constant and detection (`paths.ts`), convention
      docs, templates, init seam, doctor/board/CLI/MCP messages updated.
- [x] Legacy `tasks/` auto-detected; the migration command moves the tree and
      docs (idempotent, provenance-safe) and `validate` reports the legacy
      location.
- [x] This repo dogfoods the rename (`tasks/` → `ArggonManager/`, `docs/` →
      `ArggonManager/docs/`) with internal links updated.
- [x] Full suite + lint + `validate` green; convention version bumped with
      migration notes. (CI on PR #371: `cli` pass.)
- [x] No hard break: an existing `tasks/` tree still works until migrated.
- [x] Docs-migration scope pinned before the sweep: `docs/assets`, labs/runbooks,
      root meta-docs, and package `templates/docs/**` are each classified
      (move vs stay).
- [x] Plan frontmatter `spec:` pointer and internal links updated after the
      move.

## Notes

- Blocks W1 (`task-native-kernel-lib`), which extracts the kernel after the
  layout is stable.

### 2026-09-20 @Arggon
W0 evidence (PR #371, branch feat/task-native-layout-rename).

COMMITS: 61d6231 claim · e5067f1 kernel/detection/docs seam+convention v5 · e558d38 `migrate --layout`+no-hard-break tests · e6dfd6b dogfood move (git mv tasks/->ArggonManager/, docs/->ArggonManager/docs/, .convention.yml migrated 3->5 + x-generated rewrite, init --full regenerated untouched artifacts, +ArggonManager/docs/deploy.md) · 887d64a repo-wide reference sweep (root docs, .github/auto-done stages ArggonManager/, .opencode, skills, smoke, plugin+tests, living docs, spec/plan pointers) · ce0ed50 acceptance ticks.

GATES (final tree): npm test 1329 passed (79 files) · npm run lint clean · npm run build clean · argon validate ok (0 warnings, convention v5) · argon spec validate ok (18 docs) · CI `cli` on PR #371: pass.

SMOKE (legacy fixture, expected vs observed): validate --json on legacy tasks/ -> {ok:true, layout:"legacy", warnings:["LEGACY_LAYOUT"]}; list works on tasks/launch/launch.md. migrate --layout --dry-run -> {changed:true, versionBump:{3->5}, rewrites:[docs/tracking.md -> ArggonManager/docs/tracking.md]} writing nothing. migrate --layout -> moved tracker+docs, bumped version, rewrote x-generated; validate -> {layout:"arggon-manager", conv:5, warnings:0}; second run -> {alreadyMigrated:true, changed:false}. In-repo probes: doctor tracker {dir:"ArggonManager", layout:"arggon-manager"}; instructions source ArggonManager/docs/agents.md; board/next/report/spec audit green; MCP argon_validate -> {ok:true, layout:"arggon-manager", warnings:[]}.

DECISIONS (within ADR 0012): (1) command shape `argon migrate --layout [--dry-run]`, converges+idempotent, never auto-commits, refuses ambiguous states (two trackers / two docs trees) instead of guessing; (2) detection prefers ArggonManager/ then falls back to tasks/, per-level walk-up; (3) convention number v5 (v4 stays the priority field) with migration notes in ArggonManager/docs/convention.md; (4) `<tracker>/docs/` reserved for product docs, skipped by item walkers; (5) docs classification: moved = everything under root docs/ (assets, labs, runbooks, specs/plans/adr/explorations/playbooks, claim/viewer-spike/opencode2); stayed = root meta-docs (README/AGENTS/CLAUDE/CONTRIBUTING/SECURITY/SUPPORT/ARCHITECTURE/CHANGELOG), .github/**, .opencode/**, .agents/**, skills/, templates/** (package material), fixtures/** (legacy fixtures), labs/**; (6) validate reports legacy as a warning + additive `layout` field, never an error; doctor tracker gains dir/layout.

OBSERVATIONS for review: doctor shows 6 acknowledgedDrifted (hand-edited acked baselines) + 9 outdated (hand-curated docs whose templates changed) — informational, never regenerated. Legacy fixtures keep tasks/ on purpose (no-hard-break coverage).

### handoff 2026-09-20 @Arggon — next: Coordinator review of PR #371 (use git show -M for the move commit); then merge with a MERGE commit (tracker auto-commits are on the branch) and flip the item done after merge verification.
- branch: feat/task-native-layout-rename
- open questions: None blocking. Confirm the v5 convention-number choice (v4=priority, v5=layout) and the docs classification in the item comment; CI already green.

### 2026-09-20 @Arggon
Review fixes (PR #371 head 3103a44, CI cli pass).

F1 [MEDIA-ALTA] trend tras migrar — ff1b09b: pathspec `ArggonManager tasks` en v5 (git incluye commits pre-move + rename records, re-anclados por el mapa de renames existente) y exclusion del docs dir del tracker (sus ejemplos de frontmatter type/status se minaban como transiciones — detectado al reproducir tu repro). Repo real: worktree antes [{W38:255}]+bug 1; despues [{W36:1},{W37:98},{W38:156}]+bug 31/story 9/task 135 = identico al baseline legacy del primary. Test de regresion: falla si se quita cualquiera de las dos mitades.

F2 [MEDIA] init --propose en legacy — 4e52dd5: planProposals resuelve el layout y mapea dests legacy al set canonico para el gate tier-2. Probe en fixture legacy: proposals [{dest:"docs/tracking.md",decision:"proposed",path:"docs/tracking.md.proposed-0.3.0",mode:"whole-file"}]; con --full anade docs/convention.md; originales intactos, side files junto a los originales. Test anadido (falla sin el fix).

F3 [BAJA-MEDIA] links de items — 45e198a: 31 links relativos en 22 archivos reescritos a la profundidad correcta (familia ../../../docs/...). Link-check del tracker completo: 0 rotos (antes 32, 1 pre-existente).

F4 [BAJA] residuales — 45e198a + nit del plugin en 3103a44: template copilot-instructions ../../AGENTS.md -> ../AGENTS.md (copia generada y template sin drift); README (0-5), listas tier-2, inventory de adopt, ejemplos spec y textos de link a ArggonManager/docs/...; eliminada la comparacion muerta layout-migrate.ts trackerDir !== legacyDocsDir. Plugin: restaurado el formato original — diff 3+/2- + tests (antes ~900 lineas de ruido prettier), copia generada y checksum x-generated refrescados.

GATES en 3103a44: npm test 1331 passed (+2 tests de regresion) · lint limpio · build limpio · argon validate ok (0 warnings, v5) · argon spec validate ok (18 docs) · CI cli pass.

INTERPRETACIONES DE PRODUCTO (documentadas en ArggonManager/docs/convention.md, seccion Tracker layout v5): (1) `migrate --layout` mueve TODO <root>/docs/ al tracker root, convergente y sin preguntar por archivo; un repo con docs/ ajeno debe reconciliarlo antes/despues (los estados ambiguos — dos trackers, dos docs trees, destino existente — se rechazan, nunca se fusionan en silencio). (2) Root meta-docs (README/AGENTS/CLAUDE/CONTRIBUTING/SECURITY/SUPPORT/ARCHITECTURE/CHANGELOG) se quedan en la raiz; .github/**, .opencode/**, .agents/**, templates/** (scaffolds empaquetados), fixtures/** y labs/** tampoco son docs de producto y no se mueven.

Sigo in_progress: no marco done; pendiente re-review y merge con merge commit.

### handoff 2026-09-20 @Arggon — next: Re-review PR #371 at head d6d0761 (fixes F1/F2 + F3/F4 in commits ff1b09b, 4e52dd5, 45e198a, 3103a44); if the verdict passes, merge with a MERGE commit (tracker auto-commits on the branch) and flip t…
- branch: feat/task-native-layout-rename
- open questions: Product interpretations confirmed and documented in convention.md + item comment: (1) migrate moves all of <root>/docs/; (2) root meta-docs stay at the repo root. No unresolved critical decisions.

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

### 2026-09-20 @Arggon
### Veredicto final — PR #371 head `2a6fded` (fixes F1–F4) — 2026-09-20

Re-revisé los commits ff1b09b (F1), 4e52dd5 (F2), 45e198a (F3/F4), 3103a44 (nit plugin) y los tracker commits. Worktree intacto en `2a6fded`, sin artefactos.

**Condición 1 — F1 trend: CUMPLIDA.**
- **Baseline reproducido**: worktree v5 `report --trend --json` = primary legacy, idéntico: `weeks [{W36:1},{W37:98},{W38:156}]`, `cycleTime bug 31 / story 9 / task 135` (antes de F1: `[{W38:255}]` + cycleTime bug 1).
- **Repro mínimo propio** (/tmp/opencode/trend-repro, 4 commits + move): post-migración ahora `{W36:1}` + `cycleTime task 1d` (antes `{W38:1}` + `[]`).
- **Test de regresión verificado por mutación** (copia scratch, sin tocar el árbol): quitar `LEGACY_TRACKER_DIR_NAME` del pathspec → el test nuevo falla; quitar la exclusión `:(exclude)ArggonManager/docs` → falla con la semana extra (ejemplo yaml minado). Ambas mitades cubiertas; `trend.test.ts` 23/23 y `init.test.ts+trend.test.ts` 58/58 en el head real.
- **Residual bajo (no bloqueante, requiere seguimiento)**: el pathspec incluye `tasks` siempre, así que un repo v5 con un `tasks/` ajeno con frontmatter item-like suma completions falsas (repro propio: fixture v5 + `tasks/example.md` con `type/status` → `{W38:1}`). Impacto solo en `--trend` y caso raro; sugiero filear bug de seguimiento con guard barato (incluir el path legacy solo si su historia registra `tasks/.convention.yml`).

**Condición 2 — F2 `init --propose` legacy: CUMPLIDA.**
- Probe legacy end-to-end: `proposals [{dest:"docs/tracking.md", decision:"proposed", path:"docs/tracking.md.proposed-0.3.0"}]`; con `--full` añade `docs/convention.md`; originales byte-intactos y no materializa `ArggonManager/`.
- **Test mutante**: revirtiendo el cambio (canonical sin layout) → el test nuevo falla (`expected undefined to be defined`); con el fix pasa.

**F3/F4 — verificado.**
- Link-checker sobre 541 .md: tracker a **0 links roteados** (los 31 reescritos, incluidos los `docs/explorations/...` que ya venían rotos de base); el único match en `ArggonManager/docs/convention.md:129` es un falso positivo (regex en tabla). Los templates restantes resuelven al renderizarse; único roto real `templates/docs/SUPPORT.md -> ../SECURITY.md` es **pre-existente** (idéntico en base; opcional follow-up).
- `templates/docs/github/copilot-instructions.md` → `../AGENTS.md` y coincide con la copia generada (sin drift).
- README: `(0-5)`, tier-2, inventory de adopt, ejemplos `spec new/validate/audit`, `playbook`, `stack explore`, `instructions`, `mcp` y textos de link a `ArggonManager/docs/...`; sin refs stale fuera del árbol anidado correcto.
- `ArggonManager/docs/convention.md` §Tracker layout (v5) documenta alcance de la migración y clasificación (root meta-docs + `.github/.opencode/.agents/templates/fixtures/labs` se quedan) — consistente con ADR 0012 §2 (el ADR enumera lo que se mueve; la convention desambigua el resto). Nit `layout-migrate.ts` eliminado.

**Nit plugin — verificado.** Net vs base: `opencode/plugins/arggon/index.ts` 2+/2- (comentario + guard `ArggonManager || tasks`), `index.test.ts` +20/-3 (2 tests nuevos v5/legacy); la copia generada `.opencode/plugins/arggon/index.ts` y su checksum `x-generated` (`sha256:811cbf…`) matchean.

**Gates en `2a6fded`:** `npm test` **1331/1331** (81 files, +2 tests), lint y build limpios, `validate` v5 (0 warnings), `spec validate` ok, CI `cli` **pass** (run 35492577647, head 2a6fded).

**No pude verificar:** carga real del plugin dentro de una sesión OpenCode (solo tsc + unit tests).

**Recomendación: MERGE.** Sin bloqueantes. Merge con **merge commit (nunca squash)**; filear (o aceptar explícitamente) el residual bajo del trend con `tasks/` ajeno antes/después del merge. No marqué done; el item sigue `in_progress` para el cierre post-merge.
