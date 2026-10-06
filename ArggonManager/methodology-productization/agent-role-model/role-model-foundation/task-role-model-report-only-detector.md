---
type: task
status: done
id: task-role-model-report-only-detector
title: "Report-only detector: `accept:` classification in `sync --json` + `spec analyze` finding for a container closed with no recorded acceptance"
assignee: arggon-coordinator
branch: feat/task-role-model-report-only-detector
parent: role-model-foundation
labels: [methodology, cli, report-only]
priority: p1
created: "2026-10-04"
updated: "2026-10-05"
depends_on: [task-spec-promotion-policy-and-acceptance]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-role-model-report-only-detector.md
  Leaves live only under a story. id is the filename stem: task-role-model-report-only-detector.
  CLI `arggon create task role-model-report-only-detector` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Report-only detector: `accept:` classification in `sync --json` + `spec analyze` finding for a container closed with no recorded acceptance

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR 0021 §4 and exploration finding F6: both surfaces this needs already ship —
`arggon sync --json` parses the bounded verdict header and classifies items
report-only (`ArggonManager/docs/engineering.md:109`), and `spec analyze` already
emits decision-pipeline findings (`ArggonManager/docs/agents.md:450`). The work is
two additive rules, not a new tool.

This report is also the **evidence a future kernel gate would need** (ADR 0021 C3
was rejected, not discarded): it must prove low-noise before anyone proposes the
gate again.

## Acceptance

- [x] Depends on `task-spec-promotion-policy-and-acceptance` (ADR 0017 gate) landing first
- [x] **Acceptance classification shipped on `report --json` and `show --json`**, and the dated amendment to ADR 0021 §4 lands in this PR naming those surfaces — **coordinator adjudication**: spec-018 (accepted, `e14dd75e`) superseded this row's original `sync --json` wording, because `sync` classifies only items reconciled with an open PR (`lib/src/sync-command.ts:83`) and acceptance is container-level, so `sync` cannot carry it. `sync` is byte-identical, by design. All four states (`accepted`/`changes-noted`/`none`/`self-accepted`) and the supersede rule are implemented and tested. The worker struck this row rather than ticking it or silently redefining the AC — correct escalation, resolved here
- [x] `self-accepted` is reported when the acceptance author equals the item's own assignee (forgery is expected and reported, never blocked)
- [x] Additive `spec analyze` finding for a container closed with no recorded acceptance; report-only, never fails the run, no NEW-finding noise on a corpus with zero acceptances
- [x] Report-only on every surface: no transition, no CI failure, no auto-filed item
- [x] Unit tests travel with the behavior; the verdict-parity tests stay green; `mcp-parity` / `mcp-doc-contract` unaffected (no schema change)
- [x] Docs updated in the same PR (`docs/json-output.md` payload + envelope surfaces)
- [x] `arggon validate` + `arggon spec validate` + `npm test` green

### Why the `sync --json` box is unticked (2026-10-04, spec `promotion-policy-018`)

The box as written predates the spec's grounding. `arggon sync --json` classifies only
the items it reconciles with an **open PR** (`lib/src/sync-command.ts:83` builds the
verdict map over PR matches), and a product acceptance is a **container**-level decision
— containers carry no branch, so a container's acceptance could never appear there. The
spec therefore moved the classification to the two surfaces that already aggregate per
container and per item, and required the dated amendment to ADR 0021 §4 naming them
instead of `sync`; **`sync` is left byte-identical** (regression-tested). Every other
clause of the box is implemented and unit-tested in
`cli/src/acceptance-convention.test.ts`. The box stays unticked, and its text is struck
through rather than deleted, so the divergence between this checklist and the shipped
surface stays visible to the next reader.

### 2026-10-04 @ses_ef74306c7ffeyb24EIcXcBGIoM
verdict: approve

**Report-only `accept:` detector (ADR 0021 §4, spec `promotion-policy-018`)** — all gates run from the item worktree `/home/arggon/Projects/ArggonManager-task-role-model-report-only-detector` on `feat/task-role-model-report-only-detector`.

## Gates — expected vs observed

| Gate | Expected | Observed |
| --- | --- | --- |
| `npm run arggon -- validate` | `ok (0 warning(s), convention v5)` | **identical**: `arggon validate: ok (0 warning(s), convention v5)`, exit 0 |
| `npm run arggon -- spec validate` | `ok`, only the 5 pre-existing `DOC_NUMBER_COLLISION` warnings | **identical**: `arggon spec: ok (34 doc(s), 5 warning(s))`, exit 0 (5 pre-existing plan/spec number collisions, tracked by `task-release-pipeline-baseline-new-collisions`) |
| `npm run arggon -- spec analyze` | no NEW finding for `spec-promotion-policy-018`; this repo unarmed so the new bucket is empty | **10 finding(s) across 21 spec(s), exit 0**, all pre-existing kinds (`duplicate-doc-number`, `no-error-path`, `vague-quantifier`); `--json` buckets: `ambiguity 5, consistency 5, decisions 0, productAcceptance 0` — **zero** acceptance findings, nothing about promotion-policy-018 |
| `npx prettier --check <every touched file>` | all 9 code/doc files formatted | **"All matched files use Prettier code style!"** |
| `npm test` (after `npm run build`) | all suites green | **127 files / 2624 tests passed**, 0 failed. Note: `npm test` alone fails 4 suites on a tree without build output (`headless-ci`, `lib-build`, `pack-contents`, `plugin-copy` all assert `dist/` or the built bundle exists) — pre-existing, they pass after `npm run build`, which is the documented order |
| `npm run build` | clean tsc (lib + root + typecheck + e2e) | **exit 0**, no diagnostics; regenerates `opencode/plugins/arggon/index.bundle.ts` (42 modules, 464371 bytes) — committed, as the `plugin-copy` drift gate requires |
| `npm run smoke:native-start-cold` | pass (durable CI gate for kernel changes) | **`smoke:native-start-cold passed`**, exit 0, all 5 cold starts + both strict-mode legs ok |
| `npm run lint` / `npm run test:structure` | clean | **exit 0** both; ast-grep 5/5 rules pass (the `acceptance-rows-use-kernel` rule does not apply — the new module lives in `lib/src/**`, the grammar's owner) |

New behaviour tests: `cli/src/acceptance-convention.test.ts`, **35 tests**, covering every boundary `verdict.test.ts` pins on the `accept:` vocabulary (incl. `acceptance`/`approved`/`approvals` near misses), attribution/`self-accepted`, both payload fields, the armed/unarmed finding, AC 7 (a late acceptance clears it), AC 8 (the done gate and the cascade reach the **same** verdict with and without acceptance comments) and `sync` staying byte-identical.

## Interpretations the reviewer should check (not spec text)

1. **`report --json`/`show --json` carry `acceptance` UNCONDITIONALLY** (`none` for an unarmed repo); only the `spec analyze` finding is gated on `x-tracker.product-acceptance: true`. AC 3/AC 4 ask for the field with no arming condition, and ungated is what makes the spec's own deferred-gate metric (accepted ÷ terminal containers) computable. The **human** surfaces (table, `show` text) are byte-identical — asserted in tests — so an adopter that never adopts the convention sees no change in what it reads.
2. **`self-accepted` comparison folds case** (logins are case-insensitive), so `Gonzalo`/`gonzalo` cannot slip past the attribution signal. More reporting, never less.
3. **The finding's scope is `story` containers** (the promotion policy's T1 row, and the rows `report` aggregates). Leaves and epic/initiative are excluded by construction; the scope is one exported constant (`ACCEPTANCE_CONTAINER_TYPES`) if the policy later widens.
4. **A malformed `.convention.yml` degrades the detector to unarmed** instead of failing a report-only scan; `arggon validate` owns config parse errors.
5. **`self-accepted` and `changes-noted` both count as gaps** (AC 5: "latest state is not `accepted`").

## One box deliberately left unticked

The checklist's `sync --json` classification box contradicts spec-promotion-policy-018's grounding (`sync` only classifies PR-reconciled items; containers never carry a PR). The box is **struck through, not rewritten**, with the reason under the list, and the ADR 0021 §4 dated amendment lands in this PR. `sync` is byte-identical.

## Files I do not own that now carry a stale sentence (advisory — I did not touch them)

- `ArggonManager/docs/convention.md` §Tracker hygiene: the `x-tracker` option list ("the official options today are `auto-commit`, `allow-steal`, `strict-gate-bins`, `strict-worktree-writes`") and the parse-error sentence ("an `auto-commit`/`allow-steal`/`strict-gate-bins`/`strict-worktree-writes` value that is not `true`/`false` is a parse error") both need `product-acceptance`.
- `ArggonManager/docs/engineering.md` §Review bar: the `accept:` convention prose + the promotion-policy tier table (that file is `task-wire-role-model-carriers`'s; the spec fixes the tier *content* only).
- `ArggonManager/docs/agents.md`: §Specs and plans enumerates the decision-pipeline finding kinds; the new bucket is separate so that sentence stays true, but a mention of `MISSING-PRODUCT-ACCEPTANCE` would be consistent.

### handoff 2026-10-04 @ses_ef74306c7ffeyb24EIcXcBGIoM (session: ses_ef74306c7ffeyb24EIcXcBGIoM) — next: Review PR #637 (merge, do not squash), then flip the item to done after merge verification
- branch: feat/task-role-model-report-only-detector
- open questions: Payload fields ungated while the finding is gated by x-tracker.product-acceptance — agree?; story-only scope OK?; case-folded self-accepted OK?; convention.md x-tracker sentence needs product-accepta…

### 2026-10-04 @ses_ef74306c7ffeyb24EIcXcBGIoM
verdict: approve

**Follow-up on PR #637** — the blocking gap (the `x-tracker.product-acceptance` option was implemented but undocumented in the file that defines the `x-tracker` contract) is closed. One file changed: `ArggonManager/docs/convention.md` §Tracker hygiene, in three places:

1. **The official-options prose** now reads `…`strict-worktree-writes` (single-writer enforcement), and `product-acceptance` (product-acceptance recording)`.
2. **The representative YAML** gained `product-acceptance: true` alongside the other three.
3. **A new bullet** states what arming means, in one place: the record is an ordinary comment on the item (`accept: approve | accept: changes-requested`, optional scope, then the evidence) — human-written prose, never schema, no flag writes it; unset/`false` keeps every adopter **silent** while `report --json`/`show --json` still carry the additive `acceptance` field (`none` when nothing was recorded) and only `spec analyze` reports (the report-only `MISSING-PRODUCT-ACCEPTANCE` finding); arming is the act of saying the project HAS a product owner and wants the record, so a project without one is compliant by default and is never nagged; **report-only either way** — no transition consults it, no command refuses because of it, CI never fails on it; attribution (`self-accepted`), never authentication, because the tracker has no identity layer.
4. **The parse-error sentence** now enumerates `product-acceptance` among the `x-tracker` keys that must be `true`/`false`. The "unknown nested keys are ignored (ignore-unknown, forward compat)" rule is **untouched**.

## Rebase outcome — and a constraint that changed the plan

`git fetch && git rebase origin/main` (f2163380, PR #636) applied **cleanly, zero conflicts**: #636 edited `convention.md` prose my change does not overlap, and its three new `bug-*` items are unrelated to my files.

**The rebase then could not be pushed**: the seam denies force-push in *every* spelling (`git push --force-with-lease` → `Permission denied: shell`), and a rebased branch is not fast-forwardable. I therefore took the fallback you named — undid the rebase and **`git merge origin/main`** instead (`ort` strategy, **also zero conflicts**), which pushes fast-forward. Net effect for you: the PR carries one merge commit (`9efbcf0f`) rather than a linear replay. Nothing was force-pushed and no history was lost; the rebased attempt was a local-only branch, verified byte-identical in content, and deleted after the merge landed.

**Plugin bundle: no regeneration was needed.** `opencode/plugins/argdon/index.bundle.ts` — #636 did not change any bundle-inlined module, so both sides' bundle bytes are identical; the merge kept it untouched and `npm run check:plugin` exits 0. It carries my kernel code (10 matches for `classifyAcceptance`/`productAcceptance`/`MISSING-PRODUCT-ACCEPTANCE`). The conflict risk I flagged earlier did not materialise.

## Gates — expected vs observed (post-merge, from the item worktree)

| Gate | Expected | Observed |
| --- | --- | --- |
| `npm run arggon -- validate` | `ok (0 warning(s), convention v5)` | **identical**, exit 0 |
| `npm run arggon -- spec validate` | `ok`, only the 5 pre-existing `DOC_NUMBER_COLLISION` warnings | **identical**: `arggon spec: ok (34 doc(s), 5 warning(s))`, exit 0 |
| `npm run arggon -- spec analyze` | no NEW finding for this spec; repo unarmed ⇒ bucket empty | **identical**: `10 finding(s) across 21 spec(s)`, exit 0 (`--json` buckets: `ambiguity 5, consistency 5, decisions 0, productAcceptance 0`) |
| `npx prettier --check` (convention.md + json-output.md + ADR 0021) | formatted | **"All matched files use Prettier code style!"** |
| `npm run build` | clean tsc + regenerated bundle | exit 0; `build:plugin — 42 modules inlined, 464371 bytes` |
| `npm run check:plugin` | exit 0 (committed bundle == deterministic build) | **exit 0**, and `git status` shows **no** bundle diff |
| `npm test` | green | **127 files / 2625 tests passed**, 0 failed (2625 vs 2624 before the rebase: #636 added one test) |
| `gh pr checks 637` | all green | **cli pass (6m6s) · tasks-validate pass (29s) · ui-smoke pass (2m11s)**; `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE` |

I did not re-run `npm run smoke:native-start-cold` this round (it is not in this round's gate list and takes several minutes); the kernel is byte-unchanged by this follow-up, which touches one markdown file.

## One finding worth filing (not filed by me — your call)

**No test guards the `x-tracker` option list against doc drift.** I grepped: `cli/src/convention.test.ts` and the rest assert parsing behaviour, never the prose that enumerates the options. That is exactly why this gap survived a green CI on PR #637 — the implementation, the parse-error test and the convention doc can disagree and everything stays green. A structural guard (the option list in `convention.md` §Tracker hygiene derived from `TrackerConfig`'s keys, the way `tools/ast-grep` and the ast-grep rules already work) would make the next option impossible to ship undocumented. Owner: whoever owns `cli/src` conventions; I did not file it because it is outside this item's scope and you asked for findings, not items.

## Untouched, as instructed

`agents.md`, `engineering.md`, `README.md`, `skills/**`, `templates/**`, `smoke/**` — no edits. No tracker item other than this one. The struck-through `sync --json` checklist row is left **exactly** as I wrote it (you are adjudicating it). Item **not** flipped to `done`; PR **not** merged.

**Merge, do not squash** — the branch carries tracker auto-commits.

### 2026-10-04 @ses_ef74306c7ffeyb24EIcXcBGIoM
Correction to the previous comment (typo, no change to substance): the generated bundle path is `opencode/plugins/arggon/index.bundle.ts` — I wrote `argdon` once. The `check:plugin` result and the 10-match content check both refer to that file.

### handoff 2026-10-04 @ses_ef74306c7ffeyb24EIcXcBGIoM (session: ses_ef74306c7ffeyb24EIcXcBGIoM) — next: Review + merge PR #637 (merge, do not squash); CI green, mergeStateStatus CLEAN
- branch: feat/task-role-model-report-only-detector
- open questions: PR now carries a merge commit (force-push denied by the seam, so I merged origin/main instead); adjudicate the struck-through sync --json row; doc-drift guard for the x-tracker option list is unfiled

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
verdict: approve (coordinator adjudication, 2026-10-04)

PR #637 merged (`0c271bc2`) after the `convention.md` gap you flagged was closed — the
`x-tracker.product-acceptance` option is now in the official-options prose, the
representative YAML, its own meaning bullet, and the parse-error sentence. Force-push
being denied in every spelling, and your merge-instead-of-rebase fallback with
`--force-with-lease` correctly refused: a fast-forwardable merge over a local rebase was
the right call, and reporting it rather than routing around the permission is exactly
right.

**Adjudicated: the struck-through `sync --json` row.** You were right not to tick it and
right not to silently redefine the AC. The resolution is that the row is **superseded,
not unimplemented**: spec-018 (`e14dd75e`) and the dated ADR 0021 §4 amendment both
assign the classification to `report --json` + `show --json`, because `sync` only
classifies items reconciled with an open PR and acceptance is container-level. I rewrote
the row to name what shipped and why, and ticked it. All four states and the supersede
rule are implemented and tested.

Gates verified by me after the merge: `arggon validate` → `ok (0 warnings)`; the item is
`done` through the kernel's done gate with **zero** unticked boxes (no waiver).

Your unfiled finding — no test guards the `x-tracker` option list against doc drift, which
is exactly why this gap shipped green — is a good one and I am filing it rather than
letting it die in a comment.
