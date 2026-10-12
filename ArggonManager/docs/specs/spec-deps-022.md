---
spec_id: deps-022
title: Dependency graph — depends_on, blocked_by y next --ready (convención v3)
status: implemented
created: 2026-09-11
adr: ArggonManager/docs/adr/0004-milestone-deps-v3.md
---

# Spec: dependency graph (deps-022)

> **Renumber note (2026-10-11):** originally filed as `spec-deps-001` in collision with `spec-sync-001.md` (task-renumber-colliding-doc-numbers); renumbered to the next FREE spec number (022). Renumbered the fewer-referenced of the pair — one inbound reference (`plan-deps-019.md`, updated in kind) versus the other spec's two — the ADR 0024 precedent. Spec content unchanged.
>
> **Update (2026-10-11):** section 5 (`Especificación de errores`) added by task-spec-deps-022-no-error-path — the pre-existing `no-error-path` finding was inherited by this file at the renumber and is now fixed, not baselined. Later sections renumbered in kind (contrato JSON 5→6, aceptación 6→7); no behavior change.

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

## 5. Especificación de errores

| Condición                                                                                    | Superficie | Mensaje (`error.code`)                                                                                  | Exit code |
| -------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- | --------- |
| `--add-depends-on` vacío o solo espacios                                                     | `update`   | `--add-depends-on requires a non-empty item id` (`UPDATE_FAILED`)                                       | 1         |
| `--depends-on` / `--add-depends-on` con un id inexistente                                    | `update`   | `depends_on id '<id>' does not resolve to an existing item` (`UPDATE_FAILED`)                           | 1         |
| Un ítem depende de sí mismo                                                                  | `validate` | `item '<id>' depends on itself` (error `SELF_DEPENDENCY`)                                               | 1         |
| Un `depends_on` no resuelve a ningún ítem                                                    | `validate` | `depends_on id '<id>' does not resolve to an existing item` (error `UNKNOWN_DEPENDENCY`)                | 1         |
| Ciclo en el grafo                                                                            | `validate` | `dependency cycle: a -> b -> a` (error `DEPENDENCY_CYCLE`)                                              | 1         |
| Token de filtro mal formado (`blocked-by:` sin valor, campo desconocido, comilla sin cerrar) | `list`     | `bad filter token ...` / `unknown filter field ...` / `empty value in filter token ...` (`LIST_FAILED`) | 1         |

Lo que ve y debe hacer el caller:

- **Un fallo de `update` no escribe nada.** El chequeo de los ids ocurre antes de
  la mutación del ítem, así que el árbol queda intacto: el caller corrige la
  lista de ids (con `arggon list`) y reintenta el comando.
- **`validate` reporta todo el grafo en una pasada.** Los errores llegan en
  `errors[]` (`{ path, message, code }`), con `ok: false` y el envelope
  `error.code: "VALIDATE_FAILED"`. El caller corrige los edges nombrados y
  re-valida; cada ciclo se reporta una vez, anclado en el miembro
  lexicográficamente menor, con la cadena canónica. **Qué subconjunto de ciclos
  se nombra depende del orden de recorrido** (selección por bosque DFS): el
  caller debe confiar en el veredicto y en las cadenas reportadas, nunca en la
  presencia o ausencia de un ciclo particular (docs/convention.md §Dependency
  graph (v3)).
- **Bloqueo no es un error.** Las dependencias son advisory (ADR 0004): las
  abiertas jamás fallan un `update`. Un ítem bloqueado es un estado de ranking,
  no un fallo — `next` lo sugiere al final con el `reason` que nombra la cadena
  de bloqueo, y `--ready` lo excluye.
- **Un grafo roto degrada las consultas, no las rompe.** Un id desconocido
  cuenta como abierto, así que el ítem queda sin ready en lugar de romper
  `next`; las pasadas inversas (`downstreamWeight`, índice `blocked_by`) usan
  un set de visitados, así que un ciclo no cuelga ninguna consulta. El grafo
  roto lo denuncia `validate`, no `next`. Sin pool, `suggestion` es `null` con
  `ok: true` — reporte, no fallo.
- **La ausencia del campo no es un error.** Un árbol v0–v2 sin `depends_on`
  valida limpio: el campo se ignora (no se borra), así que nada que migrar.

## 6. Contrato JSON

- `WorkItem.depends_on: string[]` (aditivo dentro de `schemaVersion: 1`).
- `next` gana `blockedBy: string[]` dentro de `suggestion` (ids abiertos) y el
  `reason` menciona la cadena de bloqueo.

## 7. Aceptación

- [x] Un ítem con `depends_on` abiertos no es sugerido por `next` (o queda último con `--all`); `--ready` lo excluye
- [x] Ciclos y refs rotas fallan `validate` con los códigos de la sección 4
- [x] `update --depends-on` reemplaza la lista; vacío limpia; ids desconocidos fallan en update también
- [x] Árboles v0-v2 sin el campo siguen validando limpio
- [x] Board estático y `--serve` muestran las dependencias abiertas
- [x] La sección 5 documenta los errores de cada superficie: el mensaje que ve el caller, su `error.code` y exit code, y qué debe hacer
