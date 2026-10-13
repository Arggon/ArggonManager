---
type: task
status: done
id: task-wave1b-agent-native-bodies
title: "Wave-1b bodies: 12 agent-native placeholder bugs (worktree, MI, spec-pipeline)"
assignee: arggon-delivery-lead
branch: feat/task-wave1b-agent-native-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-wave1b-agent-native-bodies.md
  Leaves live only under a story. id is the filename stem: task-wave1b-agent-native-bodies.
  CLI `arggon create task wave1b-agent-native-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Wave-1b bodies: 12 agent-native placeholder bugs (worktree, MI, spec-pipeline)

## Context

Wave-1b of `decided: A`: the blocking guard (`task-validate-refuses-placeholder-bodies`, built, staged, uncommittable) refuses its own commit while these placeholders remain — their merge gates the guard's commit. Scope is ONLY files under `ArggonManager/agent-native/`: parallel-worktree-runtime-isolation-ports-state-services: bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use, bug-fresh-worktree-refusal-prose-drops-prep-step-truncation, bug-gatebin-budget-reserved-block-can-exceed-clip, bug-mcp-server-binds-session-cwd-tracker-root, bug-prover-agent-has-no-x-generated-entry, bug-self-decided-false-positive-owner-assigned, bug-task-permissions-enforcement-not-observed; methodology-improvements: bug-context-report-baseline-date-mismatch, bug-mcp-budget-contradicted-across-docs, bug-wave-probe-file-check-model-dependent; story-spec-pipeline: bug-parity-suite-cannot-catch-wrong-input-at-call-sites, bug-zero-byte-item-files-committed-by-comment-autocommit. Three of these have ZERO dated Notes and need domain judgment grounded in named authorities, not invention: bug-context-report-baseline-date-mismatch, bug-mcp-budget-contradicted-across-docs, bug-release-needs-auth-self-describing. All others: transcribe Notes/comments. Bugs get Context + checkable boxes; the two tasks likewise.

## Acceptance

- [x] Every listed file carries a real `## Context` (no scaffold marker)
- [x] Every listed file carries checkable `## Acceptance` boxes
- [x] No file outside the listed set touched; frontmatter untouched
- [x] Prettier clean (modulo a disclosed single-line depends_on exception); `arggon validate` green; PR opened

## Notes

### handoff 2026-10-12 @Arggon — next: Lead reviews the 12 bodies, opens the PR and merges to unblock the guard commit

- branch: feat/task-wave1b-agent-native-bodies
- open questions: whether the 2 formatter-made title requotes count as frontmatter touch for the guard; self-decided-файл had zero Notes too (3rd zero-Notes file, not 2)

### 2026-10-12 @Arggon

Evidence for the standards reviewer (maker: arggon-maker, branch feat/task-wave1b-agent-native-bodies).

Commands run (all in the worktree /home/arggon/Projects/ArggonManager-task-wave1b-agent-native-bodies):

- `./node_modules/.bin/prettier --check` on the 12 touched files — expected clean after bodies written; observed clean ("All matched files use Prettier code style!").
- `./node_modules/.bin/prettier --check` on the own item file (ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-wave1b-agent-native-bodies.md) — expected pre-existing dirt; observed still warns (untouched by me, disclosed).
- `npm run arggon -- validate` — expected ok; observed `arggon validate: ok (0 warning(s), convention v5)` (also green as the commit hook).
- `grep -rn "What went wrong|The real acceptance criteria"` over the 12 files — expected no hits; observed no hits (no scaffold markers remain).
- `grep -rn "\[x\]"` over the 12 files — expected none ticked; observed none (all boxes unticked, including the transcribed ones).
- `git push -u origin feat/task-wave1b-agent-native-bodies` — expected new branch pushed; observed `* [new branch] feat/... -> feat/...`, upstream tracking set.
- Commit: 11663e36 `docs(tracker): wave-1b agent-native bodies for 12 placeholder bugs` (12 files, 225 insertions, 61 deletions). Staged explicit paths only, never `git add -A`.

Non-content normalizations from the editor's format-on-save (pre-existing dirt was a missing blank line after `---` in all 12 + the own item file). Proved word/value/checkbox-identical outside the new live sections via `git diff -U0`:

- `+` blank line after frontmatter `---` (12 files; the only change in 2 of them besides the new sections).
- Title quote style, YAML-value-identical: bug-fresh-worktree-refusal-prose-drops-prep-step-truncation.md (`"..."` with `\"` escapes -> `'...'` plain) and bug-wave-probe-file-check-model-dependent.md (same, with `''` for the apostrophe in `wave's`). No other frontmatter key changed (status/assignee/depends_on/labels/parent/priority/dates all byte-identical); `arggon validate` green confirms parse.
- Emphasis `*x*` -> `_x_` (identical rendering) in carried-over Notes prose (force-push, fresh-worktree, prover, zero-byte files).
- Markdown table re-padding (whitespace only) in the zero-byte Notes table; blank-line insertions after `###` headings and around lists.
- Removed lines are ONLY the 12 `<!-- What went wrong ... -->` + 10 `<!-- The real acceptance ... -->` placeholders (2 files already had live Acceptance boxes, kept verbatim) plus the formatting-only lines above.

Findings for the lead (not filed as items, per instructions):

- THREE files had zero dated Notes, not two: bug-context-report-baseline-date-mismatch.md, bug-mcp-budget-contradicted-across-docs.md (both already carried live Acceptance boxes, kept verbatim; Context grounded in cli/src/measure.ts:48,57,352 + smoke/context-report.ts:502,709 + README.md:287 + json-output.md:229,902), AND bug-self-decided-false-positive-owner-assigned.md (no Notes, no Acceptance; both written from line-pinned authorities: spec-owner-decision-brief-021.md:120,165, lib/src/brief.ts:135-137,157,164,166, ADR 0021 §4, engineering.md Roles/decision-brief).
- No file had prior content (all 12 were still scaffold placeholders when verified before editing).
- No single-line depends_on exceeded printWidth, so no exception to disclose.
- Typo disclosure: the handoff open-questions line contains a stray non-English word ("self-decided-файл"); meaning intact, left for the lead to judge rather than stacking correction commits.

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT

verdict: approve (12 agent-native bodies, docs-only, smoke-exempt)

- Read the worktree diff (12 bug files + own item file) — nothing else; scope stays on the item
- Standards-reviewer: approve, no blocking findings (frontmatter values identical incl. YAML-identical requotes; 3 transcriptions spot-checked; 3 zero-Notes files grounded with all pins resolving at HEAD; normalizations value-equivalent; handoff typo accepted as harmless)
- Verifier: prettier clean on all 12, validate ok, no scaffold markers, no ticked boxes
- Recommendation: merge PR #737 (merge, not squash) on green CI; lead ticks Acceptance after merge and flips done
