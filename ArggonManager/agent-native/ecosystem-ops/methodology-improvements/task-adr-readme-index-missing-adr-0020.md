---
type: task
status: in_progress
id: task-adr-readme-index-missing-adr-0020
title: "`docs/adr/README.md` index is missing ADRs 0005–0009 and 0020 (six rows), not just 0020"
assignee: Arggon
branch: feat/task-adr-readme-index-missing-adr-0020
parent: methodology-improvements
labels: [docs, adr]
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T23:58:14.217Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-readme-index-missing-adr-0020
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr-readme-index-missing-adr-0020.md
  Leaves live only under a story. id is the filename stem: task-adr-readme-index-missing-adr-0020.
  CLI `arggon create task adr-readme-index-missing-adr-0020` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/adr/README.md` has no row for ADR 0020 (methodology-first productization), which is Accepted on main

## Context

Found while reviewing PR #598: `ArggonManager/docs/adr/README.md` has no row for ADR 0020 (Methodology-first productization with per-agent native adapters), which is Accepted on main. The index therefore disagrees with the ADR directory.

## Acceptance

- [x] README.md lists ADR 0020 with its title and status
- [x] Every ADR file in the directory has an index row (sweep the whole dir, not just 0020)
- [x] A test asserts index/directory parity so a new ADR cannot ship unindexed

## Notes

### 2026-10-02 @ses_f02ab5836ffeOAxmisboIwWE4x

Scope corrected by the reviewer of PR #598 (2026-10-02): the index is not missing only ADR 0020. Verified against the directory — `ArggonManager/docs/adr/` holds 0001–0020 plus README.md, and README.md indexes 0001–0004 and 0010–0019 only.

Missing rows: **0005, 0006, 0007, 0008, 0009, 0020** (six). The acceptance already says "sweep the whole dir, not just 0020" and requires an index/directory parity test, so this is a widening of scope, not a new problem — filing it as ADR-0020-only would have left five ADRs unindexed and the parity test would have failed anyway.

### 2026-10-02 @ses_f00f1670fffeKhTBf15mLOa4ks

Worker implementation notes.

**Statuses read from the files, not assumed.** The dispatch brief predicted
"several are `Proposed` rather than `Accepted`". Verified against every
`Status:` line: all six are `Accepted` (0008 and 0009 carry
`Accepted (2026-09-16 — adopted explicitly by product decision; …)` /
`(2026-09-17 — …)`; the index records the trimmed house form
`Accepted (adopted by product decision)`). The only `Proposed` ADR in the
directory is 0019, which was already indexed correctly. No row was written from
the brief's guess.

**Pre-existing index drift fixed in passing (3 rows).** `c0cdd60b` ("accept
ADRs 0002/0003/0004 retroactively", task-adr-status-housekeeping) edited the
three ADR files to `Accepted` and left the index claiming `Proposed`. The
files are authoritative, so the index was corrected: 0002 →
`Accepted (shipped as prototype)`, 0003 → `Accepted`, 0004 → `Accepted`. This
was required for the parity test's status rule to go green and is the same
file the item already owns.

**Drift found but NOT fixed (out of this item's scope — reported instead).**

- `ArggonManager/docs/engineering.md:230` still advertises ADR 0003 as
  "milestone field (Proposed)", stale since `c0cdd60b`.
- `ArggonManager/docs/specs/spec-opencode2-009.md:87` ("ADR 0010 Proposed")
  and `ArggonManager/docs/plans/plan-opencode2-009.md:24` ("ADR 0010
  (Proposed)") describe a historical merge gate, but ADR 0010 is now
  `Partially superseded by 0011`. Likely correct as history — a reviewer should
  confirm before touching.

**Deliberate non-assertion.** The parity test asserts membership, numbering,
row order and status _class_, but not the title cell: index titles are
editorial summaries, not copies of the headings (0018 adds
"(release pipeline, update channel, skew, tarballs)" to a bare H1; 0002/0003
are abbreviated). Asserting them would pin a convention the corpus does not
follow.

### 2026-10-03 @ses_f00f1670fffeKhTBf15mLOa4ks
PR #602 — https://github.com/Arggon/ArggonManager/pull/602

**Parity test: before/after.** `cli/src/adr-index-parity.test.ts` (new, 7 cases). The README was mutated three ways against the real corpus and restored after each; every mutation is caught:

```
BEFORE (drop the 0020 row — the reported bug)
  x indexes every ADR file exactly once (no ADR ships unindexed)
  + "0020-methodology-first-productization.md: 0 index row(s), expected exactly 1"

BEFORE (restore 0002 to the pre-c0cdd60b status)
  x mirrors each ADR's own status, qualifiers aside
  + "0002-board-viewer-v0.md: index says \"Proposed (shipped as prototype)\" (Proposed), file says \"Accepted\" (Accepted)"

BEFORE (row for an ADR that does not exist)
  x has no row pointing at a file the directory does not contain
  + "0021 -> ./0021-does-not-exist.md: no such file in docs/adr/"

AFTER
  Test Files  1 passed (1)
  Tests       7 passed (7)
```

The third mutation found a defect in my own first draft: a dangling row made two extra tests throw a raw ENOENT instead of failing cleanly. Fixed by filtering unresolvable rows out of the per-row checks (the dangling-row case is already diagnosed by its own test) and re-verified above.

**Statuses read from the files, not assumed.** The brief predicted "several are Proposed rather than Accepted"; verified against every `Status:` line, all six missing ADRs are `Accepted` (0008/0009 are `Accepted (2026-09-1x — adopted explicitly by product decision; …)`, indexed in the house's trimmed form `Accepted (adopted by product decision)`). 0019 is the only Proposed ADR and was already indexed correctly.

**Pre-existing drift corrected (3 rows, same file).** `c0cdd60b` accepted ADRs 0002/0003/0004 in the files but left the index claiming `Proposed`; the files are authoritative, so the index was corrected. Required for the status rule to pass.

**Gates.** `npm test` → 119 files / 2195 tests passed. `npm run build` ok with a byte-identical regenerated `opencode/plugins/arggon/index.bundle.ts`. `npm run lint` ok, `tsc -p tsconfig.json --noEmit` ok, `arggon validate` ok (0 warnings), `arggon spec validate` ok (32 docs), prettier clean on both files. Smoke exempt (docs + one test).

One environment gotcha worth knowing: a fresh worktree fails `headless-ci.test.ts` with "run `npm run build` first" until build artifacts exist — unrelated to this change, but it will fail the next agent who runs `npm test` before `npm run build`.

**Drift reported, not fixed (out of scope).** `docs/engineering.md:230` still calls ADR 0003 "Proposed" (stale since `c0cdd60b`); `specs/spec-opencode2-009.md:87` and `plans/plan-opencode2-009.md:24` call ADR 0010 Proposed, which is now Partially superseded by 0011 (probably correct as history — needs a reviewer's call).

Not flipping to done; leaving that to the coordinator.
