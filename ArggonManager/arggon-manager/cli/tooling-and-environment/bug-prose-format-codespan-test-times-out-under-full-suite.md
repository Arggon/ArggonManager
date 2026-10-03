---
type: bug
status: todo
id: bug-prose-format-codespan-test-times-out-under-full-suite
title: cli/src/prose-format.test.ts code-span test times out at its 30s limit under full-suite load; passes alone at ~30s
parent: tooling-and-environment
labels: [tests, flake]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-prose-format-codespan-test-times-out-under-full-suite.md
  Leaves live only under a story. id is the filename stem: bug-prose-format-codespan-test-times-out-under-full-suite.
  CLI `arggon create bug prose-format-codespan-test-times-out-under-full-suite` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cli/src/prose-format.test.ts code-span test times out at its 30s limit under full-suite load; passes alone at ~30s

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @Arggon
Coordinator record for `bug-prose-format-codespan-test-times-out-under-full-suite`, filed from PR #620 (`task-adr-index-parity-does-not-check-titles`), 2026-10-03.

**What the worker hit.** `cli/src/prose-format.test.ts`'s code-span test timed out at its 30s limit on one full-suite run. It **passes alone at ~30s** — i.e. the per-test timeout is set at the exact value the test needs when unloaded, so under any parallel load it has zero headroom. The suite was green on re-run, so it is a flake, not a failure.

This is the third distinct flaky lane found today, and they are not the same bug:
- `bug-cli-spawn-suites-exit-1-flake` — `SpawnHarnessError` / `lib/dist` rebuild drift under load
- `bug-mcp-parity-branch-test-json-parse-of-human-stdout` (merged) — a `JSON.parse` of non-envelope text that only fires under full-suite load
- this one — a test whose budget has no margin

Acceptance:
- [ ] Confirm the 30s limit is the cause rather than a coincidence: read the test's declared timeout and measure the test's actual duration alone versus under the full suite, and say what the margin is
- [ ] If the cause is a no-headroom timeout, the fix is to give it real headroom **and** to fix why the test costs ~30s at all. `prose-format` runs `prettier.format` over every tracked markdown under `ArggonManager/docs/`; a rule that is O(corpus × passes) is the more interesting defect, and raising the timeout would hide it
- [ ] Check whether other suites declare timeouts at values close to their measured cost — if this suite is one of several sitting at zero headroom, that is the class
- [ ] Note the interaction with the two tracked prettier bugs (`bug-prettier-glues-split-inline-code-span`, `bug-prettier-indented-list-continuation-grows-2-spaces-per-write`): a test that runs `prettier.format` on the corpus is exactly what would notice a non-idempotent formatter, and it is currently the flakiest lane. Fix the flake in a way that does not weaken what the corpus round-trip is asserting
