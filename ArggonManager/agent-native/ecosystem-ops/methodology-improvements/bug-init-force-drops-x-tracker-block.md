---
type: bug
status: todo
id: bug-init-force-drops-x-tracker-block
title: "`init --force` re-scaffolds `.convention.yml` from a fixed string, silently dropping the whole `x-tracker` block — it disarms `allow-steal`, `strict-gate-bins`, `strict-worktree-writes` and `reap-acked-orphans`"
parent: methodology-improvements
labels: [cli, safety, convention]
priority: p2
created: "2026-10-04"
updated: "2026-10-04"
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

<!-- The real acceptance criteria; tick each box when met. -->

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
