---
type: task
status: in_progress
id: task-native-commands-seam
title: Native commands + seam without MCP
assignee: Arggon
branch: feat/task-native-commands-seam
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T13:01:35.069Z"
depends_on: [task-native-tools]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-commands-seam
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-commands-seam.md
  Leaves live only under a story. id is the filename stem: task-native-commands-seam.
  CLI `arggon create task native-commands-seam` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native commands + seam without MCP (W3)

## Context

W3 of `plan-native-first-011`. Replace the CLI-driving commands with native commands that drive tools (including `/arggon-adopt` for guided
adoption); regenerate the config seam without the MCP stanza; ship the vendored single-file plugin build; update the AGENTS.md router and the skill. ADR 0011 decision 5/6.

## Acceptance

- [x] Fresh-`init` fixture yields the new seam (no MCP stanza) plus one headless scenario per command.
- [x] `init` stays idempotent with provenance and never overwrites adopter files.
- [x] The vendored plugin is single-file and loads in a dependency-less fixture.
- [x] AGENTS.md router and skill describe the native surface (no CLI-driving prose).
- [x] Session↔item correlation recognizes Code Mode `tools.arggon.<name>(…)`
      calls, not only MCP `arggon_*` names (plugin regex at `index.ts:703`);
      otherwise correlation regresses when MCP is dropped.
- [x] Catalog budget: evaluate `options.pinned` on core tools as the W3 lever
      (pinning all 12 may exceed the ADR 0006 budget).

## Notes

- The W2 `loadArgonKernel()` failure-cache becomes moot if W3 ships a
  bundled single-file plugin (verify).

- Depends on W2; supersedes the ADR 0010 seam incrementally.

### 2026-09-20 @Arggon
W3 native commands + seam without MCP — implemented on `feat/task-native-commands-seam`.

Seam (ADR 0011 §5/§6, ADR 0013)

- `templates/docs/opencode.jsonc` keeps formatter + compaction `keep.tokens` and drops the `mcp.servers.arggon` stanza; the plugin no longer touches `ctx.mcp`. MCP stays available through `arggon mcp`/`.mcp.json` for other clients, and `doctor` now reports a present stanza as _optional_ (removal guidance) instead of recommending registration; `.mcp.json`-only is the expected shape (no hint).
- All eleven native command templates drive the tools (Code Mode `tools.arggon.*`) and write the methodology artifacts directly; `/arggon-adopt` is new; `agent:`/`subagent:` where they apply (done/adopt → coordinator, review → reviewer + subagent); no CLI-driving prose, no shell blocks.
- AGENTS.md router, the `arggon-cli` skill (SKILL.md + json-contract reference), `docs/agents.md` (MCP server + OpenCode V2 sections), the OpenCode playbook, `docs/opencode2.md`, `docs/json-output.md` (doctor hint) and README describe the native surface.

Vendored bundle (single-file, dependency-free)

- `npm run build:plugin` (postbuild) generates `opencode/plugins/arggon/index.bundle.ts` from `opencode/plugins/arggon/index.ts` with `@arggon/lib` inlined: 36 modules, 282,381 B, deterministic (md5 92fc312c…); the only bare import left is `node:module`. No bundler dependency (TypeScript compiler API + a tiny ESM module registry).
- `init` vendors that artifact to `.opencode/plugins/arggon/index.ts` with the standard `//` provenance marker and x-generated state; `cli/src/plugin-copy.test.ts` regenerates artifact + vendored copy and pins the bytes.
- `opencode/plugins/arggon/bundle.test.ts` copies the artifact to a temp dir with **no `node_modules`**, imports it, runs `setup()` and calls tools: 12 tools registered (namespace/codemode), the pinned subset exact, `list`/`show` envelopes, `SHOW_FAILED` typed error.

Correlation

- `parseArggonItemFromCode` now matches `tools.arggon.<name>(…)` alongside the MCP `arggon_*` spelling (module-level global regexes reset `lastIndex` between calls); `parseArggonItemFromTool` accepts `arggon.<name>`/`tools.arggon.<name>`. Unit tests cover native calls + coexistence; the smoke's context-storage scenario correlates from an observed native `tools.arggon.show` call.

Catalog budget (`options.pinned`)

- Core eight tools register `options.pinned: true` (list/create/update/show/next/validate/comment/handoff); the maintenance four (report/priority/sync/import_issues) stay unpinned and search-reachable. `nativeToolSchemas`/`nativeToolsCatalogBytes` carry the flag and `context:report` prints the pinned count.
- `npm run context:report -- --strict` → all bounds pass: native 12 tools (8 pinned) 11,097 B ≤ 12,288 B advisory; AGENTS.md 1,959 B ≤ 2,048; item block 252 B ≤ 1,024; fixed total 24,505 B.

Gates

- `npm test` → 86 files / 1393 tests green; `npm run lint` clean; `npm run build` ok; `arggon validate` ok (0 warnings); `arggon spec validate` ok (18 docs); `npm run smoke:opencode` → `npm run smoke:opencode` → **23 scenarios / 0 failures** (104 checks, incl. 33 command checks over the 11 commands) on opencode v2.0.10; `npm run context:report -- --strict` → all bounds pass.

Open questions / follow-ups

- `options.pinned` is an undocumented 2.0.10 runtime option (probe: the runtime's own `session_move` uses it); treated as feature-detected — if a future 2.x ignores/drops it, every tool stays reachable through `search`.
- This repo's own tracked `.opencode/commands/*.md` (dogfood seam) still carries the W2 templates; W7 migrates the repo's own seam per the plan.
- `npm run smoke:opencode:wave` was not updated/run for W3 (it drives the CLI/MCP wave; W4/W7 territory).
- MCP auto-registration removal means an adopter who wants the stdio server must configure `mcp.servers.arggon` explicitly (doctor reports it as optional) — intended per ADR 0011 §5.

### handoff 2026-09-20 @Arggon — next: Coordinator review of draft PR #376: verify the W3 evidence (smoke 23/0, context:report --strict) and merge with a merge commit (tracker auto-commits live on this branch, never squash).
- branch: feat/task-native-commands-seam
- open questions: options.pinned is an undocumented 2.0.10 option (feature-detected; core 8 pinned, all 12 still search-reachable); this repo's own tracked .opencode/commands dogfood still carries the W2 templates (W7…

### 2026-09-20 @Arggon
### 2026-09-20 @Arggon — revisión (PR #376, `feat/task-native-commands-seam@082802b`, base `opencode2@8049a4d`; draft, CI `cli` pass)

**Veredicto: no-merge** — 1 hallazgo bloqueante (gate anti-drift del artefacto). Todo lo demás verificado en verde y el artefacto actual es correcto; el fix es chico y acotado a tests/CI.

**Verificado por mí (reproducido en el worktree salvo lo indicado)**

- **Artefacto == regenerado**: `buildPluginBundle()` en memoria → md5 `92fc312c77ae9d50aa216dea9e55c600`, 282.381 B, 36 módulos, 145 edges; `npm run build` (postbuild → `build:plugin`) reporta 36 módulos / 282.381 B y el md5 no cambia. Único import estático `node:module`; los `require` residuales son builtins `node:*`; sin `@opencode/plugin` ni `ctx.mcp` en el bundle. Determinismo byte-idéntico bajo C/en_US/tr_TR.
- **Gates**: `npm test` 86 archivos / **1393 tests** verdes; `npm run lint` limpio; `arggon validate` ok (0 warnings); `arggon spec validate` ok; `context:report --strict` → todos los bounds pasan (AGENTS 1.959 ≤ 2.048; native 12 tools / 8 pinned 11.097 ≤ 12.288 adv.; item block 252 ≤ 1.024; fijo 24.505).
- **Smoke bloqueante**: `npm run smoke:opencode` reproducido → **23 escenarios / 0 fallos (104 checks), exit 0**: seam fresh sin stanza MCP + bundle dependency-less con los 12 tools; **una sesión headless por comando (11/11)** con sus artefactos/efectos (start/done por update, handoff, review-comment, adopt-create, spec/adr/explore/playbook escriben el artefacto); correlación desde un `tools.arggon.show` observado; never-clobber, failure isolation, plugin ausente e higiene.
- **`options.pinned`**: opción real de 2.0.10 (el runtime registra su `session_move` con `options:{...,pinned:!0}`); el plugin pinea exactamente los 8 core y los 4 de mantenimiento siguen en `search`. Si un 2.x futuro la ignora, no hay crash (opciones desconocidas se ignoran; cada `add` está aislado).
- **Upgrade W2→W3 de `init`** (probe base→branch, 2 fixtures): plugin intacto → `updated` al bundle y `opencode.jsonc` → `updated` sin stanza; plugin editado por el adoptante → `modified`+`skipped` con su edit preservado. Idempotencia/provenance OK.
- **Base**: el PR está 1 commit detrás (8049a4d: solo tracker de task-native-tools), MERGEABLE/CLEAN.

**BLOQUEANTE — los tests auto-reparan el artefacto commiteado: nunca fallan por drift**

- `cli/src/plugin-copy.test.ts:22-29` (`regenerateBundle`) **reescribe** `opencode/plugins/arggon/index.bundle.ts` cuando difiere y recién después hace `expect(bundleOnDisk()).toBe(code)` (línea 45). `opencode/plugins/arggon/bundle.test.ts:54-58` hace lo mismo y además importa la copia ya reescrita. Validan el builder, nunca los bytes commiteados.
- Repro (copia limpia de HEAD en `/tmp`, sin tocar el worktree): cambié una descripción en `opencode/plugins/arggon/index.ts` sin regenerar y corrí los dos archivos → **7/7 pass** y `index.bundle.ts` quedó silenciosamente reescrito con el cambio.
- CI no lo atrapa: `prepare`/`npm ci` y `npm run build` (postbuild → `build:plugin`) regeneran el artefacto en el runner **antes** de `npm test`, y no hay `git diff --exit-code`. Un PR con el artefacto stale queda verde y se mergea: la copia que `init` vendoriza a los adoptantes queda vieja. Con "stage explicit paths only" del worker template, es un escenario probable, no teórico.
- Contradice el claim del PR ("regenerate it and pin the bytes"), el del comentario del worker ("pins the bytes") y docs que dicen "byte parity pinned by tests" (`ArggonManager/docs/agents.md`, `docs/opencode2.md`, playbook). El precedente `skill-copy.test.ts` auto-repara una copia **gitignoreada**; acá el artefacto es commiteado y es el entregable central de W3.
- Fix sugerido: comparar **antes** de escribir y fallar si el artefacto commiteado difiere (auto-sanar solo la copia derivada `.opencode/...`), o un `check:plugin`/`git diff --exit-code` en CI. Con eso el resto queda mergeable.

**Menores (no bloquean solos)**

- El smoke corre el *cuerpo* de cada comando como prompt: no pasa por el loader V2 de comandos, así que frontmatter (`agent:`, `subagent: true`) y descubrimiento de `/arggon-*` no quedan cubiertos end-to-end. El schema del runtime sí acepta `subagent` (`subtask` como alias); un check barato de frontmatter cerraría el flanco.
- `templates/docs/opencode/commands/arggon-status.md` usa sintaxis CLI de filtros (`status:blocked`) en un ejemplo de `tools.arggon.list` (input nativo: `status` / `filter`); mejor `{ status: "blocked", stale: true }`.
- Nit: el docstring de `opencode/plugins/arggon/typecheck.test.ts` sigue mencionando el import computado de `@opencode/plugin`, eliminado en este PR.

**Decisión crítica que señalo explícitamente — retirada del auto-registro MCP**

El plugin ya no toca `ctx.mcp` y la stanza sale del seam: consistente con ADR 0011 §5/§6 ("MCP fuera del default path") y con el alcance; `arggon mcp` y `.mcp.json` quedan intactos para otros clientes y `doctor` reporta la stanza presente como opcional (semántica nueva cubierta por tests). Consecuencia visible e intencional: en un adoptante existente, el re-run de `init` (provenance untouched) reemplaza el plugin W2 por el bundle y **pierde el auto-registro MCP** salvo que configure la stanza explícitamente; está documentado en README/docs/agents/opencode2/playbook y merece nota de release en W7. Sin objeción de arquitectura.

**Fuera de alcance, OK**: el dogfood propio (`.opencode/commands` trackeados) sigue W2 y `smoke:opencode:wave` no se tocó; ambos W4/W7 y declarados.

**No verificado**: `smoke:opencode:wave` (W4/W7) y `/arggon-*` a través del loader real de comandos V2 (limitación M1).

**Recomendación: no-merge** hasta cerrar el gate anti-drift. Con ese fix, y con los gates ya reproducidos arriba, la recomendación pasa a **merge con merge commit** (nunca squash). No marcar `done` todavía.

### 2026-09-20 @Arggon
Review F1 (blocking) — fixed on 609383b; PR #376 rework evidence.

Drift gate: cli/src/plugin-copy.test.ts now builds in memory and asserts the committed artifact bytes equal the build BEFORE any write (fails with 'opencode/plugins/arggon/index.bundle.ts is stale — run npm run build:plugin and commit the artifact'); bundle.test.ts is read-only. Reviewer repro reproduced: shortening a tool description in the plugin source without rebuild → drift test FAILS (1 failed | 3 passed) and npm run check:plugin exits 1 with the artifact diff; revert → green. Auto-heal remains only for the derived gitignored .opencode copy (skill-copy precedent).

CI gate: new npm run check:plugin (build:plugin + git diff --exit-code on the artifact) wired into the cli workflow after npm run build; npm run build:plugin stays the explicit sync.

Docs: agents.md, opencode2.md, playbooks/opencode.md, cli/src/docs.ts, plugin-bundle.ts, build-plugin.ts and the plugin header now describe the assert-before-write test + CI gate instead of 'pinned by tests'.

Minors: /arggon-status uses the native list input ({ status: 'blocked' } / { stale: true }; filter DSL noted); typecheck.test.ts docstring drops the removed @opencode/plugin mention; init-opencode.test.ts validates every generated command's frontmatter (description, agent in coordinator/reviewer, subagent boolean; done/adopt -> coordinator, review -> reviewer + subagent:true) and the smoke header documents that it runs bodies, not the V2 command loader.

Gates on 609383b: npm test 86 files / 1394 tests green; lint clean; build ok; check:plugin exit 0; argpon validate ok (0 warnings); spec validate ok (18 docs); smoke:opencode 23 scenarios / 0 failures (104 checks); context:report --strict all bounds pass (AGENTS 1,959<=2,048; native 12/8 pinned 11,097<=12,288; item block 252<=1,024; fixed 24,505); CI cli pass (run 35520486608).

### handoff 2026-09-20 @Arggon — next: Coordinator re-review of draft PR #376 on 609383b: F1 fixed (assert-before-write drift gate + check:plugin in CI), minors closed; verify the repro and merge with a merge commit (never squash).
- branch: feat/task-native-commands-seam
- open questions: options.pinned is undocumented (feature-detected; core 8 pinned, all 12 search-reachable); repo dogfood .opencode/commands still W2 (W7); smoke:opencode:wave not updated (W4/W7); context:report --str…
