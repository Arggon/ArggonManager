---
type: task
status: in_progress
id: task-spike-friction-volume-threshold
title: "Spike: what friction volume would justify stage-3 automation?"
assignee: arggon-delivery-lead
branch: feat/task-spike-friction-volume-threshold
parent: story-adopter-feedback
labels: [research]
priority: p3
created: "2026-10-02"
updated: "2026-10-16"
claimed_at: "2026-10-16T03:19:57.928Z"
depends_on: [task-spike-friction-trigger-compliance]
worktree_path: /home/arggon/Projects/ArggonManager-task-spike-friction-volume-threshold
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-spike-friction-volume-threshold.md
  Leaves live only under a story. id is the filename stem: task-spike-friction-volume-threshold.
  CLI `arggon create task spike-friction-volume-threshold` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: what friction volume would justify stage-3 automation?

## Context

A **spike, not a task**, and deliberately filed _before_ the evidence exists.
[exploration-adopter-feedback-channel-024](../../../docs/explorations/exploration-adopter-feedback-channel-024.md)
routes it here rather than guessing a number.

The question it exists to prevent: ADR 0024 leaves **stage 3 — anything
automatic — not decided and not scheduled**, precisely because a solo maintainer
with no volume data should not pick a threshold that triggers unattended
automation. `jedbjorn/subfloor#543` declined the automation outright and stated
why ("do not make automatic capture publish externally"), and
`ripple/xrpl-wasm-stdlib#311` runs an unattended rolling issue per fingerprint
weekly — the shape stage 3 would take if the threshold is ever crossed.

Until real volume exists, the correct state is "no automation", and this spike
records why so that a future agent reading ADR 0024 §Stage 3 does not invent a
number.

## Acceptance

- [ ] Depends on `task-spike-friction-trigger-compliance` completing; **not answerable before it.**
- [ ] The answer names a concrete volume measure (distinct reporters per fingerprint over what window) and what automation, if any, that volume would justify.
- [ ] If volume remains unmeasured, the recorded conclusion is explicitly "no automation; revisit only with data" — a null result is a valid and expected outcome.
- [ ] The conclusion is filed as a comment here and cross-referenced from ADR 0024's stage-3 bullet.
- [ ] Any automation it eventually proposes still respects ADR 0024 §4: no unattended submission, human action required.

## Criterion (starting premise — not re-litigated)

This spike takes the compliance finding as its input, verbatim:
`task-spike-friction-trigger-compliance` §§1–9 (2026-10-15) answered **NULL /
NOT-YET-MEASURABLE** — 0 attributable adopter records across 15 adopter repos /
19 adopter checkouts, `triggerPresent` false at all 19 (trigger 32 minutes old on
`main` at sweep time). The only negative signal concerns the already-condemned
skill-reference route (command in the ArggonStores skill inventory ~39h, zero
records), not the embedded trigger. This spike does not re-observe adopters.

## Analysis (grounded in the log schema)

**What the log can actually produce** (`lib/src/friction.ts`,
`lib/src/friction-report.ts`, verified against live `friction --report --json`
on 2026-10-16): a record carries `v`, `ts` (ISO-8601 UTC), `fingerprint`
(`sha256` over length-prefixed `commandShape` + `errorCode` + `harness` +
major `arggonVersion`, 16 hex — never the narrative), `reporterId`
(`sha256(machineSalt ‖ repoAbsPath)`, 12 hex — "same machine, same repo", never
which repo), `commandShape` (normalized, values → `<arg>`), `errorCode`,
`harness`, `arggonVersion`/`majorVersion`/`os`/`arch`/`node`, `narrative`
(verbatim data, never hashed), `evidence`. `--report --json` collapses records
by carried fingerprint into rows sorted `count` desc then fingerprint asc; each
row carries `fingerprint`, `count`, `reporters` (distinct `reporterId`s **in
THIS log only**), `reporterIds[]` (sorted), `firstSeen`/`lastSeen` (`ts`
range), newest `narrative`, and the stable fields; the envelope carries `count`,
`classes`, `dropped` (rotation past 5000 lines), `skippedVersions`,
`malformed`, `optedOut`, `truncated` (50-row human cap; `--json` uncapped) and
`dedupeScope: "local-only"` — always. The human render states the basis
explicitly: "distinct reporterIds present in THIS log only (stage 1 is one
machine, so normally 1; not other machines, not upstream)".

**Why raw `reporters` alone would already false-fire.** The machine log on
2026-10-16 holds 202 records in 4 classes: 164 + 36 on fingerprint rows
`commandShape: validate / harness: unknown` (the pre/post length-prefix split —
the known `TEST_NOT_HERMETIC` non-hermetic test line, one ephemeral temp dir
per run, hence 164 distinct `reporterId`s for zero adopters) plus the
compliance maker's own 2 defect records. Raw `reporters(F) ≥ 3` is therefore
already "met" by noise. A volume measure that counts the `reporters` field
without attribution would automate on test output. The threshold must count
**attributable** distinct reporters: `reporterId`s matching an observed adopter
repo path via the compliance attribution sweep, ephemeral/test dirs excluded.

**The measure.** For fingerprint F and rolling window W (30 days, bounded by
record `ts` / row `firstSeen`→`lastSeen`): `reporters(F, W)` = distinct
attributable `reporterId`s for F with `ts` in W, merged across
human-supplied `friction --report --json` outputs (stage 1 is per-machine, so
cross-adopter counting is a human merge of `reporterIds[]` arrays — the log
schema supports it, a single report by construction does not). **Threshold:
`reporters(F, 30d) ≥ 3`, spanning ≥ 2 calendar weeks, on a fingerprint that is
not a known test-noise shape.** Rationale: ADR 0024 Consequences already ranks
"a class seen in three repos" above one-offs — 3 is the smallest cross-adopter
signal, not an invented number; 30 days fits the 5000-line rotation bound and
the `ripple/xrpl-wasm-stdlib#311` weekly-rolling precedent without overfitting;
the 2-week span excludes single-incident bursts.

**What that volume would justify — and what it would not.** At threshold, the
only justifiable automation is **maintainer-side draft preparation**: a local
script over human-merged reports that renders one candidate rolling-issue draft
per qualifying fingerprint plus its tier-B prefilled URL. Publication stays
human in every case: a human clicks to open/update, a human runs
`arggon create`, `gh` only with live auth, never in CI, never unattended. Below
threshold — including now — **not even the aggregator**: no automation at all.
This respects ADR 0024 §4 in full (no automatic publication ever by the agent;
tool never reads inbound issue bodies; no phone-home; friction never enters the
tracker except by human action; narrative stays data).

**Current volume.** Unmeasured / zero: 0 attributable adopter records (compliance
NULL), and a single stage-1 report cannot measure cross-adopter volume by
construction (`dedupeScope: local-only`). There is nothing to threshold against.

## Conclusion

**No automation; revisit only with data.** Stage 3 stays not decided and not
scheduled. Re-measurement trigger (both required, in order): (1) the compliance
re-sweep PASSES after `../ArggonStores` runs `arggon init` and the trigger has
been present there ≥ 14 days (the window the compliance finding proposes),
showing ≥ 1 attributable adopter record — i.e. the stage-2 DEFER resolves
first, stage 3 never leapfrogs it; (2) a human-merged multi-report volume shows
a fingerprint meeting `reporters(F, 30d) ≥ 3` attributable across ≥ 2 weeks.
Until both hold, a future agent reading ADR 0024 §Stage 3 must not invent a
number — this spike is that number's placeholder, and its value is null.
