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

- [x] Decide and implement the durable fix, with reasoning: e.g. `skills:sync`
      re-records the ledger entry it regenerates; or the audit treats a
      marker-carrying copy as generated and verifies it against the **source
      template's** checksum instead of the copy's; or `init` gains a
      "regenerate generated copies + refresh records" path that runs on the
      release/re-pin flow. State which and why it cannot mask a hand edit of a
      generated copy
- [x] A test pins the chosen mechanism (edit a source → sync → audit green
      without hand-editing the ledger)
- [x] The CI gap is named: either the audit's local-only blind spot is recorded
      as accepted (with the reason), or CI gains a step that materializes the
      copies before auditing
- [x] `arggon validate` green; no mass churn of unrelated ledger entries

## Notes

### 2026-10-13 @arggon-delivery-lead — the repair tripped the drift gate, and the right fix was the overdue re-pin

Re-recording the checksum alone was not the whole repair: setting the entry's `arggonVersion` to `0.7.0` (the version whose sync actually wrote the copy) made the `tasks-validate` drift gate demand the **post-release re-pin** — `ARGGON_VERSION (0.6.0) lags the committed arggon seam (0.7.0)`, exactly as `release.md` §"The re-pin" prescribes after a release. The re-pin was overdue for 0.7.0 and was completed the same hour: both pins (`templates/docs/github/workflows/arggon.yml`, `.github/workflows/arggon.yml`) bumped to `0.7.0` and the seam regenerated with the 0.7.0 build (`5520c227`); `ci-seam-pin.test.ts` + `provenance-audit.test.ts` green (16/16).

Lesson for this item's fix: **whoever updates the ledger must respect the pin** — a version stamp newer than `ARGGON_VERSION` is a re-pin request, not a bookkeeping edit. Either the fix's mechanism keeps the stamp at the pin, or it (correctly) routes the re-pin flow. Record this in the acceptance's decision.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx

### Recurrence — 2026-10-13 (delivery lead)

Same class, new instance: PR #771 merged a source edit to `skills/arggon-cli/references/exploration.md` (the ADR 0017 stopping rule). In any local checkout where `arggon init` / `npm run skills:sync` has materialized `.agents/skills/arggon-cli/references/exploration.md`, the `x-generated` ledger record for that derived copy is now stale — `cli/src/provenance-audit.test.ts` fails locally (three separate wave-3 worktrees hit it this session; fresh checkouts and CI skip the absent destination at `docs.ts:1675`, so CI stays green). Third observed instance of sync-never-updates-the-ledger (`json-contract.md` after #751; `exploration.md` after #771). Reinforces the item's acceptance: the sync path should re-record the derived copy's checksum.

### 2026-10-14 @ses_ec5ee8017ffenAoLAgVVe7sCfF

### 2026-10-14 @ses_ec5ee8017ffenAoLAgVVe7sCfF (maker) — implemented: PR #804

**Chosen mechanism (both halves, because either alone leaves the class reachable).**

1. **The writer records what it regenerates.** `cli/src/sync-skills.ts` is now an
   importable `syncBundledSkills(root)` (guarded direct invocation) that writes each
   gitignored copy AND re-records its `x-generated` row from the SAME source-derived
   bytes it wrote — checksum + `generatedAt` refreshed, `template` recorded, the row's
   `arggonVersion` **preserved** (a row created by the script inherits the state's
   newest stamp), so a per-checkout copy can never move the seam version the drift gate
   polices (your 2026-10-13 note: the mechanism keeps the stamp at the pin, it never
   routes a re-pin). An `acknowledged` row is left alone (an ack is an ownership
   statement), and a ledger that does not parse is NOT rewritten from the tolerant
   reader's empty result (that would delete rows the reader could not read) — that
   repair is `arggon init`'s. Idempotent: a no-op sync leaves the state byte-identical.
2. **The gate is derivation-checked, so CI sees it with no copies on disk.**
   `auditGeneratedProvenance` gained `isBundledSkillDest` (new kind
   `stale-derived-checksum`): a skill copy is a pure function of its committed source
   (`generatedMarker(source) + source`, no placeholders in `skills/**`), so the row must
   equal that render **even when the copy is absent** — exactly the surface a fresh
   checkout/CI has.

**Why it cannot mask a hand edit of a generated copy.** The refreshed checksum is computed
from the _source template render_, never read back from the destination — a hand edit can
never enter the ledger as "generated". The audit's copy rule is unchanged (bytes ≠ render stay
silent) and `init`'s decision table is untouched: a marker stays evidence of origin, never
permission to overwrite. Pinned by the "never blesses a hand edit" test (row keeps the source
render while the edited copy's checksum differs).

**CI gap: closed inside the audit, not accepted and no CI step added.** Materializing copies
in CI cannot witness a stale committed row (the materializer would have to _not_ record — the
defect itself). Verified: with `.agents/skills/**` removed (CI shape) + a source edit + no
sync, the repo-self audit fails `stale-derived-checksum`; `npm run skills:sync` clears it.

**Repeated end to end in this checkout (expected vs observed).**

- `npm run skills:sync` (copies present, ledger current) → state file byte-identical (no churn).
- Edit `skills/.../pitfalls.md` → `provenance-audit` RED, kind `stale-derived-checksum`, reason names both checksums + the remedy → `npm run skills:sync` → row diff = checksum + `generatedAt` only (`arggonVersion: 0.7.0` preserved) → audit GREEN.
- `rm -rf .agents/skills` + source edit + no sync → audit RED (previously the absent-copy skip made this GREEN, which is why CI could not see it).
- Pre-fix baseline in the same tree: with a stale row and the copy materialized by the parity test, RED; with the copy stale, GREEN — i.e. order-dependent. Post-fix the verdict is order-free.

**Gates (all green, HEAD ddce3a0a).** `npm run build` (plugin bundle untouched);
focused 13 files/256 tests (provenance-audit, skill-copy, skill-generated-commands,
sync-command, plugin-copy, ci-seam-pin, convention, convention-option-doc-contract,
adr-status-doc-contract, adopter-template-invariant-drift, eol-provenance, init-docs, doctor);
`npm test` 156 files / 3386 tests (materialized-copy checkout: edit → sync → green);
`npm run lint`; `npm run test:structure` (5 passed); `npm run arggon -- validate` ok;
`npx prettier --check` on the four touched files.

**Tests added** (`cli/src/provenance-audit.test.ts`, "derived bundled-skill rows"): fresh-checkout
shape red → `skills:sync` → green without a hand-edited ledger; hand edit never blessed;
version stamp inherited + unchanged rows byte-identical; acked rows and an unparseable ledger
left alone. Each of the four guards was mutation-checked (disabling it fails a test).

**Ledger churn: none.** All seven skill rows were already current and the writer is idempotent,
so the PR carries no `x-generated` diff — the mechanism is proven by the tests, not by rewriting rows.

**Named bound (not hidden):** a merge that DELETES all seven skill rows is invisible in CI — a row's
absence with no copy on disk strands nothing (`skills:sync`/`init` recreate the copy), so the audit
keeps its "no generator bytes on disk" semantics instead of growing a completeness rule. The item's
recurrence class is staleness, which is now gated. Extending the same derivation to the vendored
plugin rows is deliberately out of scope (they are excluded by design: `check:plugin` +
init's re-vendor self-heal).

Docs: `ArggonManager/docs/convention.md` §Generated-doc provenance now names this third, seam-side
refresh path and corrects the "skill copies are tracked" claim (tracked in an adopter tree,
gitignored in the seam repo's own checkout).

### handoff 2026-10-14 @ses_ec5ee8017ffenAoLAgVVe7sCfF (session: ses_ec5ee8017ffenAoLAgVVe7sCfF) — next: Review/merge PR #804; confirm the unit lane's provenance-audit run on the PR is green (it now checks the derived skill rows with no copies on disk).

- branch: fix/bug-skill-source-edit-leaves-ledger-stale
- open questions: Dropped-row case (merge deletes all seven skill rows) is invisible in CI by design — recreate-on-materialize, no stranded artifact; extend derivation to vendored plugin rows? (out of scope: check:plu…

### 2026-10-14 @ses_ec5ee8017ffenAoLAgVVe7sCfF
### Addendum @ses_ec5ee8017ffenAoLAgVVe7sCfF — final HEAD 219378df (comment-only delta)

One commit after the evidence comment: a comment-only guard in
`cli/src/skill-copy.test.ts` stating that the parity test must NOT re-record the
rows (routing it through `syncBundledSkills` is the tempting simplification, and
it would repair the ledger before the audit runs in the same suite — the gate
would go blind, which is the defect itself).

Gates re-run at final HEAD **219378df**: `npm test` 156 files / 3386 tests green
(materialized-copy checkout), `npm run lint` clean, `npm run arggon -- validate` ok,
`npx prettier --check` clean. CI on the branch: `tasks-validate` green (drift gate +
`arggon validate`), `cli` lane running at comment time. Item status left
`in_progress` with your claim; acceptance boxes ticked, `done` not flipped.
