---
plan_id: spec-pipeline-002
title: Plan de implementación de arggon spec (validate + new)
spec: docs/specs/spec-spec-pipeline-002.md
status: implemented
created: 2026-09-11
---

# Plan: spec pipeline (spec-pipeline-002)

Derivado del spec `docs/specs/spec-spec-pipeline-002.md`.

## T1: Módulo validador (`cli/src/spec.ts`)

- Parser frontmatter tolerante (claves escalares top-level; listas anidadas del
  spec-sync-001 se ignoran, nunca rompen).
- Checks spec/plan por documento + unicidad de `spec_id`/`plan_id`.
- **Aceptación:** los 4 docs reales validan sin errores; un test por código.

## T2: Registro CLI (`cli/src/cli.ts`)

- `arggon spec validate [--file <path>] [--json]` y `arggon spec new <slug>
  [--title] [--plan] [--json]`; envelope v1 con `command: "spec"`, fallos
  `SPEC_FAILED`.
- **Aceptación:** `--json` espeja `validate`; exit code no-cero con errores.

## T3: Plantillas (`templates/spec.md`, `templates/plan.md`)

- Placeholders `{{SLUG}}/{{NNN}}/{{ID}}/{{TITLE}}/{{DATE}}`; fallback embebido
  en el módulo si el archivo no está.
- **Aceptación:** `spec new` renderiza desde la plantilla y su salida valida limpio.

## T4: Tests (`cli/src/spec.test.ts`)

- Happy path contra copias de los docs reales; un caso por código; unicidad;
  `spec new` (numeración, no-overwrite, slug inválido); `--file` fuera de dirs.
- **Aceptación:** suite verde junto con las 446 pruebas existentes.

## T5: Docs

- README (`### arggon spec`), `docs/json-output.md` (enum + payload), una línea
  en `docs/agents.md` §Specs and plans apuntando a `arggon spec validate/new`.
- **Aceptación:** grep de `spec validate` en docs coincide con el comportamiento.
