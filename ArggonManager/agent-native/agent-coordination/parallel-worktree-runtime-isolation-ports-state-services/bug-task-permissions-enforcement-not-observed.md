---
type: bug
status: in_progress
id: bug-task-permissions-enforcement-not-observed
title: "opencode.jsonc permissions: the four shell denies are not enforced by the client runtimes we actually use"
assignee: arggon-delivery-lead
branch: fix/bug-task-permissions-enforcement-not-observed
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [seam, config]
priority: p3
created: "2026-10-02"
updated: "2026-10-15"
claimed_at: "2026-10-15T17:20:47.828Z"
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

- [ ] Determine per client runtime (OpenCode V2 session, ZCode plugin, headless/agent seams) whether the project `permissions` block is read at all, and record which layer honors it.
- [ ] If it is not honored, decide the carrier: an enforceable gate in the methodology (kernel/plugin-side refusal the way steals/reopens are gated) or documented client setup; do not leave the file claiming enforcement it does not deliver.
- [ ] A probe harness that runs one denied and one allowed command per supported runtime, wired into the gates where practical.

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
