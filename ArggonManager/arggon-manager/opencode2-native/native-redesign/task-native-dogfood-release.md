---
type: task
status: done
id: task-native-dogfood-release
title: "Dogfood, ADR 0006 measurement and release"
assignee: Arggon
branch: feat/task-native-dogfood-release
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-21"
depends_on: [task-native-headless-ci]
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-dogfood-release.md
  Leaves live only under a story. id is the filename stem: task-native-dogfood-release.
  CLI `arggon create task native-dogfood-release` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Dogfood, ADR 0006 measurement and release (W7)

## Context

W7 of `plan-native-first-011`. Migrate this repo's own `.opencode` seam to the native surface; run `context:report --strict`; finish packaging/release docs; tag. Closes the program.

## Acceptance

- [x] ADR 0006 budgets re-measured and within limits; item block ≤ 1024 B
      (native 11.821 ≤ 12.288; block 252; AGENTS 2.005; MCP 10.507).
- [x] Dogfood scenarios green on this repo's own tracker (provenance
      no-clobber, tools, `/arggon-status` via the V2 loader, panel smoke).
- [x] Packaging/release docs updated; release checklist executed up to the
      owner gate (publish/tag pending product-owner approval — `task-release-0-4-0`).
- [x] Release notes cover the W3 default-path change: the plugin no longer
      auto-registers the MCP server; an adopter re-running `init` loses
      auto-registration unless they configure the stanza (`doctor` reports it
      as optional).
- [x] `arggon validate` and `spec validate` green.

## Notes

- Release prep only: bump/tag/publish is `task-release-0-4-0`, blocked on the
  product-owner decision.

- Watch the ADR 0006 native-tools headroom: after W4/W5 the advisory bound is
  at 12,182 B ≤ 12,288 B (~106 B). Re-measure and either trim schemas, decide
  `options.pinned`, or raise the bound deliberately in this wave.

- Depends on W3–W6; this is the program's closing gate.

### 2026-09-21 @Arggon
### W7 evidence (worker, 2026-09-21) — dogfood, ADR 0006 re-measure, release prep

Branch `feat/task-native-dogfood-release`, worktree `/home/arggon/Projects/ArggonManager-opencode2-task-native-dogfood-release`.

**Commits**

- `b944d7f` chore(dogfood): migrate this repo's .opencode seam to the native surface (W7)
- `55e2638` perf(plugin): trim redundant output-schema bytes for ADR 0006 headroom (W7)
- `473b60d` docs(release): native-first release notes, publish runbook, ADR 0006 re-measure (W7)
- `cd24ec1` chore(tasks): record the vendored plugin's trimmed-bundle state (W7)

**Dogfood — seam migration with `init` + provenance**

- `init --dry-run --json` (before): created 10, updated 15, modified-skip 2 (`AGENTS.md`, `CONTRIBUTING.md`), backedUp 0, skipped 9.
- `init --no-commit`: wrote the 25; the two adopter-modified files are byte-untouched (`modified[]`/`skipped[]`) — never overwritten, as the provenance contract requires.
- Idempotent: a second `init --no-commit` left every content file byte-identical (`git diff` over all files except the state file, sha256 `0e339997…` before == after); the post-run `init --dry-run --json` shows `created: []` and the same 25 as `updated` (identical renders). Only the state file's `generatedAt` bookkeeping refreshes by design.
- `.github/workflows/arggon.yml` is now committed by the product repo itself; its drift-gate command run locally (`git status --porcelain -- . ':(exclude)ArggonManager/.convention.yml'`) is **clean**.

**Dogfood — real/headless sessions over THIS repo**

- Live session (this worker session after `session_move` to the worktree): the Code Mode catalog switched to the native namespace — `search` lists `tools.arggon.{branch,cleanup,comment,handoff,import_issues,list,next,priority,report,show,start,sync,update,validate}` (14 of 15; `create` hidden by the worker agent's `arggon_create` deny — W4 permissions live). `tools.arggon.list({status:"in_progress",type:"task"})` returned this item; `tools.arggon.next({})` → `task-native-lib-hygiene`, identical to `arggon next --json`.
- Tools, headless (`opencode run --auto -m opencode-go/deepseek-v4.1-flash`, cwd = worktree, exit 0): `execute` ran `tools.arggon.list({status:"todo"})` + `show({id:"task-native-dogfood-release", meta:true})` → `{open: 11, marker:"/home/arggon/Projects/ArggonManager-opencode2-task-native-dogfood-release"}`, no errors.
- Command, headless: `opencode run "/arggon-status"` — the V2 loader expanded the migrated `.opencode/commands/arggon-status.md` (body text present in the transcript) and the model called exactly `tools.arggon.report({})`, `list({status:"blocked"})`, `list({stale:true})`; no CLI shell-out.
- Panel: `npm run smoke:tui` → 13/13 (init seam, discovery, PTY `/arggon-board`, render, corrupt-tracker degradation). Over this repo: TUI loads the vendored entry with no plugin failure, the palette lists _Open Arggon board_, the sidebar renders `arggon ▶ task-…`, and the board preview renders this repo's tree with the `… 77 more item(s)` counter. Caveat, reported honestly: with the 277-item tracker the 30–45 s PTY capture showed the palette preview focused on the active item, not the `arggon board · N item(s)` header line (the header assertion is covered by the fixture smoke, which passes).

**ADR 0006 re-measured** — `npm run context:report -- --strict` → exit 0, `regressions: []`

- native `arggon` tools: **11,821 B ≤ 12,288 B (467 B headroom)** — 15 definitions, 9 pinned; was 12,182 B / 106 B.
- injected item block: bound 1,024 B, measured 193 B / 252 B (fixture items).
- generated AGENTS.md 2,005 B ≤ 2,048 B · MCP `tools/list` 10,507 B ≤ 12,288 B (9 tools, compatibility surface) · fixed total 25,275 B · compaction keep.tokens 15,000.
- Decision recorded in ADR 0006 §Consequences (2026-09-21): keep the bound; trim only redundant bytes — the 12 kernel output schemas drop `additionalProperties: true` (absent means true in JSON Schema; 336 B) and the namespace line keeps both facts in 104 B (25 B). `options.pinned` unchanged (the lever selects catalog render priority, it does not shrink this payload).

**Release prep (docs + checklist; nothing published, no tag, no bump)**

- `CHANGELOG.md` `[Unreleased]`: W0–W7 adopter-facing notes with the **W3 default-path change** explicit — the plugin no longer auto-registers the MCP server; an adopter re-running `init` loses the auto-registration unless they configure `mcp.servers.arggon` (doctor reports the stanza as optional; `.mcp.json` and `arggon mcp` stay for non-OpenCode clients).
- `ArggonManager/docs/runbooks/release.md`: publish section for both packages (dependency order, `private` removal, post-publish verification, deprecate-not-unpublish rollback), the owner-only decision boundary, the post-release `ARGGON_REF` pin step, and the checklist as executable steps.
- Checklist executed up to the owner gate: `arggon --version` → `0.3.0 (cd24ec1, feat/task-native-dogfood-release)`; `npm pack --dry-run` rehearsal → 109 files / 328,481 B, `dist/cli.js` + plugin bundle present, no `.test.*`/`test-tmp` leakage.
- Deliberately NOT executed (product-owner decision): version bump, `private: true` removal, tag, npm publish.

**Gates**

- `npm test` 89 files / **1,454 tests** green · `npm run lint` clean · `npm run build` ok · `npm run check:plugin` exit 0 (bundle rebuilt + committed)
- `arggon validate` ok (0 warnings) · `arggon spec validate` ok · `context:report --strict` all bounds pass
- `smoke:tui` 13/13 · `smoke:opencode:wave` 2 fixtures / 0 failures · `smoke:opencode` **26 scenarios / 0 failures** (144 checks, exit 0). A first full run flaked 2 checks in the `/adopt` scenario while the model-driven wave smoke ran concurrently (a 300 s provider stall left the session half-done); the isolated `/adopt` re-run (3/3) and the clean full re-run both pass.

**Owner decision pending — publication/tagging (not taken; exact steps)**

1. Bump `0.3.0` → `0.4.0` in `package.json` (minor: new tools/commands/plugin/TUI/layout) and rename `[Unreleased]` to `## 0.4.0 (YYYY-MM-DD)`.
2. Remove `private: true` from `package.json` and `lib/package.json` in the release PR.
3. Merge to `main`, `git tag v0.4.0 && git push origin v0.4.0`, then `npm publish --workspace @arggondev/lib` followed by `npm publish` (kernel first — the root cannot resolve `@arggondev/lib` from the registry otherwise); verify `npm view` + a clean global install.
4. Follow-up PR: pin `ARGGON_REF: v0.4.0` in `templates/docs/github/workflows/arggon.yml`, re-run `init`, and switch README/ci.md to the registry one-liner.

**CI (draft PR #381, base `opencode2`)**
- `cli` (build + `check:plugin` + `npm test` + lint) — **pass** (3m55s).
- `tasks-validate` — the generated `.github/workflows/arggon.yml` (W6 recipe) running on the product repo — **pass** on both the push and the pull_request event (33 s / 31 s), including the committed-seam drift gate.

**Open questions / follow-ups**

- Committing `.github/workflows/arggon.yml` makes the product repo run the W6 recipe on every push (it clones the repo from GitHub at the moving `opencode2` ref). Reviewer may drop it if CI cost outweighs the seam drift gate; the seam migration itself does not depend on it.
- `smoke:opencode:wave` (cited by `opencode2.md`) is model-driven: a first run overlapped `npm test` and flaked on 2 reviewer-verdict checks; the isolated re-run passed 0 failures. Worth documenting "run alone".
- Tier-2 docs (`ARCHITECTURE.md`, `CHANGELOG.md`, `SUPPORT.md`, `runbooks/README.md`) are acked (adopter-owned) and intentionally not regenerated by `init`.

### handoff 2026-09-21 @Arggon — next: Coordinator review of draft PR #381 (base opencode2): verify the dogfood evidence, the ADR 0006 numbers (native tools 11,821 B <= 12,288 B advisory, item block 252 B <= 1,024 B) and the release docs,…
- branch: feat/task-native-dogfood-release
- open questions: Keep the committed .github/workflows/arggon.yml (product repo now runs the W6 recipe on every push; drift gate green) or drop it in review?; Owner decisions pending: version bump, private removal, ta…

### 2026-09-21 @Arggon
### 2026-09-21 @reviewer — Veredicto PR #381 (draft, base `opencode2`) — **MERGE** (merge commit, nunca squash)

Revisión del cierre W7 `task-native-dogfood-release`: 5 commits de trabajo (`b944d7f`…`cd24ec1`) + 2 de tracker; 25 archivos, +609/−169. Scope correcto: seam dogfood, trim del bundle, ADR 0006, docs de release, workflow CI y estado del tracker; `cli/`, `lib/`, `templates/` y `skills/` intactos.

**Verificado con evidencia propia (reproducido en el worktree)**

- **Gates**: `npm test` 89 archivos / **1.454 tests** ✓ · `npm run lint` ✓ · `npm run build` ✓ · `npm run check:plugin` exit 0 (bundle reconstruido byte-idéntico) ✓ · `arggon validate` ok 0 err/0 warn ✓ · `arggon spec validate` ok ✓ · `npm run context:report -- --strict` exit 0 con native **11.821 B ≤ 12.288 B** (467 B), item block 252 B, AGENTS.md 2.005 B, MCP 10.507 B ✓ · `smoke:tui` **13/13** ✓ · CI `cli` pass + `tasks-validate` pass (push y pull_request) ✓.
- **Provenance (no clobber)**: dry-run post-init = `created: []`, `updated` 25, `modified: [AGENTS.md, CONTRIBUTING.md]`, `skipped` 9. En copia limpia (sin `.git`, sin `node_modules`) con el CLI del propio branch: los 25 archivos de contenido quedan **byte-idénticos** (solo cambia `generatedAt` del state file); el hash del plugin vendorizado coincide con el checksum `x-generated` `988e2cd8…`; el comando del drift gate (`git status --porcelain -- . ':(exclude)ArggonManager/.convention.yml'`) devuelve vacío. Test adversarial: edité a mano `AGENTS.md` y `.opencode/plugins/arggon/index.ts`, re-corrí `init` → **ambos sobreviven** y se reportan en `modified[]` (nunca pisados). El plan "before" (created 10 / updated 15) es consistente con el PR: los 10 creados son los 8 derivados gitignored + `arggon-adopt.md` + workflow, y los 15 updates son 10 comandos + 3 agentes + `opencode.jsonc` + `.mcp.json`.
- **Trim ADR 0006 (sin cambio de semántica)**: el único cambio de contrato es quitar `additionalProperties: true` de `envelopeSchema` (12 outputs kernel) + acortar la descripción del namespace (129→104 B). Reconstruí el payload viejo: 11.821 + 336 (12×28 B) + 25 = **12.182 B exacto**. En JSON Schema ausente = `true`, así que no cambia el contrato; los **inputs** conservan `additionalProperties: false`; nada `required`/pinned cambió; bundle regenerado y drift-gated (`check:plugin` verde). ✓
- **Release docs**: `npm pack --dry-run` → **109 archivos / 328.480 B**, `dist/cli.js`, bundle y `templates/docs/github/workflows/arggon.yml` presentes, 0 fugas `.test.*`/`test-tmp` ✓. `runbooks/release.md` correcto (orden kernel→root, `private` en ambos packages, verificación post-publish, deprecate-not-unpublish, pin de `ARGGON_REF` post-release, frontera owner-only). CHANGELOG `[Unreleased]` cubre explícitamente el **default-path W3** (pérdida de auto-registro MCP al re-correr `init`). Sin bump/tag/publish: correcto. El workflow commiteado es **byte-idéntico al template** (no es copia divergente a mano).

**Hallazgos por severidad**

1. **Media (no bloqueante, resolver en este cierre)** — `spec-native-first-011` y `plan-native-first-011` siguen `status: proposed` (`ArggonManager/docs/specs/spec-native-first-011.md:4`, `ArggonManager/docs/plans/plan-native-first-011.md:5`) siendo éste el PR de cierre del programa y con la superficie ya anunciada como enviada en el CHANGELOG. `docs/agents.md` es explícito ("flip both statuses in the same PR as the implementation… never leave a shipped feature `proposed`") y el programa anterior lo hizo en su PR de cierre (`4c97ed3 docs(task-opencode2-dogfood): close the program — spec/plan implemented`). Acción: 2 líneas `proposed` → `implemented` antes del merge (el reviewer no puede editar; lo hace el coordinador) o follow-up inmediato. No rompe CI ni gates.
2. **Baja** — `CHANGELOG.md` (sección "Eleven native commands"): "…no CLI-driving prose, **no shell blocks**" es literalmente inexacto para 2 de los 11 comandos: `/arggon-adopt` incluye pasos sancionados de CLI headless (`npx arggon-manager init`, `adopt --ack`) y `/arggon-start` incluye `git push` + `gh pr create` (pasos explícitos por diseño). Sugerencia: matizar la frase (p. ej. "sin prosa que conduzca el CLI salvo el bootstrap headless de `/arggon-adopt` y el push/PR explícito de `/arggon-start`").
3. **Baja — opinión pedida sobre `.github/workflows/arggon.yml`: mantenerlo, pero acotarlo.** Razones para mantener: es el único job que ejercita el recetario generado **tal cual lo reciben los adopters**, incluido el drift gate del seam commiteado, a ~30-60 s. Razones para acotar: hoy corre en **cada push de cada rama** y en cada auto-commit de tracker, y el drift gate compara contra `ARGGON_REF: opencode2` **móvil**, así que cualquier PR que cambie `templates/`/bundle nace con `tasks-validate` rojo hasta que el cambio llegue a opencode2 (hoy no bloquea: `opencode2` no tiene branch protection; `main` solo exige `cli`). Recomendación: `on.push.branches: [main, opencode2]` + `pull_request` (como `ci.yml`) y/o filtro `paths`; el cambio va en `templates/docs/github/workflows/arggon.yml` + `arggon init` (el workflow commiteado está bajo su propio drift gate). Alternativa si el coste molesta: descartar el workflow commiteado y quedarse con el fixture `cli/src/headless-ci.test.ts` (ya ejecuta el recetario verbatim) — pero se pierde el gate de drift real.
4. **Informativo** — `smoke:opencode`/`wave` son model-driven y sensibles a contención: documentar "correr solo" en `docs/opencode2.md`/playbook (1 línea) es razonable. No bloquea.

**No verificado / límites (honesto)**

- `smoke:opencode` completo (26/0) **no lo reproduje yo**: el `smoke:opencode:wave` seguía corriendo en fase 3 al publicar (todos los checks emitidos hasta ahí ok: permisos allow/deny, fase 1 plan, fase 2 dos workers foreground con worktrees disjuntos, push y claim). Uso como evidencia la del worker: wave 2 fixtures/0 fallos y smoke full 26/0 con un flake de `/adopt` (2 checks) bajo contención con el wave, re-corrido aislado limpio (3/3). Los gates deterministas y el `smoke:tui` 13/13 sí están reproducidos por mí.
- La captura manual del panel sobre este repo (277 items) no la reproduje (requiere PTY interactivo); el header del board está cubierto por el smoke de fixture y el caveat del worker es honesto.
- `arggon_comment` (MCP) no funciona en esta sesión: el bin global `/home/arggon/.local/bin/arggon` apunta a otro checkout (`/home/arggon/Projects/ArggonManager/dist/cli.js`, layout viejo) y no encuentra el tracker v5. Publiqué este veredicto con `npm run arggon -- comment` desde el repo primario (misma operación y auto-commit del tracker). Es ruido de entorno, no un defecto del PR.

**Veredicto: MERGE (merge commit, nunca squash).** Sin bloqueantes; el hallazgo 1 conviene resolverlo en el mismo cierre (2 líneas de status) y 2/3/4 son follow-ups opcionales. No marco `done` — la completitud es del coordinador tras el merge. La decisión de bump/tag/publish queda en el product owner, como indica el item.

### 2026-09-21 @Arggon
### 2026-09-21 @reviewer — Addendum: wave smoke reproducido

El `smoke:opencode:wave` terminó después de publicar el veredicto: **2 fixtures / 0 failures, exit 0**, con todos los checks verdes (permisos allow/deny, fase 1 plan, fase 2 dos workers foreground con worktrees disjuntos, verdicts de reviewer, fase 4 merge + done + `arggon validate` green + push). Queda como reproducido por el reviewer; el `smoke:opencode` completo (26/0) sigue sin re-correr por mí — evidencia del worker con el flake de `/adopt` re-corrido limpio. El veredicto previo (**MERGE**, merge commit) no cambia.

### 2026-09-21 @Arggon
### Review findings closed (worker, 2026-09-21) — PR #381, head `604eb6d`

The reviewer verdict was **MERGE** with non-blocking findings; all four are addressed in the PR (plus a merge of `origin/opencode2` that brings the verdict itself into this item copy — the tracker union keeps both comment sets and the claimed frontmatter).

**F1 (media) — spec/plan status** (`1831820`)

- `spec-native-first-011`: `proposed` → `implemented`; `plan-native-first-011`: `proposed` → `implemented`, plus the recorded W7 evidence block (task-opencode2-009 precedent style).
- Rule: `ArggonManager/docs/agents.md` §Specs and plans — "when the feature lands, flip both statuses in the same PR as the implementation (never leave a shipped feature `proposed`)"; precedent `4c97ed3` (task-opencode2-009 closing).
- Expected/observed: `arggon spec validate` ok; `arggon spec analyze` reports **0 findings for native-first-011** (it stays cited by the plan, so no "implemented spec nobody cites"; the 5 remaining ambiguity warnings are pre-existing in other specs).

**F2 (low) — CHANGELOG wording** (`84617f7`)

- Expected: the W3 "no shell blocks" claim matches the shipped commands. Observed: `/arggon-adopt` carries the sanctioned headless bootstrap (`npx arggon-manager init`, `adopt --ack`) and `/arggon-start` the explicit publish steps (`git push`, `gh pr create --draft`). The entry now names them instead of denying them.

**F3 (low, reviewer decision: keep the workflow) — scoped events + self-bootstrap exclusion** (`3476686`)

- `templates/docs/github/workflows/arggon.yml`: `on.push.branches: [main, opencode2]` + `pull_request` (comment tells adopters to adjust the list to their default branch(es)); the drift gate now excludes `.github/workflows/arggon.yml` from its comparison — a self-bootstrapping runner cannot be gated against its own pinned ref (its trigger/template change reaches that ref only after merge), which is exactly what made a template-changing PR red.
- Regenerated with `npm run arggon -- init --no-commit` (not by hand): committed copy == marker + template (byte-identical, verified).
- Fixture: `cli/src/headless-ci.test.ts` adds the matching assertion — a local edit of the vendored workflow must NOT fire the gate (and the AGENTS.md mutation must still fire it); `ArggonManager/docs/ci.md` documents the trigger scoping and the exclusion.
- Expected/observed on this PR: before, a template-changing PR was red by construction; now `tasks-validate` on the PR event is **pass (33 s)** even though the committed workflow differs from the pinned ref's render.

**F4 (info) — model-driven smokes** (`84617f7`)

- "Model-driven and timing sensitive: run each one alone" documented in `docs/opencode2.md` (verify block), `docs/playbooks/opencode.md` (evidence section), `docs/agents.md` (evidence harness) and both harness headers (`smoke/opencode-smoke.ts`, `smoke/opencode-wave.ts`).

**Gates (head `604eb6d`, after the review fixes)**

- `npm test` 89 files / **1,454 tests** green · `npm run lint` clean · `npm run build` ok · `npm run check:plugin` exit 0
- `arggon validate` ok (0 warnings) · `arggon spec validate` ok
- `npm run context:report -- --strict` exit 0, `regressions: []`: native tools 11,821 B ≤ 12,288 B (15 definitions, 9 pinned), item block 252 B ≤ 1,024 B, AGENTS.md 2,005 B ≤ 2,048 B, MCP 10,507 B ≤ 12,288 B
- `npm run smoke:opencode` **26 scenarios / 0 failures** (144 checks, exit 0) — run alone, no concurrent harness
- CI on `604eb6d`: `cli` **pass** (3m57s) · `tasks-validate` **pass** (33s, PR event)

**Open questions / notes**

- The exclusion only removes the self-referential case: a PR that changes _command/agent/config_ templates is still red against the pinned moving `opencode2` ref until the change lands there — inherent to the ref-based gate; the post-release step pins `ARGGON_REF` to the tag (release runbook step 6).
- Owner decisions unchanged and still pending: bump `0.3.0` → `0.4.0`, remove `private`, tag `v0.4.0`, `npm publish` both packages (kernel first), pin `ARGGON_REF`.

### handoff 2026-09-21 @Arggon — next: Coordinator: re-review the review-fix commits (1831820 F1, 84617f7 F2+F4, 3476686 F3) plus the origin/opencode2 merge (604eb6d) in PR #381 — CI green (cli pass, tasks-validate pass), mergeState CLEAN…
- branch: feat/task-native-dogfood-release
- open questions: The workflow self-exclusion only removes the self-referential red: a PR that changes command/agent/config templates still fails the drift gate against the moving opencode2 ref until the change lands …
