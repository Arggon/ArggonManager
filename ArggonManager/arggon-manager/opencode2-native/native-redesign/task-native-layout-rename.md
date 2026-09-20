---
type: task
status: in_progress
id: task-native-layout-rename
title: "Layout rename: ArggonManager/ root + docs"
assignee: Arggon
branch: feat/task-native-layout-rename
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T00:12:33.377Z"
depends_on: [task-native-layout-decision]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-layout-rename
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
