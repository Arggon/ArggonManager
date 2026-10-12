---
type: task
status: todo
id: task-spec-plan-pairing-vs-shared-number-sequence
title: "spec-NNN ↔ plan-NNN pairing broken by the renumber wave: plans took per-directory max+1 while cli/src/spec.ts nextDocNumber() numbers specs+plans from ONE shared sequence"
parent: story-spec-pipeline
labels: [spec-pipeline, docs, renumber-fallout]
created: "2026-10-12"
updated: "2026-10-12"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-plan-pairing-vs-shared-number-sequence.md
  Leaves live only under a story. id is the filename stem: task-spec-plan-pairing-vs-shared-number-sequence.
  CLI `arggon create task spec-plan-pairing-vs-shared-number-sequence` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec-NNN ↔ plan-NNN pairing broken by the renumber wave: plans took per-directory max+1 while cli/src/spec.ts nextDocNumber() numbers specs+plans from ONE shared sequence

## Context

Found 2026-10-12 in delivery-lead review of the renumber wave (PR #680,
`task-renumber-colliding-doc-numbers`, now done). The wave renumbered two plan
documents with a **different numbering rule than the one the CLI implements**:

- `cli/src/spec.ts` `nextDocNumber()` numbers a new doc as **max across BOTH
  `docs/specs/` and `docs/plans/`, plus one** — one shared sequence, which is
  what the corpus's spec-NNN ↔ plan-NNN pairing idiom assumes (`spec-deps-022.md`
  is meant to pair with `plan-deps-022.md`).
- PR #680 numbered the moved plans **per-directory** (each directory's own
  max+1): `plan-deps-001` → `plan-deps-019` while its spec moved to
  `spec-deps-022`, and `plan-update-channel-015` → `plan-update-channel-020`
  while its spec moved to `spec-update-channel-023`.

Result: the pairing the renumber was meant to preserve is broken for both `-001`
pairs. The only pre-existing unmatched pair was
`spec-friction-capture-020` ↔ `plan-friction-capture-018`; this wave doubled the
anomaly. Cross-file links were updated by filename (covered by
`task-stale-citations-to-renumbered-doc-stems`, done) — the defect is the
numbering convention, not dangling citations.

Coverage note: the wave's other follow-ups (`task-spec-deps-022-no-error-path`,
`task-stale-citations-to-renumbered-doc-stems`) are done and do not cover this.

## Acceptance

- [ ] Decide and record the rule — one shared sequence across `docs/specs/` +
      `docs/plans/` (what `nextDocNumber()` implements, and what the pairing
      idiom implies) vs per-directory numbering — with the reasoning, as a dated
      comment on this item (delivery lead's call; reversible by a PR)
- [ ] If shared: renumber `plan-deps-019` → the number pairing with
      `spec-deps-022` and `plan-update-channel-020` → the number pairing with
      `spec-update-channel-023` (whichever numbers resolve the pairing given the
      corpus state at the time), updating every citation and both specs'
      `plan:` frontmatter
- [ ] If per-directory: record the divergence where the numbering rule is
      written down (the `spec new` help / docs) so the next author does not
      "fix" one side against the other
- [ ] Verification: for every spec carrying a `plan:` frontmatter link, the
      pair's numbers agree (or a named exception list records the mismatches);
      `arggon spec validate` and `spec analyze` clean; renumber notes per the
      ADR 0016/0019 idiom in every document moved by this item

## Notes
