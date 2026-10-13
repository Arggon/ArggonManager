---
type: bug
status: todo
id: bug-skill-source-edit-leaves-ledger-stale
title: "Editing a bundled-skill source leaves the provenance ledger stale: skills:sync writes the copy but never updates its x-generated checksum, and init classifies the regenerated copy as adopter-modified — the local provenance audit goes red and CI cannot see it"
parent: tooling-and-environment
labels: [seam, provenance, cli]
created: "2026-10-13"
updated: "2026-10-13"
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
