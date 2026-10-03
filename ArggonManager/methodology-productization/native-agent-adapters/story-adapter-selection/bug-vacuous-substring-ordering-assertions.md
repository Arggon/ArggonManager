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
expect(msg.indexOf("a")).toBeLessThan(msg.indexOf("b"));
```

passes when the ordering is correct, when it is **reversed**, and when the clause was **renamed out from under it**. It reads like a guard and is a no-op: the guard disarms itself on the very edit it is meant to catch.

The reported instance (`cli/src/worktree.test.ts:557`) lives on the UNMERGED branch of PR #608 (`feat/task-cli-start-remediation-tail-clipped-on-human-channel`) — `origin/main` has no such assertion, because PR #608 added it together with the reworded message. That branch's worker has since presence-checked its four own sites with inline `expect(x, "…must be present").toBeGreaterThanOrEqual(0)` guards, so that instance is already repaired _there_. What is not repaired is the CLASS: `origin/main` carried **23** vacuous-capable ordering assertions (plus **6** subsumed presence anchors) across **8** test files, converted into **19** `assertOrder` call sites, and the next clause added by the clip-order work arrives in the same shape.

Root cause, shared with the #606 `checksum:` substitution: an assertion whose subject can silently be absent. Both are now closed by making absence an assertion failure rather than a value that happens to compare favourably.

## Acceptance

- [x] `worktree.test.ts:557` pinned correctly, and it FAILS if the ordering is reversed — proved by mutating the message and showing red. The line only exists on PR #608's unmerged branch (see Context); the class fix is `assertOrder` plus a structural gate, and the red-on-reversal proof was run on the live `origin/main` equivalents (`lib/src/worktree.test.ts`, the same worktree-refusal domain and the same remedy-before-evidence ordering).
- [x] Swept the repo for the `indexOf(...).toBeLessThan(...)` idiom and for substring-presence assertions where either side can be absent: **23** vacuous-capable ordering assertions (plus **6** subsumed presence anchors) across **8** test files, all converted into **19** `assertOrder` call sites.

Sibling shapes reviewed and deliberately left, each because it fails loudly rather than passing vacuously: `calls[0][calls[0].indexOf("--state") + 1]` in `cli/src/worktree.test.ts` (an absent flag reads element 0, so `toBe("merged")` fails); `cli/src/board-parity.test.ts:42-45,51-54` (`expect(start).toBeGreaterThan(0)` is a sound presence check, so `end > start` is a real claim); `cli/src/config-race.test.ts:59-60` (`toBeGreaterThanOrEqual(0)` — the sound half of the exemption, and the exact spelling PR #608 used); `opencode/plugins/arggon/board.test.ts:497-498` (`findIndex` + `toBeGreaterThan(0)`, same soundness); `cli/src/milestone.test.ts:164-166` (asserts every index `>= 0` beside the sort claim, which is what kills the all-`-1` pass); `raw.slice(raw.indexOf(...))` parsing; and `smoke/context-report.test.ts:95` (an equality against a literal, not an order claim).

- [x] Shared helper, not per-test fixes: `assertOrder(haystack, ...needles)` in `test/assert-order.ts` (beside the existing shared test helpers `test/acceptance.ts` / `test/property-runner.ts`), used at every converted site. Presence is a PRECONDITION of the comparison, so the next message rewrite fails on the missing clause. Its contract is pinned by `cli/src/assert-order.test.ts`.
- [x] The honest "may be absent" case: optionality is the explicit object form `{ text, optional: true }`, never inferred and never positional; the type is `optional?: true`, so `{ text, optional: false }` does not compile and there is no spelling that looks like an opt-in while meaning required. An absent optional needle is tolerated but, when present, must still sit in its declared slot. All 19 converted call sites had **required** needles (each one's claim is about a clause that must be there), so none needed the optional form; the only conditionally-produced clause in the corpus — `Preparation ran:`, gated on `steps.length > 0` in `freshWorktreeInstallRefusal` — is asserted only in fixtures where preparation ran, and is correctly required there.

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Found by the reviewer of PR #608 (task-cli-start-remediation-tail-clipped-on-human-channel), 2026-10-03 — a test that passes while asserting nothing.

**The shape.** A message-ordering test of the form:

```ts
expect(msg.indexOf("if this is an identity error")).toBeLessThan(msg.indexOf("something"));
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

### 2026-10-03 @Arggon

**19 `assertOrder` call sites in 8 test files** (from 23 vacuous-capable ordering assertions, plus 6 subsumed presence anchors), all through one shared helper.

Removed ordering assertions / subsumed presence anchors / resulting `assertOrder` call sites, counted off the diff:

| file                                    | ordering removed | anchors folded in             | call sites                                                                              |
| --------------------------------------- | ---------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| `lib/src/worktree.test.ts`              | 6                | 1 (`:1345`)                   | 5 (`:796`+`:799` merged into one chain; `:1323`; `:1346` `:1347` `:1348` kept pairwise) |
| `opencode/plugins/arggon/tools.test.ts` | 6                | 3 (`:1920`, `:2108`, `:2383`) | 6 (`:1921-1923`, `:2109`, `:2117`, `:2389` loop)                                        |
| `cli/src/board.test.ts`                 | 3                | 0                             | 2 (`:162`; `:1586`+`:1589` merged into one chain)                                       |
| `cli/src/headless-ci.test.ts`           | 2                | 1 (`:414`)                    | 2 (`:209`, `:415`)                                                                      |
| `cli/src/adopt.test.ts`                 | 3                | 1 (`detectedAt > -1`)         | 1 (`:483-485` merged into one chain)                                                    |
| `cli/src/init.test.ts`                  | 1                | 0                             | 1 (`:691`)                                                                              |
| `cli/src/init-opencode.test.ts`         | 1                | 0                             | 1 (`:296`)                                                                              |
| `cli/src/tui.test.ts`                   | 1                | 0                             | 1 (`:1179`)                                                                             |
| **total (8 files)**                     | **23**           | **6**                         | **19**                                                                                  |

Counting rule, so the total is checkable: an **ordering assertion** is a removed line whose matcher argument is not a numeric literal; a **presence anchor** is one whose matcher argument IS a literal (`toBeGreaterThan(-1)`, `toBeGreaterThanOrEqual(0)`). `cli/src/headless-ci.test.ts:414` was `expect(drift.indexOf(...)).toBeGreaterThan(-1)` — an inline presence anchor, not an order claim — and mis-filing it as an ordering assertion is what produced the inflated 22. The two numbers that were wrong in the first push were the file count (7 vs 8 — `adopt.test.ts` was omitted) and the call-site count (22 vs 19 — chains were counted per assertion rather than per call).

Sweep query (post-sweep it returns only the deliberate regression proof in `cli/src/assert-order.test.ts` plus `indexOf`-as-parser sites):

```
rg --pcre2 'expect\((?:(?!\)\s*\.toBe)[\s\S]){0,160}?\.indexOf\(' -g '*.test.ts' -g '*.test.tsx'
```

**Deliverables**

- `test/assert-order.ts` — `assertOrder(haystack, ...needles)`, beside the existing shared helpers (`test/acceptance.ts`, `test/property-runner.ts`). Presence is a precondition of the comparison. Optionality is `{ text, optional: true }`; the type is `optional?: true`, so `optional: false` does not compile and there is no spelling that looks like an opt-in while meaning required.
- `cli/src/assert-order.test.ts` — 11 cases pinning both properties, including red-on-reversal, the `-1 < n` vacuity, equal-index, single-needle, subject truncation, and four optional-needle cases.
- `tools/ast-grep/rules/ordering-assertions-use-assert-order.yml` + its suite + README section — the structural gate, because a per-site conversion does not stop the next clause arriving in the same shape.

**Note on the reported line.** `cli/src/worktree.test.ts:557` does not exist on `origin/main`: PR #608 added the assertion together with the reworded message, on branch `feat/task-cli-start-remediation-tail-clipped-on-human-channel` (still unmerged). That worker already presence-checked its own four sites inline, so that instance is repaired there — I did not duplicate it. The class fix covers it either way: the rule fires on the idiom wherever it appears.

## Red-on-reversal proof

**A — ordering reversed in the product message** (`lib/src/worktree.ts` `strictGateBinFailure`: remedy moved after the diagnosis and the named list):

```
FAIL lib/src/worktree.test.ts > … > puts the npm ci remedy BEFORE the named-bin list …
Error: assertOrder: needles #1 and #2 are out of order.
  #1: "npm ci" at index 2675
  #2: "x-tracker.strict-gate-bins is set" at index 0
  subject: x-tracker.strict-gate-bins is set: refusing the claim commit — … (2768 chars total)
 Tests  1 failed | 68 passed (69)
```

**B — clause reworded in the product message** (`confirm no live writer` → `confirm there is no live writer`):

```
Error: assertOrder: needle #1 is ABSENT from the subject, so the ordering around it could
not be asserted (a bare indexOf comparison would have passed vacuously against -1).
  needle: "confirm no live writer"
  If this clause is genuinely optional here, say so explicitly:
  { text: "confirm no live writer", optional: true }.
```

**C — the decisive A/B on identical bytes.** With the reword applied AND the site carrying no neighbouring `toContain` — same mechanism and same scene as PR #608 (a reworded clause that only an ordering assertion depended on, with no presence assertion beside it), but NOT the same syntax: #608's shipped shape was the VARIABLE form (`const hint = message.indexOf("If this is an identity error"); expect(hint).toBeLessThan(gateOutput)`), which this rule deliberately cannot match. This A/B arms the INLINE form at the site instead:

- bare idiom as it shipped → `Tests  1 passed` — **green on a clause that is not in the message at all**;
- `assertOrder` on the same armed bytes → `FAIL … needle #1 is ABSENT`.

Same subject, same rename; the only difference is whether presence is a precondition.

**D — the structural gate.** Reintroducing the idiom behind the helper's back in `cli/src/tui.test.ts`:

```
cli/src/tui.test.ts:1183:5: error[ordering-assertions-use-assert-order]: Ordering assertions must
go through assertOrder (test/assert-order.ts), not a bare `expect(text.indexOf(needle))…`
npm run lint:structure exit code = 1        (0 after revert)
```

**E — the helper's own suite** asserts the defect in-suite: `expect(message.indexOf("if this is an identity error")).toBeLessThan(...)` is _demonstrated_ to be green on the reworded message, next to the `assertOrder` call that rejects it. That is why `cli/src/assert-order.test.ts` is the one file the rule ignores.

All mutations were reverted; `git status` is clean.

## Gates

`npm run build` → `npm test` (125 files, 2566 passed) → `npm run lint` (0) → `npm run arggon -- validate` (ok, 0 warnings) → `npm run check:plugin` (0) → `npm run test:structure` (5 rules pass) → `npm run lint:structure` (0). All run after `git rebase origin/main`.

## Shared-file note

`test/assert-order.ts` is new and inside the shared test-helper directory (next to `test/acceptance.ts` / `test/property-runner.ts`), as the item asked for a shared helper. It adds no exports to any existing helper module and edits no other item's test file. `opencode/plugins/arggon/tools.test.ts` is touched (import + 4 assertion blocks) — no other worker owns it, but flagging it since it lives in the native plugin package.

### handoff 2026-10-03 @Arggon — next: Review + merge PR #616; then rebase PR #608 onto it so its four inline presence checks become assertOrder

- branch: fix/bug-vacuous-substring-ordering-assertions
- open questions: Should PR #608 swap its 4 inline presence checks for assertOrder, or is the inline form acceptable given the rule's documented variable-form blind spot?
