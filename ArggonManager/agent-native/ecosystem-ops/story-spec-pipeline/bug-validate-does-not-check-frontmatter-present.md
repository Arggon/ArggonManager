---
type: bug
status: in_progress
id: bug-validate-does-not-check-frontmatter-present
title: "`arggon validate` reports ok on an item file whose FRONTMATTER was deleted entirely — it checks required fields when a frontmatter block exists, never that one exists"
assignee: Arggon
branch: fix/bug-validate-does-not-check-frontmatter-present
parent: story-spec-pipeline
labels: [tracker-schema, validate]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T12:48:00.029Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-validate-does-not-check-frontmatter-present
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-validate-does-not-check-frontmatter-present.md
  Leaves live only under a story. id is the filename stem: bug-validate-does-not-check-frontmatter-present.
  CLI `arggon create bug validate-does-not-check-frontmatter-present` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `arggon validate` reports ok on an item file whose FRONTMATTER was deleted entirely — it checks required fields when a frontmatter block exists, never that one exists

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #616 (bug-vacuous-substring-ordering-assertions), 2026-10-03, while resolving an item-file conflict: its union script deleted an item file's frontmatter entirely, and **`arggon validate` reported ok**.

**Why that is a real gap.** `validate` checks required fields (`type`, `id`, `status`, …) *when a frontmatter block is present*, and reads the file as body-prose when it is not. So the worst possible corruption — no frontmatter at all — is the one shape it accepts. The tracker then has a Markdown file with no id, no status and no parent: it cannot be listed, claimed, validated for the done gate, or resolved by `depends_on` — yet the gate that owns the tracker's integrity says the tree is fine.

This is the same blind spot the session keeps meeting in a different place: a validator that checks the *content of a structure* without checking that the structure exists. Compare the seam drift gate, which explicitly checks for a committed provenance marker before it has anything to compare, and the seam parity test, which was added precisely because two copies were checked independently.

**Why it mattered immediately.** This session has repeatedly hit item-file conflicts because tracker commits land on `main` from sessions in other worktrees, and every one of those resolutions is a chance to drop frontmatter. Two workers this session wrote union scripts; at least one dropped the block and noticed only by eye.

Acceptance:
- [ ] An item file with NO frontmatter block is a validate ERROR, naming the file — the structural equivalent of the `MISSING_ID` error it already raises for an empty block
- [ ] The same for a file whose frontmatter is unterminated (unclosed `---`), which today is likely read as body prose too
- [ ] A fixture per case, following the repo convention of one failing fixture per layout rule
- [ ] Check the same question across the other frontmatter readers (`list`, `show`, `next`, the done gate, cascade): do they degrade safely, or does one of them write a file with no frontmatter?
- [ ] The kernel is the owner (`@arggondev/lib`); a CI-only check is not enough, since `validate` is what the pre-commit hook and adopter CI run

### 2026-10-03 @ses_efe3043b8ffed48yGgAx3qryzL
PR #619 — kernel fix, Behavioral methodology impact (reasoning below).

## What landed

Fix is in the KERNEL (`@arggondev/lib`), not CI: `validate` is what the pre-commit hook and adopter CI run, so a CI-only fix leaves the real gate weak.

- `lib/src/frontmatter.ts` — parse refusals are a typed `FrontmatterParseError` (MISSING_FRONTMATTER / UNTERMINATED_FRONTMATTER / INVALID_FRONTMATTER_LINE) instead of bare Errors distinguished only by message text. A malformed line inside a well-formed block still reports `BROKEN_YAML`, so that contract is unchanged.
- `lib/src/items.ts` — a skip now carries its REASON (`no-frontmatter` | `no-type`). Readers with no layout knowledge keep skipping both exactly as before; only a caller that knows the file's expected role promotes the skip into an error.
- `lib/src/validate.ts` — a file in a position the layout RESERVES for an item (container index `<dir>/<dir>.md`, or a `task-*`/`bug-*` leaf) must carry a block: `MISSING_FRONTMATTER`, naming the file. An unclosed block is `UNTERMINATED_FRONTMATTER`.
- `convention.md` now states the requirement, so doc and gate agree.

Scoped to item POSITIONS on purpose: a plain `.md` the layout reserves nothing for stays an ignored non-item document, so no adopter gains a requirement for a README or notes file.

## Evidence: red on mutation, reverted

Pre-fix baseline on this item file (expected the new codes, observed `ok`, exit 0):

| shape | before | after |
| --- | --- | --- |
| block deleted entirely | `ok`, exit 0 | `MISSING_FRONTMATTER`, exit 1 |
| unterminated `---` | `BROKEN_YAML` (generic) | `UNTERMINATED_FRONTMATTER` |
| zero-byte file | `ok`, exit 0 | `MISSING_FRONTMATTER`, exit 1 |

Each message names the file. Container index losing its block also caught (verified on a live story index: MISSING_FRONTMATTER + the PARENT_MISSING cascade). All reverted; validate is ok.

## Fixtures: one per layout rule

`missing-frontmatter/` (the live incident), `missing-frontmatter-index/`, `unterminated-frontmatter/`, `empty-item-file/`, plus `non-item-markdown/` as the pinned no-false-positive control. README table row added.

## SWEEP ANSWER — do the other readers degrade safely, or does one WRITE a frontmatter-less file?

**No writer does. The gap was read-side only.** Every surface run against a wiped item:

- Readers (`list`, `show`, `next`, `report`, `doctor`, `board`): all degrade to "not an item". `show` refuses (`SHOW_FAILED`, id not found); the rest omit it silently. No crash, no invented item.
- Writers (`comment`, `update --status`, `update --unassign`, `handoff`, `branch`, `priority migrate`): all refuse with `id not found under the tracker`. The wiped file was byte-UNCHANGED afterwards and remained the only frontmatter-less file — nothing created, overwritten or silently "repaired".
- Writer census: every item-file write funnels through `stringifyFrontmatter` (`comment.ts`, `create.ts`, `priority.ts`, `update.ts` incl. the cascade and promotion rewrites), which always emits the fences.

## Union-resolution workflows: checked, none relied upon

**No tolerant mode** in the kernel depends on the old lenient read (grepped; the only tolerated/best-effort hits are unrelated — CRLF parsing, co-writer inode swaps, gh round-trip). Item conflicts resolve as a UNION of `###` blocks under main's frontmatter, so the normal path keeps main's block and is unaffected. What changed is exactly the case where a resolution script DROPS the block — that now fails the gate instead of passing it. No legacy `tasks/` fixture relied on the old behavior.

## Separate finding — 4 item files are 0-byte on main (needs its own item)

The new rule immediately surfaced real pre-existing corruption:

- `.../parallel-worktree-runtime-isolation-ports-state-services/task-record-exploration-016-worktree-runtime-isolation.md`
- `.../ecosystem-ops/ci-stability/bug-live-reload-sse-race.md`
- `.../ecosystem-ops/ci-stability/task-derive-cli-spawn-loader.md`
- `.../ecosystem-ops/ci-stability/task-remove-diag-listener.md`

In each case the commit that emptied the file IS its own `chore(tasks): commented <id>` auto-commit. All item writers use `writeFileAtomic` (temp + rename), so an in-place truncate should be impossible — meaning this is a writer-side regression I could not reproduce, and it is NOT fixed by this PR. Content is restored byte-for-byte in a SEPARATE, droppable commit so the validator can be reviewed alone; no frontmatter/body was edited.

Coordinator: this warrants its own item — a zero-byte item file silently un-claims an item and drops its acceptance history, and the writer path that caused it is still unfixed. Filing it is your call, not mine.

## Gates (all green)

`npm run build` BEFORE `npm test` → 2594 passed / 126 files → `npm run lint` → `npm run arggon -- validate` (ok) → `npm run check:plugin` → `npm run test:structure` (5 passed) → `npm run lint:structure`.

## Methodology impact: Behavioral

A previously-ok tree now errors — the intended effect. Reasoning: a validator that checks the CONTENT of a structure without checking that the structure EXISTS accepts the worst shape it can see. Same class the repo already knows elsewhere (the seam drift gate checks for a committed provenance marker before comparing; the seam parity test exists because two copies were checked independently). Blast radius bounded to item positions, pinned by the `non-item-markdown` control. `npm run skills:sync` run in-PR: no drift (no CLI surface changed).
