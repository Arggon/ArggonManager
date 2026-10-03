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
