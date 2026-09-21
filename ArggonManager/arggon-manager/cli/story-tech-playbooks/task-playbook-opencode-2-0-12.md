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
- [ ] `arggon validate` green; docs-only diff; CI green.

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
