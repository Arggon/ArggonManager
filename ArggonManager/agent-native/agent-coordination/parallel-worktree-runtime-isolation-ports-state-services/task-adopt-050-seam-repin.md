---
type: task
status: done
id: task-adopt-050-seam-repin
title: "Adopt 0.5.0 on this machine: re-pin the seam checks and regenerate the vendored seam with the released version"
assignee: Arggon
branch: feat/task-adopt-050-seam-repin
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [release, seam]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-adopt-050-seam-repin.md
  Leaves live only under a story. id is the filename stem: task-adopt-050-seam-repin.
  CLI `arggon create task adopt-050-seam-repin` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopt 0.5.0 on this machine: re-pin the seam checks and regenerate the vendored seam with the released version

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
release.md §"The re-pin (guard-enforced)": after a release, regenerate the seam with the released version (`arggon init`) and move the literal `ARGGON_VERSION` pin in BOTH `templates/docs/github/workflows/arggon.yml` (what adopters vendor) and `.github/workflows/arggon.yml` (this repo's CI) in the SAME PR. `cli/src/ci-seam-pin.test.ts` enforces the non-divergence: a stale pin is a red test, not a silent outage (the #527 class). The published `arggon-manager@0.5.0` is already installed globally on this machine (`arggon --version` → `0.5.0 (13d72f5f)`), so `init` runs from the released bits, not from source.

## Acceptance
- [x] `ARGGON_VERSION` is `0.5.0` in both the template and this repo's workflow; `cli/src/ci-seam-pin.test.ts` green. Evidence: both files carry `ARGGON_VERSION: "0.5.0"` (the TEMPLATE had also lagged at 0.4.0 from the 0.4.1 cycle — caught here, moved too); `cli/src/ci-seam-pin.test.ts` 6/6 green.
- [x] `arggon init` re-run with the released binary: the generated files' `arggonVersion` stamps move to 0.5.0 and the diff is only the expected regeneration. Evidence: `arggon init` run from the globally installed `arggon-manager@0.5.0` (`arggon --version` → `0.5.0 (13d72f5f)`) committed `18278b91` = `ArggonManager/.convention.yml` only (88/88 lines = per-file `checksum` / `arggonVersion` / `generatedAt` for ~29 generated files, every stamp now 0.5.0). The other 42 generated paths were rewritten with byte-identical content (checksums unchanged) or are gitignored (`.agents/skills/**`, `.opencode/plugins/**`), so there is no churn to review. The adopter-modified files were skipped by design (`.github/workflows/arggon.yml`, `.gitignore`, `AGENTS.md`, `CONTRIBUTING.md`, `opencode.jsonc`, `ArggonManager/docs/tracking.md`).
- [x] `npm run arggon -- validate` ok, prettier clean on the regenerated docs, CI green on the branch. Evidence: validate `ok (0 warnings, convention v5)`; the only touched file is a YAML pin (no prose), prettier n/a; CI green on the PR head.

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
verdict: approve — 0.5.0 is live and adopted. Published: tag `v0.5.0` -> `13d72f5f`, GitHub Release with the hand-curated house-style notes (release-please's 410-entry draft reduced to 20 bullets across Added/Changed/Fixed with 0.4.1-era items dropped and an adopter-migration note preserved), both tarballs attached, `@arggondev/lib@0.5.0` then `arggon-manager@0.5.0` on the registry after `inspect-tarballs.mjs` passed, and the machine now runs the released bits (`arggon --version` -> `0.5.0 (13d72f5f)`).

The re-pin half: both literal `ARGGON_VERSION` pins moved to 0.5.0 — including the ADOPTER TEMPLATE, which had silently lagged at 0.4.0 since the 0.4.1 cycle — and the seam was regenerated from the released binary, so every `arggonVersion` stamp is 0.5.0 with no content churn elsewhere (44 files touched, only the stamps + checksums changed). `cli/src/ci-seam-pin.test.ts` is the enforcement, so this class cannot rot silently again. Merged: PR #581 squash. Item done.

Release context: 0.5.0 completed through the operator exception path because release.yml's CHANGELOG-notes extraction cannot match release-please's linked `## [V](url) (date)` header and failed after tagging (bug-release-notes-extraction-breaks-on-linked-header, p1 — the automation fix is queued; the manual completion commands are recorded there).
