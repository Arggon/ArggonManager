---
type: task
status: in_progress
id: task-doctor-outdated-bucket
title: "doctor: outdated bucket — managed docs whose template render moved upstream"
assignee: Arggon
branch: feat/task-doctor-outdated-bucket
parent: story-adoption-state
labels: [p2]
created: "2026-09-16"
updated: "2026-09-17"
claimed_at: "2026-09-17T00:06:19.494Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-doctor-outdated-bucket.md
  Leaves live only under a story. id is the filename stem: task-doctor-outdated-bucket.
  CLI `arggon create task doctor-outdated-bucket` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# doctor: outdated bucket — managed docs whose template render moved upstream

## Context

Exploration adopter-upgrade-experience-007 (option B, approved 2026-09-16): doctor reports provenance vs the RECORDED state (untouched/modified/acked/acknowledgedDrifted/stale/missing) but nothing says "the upstream template changed since this doc was generated/acked" — staleness is invisible until someone re-runs init. Evidence: all 14 managed docs of ArggonStores-am are acked, so updates silently stop reaching it. This makes staleness continuously visible, pure read.

## Acceptance

- [ ] For each managed destination, doctor re-renders the CURRENT template (same placeholders: {{PROJECT_NAME}}, {{YEAR}}, target-dir-derived values; rendering must be pure and side-effect-free) and compares with the on-disk file; render differs -> counted as `outdated` (new bucket) in docs counts + `--json` payload additive (per-doc `outdated: true` + reason)
- [ ] Bucket semantics: applies to untouched AND acknowledged AND modified docs (upstream moved regardless of local state); `stale` (template no longer generated) keeps its current meaning; missing template file on disk -> graceful (counted unknown-outdated, never throws)
- [ ] Human output: "N doc(s) have newer templates — run `arggon init --dry-run` for the plan" hint line; doctor stays exit 0 (report-only)
- [ ] Tests: template changed -> outdated detected; template unchanged -> not outdated; acked+changed -> outdated; template file absent -> no crash; full doctor suite green
- [ ] Docs: README doctor section + docs/json-output.md (additive)

### 2026-09-17 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #301 (reviewed after rebase on post-#302 main: docs.ts combination clean, 1012/1012 green).

Verified: full diff read (renderGeneratedDoc pure + identical to init's resolution/markers incl. the docs-dir-relative marker-name convention and JSON-dest exception; outdated orthogonal to untouched/modified/acked partitions; missing template -> stale-not-outdated; unreadable -> undecidable, never throws; injectable templatesRoot documented for tests). Gates mine: suite 1012/1012, lint/build clean, validate ok, self-doctor 0 modified / 0 drifted with outdated: 10 — the exact motivating signal from exploration 007 on our own acked docs. Live probe on a fixture: fresh init -> 0 outdated (11 untouched); AGENTS.md template mutated -> outdated:1 [AGENTS.md] + hint line 'run arggon init --dry-run for the plan'; restored -> 0. Exit 0 report-only throughout, zero writes.
