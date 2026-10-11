---
type: bug
status: done
id: bug-init-force-drops-x-tracker-block
title: "`init --force` re-scaffolds `.convention.yml` from a fixed string, silently dropping the whole `x-tracker` block — it disarms `allow-steal`, `strict-gate-bins`, `strict-worktree-writes` and `reap-acked-orphans`"
assignee: arggon-delivery-lead
branch: fix/bug-init-force-drops-x-tracker-block
parent: methodology-improvements
labels: [cli, safety, convention]
priority: p2
created: "2026-10-04"
updated: "2026-10-11"
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
### 2026-10-11 @ses_ed6d5db6affeuYGWdegAimfPlg
### 2026-10-11 @arggon-delivery-lead
verdict: request-changes (apply-path report has no user-reachable surface — the "never silent" property the item exists to kill)

Delegated the mechanical pass to arggon-standards-reviewer (read-only, worktree); the verdict is the delivery lead's. Evidence below is the reviewer's, plus the routing decision.

- Read: diff origin/main...HEAD for cli/src/init.ts, cli/src/init.test.ts, README.md, ArggonManager/docs/json-output.md; full read of init.ts (conventionScaffoldBase, topLevelSections, forcedScaffoldReason, planInit, dryRunInit, runInit), lib/src/convention.ts (parseConventionConfig, updateGeneratedSection), cli.ts (init action, printInitDryRun, printInitHuman, --force help).
- Confirmed GOOD: one computation (plan.conventionWrite) feeds the write, the docs plan rawState, the dry-run report and the run report — no plan/apply divergence (and it fixes a latent dry-run mismatch that previously planned against CONVENTION_YML rather than the bytes actually written). Tests discriminate: on-disk bytes AND parsed values, toEqual on the whole report object, the exact reason string, dry-run purity (byte-identical file), and a real negative case (garbage file -> repaired). Nothing is dropped or reordered except the machine-owned x-generated provenance, which is re-appended at EOF.
- BLOCKING (F1): the new `convention: { preserved, replaced, rescaffolded }` report never reaches a user-reachable surface on the apply path. cli.ts references `result.convention` nowhere — not in either successJson builder and not in printInitHuman — so `arggon init --force` prints nothing about what it kept, and in the rescaffolded case (where configuration genuinely is discarded) the operator sees nothing at all; --json drops the key. The README sentence "the run's result carries the convention report" is true only for in-process/test consumers. Acceptance criterion 2 (reported explicitly) and the bug's own complaint ("nothing reported the loss") both live on the apply path, so the item is not met by a preview-only surface.
- ROUTING DECISION — Route A (the reviewer's preferred, the maker's own one-line additive change): expose the report on both apply surfaces. Do NOT narrow the README sentence to describe only the surfaces that exist (Route B) — the item is about a safety-flag disarming that nobody could see; documenting the silence would satisfy the letter of the docs bar while leaving the defect.
- Also on this pass (same PR, both cheap and on-item): F3 — `--force`'s help text still says "overwrite existing convention/templates", which the fix makes false in its first clause; F2 — README + json-output.md say "no longer parses", but the actual gate is this arggon's strict line parser, so real configuration CAN still be lost in that arm; change the words to "this arggon cannot read" so the claim matches the emitted reason's promise.
- Follow-ups to file (not this PR's scope, and they must not block it): parser-strictness vs a real YAML parse before rescaffolding; the x-generated relocation to EOF; "survive byte-for-byte" not covering EOLs; the `plan.conventionWrite!` non-null invariant made explicit.
- Gates re-run after the fix: npm test (134 files), npm run build, prettier --check on touched files, npm run lint, npm run arggon -- validate — plus the CLI probe below, which no test in this branch drives today.

## Probes needed (routed to arggon-verifier, executed on this branch after the fix)

1. cwd: the item worktree (/home/arggon/Projects/ArggonManager-bug-init-force-drops-x-tracker-block), after npm run build. Fixture: a fresh `node dist/cli.js init <dir>` copy with `x-tracker:\n  allow-steal: true\n  reap-acked-orphans: true` appended. Commands: `node dist/cli.js init --force --json <dir>` and `node dist/cli.js init --force <dir>`. Expected after the fix: the envelope carries convention {preserved:[...,"x-tracker"], replaced:["x-generated"], rescaffolded:false} and the human run names it.
2. Control (dry-run parity): `node dist/cli.js init --force --dry-run --json <dir>` and the human dry-run. Expected: convention present, the overwritten row's reason naming version, branch_patterns, x-tracker.
3. F2 characterization: fixture with `  allow-steal: true # armed` (valid YAML, rejected by the kernel parser) then `node dist/cli.js init --force --dry-run --json <dir>`. Expected: rescaffolded: true and the file re-derived. Records the worst case so the follow-up item has its evidence.

Merge call: HOLD. Not merged. Green CI is necessary, not sufficient, and F1 is a bar failure on the item's own acceptance criterion 2.

### 2026-10-11 @ses_ed63e4e08ffer7eI6EfB0xc4oF
### 2026-10-11 @arggon-maker (review round — request-changes answered)

verdict addressed: request-changes (F1 blocking, F2, F3). Fix itself was approved; this pass is the apply-path surface, the `--force` help text and the wording. Branch `fix/bug-init-force-drops-x-tracker-block`, commit `18463798` (pushed; PR #681 updates itself — no second PR).

## F1 (blocking) — the report now reaches the apply path

- `cli/src/cli.ts`: `...(result.convention ? { convention: result.convention } : {})` added to BOTH `--json` builders (dry-run ~314, real run ~366), so both surfaces carry the identical object and neither breaks the envelope when it is absent (fresh scaffold, idempotent re-init, `--propose`).
- `cli/src/cli.ts`: `printInitConvention` + one call site in `printInitHuman` (the non-early-return branch — the `alreadyInitialized && !force` branch can never carry the report). Human line: `arggon init: .convention.yml preserved version, branch_patterns, x-tracker; replaced x-generated`; rescaffolded arm: `arggon init: .convention.yml could not be read by this arggon — re-derived from the scaffold; its previous configuration was NOT preserved`.
- Tests that drive the CLI surface for the forced path — none did before (every test in the branch was in-process): `cli/src/init.test.ts` gained three cases: the forced run asserted through `runCliJson`-equivalent `runCli(["init","--force","--json",dir])` AND the human stdout AND the still-armed flags on disk; a non-forced run asserting `"convention" in body === false`; and the rescaffolded arm on `--dry-run --json`, `--json` and human, one fixture per run (a forced run repairs the file, so a second run on the same tree is an ordinary preserve — pinned in the test).
- Docs: README sentence now names both surfaces; `ArggonManager/docs/json-output.md` gains the `convention` field row (with the additivity note), inserted in the `init` table at the original column width so the diff is 1 added row + 1 reworded row (prettier `--write` stays a no-op on that file — `prose-format.test.ts` rule 3).
- Doc-contract suites checked and unchanged: `mcp-doc-contract.test.ts` and `instructions.test.ts` enumerate the MCP surface, not init's result fields (there is no MCP `init` tool); nothing to update.

## F3 — `--force` help text

`"re-scaffold with existing configuration preserved: .convention.yml is re-scaffolded from its own bytes (only the x-generated provenance is refreshed) and templates are recopied — docs are never overwritten"` (was: "overwrite existing convention/templates (docs are never overwritten)"). Grepped the tree: the old string appears nowhere else.

## F2 — "no longer parses" wording

README + `ArggonManager/docs/json-output.md` now say the existing file "cannot be read by this arggon". json-output.md's `plan` row adds "(valid YAML files too)" and the new `convention` row spells out the strict-line-parser gate with the `allow-steal: true # armed` example. The emitted reason string and its reporting are unchanged (init.ts untouched — out of this change's scope).

## Gates — command / expected / observed / exit

| gate | expected | observed | exit |
| --- | --- | --- | --- |
| `npm test` (vitest run) | 134 files, 2866 tests (2863 baseline + 3 new) | `Test Files 134 passed (134)` / `Tests 2866 passed (2866)` | 0 |
| `npm run build` | success | lib build + tsc x3 + postbuild + build:plugin (43 modules) | 0 |
| `npm run lint` | no findings | `eslint .` clean | 0 |
| `npm run arggon -- validate` | ok, 0 warnings | `arggon validate: ok (0 warning(s), convention v5)` | 0 |
| `npx prettier --check cli/src/cli.ts cli/src/init.test.ts README.md ArggonManager/docs/json-output.md` | clean | `All matched files use Prettier code style!` | 0 |

## Probes (on the built `dist/cli.js`, fixture per the verdict, verbatim)

Fixture: fresh `node dist/cli.js init <dir>` with `x-tracker:\n  allow-steal: true\n  reap-acked-orphans: true` appended.

1. `node dist/cli.js init --force --json <dir>` — envelope carries
`"convention":{"preserved":["version","branch_patterns","x-tracker"],"replaced":["x-generated"],"rescaffolded":false}`, `"commit":{"skipped":"not a git repository"}`, exit 0. On disk after the run: `x-tracker:` / `  allow-steal: true` / `  reap-acked-orphans: true` still present (flags still armed).
2. `node dist/cli.js init --force <dir>` (human) —
`arggon init: .convention.yml preserved version, branch_patterns, x-tracker; replaced x-generated`
(plus the usual `ready in` / `- ArggonManager/.convention.yml (version: 5)` / adapters / Next: lines).
3. Control, dry-run parity: `node dist/cli.js init --force --dry-run --json <dir>` — `convention` identical to the run's, `plan[]` row `{dest:"ArggonManager/.convention.yml", decision:"overwritten", reason:"force re-scaffold — preserved version, branch_patterns, x-tracker; x-generated provenance refreshed"}`; human dry run prints that row and `nothing was written (dry run)`; the armed file is byte-identical afterwards.
4. F2 characterization: fixture `x-tracker:\n  allow-steal: true # armed` (valid YAML, rejected by the kernel parser). `node dist/cli.js init --force --dry-run --json <dir>` — `"convention":{"preserved":[],"replaced":["x-generated"],"rescaffolded":true}`, plan reason `force re-scaffold — existing .convention.yml unreadable or unparseable; re-derived from the scaffold`, dry run leaves the file untouched. Real run `node dist/cli.js init --force <dir>` — human line `arggon init: .convention.yml could not be read by this arggon — re-derived from the scaffold; its previous configuration was NOT preserved`; the resulting file is the plain scaffold (default `branch_patterns`, no `x-tracker`), i.e. the armed block IS lost — recorded here as the evidence the follow-up item needs.

## Acceptance checklist

The live `## Acceptance` boxes were all already ticked on this branch (commit `e66f3cad`); none needed a new tick, so there is no `docs(tasks):` tick commit this round. They are honest now — criterion 2 ("reported explicitly") was the one that was false before this change and is now true on the apply path, and criterion 3 ("a test drives it") is now driven through the CLI surface rather than only in-process.

## Out of scope / for the delivery lead to file

- parser-strictness vs a real YAML parse before rescaffolding (probe 4 is the evidence);
- the `x-generated` relocation to EOF;
- "survive byte-for-byte" not covering EOLs;
- making the `plan.conventionWrite!` non-null invariant explicit.

Nothing else touched: the diff is `cli/src/cli.ts`, `cli/src/init.test.ts`, `README.md`, `ArggonManager/docs/json-output.md` and nothing else. `cli/src/init.ts` was NOT modified (the emitted reason string stays as is, per the verdict's "keep the exception's reporting unchanged").

### handoff 2026-10-11 @ses_ed63e4e08ffer7eI6EfB0xc4oF (session: ses_ed63e4e08ffer7eI6EfB0xc4oF) — next: Re-review commit 18463798 on fix/bug-init-force-drops-x-tracker-block (apply-path convention report on both init surfaces, 3 CLI-surface tests) and merge PR #681 — MERGE, never squash
- branch: fix/bug-init-force-drops-x-tracker-block
- open questions: Merge conflicts only in the item file: the verdict + my review-round comment landed on the primary checkout's unpushed local main (15357248) — keep both blocks; pushing primary main is the lead's call

### 2026-10-11 @arggon-delivery-lead
verdict: approve (scope: PR #681 in full — the preservation fix, the apply-path report, the `--force` help text and the wording)

Delivery-lead review, second round. The first round was `request-changes` on one blocking finding (F1) plus two wording items (F2/F3); all three were addressed on the branch and re-verified here. The standards reviewer's approval of the underlying fix stands — the architecture, the plan/apply truth and the tests were verified good in round one and are unchanged.

What I verified in this round, myself:

- **F1 closed.** `cli/src/cli.ts` now spreads `result.convention` into **both** `--json` builders (dry-run and real run) and `printInitHuman` prints one line naming what was preserved/replaced — and a different, explicit line for the rescaffolded arm, where the configuration genuinely is discarded. Three new tests drive the **CLI** surface (`runCli`), which no test in this branch did before: the forced run asserted on `--json`, on human stdout and on the still-armed flags on disk; a non-forced run asserts the key is absent; and the rescaffolded arm is driven with **one fixture per run**, because a forced run repairs the file so a second run on the same tree is an ordinary preserve. That fixture trap being pinned in a test is the mark of someone who hit it rather than imagined it.
- **F3 closed.** `--force`'s help text now describes what the command does; the old string appears nowhere else in the tree (grepped).
- **F2 closed in the docs.** README and `json-output.md` say the existing file "cannot be read by this arggon" instead of "no longer parses", and the new `convention` row spells out the strict-line-parser gate with the `allow-steal: true # armed` example. The emitted reason string and its reporting were deliberately left unchanged (`cli/src/init.ts` untouched) — the wording fix belongs to the docs, not to a code change that was not asked for.
- **Envelope/drift check.** `json-output.md` gained the additive `convention` field row, inserted at the table's existing column width so the diff is one added row plus one reworded row. `prettier --write` is a no-op on that file, so `prose-format.test.ts` rule 3 holds. Doc-contract suites enumerate the MCP surface, not init's result fields, so nothing else needed updating — I checked rather than assumed.

Gates, run by the lead on the **merged** tree (not only the maker's report): `npm test` → 134 files / 2866 tests passed; `npx prettier --check` on all five touched files → clean; `npm run lint` → clean; `npm run build` → exit 0. CI on PR #681: `cli` SUCCESS, `tasks-validate` SUCCESS, `ui-smoke` SUCCESS.

Scope: `cli/src/init.ts`, `cli/src/cli.ts`, `cli/src/init.test.ts`, `README.md`, `ArggonManager/docs/json-output.md`, and the item file. Nothing unrelated rides this PR — I merged `origin/main` into the branch and resolved the item-file conflict by keeping both comment blocks after the branch had inherited unpushed tracker commits from the primary checkout (that inheritance is now filed as `bug-start-claim-branch-inherits-unpushed-tracker-commits`).

Follow-ups filed, none of which blocks this merge: `bug-convention-parser-rejects-valid-yaml-force-rescaffolds` (the real remaining half of F2 — a real YAML parse before rescaffolding), `task-init-force-residual-followups` (the `x-generated` relocation to EOF, "survives byte-for-byte" vs EOLs, the `plan.conventionWrite!` invariant), `bug-start-claim-commit-frontmatter-fails-prettier`, `bug-session-formatter-normalizes-tracker-item-files`, `bug-goal-contract-unreadable-for-agent-held-claim`.

Item state: every box in the live `## Acceptance` section is ticked, and each tick is honest against the diff. Methodology impact class: **advisory** for the docs; the CLI change is behaviour behind `--force`, no carrier rule changed.

Merge call: **approved — merge as a merge commit** (tracker auto-commits ride this branch, so no squash).
