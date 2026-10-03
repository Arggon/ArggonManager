---
type: bug
status: todo
id: bug-prettier-indented-list-continuation-grows-2-spaces-per-write
title: "prettier is non-idempotent on Markdown a second way: an indented list-continuation paragraph grows 2 spaces on every `--write`, so a single `--check` cannot prove convergence"
parent: story-adopter-feedback
labels: [formatting]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/bug-prettier-indented-list-continuation-grows-2-spaces-per-write.md
  Leaves live only under a story. id is the filename stem: bug-prettier-indented-list-continuation-grows-2-spaces-per-write.
  CLI `arggon create bug prettier-indented-list-continuation-grows-2-spaces-per-write` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# prettier is non-idempotent on Markdown a second way: an indented list-continuation paragraph grows 2 spaces on every `--write`, so a single `--check` cannot prove convergence

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #586 (task-explore-adopter-feedback-channel), 2026-10-03, while renumbering four documents and hitting it TWICE in one session.

**A second manifestation of the same non-idempotence class** as `bug-prettier-glues-split-inline-code-span` (also open): that one splits a multi-word inline code span near the wrap boundary and glues its continuation to column 0. This one **grows an indented list-continuation paragraph by 2 spaces on every `--write`**.

The consequence for the workflow is the important part, and it generalizes both bugs: **a single `prettier --check` is not evidence of convergence.** The worker had to run the formatter three consecutive times and verify the output stopped changing. Any gate or review step that checks "prettier is clean" once will pass on a file that will still change on the next write — so the drift is silent, and it accumulates exactly on the docs most likely to be edited (lists inside long decision records).

Note also what the worker chose to do about it: rewrote the affected content as single-line bullets rather than fighting the formatter, and kept the diff tight instead of filing this. Filing it now, with the reproduction, because "two independent encounters in one day" is the signal.

Acceptance:
- [ ] Both manifestations (span splitting AND 2-space indent growth) are covered by one item's repro, so the class is tracked once
- [ ] A convergence check exists — format twice and assert the second pass produces no diff — because a single `--check` provably cannot detect this
- [ ] The repo's docs/prettier guidance states the rule an author needs (avoid indented list continuations and multi-word inline spans near the wrap boundary, or accept the format churn)
- [ ] Decide whether the fix is prettier config (printWidth/proseWrap), a `.prettierignore` scope for the long decision records, or authoring convention — and record the decision rather than leaving the next author to rediscover it
