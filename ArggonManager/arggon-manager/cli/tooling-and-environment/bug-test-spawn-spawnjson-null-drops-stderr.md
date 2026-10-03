---
type: bug
status: todo
id: bug-test-spawn-spawnjson-null-drops-stderr
title: "`test-spawn` spawnJson resolves `null` on empty stdout and discards stderr with `void err;`, so a spawn/load failure is indistinguishable from a resolved value — same trigger as the mcp-parity flake, different helper"
parent: tooling-and-environment
labels: [tests, ci]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-test-spawn-spawnjson-null-drops-stderr.md
  Leaves live only under a story. id is the filename stem: bug-test-spawn-spawnjson-null-drops-stderr.
  CLI `arggon create bug test-spawn-spawnjson-null-drops-stderr` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `test-spawn` spawnJson resolves `null` on empty stdout and discards stderr with `void err;`, so a spawn/load failure is indistinguishable from a resolved value — same trigger as the mcp-parity flake, different helper

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #612 (bug-mcp-parity-branch-test-json-parse-of-human-stdout), 2026-10-03, while fixing the sibling failure the coordinator pointed it at. It deliberately did NOT fold this into that PR, per instruction — different helper, different symptom class, same trigger.

**The defect.** In `cli/src/test-spawn.ts`, the spawn helper `spawnJson` resolves `null` when the child produces empty stdout, and **discards stderr via `void err;`**. So a spawn/load failure and a legitimately empty value are indistinguishable at the call site.

The concrete symptom, from CI on PR #611: `cascade.test.ts` "two concurrent sibling done-flips both land and the ancestor ends consistent" failed with

```
round 0: null: expected null to match object { ok: true }
```

The worker's reasoning for why this is NOT a lost update: `update --json` still writes an `ok:false` envelope on failure, so a `null` can only mean the child never got that far — a spawn/load failure. That is the right read, and it is why this must not be filed as a cascade defect.

**Why it still matters, and why it is the more useful half of the pair.** The known `bug-cli-spawn-suites-exit-1-flake` class produces failures whose evidence is thrown away at the exact point it would be captured. A test that fails with `null` teaches the next reader nothing: no command, no stderr, no exit code, no classification. PR #612's own fix made the MCP path diagnosable (`EnvelopeReadError` names surface, command, `isError`, stdout and stderr); this helper has the same blind spot and did not get the same treatment.

Acceptance:
- [ ] `spawnJson` never resolves `null` silently — a spawn/load failure surfaces the command, exit code, stderr and the existing `classifySpawnFailure` classification
- [ ] Callers that legitimately expect an empty result can still say so explicitly (an opt-in, not an ambiguity)
- [ ] The `void err;` discard is gone; stderr is either reported or explicitly documented as unused at that call site
- [ ] Cascade and any other null-asserting call sites get a failure message that names what was actually observed
- [ ] Considered together with `bug-cli-spawn-suites-exit-1-flake`: if fixing the diagnosability makes that flake trivially classifiable, say so in the notes rather than filing a third item
