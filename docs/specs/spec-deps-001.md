---
spec_id: deps-001
title: Dependency graph — depends_on, blocked_by y next --ready (convención v3)
status: implemented
created: 2026-09-11
adr: docs/adr/0004-milestone-deps-v3.md
---

# Spec: dependency graph (deps-001)

## 1. Propósito

Dar a `arggon next` criterio real de orden: un ítem está *ready* cuando es un
`todo` reclamable sin asignar y todas sus `depends_on` están terminales
(`done`/`cancelled`). Las dependencias son **advisory**: nunca bloquean un
update, solo gatean sugerencias y consultas. Invariantes heredados:

- El repo (git) es la fuente de verdad; el grafo vive en el frontmatter.
- Misma regla para humanos y agentes; sin SaaS ni IA en el CLI.
- Nunca se toca el estado de terceros salvo la cascada de contenedores ya existente.

## 2. Modelo de datos

- `depends_on: string[]` — ids de ítems de los que depende este; vacío/omitido = nada.
- `blocked_by` es **vista computada** (inversa), nunca almacenada.
- Refs por `id` (globalmente únicos); edges permitidos entre cualquier tipo.
- Convención **v3** (ADR 0004): version-gated; árboles v0-v2 siguen válidos y el
  campo se ignora (pero no se borra) en ellos.

## 3. Synopsis

```bash
arggon update <id> --depends-on "a,b"   # reemplaza la lista (como --labels); vacío limpia
arggon update <id> --add-depends-on c   # agrega un edge
arggon next [--ready]                   # next filtra/ranking por readiness
arggon list --filter "blocked-by:x"     # predicado nuevo (y depends-on:)
arggon board [--group-by milestone]     # edges de dependencias abiertas en tarjetas
```

## 4. Reglas de validación (`validate`)

- `UNKNOWN_DEPENDENCY`: id inexistente en el árbol.
- `SELF_DEPENDENCY`: un ítem depende de sí mismo.
- `DEPENDENCY_CYCLE`: ciclo en el grafo (el grafo debe ser DAG).

## 5. Contrato JSON

- `WorkItem.depends_on: string[]` (aditivo dentro de `schemaVersion: 1`).
- `next` gana `blockedBy: string[]` dentro de `suggestion` (ids abiertos) y el
  `reason` menciona la cadena de bloqueo.

## 6. Aceptación

- [x] Un ítem con `depends_on` abiertos no es sugerido por `next` (o queda último con `--all`); `--ready` lo excluye
- [x] Ciclos y refs rotas fallan `validate` con los códigos de la sección 4
- [x] `update --depends-on` reemplaza la lista; vacío limpia; ids desconocidos fallan en update también
- [x] Árboles v0-v2 sin el campo siguen validando limpio
- [x] Board estático y `--serve` muestran las dependencias abiertas
