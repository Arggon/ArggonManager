---
type: bug
status: todo
id: bug-vacuous-substring-ordering-assertions
title: "Ordering assertions using `indexOf(substring) < index` pass vacuously when the substring is absent (-1 < anything) — one such assertion is live in `cli/src/worktree.test.ts:557` after PR #608 reworded the message"
parent: story-adapter-selection
labels: [tests]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/bug-vacuous-substring-ordering-assertions.md
  Leaves live only under a story. id is the filename stem: bug-vacuous-substring-ordering-assertions.
  CLI `arggon create bug vacuous-substring-ordering-assertions` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Ordering assertions using `indexOf(substring) < index` pass vacuously when the substring is absent (-1 < anything) — one such assertion is live in `cli/src/worktree.test.ts:557` after PR #608 reworded the message

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the reviewer of PR #608 (task-cli-start-remediation-tail-clipped-on-human-channel), 2026-10-03 — a test that passes while asserting nothing.

**The shape.** A message-ordering test of the form:

```ts
expect(msg.indexOf("if this is an identity error")).toBeLessThan(msg.indexOf("something"))
```

When the substring is ABSENT, `indexOf` returns **-1**, and `-1 < any-positive` is always true. So the assertion passes whether the ordering is correct, reversed, or the clause was deleted entirely. It looks like a real check and is a no-op.

**The live instance:** `cli/src/worktree.test.ts:557` searched lowercase `"if this is an identity error"`; PR #608 reworded the message to `If this is an identity error, set …. <git detail>`, so the lowercase search no longer matches and the assertion went vacuous at exactly the moment the behavior changed. The reorder it was meant to pin is real — the reviewer verified the clause-for-clause diff — but nothing now holds it there.

This is the second time this session that a passing test proved nothing: the #606 worker's first draft rewrote `checksum: <hex>` when the recorded form is `sha256:<hex>`, so the substitution matched nothing.

**Why it is worth a class fix:** this ordering-of-message idiom is exactly what the clip-order work keeps adding, and every future reorder is subject to it. A message rename silently unarms its own guard.

Acceptance:
- [ ] `worktree.test.ts:557` pinned correctly, and it FAILS if the ordering is reversed — prove it by mutating the message and showing red
- [ ] Sweep the repo for the `indexOf(...).toBeLessThan(...)` idiom (and substring-presence assertions generally) where either side can be absent; add a guard that fails when the searched substring is missing rather than comparing -1
- [ ] A shared helper is preferable to a per-test fix — e.g. an `assertOrder(msg, ...substrings)` that throws when any substring is absent, so the next rewrite cannot silently disarm the check
- [ ] Include the case where the searched text is intentionally optional: the helper needs an explicit "may be absent" form, or those assertions must state which

### handoff 2026-10-03 @ses_efea0882affep33K99Q6hjIX8P (session: ses_efea0882affep33K99Q6hjIX8P) — next: Review + merge the PR, then reopen the clip-order work to route new ordering assertions through assertOrder
- branch: main
- open questions: PR #608 (unmerged) has 4 ordering sites with inline presence checks — should its worker swap them for assertOrder after this merges?
