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
