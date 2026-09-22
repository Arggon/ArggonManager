---
type: task
status: in_progress
id: task-side-by-side-docs-polish
title: "Side-by-side docs polish: Option B rebuild wording + mise.local.toml ignore"
assignee: Arggon
branch: feat/task-side-by-side-docs-polish
parent: install-ergonomics
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-22"
claimed_at: "2026-09-22T01:28:08.039Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-side-by-side-docs-polish
---
<!--
  Placement (v0): tasks/arggon-manager/cli/install-ergonomics/task-side-by-side-docs-polish.md
  Leaves live only under a story. id is the filename stem: task-side-by-side-docs-polish.
  CLI `arggon create task side-by-side-docs-polish` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Side-by-side docs polish: Option B rebuild wording + mise.local.toml ignore

## Context

Non-blocking findings from the PR #365 review (`task-opencode2-side-by-side-installs`,
merged as `bc6291e`):

- **F1 (low)** — the "Dev checkout bootstrap" paragraph says "rebuild after
  every pull or branch switch — both shims execute `dist/`". True for Option A
  (the named shim executes the checkout's `dist/`), but the Option B
  `--install-links` copy is frozen: it needs reinstall/repack, not a rebuild.
  Split the sentence per option.
- **F2 (info/optional)** — `mise.local.toml` is not in the repo `.gitignore`
  (on this machine it lives in `.git/info/exclude`). Add it to `.gitignore` if
  the local-config pattern stays recommended; the docs already say "keep it out
  of git".
- **F3 (info)** — the `plugin.list` example output is simplified (real output
  includes ~80 builtin plugins). No action.
- **F4 (from `task-npm-packaging`, PR #366)** — npm 12 blocks dependency
  install scripts by default: `npm link` / `npm install -g .` on an unbuilt
  checkout exit 0 with no `dist/` and no bin. The working order is
  `npm install` first, then link (or approve scripts); the tarball path
  documented in README (PR #366) is the supported install. The side-by-side
  Option B recipe must state this caveat.

## Acceptance

- [x] `docs/opencode2.md` distinguishes rebuild (Option A) vs reinstall/repack
      (Option B) in the dev bootstrap paragraph.
- [x] Option B notes the npm-12 script-blocking caveat (build/install order).
- [x] `.gitignore` covers `mise.local.toml`, or the docs no longer imply it is
      an in-tree file.
- [x] `arggon validate` green; docs-only diff.

## Notes

- Superseded if `task-native-capability-audit` drops the CLI install story
  (`opencode2-native` epic); cancel with a comment in that case.

### 2026-09-22 @Arggon
**Evidencia worker** — branch `feat/task-side-by-side-docs-polish`, commit `856512b`.

Cambios (docs-only + tracker):
- `ArggonManager/docs/opencode2.md` § Dev checkout bootstrap, separado por opción: A rebuild (`npm run build`; el wrapper executa el dist del checkout); B reinstall/repack (`--install-links`; ningún rebuild del checkout alcanza la copia congelada).
- Option B: bullet **npm 12 script caveat** — orden build/install, `npm install` primero (root prepare construye) o `--allow-scripts=file:$PWD`, y el path de tarball del README raíz como install soportado.
- `.gitignore`: `mise.local.toml` + comentario (docs siguen recomendando keep it out of git).
- § Verify: el ejemplo de `plugin.list` aclara que es una entrada entre los builtins (F3).

Extra (flag al reviewer): en el mismo párrafo, la frase "tsc emite dist/cli.js a 644" era falsa tras task-npm-packaging — el `postbuild` chmoda a 0755 (verificado: `stat -c %a dist/cli.js` → 755) y el README raíz ya lo documenta. La reescribí junto con F1; si se considera fuera de alcance es un revert de ~3 líneas.

Gates (worktree):
- `npm test` → 92 files / 1498 tests passed
- `npm run lint` → clean
- `npm run arggon -- validate` → ok (0 warnings, convention v5)
- `npm run arggon -- spec validate` → ok (18 docs, 0 warnings)

Evidencia npm 12 (probe aislado /tmp/opencode/npm12-probe, npm 12.0.2):
- checkout sin construir + `npm install -g --prefix <p> .` → exit 0 + `npm warn install-scripts … (prepare: node build.js)`; sin `dist/` y sin `<p>/bin`.
- `npm install` en el checkout → root `prepare` corre y construye `dist/`.
- `npm ci` → también corre el `prepare` raíz (reconstruyó `dist/` tras borrarlo).
- tras construir, `npm install -g --prefix <p2> .` → bin symlink presente y ejecuta.

### handoff 2026-09-22 @Arggon — next: Coordinator: review the draft PR and merge with a MERGE commit (tracker-carrying branch), then mark done. No worker action pending.
- branch: feat/task-side-by-side-docs-polish
- open questions: ¿Se acepta el fix del wording 644/exec-bit (build ahora chmoda 0755) dentro de este PR o se separa?; F3 quedó matizado en el ejemplo de plugin.list.

### 2026-09-22 @Arggon
PR draft: https://github.com/Arggon/ArggonManager/pull/394 (base `opencode2`) — commits: `856512b` (docs + .gitignore), `29c70a7`/`144d022` (tracker). Item left `in_progress` for the coordinator to merge and close (tracker-carrying branch → merge commit, no squash).

### 2026-09-22 @Arggon
### 2026-09-21 @Arggon — Review (PR #394)

**Veredicto: MERGE con merge commit (nunca squash). Item queda `in_progress`: el cierre/`done` lo hace el coordinador.**

Alcance revisado: `856512b` (docs + .gitignore) + tracker `6e2da1a`/`29c70a7`/`144d022`/`e2d3aaf`. `git diff --name-status origin/opencode2...HEAD` toca solo `.gitignore`, `ArggonManager/docs/opencode2.md` y el propio item: sin `.prettierignore`, sin fuentes/bundle del plugin, sin `exploration-opencode2-native-010.md` (worker de prettier-policy en paralelo intacto).

**F1/F2/F3/F4 + acceptance (4/4 verificadas)**
- **F1 ✅** § Dev checkout bootstrap separa A rebuild (`npm run build`, el wrapper executa el dist del checkout) vs B reinstall/repack (prefijo congelado). Reproduje el congelamiento: con `--install-links` el prefijo es copia real y siguió ejecutando el build viejo tras modificar `dist/cli.js` del checkout.
- **F2 ✅** `mise.local.toml` en `.gitignore` (línea 30; `git check-ignore -v` → `.gitignore:30`), comentario con el item id; coherente con la tabla machine-local ("keep it out of git").
- **F4 ✅** Caveat npm 12 reproducible (npm 12.0.2 / node 26.7.0, probe aislado `/tmp/opencode/npm12-probe`): checkout sin construir + `npm install -g --prefix p1 .` → exit 0, `npm warn install-scripts … (prepare: …)`, sin `dist/` y sin `p1/bin`; `npm link` sobre checkout sin construir → exit 0, sin dist, sin bin; `npm install` primero → el `prepare` raíz construye `dist/cli.js` 755 y el link produce bin funcional; `--allow-scripts=file:$PWD` ejecuta el prepare y deja bin funcional; el pack real del repo incluye `dist/cli.js` (mode 0755 en el pack, `npm pack --dry-run --json`).
- **F3 ✅** El matiz del ejemplo `plugin.list` es correcto y prudente (la salida real trae builtins; F3 original decía "no action").
- **Acceptance:** #1 sí, #2 sí, #3 sí, #4 `validate` ok + diff sin código.

**Precisión de los claims del doc (reproducidos)**
- `rm -rf dist && npm run build` → `stat -c %a dist/cli.js` = **755**; `./dist/cli.js --version` → `0.3.0 (e2d3aaf, feat/task-side-by-side-docs-polish)`. El chmod está en `cli/write-build-info.mjs` (`postbuild`), ya presente en `origin/opencode2`.
- `rm -rf dist && npm ci` en el worktree real → exit 0 y `dist/cli.js` reconstruido a 755 (corre el `prepare` raíz; el warn de `esbuild` postinstall bloqueado confirma la semántica npm 12). Claim "`npm ci` builds via the root `prepare` too" verificado en el repo, no solo en el probe.
- **Extra flag (644→0755): correcto y en alcance.** La frase vieja ("tsc emite 644 / symlink falla") ya era falsa en la base: `cli/write-build-info.mjs:58` chmoda desde `b300eb9` (task-npm-packaging) y `README.md:147` ya documentaba el exec bit. Está en el mismo párrafo que F1 y la aceptación #1 es exactitud de ese bloque; no requiere split.

**Gates (worktree, re-ejecutados por el reviewer)**
- `npm test` → 92 files / **1498 passed**; `npm run lint` → clean; `npm run arggon -- validate` → ok (0 warnings, convention v5); `npm run arggon -- spec validate` → ok (18 docs, 0 warnings).
- CI PR #394: `tasks-validate` pass y `cli` pass; `mergeable: MERGEABLE`, draft. Smoke gate exento (docs-only, ADR 0008); igual reproduje los probes npm que sustentan el texto.

**Nits no bloqueantes (opcionales, no piden re-trabajo)**
1. "the root `prepare` never runs" junto a "(npm ci builds via the root `prepare` too)" puede leerse contradictorio; sugerencia futura: "the copy's `prepare` never runs" (npm bloquea scripts de dependencias; los del proyecto raíz sí corren).
2. npm sugiere la identidad por nombre (`--allow-scripts=arggon-manager` / `npm install-scripts approve <pkg>`); `file:$PWD` funciona (verificado), pero mencionar la forma por nombre ahorraría fricción.

**Nota de entorno:** `tools.arggon.*` no resuelve el tracker v5 en esta sesión (binario global stale: "No tasks/ convention found"); veredicto publicado con el CLI del repo (mismo write path, auto-commit) y pusheado a la rama, como en reviews previos.

### 2026-09-22 @Arggon
Coordinator note: reviewer verified F1-F4 (frozen prefix ignores rebuilds; npm-12 probe reproduced; .gitignore covers mise.local.toml; the 644→755 correction is accurate and in scope) and CI. Non-blocking nits applied in the closure (copy's prepare wording + friendlier --allow-scripts hint). Gates 1498 tests, lint/validate/spec. Merged with merge commit; item flipped to done.
