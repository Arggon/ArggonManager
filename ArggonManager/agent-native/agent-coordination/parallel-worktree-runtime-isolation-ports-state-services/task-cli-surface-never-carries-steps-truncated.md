---
type: task
status: in_progress
id: task-cli-surface-never-carries-steps-truncated
title: "Neither surface carries `stepsTruncated`: the CLI assigns `prepSteps` and forwards only that, so #617 fixed the native mirror but the human/CLI surface still drops the kernel flag"
assignee: arggon-delivery-lead
branch: feat/task-cli-surface-never-carries-steps-truncated
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cli, native-seam, json-contract]
created: "2026-10-03"
updated: "2026-10-15"
claimed_at: "2026-10-15T10:14:51.729Z"
depends_on: [bug-native-steps-truncated-flag-dropped]
worktree_path: /home/arggon/Projects/ArggonManager-task-cli-surface-never-carries-steps-truncated
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-cli-surface-never-carries-steps-truncated.md
  Leaves live only under a story. id is the filename stem: task-cli-surface-never-carries-steps-truncated.
  CLI `arggon create task cli-surface-never-carries-steps-truncated` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Neither surface carries `stepsTruncated`: the CLI assigns `prepSteps` and forwards only that, so #617 fixed the native mirror but the human/CLI surface still drops the kernel flag

## Context

Found by the worker on PR #617 (`bug-native-steps-truncated-flag-dropped`),
2026-10-03, which CORRECTED this item's premise rather than assuming it.

**This item said "the CLI keeps the flag." That was wrong.** Verified against
the code: `cli/src/start.ts` assigns `prepSteps = prepared.steps`
(`cli/src/start.ts:1131`), `cli/src/cli.ts` forwards only `prepSteps`
(`cli/src/cli.ts:2703`), and there is **no `stepsTruncated` anywhere under
`cli/`** (still observed at HEAD). Both surfaces dropped the kernel's own
decision — the native seam re-derived it from a cap that cannot fire, and the
CLI never carried it at all.

#617 therefore fixed the native projection to MIRROR the kernel's decision
rather than re-derive it (`opencode/plugins/arggon/index.ts:2887-2931`: the
named `stepsTruncated` mirror), and asserted parity against the KERNEL (the
decision both project from) rather than against the CLI, which never had it.
That was the only honest way to write the test.

So the CLI half remains, and it is small: one field the human surface never
had.

## Acceptance

- [ ] The CLI carries `stepsTruncated` alongside `prepSteps` — a mirror of the kernel's decision, not a re-derivation from a cap
- [ ] The CLI and native surfaces agree on the same kernel event (the deep-equal per-entry log assertion #617 established extends to the truncation flag)
- [ ] `docs/json-output.md` and `docs/opencode2.md` document the flag on BOTH surfaces; the opencode2 doc-contract suite (PR #609, extended by #617) gains the CLI shape as a scenario so it cannot be dropped again
- [ ] An uncapped log stays unflagged on both surfaces
- [ ] The refusal call sites thread the kernel's dropped-entry COUNT (shipped by `bug-fresh-worktree-refusal-prose-drops-prep-step-truncation`, PR #833): `cli/src/start.ts` passes `prepared.stepsDropped` to `freshWorktreeInstallRefusal`, and the native projection mirrors the count through its `boundedPreparation` before rendering the refusal — so the human-visible refusal on both surfaces states the dropped count, not only the kernel's own text
- [ ] Lands after PR #617 (it owns the native projection and the regenerated bundle; no concurrent plugin edits)

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Found by the worker on PR #617 (bug-native-steps-truncated-flag-dropped), 2026-10-03, which CORRECTED my item's premise rather than assuming it.

**My item said "the CLI keeps the flag." That was wrong.** It verified against the code: `cli/src/start.ts` assigns `prepSteps = prepared.steps`, `cli/src/cli.ts` forwards only `prepSteps`, and there is **no `stepsTruncated` anywhere under `cli/`**. Both surfaces dropped the kernel's own decision — the native seam re-derived it from a cap that cannot fire, and the CLI never carried it at all.

#617 therefore fixed the native projection to MIRROR the kernel's decision rather than re-derive it, and asserted parity against the KERNEL (the decision both project from) rather than against the CLI, which never had it. That was the only honest way to write the test.

So the CLI half remains, and it is small: one field the human surface never had.

Acceptance:

- [ ] The CLI carries `stepsTruncated` alongside `prepSteps` — a mirror of the kernel's decision, not a re-derivation from a cap
- [ ] The CLI and native surfaces agree on the same kernel event (the deep-equal per-entry log assertion #617 established extends to the truncation flag)
- [ ] `docs/json-output.md` and `docs/opencode2.md` document the flag on BOTH surfaces; the opencode2 doc-contract suite (PR #609, extended by #617) gains the CLI shape as a scenario so it cannot be dropped again
- [ ] An uncapped log stays unflagged on both surfaces
- [ ] Depends on PR #617 landing first (it owns the native projection and the regenerated bundle; editing the plugin concurrently would collide)

### 2026-10-15 @Arggon
Routed from the #833 sweep (bug-fresh-worktree-refusal-prose-drops-prep-step-truncation): the kernel now emits stepsDropped and the refusal prose quotes it, but the two call sites still omit the count — cli/src/start.ts:1166 and the native projection (boundedPreparation). This item owns threading both, per the new acceptance box.
