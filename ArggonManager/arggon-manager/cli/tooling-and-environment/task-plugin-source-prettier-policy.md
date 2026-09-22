---
type: task
status: in_progress
id: task-plugin-source-prettier-policy
title: Plugin source prettier policy + exploration-010 status
assignee: Arggon
branch: feat/task-plugin-source-prettier-policy
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
claimed_at: "2026-09-22T01:28:45.565Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-plugin-source-prettier-policy
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-plugin-source-prettier-policy.md
  Leaves live only under a story. id is the filename stem: task-plugin-source-prettier-policy.
  CLI `arggon create task plugin-source-prettier-policy` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin source prettier policy + exploration-010 status

## Context

Observations from the PR #392 review (`task-playbook-2-0-10-nits`):

1. `opencode/plugins/arggon/index.ts` is **not prettier-clean at base** (the
   source is written without semicolons vs `.prettierrc.json`); `npm run format`
   would rewrite ~1.5k lines and `.prettierignore` only excludes the bundle.
   Decide: format the file once (large diff), add it to `.prettierignore`
   (documented), or align `.prettierrc` with the plugin style.
2. `exploration-opencode2-native-010` is still `status: open`; decide whether it
   should be marked landed/closed now that the program's waves shipped.

## Acceptance

- [x] The plugin-source formatting policy is decided and enforced (prettier
      config/ignore or a one-time format), documented.
- [x] `npm run format` no longer surprises the plugin source.
- [x] exploration-010 status reflects reality.
- [x] `arggon validate` green; CI green.

## Notes

- Filed from the PR #392 review; cosmetic.
- Decision: keep the authored semicolon-free style — `opencode/plugins/arggon/index.ts`
  is ignored by `.prettierignore` with the rationale (the generated bundle is what
  adopters receive, so reformatting only churns ~2.9k lines of history).
  `prettier --write` on the file is a no-op (sha256 unchanged).
- `exploration-opencode2-native-010` → `status: decided` with the Decision section
  linking ADR 0011 (Accepted) and recording that W0–W7 shipped
  (`spec`/`plan-native-first-011` are `implemented`).

### 2026-09-22 @Arggon
Evidence (worker run, 2026-09-22). Decision applied: keep the authored
semicolon-free style — `opencode/plugins/arggon/index.ts` added to
`.prettierignore` with the rationale in the comment (the generated bundle is
what adopters receive, so reformatting only churns ~2.9k lines of history). No
source edits. `exploration-opencode2-native-010`: `status: open` → `decided`,
Decision section links ADR 0011 (Accepted) + ADR 0013 and records W0–W7 shipped
(`spec`/`plan-native-first-011` are `implemented`); closed-status convention
follows exploration-005/006 (`decided`).

Commands (worktree `feat/task-plugin-source-prettier-policy`):
- `npx prettier --check opencode/plugins/arggon/index.ts` → clean (ignored; exit 0)
- `npx prettier --write opencode/plugins/arggon/index.ts` → sha256 unchanged (no-op)
- `npx prettier --check opencode/plugins/arggon/index.bundle.ts` → clean (still ignored)
- `npx prettier --check ArggonManager/docs/explorations/exploration-opencode2-native-010.md` → clean, byte-stable
- `npm test` → 92 files / 1498 tests passed
- `npm run lint` → exit 0
- `npm run build` → exit 0 (bundle unchanged, 338583 bytes)
- `npm run check:plugin` → exit 0
- `npm run arggon -- validate --json` → ok:true, 0 errors/warnings
- `npm run arggon -- spec validate` → ok (18 docs, 0 warnings)
- `gh pr checks 393` → cli pass (4m18s), tasks-validate pass (34s) on head cf619ee

PR: https://github.com/Arggon/ArggonManager/pull/393 (draft, base `opencode2`).
Commits: b88f089 claim, cf619ee policy + exploration-010, c6f48fc acceptance tick.

Observation (out of scope, no item filed): `exploration-opencode-v2-native-009`
is also still `status: open` with Decision "Pending" although ADR 0010 landed —
candidate for a separate close-out.

### handoff 2026-09-22 @Arggon — next: Coordinator: review PR #393 (draft, base opencode2), confirm CI on the final head, merge, then flip the item done.
- branch: feat/task-plugin-source-prettier-policy
- open questions: exploration-009 still open (Decision Pending) though ADR 0010 landed - separate close-out item? ~340 other prettier-dirty files remain out of scope.

### 2026-09-22 @Arggon
Scope extension (coordinator): exploration-opencode-v2-native-009 closed as well — status: open → decided, Decision section links ADR 0010 (Accepted 2026-09-18) and records the later amendments (ADR 0011 §2/§3 + packaging, ADR 0012 layout, ADR 0013 kernel packaging); no history rewritten. Commit 1a66c44. Gates re-run: prettier --check clean + byte-stable (prose-format rule 3), argmon validate ok, spec validate ok (18 docs, 0 warnings), npm test 92 files / 1498 passed.

### handoff 2026-09-22 @Arggon — next: Coordinator: review PR #393 (draft, base opencode2) — now also closes exploration-009; confirm CI on the final head, merge, then flip the item done.
- branch: feat/task-plugin-source-prettier-policy
- open questions: None blocking; both explorations (009, 010) are decided now. ~343 other prettier-dirty files remain out of scope.

### 2026-09-22 @reviewer
**Veredicto PR #393 (draft, base `opencode2`, head `034f6ee`) — MERGE con merge commit (nunca squash). El item queda `in_progress`; el `done` lo hace el coordinador tras el merge.**

Alcance revisado: 4 ficheros (+89/−10) — `.prettierignore`, este item y las explorations 009/010. Sin cambios de código: smoke test exento por docs/tooling (`docs/engineering.md` §Smoke test); la evidencia aplicable son las sondas de prettier y los gates de abajo.

### Qué verifiqué (repro en el worktree `feat/task-plugin-source-prettier-policy`)

**`.prettierignore` — política correcta y load-bearing**
- `npx prettier --check --ignore-path /dev/null opencode/plugins/arggon/index.ts` → falla (exit 1): la entrada es necesaria; sin ignore, la fuente está sucia.
- `npx prettier --check opencode/plugins/arggon/index.ts` → clean; `npx prettier --write` deja el sha256 intacto (`6967459785e5…` antes y después).
- Bundle todavía ignorado: `prettier --check index.bundle.ts` clean y `--ignore-path /dev/null` falla (esa entrada también carga).
- Extremo a extremo: `npx prettier --check .` ya no lista `index.ts` ni el bundle. Churn real si se reformatease: 1.528 líneas cambiadas de 2.894.
- El rationale "el bundle generado es lo que reciben los adopters" es exacto: `cli/src/plugin-bundle.ts` vende `index.bundle.ts` en `arggon init`, y `check:plugin` lo pinea byte a byte. El comentario documenta la política.

**Gates (verdes, re-ejecutados por mí)**
- `npm test` → 92 files / 1498 tests passed.
- `npm run lint` → exit 0 (ESLint sí cubre la fuente: `npx eslint opencode/plugins/arggon/index.ts` exit 0).
- `npm run build` → exit 0; bundle regenerado byte-idéntico (sha256 `9787b23d…`, 338583 B) y `git status` limpio tras el build.
- `npm run check:plugin` → exit 0. `arggon validate --json` → `ok:true`, 0 errores/warnings. `spec validate` → ok (18 docs, 0 warnings).
- Prettier de docs: ambas explorations clean (estaban clean en base y siguen clean). La 009 está en `REPAIRED_FILES` de `prose-format.test.ts` y la regla 3 (byte-estabilidad) pasa con `npm test`.

**Explorations — status/Decision coherentes, sin reescribir historia**
- 009: diff = `status: open→decided` + Decision "Pending…" → ADR 0010 (con enmiendas 0011/0012/0013). Los enlaces relativos resuelven; ADR 0010 sigue "Partially superseded by 0011/0012" y el texto lo declara.
- 010: `open→decided` + Decision → ADR 0011 (Accepted) + ADR 0013. "W0–W7 `task-native-*` done/cancelled (2026-09-19 → 2026-09-21)" verificado item por item (15 items: 14 done + `task-native-kernel-lib-polish` cancelled); `spec`/`plan-native-first-011` `implemented`.
- Convención `decided` consistente con exploration-005/006 (y 009).

**CI y scope**
- `gh api repos/.../commits/034f6ee/check-runs` → `cli` completed/success y `tasks-validate` completed/success en el head final; `mergeStateStatus: CLEAN`.
- El diff toca solo esos 4 ficheros; no toca los del PR #394 (`.gitignore`, `docs/opencode2.md`, `task-side-by-side-docs-polish.md`). La rama está detrás de opencode2 en esos commits, pero el merge es limpio.

### Hallazgos (ninguno bloqueante)

- **[Nit]** `.prettierignore`: "the bundle above stays pinned" — la entrada del bundle está *debajo* del bloque de la fuente; y "~2.9k lines" es el tamaño del fichero (el churn real es ~1.5k líneas). Solo redacción.
- **[Observación, pre-existente]** `opencode/plugins/arggon/index.test.ts` y `tools.test.ts` siguen sucios bajo prettier (2 de los ~344 ficheros sucios repo-wide), así que `npm run format` aún reescribiría ficheros dentro de `opencode/plugins/arggon/`. El Context/Notes del item acotan la política a la fuente de entrada y el resto ya está declarado out of scope; si se lee "the plugin source" del acceptance como todo el directorio, conviene una nota aclaratoria o un item de follow-up (no lo considero bloqueante ni regresión de este PR).
- **[Nit]** La evidencia del item/PR cita heads anteriores (`cf619ee`, `18ef71e`) como "final"; confirmé CI verde en el head real `034f6ee`.

### Límites

- `tools.arggon.*` no resuelve el tracker v5 en esta sesión (binario global 0.3.0 stale: "No tasks/ convention found"); veredicto publicado con el CLI del repo (mismo write path, auto-commit) y pusheado a la rama, como en reviews previos. Este commit mueve el head de la PR: re-confirmar CI (re-corea) antes del merge.
- No mergeo ni marco `done`; no conduje smoke de UI/CLI porque no hay cambio de comportamiento.

**Recomendación: MERGE (merge commit, nunca squash).**

### 2026-09-22 @reviewer
**Addendum al veredicto (corrección de estado, 2026-09-22 @reviewer).** El veredicto anterior dice "pusheado a la rama": **no** pudo pushearse — la sesión de review tiene `git push` denegado por la política de permisos del entorno. Estado real:

- Verdict commit **`3935317`** (`chore(tasks): commented task-plugin-source-prettier-policy`) está **local** en el worktree `/home/arggon/Projects/ArggonManager-opencode2-task-plugin-source-prettier-policy`, sobre `034f6ee`; `origin/feat/task-plugin-source-prettier-policy` sigue en `034f6ee` (ahead 1).
- Acción para el coordinador: `git push origin feat/task-plugin-source-prettier-policy` desde ese worktree antes del merge (o merge local + push de `opencode2`) para que el veredicto entre en la historia; luego re-confirmar CI en el nuevo head (`tasks-validate` + `cli` re-corean) y merge con **merge commit, nunca squash**.
- El resto del veredicto (evidencia, gates, hallazgos, recomendación **MERGE**) no cambia.

### 2026-09-22 @Arggon
Coordinator note: reviewer verified the ignore is load-bearing (dirty without it, no-op with it), bundle still pinned, both explorations decided with resolving links, gates 1498 + CI. Nits applied in the closure: .prettierignore now covers the whole plugin dir (source + tests, per the review's scope note) and the comment wording is fixed; evidence heads noted (final = 034f6ee). Repo-wide ~343 prettier-dirty files remain a known broader footgun (out of scope). Merged with merge commit; item flipped to done.
