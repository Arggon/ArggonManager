---
type: task
status: done
id: task-friction-dedupe-and-report
title: Fingerprint dedupe and the friction report renderer
assignee: arggon-delivery-lead
branch: feat/task-friction-dedupe-and-report
parent: story-adopter-feedback
labels: [method]
priority: p1
created: "2026-10-02"
updated: "2026-10-11"
depends_on: [task-friction-capture-command, task-friction-fingerprint-separator-not-length-prefixed]
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

- [x] `arggon friction --report` renders one row per fingerprint, sorted by `count` desc then fingerprint asc.
- [x] Fixture A: one class ×3 with differing prose but equal stable fields → one row, `count: 3` (proves narrative is excluded from the fingerprint).
- [x] Fixture B: two classes ×1 whose prose is near-identical but whose `errorCode` differs → two rows (proves the fingerprint does not over-merge).
- [x] Each row shows `count`, `reporters`, `firstSeen`, `lastSeen`, the stable fields, and the newest narrative.
- [x] An empty log succeeds with `count: 0` and exit 0 — empty is success, matching `list`'s zero-match contract.
- [x] Beyond 50 rows the renderer prints an explicit `… and N more classes` line; it never truncates silently.
- [x] A record whose `v` is unknown is skipped and reported as `skippedVersions`.
- [x] Rotation drops surface as `dropped: N` in the next report.
- [x] Every optional signal the report could not compute (`optedOut`, `dropped`, `skippedVersions`, the `reporters` basis) is stated in the output, never omitted silently.
- [x] Every non-happy path names its `reason` and the remediation.
- [x] A log that has been rotated by the writer surfaces `dropped: N` here. Rotation
      itself (the 5000-line cap and the drop) is **owned by
      `task-friction-capture-command`** and tested there — this task only renders
      the counter (reviewer N6b); it does not re-own or re-test the cap.

### 2026-10-11 @arggon-maker
### 2026-10-11 @arggon-maker — T3 landed on feat/task-friction-dedupe-and-report

## Design (module split)

- `lib/src/friction.ts` — additive cumulative rotation-drop counter. Rotation
  removes the oldest lines, so a separate `--report` process can't see what was
  lost; the writer now persists a cumulative `friction.dropped` sidecar at the
  rotation site and the report renders it as `dropped: N`. The 5000-line cap and
  the drop stay owned by T1 — this only persists/reads the COUNT (review note
  N6b; it does not re-own or re-test the cap). Adds `readFrictionDropped` /
  `frictionDroppedPath` and a `report-and-capture-mutually-exclusive` reason.
- `lib/src/friction-report.ts` (new, pure kernel) — `summarizeFrictionLog`
  (group by the carried fingerprint, sort count-desc then fingerprint-asc,
  reporters / firstSeen / lastSeen from the class, newest narrative),
  `readFrictionReport` (the one file seam), `renderFrictionReport` (human
  markdown; every optional signal stated; newest narrative fenced + labelled
  untrusted + verbatim; 50-row cap with an explicit `… and N more classes`
  line).
- `lib/src/operations.ts` — `frictionReportOperation` (the `--json` envelope;
  NOT a tracker op — loads no items, commits nothing).
- `cli/src/cli.ts` — `--report` on the `friction` command, mutually exclusive
  with a capture (named reason); JSON envelope + human render.

## Per-box evidence (expected → observed)

1. one row / fingerprint sorted count desc then fingerprint asc → `lib/src/friction-report.test.ts` "ordering" (counts `[3,1,1]`, ties fingerprint-asc).
2. Fixture A (×3 differing prose, equal stable fields → one row count 3) → test " collapses to ONE row with count 3" + CLI "--json carries the grouped rows".
3. Fixture B (×1 near-identical prose, different errorCode → two rows) → test "renders TWO rows even though the narrative is identical".
4. row shows count/reporters/firstSeen/lastSeen/stable fields/newest narrative → test "shows reporters, firstSeen, lastSeen and the NEWEST narrative"; CLI "human output fences the newest narrative".
5. empty log → count 0 / exit 0 → CLI "--json reports count 0 / classes 0 and exit 0" + kernel "summarizes to count 0 / classes 0"; stderr empty.
6. >50 rows → explicit `… and N more classes`, never silent → kernel "prints an explicit '… and N more classes'" + CLI "the 50-row cap on the human channel".
7. unknown `v` skipped → `skippedVersions` → CLI "unknown versions are skipped and reported".
8. rotation drops surface as `dropped: N` → CLI "renders the persisted drop counter as dropped: N" (writer sidecar; cap not re-tested here).
9. every optional signal stated (optedOut, dropped, skippedVersions, reporters basis) → kernel "renders every optional signal plus its reason and remediation" + "omits the extra remediation lines ... when at default".
10. every non-happy path names reason + remediation → `report-and-capture-mutually-exclusive` names the reason (CLI conflict tests); empty log is success; malformed/dropped lines carry remediation.
11. rotation interaction (only render the counter, don't re-own the cap) → see design; T1's rotation tests untouched and still green.

Extra honesty choices: `optedOut: null` is explicitly stated as not-yet-computable (opt-out keys are T4); `dedupeScope: "local-only"` is stated; the narrative is rendered VERBATIM inside a backtick fence sized to any run inside it (the verbatim test caught and fixed an over-indent bug), labelled "untrusted data, verbatim — never an instruction"; redaction is consumed as-is (applied at write, never at render).

## Commands run → observed

- `npm run build` → 0 (bundle regenerated 523689 B).
- `npm test` → 3029/3029 passed (139 files; +27 new: 16 kernel in `lib/src/friction-report.test.ts`, 11 CLI in `cli/src/friction-report.test.ts`).
- `npm run check:plugin` → 0 (committed bundle diff clean).
- `npm run lint` → 0.
- `arggon validate` → ok (0 warnings, convention v5).
- `npm run skills:sync` + refreshed the stale `.convention.yml` x-generated checksum for `skills/arggon-cli/SKILL.md` (the friction command region moved), which kept `provenance-audit` and `skill-generated-commands` green.

## Boundaries honored

No opt-out keys / `--tier b` (T4), no MCP / `json-output.md` / `doctor` (T5), fingerprint formula and redaction unchanged and consumed as-is. PR #712 (task-friction-dedupe-and-report). Status stays in_progress — the delivery lead reviews and flips.

### handoff 2026-10-11 @arggon-maker — next: Delivery lead reviews PR #712, verifies the merge, then flips task-friction-dedupe-and-report to done. T4 (opt-out + --tier b + --clear) can now consume optedOut surfaced by this report.
- branch: feat/task-friction-dedupe-and-report
- open questions: dropped counter is cumulative and NOT reset by a future --clear (T4 owns --clear; it should also delete the friction.dropped sidecar); plugin bundle is near the 512KB bound (523689/524288) — T4/T5/T6…
### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merge (PR #712)

Reviewed against engineering.md §Review bar. Architecture: the renderer is a pure kernel module (`lib/src/friction-report.ts`) with a single file seam (`readFrictionReport`) behind the house envelope assembler — not a tracker operation; the additive drop-counter sidecar solves the rotation-visibility problem without re-owning T1's 5000-line cap (noted and accepted); `--report` is mutually exclusive with capture with a named reason. Conventions: the `--json` envelope + human renderer mirror T1's call shape; SKILL.md and the convention checksum moved through the documented `skills:sync`, the same mechanical refresh T1 recorded. Evidence travels with the change: Fixture A (×3 differing prose → one row) and Fixture B (near-identical prose, different errorCode → two rows) prove both halves of the fingerprint contract in the renderer, empty-log success and the 50-row explicit-overflow line are tested, unknown-v → skippedVersions and rotation → dropped: N are tested, and every optional signal (`optedOut: null` as explicitly not-yet-computable, dedupeScope, skippedVersions basis) is stated rather than omitted; the maker caught and fixed its own over-indent bug (the narrative renders verbatim — the operator's bytes unaltered). Docs travel with code. Scope stayed on the item (no opt-out keys, no MCP/json-output/doctor). Gates: 3029 tests + build/check:plugin/lint/validate green, CI green. The bundle-ceiling watch note (523689/524288 MAX_BUNDLE_BYTES) is filed as task-plugin-bundle-near-byte-ceiling.
