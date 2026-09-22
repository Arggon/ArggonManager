---
type: task
status: done
id: task-playbook-2-0-10-nits
title: "Playbook 2.0.10 nits: exploration-010 tension + plugin header probe note"
assignee: Arggon
branch: feat/task-playbook-2-0-10-nits
parent: story-tech-playbooks
labels: []
priority: p3
created: "2026-09-20"
updated: "2026-09-22"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-playbook-2-0-10-nits
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tech-playbooks/task-playbook-2-0-10-nits.md
  Leaves live only under a story. id is the filename stem: task-playbook-2-0-10-nits.
  CLI `arggon create task playbook-2-0-10-nits` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Playbook 2.0.10 nits: exploration-010 tension + plugin header probe note

## Context

Non-blocking nits from the PR #373 review (`task-playbook-opencode-2-0-10`):

1. `ArggonManager/docs/explorations/exploration-opencode2-native-010.md` still
   lists the playbook pin refresh in its "Open tensions" section as open; it
   landed in #373 (2026-09-20).
2. `opencode/plugins/arggon/index.ts` header cites only the 2.0.8 A/B re-probe;
   the 2.0.10 re-probe (2026-09-20) is now the current evidence. The plugin was
   out of scope for the docs-only PR; update the comment here (or when W3
   touches the plugin).

## Acceptance

- [x] Pin statements refreshed outside the accepted set: `docs/adr/0011` §7,
      `ArggonManager/docs/specs/spec-native-first-011.md` ("Pinned runtime
      2.0.10") and `ArggonManager/docs/plans/plan-native-first-011.md`.
- [x] `exploration-opencode2-native-010` F4.1 (:244) still says "pin 2.0.10" —
      refresh it with the tensions line.
- [x] `opencode.md:451,458` prettier de-indents 2 continuation lines (base was
      clean) — same family as `bug-formatter-glues-markdown-spaces`.
- [x] The playbook's Context budgets snapshot matches `context:report --json`
      after the W7 trim + PR #384 skill sync (11.821 / 25.275 / 12.995+20.625).

- [x] Exploration 010 "Open tensions" marks the pin refresh as landed.
- [x] The plugin header references the 2.0.10 re-probe date (or points to the
      playbook's research record).
- [x] `arggon validate` green; CI green.

## Notes

- Filed per the review-findings rule; cosmetic.

### 2026-09-22 @Arggon
## Worker evidence — PR #392 (5e22a53 + tracker commits)

Branch `feat/task-playbook-2-0-10-nits`, worktree `../ArggonManager-opencode2-task-playbook-2-0-10-nits`. Draft PR: https://github.com/Arggon/ArggonManager/pull/392 (base `opencode2`).

### 1. exploration-opencode2-native-010

- F4.1 (:244): now "pin 2.0.12 in the playbook (F1.16)".
- "Open tensions": the playbook pin refresh is marked **landed** (2.0.10 on 2026-09-20 → re-drift refreshed to 2.0.12 on 2026-09-21, F1.16); the follow-ups list gains `task-playbook-opencode-2-0-12`.

### 2. Plugin header + bundle

- `opencode/plugins/arggon/index.ts` header: the dependency-free-import note cites the A/B re-probes through **2.0.12 (2026-09-21)**, with the earlier 2.0.8 (2026-09-18) and 2.0.10 (2026-09-20) dates, and points at the playbook research record (`docs/playbooks/opencode.md`).
- `npm run build:plugin` → 39 modules inlined, 338,583 B; the bundle is **byte-identical** (esbuild drops comments: 0 occurrences of the header text in `index.bundle.ts`). `npm run check:plugin` exit 0.

### 3. Stale pins → 2.0.12

- `docs/adr/0011` §7 → 2.0.12, refresh filed as `task-playbook-opencode-2-0-12`.
- `docs/specs/spec-native-first-011.md` "Pinned runtime" → 2.0.12.
- `docs/plans/plan-native-first-011.md` API-churn risk → pin 2.0.12.

### 4. Playbook Context budgets — re-measured 2026-09-21 (`npm run context:report --json`)

| surface                              | previous           | now                 |
| ------------------------------------ | ------------------ | ------------------- |
| native `arggon` tools (15, 9 pinned) | 12,182 B           | 11,821 B            |
| fixed per-session total              | 25,636 B           | 25,275 B            |
| arggon-cli umbrella (source)         | 11,942 B           | 12,995 B            |
| references (source)                  | 18,100 B           | 20,625 B            |
| fixture umbrella + references        | —                  | 13,059 B + 20,950 B |
| MCP `tools/list` / AGENTS.md         | 10,507 B / ~2.0 KB | 10,507 B / 2,005 B  |

`arggon-upgrade` adds 4,250 B on load; `keep.tokens` 15,000. The W5 bullet is now scoped to W5 and defers to the snapshot.

`opencode.md:451,458` prettier de-indent: already repaired on the base by PR #391 (`task-code-span-repair-sweep`, the #387 technique). Verified `prettier --check` clean and the byte-stability rule in `cli/src/prose-format.test.ts` covers the file; my edits keep it stable.

### Gates (5e22a53)

`npm test` 92 files / **1498 tests** ✅ · `npm run lint` ✅ · `npm run build` ✅ · `npm run check:plugin` exit 0 ✅ · `arggon validate` ok, 0 warnings (convention v5) ✅ · `arggon spec validate` 18 docs, 0 warnings ✅ · `context:report --strict` all bounds pass ✅ · focused re-run after the last header edit (`prose-format` + `plugin-copy` + plugin `index.test`): 56 ✅.

### Observation (out of scope, coordinator's call)

`opencode/plugins/arggon/index.ts` is **not** prettier-clean on the base: the committed source is semicolon-free while `.prettierrc.json` defaults to semicolons, and `.prettierignore` only excludes the generated bundle — so `npm run format` would rewrite ~1.5k lines. I applied the header edit with a shell patch to keep this diff at 6 lines. No item filed.

### handoff 2026-09-22 @Arggon — next: Review PR #392 (docs+comment only), watch CI, merge with a merge commit (tracker-carrying), then tick the acceptance list and flip the item to done.
- branch: feat/task-playbook-2-0-10-nits
- open questions: Plugin source not prettier-clean on base (format once or .prettierignore?); exploration-010 status still open (out of scope); plugin line ~2890 probe list omits 2.0.12.

### 2026-09-22 @Arggon
## Revisión PR #392 — veredicto

**Recomendación: MERGE con merge commit (no squash).** 0 bloqueantes; 2 notas LOW.

Alcance revisado: `git diff opencode2...HEAD` = 6 ficheros de contenido (+34/−29) + el item del tracker; head `99f4d86`; CI `cli` + `tasks-validate` SUCCESS sobre ese SHA (`gh run view`), PR `MERGEABLE`/`CLEAN`.

### Verificado

1. **Pins 2.0.12 coherentes en los 3 docs**, con el follow-up correcto (`task-playbook-opencode-2-0-12`, done): `docs/adr/0011-native-first-architecture.md:61`, `docs/specs/spec-native-first-011.md:30`, `docs/plans/plan-native-first-011.md:108`. `git grep` de claims de pin no deja ninguno vigente en 2.0.10 (solo menciones históricas/probes fechados; playbook `:260` "pre-refresh"). README/agents/opencode2/ADR 0010 ya estaban en 2.0.12.
2. **exploration-010**: F4.1 (`:244`) ahora "pin 2.0.12 in the playbook (F1.16)"; F1.16 (`:136-144`) documenta la cadena 2.0.8 → 2.0.10 (2026-09-20) → 2.0.12 (2026-09-21); "Open tensions" (`:306-308`) marca el refresh como landed y `:312` añade el follow-up `task-playbook-opencode-2-0-12`.
3. **Header del plugin** (`opencode/plugins/arggon/index.ts:66-75`): cita los A/B re-probes 2.0.8 (2026-09-18), 2.0.10 (2026-09-20) y 2.0.12 (2026-09-21) + puntero al research record. Fechas cruzadas OK contra el playbook (`:441`, `:450`) y los items (`task-opencode-v2-plugin-import-gotcha` 2026-09-18, `task-playbook-opencode-2-0-10` 2026-09-20, `task-playbook-opencode-2-0-12` 2026-09-21). `npm run check:plugin` → exit 0, bundle byte-idéntico (39 módulos, 338.583 B) y **0 ocurrencias** del texto del header en `index.bundle.ts` (los comentarios se descartan).
4. **Budgets reproducidos** con `npm run context:report -- --json` en head (worktree limpio): native 11.821 (15 tools, 9 pinned), fixedTotal 25.275, AGENTS.md 2.005, MCP 10.507, umbrella fuente 12.995 + refs 20.625, fixture 13.059 + 20.950, `arggon-upgrade` 4.250, descripciones ~0.9 KB (942 B). **Todos** los números del snapshot (`docs/playbooks/opencode.md:353-370`) coinciden. `--strict` → exit 0, "verdict: all bounds pass".
5. **`opencode.md:451,458`** (de-indent prettier): reparado ya en base (`opencode2` = 5613c3e, con #391) y estable en head — `prettier --check` limpio en ambos; el fichero está en el guard byte-stable de `cli/src/prose-format.test.ts:60` (test `:211`). El diff no toca esas líneas.
6. **Gates locales**: `npm test` 92 ficheros / **1498** ✅ · `lint` ✅ · `build` ✅ (postbuild sin drift) · `check:plugin` ✅ · `validate` 0 errores/0 warnings · `spec validate` 18 docs/0 warnings · focused (prose-format + plugin-copy + index.test) **56** ✅.
7. **Scope**: solo los 6 ficheros del item + tracker; nada de otros items. El cambio de código es un bloque de comentario ⇒ smoke exento (docs-only, engineering.md §Smoke test); el único gate de artefacto (bundle) pasa.

### Notas LOW (no bloquean)

- **Acceptance #4 — paréntesis desactualizado**: los "12.885+19.604" son del estado del merge de #384 (`b384fe8`); después, `efd1d88` (#391), `7beeedd` y `638b69c` (#390) movieron el skill y la fuente quedó en **12.995/20.625**, que es lo que imprime el report en head y lo que ahora lleva el playbook. Al tildar la acceptance, validar contra el report vivo, no contra el paréntesis. Cosmético: la atribución "after the W7 trim + PR #384 skill sync" (`:353`) incluye también esos syncs posteriores.
- **`opencode/plugins/arggon/index.ts:2889`** (nota de `Plugin.define`): sigue listando "probes on 2.0.7/2.0.8/2.0.10" y omite el re-probe 2.0.12. Es verdadero tal cual y el worker ya lo dejó como open question; decidir arreglo de una línea o follow-up.

### Límites de esta revisión

- Las tools MCP `tools.arggon.*` fallan en mi entorno ("No tasks/ convention found") ⇒ usé el CLI (`npm run arggon --`) sobre la misma convención v5. No ejecuté OpenCode real (no aplica: docs-only + comentario).
- Pendientes ya fileteados en base `5613c3e` (`task-plugin-source-prettier-policy`): prettier del source del plugin (confirmo el fallo también en `opencode2:opencode/plugins/arggon/index.ts`) y status de exploration-010. Fuera de scope.

**Veredicto: merge con merge commit** (el branch lleva commits del tracker); nunca squash. No marco el item done.

### 2026-09-22 @Arggon
Coordinator note: reviewer verified pins/header/budgets against the live report (11.821/25.275/12.995+20.625), the #391 repair stays stable, and the bundle is byte-identical (comments stripped). Lows applied in the closure: probe list now includes 2.0.12 (one-line comment, bundle unchanged) and the acceptance parenthesis updated to the live numbers. Gates 1498 tests, lint/build/check:plugin/validate/spec; CI pass. Merged with merge commit; item flipped to done.
