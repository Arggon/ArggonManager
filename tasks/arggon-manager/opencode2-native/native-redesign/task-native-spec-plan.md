---
type: task
status: todo
id: task-native-spec-plan
title: "Spec and plan: native-first rebuild waves"
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
depends_on: [task-native-adr-0011]
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-spec-plan.md
  Leaves live only under a story. id is the filename stem: task-native-spec-plan.
  CLI `arggon create task native-spec-plan` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec and plan: native-first rebuild waves

## Context

Follow-up to `task-native-adr-0011` (ADR 0011) and exploration
`exploration-opencode2-native-010`. Produce the contract and the wave plan for
the native-first rebuild under epic `opencode2-native`.

## Acceptance

- [ ] `docs/specs/spec-native-first-<nnn>.md` merged: surface map (tools,
      commands, permissions, worktree domain, TUI, seam), data contract
      (git-native tracker, storage as cache), distribution and migration.
- [ ] `docs/plans/plan-native-first-<nnn>.md` merged: ordered waves with
      per-wave acceptance and gates (kernel-as-library extraction; native
      tools; commands + seam; permissions + worktree domain; TUI board;
      headless bootstrap/CI; dogfood; context re-measurement).
- [ ] Each wave filed as a story/task under `native-redesign`, with
      dependencies reflected in `depends_on`.
- [ ] ADR 0006 re-measurement planned as an explicit wave gate.
- [ ] `arggon validate` and `arggon spec validate` green; docs-only diff.

## Notes

- Keep the exploration's open tensions (bootstrap form and B→A criteria,
  kernel packaging, config-seam content, MCP adapter) as spec decisions.

### 2026-09-19 @Arggon
## Review PR #369 — `feat/task-native-spec-plan` (docs-only, draft, base `opencode2`)

**Veredicto: NO-MERGE por ahora (cambios solicitados, baratos).** El contrato y el plan están bien estructurados, las waves existen con acceptance verificable y la serie está documentada; los gates están verdes. Falta cerrar la coherencia spec↔waves del mapa de superficies antes de mergear.

### Verificado (evidencia)

- **Docs-only**: `git diff --name-status opencode2...HEAD` → 12 archivos, solo `docs/` + `tasks/`; sin cambios de código. Smoke exento (docs-only, `docs/engineering.md`).
- **Gates en el worktree**: `arggon validate` → ok (0 warnings, convention v3); `arggon spec validate` → ok (18 docs); `npm run lint` → 0; `npm test` → **1311/1311 en 79 archivos**; `prettier --check` limpio en los 12 archivos del diff (el árbol completo tiene 405 archivos no-formateados **pre-existentes**: la base `opencode2` marca 407 y CI no corre prettier; el claim del PR es correcto para el diff).
- **`arggon spec analyze`**: 0 findings para `native-first-011` (7 pre-existentes en otros specs).
- **CI**: job `cli` SUCCESS sobre el head `770ad08`; `mergeStateStatus: CLEAN`; `origin/opencode2` == base `3f197e7` (sin drift).
- **Frontmatter/parser**: `depends_on` de las 7 tasks y del item son flow-arrays de una línea; scan de todo `tasks/` sin arrays multilínea; validate verde.
- **Coherencia ADR 0011 / exploration 010**: git-native canónico, un kernel/librería, MCP fuera del seam, plugin vendored single-file dependency-free, paquete npm único, pin 2.0.10, failure isolation, ADR 0006 y migración — presentes y sin contradicciones de fondo.
- **Waves ↔ plan ↔ spec**: T1–T7 alineadas con las acceptance de las tasks; orden serial documentado (`plan:13-15`) con prerequisitos semánticos en `Notes`; sin solape entre waves ni con items abiertos (los adyacentes `task-playbook-opencode-2-0-10` y `task-side-by-side-docs-polish` tienen otro alcance; los items CLI relacionados — worktree cleanup, TUI board, doctor, provenance, npm packaging — están `done`).
- **Historia**: claim `36287a9` → docs `770ad08` (2 commits, merge commit, nunca squash). No marcar `done`.

### Hallazgos (orden de severidad)

1. **Cambio — tools del spec sin dueño en las waves (`sync`/`import-issues`).** `docs/specs/spec-native-first-011.md:62` declara `arggon_sync` y `arggon_import_issues` como tools nativos; `docs/plans/plan-native-first-011.md:27-29` y `tasks/arggon-manager/opencode2-native/native-redesign/task-native-tools.md:25` enumeran solo los otros 10, y ninguna wave los registra (grep: `sync|import_issues` solo aparece en spec:62). El spec además dice que "every other capability is reachable through native tools" (spec:110) y su acceptance exige paridad de **todos** los tools (spec:137). Fix: sumarlos a W2 con su parity test, o declarar su diferimiento/continuidad en el bin con la razón.
2. **Cambio — `adopt` (y `branch`) sin mecanismo ni drop razonado.** El audit F2 y su review exigieron "cada capacidad asignada a un mecanismo nativo o descartada con razón". `arggon adopt` sigue shipped (`npm run arggon -- adopt --help` ok; exploration:166), pero el spec no lo menciona en Tools, Commands ni en el adapter headless (que retiene solo `init`/`validate`/`doctor` + `list`/`show`, spec:106-111). Mismo caso menor: el audit mapea `branch` → `ctx.vcs` + tool (exploration:168) y el spec solo habla del worktree domain (spec:79-84). Fix: asignar `adopt` (command/skill/templates o bin) y nombrar cómo se crea/registra el branch, o declarar el drop con su reemplazo.
3. **Menor — W1 sin `depends_on`.** `task-native-kernel-lib` no declara dependencia (frontmatter, líneas 1-12) y hoy `arggon next --ready --json` ya lo sugiere (`suggestion.id = task-native-kernel-lib`, "...unblocks 6 items downstream") mientras `task-native-spec-plan` sigue `in_progress`. Si ninguna wave debe arrancar antes de este spec/plan, agregar `depends_on: [task-native-spec-plan]` (mismo nit que ya se corrigió en este item para el ADR). Las otras 6 tasks sí tienen una dependencia única.
4. **Menor — gate ADR 0006 de W2.** ADR 0011:54-55 dice que la re-medición ADR 0006 es "the gate of the native-tools wave"; el plan lo repite globalmente (`plan:13-15`) y T7 lo lleva en acceptance (`plan:69`), pero ni T2 (`plan:31-32`) ni `task-native-tools.md:29-32` lo nombran. Sumar `context:report --strict` al acceptance de W2 o dejar explícito que T7 es el dueño.
5. **Nits**: `docs/specs/spec-native-first-011.md:39` "Ctrl+P → argon board panel" → `arggon`; H1 del plan duplica ("# Plan: Plan for..."); B→A criteria solo referenciados en plan/ADR, no en el spec (aceptable, pero el Notes del item pedía dejar las tensiones abiertas como decisiones del spec).

### Lo que no verifiqué

- No aplica smoke de CLI/UI (docs-only). No re-probé el runtime V2 (`opencode v2.0.10`) contra la API real en este review: la coherencia V2 se contrastó contra exploration 010/ADR 0011, no contra la doc live.

### Merge

**Recomendación final: NO-MERGE hasta cerrar #1 y #2** (son cambios de texto chicos; #3–#5 en el mismo pase). Después, merge con **merge commit, nunca squash**. No marcar `done`.
