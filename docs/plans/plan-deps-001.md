---
plan_id: deps-001
title: Plan de implementación del grafo de dependencias
spec: docs/specs/spec-deps-001.md
status: proposed
created: 2026-09-11
---

# Plan: dependency graph (deps-001)

Derivado del spec `docs/specs/spec-deps-001.md`. Cada tarea tiene criterio de
aceptación verificable; los ítems del árbol son `story-deps-schema` /
`story-deps-queries`.

## T1: Kernel — parsing y contrato (`task-deps-schema-kernel`)

- `depends_on` en `WorkItem` (version-gated), round-trip via extras.
- `WorkItem.depends_on: string[]` en `docs/json-output.md`.
- **Aceptación:** round-trip probado; árboles v0-v2 intactos.

## T2: Validate — grafo DAG (`task-deps-schema-kernel`)

- `UNKNOWN_DEPENDENCY`, `SELF_DEPENDENCY`, `DEPENDENCY_CYCLE` con paths.
- **Aceptación:** un fixture por regla; suite verde.

## T3: Update flags (`task-deps-schema-kernel`)

- `--depends-on <csv>` (replace), `--add-depends-on <id>`; ids desconocidos fallan.
- **Aceptación:** paridad CLI/MCP del envelope con `depends_on`.

## T4: Docs v3 (`task-deps-schema-docs`)

- `docs/convention.md` sección v3 (campos, validación, migración) + json-output.
- **Aceptación:** grep de `depends_on` en docs coincide con el comportamiento.

## T5: `next --ready` + filtros (`task-deps-next-ready`)

- Ranking por readiness; predicados `depends-on:`/`blocked-by:` en el parser.
- **Aceptación:** `next` sugiere solo no-bloqueados con deps abiertas; tests del parser.

## T6: Board edges (`task-deps-board-edges`)

- Línea `↳ blocked by <id>` por dependencia abierta; edges entre columnas.
- **Aceptación:** export self-contained intacto; tests de render.

## Riesgos

- Interacción con la cascada de contenedores: **ortogonal por diseño** (el
  cierre no chequea dependencias, solo subárbol de contención) — cubrir con test.
