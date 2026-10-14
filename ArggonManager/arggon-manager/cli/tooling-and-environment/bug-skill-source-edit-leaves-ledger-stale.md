---
type: bug
status: in_progress
id: bug-skill-source-edit-leaves-ledger-stale
title: "Editing a bundled-skill source leaves the provenance ledger stale: skills:sync writes the copy but never updates its x-generated checksum, and init classifies the regenerated copy as adopter-modified — the local provenance audit goes red and CI cannot see it"
assignee: arggon-delivery-lead
branch: fix/bug-skill-source-edit-leaves-ledger-stale
parent: tooling-and-environment
labels: [seam, provenance, cli]
created: "2026-10-13"
updated: "2026-10-14"
claimed_at: "2026-10-14T10:58:36.462Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-skill-source-edit-leaves-ledger-stale
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-skill-source-edit-leaves-ledger-stale.md
  Leaves live only under a story. id is the filename stem: bug-skill-source-edit-leaves-ledger-stale.
  CLI `arggon create bug skill-source-edit-leaves-ledger-stale` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Editing a bundled-skill source leaves the provenance ledger stale: skills:sync writes the copy but never updates its x-generated checksum, and init classifies the regenerated copy as adopter-modified — the local provenance audit goes red and CI cannot see it

## Context

Found 2026-10-12/13 by the delivery lead after running `npm test` in the primary:
the repo-level provenance audit (`cli/src/provenance-audit.test.ts`, "this repo's
own committed seam has no ledger violations") failed with **one**
`stale-checksum` violation for
`.agents/skills/arggon-cli/references/json-contract.md`.

The chain, reproduced end to end:

1. PR #751 edited the **source** `skills/arggon-cli/references/json-contract.md`
   (the force-parameter correction). Sources are the single committed truth;
   `.agents/skills/**` is its generated, **gitignored** copy.
2. `npm run skills:sync` (and `npm test`, which rewrites the copies) regenerated
   the copy as `generatedMarker(source) + spliced` — but `sync-skills.ts`
   **never updates the ledger** (`.convention.yml` `x-generated` checksum for
   that dest). Its own docblock says it exists so "local dev and skill-reading
   agent clients always see the file on disk".
3. `arggon init` then classifies the regenerated copy as
   **`modified-skip` — "adopter-modified — kept"** (its bytes no longer match
   the recorded checksum, and no record distinguishes "regenerated from a
   changed source" from "hand-edited"), so nothing ever refreshes the ledger.
4. Result: any tree where the copy exists (every dev checkout) fails the audit
   after a source edit; **CI cannot see it** because the copies are gitignored
   and absent in a fresh checkout, so the lane stays green while every local
   `npm test` on `main` is red.

Immediate repair applied by the lead: the ledger entry's checksum re-recorded
to the copy's actual bytes (`fd581f9a`, `arggonVersion: 0.7.0`) — audit green
again locally. This item is about the mechanism, not that one record.

## Acceptance

- [ ] Decide and implement the durable fix, with reasoning: e.g. `skills:sync`
      re-records the ledger entry it regenerates; or the audit treats a
      marker-carrying copy as generated and verifies it against the **source
      template's** checksum instead of the copy's; or `init` gains a
      "regenerate generated copies + refresh records" path that runs on the
      release/re-pin flow. State which and why it cannot mask a hand edit of a
      generated copy
- [ ] A test pins the chosen mechanism (edit a source → sync → audit green
      without hand-editing the ledger)
- [ ] The CI gap is named: either the audit's local-only blind spot is recorded
      as accepted (with the reason), or CI gains a step that materializes the
      copies before auditing
- [ ] `arggon validate` green; no mass churn of unrelated ledger entries

## Notes

### 2026-10-13 @arggon-delivery-lead — the repair tripped the drift gate, and the right fix was the overdue re-pin

Re-recording the checksum alone was not the whole repair: setting the entry's `arggonVersion` to `0.7.0` (the version whose sync actually wrote the copy) made the `tasks-validate` drift gate demand the **post-release re-pin** — `ARGGON_VERSION (0.6.0) lags the committed arggon seam (0.7.0)`, exactly as `release.md` §"The re-pin" prescribes after a release. The re-pin was overdue for 0.7.0 and was completed the same hour: both pins (`templates/docs/github/workflows/arggon.yml`, `.github/workflows/arggon.yml`) bumped to `0.7.0` and the seam regenerated with the 0.7.0 build (`5520c227`); `ci-seam-pin.test.ts` + `provenance-audit.test.ts` green (16/16).

Lesson for this item's fix: **whoever updates the ledger must respect the pin** — a version stamp newer than `ARGGON_VERSION` is a re-pin request, not a bookkeeping edit. Either the fix's mechanism keeps the stamp at the pin, or it (correctly) routes the re-pin flow. Record this in the acceptance's decision.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
### Recurrence — 2026-10-13 (delivery lead)
Same class, new instance: PR #771 merged a source edit to `skills/arggon-cli/references/exploration.md` (the ADR 0017 stopping rule). In any local checkout where `arggon init` / `npm run skills:sync` has materialized `.agents/skills/arggon-cli/references/exploration.md`, the `x-generated` ledger record for that derived copy is now stale — `cli/src/provenance-audit.test.ts` fails locally (three separate wave-3 worktrees hit it this session; fresh checkouts and CI skip the absent destination at `docs.ts:1675`, so CI stays green). Third observed instance of sync-never-updates-the-ledger (`json-contract.md` after #751; `exploration.md` after #771). Reinforces the item's acceptance: the sync path should re-record the derived copy's checksum.
