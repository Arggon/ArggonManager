---
type: task
status: in_progress
assignee: Arggon
branch: feat/task-opencode2-payload-contract-preparation-fields
id: task-opencode2-payload-contract-preparation-fields
title: "`docs/opencode2.md` Payload contract omits `preparation.claim` and `preparation.env`, so shipped take-over/receipts are invisible there"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs]
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-opencode2-payload-contract-preparation-fields.md
  Leaves live only under a story. id is the filename stem: task-opencode2-payload-contract-preparation-fields.
  CLI `arggon create task opencode2-payload-contract-preparation-fields` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/opencode2.md` Payload contract omits `preparation.claim` and `preparation.env`, so shipped take-over/receipts are invisible there

## Context

Found while reviewing PR #598 (task-adr-0019-hatch-shipped-wording): `ArggonManager/docs/opencode2.md` §Payload contract documents the `start` row's `preparation?` field but never names `preparation.claim` or `preparation.env`, so the shipped claim stamp / take-over receipt and the worktree env contract are invisible in the architecture doc. Pre-existing since PR #568 (task-strict-attach-dead-owner-hatch). A gap in the doc, not a false statement — the fields exist and ship.

## Acceptance

- [x] The `start` row documents `preparation.claim` (stamp owner/claim time/takeOver/takeovers) and `preparation.env` (written/keys/gitignored/warning)
- [x] A doc-contract test asserts the documented shape matches the shipped payload, so a new `preparation.*` field cannot ship undocumented

## Notes


### 2026-10-03 @Arggon
## Evidence — docs + doc-contract test

**Changed (2 files, both on this branch):**

- `ArggonManager/docs/opencode2.md` — the `start` row now names `steps` (the bounded preparation log, bug-start-install-ordering), and a new field-by-field table documents the whole `preparation` receipt, including the two fragments the row never mentioned: `preparation.claim` (`stamped`, `foreignWrites.{owner,claimedAt,files,total}`, `takeOver.{at,by,replacedIdentity,replacedClaimedAt,replaced.*,files,total}`, `warning`) and `preparation.env` (`written`, `path`, `keys`, `seededDotenv`, `gitignored`, `warning`). Columns are `Field | Type | Bound | Notes`; the long-form prose stays in [`json-output.md`](../../../docs/json-output.md) §`start` (which already documents the CLI's flat `claim`/`env`), so this adds the native spelling rather than a second copy of the prose.
- `opencode/plugins/arggon/opencode2-doc-contract.test.ts` — the doc-contract test (5 cases, one fixture).

**Documented from the code, not the prose.** Every sub-field name and bound was read against `lib/src/worktree.ts` and the native projection in `opencode/plugins/arggon/index.ts`: `WorktreeClaimReceipt`/`WorktreeForeignWriteReport`/`WorktreeClaimTakeover`/`WorktreeClaimStamp`/`WorktreeClaimTakeoverRecord` and `WorktreeEnvReceipt`, plus the caps `MAX_CLAIM_WRITE_NAMES` (10), `MAX_CLAIM_TAKEOVERS` (5), `MAX_PREP_STEPS` (16), `MAX_GATE_BINS` (8), `MAX_MISSING_DEPENDENCIES` (10) and `WORKTREE_ENV_KEYS` (6). Two spellings worth knowing: the native receipt calls the log `steps` where the CLI envelope calls it `prepSteps`, and the kernel's own `stepsTruncated` flag is NOT forwarded by the native projection (see findings).

**Gates (all green, worktree cwd):**

```
npm run build && npm test          # 123 files, 2280 tests passed (+1 file, +5 tests)
npm run lint                       # eslint .
npm run arggon -- validate         # ok (0 warnings, convention v5)
npm run check:plugin                # 41 modules, 457609 bytes, no bundle diff
npm run test:structure             # 3 passed
npm run lint:structure             # ast-grep scan clean
npx prettier --check ArggonManager/docs/opencode2.md   # still byte-clean
npx vitest run cli/src/prose-format.test.ts           # 3 passed
```

**The test has teeth (mutation-checked, expected → observed):**

| mutation | expected | observed |
| --- | --- | --- |
| add `observedAt` to the native `boundedPreparation` return (`index.ts`) | coverage fails naming the undocumented field | `these fields ship in \`preparation\` with no row in …/opencode2.md — add a row: [ 'preparation.observedAt' ]` |
| `preparation.claim.stamped` row `boolean` → `string` | type check fails | `preparation.claim.stamped: documented string, payload carried boolean` |
| `MAX_CLAIM_WRITE_NAMES` bound `(10)` → `(20)` | bound check fails | `Bound does not state MAX_CLAIM_WRITE_NAMES = 10` (both file rows) |
| drop `"unavailable"` from the `install` union | vocabulary check fails | kernel's `WorktreeInstallState` ≠ documented union |
| drop the `takeovers` row | phantom-row check fails | `these rows document a field no real run ever carried: [ '…replaced.takeovers' ]` |
| drop `source` from the `gateBins` `{ … }` shape | entry-shape check fails | `GateBinResolution.source is missing from preparation.gateBins's documented shape` |

Coverage runs real `start` runs through every branch that adds a field: fresh claim (env written + six keys + seeded `.env` + gitignore probe + stamp), the owner's own attach (`written: false` + `warning`), a foreign attach (`foreignWrites`), the audited take-over, a SECOND take-over (so the replaced stamp carries a persisted `takeovers` chain), an over-cap detection (12 staged tracked writes → 10 named + exact `total` + `truncated`), and an unwritable stamp (`stamped: false` + `warning`). Arrays are the one terminal: a `string[]`/`object[]` cell documents its entries, and the `{ … }` shapes are cross-checked against the kernel structs.

**Cross-check of the rest of the `start` row (same failure mode: shipped but unmentioned).** The row's top-level list is complete against the code — `startProgressPayload` + the success envelope emit exactly `id`, `branch`, `worktreePath`, `worktreeCreated`, `branchCreated`, `preparation?`, `item`, `claimCommitted`, `claimCommit`, `commit?`, `pushed`, plus `rollback?` on a refusal, and the row names all of them. `preparation.steps` was the one real omission and this PR fixes it. Everything else found is outside this item's acceptance; reporting rather than widening the diff:

1. `preparation.stepsTruncated` — the kernel sets it when the preparation log hits `MAX_PREP_STEPS`, but the native projection never reads it (`boundedPreparation` only folds its OWN list cap, which cannot fire through the kernel because `MAX_NATIVE_PREPARATION_NAMES` is 32 > 16). A repo with more than 16 logged prep steps therefore gets a silently shortened `steps` array and no `truncated` on the native seam. The CLI keeps `stepsTruncated`.
2. `claimCommit`'s sub-fields are only partly named in the row (`committed: boolean`, `hash`, `message`, `skipped`, `ignored[]`; `hash` is at least mentioned in the prose below it). Not a wrong statement, the same incompleteness class.
3. `opencode/plugins/arggon/index.ts`'s `NativeClaimCommitReceipt.status` union still lists `"already-committed"`, which no code path emits (the "nothing to commit" case reports `"not-needed"`). Dead union member, doc-side enumeration is correct.

**On the earlier worker report about `conventionVersion`.** Verified in the code: `nativeStart` reads `const version = kernel.readConventionVersion(root)` once, before `nativeStartBody` touches branches, worktrees or rollbacks (`opencode/plugins/arggon/index.ts`, the read sits directly above the progress handler), and every envelope path — success, `startNotAttempted`, `startFailure`, `safeUnexpectedStartFailure` — reuses that captured value. So the reported version is the one read at entry even when a rollback removes the session's own cwd; nothing re-reads it. Truthful as reported.

### handoff 2026-10-03 @Arggon — next: Coordinator: review PR #609, merge, then verify; decide whether the 3 reported findings get follow-up items
- branch: feat/task-opencode2-payload-contract-preparation-fields
- open questions: stepsTruncated drop on the native projection: fix here or a new item?; claimCommit sub-fields: widen this doc or leave?

### 2026-10-03 @ses_f00388c74ffeLGtgqY4C4TZHF1
verdict: approve (docs + doc-contract test; no blocking finding)

Reviewed by reading only — diff, `lib/src/worktree.ts`, the native projection in
`opencode/plugins/arggon/index.ts`, both docs, the tracker items, and CI's own
check conclusions. No gate executed here; every gate transcript below is the
worker's, and the checks I could read directly off GitHub are green.

## What I verified by reading

**1. The doc is written from the code — every field, type and OPTIONALITY marker matches.**
`ArggonManager/docs/opencode2.md` now has 33 rows (135-181) plus the intro prose
(115-131). I checked each against the kernel types and the native projection:

- `claim` → `WorktreeClaimReceipt` (`lib/src/worktree.ts:1863`): `stamped` required,
  `foreignWrites?`/`takeOver?`/`warning?` optional — the doc's markers match, including
  `foreignWrites` = `WorktreeForeignWriteReport` (1706) with all four sub-fields required,
  `takeOver` = `WorktreeClaimTakeover` (1492) whose `replaced` is required and whose
  `files`/`total` are required, and `replaced` = `WorktreeClaimStamp` (1429) with
  `identity`/`item`/`branch`/`claimedAt` required and `assignee?`/`surface?`/`takeovers?`
  optional. Every marker is right.
- `env` → `WorktreeEnvReceipt` (`lib/src/worktree.ts:1058`): `written` required, the other
  five optional. The doc's *behavioural* claims also hold against the code: `keys` only on a
  fresh write (1258-1265), `path` on the attach that left the file byte-identical (1224),
  `enabled: false` → `{written:false, warning}` only (1175), `written: false` always with a
  `warning`.
- `steps?` optional is CORRECT for the native seam: the kernel type has `steps` required
  (`lib/src/worktree.ts:1347`) but the projection omits an empty log
  (`index.ts:2410`, `...(steps.length > 0 ? { steps } : {})`) — exactly what the row says.
- `install` union, `manifestCoverage` union, `gateBins.source` union and the `{ step, outcome, pkg? }`
  entry all match `WorktreeInstallState`/`ManifestCoverage`/`GateBinSource`/`WorktreePrepStep`.
- The two prose claims that could have been prose-invented are code-true: "Both ride every
  `start --worktree` run of both surfaces" (`index.ts:3595-3614` native, `cli/src/start.ts:918-932`
  CLI with `surface: "cli"`) and "a `worktree: false` run carries no `preparation` at all"
  (`progress.preparation` is only assigned under `if (worktreePath !== undefined)`,
  `index.ts:3585/3618`; no other assignment).
- The cross-reference is accurate: `json-output.md` §`start` really does carry the CLI's flat
  `claim`/`env` prose, the six env keys by name, the detection, and the 5-entry `takeovers`
  chain (lines 480-485, 502).

**2. The bounds are real, and the doc quotes the constant, not a copy.**
`MAX_MISSING_DEPENDENCIES = 10` (642), `MAX_GATE_BINS = 8` (767), `MAX_PREP_STEPS = 16` (1297),
`MAX_CLAIM_TAKEOVERS = 5` (1484), `MAX_CLAIM_WRITE_NAMES = 10` (1505),
`WORKTREE_ENV_KEYS` = 6 entries (1044). Every Bound cell names the constant AND states its value,
and the test checks the cell against the value parsed from the kernel source, so a kernel-side
change fails the doc rather than drifting.

**3. The test is faithful — it derives from payloads, not from a re-implementation.**
`opencode/plugins/arggon/opencode2-doc-contract.test.ts` drives the real seam
(`argonToolDefinitions(...).start.execute`, git-backed worktree domain — the same posture as
`tools.test.ts`, which already imports `runInit` from `cli/src/init.js`) through seven
scenarios, and I traced the scenario chain against the kernel's own stamp logic
(`prepareWorktreeClaim`, 1915): scenario 4 re-stamps under `takeOver`, scenario 5's replaced
stamp therefore carries the persisted `takeovers` chain (1985) — so the row is genuinely
observed and the phantom-row mutation fires for the right reason; scenario 6 stages 12 tracked
writes → 10 named + exact `total` + `truncated`; scenario 7 turns the stamp path into a directory
so the write fails on any path. Arrays are terminal, so entry shapes are the only nested
granularity and they are cross-checked against the kernel structs.

On the two cases you flagged — neither passes vacuously:
- *kernel unions* (`kernelUnion`, 385): the regex cannot silently return `[]`, because the
  assertion first pins that the doc row `declared === "enum"` (493-496) — an unparsable
  declaration yields `[]` on the kernel side against a 3-4 member doc union, which fails.
  Reformatting the struct to 4-space indent also fails loudly (see below), it does not pass empty.
- *kernel struct entry shapes* (`kernelStructBody`, 391): both directions are asserted —
  every documented field must exist in the struct, and every struct field must be documented
  (561-570). A missing/renamed `export type` → `body === ""` → reported (552), not skipped.

**4. Mutation evidence — spot-checked all six against the code paths that would fire.**
None can pass for the wrong reason; all four failure messages name the offending path (the
worker quoted three of them truncated, e.g. the bound message is
`preparation.claim.foreignWrites.files: Bound does not state MAX_CLAIM_WRITE_NAMES = 10`).
A field added to `boundedPreparation`'s return lands in `observed` via `observe()` and has no row
→ the coverage assertion fails naming it (460-464). Changing `stamped` to `string` fails the
type loop. `(10)`→`(20)` fails the bound loop on both file rows. Dropping `"unavailable"` fails
the vocabulary equality. Dropping the `takeovers` row fails phantom. Dropping `source` from the
gateBins shape fails the reverse direction. I reproduced each by reading, not by running.

**5. The three reported-not-fixed findings — all three real, all three correctly scoped out.**
- `stepsTruncated`: CONFIRMED dropped. The kernel sets it at `MAX_PREP_STEPS` (2061-2064, 2119);
  `boundedPreparation` folds only `(input.steps?.length ?? 0) > steps.length` against its own
  32-name cap (`index.ts:195, 2384`), which cannot fire through a kernel log capped at 16, and
  `stepsTruncated` appears nowhere in `index.ts`. Filed as `bug-native-steps-truncated-flag-dropped`
  with a class-sweep acceptance box, not just the one field. Correct call: this is a behavior fix
  on the native seam, not a doc fix.
- `claimCommit` sub-fields: CONFIRMED — the row names the four `status` values but not
  `committed`/`hash`/`message`/`skipped`/`ignored[]` (`NativeClaimCommitReceipt`, 2292). Filed as
  `task-opencode2-claimcommit-subfields-documented`, which also carries the dead
  `"already-committed"` member (2293 — no code path emits it; "nothing to commit" reports
  `not-needed`).
- Dead union member: CONFIRMED dead, and the doc's enumeration of emitted values is correct, so
  nothing false ships here.

**6. Scope and impact class.** Three files: the doc, the item file, one new test. No product
code touched (`lib/src/*`, `cli/src/*` untouched — confirmed by `git diff --stat`: the only
non-doc file is the test). No template, skill or seam file touched, so the PR #607 drift gate is
not engaged; CI step 7 ("Fail if the committed plugin bundle drifted from its source") is green.
**Impact class:** `ArggonManager/docs/opencode2.md` is NOT in the carrier set of
`agents.md` §Changing the methodology (`agents.md`, `engineering.md`, `convention.md`,
`skills/arggon-cli/**` — confirmed by grep: no carrier or skill file references `opencode2.md`
at all), and ADR 0020 §Decision 1 declares the same four. The rule therefore does not attach
to this PR and no impact-class statement is required — I checked because it is the one bar
that usually bites, and this is a genuine not-applicable, not an omission. No ADR needed either
(`engineering.md` §ADR "when not to": no external contract changed — the doc was brought up to
the shipped contract).

## CI (read off the PR, not assumed)

`statusCheckRollup` on #609 at 2026-10-03T03:2x — all three jobs SUCCESS:
`cli` (steps: build, bundle-drift, `npm run test`, lint, test:structure, lint:structure, and
step 12 "Native start cold-start smoke (tools.arggon.start worktree path)" — the
`smoke:native-start-cold` gate `engineering.md:100` puts in that lane, green),
`tasks-validate`, `ui-smoke`. `mergeStateStatus: CLEAN`. The review-time smoke bar is exempt
(docs-only per `engineering.md:94`), and this adds no runtime behavior.

## Non-blocking findings (none gate merge; all for a follow-up or a drive-by)

- **N1 (minor) — the suite does not pin OPTIONALITY, which is the rot class the intro names.**
  `opencode2.md:129-130` tells the reader "a trailing `?` marks a field the payload omits on some
  paths", but `parseFieldPath` (test:318-320) strips the `?` and `Row` (87) has no optionality
  field, so a false `?` on an always-present field (e.g. `preparation.claim.stamped?`) passes
  green. Every marker currently in the doc is correct (verified above), so nothing false ships —
  it is the gate that is one dimension short of the doc's own claim. Fix is small: keep the `?`
  on `Row`, track presence per scenario, and require a field present in ALL scenarios to be
  documented without `?`.
- **N2 (nit) — dangling `unionField` config.** `ENTRY_SHAPES` sets `unionField: "step"` for
  `preparation.steps` with no `union` (409-413), and the gate at 571 requires both, so that
  check never runs for the one list it looks configured for. The three-phase vocabulary is
  documented in the corpus (`json-output.md:480`), so nothing is wrong — but either spell the
  union in the row's notes so the gate fires, or drop the key.
- **N3 (nit) — the guarantee sentence is absolute where the suite's reach is scenario-bounded.**
  `opencode2.md:128-129` says "a field that ships without a row here fails that suite". True for
  any field the seven scenarios produce; a field emitted only on a path the suite never drives
  (the refusal `failBeforeClaim` receipt, or the `x-worktree.env: false` opt-out branch) would
  ship undocumented with the suite green. Suggest scoping the sentence to what the scenarios cover.
- **N4 (nit) — follow-up item title points at a path that does not exist.**
  `task-opencode2-claimcommit-subfields-documented`'s title says `preparation.claimCommit`; in the
  start payload `claimCommit` is a top-level sibling of `preparation` (`index.ts:3837-3838`,
  `3163`). Body text is correct; the title would send the next worker looking for a nested field.
- **N5 (nit) — duplicate rows are silently tolerated.** `rows` is a whole-doc `Map` keyed by path
  (345-355), so two conflicting rows for one field keep the last. A one-line duplicate assertion
  would close it.

## Unverified (and why it does not change the verdict)

- I did not run any gate. The local transcript (123 files / 2280 tests, lint, validate,
  check:plugin no drift, test:structure, lint:structure, prettier, prose-format) and the six
  mutation transcripts are the worker's. I re-derived each mutation's failure path from the test
  source and confirmed the messages name the field; CI confirms the suite is green end to end.
- GitHub's per-step logs for run 37092792933 are not retrievable through `gh api` from here
  (0 bytes), so I read step-level conclusions, not stdout. No probe needed: the check
  conclusions are the evidence the bar asks for.

## Recommendation

**Merge.** The item's acceptance is met: the `start` row now names `steps` plus a field-by-field
table for the whole `preparation` receipt written from the code (both surfaces verified), and the
doc-contract test pins names, types, literal unions, caps and entry shapes against real seam runs
with real teeth. N1 is worth a follow-up item in the same parent — it is the same incompleteness
class the item just closed, one dimension over (optionality), and the doc-contract harness now
exists to make it cheap.
