---
type: task
status: in_progress
id: task-review-freshness
title: Bind review verdicts to the reviewed revision and flag stale approvals
assignee: arggon-superagent
branch: agent/revision-bound-approvals-bfb49eb17950
parent: methodology-improvements
labels: [cli, agents]
created: "2026-11-04"
updated: "2026-11-04"
claimed_at: "2026-11-04T20:51:26.201Z"
issue: 872
worktree_path: /home/arggon/.dsh/state/superagent/work/revision-bound-approvals-bfb49eb17950
---
# Bind review verdicts to the reviewed revision and flag stale approvals

## Context

Part 3 of the 2026-11-03 methodology review ([issue #872](https://github.com/Arggon/ArggonManager/issues/872)). The review-verdict classifier reads comment chronology only: `classifyVerdicts` picks the latest verdict by comment date, then body position (`lib/src/verdict.ts`), and a verdict comment carries only a date, author, value and free-text scope — no revision. `arggon sync` classifies every item it reconciles with an open PR from that alone, so an approval survives any later code change: reviewer approves `abc1234`, the author pushes `def4567`, and `sync --json` still says `approved`.

This task binds the verdict to the revision it reviewed and reports that binding separately from the chronological verdict map, so a stale approval reads as reassessment-required instead of current. Report-only, matching the classifier's existing posture: no merge gate until the report proves low-noise.

## Acceptance

- [x] `verdict: approve` can carry a reviewed revision, and the parser round-trips it; verdicts without one remain readable as `unbound`.
- [x] `sync --json` fetches the PR head and reports the reviewed revision, the head revision, and a freshness state.
- [x] An approval followed by a code commit reports `stale` / reassessment-required.
- [x] An approval followed only by its own tracker commit remains `fresh`.
- [x] A new approval at the new head returns to `fresh`.
- [x] `ArggonManager/docs/engineering.md` §Review verdicts and the JSON output docs describe the new fields and the staleness rule.
- [x] Tests cover approve → code change → stale, approve → tracker-only commit → fresh, and legacy unbound verdicts.

## Notes

- The convention stays backward compatible: `verdicts` is unchanged, the new fields are additive within `schemaVersion: 1`, and a missing revision is `unbound` — never silently fresh.
- Freshness compares the code diff between the reviewed revision and the PR head with the tracker path excluded, so the verdict's own tracker commit does not invalidate it.
- The comparison uses GitHub's compare endpoint, so it does not depend on the PR head being fetched locally; an unavailable comparison is `unbound`, never fresh.
