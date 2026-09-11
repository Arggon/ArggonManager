---
plan_id: plan-sync-001
title: Plan de implementación para arggon sync (issue #52)
spec: docs/specs/spec-sync-001.md
status: proposed
created: 2026-09-10
---

# Plan: arggon sync

Derivado del spec `docs/specs/spec-sync-001.md`. Cada tarea tiene criterio de aceptación verificable y enlaces al spec.

## Tareas

### T1: Estructuras de datos y tipos de output

**Descripción:** Definir y exportar los tipos/interfaces de datos que usa sync: `SyncResult`, `SyncMatch`, etc.

**Criterio de aceptación:**
- [ ] Los tipos `SyncResult`, `SyncMatch`, `SyncError` están definidos en un módulo `sync-types.ts` (o similar)
- [ ] El tipo `SyncResult` tiene los campos de la sección 6 del spec
- [ ] Existe un test unitario que valida la estructura del tipo

**Verificación:** leer el archivo de tipos y el test.

---

### T2: Función helpers para consultar PRs del repo

**Descripción:** Implementar función que, dado un repo (owner/repo o extraído del remoto local), devuelve la lista de PRs abiertos con sus `headRefName` y números.

**Criterio de aceptación:**
- [ ] Función `getOpenPRs(repo: string): Promise<PRInfo[]>` donde `PRInfo` tiene `{number, headRefName, title, url}`
- [ ] Usa `gh api` o `gh pr list` para obtener los datos
- [ ] Maneja caso de gh no disponible (lanza error con mensaje útil)
- [ ] Maneja caso de repo no encontrado (lanza error)
- [ ] Test con mock de `gh` que verifica la estructura del resultado

**Dependencia:** T1 (tipos)

---

### T3: Función de matching entre items y PRs

**Descripción:** Implementar función que dado un item y una lista de PRs, determina si hay match, ambigüedad, o sin match.

**Criterio de aceptación:**
- [ ] Función `matchItem(item, prs): Promise<MatchResult>` donde `MatchResult` es `{status: 'matched'|'pending'|'no_pr'|'ambiguous', pr?: PRInfo, prs?: PRInfo[]}`
- [ ] La función implementa la lógica de matching definida en sección 3 del spec
- [ ] Test con casos: matched único, pending (sin branch pero con PR), no_pr (sin PR), ambiguous (2+ PRs con mismo headRefName)
- [ ] La función NO modifica el item, solo determina el match

**Dependencia:** T1 (tipos)

---

### T4: Implementar sync --check (solo read)

**Descripción:** Implementar el comando `arggon sync --check` que lee los items, consulta los PRs, y reporta sin modificar.

**Criterio de aceptación:**
- [ ] El comando `arggon sync --check` está registrado en el CLI
- [ ] Lee todos los items de tasks/ con branch field
- [ ] Consulta los PRs del repo
- [ ] Para cada item, determina el match usando T3
- [ ] Imprime el reporte legible (sección 8 del spec)
- [ ] Imprime JSON si --json (sección 6 del spec)
- [ ] Exit code 0 cuando 0 pending y 0 ambiguous; 1 cuando hay pending o ambiguous
- [ ] GitHub no disponible → error manejado con mensaje claro (no crash)
- [ ] Test de integración: repo con items y PRs mock que verifica los escenarios de la sección 4 del spec
- [ ] Test de integración: GitHub no disponible maneja error correctamente

**Dependencia:** T1, T2, T3

---

### T5: Implementar sync --write (modifica items)

**Descripción:** Implementar el comando `arggon sync --write` que rellena branch vacío de items con match único.

**Criterio de aceptación:**
- [ ] El comando `arggon sync --write` está registrado en el CLI
- [ ] Lee items y PRs (reusa T2, T3)
- [ ] Para cada item con branch vacío y match único, setea el branch usando update.js (o función equivalente)
- [ ] NO modifica items con branch ya seteado (incluso si hay match)
- [ ] NO rellena en caso de ambigüedad
- [ ] Imprime reporte legible de lo que hizo (qué items filled, qué no)
- [ ] Imprime JSON si --json (con campo `filled`)
- [ ] Exit code 0 cuando todo se pudo hacer; 1 cuando hay ambigüedad o error
- [ ] Test de integración: escenario de write exitoso (ver sección 4.3 del spec)
- [ ] Test de integración: write no modifica branch existente (ver sección 4.4 del spec)
- [ ] Test de integración: write no rellena en ambigüedad (ver sección 4.4 del spec)
- [ ] Test de integración: write reporta unmatched (sin branch, sin PR)

**Dependencia:** T1, T2, T3, T4

---

### T6: Detección de repo GitHub

**Descripción:** Implementar función que detecta el repo GitHub del local a partir del remoto, o falla con mensaje claro.

**Criterio de aceptación:**
- [ ] Función `detectRepo(cwd): Promise<{owner, repo} | null>` que lee el remote origin y parsea owner/repo
- [ ] Maneja caso de no git repo (null o error)
- [ ] Maneja caso de remote no GitHub (null o error)
- [ ] Respeta --repo explícito si se pasa
- [ ] Test con mock de git remote

**Dependencia:** T1

---

### T7: Registro del comando en CLI

**Descripción:** Registra `arggon sync` como comando en el CLI principal.

**Criterio de aceptación:**
- [ ] `arggon sync --help` muestra la ayuda del comando
- [ ] `arggon sync` sin flags ejecuta --check por defecto
- [ ] `arggon sync --write` ejecuta modo write
- [ ] `arggon sync --json` emite JSON
- [ ] Los flags son mutually exclusive (no se pueden combinar --check y --write)

**Dependencia:** T4, T5

---

## Orden sugerido

1. T1 (tipos) — base para todo
2. T6 (detección de repo) — necesaria para T2
3. T2 (consultar PRs) — necesaria para matching
4. T3 (matching) — lógica central
5. T4 (sync --check) — read-only, más seguro para empezar
6. T5 (sync --write) — modifica archivos, hacer después de validar check
7. T7 (registro CLI) — ecco la funcionalidad al usuario

## Estrategia de testing

- Tests unitarios para T2, T3, T6 (con mock de `gh` y git)
- Tests de integración para T4, T5: crear un directorio temporal con estructura tasks/ y ejecutar el comando con datos de prueba
- Para los tests de integración con GitHub, usar mock de `gh` (p.ej., mock de la función que ejecuta `gh`) o un test repo GitHub real pequeño si es posible
- Cada test debe verificar observable (stdout, exit code, efecto en archivos), no implementación interna

## Verificación post-implementación

Usar el skill `spec-driven-review` Fase B para cada afirmación del spec (secciones 4, 5, 6, 7, 8):
1. Ejecutar el comando con los escenarios definidos
2. Verificar resultado observable contra lo especificado
3. Registrar PASS/FAIL

---

## Acuerdo

Este plan es la guía de implementación hasta que se acuerde su modificación. Si surge necesario cambiar el orden o agregar tareas, se revisa este plan primero.
