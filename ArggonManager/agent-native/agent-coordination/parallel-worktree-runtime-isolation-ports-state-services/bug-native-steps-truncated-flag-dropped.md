---
type: bug
status: todo
id: bug-native-steps-truncated-flag-dropped
title: "Native `preparation.steps` silently shortens past MAX_PREP_STEPS: the kernel sets `stepsTruncated` but `boundedPreparation` folds only its own 32-name cap, so the flag never fires on the native seam (the CLI keeps it)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, json-contract]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-native-steps-truncated-flag-dropped.md
  Leaves live only under a story. id is the filename stem: bug-native-steps-truncated-flag-dropped.
  CLI `arggon create bug native-steps-truncated-flag-dropped` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native `preparation.steps` silently shortens past MAX_PREP_STEPS: the kernel sets `stepsTruncated` but `boundedPreparation` folds only its own 32-name cap, so the flag never fires on the native seam (the CLI keeps it)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #609 (task-opencode2-payload-contract-preparation-fields), 2026-10-03, while documenting the `preparation` receipt — and **not fixed there**, because it is a real defect outside that item's acceptance.

**The defect.** The kernel caps the preparation log at `MAX_PREP_STEPS = 16` and sets `stepsTruncated` when it truncates. The native seam's `boundedPreparation` projects the payload but folds only **its own** 32-name cap into the flag — a cap that cannot fire through the kernel's 16. So on the native surface:

- more than 16 preparation steps → `steps` is silently shortened
- `stepsTruncated` is never set
- the agent sees a truncated list presented as complete

The CLI keeps the flag, so the two surfaces disagree on the same kernel event. That is the same parity defect class this session keeps meeting: one surface projects a receipt and forgets a field the other one carries (cf. the #596 native double-commit reporting `skipped: "nothing to commit"`, and the done-gate/goal-body divergence).

The honest fix is for the projection to trust the kernel's own flag rather than re-derive it — the kernel already decided; re-deriving is where the divergence came from.

Acceptance:
- [ ] Native `stepsTruncated` mirrors the kernel's decision; the projection does not re-derive it from a different cap
- [ ] A test drives `> MAX_PREP_STEPS` through the NATIVE seam and asserts both the shortened list AND the flag, matching the CLI's behavior on the same kernel event
- [ ] Sweep `boundedPreparation` (and any sibling native projection) for other kernel-set flags it recomputes instead of mirroring — the class, not this one field
- [ ] If a native cap genuinely must exist (the 32-name cap suggests one once did), say why and make it additive rather than a replacement for the kernel's decision

### 2026-10-03 @ses_efea0d706ffetL52TK6OrsCWQd
PR #617 — `fix/bug-native-steps-truncated-flag-dropped`, rebased onto origin/main (#609 merged mid-flight; the opencode2.md conflict was resolved as a UNION). All gates green: build → test (124 files / 2557) → lint → validate (ok, 0 warnings) → **check:plugin byte-identical** → test:structure → lint:structure.

**What shipped.** `boundedPreparation` mirrors the kernel's decision instead of re-deriving it (`const kernelDroppedSteps = input.stepsTruncated === true`, emitted verbatim, also folded into the shared `truncated`). The 32-name slice stays as defense in depth and is additive, never a replacement; the per-entry string bounds stay because `pkg` is read out of a worktree `package.json` (attacker-shaped) even though the count is not.

**Parity evidence (commands run, expected vs observed).**
- Native seam, real `tools.arggon.start` run on a fixture whose primary install links `MAX_PREP_STEPS` (16) workspace packages: `preparation.steps.length === 16`, `preparation.stepsTruncated === true`, `preparation.truncated === true`; the dropped tail is the gate-bin verdict (15 build steps + link). Pre-fix observed: `stepsTruncated === undefined` ("expected undefined to be true") — the defect reproduced.
- Kernel is the authority the mirror reads: a direct `prepareWorktreeDependencies(primary, worktree)` for the same worktree returns `steps.length === 16` AND `stepsTruncated === true`.
- CLI, same kernel event on a twin fixture (`arggon start --worktree --assignee smoke --json`): `prepSteps` has 16 entries and `toEqual` the native log **entry for entry**.
- Uncapped fixture (1 package): `stepsTruncated` and `truncated` both `undefined` — a flag nobody set is never invented.
- Mutations: mirror killed → the first test fails; fold killed → the `truncated` assertion fails; mirror killed → the doc-contract scenario 8 fails by name ("the kernel's decision is mirrored").
- The merged doc-contract suite (5/5): its bidirectional coverage check reads a documented row as `a field no real run ever carried` without an overflow run — measured before adding scenario 8, so the row and the scenario landed together.

**Class sweep — is it closed? On this seam, yes: one instance, now fixed.** Every kernel-owned field of `WorktreeDependencyPreparation` + fragments, read against what the projection does:

| kernel field | native projection | verdict |
| --- | --- | --- |
| `ready`/`install`/`linkedNodeModules`/`manifestCoverage` | passed through | honest |
| `builtWorkspaces`/`linkedWorkspaces` | 32-cap + fold | **genuine** native-only bound (kernel does not cap); `truncated` is the honest signal |
| `missingDependencies` + `missingDependenciesTotal` | total mirrored, list folded | honest (kernel 10 < 32) |
| `gateBins` | mapped, no re-slice | honest (kernel 8 < 32) |
| `steps` | mapped, per-string bounds | honest list (kernel 16 < 32) |
| `stepsTruncated` | **dropped; 32-vs-16 comparison re-derived** | **the one instance — fixed** |
| `env` | projected; free text re-bounded, booleans passed | honest (kernel owns the six keys) |
| `claim` → `foreignWrites`/`takeOver` → `replaced` → `takeovers` | projected, both `total`s exact + folded | honest (kernel 10/5 < 32) |

Siblings outside `boundedPreparation`: `boundedCommitPayload` reproduces the kernel's `CommitPayload` union exactly and reads `TrackerCommitResult.committed` instead of deriving it; `boundedEnvReceipt`/`boundedClaimReceipt`/`boundedClaimStamp`/`boundedNames` are the fragments above; `boundedEnvelopeJson` is a display bound, not a projection. A source sweep of `lib/src/worktree.ts` for `?: true`/`Truncated` returns `stepsTruncated` alone — no second kernel flag exists to re-derive.

**Premise correction, and two findings I did NOT fix (outside scope / other owners).**
1. The title's "(the CLI keeps it)" is **wrong**: `cli/src/start.ts` assigns `prepSteps = prepared.steps` and carries no `stepsTruncated`; `cli/src/cli.ts` forwards only `prepSteps`; `grep -r stepsTruncated cli/` finds nothing. Both surfaces dropped the kernel flag, so parity on the flag is asserted against the kernel (the decision both project from) and parity on the log against the CLI. **CLI-side mirror = one-field follow-up in `cli/src/start.ts` + `cli/src/cli.ts` (+ a `json-output.md` row) — files the clip worker holds, so I stayed out.**
2. `freshWorktreeInstallRefusal` (`lib/src/worktree.ts:990-995`) composes "Preparation ran: …" from the capped log without saying entries were dropped — a prose version of this defect both surfaces inherit; a kernel-side follow-up, reported here rather than filed.

**Docs.** `docs/opencode2.md`: the `start` row, the new `preparation.stepsTruncated?` row (`boolean`, kernel `MAX_PREP_STEPS` (16)), and the explanation appended to the paragraph that introduces the field table. `docs/json-output.md` unchanged — no CLI field changed, so there is nothing to document there yet (see finding 1).

Branch pushed without force; item stays `in_progress`.
