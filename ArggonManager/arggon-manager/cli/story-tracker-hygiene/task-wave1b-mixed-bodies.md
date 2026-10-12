---
type: task
status: todo
id: task-wave1b-mixed-bodies
title: "Wave-1b bodies: 12 placeholder items (tooling-env, role-model, release, adapters)"
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-wave1b-mixed-bodies.md
  Leaves live only under a story. id is the filename stem: task-wave1b-mixed-bodies.
  CLI `arggon create task wave1b-mixed-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Wave-1b bodies: 12 placeholder items (tooling-env, role-model, release, adapters)

## Context

Wave-1b of `decided: A`: the blocking guard (`task-validate-refuses-placeholder-bodies`, built, staged, uncommittable) refuses its own commit while these placeholders remain — their merge gates the guard's commit. Scope is ONLY files under `ArggonManager/arggon-manager/ + ArggonManager/methodology-productization/`: tooling-and-environment: bug-bundle-update-tool-drops-waive-and-force, bug-ci-seam-pin-shell-vs-test-copy-divergence, bug-prose-format-codespan-test-times-out-under-full-suite, bug-stale-merge-can-delete-merged-feature-silently, bug-test-spawn-spawnjson-null-drops-stderr, bug-verification-regex-matching-nothing; role-model-foundation: bug-adopter-engineering-template-software-locked, bug-verifier-cannot-read-the-tracker-no-allow-side, bug-x-tracker-option-list-has-no-doc-drift-guard; story-release-pipeline: bug-release-needs-auth-self-describing; story-adapter-selection: task-adapter-report-nits-from-review; story-capability-matrix: task-capability-matrix-followups-from-review. Three of these have ZERO dated Notes and need domain judgment grounded in named authorities, not invention: bug-context-report-baseline-date-mismatch, bug-mcp-budget-contradicted-across-docs, bug-release-needs-auth-self-describing. All others: transcribe Notes/comments. Bugs get Context + checkable boxes; the two tasks likewise.

## Acceptance

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed file carries checkable `## Acceptance` boxes
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean (modulo a disclosed single-line depends_on exception); `arggon validate` green; PR opened

## Notes

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT
verdict: approve (12 mixed-area bodies, docs-only, smoke-exempt)
- Read the worktree diff (12 files + own item file) — nothing else; scope stays on the item
- Standards-reviewer: approve, no blocking findings (frontmatter untouched incl. YAML-identical requotes; 4 transcriptions spot-checked; 2 Context-pre-existing files clean outside new Acceptance; zero-Notes file grounded with all pins resolving at HEAD; all boxes checkable)
- Ruling accepted with reasons: the x-tracker 3-space exception ships (no CI prettier gate; content beats formatter; disclosed with proof recipe)
- Verifier, all 6 probes green: prettier exactly-one-flagged (the accepted exception), validate ok, exception proof recovered (glued form confirmed), no markers, no ticks, both requotes YAML-identical
- Lead notes for close-out: amend own Acceptance box 4 to name the x-tracker exception (currently names a depends_on exception that does not exist) before ticking
- Recommendation: merge PR #738 (merge, not squash) on green CI; lead ticks Acceptance after merge and flips done
