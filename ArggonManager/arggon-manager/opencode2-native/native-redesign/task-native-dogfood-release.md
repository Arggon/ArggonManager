---
type: task
status: todo
id: task-native-dogfood-release
title: "Dogfood, ADR 0006 measurement and release"
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
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

- [ ] ADR 0006 budgets re-measured and within limits; item block ≤ 1024 B.
- [ ] Dogfood scenarios green on this repo's own tracker.
- [ ] Packaging/release docs updated; release checklist executed.
- [ ] Release notes cover the W3 default-path change: the plugin no longer
      auto-registers the MCP server; an adopter re-running `init` loses
      auto-registration unless they configure the stanza (`doctor` reports it
      as optional).
- [ ] `arggon validate` and `spec validate` green.

## Notes

- Watch the ADR 0006 native-tools headroom: after W4/W5 the advisory bound is
  at 12,182 B ≤ 12,288 B (~106 B). Re-measure and either trim schemas, decide
  `options.pinned`, or raise the bound deliberately in this wave.

- Depends on W3–W6; this is the program's closing gate.

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
