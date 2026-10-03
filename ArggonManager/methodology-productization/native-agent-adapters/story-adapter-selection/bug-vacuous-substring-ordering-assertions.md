---
type: bug
status: in_progress
id: bug-vacuous-substring-ordering-assertions
title: "Ordering assertions using `indexOf(substring) < index` pass vacuously when the substring is absent (-1 < anything) — one such assertion is live in `cli/src/worktree.test.ts:557` after PR #608 reworded the message"
assignee: Arggon
branch: fix/bug-vacuous-substring-ordering-assertions
parent: story-adapter-selection
labels: [tests]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T10:45:06.471Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-vacuous-substring-ordering-assertions
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/bug-vacuous-substring-ordering-assertions.md
  Leaves live only under a story. id is the filename stem: bug-vacuous-substring-ordering-assertions.
  CLI `arggon create bug vacuous-substring-ordering-assertions` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Ordering assertions using `indexOf(substring) < index` pass vacuously when the substring is absent (-1 < anything) — one such assertion is live in `cli/src/worktree.test.ts:557` after PR #608 reworded the message

## Context

`String.prototype.indexOf` answers **-1** for an absent substring, and `-1` sorts before every real index. So an ordering assertion written as

```ts
expect(msg.indexOf("a")).toBeLessThan(msg.indexOf("b"))
```

passes when the ordering is correct, when it is **reversed**, and when the clause was **renamed out from under it**. It reads like a guard and is a no-op: the guard disarms itself on the very edit it is meant to catch.

The reported instance (`cli/src/worktree.test.ts:557`) lives on the UNMERGED branch of PR #608 (`feat/task-cli-start-remediation-tail-clipped-on-human-channel`) — `origin/main` has no such assertion, because PR #608 added it together with the reworded message. That branch's worker has since presence-checked its four own sites with inline `expect(x, "…must be present").toBeGreaterThanOrEqual(0)` guards, so that instance is already repaired *there*. What is not repaired is the CLASS: `origin/main` carried **22** more instances of the same idiom, and the next clause added by the clip-order work arrives in the same shape.

Root cause, shared with the #606 `checksum:` substitution: an assertion whose subject can silently be absent. Both are now closed by making absence an assertion failure rather than a value that happens to compare favourably.

## Acceptance

- [x] `worktree.test.ts:557` pinned correctly, and it FAILS if the ordering is reversed — proved by mutating the message and showing red. The line only exists on PR #608's unmerged branch (see Context); the class fix is `assertOrder` plus a structural gate, and the red-on-reversal proof was run on the live `origin/main` equivalents (`lib/src/worktree.test.ts`, the same worktree-refusal domain and the same remedy-before-evidence ordering).
- [x] Swept the repo for the `indexOf(...).toBeLessThan(...)` idiom and for substring-presence assertions where either side can be absent: **22** vacuous-capable ordering assertions across **7** test files, all converted. Sibling shapes reviewed and deliberately left (each fails loudly rather than passing vacuously): `calls[0][calls[0].indexOf("--state") + 1]` in `cli/src/worktree.test.ts`, `raw.slice(raw.indexOf(...))` parsing, `cli/src/milestone.test.ts` (already asserts every index `>= 0`), and `smoke/context-report.test.ts:95` (an equality against a literal, not an order claim).
- [x] Shared helper, not per-test fixes: `assertOrder(haystack, ...needles)` in `test/assert-order.ts` (beside the existing shared test helpers `test/acceptance.ts` / `test/property-runner.ts`), used at every converted site. Presence is a PRECONDITION of the comparison, so the next message rewrite fails on the missing clause. Its contract is pinned by `cli/src/assert-order.test.ts`.
- [x] The honest "may be absent" case: optionality is the explicit object form `{ text, optional: true }`, never inferred and never positional; the type is `optional?: true`, so `{ text, optional: false }` does not compile and there is no spelling that looks like an opt-in while meaning required. An absent optional needle is tolerated but, when present, must still sit in its declared slot. All 22 swept sites had **required** needles (each one's claim is about a clause that must be there), so none needed the optional form; the only conditionally-produced clause in the corpus — `Preparation ran:`, gated on `steps.length > 0` in `freshWorktreeInstallRefusal` — is asserted only in fixtures where preparation ran, and is correctly required there.

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

Acceptance (as delivered — the canonical, ticked list is in ## Acceptance above):
- [x] `worktree.test.ts:557` pinned correctly, and it FAILS if the ordering is reversed — proved by mutating the message and showing red
- [x] Swept the repo for the `indexOf(...).toBeLessThan(...)` idiom (and substring-presence assertions generally) where either side can be absent; the guard fails on a missing substring instead of comparing -1
- [x] Shared helper `assertOrder(haystack, ...needles)` in `test/assert-order.ts` throws when any required substring is absent, so the next rewrite cannot silently disarm the check
- [x] The "may be absent" case has an explicit form (`{ text, optional: true }`), and every call site states required vs optional by which spelling it uses
