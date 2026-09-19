---
type: task
status: in_progress
id: task-opencode2-side-by-side-installs
title: "OpenCode2 side-by-side installs: named shim + per-project PATH"
assignee: Arggon
branch: feat/task-opencode2-side-by-side-installs
parent: install-ergonomics
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-19"
claimed_at: "2026-09-19T20:09:29.372Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-side-by-side-installs
---
<!--
  Placement (v0): tasks/arggon-manager/cli/install-ergonomics/task-opencode2-side-by-side-installs.md
  Leaves live only under a story. id is the filename stem: task-opencode2-side-by-side-installs.
  CLI `arggon create task opencode2-side-by-side-installs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode2 side-by-side installs: named shim + per-project PATH

## Context

Investigated 2026-09-18 for an adopter who wants `main` and `opencode2`
installed at once. Both branches declare the same `arggon` bin, so two
`npm link` installs collide; the global shim points at the last-linked
checkout. Verified options on this machine:

- **A (recommended): named shim + per-project PATH via mise.** Keep `arggon`
  → main; add `~/.local/share/arggon-oc2/bin/arggon` (wrapper:
  `exec node <checkout>/dist/cli.js "$@"`, immune to the tsc exec-bit) and
  `~/.local/bin/arggon-oc2`; in the project, `mise.local.toml` with
  `[env] _.path = ["~/.local/share/arggon-oc2/bin"]` makes bare `arggon`
  resolve to opencode2 inside the project (mise prepends before the Node bin
  dir; verified with `mise exec`).
- **B: isolated npm prefix.** `npm install -g --prefix ~/.local/share/arggon-oc2
<checkout>` produces a frozen copy with its own `bin/arggon` (works because
  npm 12 packs `dist/`; see `task-npm-packaging` for the packaging debt).
- Caveats found: a direct symlink to `dist/cli.js` fails after `tsc` (644);
  the OpenCode server inherits the PATH of the shell that launched it, so a
  server started elsewhere still resolves bare `arggon` to main (relaunch from
  the project or pin the MCP command); `.opencode/plugins/arggon/index.ts` and
  `.agents/skills/*` are gitignored generated copies, so a fresh dev clone
  needs `arggon init` (or the parity tests) before the plugin appears in
  `Ctrl+P → Plugins`.

## Acceptance

- [ ] `docs/opencode2.md` gains a "Side-by-side installs" section documenting
      both recipes, with the exact commands verified here.
- [ ] It states the `mise.toml` (tracked, inherited by worktrees and clones)
      vs `mise.local.toml` (machine-local, worktrees do not inherit it)
      trade-off and recommends the tracked file for oc2 projects.
- [ ] It explains why bare `arggon` must resolve per project (MCP command,
      skills, plugin) and the launch-dir/server-env caveat.
- [ ] Verification steps included: `which arggon`, `Ctrl+P → Plugins`,
      `opencode api plugin.list`.
- [ ] The tsc exec-bit gotcha and the generated-copies bootstrap are stated in
      the dev setup path.
- [ ] Docs only — no repo code changes required.

## Notes

- Option A is already mounted locally (wrapper + `arggon-oc2` +
  `mise.local.toml` in the opencode2 checkout, git-excluded); the docs should
  reproduce it.
- Verified end-to-end in a fresh scratch project (2026-09-19): `mise.toml`
  tracked → `arggon init` from the oc2 build, plugin generated, headless
  `opencode run` activated the location, `plugin.list` → `arggon` local
  `active`, `mcp.list` → `arggon` `connected`.

### 2026-09-19 @Arggon
Docs-only implementation in worktree ../ArggonManager-opencode2-task-opencode2-side-by-side-installs — commit 8175ad2, draft PR #365 (base opencode2). docs/opencode2.md gains 'Side-by-side installs' (Option A named shim + per-project PATH; Option B frozen prefix; mise.toml vs mise.local.toml table; why bare arggon must resolve per project + server-PATH caveat; dev-checkout bootstrap; verification block) and docs/playbooks/opencode.md gains a Setup cross-ref. No code changes; no generated-marker files touched.

Evidence (2026-09-19, this machine):
- Option A reproduced from zero in a scratch git tree with tracked mise.toml: 'mise exec -- which arggon' -> ~/.local/share/arggon-oc2/bin/arggon in the project AND in a linked 'git worktree add' copy; the primary's mise.local.toml is NOT inherited by worktrees. Raw shell without mise still resolves main.
- Option B nuance: on npm 12.0.2 'npm install -g --prefix <dir> <checkout>' LINKS the checkout (not frozen); documented '--install-links' (or a tarball install) yields a real copy at <prefix>/lib/node_modules/arggon-manager/dist/cli.js. 'npm pack' includes dist/ because it follows the declared bin into the gitignored dir.
- 'opencode api plugin.list --param location[directory]=$PWD' -> argon local active; mcp.list -> connected. Bare 'arggon mcp' spawned by the running server resolved to MAIN even under the oc2 checkout (observed: node .../node/26.7.0/bin/arggon mcp); pinning the shim in the MCP command spawned the oc2 dist/cli.js.
- 'npm run build' leaves dist/cli.js at mode 644 (tsc exec-bit gotcha).
- Gates: npm test 1293 passed (final run), npm run lint clean, npm run arggon -- validate ok (convention v3). Earlier npm test runs flaked in cli/src/measure.test.ts while load average was ~26 from parallel agents (hygiene test races concurrent measureBudget callers; fixture subprocess exit 1 under load); the file passes isolated, so environmental.

### handoff 2026-09-19 @Arggon — next: Coordinator review + merge of PR #365 (draft). Merge with a merge commit, not squash: the branch carries chore(tasks) auto-commits (claim, comment, handoff). After merge: tick the acceptance boxes if…
- branch: feat/task-opencode2-side-by-side-installs
- open questions: Pre-existing flake: cli/src/measure.test.ts '/tmp hygiene' races concurrent measureBudget callers (cli.test.ts doctor --budget) and fixture subprocesses exit 1 under high parallel-agent load; passes …

### 2026-09-19 @Arggon
## Review verdict — PR #365 (task-opencode2-side-by-side-installs)

**APROBADO para merge — merge commit, nunca squash** (la rama lleva auto-commits `chore(tasks)`). Sin hallazgos bloqueantes. Docs-only: el smoke gate obligatorio no aplica (docs/engineering.md §Smoke: docs-only exempt), pero re-verifiqué end-to-end los pasos documentados.

### Alcance (verificado)
Diff vs `opencode2`: `docs/opencode2.md` (+140), `docs/playbooks/opencode.md` (+5), y el propio item (frontmatter claim + comentarios). No se tocaron README.md, package.json ni archivos con marker `arggon:generated`. Sin scope creep: todo el contenido nuevo responde a la checklist del item.

### Checklist de aceptación (6/6 cubiertos)
1. Sección "Side-by-side installs" con ambas recetas y comandos exactos (A: shim nombrado + `mise.toml`; B: prefijo congelado) — ok.
2. Tabla `mise.toml` (tracked, heredado por clones/worktrees) vs `mise.local.toml` (local, no heredado) + recomendación del tracked para proyectos oc2 — ok.
3. Por qué bare `arggon` debe resolver por proyecto (stanza MCP en `opencode.jsonc`, auto-registro del plugin, agentes/comandos/skills) + caveat del PATH del server que lanza OpenCode — ok.
4. Bloque "Verify the side-by-side setup": `which arggon`, `Ctrl+P → Plugins`, `opencode api plugin.list` — ok.
5. Gotcha del exec-bit (`tsc` → 644) y bootstrap de copias generadas (`arggon init` / parity tests) en el path de dev — ok.
6. Docs only, sin cambios de código — ok.

### Evidencia re-ejecutada (2026-09-19, esta máquina)
- `main` y `opencode2`: mismo bin `./dist/cli.js`, ambos `version 0.3.0` (`git show origin/main:package.json`, `origin/opencode2`) — confirma "both builds report 0.3.0".
- mise 2026.9.9 en scratch: `[env] _.path` queda **antes** del bin de Node (posición 3 vs 12 en PATH); `mise exec -- which arggon` en el checkout oc2 → `~/.local/share/arggon-oc2/bin/arggon`. `MISE_PARANOID=1` falla pidiendo `mise trust`; modo normal no requiere trust — ambas afirmaciones del doc correctas.
- Repo scratch: `mise.toml` tracked se hereda con `git worktree add`; sin ese archivo el worktree resuelve main. El `mise.local.toml` del checkout primario no aparece en el worktree — tabla correcta.
- npm 12.0.2: `npm install -g --prefix <dir> <checkout>` sin flag deja `node_modules/arggon-manager` como **symlink** al checkout (no congelado); `--install-links` instala copia real, `dist/cli.js` modo 755, `readlink -f` → `<prefix>/lib/node_modules/arggon-manager/dist/cli.js`. `npm pack --dry-run --json` incluye `dist/cli.js` (mode 420) — el tarball sí lo lleva.
- `npm run build` deja `dist/cli.js` en 644 (reproducido antes de los installs).
- OpenCode v2.0.10: `opencode api plugin.list --param "location[directory]=$PWD"` → `arggon` local **active** (`path: …/arggon/index.ts`); `mcp.list` → **connected**. Sintaxis y resultado del bloque de verificación confirmados.
- Parity tests regeneran las copias (leí `cli/src/plugin-copy.test.ts` y `skill-copy.test.ts`; los corrí: 8/8).
- Gates: `npm run lint` limpio; `npm run arggon -- validate` ok (convention v3); `npx vitest run cli/src/measure.test.ts` 11/11 aislado (el flake reportado es ambiental). CI GitHub: check `cli` **pass** (2m31s), `mergeStateStatus: CLEAN`.

### Hallazgos no bloqueantes
1. **Baja — "Dev checkout bootstrap"**: "Rebuild after every pull or branch switch — both shims execute `dist/`" es exacto para Opción A, pero la copia de B con `--install-links` es congelada: un rebuild del checkout no la refresca, hay que reinstalar/repack. Sugerencia: separar A/B en esa frase (`docs/opencode2.md`).
2. **Info**: `mise.local.toml` no está en `.gitignore` del repo (en esta máquina vive en `.git/info/exclude` local). El doc dice "keep it out of git", correcto como guía; opcional añadirlo a `.gitignore` como follow-up (fuera del alcance docs-only).
3. **Info**: el ejemplo de salida de `plugin.list` está simplificado (la salida real trae ~80 plugins builtin y `features`); válido como ilustración.

### No pude verificar
- `Ctrl+P → Plugins` en la TUI (sin drive de TUI; evidencia equivalente vía `plugin.list` API).
- Traza del spawn del server con su PATH (mecanismo y evidencia del worker coherentes; no re-observé el proceso).
- Instalación desde tarball (solo `npm pack --dry-run` + copia `--install-links`; equivalente).

### Estado
PR #365 sigue **draft**: marcar ready antes de merge. Item queda `in_progress` con la checklist sin tildar — correcto hasta el merge; este review no lo marca done.
