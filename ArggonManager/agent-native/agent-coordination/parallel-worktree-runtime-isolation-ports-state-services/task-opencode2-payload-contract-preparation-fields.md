---
type: task
status: in_progress
id: task-opencode2-payload-contract-preparation-fields
title: "`docs/opencode2.md` Payload contract omits `preparation.claim` and `preparation.env`, so shipped take-over/receipts are invisible there"
assignee: Arggon
branch: feat/task-opencode2-payload-contract-preparation-fields
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs]
created: "2026-10-02"
updated: "2026-10-03"
claimed_at: "2026-10-03T02:50:00.635Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-opencode2-payload-contract-preparation-fields
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
