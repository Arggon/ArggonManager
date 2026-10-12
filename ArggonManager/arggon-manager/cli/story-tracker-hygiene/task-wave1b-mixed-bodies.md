---
type: task
status: done
id: task-wave1b-mixed-bodies
title: "Wave-1b bodies: 12 placeholder items (tooling-env, role-model, release, adapters)"
assignee: arggon-delivery-lead
branch: feat/task-wave1b-mixed-bodies
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

- [x] Every listed file carries a real `## Context` (no scaffold marker)
- [x] Every listed file carries checkable `## Acceptance` boxes
- [x] No file outside the listed set touched; frontmatter untouched
- [x] Prettier clean (modulo the disclosed x-tracker code-span-spacing exception, content wins); `arggon validate` green; PR opened

## Notes

### 2026-10-12 @ses_ed1cf0451ffecacHCLC9mjdfZT

Evidence for the standards reviewer (maker: arggon-maker, branch feat/task-wave1b-mixed-bodies).

Commands run (all in the worktree /home/arggon/Projects/ArggonManager-task-wave1b-mixed-bodies):

- `npx prettier --check` on the 12 touched files — expected clean; observed 11 clean, 1 warn (bug-x-tracker-option-list-has-no-doc-drift-guard.md, disclosed exception below).
- `npx prettier --check` on the own item file — expected pre-existing dirt; observed 1 warn (missing blank line after frontmatter `---`, from the tracker claim write; style fix follows this comment).
- `arggon validate` via native tool — expected ok; observed ok:true, 0 warnings, convention v5 (also green as the commit hook on 786c7c7c).
- `grep -rn "What went wrong|The real acceptance criteria"` over the 12 files — expected no hits; observed no hits (no scaffold markers remain).
- `grep -rn "^- [x]"` over the 12 files — expected none ticked; observed none (the single `[x]` hit is inline code in ci-seam-pin Notes prose about vacuous satisfaction, not a checkbox).
- `git push -u origin feat/task-wave1b-mixed-bodies` — expected new branch pushed; observed `[new branch] feat/... -> feat/...`, upstream tracking set, exit 0.
- Commit: 786c7c7c `docs(tracker): wave-1b mixed bodies for 12 placeholder items` (12 files, 223 insertions, 65 deletions). Staged explicit paths only, never `git add -A`.

Non-content normalizations from the editor's format-on-save (pre-existing dirt was a missing blank line after `---` in all 12). Proved word/value/checkbox-identical outside the new live sections via `git diff -U0` plus a minus/plus pairing pass (only 4 unpaired minus lines repo-wide: 2 title requotes + 2 table-separator re-pads, all benign):

- `+` blank line after frontmatter `---` (all 12) and blank lines around headings/lists.
- 2-space-indented continuation lines dedented to column 0 (bundle Notes CLI/bundle rows, adopter convention quote, verifier catalog line).
- Emphasis `*` -> `_` (identical rendering) in carried-over Notes prose (ci-seam-pin, adopter, verifier, x-tracker, verification-regex).
- Title quote style, YAML-value-identical: verification-regex (`"...\"0 markers\"..."` -> `'... "0 markers" ...'`) and capability-matrix-followups (same shape).
- Markdown table re-padding (whitespace only) in adopter + x-tracker Notes tables.
- Removed lines are ONLY the 12 `<!-- What went wrong ... -->` + 10 `<!-- The real acceptance ... -->` placeholders (2 files already had live Acceptance boxes, kept verbatim) plus the formatting-only lines above.

Content-wins exception (validate wins over prettier, same principle as the disclosed depends_on rule): prettier's markdown printer deletes the space after inline code spans ending in an escaped backtick, gluing words in bug-x-tracker Notes (the\`SECTIONS\`table, join\`SECTIONS\`, \`false\`window). I restored the 3 spaces via a byte-precise script after the format-on-save ate them, so that file warns on --check while its words stay intact. Proof: `git show HEAD:file | npx prettier --stdin-filepath` shows prettier itself demanding the glued form. No depends_on exception to disclose (no depends_on field in any of the 12).

Findings for the lead (not filed as items, per instructions):

- ONE file had zero dated Notes: bug-release-needs-auth-self-describing.md. Context + Acceptance grounded in line-pinned authorities: release.md:40-61 (one-time setup + ENEEDAUTH trap), :75-80 (npm trust list diagnostic + the two failures that cost two release attempts), :139-149 (recovery), .github/workflows/release.yml:31-36 (OIDC-only, fails closed), :204-220 + :249-259 (bare publish steps with no error pointer), spec-release-pipeline-015.md:457-462 (A17 runtime-pending).
- TWO files already had live Context (Acceptance still placeholder, now filled; Context left byte-identical): task-adapter-report-nits-from-review.md (5 nits + round-1 informational; Acceptance adds the verdict's minimum: retired seam paths + re-measure-or-annotate) and task-capability-matrix-followups-from-review.md (5 findings -> 5 boxes).
- No file had live Acceptance already; no box ticked anywhere (all 12 files' boxes unticked, including transcribed ones).
- Verifier item scope note: its Notes deny-list names arggon_branch as denied while its transcribed Acceptance box 1 grants arggon_branch (read-side) — faithfully transcribed, for that bug's maker to resolve, not this wave.
- No single-line depends_on exceeds printWidth in any touched file.

### handoff 2026-10-12 @ses_ed1cf0451ffecacHCLC9mjdfZT (session: ses_ed1cf0451ffecacHCLC9mjdfZT) — next: Lead reviews 12 bodies, opens PR, merges to unblock guard commit

- branch: feat/task-wave1b-mixed-bodies
- open questions: Accept x-tracker prettier exception; file zcode seam-id sweep noted in nits verdict?
