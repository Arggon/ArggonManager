---
type: bug
status: in_progress
id: bug-native-steps-truncated-flag-dropped
title: "Native `preparation.steps` silently shortens past MAX_PREP_STEPS: the kernel sets `stepsTruncated` but `boundedPreparation` folds only its own 32-name cap, so the flag never fires on the native seam (the CLI keeps it)"
assignee: Arggon
branch: fix/bug-native-steps-truncated-flag-dropped
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, json-contract]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T10:45:03.178Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-native-steps-truncated-flag-dropped
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-native-steps-truncated-flag-dropped.md
  Leaves live only under a story. id is the filename stem: bug-native-steps-truncated-flag-dropped.
  CLI `arggon create bug native-steps-truncated-flag-dropped` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native `preparation.steps` silently shortens past MAX_PREP_STEPS: the kernel sets `stepsTruncated` but `boundedPreparation` folds only its own 32-name cap, so the flag never fires on the native seam (the CLI keeps it)

## Context

The kernel records every preparation decision in a bounded log, caps it at
`MAX_PREP_STEPS = 16`, and SAYS so when it drops entries
(`lib/src/worktree.ts:2061-2068`, emitted at `:2119`). The native
`boundedPreparation` projected that log but re-derived its truncation flag from
**its own** 32-name list cap (`opencode/plugins/arggon/index.ts`) — a cap ABOVE
the kernel's, so the comparison could never fire, and the kernel's own decision
was dropped on the way out. A start with more than 16 preparation decisions (one
build decision per workspace package is the easy way there) therefore reached the
agent as a 16-entry `steps` list with no flag: shortened, presented as complete.

Reproduce on the pre-fix seam (`d0921ade^`): a worktree fixture whose primary
install links 16 workspace packages, `tools.arggon.start({ id, assignee })`, then
read `output.preparation` — `steps.length === 16`, `stepsTruncated === undefined`,
`truncated` undefined too (nothing else in that receipt is capped).

**Correction to the finding below.** The premise "the CLI keeps it" is wrong:
the CLI drops the kernel's flag the same way. `cli/src/start.ts` assigns
`prepSteps = prepared.steps` and carries no `stepsTruncated`, and
`cli/src/cli.ts` forwards only `prepSteps` (verified by reading both; there is no
`stepsTruncated` anywhere under `cli/`). So this is not two surfaces disagreeing —
it is one kernel flag that NEITHER surface reports. The CLI-side mirror is a
one-field follow-up in files another worker owns, so it is reported to the
coordinator rather than fixed here; parity is therefore asserted on what both
surfaces do carry (the log, entry for entry, on twin fixtures) plus the kernel
receipt itself for the flag.

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
- [x] Native `stepsTruncated` mirrors the kernel's decision; the projection does not re-derive it from a different cap — `index.ts` reads `input.stepsTruncated === true` and emits it verbatim; both mutations (mirror killed, fold killed) fail the new test with `expected undefined to be true`.
- [x] A test drives `> MAX_PREP_STEPS` through the NATIVE seam and asserts both the shortened list AND the flag, matching the CLI's behavior on the same kernel event — `tools.test.ts`: 16 linked workspace packages → native `preparation.steps` has 16 entries, `stepsTruncated === true`, a direct `prepareWorktreeDependencies` receipt for the same worktree agrees on both, and the CLI twin's `prepSteps` deep-equals the native log. **The CLI carries no flag at all** (see §Context), so the flag is matched against the kernel — the decision both surfaces project from — rather than against a CLI field that does not exist; a second test pins that an uncapped log stays unflagged.
- [x] Sweep `boundedPreparation` (and any sibling native projection) for other kernel-set flags it recomputes instead of mirroring — the class, not this one field — **done in §Sweep below: one instance of the class (this field), now closed on the native seam.** Two adjacent findings that are NOT recomputes are reported there: the CLI drops the same flag, and the kernel's refusal prose quotes the capped log without saying entries were dropped.
- [x] If a native cap genuinely must exist (the 32-name cap suggests one once did), say why and make it additive rather than a replacement for the kernel's decision — it stays as defense in depth (a hand-built receipt is the only way it can fire through the kernel's 16) and folds into the shared `truncated`; the kernel's decision is mirrored alongside it, never replaced by it.

### 2026-10-03 — fixed on `fix/bug-native-steps-truncated-flag-dropped`

**The fix.** `boundedPreparation` mirrors the kernel's decision
(`const kernelDroppedSteps = input.stepsTruncated === true`), emits
`stepsTruncated: true` only when the kernel set it, and folds it into the shared
`truncated` — additive on top of the named flag, never a replacement for it. The
32-name slice stays (defense in depth; the kernel's cap is 16), and the
per-string bounds on each entry stay (a `pkg` name is read out of a `package.json`
in the worktree, so it is attacker-shaped even though the count is not).

#### §Sweep — is the class closed on this seam?

Every kernel-owned field of `WorktreeDependencyPreparation` and its fragments,
against what the native projection does with it:

| kernel field | native projection | verdict |
| --- | --- | --- |
| `ready`, `install`, `linkedNodeModules`, `manifestCoverage` | passed through | honest |
| `builtWorkspaces`, `linkedWorkspaces` | 32-name cap, fold into `truncated` | kernel does NOT cap these — a genuine native-only bound, and `truncated` is the honest signal |
| `missingDependencies` + `missingDependenciesTotal` | total mirrored, capped list folded | honest (kernel cap 10 < 32) |
| `gateBins` | mapped entry by entry, no re-slice | honest (kernel cap 8 < 32) |
| `steps` | mapped entry by entry, per-string bounds re-applied | honest list (kernel cap 16 < 32) |
| `stepsTruncated` | **dropped; a 32-vs-16 comparison re-derived instead** | **the one instance — fixed** |
| `env` (`WorktreeEnvReceipt`) | projected; only `path`/`seededDotenv`/`warning`/`keys` re-bounded, `written`/`gitignored` passed | honest (kernel owns the six-key set) |
| `claim` (`WorktreeClaimReceipt` → `foreignWrites`/`takeOver` → `replaced` → `takeovers`) | projected, both `total`s exact and folded, every string re-bounded | honest (kernel caps 10 / 5, both < 32) |

Sibling projections outside `boundedPreparation`: `boundedCommitPayload` reproduces
the kernel's `CommitPayload` union exactly (`{hash, message, ignored?}` /
`{skipped, ignored?}`) and reads `TrackerCommitResult.committed` instead of
deriving it; `boundedEnvReceipt`/`boundedClaimReceipt`/`boundedClaimStamp`/
`boundedNames` are the fragments above; `boundedEnvelopeJson` bounds an error
string for display and is not a projection. **So: one instance of the class on
this seam, and it is closed.** `lib/src/worktree.ts` also has no other
set-flag/capped-count pair to mirror (a source sweep for `?: true` / `Truncated`
returns `stepsTruncated` alone).

Two adjacent findings, reported rather than fixed (outside this item's scope):

1. **The CLI drops the same kernel flag** — a one-field mirror
   (`cli/src/start.ts` → `StartResult`, `cli/src/cli.ts` envelope, plus a
   `json-output.md` row). Belongs to the worker holding those files.
2. **`freshWorktreeInstallRefusal` quotes the capped log as if it were whole**
   (`lib/src/worktree.ts:990-995`, "Preparation ran: …"): a refusal message over
   a truncated log never says entries were dropped, so both surfaces inherit a
   prose version of this defect.

#### The #609 union landed here (its doc-contract gate needed one more scenario)

PR #609 (which filed this bug) merged **while this item was being worked** — its
per-field table and `opencode/plugins/arggon/opencode2-doc-contract.test.ts` are
on main now, so the union is this branch's job rather than a note for its author.
Both halves are here:

- the `preparation.stepsTruncated?` row in the field table (`boolean`, kernel
  `MAX_PREP_STEPS` (16)), the mention in the `start` row, and the explanation
  appended to the paragraph that introduces the table (so the suite's
  prose-discoverability check sees it);
- **an eighth scenario in that suite**, because the suite reads rows against real
  runs in both directions: without a run that overflows the kernel's log cap the
  new row is reported as a field no run ever carried. Measured, not guessed — with
  the row alone the suite fails
  `these rows document a field no real run ever carried: [ 'preparation.stepsTruncated' ]`;
  with the scenario (a second fixture whose primary install links
  `MAX_PREP_STEPS` workspace packages, then `observe("preparation", …)`) all five
  tests pass against this fix, and killing the mirror fails scenario 8 by name
  (`the kernel's decision is mirrored: expected undefined to be true`).

The doc conflict on rebase was resolved as a UNION (their tables plus all three
doc additions), not by picking a side.

### handoff 2026-10-03 @Arggon — next: Review + merge PR #617; then decide on the reported CLI-side mirror and the kernel refusal-prose finding
- branch: fix/bug-native-steps-truncated-flag-dropped
- open questions: note: this item's first comment+handoff was recorded from the primary checkout and landed on local main (cd9e85d0); this one rides the item branch; CLI mirror follow-up (cli/src/start.ts, cli/src/cli…

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

### handoff 2026-10-03 @ses_efea0d706ffetL52TK6OrsCWQd (session: ses_efea0d706ffetL52TK6OrsCWQd) — next: Review + merge PR #617 (fix branch already pushed); then decide on the reported CLI-side mirror (cli/src/start.ts + cli/src/cli.ts) and the kernel refusal-prose finding
- branch: main
- open questions: CLI start drops the same kernel flag (cli/src/start.ts/cli.ts, owned by the clip worker) — file that follow-up?; freshWorktreeInstallRefusal quotes a capped log without saying entries dropped — kerne…
