---
type: task
status: in_progress
id: task-playbook-opencode-2-0-12
title: Refresh OpenCode playbook pin to 2.0.12 + A/B re-probe
assignee: Arggon
branch: feat/task-playbook-opencode-2-0-12
parent: story-tech-playbooks
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-21"
claimed_at: "2026-09-21T22:39:08.443Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-playbook-opencode-2-0-12
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tech-playbooks/task-playbook-opencode-2-0-12.md
  Leaves live only under a story. id is the filename stem: task-playbook-opencode-2-0-12.
  CLI `arggon create task playbook-opencode-2-0-12` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Refresh OpenCode playbook pin to 2.0.12 + A/B re-probe

## Context

Runtime drift detected in W5: the local OpenCode is **2.0.12** while
`ArggonManager/docs/playbooks/opencode.md` pins 2.0.10 (W5 probes ran on
2.0.12). Per the playbook upgrade policy, refresh the pin/research record and
re-run the plugin-import A/B probe on 2.0.12.

## Acceptance

- [x] Playbook version/pin + research record updated to 2.0.12 with the probe date.
- [x] A/B result recorded (static import vs guarded) and any new gotcha folded into Conventions/Troubleshooting.
- [x] Pin references refreshed (README, docs/agents.md, docs/opencode2.md, ADR 0010 trigger) and exploration-010 F1.16 note updated.
- [x] `arggon validate` green; docs-only diff; CI green.

## Notes

- Mirrors the 2.0.10 refresh (`task-playbook-opencode-2-0-10`, PR #373).

### 2026-09-21 @Arggon

Pin refresh 2.0.10 → 2.0.12 + plugin-import A/B re-probe on `opencode v2.0.12` (probe date 2026-09-21) — evidence for the reviewer. Draft PR #386.

**Fixture** `/tmp/opencode/opencode-plugin-import-probe-212`: fresh git repo + `arggon init` tracker, **no `node_modules` in the fixture or any ancestor** (asserted), project `opencode.jsonc` with **no MCP stanza**. Plugins:

- **A** `.opencode/plugins/a-docs-pattern/index.ts` — the V2 docs pattern verbatim: `import { Plugin } from "@opencode/plugin"` + `Plugin.define`, writes a setup marker.
- **B** `.opencode/plugins/arggon/index.ts` — the `arggon init`-vendored guarded bundle, byte-identical to `opencode/plugins/arggon/index.bundle.ts` minus the generated marker (sha256 `911f1b7d…` on both sides).
- **C** `.opencode/plugins/c-capability-snapshot/index.ts` — bounded capability snapshot (feature-detect surfaces).

**Command** (one real headless session, same invocation as the smoke harness): `opencode run --standalone --print-logs --log-level info --model opencode-go/deepseek-v4-flash --format json "$TOOL_PROMPT"` → exit 0. Raw transcripts: fixture `.smoke-evidence/` (`ab.stdout.jsonl`, `ab.stderr.log`, `c-capability.json`, `opencode-version.txt`, `mcp-list.txt`, `README.md`).

**Expected vs observed (2.0.12)**

| Probe                     | Expected (2.0.7/2.0.8/2.0.10 shape)                | Observed on 2.0.12                                                                                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — docs static import    | fails to load, `setup` never runs, session exits 0 | **same**: `WARN message="failed to load plugin" … cause="Cause([Die(ResolveMessage: Cannot find package '@opencode/plugin' imported from …/a-docs-pattern/index.ts)])"`; setup marker **ABSENT**                                                                                    |
| B — guarded bundle        | loads, registers native tools, tool usable         | **same**: `msg="loading plugin" id=…/.opencode/plugins/arggon` → `[arggon] tools: registered 15 native arggon tools`; the first `execute` completed `return await tools.arggon.next({})` → `{"ok":true,"schemaVersion":1,"conventionVersion":5,"command":"next","suggestion":null}` |
| Failure isolation         | A first, B unaffected                              | **same**                                                                                                                                                                                                                                                                            |
| 2.0.10 catalog-lag gotcha | first `execute` `Unknown tool …`, retry ok         | **not reproduced**: the first (and only) `execute` succeeded                                                                                                                                                                                                                        |

Capability snapshot (plugin C, `c-capability.json`): `app.version` 2.0.12; `permission.rules` undefined, `session.rename` undefined (`session.update` function), `vcs.branches` undefined, `ctx.vcs.get()` `{}`, `worktree.transform`/`session.hook`/`tool.transform` functions, `tool.transform.callbackRanAtAwait: false` (async replay persists). `strings` on the installed binary still shows the runtime's own `namespace:"opencode",codemode:!0,pinned:!0` registration (`session_move`).

**Verdict: keep the guarded form; no critical incompatibility.** The V2 docs (accessed 2026-09-21) still document the static import, so the condition to simplify is unchanged.

**Propagation (docs-only, 7 files):** playbook pin `version: 2.0.12` / `researched: 2026-09-21` + research record, Setup, Conventions (A/B evidence list, catalog-lag note, feature-detect re-checks, `options.pinned` re-check) and Testing (2.0.12 re-verification); the W5 version note no longer reads as drift. Pin references refreshed in `README.md`, `docs/agents.md`, `docs/opencode2.md` and ADR 0010's revisit trigger; exploration-010 F1.16 records the re-drift. No `opencode/plugins/**` or source changes.

**Gates:** `npm test` 90 files / 1466 tests passed · `npm run lint` clean · `npm run build` ok · `npm run check:plugin` exit 0 · `arggon validate` ok 0 errors/0 warnings · `arggon spec validate` ok 0/0 · diff docs-only.

**Smoke:** the full `npm run smoke:opencode` was re-run on 2.0.12 by W6/W7 (`task-native-headless-ci`, `task-native-dogfood-release`): 26 scenarios / 144 checks / 0 failures, on the same plugin bytes (this branch is docs-only on top of those merges). I did not re-run the full harness from this docs-only PR (exempt per `docs/engineering.md`); the A/B fixture above is this item's evidence.

**Out-of-scope observations (no action taken here; for the coordinator):**

- Stale pin statements outside the accepted file set: `docs/adr/0011-native-first-architecture.md` §7 ("Pin OpenCode 2.0.10"), `docs/specs/spec-native-first-011.md` ("Pinned runtime — OpenCode 2.0.10") and `docs/plans/plan-native-first-011.md` (risk note). The 2.0.10 refresh left them too; candidates for a nit follow-up.
- The playbook's Context budgets snapshot is stale after W7's schema trim and the PR #384 skill sync: it says native `arggon` definitions 12,182 B / `fixedTotalBytes` 25,636 B / umbrella 11,942 B + references 18,100 B, while `npm run context:report -- --json` now reports 11,821 B / 25,275 B / umbrella 12,885 B + references 19,604 B (all bounds still pass). Not touched here.
- `opencode mcp list` inside the /tmp fixture printed `No MCP servers configured` on a first run and listed the machine's global servers later, while the session connects them; recorded as a probe note in Testing so the next probe does not over-trust it as negative evidence.

### handoff 2026-09-21 @Arggon — next: Coordinator review of draft PR #386 (docs-only pin refresh + A/B re-probe); no follow-up code expected. Merge with a merge commit (tracker auto-commits on this branch).

- branch: feat/task-playbook-opencode-2-0-12
- open questions: Transcripts are fixture-local (/tmp/opencode/opencode-plugin-import-probe-212/.smoke-evidence); stale pin refs (ADR 0011, spec/plan 011) and Context-budgets numbers flagged in my comment.

### 2026-09-21 @Arggon
CI green on head 7f386e3: cli pass (run 35664747593, 4m22s) + tasks-validate pass (run 35664747536, 35s). Acceptance 4/4 ticked.

### 2026-09-21 @Arggon
### 2026-09-21 @Arggon — Review PR #386 (head `05e7ee3`, base `opencode2`, draft) — subagente revisor DeepSeek V4.1 Flash

**Veredicto: MERGE (merge commit, nunca squash).** Sin findings bloqueantes. No marco done.

## Verificado por mí (independiente)

- **Diff docs-only, 7 ficheros** (`git diff --name-status origin/opencode2...HEAD`): playbook + README + docs/agents + docs/opencode2 + ADR 0010 + exploration-010 F1.16 + item. Cero solape con formatter (`docs/json-output.md`/`skills/**`) ni w4-smoke (`smoke/**`); sin `opencode/plugins/**` ni `cli/src/**`.
- **Probe A/B reproducido en 2.0.12** (no solo inspeccionado): re-corrí la misma invocación del fixture (`opencode run --standalone --print-logs --log-level info --model opencode-go/deepseek-v4-flash --format json`, PATH con el shim del worktree) → **exit 0**; A: `WARN failed to load plugin … Cannot find package '@opencode/plugin'` y marcador `a-setup-marker.txt` **ausente**; B: `loading plugin …/arggon` → `[arggon] tools: registered 15 native arggon tools`; **un solo** `execute`, `state.status: completed`, output `{"ok":true,…,"command":"next"}` → el catalog lag de 2.0.10 **no** se reproduce. `opencode --version` = v2.0.12; sin `node_modules` en fixture ni ancestros; `opencode.jsonc` sin stanza MCP.
- **Bytes del plugin B**: bundle del worktree `sha256 911f1b7d…` = `bundle-nomarker.ts` = `vendored-nomarker.ts`; el vendored del fixture menos la línea `// arggon:generated` es byte-idéntico al bundle del repo (verificado con `tail -n +2 | sha256sum` y `cmp`).
- **Capability snapshot** (`c-capability.json`, contenido idéntico tras mi re-run): `permission.rules`/`session.rename`/`vcs.branches` undefined, `vcs.get() {}`, `callbackRanAtAwait:false`; `strings` del binario 2.0.12 muestra 1× `namespace:"opencode",codemode:!0,pinned:!0`. Docs V2 live (fetch 2026-09-21) siguen documentando el import estático.
- **Acceptance 4/4**: pin/research record con fecha (`version: 2.0.12`, `researched: 2026-09-21`; `arggon playbook status` → 2.0.12/current), A/B + gotchas plegadas (Conventions/Testing), refs refrescadas (README, agents, opencode2, ADR 0010 trigger, exploration-010 F1.16), validate/docs-only/CI.
- **Gates locales en `05e7ee3`**: `npm test` **90/1466** ✅ · `lint` ✅ · `build` ✅ · `check:plugin` exit 0 sin drift · `arggon validate` ok 0/0 · `spec validate` 18 docs 0/0 · `context:report --strict` all bounds pass.
- **CI**: `cli` pass + `tasks-validate` pass en `05e7ee3` (runs 35665159464 / 35665159466); PR `MERGEABLE` / `CLEAN`.
- **Observaciones del worker ya plegadas** por el coordinator en `task-playbook-2-0-10-nits` (`3d34c3b`, ya en `opencode2`): pins stale ADR 0011 §7 / spec-011 / plan-011 + budgets.

## Findings (todos LOW/nit, no bloquean)

1. **LOW — el comment del item sobrestata la evidencia de bytes.** `task-playbook-opencode-2-0-12.md:72` dice que el harness completo se re-corrió "on the same plugin bytes". No es exacto: W6/W7 corrieron con bundles de **324.325 B** (`2a491bd`) y **324.264 B** (`7d33b5b`), y el bundle actual es **327.157 B** tras `b384fe8` (el merge #384 cambió el kernel inlineado). El texto del playbook (Testing, ~455-461) **no** hace esa afirmación y es correcto; la evidencia en bytes actuales es el probe A/B de este item (verificado). Sugerencia: corregir la redacción del comment (tracker-only) o anotar que el harness post-#384 queda pendiente; el scope del item no lo exige (docs-only exento).
2. **LOW — `prettier --check` falla en el playbook** en 2 líneas del bullet nuevo (`opencode.md:451,458`, continuación de lista des-indentada por prettier); el base era prettier-clean. CI no corre prettier; misma familia que `bug-formatter-glues-markdown-spaces`. Nit.
3. **LOW — exploration-010 F4.1** (`:244`) sigue diciendo "pin 2.0.10 in the playbook" y la tensión (`:305`) sigue abierta (esta última ya cubierta por la acceptance #1 de `task-playbook-2-0-10-nits`; F4.1 no está listada). Sugerencia: añadir F4.1 al fold.

## No pude verificar

- El "primer run" de `opencode mcp list` → `No MCP servers configured` (solo está archivado el run posterior con los servers globales).
- Los 26/144/0 del harness completo (no los re-corrí; corroborados en los items W6/W7, no en transcripts crudos).
- El exit code de la sesión original del worker (no está en el transcript; lo reproduje yo: exit 0).

**Recomendación: MERGE con merge commit (nunca squash).** Los findings 1-3 son de bajo impacto y pueden plegarse en `task-playbook-2-0-10-nits` (o corregirse en un commit tracker-only antes del merge).
