---
type: task
status: todo
id: task-friction-dedupe-and-report
title: Fingerprint dedupe and the friction report renderer
parent: story-adopter-feedback
labels: [method]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-friction-capture-command]
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-dedupe-and-report.md
  Leaves live only under a story. id is the filename stem: task-friction-dedupe-and-report.
  CLI `arggon create task friction-dedupe-and-report` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Fingerprint dedupe and the friction report renderer

## Context

Plan task T3 for [spec-friction-capture-020](../../../docs/specs/spec-friction-capture-020.md).

This is the piece the maintainer actually reads, so it is optimized for
**signal per unit of attention**, not volume: one row per fingerprint, sorted
count-descending then fingerprint-ascending, so a class seen three times
outranks three one-offs and one-off noise is visible as such.

The duplicate debt it attacks is measured, not speculative: 10 items in this
tracker are repeat reports of the same class
(`bug-torture-contention-flake3` — "for the THIRD time",
`bug-start-install-ordering` — "five incidents across five sessions").

`reporters` (distinct `reporterId`s) is honest about stage 1 being one machine,
so it normally reads `1`. It exists so stage-2 aggregation needs no schema
change and so a human merging two reports can count distinct reporters without
either side learning a repo name.

## Acceptance

- [ ] `arggon friction --report` renders one row per fingerprint, sorted by `count` desc then fingerprint asc.
- [ ] Fixture A: one class ×3 with differing prose but equal stable fields → one row, `count: 3` (proves narrative is excluded from the fingerprint).
- [ ] Fixture B: two classes ×1 whose prose is near-identical but whose `errorCode` differs → two rows (proves the fingerprint does not over-merge).
- [ ] Each row shows `count`, `reporters`, `firstSeen`, `lastSeen`, the stable fields, and the newest narrative.
- [ ] An empty log succeeds with `count: 0` and exit 0 — empty is success, matching `list`'s zero-match contract.
- [ ] Beyond 50 rows the renderer prints an explicit `… and N more classes` line; it never truncates silently.
- [ ] A record whose `v` is unknown is skipped and reported as `skippedVersions`.
- [ ] Rotation drops surface as `dropped: N` in the next report.
- [ ] Every optional signal the report could not compute (`optedOut`, `dropped`, `skippedVersions`, the `reporters` basis) is stated in the output, never omitted silently.
- [ ] Every non-happy path names its `reason` and the remediation.
- [ ] A log that has been rotated by the writer surfaces `dropped: N` here. Rotation
      itself (the 5000-line cap and the drop) is **owned by
      `task-friction-capture-command`** and tested there — this task only renders
      the counter (reviewer N6b); it does not re-own or re-test the cap.
