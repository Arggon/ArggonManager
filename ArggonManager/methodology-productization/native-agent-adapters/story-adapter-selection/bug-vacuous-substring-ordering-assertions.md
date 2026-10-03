---
type: bug
status: done
id: bug-vacuous-substring-ordering-assertions
title: "Ordering assertions using `indexOf(substring) < index` pass vacuously when the substring is absent (-1 < anything) — one such assertion is live in `cli/src/worktree.test.ts:557` after PR #608 reworded the message"
assignee: Arggon
branch: fix/bug-vacuous-substring-ordering-assertions
parent: story-adapter-selection
labels: [tests]
created: "2026-10-03"
updated: "2026-10-03"
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

---

(Merge union note: this file was merged as a UNION with `origin/main` during the F1-F5 fix push. Everything above is this branch's evidence comment and handoff; everything below is the earlier handoff and the reviewer's full verdict, carried over intact. The unticked `Acceptance:` list that preceded those blocks on `origin/main` is the same four criteria already ticked in `## Acceptance` above, so it is not re-appended — re-adding it would put a second, unchecked copy of the same criteria in the body.)

### handoff 2026-10-03 @ses_efea0882affep33K99Q6hjIX8P (session: ses_efea0882affep33K99Q6hjIX8P) — next: Review + merge the PR, then reopen the clip-order work to route new ordering assertions through assertOrder
- branch: main
- open questions: PR #608 (unmerged) has 4 ordering sites with inline presence checks — should its worker swap them for assertOrder after this merges?

### 2026-10-03 @code-reviewer
### 2026-10-03 @Reviewer (code-reviewer subagent)
verdict: request-changes (one blocking finding in the new ast-grep gate; the rest of the PR is verified merge-ready)

Read-only review of `fix/bug-vacuous-substring-ordering-assertions` (PR #616) against `ArggonManager/docs/engineering.md`. No gates executed by me — see **Probes needed**.

## Findings (severity order)

### F1 — BLOCKING (medium): the "numeric literal on the right" exemption is broader than its justification, and 5 of the 9 matcher×literal combinations it exempts still pass on an absent needle

`tools/ast-grep/rules/ordering-assertions-use-assert-order.yml:164-169`:

```yaml
  POSITION:
    not:
      regex: "^-?[0-9]+(\\.[0-9]+)?$"
```

The README (`tools/ast-grep/README.md:145-148`) and the rule's own yml comment justify the exemption with *"`-1 > 0` / `-1 >= 0` fail loudly, so those forms already pin presence"*. That is true of `toBeGreaterThan(n)` and `toBeGreaterThanOrEqual(n)` for `n >= 0`, and false for the rest. With an absent needle (`indexOf` → `-1`):

| exempted form | absent-needle result | verdict |
| --- | --- | --- |
| `toBeGreaterThan(0)` / `(38)` | `-1 > 0` false → loud ✓ | sound |
| `toBeGreaterThanOrEqual(0)` | false → loud ✓ | sound |
| `toBeLessThan(0)` / `toBeLessThan(38)` | `-1 < 38` **true** → passes | **vacuous** |
| `toBeLessThanOrEqual(0)` / `(-1)` | `-1 <= -1` **true** → passes | **vacuous** |
| `toBeGreaterThanOrEqual(-1)` | `-1 >= -1` **true** → passes | **vacuous** |

So the gate treats the *same* claim as dangerous when the RHS is a variable (`expect(m.indexOf("x")).toBeLessThan(idx)` fires) and as safe when the RHS happens to be a literal — and in the literal case with `<`/`-OrEqual` it silently passes on absence. This is the exact failure mode the item exists to kill, re-introducible through the carve-out.

It is also *realistically* reachable, not theoretical: `expect(hint, "…must be present").toBeGreaterThanOrEqual(0)` is the presence guard PR #608's worker wrote at `cli/src/worktree.test.ts:566-567,1079-1080` and `cli/src/start.test.ts:331`; the `-1` variant of that same spelling is one keystroke away and is vacuous **and** exempt.

No live site is wrong today (I checked exhaustively — see "Sweep completeness"), which is why this is a fix-the-gate finding rather than a live-test finding. But the rule is the durable deliverable and its shipped doc asserts a false soundness property, so it should not merge as written.

Minimal fix: keep the numeric carve-out only where it is actually sound (e.g. constrain `MATCHER` to `^(toBeGreaterThan|toBeGreaterThanOrEqual)$` **and** `POSITION` to a non-negative literal when the RHS is numeric), and add an `invalid` fixture for one `toBeLessThan(<literal>)` form plus one `toBeGreaterThanOrEqual(-1)` form so `npm run test:structure` pins it. Then fix the two justifying sentences in the README/yml so the stated contract matches the implemented one.

### F2 — low: `assertOrder` can still be a no-op when every needle is optional and absent

`test/assert-order.ts:236-265`: an absent optional needle is skipped in the presence loop and skipped again in the order loop, so

```ts
assertOrder(msg, { text: "a", optional: true }, { text: "b", optional: true }); // returns silently
```

passes while asserting nothing. The `needles.length < 2` guard exists for exactly this "asserts nothing" reason; the symmetric case is all-optional. Suggest requiring at least two **required** needles (or at least one required anchor), with the same error text. No call site uses `optional` today (verified), so this is hardening, not a live defect.

### F3 — low: the "22 sites across 7 test files" bookkeeping is wrong, and it is repeated in four places

Actual, by reading the diff: **23** removed ordering assertions (plus 6 removed `toBeGreaterThan(-1)`/`(0)` anchors that are subsumed) collapse into **19** `assertOrder` call sites across **8** test files — `lib/src/worktree.test.ts` (5), `opencode/plugins/arggon/tools.test.ts` (6), `cli/src/board.test.ts` (2), `cli/src/headless-ci.test.ts` (2), `cli/src/adopt.test.ts` (1), `cli/src/init.test.ts` (1), `cli/src/init-opencode.test.ts` (1), `cli/src/tui.test.ts` (1). "22" appears in the PR body, acceptance box 2, the README's *"this is how all 22 swept sites were written"* (in fact only 8 of the 23 were one-sided; the rest were two-sided) and a rule-test fixture comment. On an item whose whole thesis is that test artifacts must not assert something other than what they do, the count should be right.

### F4 — low: `CONTRIBUTING.md`'s "What the guard does and does not claim" now under-describes the guard

That section (≈:99-113) enumerates the *tracker* rules and the *native* rule as the two guarded boundaries; the ordering rule is a third and is not mentioned. It does defer to `tools/ast-grep/README.md`, which **is** updated, so this is non-blocking — one bullet keeps the contributor-facing summary honest.

### F5 — nit: "exactly the PR #608 scene" overstates by one syntactic dimension

See evidence item 5b below. The *mechanism* and the *scene* are reproduced; the *syntax* is not. The item body and the PR body's Notes both get this right, so only the A/B table caption needs softening.

## Evidence — what I verified by reading

**1. Presence really is a precondition, not a side check.** `test/assert-order.ts:223-265`: the length guard runs, then a presence loop iterates **all** needles and throws on `clause.index === -1 && !clause.optional`, and only after that loop completes does the order loop start. No input can reach the order comparison with an absent required needle — the presence loop either throws or exhausts. Diagnostics name the position (`needle #2`), quote the needle via `JSON.stringify` (newlines visible), print the subject through `excerpt()` (400-char cap + `(N chars total)`), and name the escape hatch verbatim. Actionable, per the "Errors are actionable" bar. Truncation and naming are pinned by `cli/src/assert-order.test.ts:55-66`.

**2. The optionality hatch cannot become the same bug.** `export type OrderNeedle = string | { readonly text: string; readonly optional?: true }` (`test/assert-order.ts:181`) — `optional?: true` makes `false` unassignable, so `{ text, optional: false }` does not compile; and `resolve()` normalises with `needle.optional === true` (`:184-188`), so a cast cannot smuggle it back at runtime either (pinned by `cli/src/assert-order.test.ts:113-126`). This is **enforced in CI, not just asserted in prose**: `tsconfig.typecheck.json` includes `cli/src/**/*.ts` with `"exclude": []`, `npm run build` runs it (`.github/workflows/ci.yml:43`), so the `@ts-expect-error` at `cli/src/assert-order.test.ts:118` is load-bearing. No swept site needed optional: `rg 'optional: true'` across the branch's test files hits only the helper's own suite — the worker did not invent one. The conditional-clause claim checks out: `Preparation ran:` really is gated on `steps.length > 0` (`lib/src/worktree.ts:991`) yet the asserting fixture runs prep (it already asserted `toContain("Preparation ran:")` at `opencode/plugins/arggon/tools.test.ts:1919`), so `required` is the correct encoding there.

**3. The conversions are correct; no needle was altered and no site weakened.** Every added needle string is byte-identical to the string in the removed line. The 6 removed presence anchors are all subsumed by `assertOrder`'s precondition — including `expect(firstFile).toBeGreaterThan(0)` at `lib/src/worktree.test.ts:1345`, which is *strictly* subsumed (remedy present at `>= 0` ⇒ `files[0] > remedy >= 0`). Three pairwise chains (`lib/src/worktree.test.ts:1346-1350`, `opencode/plugins/arggon/tools.test.ts:2113,2118,2389`) were kept pairwise rather than merged — no loss, matches "only already-transitively-ordered chains were merged". **One site is stricter than the PR body claims**: `lib/src/worktree.test.ts:799` now also asserts `x-tracker.strict-gate-bins is set < firstEntry`, which the old pair (`npm ci < x-tracker…`, `npm ci < firstEntry`) does not imply. I verified it is true against the single template literal at `lib/src/worktree.ts:939-943` (clauses appear in exactly that order), so it is a legitimate tightening of the clip-order contract — only the "preserve each site's original pairwise claim" sentence is inaccurate.

**4. The gate fires and its scoping is real; its numeric exemption is F1.** `sgconfig.yml` maps `**/*.ts(x)` to the `Tsx` parser, so `language: Tsx` covers `.ts`. `npm run test:structure` (`ci.yml:51`) runs `ast-grep test` over `testConfigs.testDir: tools/ast-grep/tests`, and the new `ordering-assertions-use-assert-order-test.yml` is picked up by name; its `invalid` block holds the verbatim shipped defect plus all four matchers, the one-sided form, the loop form, a two-arg `indexOf`, and a non-literal POSITION. `lint:structure` (`ci.yml:52`) is blocking with no `continue-on-error`. The per-rule `ignores: cli/src/assert-order.test.ts` is honoured — proven by the green lane while that file still holds the bare idiom at :44. The variable-form blind spot is documented honestly in both the README and the rule note, and it is a real blind spot (see 5b).

**5. The red-on-reversal proofs.** (a) The quoted diagnostic matches `test/assert-order.ts:257-262` template-for-template, and the indices (`npm ci` at 2675, `x-tracker…` at 0) are consistent with the real message layout, so a genuine reversal of that template produces exactly that output. (b) **Stronger than the PR body claims**: the A/B is a permanent in-suite test, `cli/src/assert-order.test.ts:37-53` — on one constant it asserts `indexOf(absent) === -1`, that the bare idiom `toBeLessThan` comparison **passes**, and that `assertOrder` throws `/ABSENT/`. The vacuity is demonstrated by the suite forever, not only in a probe transcript. (c) the gate trip is claimed in a transcript; the durable equivalent is the fixture suite, which CI runs.
  *F5 qualification*: #608's actual shipped shape was the **variable** form — `const hint = message.indexOf("If this is an identity error"); expect(hint).toBeLessThan(gateOutput)` (`cli/src/worktree.test.ts:564-568` on that branch) — which the new rule deliberately cannot match. So (b) reproduces the mechanism and the "absent clause, no neighbouring presence guard" scene, not that syntax. Honest, and the item body says so.

**6. Both self-reported findings hold up, and the sibling list is sound.** Verified the reported line is absent from `origin/main`: `git show origin/main:cli/src/worktree.test.ts` :550-562 has no ordering assertion and "identity error" appears nowhere in that file on the branch — the site exists only on #608, where it is already presence-guarded (I found 3 of the claimed 4 guards there; immaterial, different worker's file). `cli/src/milestone.test.ts:164-166` does assert `order.every(i => i >= 0)` beside the sort claim, which is what kills the all-`-1` pass. `smoke/context-report.test.ts:95` is `toBe(38)` (exact). `calls[0][calls[0].indexOf("--state") + 1]` → absent gives element 0, so `toBe("merged")` fails loudly. **Sweep completeness** — my own exhaustive census of `indexOf` inside `expect(` across every `*.test.ts(x)`/`*.spec.ts(x)` on the branch returns exactly 5 real assertions, all sound, plus the 2 in the helper's own suite: the sweep missed nothing. (The "reviewed and left" *list* is incomplete though: `cli/src/board-parity.test.ts:44-45,52-53`, `cli/src/config-race.test.ts:59-60` and `opencode/plugins/arggon/board.test.ts:497-498` are more sound variable-form siblings not named. F3/F4 territory, not defects.)

**7. Shared-file discipline is clean.** `test/assert-order.ts` is new; no other file in `test/` changed; no existing helper gained exports. `opencode/plugins/arggon/tools.test.ts` is exactly three hunks — one import plus the three assertion blocks — and nothing else in that file moved (`check:plugin`, `ci.yml:48), proves the committed bundle did not drift). The helper is not shipped: the emit project includes only `cli/src/**/*.ts`, and `files` in `package.json` does not list `test/`. Relative import paths resolve correctly from `lib/src`, `cli/src` and `opencode/plugins/arggon`, and `tsconfig.typecheck.json`/`lib/tsconfig.typecheck.json` both pick the helper up through the import graph.

**Docs travel with code**: the rule ships a README section in the sibling rules' format, `CONTRIBUTING.md` still points at that README, and all four acceptance boxes on the item are ticked with the reasoning attached.

## Probes needed (not run by me — coordinator routes to `arggon-prover`)

1. **After the F1 fix**, in worktree `/home/arggon/Projects/ArggonManager-bug-vacuous-substring-ordering-assertions`: `npm run test:structure` — expected: the new `invalid` fixtures for `toBeLessThan(<literal>)` and `toBeGreaterThanOrEqual(-1)` match, every existing `valid` fixture still does not, and the previously-exempt-but-sound `toBeGreaterThan(0)`/`(38)`/`(-1)` fixtures still pass. A red here flips the verdict back to approve-blocking.
2. Same worktree: `npm run lint:structure` — expected: exit 0 across the repo, and no live test file trips the tightened constraint (my read says none will; this confirms it).
3. Same worktree: `npm run build` — expected: the `@ts-expect-error` at `cli/src/assert-order.test.ts:118` still holds (the yml change cannot affect it, but it is the CI-enforced half of the `optional?: true` claim and costs nothing to re-confirm).
4. Optional, only if you want the PR body's transcripts re-anchored: re-run the reversal probe on `lib/src/worktree.test.ts` (move `npm ci` after the named list) and the byte-identical A/B, capturing expected-vs-observed. I verified the diagnostic text and the message layout by reading, but not the runs.

## Recommendation

**No-merge until F1 lands.** F1 is a ~4-line constraint fix plus two rule-test fixtures and two doc sentences; everything else in this PR is verified correct, in scope, and merge-ready. F2-F5 are cheap and worth folding into the same push but none of them needs to hold the merge on its own.

### 2026-10-03 @Arggon
### Review round 2 — F1 (blocking) fixed; F2–F5 folded in

**F1 — the numeric-literal exemption is now exactly as narrow as its justification.** I reproduced the reviewer's table independently before touching anything; it is correct. The first cut justified the exemption with "`-1 > 0` / `-1 >= 0` fail loudly" but implemented *not any numeric literal*, so `-1 < 38`, `-1 <= -1` and `-1 >= -1` — all **true** — were exempt *and* vacuous. The gate flagged the same claim with a variable RHS and waved it through with a literal RHS.

Exemption is now the comparator/argument pairs whose comparison is false for `-1`:
- `toBeGreaterThan(n)` → `n >= -1`
- `toBeGreaterThanOrEqual(n)` → `n >= 0`
- `toBeLessThan(n)` / `toBeLessThanOrEqual(n)` → **fire on every literal** (they are sound only at `n <= -1` / `n <= -2`, i.e. assertions that can never hold)

**Proof it is right, not just narrower:** I generated all 4 matchers × 6 literals (`-2 -1 -0.5 0 1 38`) = 24 probe assertions, scanned them with the shipped rule, and compared fire/no-fire against the real evaluation of `-1 <op> n`.

- fires on **17 of 24**;
- **every vacuous combination is among those 17** — zero vacuous forms remain exempt;
- the 5 sound combinations it also fires on are impossible or exotic (`toBeLessThan(-1)` can never hold; `-0.5` margins) — over-approximating in the safe direction;
- `lint:structure` exit 0 → **no live file trips the tightened constraint**, so this is not churn on a correct existing guard.

**What each new fixture kills:**

| fixture | kills |
| --- | --- |
| `toBeLessThan(38)` | `-1 < 38` true — vacuous, was exempt |
| `toBeLessThanOrEqual(-1)` | `-1 <= -1` true — vacuous, was exempt |
| `toBeLessThanOrEqual(0)` | `-1 <= 0` true — vacuous, was exempt |
| `toBeGreaterThanOrEqual(-1)` | `-1 >= -1` true — vacuous, was exempt, and one keystroke from the **sound** `toBeGreaterThanOrEqual(0)` guard #608 used |
| `toBeGreaterThan(-0.5)` | negative literals other than `-1`; `-1 > -0.5` is true |

The previously-sound `valid` fixtures (`toBeGreaterThan(0)`, `toBeGreaterThan(-1)`, `toBeGreaterThanOrEqual(0)`/`(1)`) still pass — narrowed, not dropped.

**F2 — `assertOrder` no longer a no-op when every needle is optional.** Hole confirmed first. **Decision: at least two needles must be REQUIRED** — an order is a claim about two things, and optional clauses may refine a required order but never constitute one. The floor is checked against the **call**, not the **data**, deliberately: the reviewer's "at least one clause present" alternative would make the guarantee depend on the message a run happens to produce, so the same assertion could pass on one input and throw on another. Two *required* needles make it a static property readable in the source. Four new tests, including the original hole reproduced through the real helper.

**F3 — the count was wrong, corrected everywhere.** It is **23** vacuous-capable ordering assertions + **6** subsumed presence anchors → **19** `assertOrder` call sites across **8** test files, not "22 across 7". Two independent errors: `adopt.test.ts` was missing from the file list, and chains were counted per assertion rather than per call. Fixed in all four places; the per-file table now states its **counting rule** (an *ordering assertion* has a non-literal matcher argument; a *presence anchor* has a literal one) so the total is checkable — which is also what exposed that `headless-ci.test.ts:414` (`indexOf(...) > -1`) is an anchor, not an ordering assertion. Also recorded the one conversion that is deliberately **stricter** than what it replaced (`lib/src/worktree.test.ts:799`).

**F4** — `CONTRIBUTING.md`'s guard summary now names the third boundary. **F5** — the A/B caption now says *same mechanism and same scene, not the same syntax*: #608 shipped the variable form, which the rule deliberately cannot match. Also completed the "reviewed and deliberately left" list with the sound variable-form siblings.

**Gates** after `git merge origin/main`: `build` (the `@ts-expect-error` still holds) → `test` (125 files, 2570 passed) → `lint` → `arggon validate` (ok) → `check:plugin` → `test:structure` (5 rules, 38 assertions) → `lint:structure` (0). All green.

**Merge note.** The item file conflicted (main carries the earlier handoff and the reviewer's verdict; this branch carries its own evidence). Resolved as a **union** — nothing discarded — and pushed by merge, never force-pushed.
