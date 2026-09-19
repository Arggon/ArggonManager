---
type: task
status: todo
id: task-npm-packaging
title: "npm packaging: files allowlist, prepare, executable bin"
parent: install-ergonomics
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-19"
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

- [ ] `files` allowlist in `package.json` (production `dist/**` without
      `*.test.*`, `templates/`, `skills/`, `opencode/`, README/LICENSE) so
      `npm pack --dry-run` no longer includes tests or dev artifacts.
- [ ] Clean install works from a fresh clone without pre-building (`prepare`
      builds `dist/`, or the supported install path is documented in README).
- [ ] The bin is executable after `npm run build` (postbuild `chmod +x`) or the
      install flow guarantees it.
- [ ] `arggon --version` identifies the build (e.g. version + git sha/branch)
      so side-by-side installs are distinguishable.
- [ ] CI test pins the tarball contents (`npm pack --dry-run --json`) so
      bundling tests or dropping `dist` fails the gate.
- [ ] Before/after size and file counts recorded in the item.

## Notes

- The side-by-side recipe docs live in the sibling task; this item is the
  packaging half.

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
