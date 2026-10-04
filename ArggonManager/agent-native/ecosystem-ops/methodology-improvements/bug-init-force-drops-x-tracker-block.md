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
