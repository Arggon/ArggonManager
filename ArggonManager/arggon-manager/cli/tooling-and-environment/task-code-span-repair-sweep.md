---
type: task
status: in_progress
id: task-code-span-repair-sweep
title: "Code-span repair sweep: remaining glued/indent-lost spans in docs"
assignee: Arggon
branch: feat/task-code-span-repair-sweep
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-22"
claimed_at: "2026-09-22T00:31:47.432Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-code-span-repair-sweep
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-code-span-repair-sweep.md
  Leaves live only under a story. id is the filename stem: task-code-span-repair-sweep.
  CLI `arggon create task code-span-repair-sweep` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Code-span repair sweep: remaining glued/indent-lost spans in docs

## Context

Follow-up from `bug-formatter-glues-markdown-spaces` (PR #387). The root cause
(`` \` `` is not a valid escape inside a CommonMark code span, so the parser
splits the span and prettier drops the surrounding whitespace) still affects
docs outside that PR's scope:

- **Indentation variant** in
  `ArggonManager/docs/explorations/exploration-{adopter-upgrade-experience-007,priority-model-008,torture-contention-005}.md`,
  `ArggonManager/docs/plans/plan-spec-pipeline-002.md`,
  `ArggonManager/docs/specs/spec-{priority-field-008,spec-pipeline-002}.md`,
  `ArggonManager/docs/playbooks/{node,vitest}.md`.
- **Token glues** quoted as evidence in tracker items
  (`task-native-lib-hygiene`, `bug-seam-signature-anchor-regressed`).

Repair requires re-encoding each span (restoring whitespace alone is not
enough: prettier deletes it again).

## Acceptance

- [x] Every affected doc span re-encoded (spans kept on one line, the #387
      technique) so it parses as one span with the intended text. 13 docs
      repaired: the 8 named above + 5 the new corpus rule swept up
      (`exploration-{opencode-v2-native-009,smoke-ui-testing-006}.md`,
      `playbooks/{opencode,typescript}.md`, `specs/spec-spec-audit-006.md`).
- [x] `prettier --check` clean and `prettier --write` a no-op on the repaired
      files; the `prose-format` guard covers them (corpus-wide "prettier must
      not rewrite a code span" rule + byte-stability list of the 15 files).
- [x] Tracker-item evidence quotes left as-is (body-only history); the
      exclusion is documented in the guard with both item ids.
- [x] `arggon validate` green; CI green.

## Result

All 13 affected docs repaired; `prettier --check` clean and `--write` a
no-op on them. The guard (`cli/src/prose-format.test.ts`) gained the
corpus-wide source-level rule the #387 handoff asked for (parsed via
`prettier.__debug.parse`; fails on the pre-repair base with the exact span)
and its byte-stability list now pins the 15 repaired files. Tracker-item
evidence quotes (`task-native-lib-hygiene`,
`bug-seam-signature-anchor-regressed`) stay as history: their bodies quote
the mangled formatter output as evidence and are excluded from the prose
corpus by design (documented in the guard). Evidence and gates in the
comment below.

## Notes

- Filed from the PR #387 handoff; cosmetic but recurring (the formatter
  auto-runs on every edit in this repo).

### 2026-09-22 @Arggon
Worker evidence (branch `feat/task-code-span-repair-sweep`, content commit 395f058).

**Scope found by sweep.** The item named 8 docs; a corpus scan (raw span slices via `prettier.__debug.parse`, all 272 prose `.md` outside the tracker item tree) found 5 more in the same class: `exploration-{opencode-v2-native-009,smoke-ui-testing-006}.md`, `playbooks/{opencode,typescript}.md`, `specs/spec-spec-audit-006.md`. All 13 repaired — every affected span now sits on one line, like the #387 pitfalls.md repair.

**Repair semantics (expected vs observed).** For the 12 indent-variant spans the value went from `<before>\n<after>` to `<before> <after>` — the rendered text is unchanged (CommonMark turns the in-span line ending into a space), the source is now formatter-stable. `spec-spec-audit-006.md`'s triple-backtick ellipsis span re-encoded to prettier's canonical single-backtick `` `…` `` (same parsed value). Checked HEAD vs worktree with `prettier.__debug.parse`: in every file the span-value list is identical except exactly those intended spans — no prose token added, removed or merged.

**Guard (`cli/src/prose-format.test.ts`).**

- New corpus-wide test “prettier never rewrites a code span's source text”: formats every prose doc and compares the raw slice of each `inlineCode` node (offsets from `prettier.__debug.parse`) before/after formatting. This is the source-level rule the #387 handoff deferred to this item.
- Byte-stability list extended to the 15 files repaired by #387 + this item (`prettier --write` must stay a no-op).
- Tracker-item evidence quotes (`task-native-lib-hygiene`, `bug-seam-signature-anchor-regressed`) stay as-is (history); the exclusion is documented in the guard with both ids, per acceptance box 3.

**Mutation evidence.** `git checkout HEAD -- ArggonManager/docs/playbooks/node.md` (pre-repair base):

- new rule FAILS: `playbooks/node.md: prettier rewrites code span "`nvm install 24 && nvm\n use 24`" → "`nvm install 24 && nvm\nuse 24`"`;
- byte-stability test FAILS on the same file;
- the token-glue rule stays GREEN there — the exact gap #387 documented, now closed.

**Gates (worktree, 2026-09-21/22).**

- `npm test` → **92 files / 1491 tests** green.
- `npm run lint` → exit 0.
- `npm run arggon -- validate` → ok (0 warnings, convention v5).
- `npm run arggon -- spec validate` → ok (18 docs, 0 warnings).
- `npx prettier --check` on the 15 repaired files → clean (`--write` a byte-identical no-op, pinned by the guard; spot-checked: `prettier --write` on each leaves `git status` clean).

**Scope hygiene.** No overlap with parallel items: `ArggonManager/docs/json-output.md`, `skills/**`, `lib/src/worktree.ts` (start-build-exit) and `cli/src/measure*` (measure flake) untouched. The extra formatter output in the 5 sweep-found files is prettier's canonical form of pre-existing prose (table re-padding, `*emphasis*` → `_emphasis_`, a `+` list marker, two list-continuation indents).

CI is pending on the PR, so acceptance box 4 stays open for the coordinator.

### handoff 2026-09-22 @Arggon — next: Review PR #391 (draft, base opencode2); merge with a merge commit (tracker-carrying); after CI green tick box 4 and flip done.
- branch: feat/task-code-span-repair-sweep
- open questions: Guard pins 15 prose files byte-stable — a later reformat needs the list updated in the same PR; tracker-item glues in the 2 done items intentionally left as history.

### 2026-09-22 @Arggon
CI green on PR #391 @ efff977 (draft, base opencode2): `cli` pass (3m25s, run 35673225273) and `tasks-validate` pass (26s, run 35673225284). `arggon validate` ok locally too (0 warnings, convention v5), so acceptance box 4 is verified end to end — it stays unticked only because the done flip belongs to the coordinator after the merge.

### 2026-09-22 @Arggon
Coordinator note: 13 docs repaired with the #387 technique (+5 found in the same class) and the guard now carries the corpus-wide rule 'prettier never rewrites a code span's source text' with mutation coverage (reverting node.md fails with the exact span); tracker quotes left as history with documented exclusion. Gates 1491 tests, lint, validate, spec validate, prettier check/write byte-stable; CI pass on 48f2eca. Merged with merge commit; item flipped to done.
