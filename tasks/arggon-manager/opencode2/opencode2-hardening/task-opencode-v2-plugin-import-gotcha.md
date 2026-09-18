---
type: task
status: in_progress
id: task-opencode-v2-plugin-import-gotcha
title: "Plugin import gotcha: static @opencode/plugin import fails without node_modules (v2.0.7)"
assignee: Arggon
branch: feat/task-opencode-v2-plugin-import-gotcha
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T13:30:08.007Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode-v2-plugin-import-gotcha
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode-v2-plugin-import-gotcha.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-plugin-import-gotcha.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin import gotcha: static @opencode/plugin import fails without node_modules (v2.0.7)

## Context

Finding **F1** from the independent review of PR #325 (W2), reproduced twice on
real `opencode v2.0.7`: the pattern the V2 plugin docs show —
`import { Plugin } from "@opencode/plugin"` — makes an **auto-discovered**
plugin under `.opencode/plugins/` fail to load when the tree has no
`node_modules` (`Cannot find package '@opencode/plugin'`; the session still
exits 0, the plugin is skipped with a warning). `Plugin.define` is identity, so
the shipped plugin avoids the import with a guarded dynamic import plus a
plain-object default export (`{ id, setup }`), which loads and runs.

The workaround is documented in the plugin source and the item body, but the
playbook only says "dependency-free": the gotcha and the condition to drop the
workaround are not recorded, and nothing tracks re-verification on the next 2.x
(ADR 0010's V2-churn revisit trigger).

## Acceptance

- [x] `docs/playbooks/opencode.md` (Conventions) records: the documented static
      import fails without `node_modules` on 2.0.7; the bundled plugin's guarded
      pattern is the supported form; and the condition to simplify it (when the
      runtime resolves `@opencode/plugin` in dependency-less trees, or the docs
      change) — with the PR #325 probe as evidence.
- [x] ADR 0010's revisist trigger references this item so the next 2.x
      re-verification is not lost.
- [x] On the next 2.x: re-run the A/B probe (static import vs plain object in a
      dependency-less fixture). If the static import resolves, simplify the
      plugin and refresh the smoke evidence; if not, update the version-pin note.
- [x] Optional (review F3): a dedicated typecheck (or a computed specifier for
      the dynamic import) so editors/`tsc` do not flag the guarded import.

## Notes

- Review F2 (parity test self-heals by design; the byte assertion lives in
  `init-opencode.test.ts`) and F4 (T8's remaining assertions — skills/agents/
  commands/context/full cycle — extend in W3/W4) are informational and tracked
  by their own waves; no action here.

### 2026-09-18 @Arggon
### 2026-09-18 @Arggon — 2.0.8 re-probe: static import still fails, guarded pattern stays

Re-ran the acceptance's A/B re-verification on the installed `opencode v2.0.8`
(the version that originally failed was 2.0.7).

**Fixture** `/tmp/opencode/opencode-plugin-import-probe-208`: temp git repo with
**no `node_modules` in the fixture or any ancestor** (asserted before the run),
a minimal `arggon init` tracker, and two auto-discovered plugins:

- **A** `.opencode/plugins/a-docs-pattern/index.ts` — the V2-docs pattern:
  static `import { Plugin } from "@opencode/plugin"` + `Plugin.define`, writes a
  setup marker.
- **B** `.opencode/plugins/arggon/index.ts` — the shipped guarded plain-object
  plugin, verbatim source copy (guarded computed dynamic import).

One real headless session (`opencode run --standalone --print-logs --log-level
info --model opencode-go/deepseek-v4-flash --format json`) plus the full
`npm run smoke:opencode`. Raw transcripts: fixture `.smoke-evidence/`
(`ab.stderr.log`, `ab.stdout.jsonl`, `opencode-version.txt`).

**Per-plugin result**

- **A — fails to load on 2.0.8**, same as 2.0.7:
  `INFO msg="loading plugin" id=.../a-docs-pattern` →
  `WARN message="failed to load plugin" target=.../a-docs-pattern
cause="... Cannot find package '@opencode/plugin' imported from
.../a-docs-pattern/index.ts"`. Setup marker ABSENT — `setup` never ran. Session
  still exits 0.
- **B — loads and runs**: `msg="loading plugin" id=.../plugins/arggon`;
  `message="mcp connected" server=arggon tools=9` (B's `setup` transform ran, no
  config registers that server in the fixture), and the session's
  `tools.arggon.arggon_next({})` returned
  `{"ok":true,"command":"next",...}`. A is discovered first, so this also
  re-confirms failure isolation on 2.0.8.
- **Verdict**: keep the guarded form. The documented static import is still
  unresolvable in dependency-less adopter trees, so simplifying would re-break
  the plugin exactly as on 2.0.7.

**Propagation in this PR**

- `opencode/plugins/arggon/index.ts`: version note updated to 2.0.7 + 2.0.8
  re-probe; optional F3 done with a **computed** dynamic-import specifier
  (`OPENCODE_PLUGIN_PACKAGE`) so editors/`tsc` stop flagging the deliberately
  absent package.
- `docs/playbooks/opencode.md`: pin refreshed to 2.0.8 via `arggon playbook
refresh opencode --version 2.0.8`; Conventions records the gotcha, the
  supported guarded pattern, the per-version probe result and the condition to
  simplify (runtime resolves `@opencode/plugin` without local `node_modules`, or
  the docs change); Upgrade policy re-runs the A/B probe on every 2.x.
- `docs/adr/0010-opencode2-native-architecture.md`: the V2-churn revisit
  trigger now names this item and its 2.0.8 outcome.
- Pin references in `README.md` and `docs/agents.md` refreshed to 2.0.8.

**2.0.7 → 2.0.8 deltas observed**: none in plugin-visible behavior — the static
import is still unresolved without `node_modules`; the 11-scenario smoke passes
unchanged on 2.0.8 (same fallbacks exercised). Only `opencode --version` changed.

**Gates**: `npm test` 69 files / 1116 tests · `npm run lint` · `npm run build` ·
`arggon validate` 0 errors/0 warnings · `arggon spec validate` 0/0 ·
`npm run smoke:opencode` on 2.0.8: **11 scenarios, 0 failures** (fixtures kept
with `ARGON_SMOKE_KEEP=1`; the harness' own `.smoke-evidence/` holds the
per-scenario transcripts).

### handoff 2026-09-18 @Arggon — next: Coordinator review of draft PR #334; on approval merge to opencode2 (merge, not squash - tracker auto-commits). No further task-side changes expected.
- branch: feat/task-opencode-v2-plugin-import-gotcha
- open questions: Raw A/B transcripts are fixture-local (/tmp/opencode/opencode-plugin-import-probe-208/.smoke-evidence); key lines are quoted in the PR body and item comment.
