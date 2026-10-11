---
type: bug
status: in_progress
id: bug-init-force-drops-x-tracker-block
title: "`init --force` re-scaffolds `.convention.yml` from a fixed string, silently dropping the whole `x-tracker` block — it disarms `allow-steal`, `strict-gate-bins`, `strict-worktree-writes` and `reap-acked-orphans`"
assignee: arggon-delivery-lead
branch: fix/bug-init-force-drops-x-tracker-block
parent: methodology-improvements
labels: [cli, safety, convention]
priority: p2
created: "2026-10-04"
updated: "2026-10-11"
claimed_at: "2026-10-11T04:23:07.989Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-init-force-drops-x-tracker-block
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-init-force-drops-x-tracker-block.md
  Leaves live only under a story. id is the filename stem: bug-init-force-drops-x-tracker-block.
  CLI `arggon create bug init-force-drops-x-tracker-block` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `init --force` re-scaffolds `.convention.yml` from a fixed string, silently dropping the whole `x-tracker` block — it disarms `allow-steal`, `strict-gate-bins`, `strict-worktree-writes` and `reap-acked-orphans`

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [x] `init --force` **preserves** an existing `x-tracker` block (and the other `x-*`
      extensions) instead of overwriting it with the scaffold's fixed string
- [x] Where a force genuinely must replace a value, it is reported explicitly — a silent
      configuration loss is the defect, not the overwrite itself
- [x] A test drives it: arm two flags, run a forced re-init, assert both survive and the run
      says what it kept
- [x] The interaction is documented where `--force` is described (README +
      `docs/json-output.md`), including that it no longer discards configuration
- [x] If preserving is impossible for some field, that field is enumerated with its reason
      rather than left to fail silently
- [x] Consider the same question for the **generated docs** under `--force`: does a forced
      re-init drop `x-generated` provenance the same way? Answered either way, on the item
- [x] `arggon validate` ok, `npm test` green

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

Found while reviewing PR #640 (`task-adapter-orphan-reaping`), reported by the worker rather
than fixed in passing: **`init --force` regenerates `.convention.yml` from a fixed template
string and drops the entire `x-tracker` block.**

Every arming flag therefore silently disarms on a forced re-scaffold:

- `x-tracker.allow-steal` — the human-only claim-takeover double gate
- `x-tracker.strict-gate-bins` — the strict `start` gate
- `x-tracker.strict-worktree-writes` — the single-writer gate
- `x-tracker.reap-acked-orphans` — the arming path for acknowledged-orphan reaping
- `x-tracker.product-acceptance` — the acceptance-recording convention

It errs in the safe direction for the safety flags (a gate that was armed becomes unarmed —
**less** enforcement, not more) and it also **loses configuration the adopter set on purpose**,
which is the real problem: a repo that armed `allow-steal` because its workflow requires
supervised takeover silently stops requiring it, and nothing reports the loss.

This is exactly the class `bug-x-tracker-option-list-has-no-doc-drift-guard` is about, one
level up: a whole namespaced extension can be dropped without a word.

## Acceptance

- [ ] `init --force` **preserves** an existing `x-tracker` block (and the other `x-*`
      extensions) instead of overwriting it with the scaffold's fixed string
- [ ] Where a force genuinely must replace a value, it is reported explicitly — a silent
      configuration loss is the defect, not the overwrite itself
- [ ] A test drives it: arm two flags, run a forced re-init, assert both survive and the run
      says what it kept
- [ ] The interaction is documented where `--force` is described (README +
      `docs/json-output.md`), including that it no longer discards configuration
- [ ] If preserving is impossible for some field, that field is enumerated with its reason
      rather than left to fail silently
- [ ] Consider the same question for the **generated docs** under `--force`: does a forced
      re-init drop `x-generated` provenance the same way? Answered either way, on the item
- [ ] `arggon validate` ok, `npm test` green

### 2026-10-11 @arggon-maker
## Fix delivered — PR #681 (branch fix/bug-init-force-drops-x-tracker-block)

### The generated-docs question (acceptance criterion 6): answered — NO, a forced re-init does NOT drop `x-generated` provenance

The force path has ALWAYS carried the provenance state: `readGeneratedState` / `readGeneratedProjectName` read the existing `x-generated` entries + `projectName` and hand them to the doc planner (`prev` / `prevProjectName`), the scaffold write splices them back via `updateGeneratedSection`, and the docs plan's `stateWrite` re-records them with this run's refreshed entries. So under `--force`: untouched docs keep regenerating from the current template (`updated[]`) instead of degrading to adopter-modified, and adopter-modified/acked docs keep their skip rules. The defect was that the OTHER `x-*` extensions rode no such carry — the write base was the fixed `CONVENTION_YML` string, so `x-tracker` and friends vanished. This fix extends the same carry to the whole file (base = existing bytes) and keeps the provenance behavior byte-for-byte as it was. Behavior unchanged — not "fixed" because it was already correct; recorded here as the item asks.

Evidence: pre-existing test "`--force` carries the provenance section across a re-scaffold" (cli/src/init-docs.test.ts) plus the new test "does not drop the docs' x-generated provenance either: a modified doc stays skipped under force and keeps its state entry" (cli/src/init.test.ts) — both green.

### What changed (files)

- `cli/src/init.ts` — forced re-scaffold writes from the EXISTING `.convention.yml` bytes (only `x-generated` spliced fresh); new `convention: { preserved, replaced, rescaffolded }` report on the init result and the dry-run result (one shared `plan.conventionWrite` computation feeds the write, the docs plan's `rawState` and the report); scaffold row reason names the preserved sections; enumerated exception for unreadable/empty/unparseable files (`rescaffolded: true`).
- `cli/src/init.test.ts` — 5 new tests in a dedicated describe.
- `README.md` — "Re-running init" paragraph: `--force` no longer discards configuration; keep/replace report; the exception.
- `ArggonManager/docs/json-output.md` — the `plan[]` `overwritten` row describes the preservation, the reason shape and the exception.

### Gates (command / expected / observed / exit)

- `npm test` / green, baseline 134 files 2858 tests / **134 files, 2863 tests passed** (5 new; the only first-run failure was headless-ci.test.ts's `dist/cli.js` precondition — a fresh worktree without `npm run build`, green after the build) / 0
- `npm run build` / ok / ok — lib/dist + dist regenerated, vendored plugin bundle rebuilt byte-identical / 0
- `npx prettier --check cli/src/init.ts cli/src/init.test.ts README.md ArggonManager/docs/json-output.md` / clean / clean / 0
- `npm run lint` / clean / clean (no output) / 0
- `npm run arggon -- validate` / ok / ok (0 warning(s), convention v5) / 0

### Notes for the reviewer

- `version` and `branch_patterns` are preserved verbatim too (they live in the existing bytes) — consistent with the idempotent re-run path, which never rewrites them either. `validate` only errors on a NEWER convention version, so a preserved older version stays legal, and the report names it (`preserved`).
- The CLI `--json` init envelope is built field-by-field in `cli/src/cli.ts` (out of this item's scope), so the new `convention` report rides the init result and the dry-run `plan[]` row but is not yet a key in that envelope — recommend a follow-up item for the one-line additive change there.

### handoff 2026-10-11 @arggon-maker (session: ses_ed6c92b21ffebHkXoyNjSx5Isr) — next: Review/merge PR #681: init --force writes .convention.yml from the existing bytes; only x-generated is refreshed; keep/replace reported (convention report + dry-run plan reason). All gates green (npm…
- branch: fix/bug-init-force-drops-x-tracker-block
- open questions: Should the CLI --json init envelope (cli/src/cli.ts, out of scope) gain the additive convention report — follow-up item suggested; the delivery lead decides.
