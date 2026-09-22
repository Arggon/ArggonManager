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
