---
type: task
status: done
id: task-npm-packaging
title: "npm packaging: files allowlist, prepare, executable bin"
assignee: Arggon
branch: feat/task-npm-packaging
parent: install-ergonomics
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-19"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-npm-packaging
---
<!--
  Placement (v0): tasks/arggon-manager/cli/install-ergonomics/task-npm-packaging.md
  Leaves live only under a story. id is the filename stem: task-npm-packaging.
  CLI `arggon create task npm-packaging` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# npm packaging: files allowlist, prepare, executable bin

## Context

Found on 2026-09-18 while investigating side-by-side installs (see
`task-opencode2-side-by-side-installs`):

- No `files` field: `npm pack --dry-run` ships 973 files / 8.4 MB, including
  `dist/*.test.js` and other development artifacts.
- No `prepare`/`prepublishOnly`: `npm install -g <checkout>` does not build
  `dist/`, so installation only works when the tree was built beforehand.
- `npm run build` (tsc) leaves `dist/cli.js` at mode 644, so a manual symlink
  to the bin fails with `Permission denied`; `npm link` sets the exec bit, but
  the side-by-side shim needed a wrapper script (verified 2026-09-18).
- Both builds report version `0.3.0`, making parallel installs
  indistinguishable.

## Acceptance

- [x] `files` allowlist in `package.json` (production `dist/**` without
      `*.test.*`, `templates/`, `skills/`, `opencode/`, README/LICENSE) so
      `npm pack --dry-run` no longer includes tests or dev artifacts.
- [x] Clean install works from a fresh clone without pre-building (`prepare`
      builds `dist/`, or the supported install path is documented in README).
- [x] The bin is executable after `npm run build` (postbuild `chmod +x`) or the
      install flow guarantees it.
- [x] `arggon --version` identifies the build (e.g. version + git sha/branch)
      so side-by-side installs are distinguishable.
- [x] CI test pins the tarball contents (`npm pack --dry-run --json`) so
      bundling tests or dropping `dist` fails the gate.
- [x] Before/after size and file counts recorded in the item.

## Notes

- The side-by-side recipe docs live in the sibling task; this item is the
  packaging half.

### 2026-09-19 @Arggon
### Evidence — packaging before/after + install smoke (worker, 2026-09-19)

`npm pack --dry-run --json` (worktree, commit b300eb9):

| | before (opencode2 @6a03d8c) | after (b300eb9) |
| --- | --- | --- |
| tarball files | 977 | 164 |
| packed size | 8,355,167 B (7.97 MiB) | 322,741 B (0.31 MiB) |
| unpacked size | 12,474,559 B (11.90 MiB) | 1,089,052 B (1.04 MiB) |
| test artifacts (`.test.*` / `test-tmp.*`) | 225 | 0 |
| top level | cli, tasks, fixtures, docs, .github, dist, … | dist 113, templates 39, skills 8, opencode 1, README, LICENSE, package.json |
| `dist/cli.js` mode | 0644 | 0755 |

Fresh-clone smoke (real `git clone` of the branch — no `dist/` in the clone):
- `npm install` → `prepare` runs: builds `dist/cli.js` (0755) + `dist/build-info.json` = `{version: 0.3.0, sha: b300eb9, branch: feat/task-npm-packaging}`
- `npm pack` → `arggon-manager-0.3.0.tgz` (322,741 B, 164 entries)
- `npm install -g --prefix <tmp> ./arggon-manager-0.3.0.tgz` → `arggon --version` prints `0.3.0 (b300eb9, feat/task-npm-packaging)`; `arggon hello` OK
- manual `ln -s <checkout>/dist/cli.js` → runs (failed with `Permission denied` before)

Gates: `npm test` 79 files / 1307 tests green · `npm run lint` · `npm run build` · `arggon validate` ok:true.

Notes: npm 12 blocks a dependency's `prepare` by default, so README documents the tarball path (works with scripts blocked) and notes `npm run build` + `npm link` / `npm install -g .` for direct checkout installs. `--version` probes the work tree at runtime and falls back to the baked `dist/build-info.json`, so packed installs are identifiable too; git-less installs print the bare semver.

Pre-existing finding (not this PR): `cli/src/measure.test.ts` "always deletes the measurement temp tree (/tmp hygiene)" fails when another suite runs on the machine (shared `/tmp`); reproduces at base 6a03d8c without the new test files, and passes when no sibling suite is running. Coordinator to decide whether to file a follow-up.

### handoff 2026-09-19 @Arggon — next: Coordinator review: code + README (npm-12 tarball install path) + PR #? — merge with a merge commit (branch carries tracker commits), then flip done.
- branch: feat/task-npm-packaging
- open questions: File a follow-up for the pre-existing measure.test.ts /tmp hygiene race under concurrent suites (reproduced at base 6a03d8c)?; npm>=12 blocks prepare on direct installs — is the documented tarball pa…

### 2026-09-19 @Arggon
Draft PR: https://github.com/Arggon/ArggonManager/pull/366 (base opencode2, commit 751ac5b).

### 2026-09-19 @Arggon
### Revisión PR #366 (task-npm-packaging) — veredicto del reviewer

Veredicto: **NO MERGE todavía** — 1 bloqueante (CI roja por un bug del test nuevo). El resto del paquete verifica y es de buena calidad.

Contexto: revisé la copia de la rama (head `fad7315`, base `opencode2`). Nota: la copia canónica de este item en el checkout primario está `todo`/sin claim; la copia de la rama está `in_progress` con la evidencia y los ticks. Merge commit (no squash) y flip a done: coordinador.

---

#### BLOQUEANTE F1 — `parsePackResult` no soporta la salida array de npm 10 (CI roja)

- `cli/src/pack-contents.test.ts:66-68`: `stdout.indexOf("{")` + `JSON.parse(slice)`. El npm de CI (Node 22 → npm 10.9.4) imprime `npm pack --json` como **array** (`[{...}]`); el slice desde el primer `{` deja `{...}]` → `SyntaxError: Unexpected non-whitespace character after JSON at position 16897 (line 835 column 1)`. La rama `Array.isArray(raw)` ya presente en el test nunca se alcanza.
- CI roja en el head `fad7315`: runs 35468367292 (job 105964738715) y 35468352671 — mismo fallo en ambos (78/79 files, 1306/1307 tests; lint skipped). `gh pr checks 366` → `cli fail`. Localmente pasa porque la máquina tiene npm 12 (objeto keyed), de ahí el "verde" del worker.
- Repro determinista local:
```bash
npx --yes npm@10.9.4 --version   # fetch
npm_execpath=$(find ~/.npm/_npx -path '*/node_modules/npm/bin/npm-cli.js' | head -1) \
  node node_modules/vitest/vitest.mjs run cli/src/pack-contents.test.ts
# → idéntico a CI: position 16897 (line 835 column 1)
```
- Fix sugerido (parsear el stdout completo — npm manda los banners a stderr — o elegir el primer `[`/`{`):
```ts
const text = stdout.trim();
const start = Math.min(...["[", "{"].map((c) => { const i = text.indexOf(c); return i < 0 ? Infinity : i; }));
const raw = JSON.parse(text.slice(start));
```
Tras el fix: CI verde y recién ahí el tick "CI test pins the tarball contents" es honesto (hoy el test no puede pasar en CI tal como está).

#### Menor F2 — precisión del README sobre npm 12 (no bloqueante, resoluble en este PR)

Verificado con npm 12.0.2:
- clone fresco sin `dist/` → `npm install` corre `prepare` (scripts del root sí corren): `dist/cli.js` 0755 + `build-info.json`; `npm pack` → tarball OK; `npm install -g <tarball>` → `arggon --version`/`hello`/`init` OK. La instalación desde tarball imprime `npm warn install-scripts ... arggon-manager@0.3.0 (prepare: npm run build)` aunque el binario funciona (dist va en el tarball): conviene decir en el README que ese warning de npm≥12 es esperado y benigno, o usar `--ignore-scripts` en el ejemplo.
- `npm link` / `npm install -g .` sobre un checkout sin build: exit 0 + el mismo warning, **sin `dist` y sin bin** (instalación silenciosamente inútil). El README lo advierte ("run `npm run build` first") pero conviene explicitar el orden real: en un clone nuevo primero `npm install` (que ya construye vía prepare) y después link/install, o aprobar scripts — `npm run build` antes de `npm install` no puede funcionar (falta tsc).

#### Nit F3 — el docstring de `formatBuildVersion` sobreestima la validación

`cli/src/build-info.ts:102-107` afirma que ambos valores son "git-validated (hex sha, ref-format branch…)"; `readBakedBuildInfo` solo chequea `typeof string && != ""`. Un `dist/build-info.json` corrupto puede meter newlines/control chars en `--version` (mismo dominio de confianza del paquete: impacto bajo). Validar la forma (sha hex, branch sin espacios/control) o ajustar el comentario.

---

#### Verificado sin hallazgos

- **Diff mínimo/scoped**: 7 archivos +536/−3, tracker aparte; sin reformateo; `git diff --check` limpio; las líneas nuevas de README/cli.ts son prettier-clean (los desvíos de prettier existentes ya estaban en el base, no los introduce este PR).
- **Tarball (npm 12 local)**: 164 archivos / 322.740 B / unpacked 1.089.052; 0 artefactos `.test.`/`test-tmp.`; top level exactamente dist 113, templates 39, skills 8, opencode 1, README, LICENSE, package.json; `dist/cli.js` mode 755. Base `6a03d8c` reconstruido limpio: 976 archivos / 8.355.101 B / 228 tests (worker: 977 / 8.355.167 / 225; diferencia ±1 archivo / ±1 B consistente con un dist stale; inmaterial, números honestos).
- **`--version`** (todos exit 0, prefijo semver intacto, una línea): checkout tsx y dist → `0.3.0 (fad7315, feat/task-npm-packaging)`; `-V` idem; HEAD detached → `0.3.0 (fad7315)` (sin paréntesis vacío); instalado global desde tarball → baked `0.3.0 (fad7315, feat/task-npm-packaging)`; paquete en `node_modules/` de un repo consumidor → reporta el baked, no el sha del consumidor (guard del work-tree top level OK); sin git ni baked, y con build-info corrupto → `0.3.0`, exit 0. `arggon hello` con PATH sin git sigue funcionando (probe sólo en --version).
- **Exec bit**: symlink manual a `dist/cli.js` corre (antes 644 → Permission denied). `write-build-info.mjs` con `execFileSync` array-args y timeout 2s; sin shell injection.
- **Assets runtime**: `arggon init` desde el tarball instalado funciona (templates + 31 docs generados), la allowlist cubre lo que init lee.
- **Gates locales**: `npm test` 79 files / 1307 tests verde (46.9s); `npm run lint`, `npm run build`, `arggon validate --json` (`ok:true`) OK. `measure.test.ts` pasó en mi corrida; los tests nuevos usan prefijos propios (`arggon-pack-*`, `arggon-buildinfo-*`) y no tocan el glob `arggon-budget-*` del flake pre-existente → sin contención nueva.

#### No verificado / fuera de alcance

- Windows (junction/chmod) no probado; no hay cambios de UI (smoke de browser no aplica).
- El flake pre-existente de `measure.test.ts` (`/tmp` compartido) queda como estaba: reproducción en el base `6a03d8c` según el worker; a decisión del coordinador si se fileta follow-up (no lo cuento como hallazgo de este PR).

**Recomendación: NO MERGE** hasta corregir F1 y tener CI verde. F2/F3 no bloquean y se pueden resolver en el mismo PR (README + comentario). Después: merge commit y flip a done por el coordinador.

### 2026-09-19 @Arggon
### F1 fixed + CI green (worker, 2026-09-19)

**F1 (parsePackResult / npm 10 array)** — fix in `4763d51`, merge `373ebd8`:

- `parsePackResult` now anchors on the **first `[`/`{`** (was `indexOf("{")`), so npm 10's `[{...}]` and npm 12's keyed object both parse; banner text ahead of the payload is tolerated. The `Array.isArray(raw)` branch is reachable again.
- Unit fixtures pin both shapes (npm 10 array, npm 12 keyed), leading lifecycle-script output, and both failure messages — the test no longer depends on the local npm.
- Reviewer repro with the pinned npm 10.9.4 (`$HOME/.npm/_npx/4b0cc92362cfffad/node_modules/npm/bin/npm-cli.js`):
  - before: `SyntaxError: Unexpected non-whitespace character after JSON at position 16897` (1 failed)
  - after: `cli/src/pack-contents.test.ts` **6/6 passed** (`ships the allowlist only…` green on npm 10)
  - same file on local npm 12: 6/6 passed

**F2 (README npm 12)** — new wording: the tarball install needs no scripts (the blocked-`prepare` warning is benign, the build is inside); a checkout installs in this order — `npm install` first (root `prepare` builds `dist/`), then `npm link` / `npm install -g .`; linking an *unbuilt* checkout exits 0 without `dist/`/bin, and the script can be approved by its resolved identity (`npm install -g . --allow-scripts=file:$PWD`, verified locally: prepare ran, bin linked, `arggon --version` OK).

**F3** — `formatBuildVersion` docstring corrected: live-probe values are git-validated; the baked `dist/build-info.json` fallback only filters empty fields (build output, not a validation boundary).

**Merge** — `origin/opencode2` merged (`373ebd8`) to resolve the item-file conflict between the review verdict and my tracker sections; PR `mergeStateStatus` back to CLEAN.

**Gates** (head `373ebd8`): `npm test` 79 files / **1311 tests green** (pack-contents 6/6, incl. on npm 10.9.4) · `npm run lint` · `npm run build` · `arggon validate` ok:true.

**CI**: run [35469353813](https://github.com/Arggon/ArggonManager/actions/runs/35469353813) → `cli` **pass** (2m39s); `gh pr checks 366` = pass.

### handoff 2026-09-19 @Arggon — next: Re-review the F1 fix + F2/F3 on PR #366 (head after tracker commits), then merge commit and flip done.
- branch: feat/task-npm-packaging
- open questions: None blocking; measure.test.ts /tmp flake already filed as a separate bug on opencode2.
