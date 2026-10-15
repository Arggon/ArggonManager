---
type: bug
status: done
id: bug-task-permissions-enforcement-not-observed
title: "opencode.jsonc permissions: the four shell denies are not enforced by the client runtimes we actually use"
assignee: arggon-delivery-lead
branch: fix/bug-task-permissions-enforcement-not-observed
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [seam, config]
priority: p3
created: "2026-10-02"
updated: "2026-10-15"
worktree_path: /home/arggon/Projects/ArggonManager-bug-task-permissions-enforcement-not-observed
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-task-permissions-enforcement-not-observed.md
  Leaves live only under a story. id is the filename stem: bug-task-permissions-enforcement-not-observed.
  CLI `arggon create bug task-permissions-enforcement-not-observed` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# opencode.jsonc permissions: the four shell denies are not enforced by the client runtimes we actually use

## Context

Found while fixing bug-opencode-jsonc-malformed-permissions: after the file was repaired, the coordinator session's shell layer still ALLOWED `git push --force --dry-run origin HEAD` and `git commit --no-verify -m probe` (dry runs, no side effects) — i.e. the project's `permissions` block is not enforced by this runtime. `~/.config/opencode/opencode.json` carries no permissions block, so the project file is the only source. What the malformed file proved is the opposite direction: unparseable config made every shell call fail closed (`Permission denied: shell`), which is how the defect surfaced.

## Acceptance

- [x] Determine per client runtime (OpenCode V2 session, ZCode plugin, headless/agent seams) whether the project `permissions` block is read at all, and record which layer honors it.
- [x] If it is not honored, decide the carrier: an enforceable gate in the methodology (kernel/plugin-side refusal the way steals/reopens are gated) or documented client setup; do not leave the file claiming enforcement it does not deliver.
- [x] A probe harness that runs one denied and one allowed command per supported runtime, wired into the gates where practical.

## Notes

### 2026-10-02 @Coordinator

### 2026-10-02 @Coordinator

Found while fixing bug-opencode-jsonc-malformed-permissions: after the file was repaired, the coordinator session's shell layer still ALLOWED `git push --force --dry-run origin HEAD` and `git commit --no-verify -m probe` (dry runs, no side effects) — i.e. the project's `permissions` block is not enforced by this runtime. `~/.config/opencode/opencode.json` carries no permissions block, so the project file is the only source. What the malformed file proved is the opposite direction: unparseable config made every shell call fail closed (`Permission denied: shell`), which is how the defect surfaced.

## Acceptance

- [ ] Determine per client runtime (OpenCode V2 session, ZCode plugin, headless/agent seams) whether the project `permissions` block is read at all, and record which layer honors it.
- [ ] If it is not honored, decide the carrier: an enforceable gate in the methodology (kernel/plugin-side refusal the way steals/reopens are gated) or documented client setup; do not leave the file claiming enforcement it does not deliver.
- [ ] A probe harness that runs one denied and one allowed command per supported runtime, wired into the gates where practical.

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
**Lead steer (2026-10-15), to be resolved WITH the probe results, not before them.** The item's own observation was made on a repaired-but-different config state, and #836's probe later proved the standalone run DOES deny a refused shell command — so the honest answer is per-runtime, not uniform:
1. Probe each layer that can answer: the OpenCode V2 session (this runtime), a standalone `opencode run` (the #836 pattern), the native plugin's own permission block, and the CLI. One denied + one allowed command per layer, recorded as command / expected / observed / exit / does-NOT-prove.
2. Box 2's carrier decision, if a gap remains: the lead's lean is **documented client setup (plus the kernel gates that already exist)** over a new enforcement layer — a second permission surface is a second logic path over the same commands, and the kernel (claim/reopen/steal refusals, the pre-commit validate) is already the enforcement of record. If a runtime provably honors the config, the finding records THAT LAYER. Nothing may be left claiming enforcement it does not deliver.
3. Box 3's harness: a probe harness wired into the gates where practical — hermetic (temp repos, no network), one denied + one allowed per layer; a skip is recorded as a skip.

### 2026-10-15 @ses_ebf689266ffe1lF4ZC4yVUAxny
## Evidence — per-runtime probes (2026-10-15, opencode v2.0.29)

Box 1 answered per layer, one denied + one allowed command each, recorded as command / expected / observed / exit / does-NOT-prove. Full table is reproducible with `npm run smoke:permissions-probe` (hermetic fixtures; the deterministic legs also run under `npm test`).

| runtime | command | expected | observed | exit |
| --- | --- | --- | --- | --- |
| opencode-v2-session (fresh headless `opencode run`, fixture carries this checkout's opencode.jsonc verbatim) | `git commit --no-verify -m probe` | refused | `status:"error"`, `"Permission denied: shell"` | session exit 0 |
| opencode-v2-session | `git commit -m probe` (staged) | runs | `status:"completed"`, root commit created | session exit 0 |
| opencode-v2-config-edit (same session continued after the block is written mid-session) | `git commit --no-verify -m probe` | refused | `Permission denied: shell` | session exit 0 (same session id) |
| opencode-v2-config-edit (before the edit) | same command | runs | `status:"completed"` | session exit 0 |
| opencode-v2-service (session on a long-lived background service — the desktop app's runtime shape) | same command after the edit | refused | `Permission denied: shell` | session exit 0 |
| zcode-gate (`hooks/gate.mjs pre`) | `git commit --no-verify -m probe`; `git push --force origin main` | refused | `arggon gate: denied — …` | hook exit 2 |
| zcode-gate | `git commit -m probe`; `git push origin main` | runs | no stderr | hook exit 0 |
| claude-gate | same pair | same | same | exit 2 / exit 0 |
| arggon-cli-kernel | `update <done item> --status todo` | refused | `…requires an interactive terminal (agents must not reopen …)` | cli exit 1 |
| arggon-cli-kernel | `start <claimed item> --assignee other-owner` | refused | `claim conflict: …` | cli exit 1 |
| arggon-cli-kernel | `comment <done item> "probe marker"` | runs | comment envelope, `ok:true` | cli exit 0 |
| arggon-plugin (vendored bundle source) | structural: config hook / permission-rule scan | none | no `config` hook, no permission rules | n/a |

Also probed on **this runtime** (the interactive V2 session, dry runs only, no side effects): `git commit --no-verify --dry-run -m probe` → `Permission denied: shell`; `git push --force --dry-run origin HEAD` → `Permission denied: shell`; `git commit --dry-run -m probe` → ran (git exit 1, "nothing to commit"); `git push --dry-run origin HEAD` and `git push --force-with-lease --dry-run origin HEAD` → ran.

**Answer:** the OpenCode V2 runtime's own permission layer HONORS the project permissions block — in a fresh session, in a session continued after a mid-session config edit, and in a session on a long-lived service. A running session is not a frozen permission surface. The ZCode/Claude seams do NOT read this file; they enforce their own `hooks/gate.mjs` gate. The vendored plugin declares no permission surface of its own. The kernel is the enforcement of record.

**The item's original observation (2026-10-02: both denied dry-runs allowed after the repair) could NOT be reproduced** on the current runtime and config state, and its exact cause cannot be established retroactively — it was made on a session whose config state differed, per the lead's steer. The mechanism legs refute the "frozen surface" explanation for this build.

**Does NOT prove:** a determined spelling (`bash -c …`, separators, quoted forms) is stopped; any client other than opencode v2.0.29; that the ZCode/Claude gates fire on every tool in their clients; or that the human-only `--force`/`--steal` flags are refused.

## Carrier decision (box 2)

Documented client setup + the existing kernel gates; **no new enforcement layer** (a second permission surface over the same commands is a second logic path, and nothing is left unenforced to justify one). The config comment in both carriers now states WHICH layer honors the block; `docs/agents.md` §Which layer enforces the seam's shell gates, `docs/opencode2.md`, `docs/engineering.md` §Smoke test and `docs/playbooks/opencode.md` carry the per-runtime record.

## Harness (box 3)

`smoke/opencode-permissions-probe.ts` (+ `npm run smoke:permissions-probe`): hermetic (temp repos, local bare remotes, disposable HOME + XDG), one denied + one allowed command per runtime, skip recorded as a skip with its reason (provider death = skip; a model that declines on its own = inconclusive = FAIL). Deterministic legs run model-free under `npm test` via `smoke/opencode-permissions-probe.test.ts` (30 tests). Today's full run: **14 probes, 0 skips** with `OPENCODE_SMOKE_MODEL=opencode-go/step-5-preview-free` (the shared pin's provider is at its weekly quota, which the skip path records).

## Gates (worktree)

`npm run arggon -- validate` ok · focused vitest 93 passed · `npm run build` green · `npm test` 164 files / 3618 tests passed · `npm run lint` clean · `npm run test:structure` 5 passed · prettier clean on every touched file except `templates/docs/opencode.jsonc` (the same three-comma deviation prettier reports at HEAD: its comma-less style is load-bearing because the init tests parse the stripped template as strict JSON).

PR: https://github.com/Arggon/ArggonManager/pull/848

### handoff 2026-10-15 @ses_ebf689266ffe1lF4ZC4yVUAxny (session: ses_ebf689266ffe1lF4ZC4yVUAxny) — next: Review PR #848 (per-runtime probe table + carrier decision + harness); after merge, tick the three acceptance boxes and flip the item to done.
- branch: fix/bug-task-permissions-enforcement-not-observed
- open questions: Acceptance boxes are intentionally left unticked for the lead at merge; the 2026-10-02 observation is recorded as not reproducible, not explained; shared smoke model pin is provider-quota-blocked tod…

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead review + merge verification — 2026-10-15 (delivery lead)
Merged as 0799b940 (PR #848). The per-runtime answer is recorded, not assumed: the OpenCode V2 runtime's own permission layer honors the project block (a fresh run, an edit picked up mid-session, and a long-lived service — the three legs refute the "frozen surface" mechanism), while the ZCode/Claude seams enforce their OWN gate rather than this file. The original 2026-10-02 allowance is recorded as a different-config-state probe with its cause not claimed — the honest reading of a non-reproducing observation.

Carrier (box 2): documented client setup + the existing kernel gates, **no new enforcement layer** — the per-runtime table now lives in `agents.md`, `opencode2.md`, `engineering.md` §Smoke test and the playbook, and both `opencode.jsonc` carriers state which layer honors the block. Harness (box 3): `smoke/opencode-permissions-probe.ts` — one denied + one allowed per runtime, hermetic, a skip recorded as a skip with its reason and never counted as a pass — plus 30 tests.

Evidence: 14 probes with 0 skips on the local model pin; full suite 164 files / 3618; validate / lint / structure / prettier green; CI green on all lanes. Wave note: the shared smoke model pin's provider is quota-blocked today — the skip path is exercised and recorded, nothing faked.
