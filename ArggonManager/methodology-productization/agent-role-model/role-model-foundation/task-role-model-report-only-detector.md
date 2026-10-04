---
type: task
status: in_progress
id: task-role-model-report-only-detector
title: "Report-only detector: `accept:` classification in `sync --json` + `spec analyze` finding for a container closed with no recorded acceptance"
assignee: arggon-coordinator
branch: feat/task-role-model-report-only-detector
parent: role-model-foundation
labels: [methodology, cli, report-only]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
claimed_at: "2026-10-04T21:05:06.089Z"
depends_on: [task-spec-promotion-policy-and-acceptance]
worktree_path: /home/arggon/Projects/ArggonManager-task-role-model-report-only-detector
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
- [ ] ~~`sync --json` classifies a reconciled item as `accepted` / `changes-noted` / `none` from the `accept:` header~~ — **deliberately NOT built here; see the note below.** `sync` cannot carry this classification, so it landed on `report --json` (per container) + `show <id> --json` (per item), with the later-approve supersession
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
