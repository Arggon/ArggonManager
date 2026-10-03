---
type: bug
status: in_progress
id: bug-native-steps-truncated-flag-dropped
title: "Native `preparation.steps` silently shortens past MAX_PREP_STEPS: the kernel sets `stepsTruncated` but `boundedPreparation` folds only its own 32-name cap, so the flag never fires on the native seam (the CLI keeps it)"
assignee: Arggon
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, json-contract]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T11:57:05.659Z"
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

### handoff 2026-10-03 @ses_efea0d706ffetL52TK6OrsCWQd (session: ses_efea0d706ffetL52TK6OrsCWQd) — next: Review + merge PR #617 (fix branch already pushed); then decide on the reported CLI-side mirror (cli/src/start.ts + cli/src/cli.ts) and the kernel refusal-prose finding
- branch: main
- open questions: CLI start drops the same kernel flag (cli/src/start.ts/cli.ts, owned by the clip worker) — file that follow-up?; freshWorktreeInstallRefusal quotes a capped log without saying entries dropped — kerne…

### 2026-10-03 @ses_efe6ade5affec11obG6lslsIsr
verdict: approve

Review of PR #617 (head `ae390a1c`, base main, MERGEABLE/CLEAN, 6 files) against
`ArggonManager/docs/engineering.md` §Review bar. Read-only review: code, diff, kernel,
tracker history and CI metadata. No gates executed by me — the evidence below is CI's,
recorded against this exact head SHA (`gh api .../commits/ae390a1c/check-runs` →
`cli` success, `ui-smoke` success, `tasks-validate` success, all at `ae390a1c`).

## 1. The mirror is a mirror (verified by reading)

`opencode/plugins/arggon/index.ts`: one reader, one writer.
- Reader: `const kernelDroppedSteps = input.stepsTruncated === true` (:2396)
- Writer: `...(kernelDroppedSteps ? { stepsTruncated: true as const } : {})` (:2443)

Kernel side, `lib/src/worktree.ts`: the type is `stepsTruncated?: true` (:1349, a
literal `true`, never `false`) and the emit is
`...(stepsTruncated ? { stepsTruncated: true as const } : {})` (:2119). So the
projection is an identity over the kernel's decision: it cannot emit `false` while
the kernel said true (the only writer's value is the constant `true`, and
`NativePreparationReceipt.stepsTruncated?: true` forbids `false`), and it cannot
emit true while the kernel said false/undefined (the reader is a strict `=== true`).
Absence-in/absence-out matches the kernel exactly, so "omitted" is not a silent
divergence from an explicit `false`.

**Hand-built receipt, 40 steps, no kernel flag:** the 32-name slice still fires →
`steps` length 32, `stepsTruncated` absent, `truncated: true` via the
`(input.steps?.length ?? 0) > steps.length` term. That outcome is honest as the table
is written: `preparation.stepsTruncated?` is documented as "Present only when the
kernel's own log hit that cap", and `preparation.truncated?` as "Present only when
bounding shortened something (an over-cap list, a clipped string)". A caller watching
only `stepsTruncated` alone would miss a 32-capped list — unreachable through the
kernel (16 < 32) and disclosed by `truncated`, so this is an observation, not a
defect.

## 2. The class sweep — checked, and the one flagged risk is real

- Kernel caps vs `MAX_NATIVE_PREPARATION_NAMES = 32`: `MAX_GATE_BINS` 8,
  `MAX_PREP_STEPS` 16, `MAX_MISSING_DEPENDENCIES` 10, `MAX_CLAIM_WRITE_NAMES` 10,
  `MAX_CLAIM_TAKEOVERS` 5, `WORKTREE_ENV_KEYS` 6 — all below 32, so every
  re-slice in `boundedPreparation`/`boundedClaimReceipt`/`boundedClaimStamp` is
  additive, and the exact `total`s (`missingDependenciesTotal`,
  `foreignWrites.total`, `takeOver.total`) are passed through un-derived.
- **`builtWorkspaces`/`linkedWorkspaces` really are unbounded by the kernel** (I
  checked rather than accepted): `buildLocalWorkspaces` (:581) pushes every decided
  package into `built`, `linkedWorkspacePackages` (:2144) pushes every matching
  symlink into `names`, `localWorkspacePackages` (:217-231) only sorts. No `.slice()`
  anywhere. So the native 32-cap on those two is the *only* bound, and — as the item
  argues — `truncated` is the honest signal: the shortened list is never presented as
  complete. Not silent, so not a second instance of this defect class. Nits below.
- `boundedCommitPayload` (:2635) branches on `result.committed` — the kernel's
  `TrackerCommitResult` field — and reproduces `{hash,message,ignored?}` /
  `{skipped,ignored?}` rather than re-deciding. ✓
- Kernel sweep for a second re-derivable flag: `grep -n "Truncated|?: true"
  lib/src/worktree.ts` returns `stepsTruncated` alone (:1349, :2061, :2064, :2119);
  nothing else in `lib/src` mentions it. The "one instance on this seam" claim holds
  for the seam I could see (`opencode/plugins/arggon/`, `cli/src/`, `smoke/` — the
  only files that touch `preparation`).

## 3. The tests are real `start` runs, and they discriminate

`opencode/plugins/arggon/tools.test.ts`: a fixture whose primary install links 16
workspace packages, then a real `tools.arggon.start` (`worktreeDefinitions` + the W4
`tool(...).execute`). Non-vacuous by construction:
- `expect(preparation.steps).toHaveLength(16)` — 1 `link` + 15 `build` records; the
  16th build and the gate-bins verdict are the dropped tail, and both are asserted
  (`build` count = `MAX_PREP_STEPS - 1`, `gate-bins` absent). A missing `preparation`
  object would throw, not pass.
- `expect(preparation.stepsTruncated).toBe(true)` — the defect itself (pre-fix value
  `undefined`).
- `expect(preparation.truncated).toBe(true)` — kills removal of the fold: I walked
  every other `truncated` term for that fixture (built 0, linked 16 < 32,
  `steps` 16 vs 16, missing 0/0, `gateBins` 1:1, env path < 200 chars, claim stamped
  with no take-over) and none of them can fire, so this assertion is the fold's only
  witness.
- `prepareWorktreeDependencies(nativeDir, worktreePath)` re-derived independently
  agrees on `steps` 16 AND `stepsTruncated` true — the mirror is checked against the
  authority, not against this seam's own arithmetic.
- CLI twin on a second fixture with the same packages:
  `expect(cli.prepSteps).toEqual(preparation.steps)` — entry-for-entry parity on the
  same kernel event (`runCli` injects `--json`; a bare remote is created because a
  fresh-worktree CLI start always pushes).
- Second test: uncapped fixture asserts the exact 3-entry log and
  `stepsTruncated`/`truncated` both `undefined` — kills an invented flag.

Mutation claims: mirror removed → the `toBe(true)` assertion fails, and the
doc-contract scenario 8 hook fails by name; fold removed → the `truncated` assertion
fails (per the term walk above). I could not execute these; the term walk is my
reasoning, not observed output (see Probes).

## 4. The premise correction is right, and the tests honour it

Verified by reading: `cli/src/start.ts:976` is `prepSteps = prepared.steps`,
`cli/src/cli.ts:2370` forwards `prepSteps: result.prepSteps` only, and
`grep -rn "stepsTruncated" cli/` returns **nothing**. The filed title's "(the CLI
keeps it)" is indeed wrong — both surfaces dropped the kernel flag. The tests are
framed accordingly: flag parity is asserted against the KERNEL receipt, log parity
against the CLI, and the test's own doc comment states why a CLI-field parity claim
is not made. No test claims CLI parity it cannot have. The CLI-side mirror is filed as
`task-cli-surface-never-carries-steps-truncated` with an acceptance checklist and
`depends_on: [bug-native-steps-truncated-flag-dropped]`.

## 5. The absorbed #609 doc-contract work is genuinely bidirectional

`opencode2-doc-contract.test.ts` first test checks both directions — payload paths
with no row (`add a row`) AND rows never observed (`a field no real run ever
carried`) — with explicit non-vacuity floors (`observed.size > 20`,
`rows.size > 20`, plus the `start` row must still document `preparation?`).
That is why the row alone was a failing state and the eighth scenario was required:
the new scenario runs a real overflow `start` on a second fixture and then
`observe("preparation", logPreparation)`. Killing the mirror fails it by name
(`the kernel's decision is mirrored`); because the assertions sit in `beforeAll`, a
regression surfaces as a hook failure — still a hard suite failure. The row parses as
4 cells (no unescaped `|` in its notes — CI green proves it, since a 5-cell row would
be skipped by the parser and then reported as an undocumented shipped field), the type
cell is `boolean` matching the observed kind, and the row is discoverable in both the
`start` row and the intro paragraph, which the suite's anchors check requires.

## 6. The disclosed incident — nothing lost from this item's record

The branch's item file carries: the claim (`status: in_progress`, assignee, branch,
`claimed_at`, `worktree_path`), a real `## Context` with a repro, the four ticked
acceptance boxes, the in-body §Sweep and the #609 union note, the PR comment, and
**both** handoffs — the mis-stamped `- branch: main` one (line 187, from the
primary-root resolution) and the corrected branch-aware one (line 147) which
explicitly discloses the first landed on local main. The union merge
`ae390a1c` (parents `db18e1d3` + `9baafaa5`) reconciled the file rather than
picking a side, and nothing from the primary-recorded copy was dropped.
⚠️ **Operational risk, not a defect in the PR:** the two sibling follow-up items
(`task-cli-surface-never-carries-steps-truncated`,
`bug-fresh-worktree-refusal-prose-drops-prep-step-truncation`) exist ONLY in the
primary checkout's local `main`, which is **9 commits ahead of `origin/main` and
unpushed** (`git ls-tree origin/main` finds neither). That history has already been
rewritten once by a `pull --rebase` (the mis-stamped handoff's `cd9e85d0` no longer
exists under that sha). Push that `main` — or port those two items onto a branch —
before anyone rebases/resets the primary, or the filed findings are lost.

## 7. The bundle

`index.bundle.ts` in the PR carries exactly the source change (4 additions, 1
deletion: the reader, the fold term, the emit) with comments stripped, and CI's
`cli` job runs `npm run check:plugin` — `build:plugin && git diff --exit-code -- .../index.bundle.ts` — on this head, so the committed bundle is the byte-exact regeneration, not a hand-edit. The mirror is in the SOURCE (`index.ts`), not only in the bundle. The same job also runs the blocking, model-free native cold-start smoke (`smoke:native-start-cold`, which drives this checkout's plugin source and asserts the preparation receipt) — green on `ae390a1c`. `opencode/**/*.test.ts` is in the vitest include, so both new tests ran in CI's `npm run test`.

## Non-blocking findings (offer, not required)

1. **Nit — doc precision, same table this PR touched.** `preparation.builtWorkspaces`
   and `preparation.linkedWorkspaces` declare `Bound` as `—`, which is literally
   correct (no kernel constant caps them) but reads as "uncapped" when the payload
   caps both at 32 **with no exact total** beside them (unlike
   `missingDependencies`/`missingDependenciesTotal`). Pre-existing since #609 and
   disclosed by `truncated`, so not a blocker. If you want it tracked:
   `npm run arggon -- create task built-linked-workspaces-rows-hide-the-native-32-cap --parent parallel-worktree-runtime-isolation-ports-state-services`
   (body: the two rows should name the native bound the way the new `stepsTruncated`
   row names the kernel's). Say the word and I'll file it.
2. **Observation — the item's title keeps the now-refuted "(the CLI keeps it)".**
   The body correction is prominent and the follow-up is filed, so I read this as
   intentional (a filed title is evidence); just be aware the closed item's title will
   stay misleading to anyone who reads only frontmatter.

## Probes needed (nothing here blocks the merge)

1. Fold-mutation discrimination, since my "no other `truncated` term can fire" walk is
   reasoning and not observed output. cwd `/home/arggon/Projects/ArggonManager-bug-native-steps-truncated-flag-dropped`:
   delete the `kernelDroppedSteps ||` line from `boundedPreparation`, then
   `npx vitest run opencode/plugins/arggon/tools.test.ts -t "mirrors the kernel's capped preparation log"`
   — expect `preparation.truncated` to be `undefined` and the assertion to fail with
   "the shared flag names it too". Restores nothing; run on a scratch copy or
   `git checkout -- opencode/plugins/arggon/index.ts` afterwards. What it would
   change: if some other term fires in that fixture, the fold mutation would survive
   and the item's mutation evidence is weaker than claimed (the fix itself would
   still be correct).
2. Optional: pre-fix reproduction of the defect on the parent commit
   (`d0921ade^` per the item) with the new test cherry-picked — expects
   `expected undefined to be true`. Confirms the test fails without the fix on the
   merge base, not just on an older tree. Would change nothing about my verdict.
3. Push the primary's local `main` (9 unpushed commits carrying the two follow-up
   items) — operational, but a lost item is a lost finding.

## Merge recommendation

**Merge.** The defect is fixed at the right altitude (mirror the kernel's decision,
never re-derive it), the defense-in-depth slice is additive rather than a replacement
and its non-firing is disclosed by `truncated`, the class sweep holds up field by
field against the kernel source, the tests are real seam runs whose assertions
discriminate and cannot pass vacuously, the premise correction about the CLI is
accurate and is honoured by how parity is asserted, the doc contract is still
bidirectional with the eighth scenario as the required reverse-direction witness, the
incident record is complete on the branch, and the bundle is CI-gated byte-identical.
Follow-ups: push the primary's `main` so the two filed items survive.
